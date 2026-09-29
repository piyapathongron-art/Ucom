import type { Tables } from "@/lib/types/database";

export type StockRow = Tables<"v_pos_stock">;
export type Category = Tables<"categories">;
export type Carrier = Pick<Tables<"topup_carriers">, "id" | "name">;

export type StockKind = "product" | "device";

export const STATUS_LABEL: Record<string, string> = {
  active: "ขายอยู่",
  inactive: "เลิกขาย",
  in_stock: "อยู่ในคลัง",
  consigned_out: "ฝากขายออกแล้ว",
  written_off: "ตัดจำหน่าย",
};

export const ACQUISITION_LABEL: Record<string, string> = {
  purchased: "ซื้อขาด",
  consigned_in: "ฝากเข้า",
  sf_credit: "SF+",
};

// Write-side payloads shared by the page (RPC calls) and the drawer (form).
export type ProductSave = {
  id?: string;
  name: string;
  sku: string;
  category_id: string;
  carrier_id?: string | null;
  price: number;
  qty: number;
  is_active: boolean;
  cost?: number; // used only when creating (id empty) — RPC ignores it on edit
};

export type DeviceSave = {
  id?: string;
  imei: string;
  model_name: string;
  // exactly one of these is sent per save — which one depends on acquisition
  // (list_price for purchased/consigned_in, sale_price for sf_credit, see
  // useStockRowEdit). The RPC preserves whichever is omitted.
  list_price?: number;
  sale_price?: number;
  status: string;
  cost?: number; // used only when creating (id empty) — RPC ignores it on edit
};
