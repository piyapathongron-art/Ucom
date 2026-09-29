import type { Tables } from "@/lib/types/database";

// part_cost stays out of this view; daily cash-paid part costs are read through
// the close-day model (ADR 0026).
//
// every view column comes back `| null` from the generator; these five are NOT NULL on
// repair_jobs, and status also carries a check constraint listing its five words.
export type RepairRow = Omit<
  Tables<"v_pos_repairs">,
  "id" | "received_at" | "customer_name" | "device_desc" | "status"
> & {
  id: string;
  received_at: string;
  customer_name: string;
  device_desc: string;
  status: RepairStatus;
};

export type RepairStatus =
  | "pending"
  | "in_progress"
  | "ready"
  | "collected"
  | "abandoned";

export type PartPaidFrom = "cash" | "transfer";

// the walkable part of the status list, in order. `collected` is not here: collecting
// means issuing a bill, which only rpc_close_repair_job does.
export const REPAIR_STEPS = ["pending", "in_progress", "ready"] as const;

export const REPAIR_STATUS_LABEL: Record<RepairStatus, string> = {
  pending: "รอซ่อม",
  in_progress: "กำลังซ่อม",
  ready: "รอรับเครื่อง",
  collected: "รับแล้ว",
  abandoned: "ลูกค้าทิ้ง",
};

export const REPAIR_STATUS_BADGE: Record<RepairStatus, string> = {
  pending: "bg-sunken text-ink-muted border border-border-strong",
  in_progress: "bg-warning-bg text-warning",
  ready: "bg-sunken text-ink-muted border border-border-strong",
  collected: "bg-success-bg text-success",
  abandoned: "bg-sunken text-ink-muted border border-border-strong",
};
