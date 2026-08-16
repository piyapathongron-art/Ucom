"use client";

import { useEffect, useState } from "react";
import { createClient } from "@/lib/supabase/client";
import { StockTable, type DeviceSave, type ProductSave } from "./StockTable";
import { AddDeviceForm, AddProductForm } from "./AddForms";
import { SfIntake, type SfIntakePayload } from "./SfIntake";
import type { Category, SfDue, StockRow } from "./types";

export default function StockPage() {
  const supabase = createClient();

  const [isOwner, setIsOwner] = useState(false);
  const [rows, setRows] = useState<StockRow[]>([]);
  const [categories, setCategories] = useState<Category[]>([]);
  const [dueList, setDueList] = useState<SfDue[]>([]);
  const [costById, setCostById] = useState<Record<string, number | null>>({});
  const [search, setSearch] = useState("");
  const [error, setError] = useState<string | null>(null);

  function loadStock() {
    return supabase
      .from("v_pos_stock")
      .select("*")
      .then(({ data }) => setRows(data ?? []));
  }

  function loadCosts(owner: boolean) {
    if (!owner) return;
    Promise.all([
      supabase.from("products").select("id, cost"),
      supabase.from("device_units").select("id, cost"),
    ]).then(([{ data: products }, { data: devices }]) => {
      const map: Record<string, number | null> = {};
      for (const p of products ?? []) map[p.id] = p.cost;
      for (const d of devices ?? []) map[d.id] = d.cost;
      setCostById(map);
    });
  }

  useEffect(() => {
    loadStock();
    supabase
      .from("categories")
      .select("*")
      .then(({ data }) => setCategories(data ?? []));
    supabase
      .from("v_sf_due")
      .select("*")
      .then(({ data }) => setDueList(data ?? []));

    supabase.auth.getUser().then(({ data: { user } }) => {
      if (!user) return;
      supabase
        .from("profiles")
        .select("role")
        .eq("id", user.id)
        .single()
        .then(({ data: profile }) => {
          const owner = profile?.role === "owner";
          setIsOwner(owner);
          loadCosts(owner);
        });
    });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  async function saveProduct(input: ProductSave) {
    setError(null);
    const { error } = await supabase.rpc("rpc_upsert_product", {
      payload: {
        id: input.id ?? null,
        name: input.name,
        sku: input.sku,
        category_id: input.category_id || null,
        price: input.price,
        qty: input.qty,
        is_active: input.is_active,
      },
    });
    if (error) {
      setError(error.message);
      return;
    }
    loadStock();
  }

  async function saveDevice(input: DeviceSave) {
    setError(null);
    const { error } = await supabase.rpc("rpc_upsert_device", {
      payload: {
        id: input.id ?? null,
        imei: input.imei,
        model_name: input.model_name,
        list_price: input.list_price,
        sale_price: input.sale_price ?? null,
        status: input.status,
      },
    });
    if (error) {
      setError(error.message);
      return;
    }
    loadStock();
  }

  async function saveCost(kind: string, id: string, cost: number) {
    setError(null);
    const table = kind === "product" ? "products" : "device_units";
    const { error } = await supabase.from(table).update({ cost }).eq("id", id);
    if (error) {
      setError(error.message);
      return;
    }
    setCostById((prev) => ({ ...prev, [id]: cost }));
  }

  async function submitSfIntake(input: SfIntakePayload) {
    setError(null);
    const { error } = await supabase.rpc("rpc_receive_sf_order", {
      payload: {
        order_no: input.order_no,
        ordered_at: input.ordered_at || null,
        note: input.note || null,
        devices: input.devices,
      },
    });
    if (error) {
      setError(error.message);
      return;
    }
    loadStock();
    supabase
      .from("v_sf_due")
      .select("*")
      .then(({ data }) => setDueList(data ?? []));
  }

  const filtered = search.trim()
    ? rows.filter((r) =>
        `${r.name} ${r.code ?? ""}`
          .toLowerCase()
          .includes(search.trim().toLowerCase()),
      )
    : rows;

  return (
    <main className="space-y-4 p-4">
      <h1 className="text-2xl font-semibold">สต็อกสินค้า</h1>

      {error && (
        <p className="rounded bg-red-50 p-2 text-sm text-red-600">{error}</p>
      )}

      <SfIntake dueList={dueList} onSubmit={submitSfIntake} />

      <div className="flex flex-wrap items-center gap-2">
        <AddProductForm categories={categories} onSave={saveProduct} />
        <AddDeviceForm onSave={saveDevice} />
        <input
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          placeholder="ค้นหาสินค้า/เครื่อง"
          className="ml-auto rounded border border-neutral-300 p-2 text-sm"
        />
      </div>

      <StockTable
        rows={filtered}
        categories={categories}
        isOwner={isOwner}
        costById={costById}
        onSaveProduct={saveProduct}
        onSaveDevice={saveDevice}
        onSaveCost={saveCost}
      />
    </main>
  );
}
