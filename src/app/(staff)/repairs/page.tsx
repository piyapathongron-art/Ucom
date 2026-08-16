"use client";

import { useEffect, useState } from "react";
import { createClient } from "@/lib/supabase/client";
import { PageFrame, PageSection } from "@/app/_components/PageFrame";
import { IntakeForm, type RepairIntakeSave } from "./IntakeForm";
import { RepairTable } from "./RepairTable";
import type { CloseJobPayload } from "./CloseJobDialog";
import type { RepairRow } from "./types";

export default function RepairsPage() {
  const supabase = createClient();

  const [rows, setRows] = useState<RepairRow[]>([]);
  const [search, setSearch] = useState("");
  const [statusFilter, setStatusFilter] = useState<"open" | "collected" | "abandoned" | "all">("open");
  const [error, setError] = useState<string | null>(null);

  function loadRepairs() {
    return supabase
      .from("v_pos_repairs")
      .select("*")
      .then(({ data }) => setRows((data as RepairRow[]) ?? []));
  }

  useEffect(() => {
    loadRepairs();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  async function createJob(input: RepairIntakeSave) {
    setError(null);
    const { error } = await supabase.rpc("rpc_create_repair_job", {
      payload: input,
    });
    if (error) {
      setError(error.message);
      return;
    }
    loadRepairs();
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
    loadRepairs();
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
    loadRepairs();
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
    loadRepairs();
  }

  const filtered = rows.filter((r) => {
    // text search
    const textTarget = `${r.customer_name} ${r.device_desc} ${r.customer_phone ?? ""}`.toLowerCase();
    const searchMatch = !search.trim() || textTarget.includes(search.trim().toLowerCase());
    
    // status filter
    let statusMatch = true;
    if (statusFilter === "open") {
      statusMatch = r.status === "pending" || r.status === "in_progress" || r.status === "ready";
    } else if (statusFilter === "collected") {
      statusMatch = r.status === "collected";
    } else if (statusFilter === "abandoned") {
      statusMatch = r.status === "abandoned";
    }

    return searchMatch && statusMatch;
  });

  return (
    <PageFrame
      page="repairs"
      eyebrow="SERVICE / WORKFLOW"
      title="งานซ่อม"
      description="รับงาน ติดตามสถานะ บันทึกต้นทุนอะไหล่ และออกบิลเมื่อส่งมอบ"
      actions={<span className="font-mono text-xs tracking-wide text-ink-muted">STAFF DESK</span>}
    >

      {error && (
        <p className="border border-danger bg-danger/10 p-3 text-sm text-danger">{error}</p>
      )}

      <IntakeForm onSave={createJob} />

      <PageSection title="คิวงานซ่อม" description={`${filtered.length.toLocaleString("th-TH")} งานตามตัวกรองปัจจุบัน`}>
      <div className="ucom-toolbar">
        <div className="flex flex-wrap rounded border border-border bg-background p-1">
          <button
            type="button"
            onClick={() => setStatusFilter("open")}
            data-testid="filter-open"
            className={`rounded px-3 py-1.5 text-sm ${statusFilter === "open" ? "bg-surface font-medium shadow-sm" : "text-ink-muted"}`}
          >
            เปิดอยู่
          </button>
          <button
            type="button"
            onClick={() => setStatusFilter("collected")}
            data-testid="filter-collected"
            className={`rounded px-3 py-1.5 text-sm ${statusFilter === "collected" ? "bg-surface font-medium shadow-sm" : "text-ink-muted"}`}
          >
            รับแล้ว
          </button>
          <button
            type="button"
            onClick={() => setStatusFilter("abandoned")}
            data-testid="filter-abandoned"
            className={`rounded px-3 py-1.5 text-sm ${statusFilter === "abandoned" ? "bg-surface font-medium shadow-sm" : "text-ink-muted"}`}
          >
            ลูกค้าทิ้ง
          </button>
          <button
            type="button"
            onClick={() => setStatusFilter("all")}
            data-testid="filter-all"
            className={`rounded px-3 py-1.5 text-sm ${statusFilter === "all" ? "bg-surface font-medium shadow-sm" : "text-ink-muted"}`}
          >
            ทั้งหมด
          </button>
        </div>
        <input
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          placeholder="ค้นหาชื่อ/เครื่อง/เบอร์"
          data-testid="repair-search"
          className="ucom-field ml-auto w-full px-3 py-2 text-sm md:w-80"
        />
      </div>

      <RepairTable
        rows={filtered}
        onSetStatus={setStatus}
        onSetPartCost={setPartCost}
        onCloseJob={closeJob}
      />
      </PageSection>
    </PageFrame>
  );
}
