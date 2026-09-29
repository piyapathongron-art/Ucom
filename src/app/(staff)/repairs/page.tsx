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
import { IntakeForm, type RepairIntakeSave } from "./IntakeForm";
import { RepairTable, RepairTableHead } from "./RepairTable";
import type { CloseJobPayload } from "./CloseJobDialog";
import type { PartPaidFrom, RepairRow } from "./types";

export default function RepairsPage() {
  const supabase = createClient();

  const [rows, setRows] = useState<RepairRow[]>([]);
  const [search, setSearch] = useState("");
  const deferredSearch = useDeferredValue(search);
  const [statusFilter, setStatusFilter] = useState<"open" | "collected" | "abandoned" | "all">("open");
  const [page, setPage] = useState(1);
  const [pageSize, setPageSize] = useState(25);
  const [total, setTotal] = useState(0);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [isIntakeOpen, setIsIntakeOpen] = useState(false);
  const [reloadKey, setReloadKey] = useState(0);
  const requestRef = useRef(0);

  async function loadRepairs() {
    const requestId = ++requestRef.current;
    setIsLoading(true);
    try {
      const { from, to } = pageRange(page, pageSize);
      let query = supabase.from("v_pos_repairs").select("*", { count: "exact" });
      const searchFilter = orIlike(["customer_name", "device_desc", "customer_phone"], deferredSearch);
      if (searchFilter) query = query.or(searchFilter);
      if (statusFilter === "open") {
        query = query.in("status", ["pending", "in_progress", "ready"]);
      } else if (statusFilter !== "all") {
        query = query.eq("status", statusFilter);
      }
      const result = await query
        .order("received_at", { ascending: false })
        .order("id", { ascending: false })
        .range(from, to);
      if (result.error) throw result.error;
      if (requestId !== requestRef.current) return;
      const nextRows = (result.data as RepairRow[]) ?? [];
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
      setError(toThaiError(loadError));
    } finally {
      if (requestId === requestRef.current) setIsLoading(false);
    }
  }

  useEffect(() => {
    Promise.resolve().then(() => loadRepairs());
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [page, pageSize, statusFilter, deferredSearch, reloadKey]);

  // Runs one mutation RPC: toasts a Thai message on failure, reloads the list on success.
  async function run(call: PromiseLike<{ error: unknown }>, successMessage?: string) {
    const { error } = await call;
    if (error) {
      toast.error(toThaiError(error), { duration: Infinity });
      return false;
    }
    if (successMessage) toast.success(successMessage);
    setReloadKey((value) => value + 1);
    return true;
  }

  const createJob = (input: RepairIntakeSave) =>
    run(supabase.rpc("rpc_create_repair_job", { payload: input }), "รับงานซ่อมแล้ว");

  const setStatus = async (id: string, status: string) => {
    await run(supabase.rpc("rpc_set_repair_status", { p_job_id: id, p_status: status }), status === "abandoned" ? "ตัดงานทิ้งแล้ว" : undefined);
  };

  const setPartCost = (id: string, cost: number, paidFrom: PartPaidFrom) =>
    run(supabase.rpc("rpc_set_part_cost", { p_job_id: id, p_cost: cost, p_paid_from: paidFrom }), "บันทึกต้นทุนอะไหล่แล้ว");

  const closeJob = (id: string, payload: CloseJobPayload) =>
    run(supabase.rpc("rpc_close_repair_job", { p_job_id: id, p_sale_payload: payload }), "ออกบิลและปิดงานแล้ว");

  return (
    <PageFrame
      page="repairs"
      title="งานซ่อม"
      description={`${total.toLocaleString("th-TH")} งานตามตัวกรองปัจจุบัน`}
      actions={
        <button type="button" onClick={() => setIsIntakeOpen(true)} data-testid="open-intake-form" className="ucom-primary px-[18px] py-2.5">
          + รับงานซ่อมใหม่
        </button>
      }
    >
      {error && <ErrorPanel message={error} onRetry={() => setReloadKey((value) => value + 1)} />}

      <IntakeForm open={isIntakeOpen} onClose={() => setIsIntakeOpen(false)} onSave={createJob} />

      <div className="ucom-toolbar">
        <div className="flex flex-wrap gap-1 rounded-full bg-sunken p-1">
          <button
            type="button"
            onClick={() => {
              setStatusFilter("open");
              setPage(1);
            }}
            data-testid="filter-open"
            className={`rounded-full px-4 py-1.5 text-sm ${statusFilter === "open" ? "bg-brand-ink text-white font-semibold" : "text-ink-muted"}`}
          >
            เปิดอยู่
          </button>
          <button
            type="button"
            onClick={() => {
              setStatusFilter("collected");
              setPage(1);
            }}
            data-testid="filter-collected"
            className={`rounded-full px-4 py-1.5 text-sm ${statusFilter === "collected" ? "bg-brand-ink text-white font-semibold" : "text-ink-muted"}`}
          >
            รับแล้ว
          </button>
          <button
            type="button"
            onClick={() => {
              setStatusFilter("abandoned");
              setPage(1);
            }}
            data-testid="filter-abandoned"
            className={`rounded-full px-4 py-1.5 text-sm ${statusFilter === "abandoned" ? "bg-brand-ink text-white font-semibold" : "text-ink-muted"}`}
          >
            ลูกค้าทิ้ง
          </button>
          <button
            type="button"
            onClick={() => {
              setStatusFilter("all");
              setPage(1);
            }}
            data-testid="filter-all"
            className={`rounded-full px-4 py-1.5 text-sm ${statusFilter === "all" ? "bg-brand-ink text-white font-semibold" : "text-ink-muted"}`}
          >
            ทั้งหมด
          </button>
        </div>
        <input
          value={search}
          onChange={(e) => {
            setSearch(e.target.value);
            setPage(1);
          }}
          placeholder="ค้นหาชื่อ/เครื่อง/เบอร์"
          data-testid="repair-search"
          className="ucom-field ml-auto w-full !rounded-full px-3.5 py-2 text-sm md:w-80"
        />
      </div>

      {isLoading && rows.length === 0 ? (
        <SkeletonRows cols={7} head={<RepairTableHead />} />
      ) : rows.length > 0 ? (
        <RepairTable rows={rows} onSetStatus={setStatus} onSetPartCost={setPartCost} onCloseJob={closeJob} />
      ) : !error && (
        statusFilter === "open" && !search
          ? <EmptyState title="ยังไม่มีงานซ่อมที่เปิดอยู่" hint="กด “รับงานซ่อมใหม่” เพื่อเริ่มรับงาน" />
          : <EmptyState title="ไม่พบงานตามตัวกรอง" onClearFilter={() => { setSearch(""); setStatusFilter("open"); setPage(1); }} />
      )}
      <PaginationControls
        page={page}
        pageSize={pageSize}
        total={total}
        isLoading={isLoading}
        label="งานซ่อม"
        testIdPrefix="repairs-pagination"
        onPageChange={setPage}
        onPageSizeChange={(value) => {
          setPageSize(value);
          setPage(1);
        }}
      />
      <p className="ucom-info">
        “ลูกค้าทิ้ง” คือการตัดงานทิ้ง ไม่ใช่การยกเลิกงาน — แถวจะไม่ถูกลบและกดกลับไปสถานะอื่นไม่ได้
      </p>
    </PageFrame>
  );
}
