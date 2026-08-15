"use client";

import { useState } from "react";
import type { CartLine } from "./types";
import { lineTotal } from "./types";

export type CheckoutInput = {
  paymentMethod: "cash" | "transfer";
  receivingAccount: string;
  billDiscount: number;
  billDiscountReason: string;
  note: string;
};

export function Cart({
  lines,
  onUpdateLine,
  onRemoveLine,
  onSubmit,
  submitting,
  error,
}: {
  lines: CartLine[];
  onUpdateLine: (uid: string, patch: Partial<CartLine>) => void;
  onRemoveLine: (uid: string) => void;
  onSubmit: (input: CheckoutInput) => void;
  submitting: boolean;
  error: string | null;
}) {
  const [paymentMethod, setPaymentMethod] = useState<"cash" | "transfer">(
    "cash",
  );
  const [receivingAccount, setReceivingAccount] = useState("");
  const [billDiscount, setBillDiscount] = useState("0");
  const [billDiscountReason, setBillDiscountReason] = useState("");
  const [note, setNote] = useState("");

  const itemsTotal = lines.reduce((sum, l) => sum + lineTotal(l), 0);
  const total = itemsTotal - (Number(billDiscount) || 0);

  return (
    <div className="flex w-96 flex-col border-l border-border">
      <div className="flex-1 overflow-y-auto p-4">
        {lines.length === 0 && (
          <p className="text-sm text-ink-muted">ตะกร้าว่าง</p>
        )}
        <ul className="space-y-3" data-testid="cart-lines" data-count={lines.length}>
          {lines.map((line) => (
            <li
              key={line.uid}
              data-testid={`cart-line-${line.kind}`}
              className="rounded border border-border p-2"
            >
              <div className="flex items-start justify-between gap-2">
                <span className="font-medium">
                  {line.kind === "topup" ? `เติมเงิน ${line.carrierName}` : line.name}
                </span>
                <button
                  type="button"
                  onClick={() => onRemoveLine(line.uid)}
                  className="text-sm text-danger"
                >
                  ลบ
                </button>
              </div>

              {line.kind === "product" && (
                <div className="mt-1 flex items-center gap-2 text-sm">
                  <button
                    type="button"
                    onClick={() =>
                      onUpdateLine(line.uid, {
                        qty: Math.max(1, line.qty - 1),
                      } as Partial<CartLine>)
                    }
                    className="rounded border border-border px-2"
                  >
                    −
                  </button>
                  <span>{line.qty}</span>
                  <button
                    type="button"
                    onClick={() =>
                      onUpdateLine(line.uid, {
                        qty: Math.min(line.maxQty, line.qty + 1),
                      } as Partial<CartLine>)
                    }
                    className="rounded border border-border px-2"
                  >
                    +
                  </button>
                  <span className="ml-auto font-mono tabular-nums">
                    {(line.unitPrice * line.qty).toLocaleString()} บาท
                  </span>
                </div>
              )}

              {line.kind === "device" && (
                <div className="mt-1 text-sm font-mono tabular-nums">
                  {line.unitPrice.toLocaleString()} บาท
                </div>
              )}

              {(line.kind === "product" || line.kind === "device") && (
                <div className="mt-1 flex gap-2">
                  <input
                    type="number"
                    inputMode="decimal"
                    value={line.discount}
                    onChange={(e) =>
                      onUpdateLine(line.uid, {
                        discount: Number(e.target.value) || 0,
                      } as Partial<CartLine>)
                    }
                    placeholder="ส่วนลด"
                    className="w-20 rounded border border-border p-1 text-sm"
                  />
                  <input
                    value={line.discountReason}
                    onChange={(e) =>
                      onUpdateLine(line.uid, {
                        discountReason: e.target.value,
                      } as Partial<CartLine>)
                    }
                    placeholder="เหตุผลส่วนลด"
                    className="flex-1 rounded border border-border p-1 text-sm"
                  />
                </div>
              )}

              {line.kind === "topup" && (
                <div className="mt-1 text-sm font-mono tabular-nums">
                  {line.amount.toLocaleString()} บาท
                </div>
              )}
            </li>
          ))}
        </ul>
      </div>

      <div className="space-y-3 border-t border-border p-4">
        {error && (
          <p
            data-testid="checkout-error"
            className="rounded bg-danger/10 p-2 text-sm text-danger"
          >
            {error}
          </p>
        )}

        <div className="flex gap-2">
          <button
            type="button"
            data-testid="pay-cash"
            onClick={() => setPaymentMethod("cash")}
            className={`flex-1 rounded border p-2 text-sm ${
              paymentMethod === "cash"
                ? "border-ink bg-ink text-surface"
                : "border-border"
            }`}
          >
            เงินสด
          </button>
          <button
            type="button"
            data-testid="pay-transfer"
            onClick={() => setPaymentMethod("transfer")}
            className={`flex-1 rounded border p-2 text-sm ${
              paymentMethod === "transfer"
                ? "border-ink bg-ink text-surface"
                : "border-border"
            }`}
          >
            โอน
          </button>
        </div>

        {paymentMethod === "transfer" && (
          <input
            value={receivingAccount}
            onChange={(e) => setReceivingAccount(e.target.value)}
            placeholder="บัญชีที่รับเงิน"
            data-testid="receiving-account"
            className="w-full rounded border border-border p-2 text-sm"
          />
        )}

        <div className="flex gap-2">
          <input
            type="number"
            inputMode="decimal"
            value={billDiscount}
            onChange={(e) => setBillDiscount(e.target.value)}
            placeholder="ส่วนลดท้ายบิล"
            className="w-28 rounded border border-border p-2 text-sm"
          />
          <input
            value={billDiscountReason}
            onChange={(e) => setBillDiscountReason(e.target.value)}
            placeholder="เหตุผลส่วนลดท้ายบิล"
            className="flex-1 rounded border border-border p-2 text-sm"
          />
        </div>

        <input
          value={note}
          onChange={(e) => setNote(e.target.value)}
          data-testid="bill-note"
          placeholder="โน้ต"
          className="w-full rounded border border-border p-2 text-sm"
        />

        <div className="flex items-center justify-between">
          <span className="text-lg font-semibold">รวม</span>
          <span className="font-mono tabular-nums text-lg font-semibold">{total.toLocaleString()} บาท</span>
        </div>

        <button
          type="button"
          data-testid="checkout-submit"
          disabled={lines.length === 0 || submitting}
          onClick={() =>
            onSubmit({
              paymentMethod,
              receivingAccount,
              billDiscount: Number(billDiscount) || 0,
              billDiscountReason,
              note,
            })
          }
          className="w-full rounded bg-ink p-2 text-surface disabled:opacity-40"
        >
          {submitting ? "กำลังบันทึก..." : "ปิดบิล"}
        </button>
      </div>
    </div>
  );
}
