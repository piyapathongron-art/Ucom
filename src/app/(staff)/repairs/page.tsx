"use client";

import { useDeferredValue, useEffect, useRef, useState } from "react";
import { createClient } from "@/lib/supabase/client";
import { PageFrame, PageSection } from "@/app/_components/PageFrame";
import { PaginationControls } from "@/app/_components/PaginationControls";
import { orIlike, pageRange } from "@/lib/supabase/pagination";
import { IntakeForm, type RepairIntakeSave } from "./IntakeForm";
import { RepairTable } from "./RepairTable";
import type { CloseJobPayload } from "./CloseJobDialog";
import type { RepairRow } from "./types";

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
      setError(loadError instanceof Error ? loadError.message : "โหลดงานซ่อมไม่สำเร็จ");
    } finally {
      if (requestId === requestRef.current) setIsLoading(false);
    }
  }

  useEffect(() => {
    Promise.resolve().then(() => loadRepairs());
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [page, pageSize, statusFilter, deferredSearch]);

  async function createJob(input: RepairIntakeSave) {
    setError(null);
    const { error } = await supabase.rpc("rpc_create_repair_job", {
      payload: input,
    });
    if (error) {
      setError(error.message);
      return;
    }
    void loadRepairs();
  }

  async function setStatus(id: string, status: string) {
    setError(null);
    const { error } = await supabase.rpc("rpc_set_repair_status", {
      p_job_id: id,
      p_status: status,
    });
    if (error) {
      setError(error.message);
      return;
    }
    void loadRepairs();
  }

  async function setPartCost(id: string, cost: number) {
    setError(null);
    const { error } = await supabase.rpc("rpc_set_part_cost", {
      p_job_id: id,
      p_cost: cost,
    });
    if (error) {
      setError(error.message);
      return;
    }
    void loadRepairs();
  }

  async function closeJob(id: string, payload: CloseJobPayload) {
    setError(null);
    const { error } = await supabase.rpc("rpc_close_repair_job", {
      p_job_id: id,
      p_sale_payload: payload,
    });
    if (error) {
      setError(error.message);
      return;
    }
    void loadRepairs();
  }

  return (
    <PageFrame
      page="repairs"
      eyebrow="SERVICE / WORKFLOW"
      title="งานซ่อม"
      description="รับงาน ติดตามสถานะ บันทึกต้นทุนอะไหล่ และออกบิลเมื่อส่งมอบ"
      actions={<span className="font-mono text-xs tracking-wide text-ink-muted">STAFF DESK</span>}
    >

      {error && (
        <div className="flex flex-wrap items-center justify-between gap-3 border border-danger bg-danger/10 p-3 text-sm text-danger">
          <span>{error}</span>
          <button type="button" onClick={() => void loadRepairs()} className="ucom-danger px-3 py-1.5 text-sm">
            ลองใหม่
          </button>
        </div>
      )}

      <IntakeForm onSave={createJob} />

      <PageSection title="คิวงานซ่อม" description={`${total.toLocaleString("th-TH")} งานตามตัวกรองปัจจุบัน`}>
      <div className="ucom-toolbar">
        <div className="flex flex-wrap gap-1 rounded-full bg-sunken p-1">
          <button
            type="button"
            onClick={() => {
              setStatusFilter("open");
              setPage(1);
            }}
            data-testid="filter-open"
            className={`rounded-full px-4 py-1.5 text-sm ${statusFilter === "open" ? "bg-[#2c2a38] text-white font-semibold" : "text-ink-muted"}`}
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
            className={`rounded-full px-4 py-1.5 text-sm ${statusFilter === "collected" ? "bg-[#2c2a38] text-white font-semibold" : "text-ink-muted"}`}
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
            className={`rounded-full px-4 py-1.5 text-sm ${statusFilter === "abandoned" ? "bg-[#2c2a38] text-white font-semibold" : "text-ink-muted"}`}
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
            className={`rounded-full px-4 py-1.5 text-sm ${statusFilter === "all" ? "bg-[#2c2a38] text-white font-semibold" : "text-ink-muted"}`}
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

      {isLoading && <p className="text-sm text-ink-muted">กำลังโหลดงานซ่อม...</p>}

      <RepairTable
        rows={rows}
        onSetStatus={setStatus}
        onSetPartCost={setPartCost}
        onCloseJob={closeJob}
      />
      {!isLoading && rows.length === 0 && (
        <p className="rounded border border-dashed border-border p-6 text-center text-sm text-ink-muted">
          ไม่พบงานตามตัวกรอง
        </p>
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
      </PageSection>
    </PageFrame>
  );
}
