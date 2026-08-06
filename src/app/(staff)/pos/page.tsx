"use client";

import { useEffect, useState } from "react";
import { createClient } from "@/lib/supabase/client";
import { Catalog } from "./Catalog";
import { Cart, type CheckoutInput } from "./Cart";
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

  function loadCatalog() {
    supabase
      .from("v_pos_catalog")
      .select("*")
      .then(({ data }) => setCatalog(data ?? []));
    supabase
      .from("v_pos_top_products")
      .select("*")
      .then(({ data }) => setTopProducts(data ?? []));
  }

  useEffect(() => {
    loadCatalog();
    supabase
      .from("v_pos_topup_carriers")
      .select("*")
      .then(({ data }) => setCarriers(data ?? []));
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

  async function submit(input: CheckoutInput) {
    setSubmitting(true);
    setError(null);

    const payload = {
      client_uuid: clientUuid,
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

    if (error) {
      setError(error.message);
      return;
    }

    setLines([]);
    setClientUuid(crypto.randomUUID());
    loadCatalog();
  }

  return (
    <main className="flex h-full flex-1">
      <Catalog
        catalog={catalog}
        topProducts={topProducts}
        carriers={carriers}
        onAddCatalog={addCatalogItem}
        onAddTopup={addTopup}
      />
      <Cart
        lines={lines}
        onUpdateLine={updateLine}
        onRemoveLine={removeLine}
        onSubmit={submit}
        submitting={submitting}
        error={error}
      />
    </main>
  );
}
