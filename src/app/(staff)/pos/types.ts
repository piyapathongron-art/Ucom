import type { Tables } from "@/lib/types/database";

export type CatalogRow = Tables<"v_pos_catalog">;
export type Carrier = Tables<"v_pos_topup_carriers">;

export type CartLine =
  | {
      uid: string;
      kind: "product";
      id: string;
      name: string;
      unitPrice: number;
      qty: number;
      maxQty: number;
      discount: number;
      discountReason: string;
    }
  | {
      uid: string;
      kind: "device";
      id: string;
      name: string;
      unitPrice: number;
      discount: number;
      discountReason: string;
    }
  | {
      uid: string;
      kind: "topup";
      carrierId: string;
      carrierName: string;
      amount: number;
    };

export function lineTotal(line: CartLine): number {
  if (line.kind === "product") {
    return line.unitPrice * line.qty - line.discount;
  }
  if (line.kind === "device") {
    return line.unitPrice - line.discount;
  }
  return line.amount;
}
