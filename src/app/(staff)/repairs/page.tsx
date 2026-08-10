"use client";

import { useEffect, useState } from "react";
import { createClient } from "@/lib/supabase/client";
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
    <main className="space-y-4 p-4">
      <h1 className="text-2xl font-semibold">งานซ่อม</h1>

      {error && (
        <p className="rounded bg-red-50 p-2 text-sm text-red-600">{error}</p>
      )}

      <IntakeForm onSave={createJob} />

      <div className="flex flex-wrap items-center gap-2">
        <div className="flex rounded border border-neutral-300 p-1 bg-neutral-100">
          <button
            type="button"
            onClick={() => setStatusFilter("open")}
            data-testid="filter-open"
            className={`px-3 py-1 text-sm rounded ${statusFilter === "open" ? "bg-white shadow-sm font-medium" : "text-neutral-600"}`}
          >
            เปิดอยู่
          </button>
          <button
            type="button"
            onClick={() => setStatusFilter("collected")}
            data-testid="filter-collected"
            className={`px-3 py-1 text-sm rounded ${statusFilter === "collected" ? "bg-white shadow-sm font-medium" : "text-neutral-600"}`}
          >
            รับแล้ว
          </button>
          <button
            type="button"
            onClick={() => setStatusFilter("abandoned")}
            data-testid="filter-abandoned"
            className={`px-3 py-1 text-sm rounded ${statusFilter === "abandoned" ? "bg-white shadow-sm font-medium" : "text-neutral-600"}`}
          >
            ลูกค้าทิ้ง
          </button>
          <button
            type="button"
            onClick={() => setStatusFilter("all")}
            data-testid="filter-all"
            className={`px-3 py-1 text-sm rounded ${statusFilter === "all" ? "bg-white shadow-sm font-medium" : "text-neutral-600"}`}
          >
            ทั้งหมด
          </button>
        </div>
        <input
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          placeholder="ค้นหาชื่อ/เครื่อง/เบอร์"
          data-testid="repair-search"
          className="ml-auto rounded border border-neutral-300 p-2 text-sm"
        />
      </div>

      <RepairTable
        rows={filtered}
        onSetStatus={setStatus}
        onSetPartCost={setPartCost}
        onCloseJob={closeJob}
      />
    </main>
  );
}
