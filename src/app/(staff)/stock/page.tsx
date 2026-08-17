"use client";

import { useDeferredValue, useEffect, useRef, useState } from "react";
import { createClient } from "@/lib/supabase/client";
import { PageFrame, PageSection } from "@/app/_components/PageFrame";
import { PaginationControls } from "@/app/_components/PaginationControls";
import { orIlike, pageRange } from "@/lib/supabase/pagination";
import { StockTable, type DeviceSave, type ProductSave } from "./StockTable";
import { AddDeviceForm, AddProductForm } from "./AddForms";
import { SfIntake, type SfIntakePayload } from "./SfIntake";
import type { Category, StockRow } from "./types";

export default function StockPage() {
  const supabase = createClient();

  const [isOwner, setIsOwner] = useState(false);
  const [rows, setRows] = useState<StockRow[]>([]);
  const [categories, setCategories] = useState<Category[]>([]);
  const [costById, setCostById] = useState<Record<string, number | null>>({});
  const [search, setSearch] = useState("");
  const deferredSearch = useDeferredValue(search);
  const [kindFilter, setKindFilter] = useState<"all" | "product" | "device">("all");
  const [statusFilter, setStatusFilter] = useState("all");
  const [page, setPage] = useState(1);
  const [pageSize, setPageSize] = useState(25);
  const [total, setTotal] = useState(0);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const requestRef = useRef(0);

  async function loadStock() {
    const requestId = ++requestRef.current;
    setIsLoading(true);
    try {
      const { from, to } = pageRange(page, pageSize);
      let query = supabase.from("v_pos_stock").select("*", { count: "exact" });
      const searchFilter = orIlike(["name", "code"], deferredSearch);
      if (searchFilter) query = query.or(searchFilter);
      if (kindFilter !== "all") query = query.eq("kind", kindFilter);
      if (statusFilter !== "all") query = query.eq("status", statusFilter);
      const result = await query
        .order("name", { ascending: true })
        .order("id", { ascending: true })
        .range(from, to);
      if (result.error) throw result.error;
      if (requestId !== requestRef.current) return;
      const nextRows = result.data ?? [];
      const nextTotal = result.count ?? nextRows.length;
      if (nextRows.length === 0 && nextTotal > 0 && page > 1) {
        setPage((current) => Math.max(1, current - 1));
        return;
      }
      setRows(nextRows);
      setTotal(nextTotal);
      setError(null);
    } catch (loadError) {
      if (requestId !== requestRef.current) return;
      setRows([]);
      setTotal(0);
      setError(loadError instanceof Error ? loadError.message : "โหลดสต็อกไม่สำเร็จ");
    } finally {
      if (requestId === requestRef.current) setIsLoading(false);
    }
  }

  async function loadCosts(owner: boolean, stockRows: StockRow[]) {
    if (!owner) {
      setCostById({});
      return;
    }
    try {
      const productIds = stockRows.filter((row) => row.kind === "product" && row.id).map((row) => row.id!);
      const deviceIds = stockRows.filter((row) => row.kind === "device" && row.id).map((row) => row.id!);
      const map: Record<string, number | null> = {};
      if (productIds.length > 0) {
        const { data, error: productError } = await supabase
          .from("products")
          .select("id, cost")
          .in("id", productIds);
        if (productError) throw productError;
        for (const row of data ?? []) map[row.id] = row.cost;
      }
      if (deviceIds.length > 0) {
        const { data, error: deviceError } = await supabase
          .from("device_units")
          .select("id, cost")
          .in("id", deviceIds);
        if (deviceError) throw deviceError;
        for (const row of data ?? []) map[row.id] = row.cost;
      }
      setCostById(map);
    } catch (loadError) {
      setError(loadError instanceof Error ? loadError.message : "โหลดต้นทุนไม่สำเร็จ");
    }
  }

  useEffect(() => {
    supabase
      .from("categories")
      .select("*")
      .then(({ data }) => setCategories(data ?? []));
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
        });
    });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => {
    Promise.resolve().then(() => loadStock());
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [page, pageSize, kindFilter, statusFilter, deferredSearch]);

  useEffect(() => {
    Promise.resolve().then(() => loadCosts(isOwner, rows));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isOwner, rows]);

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
        cost: input.cost ?? null,
      },
    });
    if (error) {
      setError(error.message);
      return;
    }
    void loadStock();
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
        cost: input.cost ?? null,
      },
    });
    if (error) {
      setError(error.message);
      return;
    }
    void loadStock();
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
    void loadStock();
  }

  return (
    <PageFrame
      page="stock"
      eyebrow="INVENTORY / LEDGER"
      title="สต็อกสินค้า"
      description="รับเข้า แก้ไข และติดตามสถานะสินค้ากับเครื่องในคลัง"
      actions={
        <span className="font-mono text-xs tracking-wide text-ink-muted">
          {isOwner ? "OWNER VIEW" : "STAFF VIEW"}
        </span>
      }
    >

      {error && (
        <div className="flex flex-wrap items-center justify-between gap-3 border border-danger bg-danger/10 p-3 text-sm text-danger">
          <span>{error}</span>
          <button type="button" onClick={() => void loadStock()} className="ucom-danger px-3 py-1.5 text-sm">
            ลองใหม่
          </button>
        </div>
      )}

      <PageSection
        title="รายการคงคลัง"
        description={`${total.toLocaleString("th-TH")} รายการตามตัวกรอง · แก้ไขแล้วกดบันทึกเพื่อส่งเข้า stock RPC`}
      >
      <div className="ucom-toolbar">
        <AddProductForm categories={categories} onSave={saveProduct} />
        <AddDeviceForm onSave={saveDevice} />
        <SfIntake onSubmit={submitSfIntake} />
        <input
          value={search}
          onChange={(e) => {
            setSearch(e.target.value);
            setPage(1);
          }}
          placeholder="ค้นหาสินค้า / เครื่อง / SKU / IMEI"
          className="ucom-field ml-auto w-full px-3 py-2 text-sm md:w-80"
        />
        <select
          value={kindFilter}
          onChange={(e) => {
            setKindFilter(e.target.value as "all" | "product" | "device");
            setPage(1);
          }}
          data-testid="stock-kind-filter"
          className="ucom-field px-3 py-2 text-sm"
        >
          <option value="all">ทุกชนิด</option>
          <option value="product">สินค้า</option>
          <option value="device">เครื่อง</option>
        </select>
        <select
          value={statusFilter}
          onChange={(e) => {
            setStatusFilter(e.target.value);
            setPage(1);
          }}
          data-testid="stock-status-filter"
          className="ucom-field px-3 py-2 text-sm"
        >
          <option value="all">ทุกสถานะ</option>
          <option value="active">ขายอยู่</option>
          <option value="inactive">เลิกขาย</option>
          <option value="in_stock">อยู่ในคลัง</option>
          <option value="consigned_out">ฝากขายออกแล้ว</option>
          <option value="written_off">ตัดจำหน่าย</option>
        </select>
      </div>

      {isLoading && <p className="text-sm text-ink-muted">กำลังโหลดรายการ...</p>}

      <StockTable
        rows={rows}
        categories={categories}
        isOwner={isOwner}
        costById={costById}
        onSaveProduct={saveProduct}
        onSaveDevice={saveDevice}
        onSaveCost={saveCost}
      />
      {!isLoading && rows.length === 0 && (
        <p className="rounded border border-dashed border-border p-6 text-center text-sm text-ink-muted">
          ไม่พบรายการตามตัวกรอง
        </p>
      )}
      <PaginationControls
        page={page}
        pageSize={pageSize}
        total={total}
        isLoading={isLoading}
        label="สต็อก"
        testIdPrefix="stock-pagination"
        onPageChange={setPage}
        onPageSizeChange={(value) => {
          setPageSize(value);
          setPage(1);
        }}
      />
      </PageSection>
    </PageFrame>
  );
}
