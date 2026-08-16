"use client";

import { useEffect, useState } from "react";
import { createClient } from "@/lib/supabase/client";
import { Catalog } from "./Catalog";
import { Cart, type CheckoutInput } from "./Cart";
import { QueueBanner } from "./QueueBanner";
import {
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

export default function PosPage() {
  const supabase = createClient();

  const [catalog, setCatalog] = useState<CatalogRow[]>([]);
  const [topProducts, setTopProducts] = useState<CatalogRow[]>([]);
  const [carriers, setCarriers] = useState<Carrier[]>([]);
  const [lines, setLines] = useState<CartLine[]>([]);
  const [clientUuid, setClientUuid] = useState(() => crypto.randomUUID());
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [queue, setQueue] = useState<QueuedSale[]>([]);
  const [isSyncing, setIsSyncing] = useState(false);

  function loadCatalog() {
    return Promise.all([
        supabase.from("v_pos_catalog").select("*"),
        supabase.from("v_pos_stock").select("*"),
        supabase.from("v_pos_top_products").select("*"),
      ])
      .then(([{ data: catalogRows }, { data: stockRows }, { data: topProductRows }]) => {
        const acquisitionById = new Map(
          (stockRows ?? [])
            .filter((row) => row.kind === "device" && row.id)
            .map((row) => [row.id!, row.acquisition] as const),
        );
        const enrichDevices = (rows: CatalogRow[] | null): CatalogRow[] =>
          (rows ?? []).map((row) =>
            row.kind === "device"
              ? { ...row, acquisition: acquisitionById.get(row.id ?? "") ?? null }
              : row,
          );

        const nextCatalog = enrichDevices(catalogRows);
        const nextTop = enrichDevices(topProductRows);
        setCatalog(nextCatalog);
        setTopProducts(nextTop);
        // the snapshot is what the screen falls back to when the network is gone; it is
        // only ever written from a successful load, never from the offline path
        writeCachedCatalog({ catalog: nextCatalog, topProducts: nextTop });
      });
  }

  useEffect(() => {
    loadCatalog().then(undefined, () => {
      const cached = readCachedCatalog<{
        catalog: CatalogRow[];
        topProducts: CatalogRow[];
      }>();
      if (cached) {
        setCatalog(cached.catalog);
        setTopProducts(cached.topProducts);
      }
    });

    supabase
      .from("v_pos_topup_carriers")
      .select("*")
      .then(({ data }) => setCarriers(data ?? []));
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
    if (error) return error.message;
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
        latest = markFailed(sale.clientUuid, rpcError.message);
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
      setError(error.message);
      return;
    }

    if (error) {
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

  return (
    <main data-page="pos" className="flex h-full min-h-0 flex-1 flex-col bg-background">
      <QueueBanner queue={queue} isSyncing={isSyncing} onSync={() => syncQueue()} />
      <div className="flex flex-1 items-center justify-center px-8 py-16 text-center md:hidden">
        <div className="max-w-sm">
          <p className="font-mono text-[0.68rem] uppercase tracking-[0.2em] text-ink-muted">POS / wide display</p>
          <h1 className="mt-3 text-xl font-semibold tracking-tight text-ink">หน้าขายต้องใช้จอกว้างขึ้น</h1>
          <p className="mt-2 text-sm leading-6 text-ink-muted">กรุณาเปิดด้วยแท็บเล็ตหรือคอมพิวเตอร์</p>
        </div>
      </div>
      <div className="hidden min-h-0 flex-1 md:flex">
      <Catalog
        catalog={catalog}
        topProducts={topProducts}
        carriers={carriers}
        onAddCatalog={addCatalogItem}
        onAddTopup={addTopup}
        onFinanceDevice={financeDevice}
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
