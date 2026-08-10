import type { Tables } from "@/lib/types/database";

// part_cost is absent on purpose, not forgotten: staff writes it through
// rpc_set_part_cost and can never read it back (ADR 0010). The view has no such column.
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
