import type { Tables } from "@/lib/types/database";

export type StockRow = Tables<"v_pos_stock">;
export type Category = Tables<"categories">;
export type SfDue = Tables<"v_sf_due">;
