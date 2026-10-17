"use client";

import { useDeferredValue, useEffect, useRef, useState } from "react";
import { createClient } from "@/lib/supabase/client";
import { orIlike, pageRange } from "@/lib/supabase/pagination";
import { Catalog } from "./Catalog";
import { Cart, type CheckoutInput } from "./Cart";
import { toThaiError } from "@/lib/errors";
import { ConfirmDialog } from "@/app/_components/ConfirmDialog";
import { QueueBanner } from "./QueueBanner";
import {
  applyQueueToCatalog,
  markFailed,
  readCachedCatalog,
  readQueue,
  removeFromQueue,
  writeCachedCatalog,
  type QueuedSale,
} from "./queue";
import type { CartLine, CatalogRow, Carrier } from "./types";
import type { CatalogTab, CatalogTabInfo } from "./Catalog";
import { iconForCategory } from "./CategoryIcon";
import { useBarcodeScanner } from "./useBarcodeScanner";
import type { Json } from "@/lib/types/database";
import type { CashStatus } from "@/lib/cash/types";
import { CASH_PAUSE_KEY, RECEIPT_OFFLINE_MESSAGE, cashStatus, getReceivingDevice, isCashQueueReadable, isDefiniteCashError, isReceivingLocallyPaused, pauseReceivingPos, resumeReceivingPos, withReceivingIntake } from "@/lib/cash/client";
import { clearReceipt, prepareReceipt, sendReceipt } from "@/lib/cash/receipt";
import { PendingCashRequests } from "@/lib/cash/PendingCashRequests";
import { OpeningCoveredQueue } from "./OpeningCoveredQueue";

type CachedCatalogPage = {
  page?: number;
  pageSize?: number;
  search?: string;
  kind?: CatalogTab;
  total?: number;
  catalog: CatalogRow[];
  topProducts: CatalogRow[];
};

const BASE_TABS: CatalogTabInfo[] = [
  { value: "all", label: "ทั้งหมด", icon: "all" },
  { value: "device", label: "โทรศัพท์", icon: "phone" },
  { value: "topup", label: "เติมเงิน", icon: "topup" },
];

export default function PosPage() {
  const supabase = createClient();

  const [pendingRemoveUuid, setPendingRemoveUuid] = useState<string | null>(null);
  const [catalog, setCatalog] = useState<CatalogRow[]>([]);
  const [topProducts, setTopProducts] = useState<CatalogRow[]>([]);
  const [catalogSearch, setCatalogSearch] = useState("");
  const deferredCatalogSearch = useDeferredValue(catalogSearch);
  const [catalogTab, setCatalogTab] = useState<CatalogTab>("all");
  const [catalogTabs, setCatalogTabs] = useState<CatalogTabInfo[]>(BASE_TABS);
  const [catalogPage, setCatalogPage] = useState(1);
  const [catalogPageSize, setCatalogPageSize] = useState(24);
  const [catalogTotal, setCatalogTotal] = useState(0);
  const [catalogLoading, setCatalogLoading] = useState(true);
  const [catalogError, setCatalogError] = useState<string | null>(null);
  const [carriers, setCarriers] = useState<Carrier[]>([]);
  const [lines, setLines] = useState<CartLine[]>([]);
  const [clientUuid, setClientUuid] = useState(() => crypto.randomUUID());
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [queue, setQueue] = useState<QueuedSale[]>([]);
  const [isSyncing, setIsSyncing] = useState(false);
  const [scanFeedback, setScanFeedback] = useState<string | null>(null);
  const catalogRequestRef = useRef(0);
  const scanBusyRef = useRef(false);
  const moneyBusyRef = useRef(false);
  const syncBusyRef = useRef(false);
  const ackBusyRef = useRef(false);
  const [cashBook, setCashBook] = useState<CashStatus | null>(null);
  const [deviceId, setDeviceId] = useState("");
  const [cashError, setCashError] = useState<string | null>(null);
  const [isChangingReceiving, setIsChangingReceiving] = useState(false);

  useEffect(() => {
    let isCancelled = false;
    const refresh = () => {
      if (moneyBusyRef.current || syncBusyRef.current || ackBusyRef.current) return;
      cashStatus({ cached: true }).then((status) => {
        if (!isCancelled) { setCashBook(status); setDeviceId(getReceivingDevice()); setCashError(null); }
      }).catch(() => { if (!isCancelled) setCashError("ตรวจสถานะเงินสดไม่ได้ กรุณาเชื่อมต่อก่อนรับเงิน"); });
    };
    const storageChanged = (event: StorageEvent) => {
      if (event.key?.startsWith(CASH_PAUSE_KEY)) {
        setCashBook(previous => previous ? { ...previous } : previous);
        refresh();
      }
    };
    Promise.resolve().then(() => { setDeviceId(getReceivingDevice()); refresh(); });
    const timer = window.setInterval(refresh, 15000);
    window.addEventListener("online", refresh);
    window.addEventListener("storage", storageChanged);
    return () => { isCancelled = true; window.clearInterval(timer); window.removeEventListener("online", refresh); window.removeEventListener("storage", storageChanged); };
  }, []);

  async function changeReceiving(shouldPause: boolean) {
    if (ackBusyRef.current || syncBusyRef.current || moneyBusyRef.current) return;
    ackBusyRef.current = true; setIsChangingReceiving(true); setCashError(null);
    try { setCashBook(await (shouldPause ? pauseReceivingPos() : resumeReceivingPos())); }
    catch (failure) {
      setCashError(failure instanceof Error ? failure.message : "ยืนยันสถานะเครื่องรับเงินไม่ได้ กรุณาลองอีกครั้ง");
      setCashBook(previous => previous ? { ...previous } : previous);
    } finally { ackBusyRef.current = false; setIsChangingReceiving(false); }
  }

  async function loadCatalog() {
    const requestId = ++catalogRequestRef.current;
    setCatalogLoading(true);
    setCatalogError(null);
    const { from, to } = pageRange(catalogPage, catalogPageSize);

    try {
      let catalogQuery = supabase
        .from("v_pos_catalog")
        .select("*", { count: "exact" });
      if (catalogTab === "device") catalogQuery = catalogQuery.eq("kind", "device");
      if (catalogTab.startsWith("cat:")) {
        catalogQuery = catalogQuery.eq("kind", "product").eq("category_name", catalogTab.slice(4));
      }
      const searchFilter = orIlike(["name", "code"], deferredCatalogSearch);
      if (searchFilter) catalogQuery = catalogQuery.or(searchFilter);

      const [catalogResult, topResult] = await Promise.all([
        catalogQuery
          .order("name", { ascending: true })
          .order("id", { ascending: true })
          .range(from, to),
        supabase
          .from("v_pos_top_products")
          .select("*")
          .order("name", { ascending: true })
          .order("id", { ascending: true })
          .limit(8),
      ]);
      if (catalogResult.error) throw catalogResult.error;

      const rawCatalog = (catalogResult.data ?? []) as CatalogRow[];
      // Top products are a convenience rail; a failed optional query must not hide the
      // paginated catalog or stop the cashier from completing the current bill.
      const rawTop = topResult.error ? [] : ((topResult.data ?? []) as CatalogRow[]);
      const deviceIds = Array.from(
        new Set(
          [...rawCatalog, ...rawTop]
            .filter((row) => row.kind === "device" && row.id)
            .map((row) => row.id!),
        ),
      );
      let stockRows: { id: string | null; acquisition: string | null }[] = [];
      if (deviceIds.length > 0) {
        const stockResult = await supabase
          .from("v_pos_stock")
          .select("id, acquisition")
          .in("id", deviceIds);
        if (stockResult.error) throw stockResult.error;
        stockRows = stockResult.data ?? [];
      }
      if (requestId !== catalogRequestRef.current) return;

      const acquisitionById = new Map(
        stockRows.filter((row) => row.id).map((row) => [row.id!, row.acquisition] as const),
      );
      const enrichDevices = (rows: CatalogRow[]): CatalogRow[] =>
        rows.map((row) =>
          row.kind === "device"
            ? { ...row, acquisition: acquisitionById.get(row.id ?? "") ?? null }
            : row,
        );
      const nextCatalog = enrichDevices(rawCatalog);
      const nextTop = enrichDevices(rawTop);
      const nextTotal = catalogResult.count ?? nextCatalog.length;
      const activeQueue = readQueue();
      const filteredCatalog = applyQueueToCatalog(nextCatalog, activeQueue);
      const filteredTop = applyQueueToCatalog(nextTop, activeQueue);
      setCatalog(filteredCatalog);
      setTopProducts(filteredTop);
      setCatalogTotal(nextTotal);
      // The snapshot is the last successful page shown by the screen. It is only ever
      // written from a successful load, never from the offline queue path.
      writeCachedCatalog({
        page: catalogPage,
        pageSize: catalogPageSize,
        search: deferredCatalogSearch,
        kind: catalogTab,
        total: nextTotal,
        catalog: nextCatalog,
        topProducts: nextTop,
      });
    } catch (loadError) {
      if (requestId !== catalogRequestRef.current) return;
      const cached = readCachedCatalog<CachedCatalogPage>();
      if (cached && Array.isArray(cached.catalog) && Array.isArray(cached.topProducts)) {
        const activeQueue = readQueue();
        const filteredCatalog = applyQueueToCatalog(cached.catalog, activeQueue);
        const filteredTop = applyQueueToCatalog(cached.topProducts, activeQueue);
        setCatalog(filteredCatalog);
        setTopProducts(filteredTop);
        setCatalogTotal(cached.total ?? filteredCatalog.length);
        setCatalogError("โหลดรายการล่าสุดไม่สำเร็จ กำลังแสดงหน้าที่โหลดไว้ก่อนหน้า");
      } else {
        setCatalog([]);
        setTopProducts([]);
        setCatalogTotal(0);
        setCatalogError(toThaiError(loadError));
      }
    } finally {
      if (requestId === catalogRequestRef.current) setCatalogLoading(false);
    }
  }

  useEffect(() => {
    Promise.resolve().then(() => loadCatalog());
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [catalogPage, catalogPageSize, catalogTab, deferredCatalogSearch]);

  useEffect(() => {
    supabase
      .from("v_pos_topup_carriers")
      .select("*")
      .then(({ data }) => setCarriers(data ?? []));
    // ponytail: tab counts load once per visit; they are hints, a stale device count after a sale is fine.
    Promise.all([
      supabase.from("v_pos_catalog").select("kind, category_name"),
      supabase.from("categories").select("name, sort_order").order("sort_order").order("name"),
    ]).then(([rows, categories]) => {
      if (rows.error || categories.error) return;
      const counts = new Map<string, number>();
      rows.data.forEach((r) => {
        const key = r.kind === "device" ? "device" : `cat:${r.category_name ?? ""}`;
        counts.set(key, (counts.get(key) ?? 0) + 1);
      });
      const categoryTabs = categories.data
        .filter((c) => counts.has(`cat:${c.name}`))
        .map((c): CatalogTabInfo => ({ value: `cat:${c.name}`, label: c.name, icon: iconForCategory(c.name), count: counts.get(`cat:${c.name}`) }));
      setCatalogTabs([
        { ...BASE_TABS[0], count: rows.data.length },
        { ...BASE_TABS[1], count: counts.get("device") ?? 0 },
        ...categoryTabs,
        BASE_TABS[2],
      ]);
    });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // the queue only drains on an explicit signal: the browser saying the network is back,
  // a fresh page load, a finished bill, or the staff pressing the button
  useEffect(() => {
    const onOnline = () => {
      syncQueue();
    };
    window.addEventListener("online", onOnline);
    // ESLint forbids setState in an effect body, and syncQueue raises the syncing flag
    // on its first line — hop off the effect body before touching state.
    Promise.resolve().then(() => syncQueue());
    return () => window.removeEventListener("online", onOnline);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  function addCatalogItem(item: CatalogRow) {
    if (!item.id) return;
    setLines((prev) => {
      if (item.kind === "product") {
        const existing = prev.find(
          (l) => l.kind === "product" && l.id === item.id,
        );
        if (existing && existing.kind === "product") {
          return prev.map((l) =>
            l.uid === existing.uid && l.kind === "product"
              ? { ...l, qty: Math.min(l.maxQty, l.qty + 1) }
              : l,
          );
        }
        return [
          ...prev,
          {
            uid: crypto.randomUUID(),
            kind: "product",
            id: item.id!,
            name: item.name ?? "",
            unitPrice: item.price ?? 0,
            qty: 1,
            maxQty: item.qty ?? 1,
            discount: 0,
            discountReason: "",
          },
        ];
      }
      if (prev.some((l) => l.kind === "device" && l.id === item.id)) {
        return prev;
      }
      return [
        ...prev,
        {
          uid: crypto.randomUUID(),
          kind: "device",
          id: item.id!,
          name: item.name ?? "",
          unitPrice: item.price ?? 0,
          discount: 0,
          discountReason: "",
        },
      ];
    });
  }

  useBarcodeScanner((code) => {
    if (scanBusyRef.current) return;
    scanBusyRef.current = true;
    setScanFeedback(`กำลังค้นหารหัส ${code}`);
    void (async () => {
      try {
        let item = [...catalog, ...topProducts].find((row) => row.code === code);
        if (!item) {
          const { data, error: lookupError } = await supabase
            .from("v_pos_catalog")
            .select("*")
            .eq("code", code)
            .limit(2);
          if (lookupError) throw lookupError;
          if ((data?.length ?? 0) > 1) {
            setScanFeedback(`รหัส ${code} ตรงกับหลายรายการ กรุณาเลือกสินค้าจากรายการ`);
            return;
          }
          item = applyQueueToCatalog((data ?? []) as CatalogRow[], readQueue())[0];
        }

        if (!item?.id) {
          setScanFeedback(`ไม่พบรหัส ${code} หรือสินค้าถูกขายในคิวแล้ว`);
          return;
        }
        if (item.kind === "product" && (item.qty ?? 0) <= 0) {
          setScanFeedback(`${item.name ?? code} สินค้าหมด`);
          return;
        }
        const existing = lines.find((line) => line.kind !== "topup" && line.kind === item.kind && line.id === item.id);
        if (existing?.kind === "device" || (existing?.kind === "product" && existing.qty >= existing.maxQty)) {
          setScanFeedback(`${item.name ?? code} อยู่ในตะกร้าครบจำนวนแล้ว`);
          return;
        }
        addCatalogItem(item);
        setScanFeedback(`เพิ่ม ${item.name ?? code} ลงตะกร้าแล้ว`);
      } catch {
        setScanFeedback(`ค้นหารหัส ${code} ไม่สำเร็จ กรุณาลองอีกครั้ง`);
      } finally {
        scanBusyRef.current = false;
      }
    })();
  });

  function addTopup(carrier: Carrier, amount: number) {
    if (!carrier.id) return;
    setLines((prev) => [
      ...prev,
      {
        uid: crypto.randomUUID(),
        kind: "topup",
        carrierId: carrier.id!,
        carrierName: carrier.name ?? "",
        amount,
      },
    ]);
  }

  function updateLine(uid: string, patch: Partial<CartLine>) {
    setLines((prev) =>
      prev.map((l) => (l.uid === uid ? ({ ...l, ...patch } as CartLine) : l)),
    );
  }

  function removeLine(uid: string) {
    setLines((prev) => prev.filter((l) => l.uid !== uid));
  }

  async function financeDevice(item: CatalogRow): Promise<string | null> {
    const { error } = await supabase.rpc("rpc_finance_device", {
      p_device_id: item.id!,
    });
    if (error) return toThaiError(error);
    await loadCatalog();
    return null;
  }

  async function syncQueue(shouldRetryRejected = false) {
    if (syncBusyRef.current || ackBusyRef.current || moneyBusyRef.current) return;
    // localStorage is only readable after mount, so this doubles as the queue's initial
    // read — it runs deferred from the mount effect
    const stored = readQueue();
    setQueue(stored);

    const pending = stored.filter((s) => shouldRetryRejected || !s.lastError);
    if (pending.length === 0) return;

    syncBusyRef.current = true;
    setCashBook(previous => previous ? { ...previous, ackVersion: null } : previous);
    setIsSyncing(true);
    let latest = readQueue();

    // one at a time, in the order the bills were rung up — stock decrements are not
    // commutative once a product runs low
    for (const sale of pending) {
      const { error: rpcError } = await sendReceipt(sale.payload as Json);

      if (!rpcError) {
        latest = removeFromQueue(sale.clientUuid);
        continue;
      }

      if (isDefiniteCashError(rpcError)) {
        latest = markFailed(sale.clientUuid, toThaiError(rpcError));
        break;
      }

      // still offline — leave the rest for the next signal
      break;
    }

    setQueue(latest);
    setIsSyncing(false);
    syncBusyRef.current = false;
    loadCatalog();
  }

  async function submit(input: CheckoutInput) {
    if (!isCashQueueReadable()) { setError("อ่านคิวบิลเดิมไม่ได้ กรุณาให้เจ้าของตรวจสอบก่อนรับเงินต่อ"); return; }
    if (ackBusyRef.current || syncBusyRef.current || moneyBusyRef.current) { setError("กำลังยืนยันคิวรับเงิน กรุณารอสักครู่แล้วลองใหม่"); return; }
    const hasTopup = lines.some((line) => line.kind === "topup");
    if (!navigator.onLine) {
      setError(RECEIPT_OFFLINE_MESSAGE);
      return;
    }
    setSubmitting(true);
    moneyBusyRef.current = true;
    setError(null);

    const draft = {
      client_uuid: clientUuid,
      // the bill belongs to the moment it was rung up, not the moment it reached the
      // server — a queued bill that drains after midnight would otherwise land on the
      // wrong day and quietly bend the daily report
      sold_at: new Date().toISOString(),
      payment_method: input.paymentMethod,
      receiving_account: input.receivingAccount || null,
      bill_discount: input.billDiscount,
      bill_discount_reason: input.billDiscountReason || null,
      note: input.note || null,
      items: lines.map((l) =>
        l.kind === "product"
          ? {
              kind: "product",
              product_id: l.id,
              qty: l.qty,
              unit_price: l.unitPrice,
              item_discount: l.discount,
              item_discount_reason: l.discountReason || null,
            }
          : l.kind === "device"
            ? {
                kind: "device",
                device_unit_id: l.id,
                unit_price: l.unitPrice,
                item_discount: l.discount,
                item_discount_reason: l.discountReason || null,
              }
            : {
                kind: "topup",
                topup_carrier_id: l.carrierId,
                unit_price: l.amount,
              },
      ),
    };

    try {
      await withReceivingIntake(async status => {
        const payload = prepareReceipt(draft, status);
        setCashBook({ ...status, ackVersion: null });
        const { error: receiptError } = await sendReceipt(payload);

        if (receiptError && isDefiniteCashError(receiptError)) {
          setError(toThaiError(receiptError));
          return;
        }
        if (receiptError) {
          if (hasTopup) {
            setError("ยังยืนยันยอดวอลเล็ตไม่ได้ กรุณาตรวจการเชื่อมต่อแล้วลองปิดบิลเดิมอีกครั้ง");
            return;
          }
          setError("ยังยืนยันผลบิลไม่ได้ กรุณาตรวจการเชื่อมต่อแล้วลองยืนยันบิลเดิมอีกครั้ง ไม่ต้องรับเงินซ้ำ");
          return;
        }
        setLines([]); setClientUuid(crypto.randomUUID());
        void loadCatalog();
      });
    } catch (failure) {
      setError(failure instanceof Error ? failure.message : "ตรวจสถานะเงินสดไม่สำเร็จ");
    } finally { setSubmitting(false); moneyBusyRef.current = false; }
    if (navigator.onLine) void syncQueue();
  }

  // Removing a rejected queued bill loses it for good → confirm in a dialog (not window.confirm).
  async function confirmRemoveQueuedSale() {
    if (!pendingRemoveUuid) return;
    if (!isCashQueueReadable()) { setError("อ่านคิวบิลเดิมไม่ได้ ยังลบบิลค้างไม่ได้"); return; }
    let status: CashStatus;
    try { status = await cashStatus(); } catch { setError("ตรวจสถานะเงินสดไม่ได้ ยังลบบิลค้างไม่ได้"); return; }
    if (status.epoch) {
      setError("ต้องให้เจ้าของตรวจสอบบิลค้าง ห้ามลบบิลเพื่อยืนยันคิวรับเงิน");
      setPendingRemoveUuid(null);
      return;
    }
    const nextQueue = removeFromQueue(pendingRemoveUuid);
    setPendingRemoveUuid(null);
    setQueue(nextQueue);
    loadCatalog();
  }

  return (
    <main data-page="pos" className="flex min-h-0 flex-1 flex-col overflow-hidden bg-background lg:h-dvh">
      <p className="border-b border-border px-5 py-2 text-xs text-ink-muted" data-testid="cash-pos-device">
        เครื่องรับเงิน: {deviceId || "กำลังตรวจสอบ"} · คิวค้าง {queue.length} บิล · ออกบิลเมื่อเชื่อมต่อระบบเท่านั้น
        {cashBook?.epoch && ` · ${isReceivingLocallyPaused(cashBook) ? cashBook.isReceivingPaused && cashBook.ackVersion === cashBook.version ? "หยุดรับเงินและยืนยันยอดล่าสุดแล้ว" : "หยุดรับเงินในเครื่อง รอยืนยันยอดล่าสุด" : "กำลังรับเงิน"}`}
        {cashBook?.epoch && cashBook.receivingDevice !== deviceId && " · เครื่องนี้ไม่ใช่เครื่องรับเงินหลัก"}
      </p>
      {cashBook?.epoch && cashBook.receivingDevice === deviceId && <div className="hidden gap-2 border-b border-border px-5 py-2 lg:flex">
        <button type="button" data-testid="cash-pos-pause" disabled={isChangingReceiving || submitting || isSyncing} onClick={() => void changeReceiving(true)} className="ucom-secondary px-4 py-2 text-sm disabled:opacity-50">{isReceivingLocallyPaused(cashBook) ? "ยืนยันหยุดและยอดล่าสุด" : "หยุดรับเงินเพื่อปิดยอด/ส่งมอบ"}</button>
        {isReceivingLocallyPaused(cashBook) && <button type="button" data-testid="cash-pos-resume" disabled={isChangingReceiving || submitting || isSyncing} onClick={() => void changeReceiving(false)} className="ucom-primary px-4 py-2 text-sm disabled:opacity-50">กลับมารับเงิน</button>}
      </div>}
      {cashError && <p role="alert" className="ucom-error px-5 py-2">{cashError}</p>}
      <PendingCashRequests queuedIds={queue.map(sale => sale.clientUuid)} onBusyChange={isBusy => { moneyBusyRef.current = isBusy; }} onResolved={(action, id) => { if (action === "sale" && id === clientUuid) { setLines([]); setClientUuid(crypto.randomUUID()); } if (action === "covered_sale") { setQueue(removeFromQueue(id)); clearReceipt(id); } loadCatalog(); }} />
      <OpeningCoveredQueue queue={queue} status={cashBook} onBusyChange={isBusy => { moneyBusyRef.current = isBusy; }} onCovered={id => { setQueue(removeFromQueue(id)); clearReceipt(id); loadCatalog(); }} />
      <QueueBanner
        queue={queue}
        isSyncing={isSyncing}
        onSync={() => syncQueue(true)}
        onRemove={cashBook && !cashBook.epoch ? setPendingRemoveUuid : undefined}
      />
      <ConfirmDialog
        open={pendingRemoveUuid !== null}
        title="ลบบิลค้างนี้ทิ้ง?"
        confirmLabel="ลบบิลทิ้ง"
        confirmTestId="queue-remove-confirm"
        onClose={() => setPendingRemoveUuid(null)}
        onConfirm={() => void confirmRemoveQueuedSale()}
      >
        <p className="text-sm text-ink">ต้องการลบบิลค้างที่มีปัญหานี้ออกจากคิวใช่หรือไม่?</p>
        <p className="text-sm text-ink-muted">บิลที่ลบจะไม่ถูกส่งเข้าระบบและกู้คืนไม่ได้</p>
      </ConfirmDialog>
      {scanFeedback && (
        <p role="status" data-testid="scan-feedback" className="border-b border-border px-5 py-2 text-sm text-ink">
          {scanFeedback}
        </p>
      )}
      <div className="flex flex-1 items-center justify-center px-8 py-16 text-center lg:hidden">
        <div className="max-w-sm">
          <h1 className="mt-3 text-xl font-semibold tracking-tight text-ink">หน้าขายต้องใช้จอกว้างขึ้น</h1>
          <p className="mt-2 text-sm leading-6 text-ink-muted">กรุณาเปิดด้วยแท็บเล็ตหรือคอมพิวเตอร์</p>
        </div>
      </div>
      <div className="hidden min-h-0 flex-1 lg:flex">
        <Catalog
          catalog={catalog}
          topProducts={topProducts}
          carriers={carriers}
          onAddCatalog={addCatalogItem}
          onAddTopup={addTopup}
          onFinanceDevice={financeDevice}
          search={catalogSearch}
          onSearchChange={(value) => {
            setCatalogSearch(value);
            setCatalogPage(1);
            if (catalogTab === "topup") setCatalogTab("all");
          }}
          tabs={catalogTabs}
          tab={catalogTab}
          onTabChange={(value) => {
            setCatalogTab(value);
            setCatalogPage(1);
          }}
          page={catalogPage}
          pageSize={catalogPageSize}
          total={catalogTotal}
          isLoading={catalogLoading}
          catalogError={catalogError}
          onRetry={() => void loadCatalog()}
          onPageChange={setCatalogPage}
          onPageSizeChange={(value) => {
            setCatalogPageSize(value);
            setCatalogPage(1);
          }}
        />
        <Cart
          lines={lines}
          onUpdateLine={updateLine}
          onRemoveLine={removeLine}
          onSubmit={submit}
          submitting={submitting}
          error={error}
        />
      </div>
    </main>
  );
}
