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
  enqueue,
  isDatabaseRejection,
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

  // Devices leave the catalog and products lose a unit as soon as a bill is queued.
  // Without this the same device can be sold twice in one offline stretch, and the
  // second bill only fails hours later when the queue drains.
  function applySoldLocally(soldLines: CartLine[]) {
    const soldDeviceIds = new Set(
      soldLines.filter((l) => l.kind === "device").map((l) => l.id),
    );
    const soldQtyByProduct = new Map<string, number>();
    soldLines.forEach((l) => {
      if (l.kind === "product") {
        soldQtyByProduct.set(l.id, (soldQtyByProduct.get(l.id) ?? 0) + l.qty);
      }
    });

    const apply = (rows: CatalogRow[]): CatalogRow[] =>
      rows
        .filter((row) => !(row.kind === "device" && soldDeviceIds.has(row.id ?? "")))
        .map((row) =>
          row.kind === "product" && soldQtyByProduct.has(row.id ?? "")
            ? { ...row, qty: (row.qty ?? 0) - soldQtyByProduct.get(row.id ?? "")! }
            : row,
        );

    setCatalog((prev) => apply(prev));
    setTopProducts((prev) => apply(prev));
  }

  async function syncQueue() {
    // localStorage is only readable after mount, so this doubles as the queue's initial
    // read — it runs deferred from the mount effect
    const stored = readQueue();
    setQueue(stored);

    const pending = stored.filter((s) => !s.lastError);
    if (pending.length === 0) return;

    setIsSyncing(true);
    let latest = readQueue();

    // one at a time, in the order the bills were rung up — stock decrements are not
    // commutative once a product runs low
    for (const sale of pending) {
      const { error: rpcError } = await supabase.rpc("rpc_create_sale", {
        payload: sale.payload as never,
      });

      if (!rpcError) {
        latest = removeFromQueue(sale.clientUuid);
        continue;
      }

      if (isDatabaseRejection(rpcError)) {
        latest = markFailed(sale.clientUuid, toThaiError(rpcError));
        break;
      }

      // still offline — leave the rest for the next signal
      break;
    }

    setQueue(latest);
    setIsSyncing(false);
    loadCatalog();
  }

  async function submit(input: CheckoutInput) {
    const hasTopup = lines.some((line) => line.kind === "topup");
    if (hasTopup && !navigator.onLine) {
      setError("บิลที่มีเติมเงินต้องเชื่อมต่ออินเทอร์เน็ต เพื่อตรวจยอดวอลเล็ตก่อนขาย");
      return;
    }
    setSubmitting(true);
    setError(null);

    const payload = {
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

    const { error } = await supabase.rpc("rpc_create_sale", { payload });

    setSubmitting(false);

    // The database answered and said no — the staff has to know now, while the customer
    // is still standing there. Queueing this would only postpone the same refusal.
    if (error && isDatabaseRejection(error)) {
      setError(toThaiError(error));
      return;
    }

    if (error) {
      if (hasTopup) {
        setError("ยังยืนยันยอดวอลเล็ตไม่ได้ กรุณาตรวจการเชื่อมต่อแล้วลองปิดบิลเดิมอีกครั้ง");
        return;
      }
      setQueue(
        enqueue({
          clientUuid,
          payload,
          queuedAt: new Date().toISOString(),
          lastError: null,
        }),
      );
      applySoldLocally(lines);
      setLines([]);
      setClientUuid(crypto.randomUUID());
      return;
    }

    setLines([]);
    setClientUuid(crypto.randomUUID());
    loadCatalog();
    syncQueue();
  }

  // Removing a rejected queued bill loses it for good → confirm in a dialog (not window.confirm).
  function confirmRemoveQueuedSale() {
    if (!pendingRemoveUuid) return;
    const nextQueue = removeFromQueue(pendingRemoveUuid);
    setPendingRemoveUuid(null);
    setQueue(nextQueue);
    loadCatalog();
  }

  return (
    <main data-page="pos" className="flex min-h-0 flex-1 flex-col overflow-hidden bg-background lg:h-dvh">
      <QueueBanner
        queue={queue}
        isSyncing={isSyncing}
        onSync={() => syncQueue()}
        onRemove={setPendingRemoveUuid}
      />
      <ConfirmDialog
        open={pendingRemoveUuid !== null}
        title="ลบบิลค้างนี้ทิ้ง?"
        confirmLabel="ลบบิลทิ้ง"
        confirmTestId="queue-remove-confirm"
        onClose={() => setPendingRemoveUuid(null)}
        onConfirm={confirmRemoveQueuedSale}
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
