"use client";

import { useDeferredValue, useEffect, useRef, useState } from "react";
import { toast } from "sonner";
import { createClient } from "@/lib/supabase/client";
import { PageFrame } from "@/app/_components/PageFrame";
import { EmptyState } from "@/app/_components/EmptyState";
import { ErrorPanel } from "@/app/_components/ErrorPanel";
import { SkeletonRows } from "@/app/_components/Skeleton";
import { toThaiError } from "@/lib/errors";
import { PaginationControls } from "@/app/_components/PaginationControls";
import { orIlike, pageRange } from "@/lib/supabase/pagination";
import { StockTable, StockTableHead } from "./StockTable";
import { StockDrawer } from "./StockDrawer";
import { STATUS_LABEL, type Category, type DeviceSave, type ProductSave, type StockKind, type StockRow } from "./types";

const STATUS_BY_KIND: Record<StockKind, string[]> = {
  product: ["active", "inactive"],
  device: ["in_stock", "consigned_out", "written_off"],
};

const chip = "ucom-field border-dashed px-3.5 py-2 text-sm";

export default function StockPage() {
  const supabase = createClient();

  const [rows, setRows] = useState<StockRow[]>([]);
  const [categories, setCategories] = useState<Category[]>([]);
  const [costById, setCostById] = useState<Record<string, number | null>>({});
  const [search, setSearch] = useState("");
  const deferredSearch = useDeferredValue(search);
  const [kindFilter, setKindFilter] = useState<StockKind>("product");
  const [statusFilter, setStatusFilter] = useState("all");
  const [categoryFilter, setCategoryFilter] = useState("all");
  const [drawer, setDrawer] = useState<{ kind: StockKind; row: StockRow | null } | null>(null);
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
      query = query.eq("kind", kindFilter);
      if (kindFilter === "product" && categoryFilter !== "all") query = query.eq("category_name", categoryFilter);
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
      setCostById(
        Object.fromEntries(
          nextRows.filter((row) => row.id).map((row) => [row.id!, row.cost]),
        ),
      );
      setTotal(nextTotal);
      setError(null);
    } catch (loadError) {
      if (requestId !== requestRef.current) return;
      setRows([]);
      setTotal(0);
      setError(toThaiError(loadError));
    } finally {
      if (requestId === requestRef.current) setIsLoading(false);
    }
  }

  useEffect(() => {
    supabase
      .from("categories")
      .select("*")
      .then(({ data }) => setCategories(data ?? []));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => {
    Promise.resolve().then(() => loadStock());
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [page, pageSize, kindFilter, statusFilter, categoryFilter, deferredSearch]);

  // Runs one write RPC: Thai toast on failure, reload + optional success toast otherwise.
  async function run(call: PromiseLike<{ error: unknown }>, successMessage?: string) {
    const { error } = await call;
    if (error) {
      toast.error(toThaiError(error), { duration: Infinity });
      return false;
    }
    if (successMessage) toast.success(successMessage);
    return true;
  }

  async function saveProduct(input: ProductSave) {
    const ok = await run(supabase.rpc("rpc_upsert_product", {
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
    }), input.id ? "บันทึกสินค้าแล้ว" : "เพิ่มสินค้าแล้ว");
    if (ok) void loadStock();
    return ok;
  }

  async function saveDevice(input: DeviceSave) {
    const ok = await run(supabase.rpc("rpc_upsert_device", {
      payload: {
        id: input.id ?? null,
        imei: input.imei,
        model_name: input.model_name,
        list_price: input.list_price,
        sale_price: input.sale_price ?? null,
        status: input.status,
        cost: input.cost ?? null,
      },
    }), input.id ? "บันทึกเครื่องแล้ว" : "เพิ่มเครื่องแล้ว");
    if (ok) void loadStock();
    return ok;
  }

  async function saveCost(kind: string, id: string, cost: number) {
    const ok = await run(supabase.rpc("rpc_set_stock_cost", { p_kind: kind, p_id: id, p_cost: cost }), "บันทึกต้นทุนแล้ว");
    if (ok) setCostById((prev) => ({ ...prev, [id]: cost }));
    return ok;
  }

  function pickKind(kind: StockKind) {
    setKindFilter(kind);
    setStatusFilter("all");
    setPage(1);
  }

  const isProduct = kindFilter === "product";
  const isFiltered = statusFilter !== "all" || categoryFilter !== "all" || search !== "";
  const drawerRow = drawer?.row ?? null;

  return (
    <PageFrame
      page="stock"
      title="สต็อก/เครื่อง"
      description={`${total.toLocaleString("th-TH")} ${isProduct ? "รายการสินค้า" : "เครื่อง"}ตามตัวกรอง`}
      actions={
        <>
          <button
            type="button"
            onClick={() => setDrawer({ kind: kindFilter, row: null })}
            data-testid={isProduct ? "open-add-product" : "open-add-device"}
            className="ucom-primary px-[18px] py-2.5"
          >
            + {isProduct ? "เพิ่มสินค้าใหม่" : "เพิ่มเครื่อง (ซื้อขาด)"}
          </button>
        </>
      }
    >
      {error && <ErrorPanel message={error} onRetry={() => void loadStock()} />}

      <div className="ucom-toolbar">
        <div className="flex gap-1 rounded-full bg-sunken p-1">
          {(["product", "device"] as const).map((kind) => (
            <button
              key={kind}
              type="button"
              onClick={() => pickKind(kind)}
              data-testid={`stock-kind-${kind}`}
              aria-pressed={kindFilter === kind}
              className={`rounded-full px-4 py-1.5 text-sm ${kindFilter === kind ? "bg-brand-ink font-semibold text-white" : "text-ink-muted"}`}
            >
              {kind === "product" ? "สินค้า (นับจำนวน)" : "เครื่อง (นับ IMEI)"}
            </button>
          ))}
        </div>
        {isProduct && (
          <select
            value={categoryFilter}
            onChange={(e) => { setCategoryFilter(e.target.value); setPage(1); }}
            aria-label="หมวด"
            data-testid="stock-category-filter"
            className={chip}
          >
            <option value="all">หมวด: ทั้งหมด</option>
            {categories.map((c) => <option key={c.id} value={c.name!}>{c.name}</option>)}
          </select>
        )}
        <select
          value={statusFilter}
          onChange={(e) => { setStatusFilter(e.target.value); setPage(1); }}
          aria-label="สถานะ"
          data-testid="stock-status-filter"
          className={chip}
        >
          <option value="all">สถานะ: ทั้งหมด</option>
          {STATUS_BY_KIND[kindFilter].map((s) => <option key={s} value={s}>{STATUS_LABEL[s]}</option>)}
        </select>
        <input
          value={search}
          onChange={(e) => { setSearch(e.target.value); setPage(1); }}
          placeholder="ค้นหาสินค้า / เครื่อง / SKU / IMEI"
          className="ucom-field ml-auto w-full px-4 py-2 text-sm md:w-80"
        />
      </div>

      {isLoading && rows.length === 0 ? (
        <SkeletonRows cols={isProduct ? 6 : 5} head={<StockTableHead kind={kindFilter} canEditCost />} />
      ) : rows.length > 0 ? (
        <StockTable rows={rows} kind={kindFilter} canEditCost costById={costById} onOpen={(row) => setDrawer({ kind: kindFilter, row })} />
      ) : !error && (
        isFiltered
          ? <EmptyState title="ไม่พบรายการตามตัวกรอง" onClearFilter={() => { setSearch(""); setStatusFilter("all"); setCategoryFilter("all"); setPage(1); }} />
          : <EmptyState title={isProduct ? "ยังไม่มีสินค้าในคลัง" : "ยังไม่มีเครื่องในคลัง"} hint="กดปุ่มมุมขวาบนเพื่อเพิ่มรายการแรก" />
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
      {drawer && (
        <StockDrawer
          key={`${drawer.kind}-${drawerRow?.id ?? "new"}`}
          kind={drawer.kind}
          row={drawerRow}
          categories={categories}
          canEditCost
          cost={drawerRow?.id ? costById[drawerRow.id] : undefined}
          onClose={() => setDrawer(null)}
          onSaveProduct={saveProduct}
          onSaveDevice={saveDevice}
          onSaveCost={saveCost}
        />
      )}
    </PageFrame>
  );
}
