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
    <aside className="flex h-full min-h-0 w-[min(100%,28rem)] min-w-[22rem] flex-col border-l border-border bg-surface">
      <div className="flex items-center justify-between border-b border-border px-5 py-4">
        <div>
          <p className="font-mono text-[0.68rem] uppercase tracking-[0.18em] text-ink-muted">Receipt / current bill</p>
          <h2 className="mt-1 text-lg font-semibold tracking-tight text-ink">บิลปัจจุบัน</h2>
        </div>
        <span className="font-mono text-xs text-ink-muted">{lines.length} รายการ</span>
      </div>

      <div className="min-h-0 flex-1 overflow-y-auto px-5 py-4">
        {lines.length === 0 && (
          <div className="rounded border border-dashed border-border px-4 py-10 text-center">
            <p className="text-sm font-medium text-ink">ยังไม่มีรายการในบิล</p>
            <p className="mt-1 text-xs text-ink-muted">เลือกสินค้าจากฝั่งซ้ายเพื่อเริ่มขาย</p>
          </div>
        )}
        <ul className="space-y-3" data-testid="cart-lines" data-count={lines.length}>
          {lines.map((line) => (
            <li
              key={line.uid}
              data-testid={`cart-line-${line.kind}`}
              className="border-b border-dashed border-border py-3 first:pt-0"
            >
              <div className="flex items-start justify-between gap-2">
                <span className="max-w-[15rem] font-medium leading-5">
                  {line.kind === "topup" ? `เติมเงิน ${line.carrierName}` : line.name}
                </span>
                <button
                  type="button"
                  onClick={() => onRemoveLine(line.uid)}
                  className="ucom-danger px-2 py-1 text-xs"
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
                    className="ucom-secondary h-7 w-7 px-0 text-sm"
                  >
                    −
                  </button>
                  <span className="min-w-5 text-center font-mono tabular-nums">{line.qty}</span>
                  <button
                    type="button"
                    onClick={() =>
                      onUpdateLine(line.uid, {
                        qty: Math.min(line.maxQty, line.qty + 1),
                      } as Partial<CartLine>)
                    }
                    className="ucom-secondary h-7 w-7 px-0 text-sm"
                  >
                    +
                  </button>
                  <span className="ml-auto font-mono text-sm tabular-nums">
                    {(line.unitPrice * line.qty).toLocaleString()} บาท
                  </span>
                </div>
              )}

              {line.kind === "device" && (
                <input
                  type="number"
                  inputMode="decimal"
                  value={line.unitPrice}
                  onChange={(e) =>
                    onUpdateLine(line.uid, {
                      unitPrice: Number(e.target.value) || 0,
                    } as Partial<CartLine>)
                  }
                  data-testid="cart-device-price"
                  className="ucom-field mt-2 w-32 px-2 py-1.5 text-sm font-mono tabular-nums"
                />
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
                    className="ucom-field w-24 px-2 py-1.5 text-sm"
                  />
                  <input
                    value={line.discountReason}
                    onChange={(e) =>
                      onUpdateLine(line.uid, {
                        discountReason: e.target.value,
                      } as Partial<CartLine>)
                    }
                    placeholder="เหตุผลส่วนลด"
                    className="ucom-field flex-1 px-2 py-1.5 text-sm"
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

      <div className="shrink-0 space-y-3 border-t border-border bg-background px-5 py-4">
        {error && (
          <p
            data-testid="checkout-error"
            className="rounded border border-danger/30 bg-danger/10 p-2 text-sm text-danger"
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
                : "border-border bg-surface text-ink-muted"
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
                : "border-border bg-surface text-ink-muted"
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
            className="ucom-field w-full px-3 py-2 text-sm"
          />
        )}

        <div className="flex gap-2">
          <input
            type="number"
            inputMode="decimal"
            value={billDiscount}
            onChange={(e) => setBillDiscount(e.target.value)}
            placeholder="ส่วนลดท้ายบิล"
            className="ucom-field w-28 px-3 py-2 text-sm"
          />
          <input
            value={billDiscountReason}
            onChange={(e) => setBillDiscountReason(e.target.value)}
            placeholder="เหตุผลส่วนลดท้ายบิล"
            className="ucom-field flex-1 px-3 py-2 text-sm"
          />
        </div>

        <input
          value={note}
          onChange={(e) => setNote(e.target.value)}
          data-testid="bill-note"
          placeholder="โน้ต"
          className="ucom-field w-full px-3 py-2 text-sm"
        />

        <div className="border-t border-dashed border-border pt-3">
          <div className="flex items-center justify-between text-sm text-ink-muted">
            <span>ยอดรวมก่อนส่วนลด</span>
            <span className="font-mono tabular-nums">{itemsTotal.toLocaleString()} บาท</span>
          </div>
          <div className="mt-1 flex items-center justify-between">
            <span className="text-lg font-semibold">ยอดสุทธิ</span>
            <span className="font-mono text-xl font-semibold tabular-nums">{total.toLocaleString()} บาท</span>
          </div>
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
          className="ucom-primary w-full px-4 py-3 text-sm disabled:cursor-not-allowed disabled:opacity-40"
        >
          {submitting ? "กำลังบันทึก..." : "ปิดบิล"}
        </button>
      </div>
    </aside>
  );
}
