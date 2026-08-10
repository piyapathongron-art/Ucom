// ponytail: hand-written instead of `Tables<"v_pos_repairs">` — src/lib/types/database.ts
// has not been regenerated since the phase 6 migration. Swap to Tables<> after the next
// `supabase gen types` run; the shape below is copied from the applied view.
//
// part_cost is absent on purpose, not forgotten: staff writes it through
// rpc_set_part_cost and can never read it back (ADR 0010). The view has no such column.
export type RepairRow = {
  id: string;
  received_at: string;
  customer_name: string;
  customer_phone: string | null;
  device_desc: string;
  symptom: string | null;
  quoted_price: number | null;
  status: RepairStatus;
  part_paid_at: string | null;
  closed_at: string | null;
  sale_id: string | null;
  note: string | null;
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
