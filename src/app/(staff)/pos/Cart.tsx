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

const fieldLabel = "text-xs font-semibold text-foreground";
const field = "h-10 w-full rounded-xl border border-input bg-card px-3 text-sm outline-none focus-visible:border-ring focus-visible:ring-3 focus-visible:ring-ring/40";
const baht = (n: number) => `฿${n.toLocaleString("th-TH")}`;

function grossOf(line: CartLine): number {
  if (line.kind === "product") return line.unitPrice * line.qty;
  if (line.kind === "device") return line.unitPrice;
  return line.amount;
}

// The bill panel. `compact` is the phone layout (ADR 0033 decision 7): search, cart and checkout,
// without per-line discounts, which stay on large screens.
export function Cart({
  lines,
  onUpdateLine,
  onRemoveLine,
  onSubmit,
  submitting,
  error,
  compact = false,
}: {
  lines: CartLine[];
  onUpdateLine: (uid: string, patch: Partial<CartLine>) => void;
  onRemoveLine: (uid: string) => void;
  onSubmit: (input: CheckoutInput) => void;
  submitting: boolean;
  error: string | null;
  compact?: boolean;
}) {
  const [paymentMethod, setPaymentMethod] = useState<"cash" | "transfer">("cash");
  const [receivingAccount, setReceivingAccount] = useState("");
  const [thaiAid, setThaiAid] = useState(false);
  const [billDiscount, setBillDiscount] = useState("0");
  const [billDiscountReason, setBillDiscountReason] = useState("");
  const [isBillDiscountOpen, setIsBillDiscountOpen] = useState(false);
  const [note, setNote] = useState("");
  const [discountOpen, setDiscountOpen] = useState<Set<string>>(new Set());

  // Totals shown in the order money is worked out: what the items cost, minus every discount, = net.
  const gross = lines.reduce((sum, l) => sum + grossOf(l), 0);
  const itemsTotal = lines.reduce((sum, l) => sum + lineTotal(l), 0);
  const lineDiscounts = gross - itemsTotal;
  const billDiscountValue = Number(billDiscount) || 0;
  const total = itemsTotal - billDiscountValue;
  const pieces = lines.reduce((sum, l) => sum + (l.kind === "product" ? l.qty : 1), 0);

  const payOption = (active: boolean) =>
    `h-11 rounded-full text-sm font-semibold transition-colors focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-primary ${
      active ? "bg-card text-foreground shadow-sm" : "text-muted-foreground hover:text-foreground"
    }`;

  return (
    <div className="flex h-full min-h-0 flex-col">
      <div className={`flex items-center justify-between px-5 pt-5 pb-3 ${compact ? "pr-16" : ""}`}>
        <h2 className="text-lg font-bold text-foreground">บิลปัจจุบัน</h2>
        <span className="text-sm text-muted-foreground">{lines.length} รายการ</span>
      </div>

      <div className="min-h-0 flex-1 overflow-y-auto px-5">
        {lines.length === 0 && (
          <div className="rounded-xl border border-dashed border-border px-4 py-10 text-center">
            <p className="text-sm font-semibold text-foreground">ยังไม่มีรายการในบิล</p>
            <p className="mt-1 text-sm text-muted-foreground">แตะสินค้าหรือสแกนบาร์โค้ดเพื่อเริ่มขาย</p>
          </div>
        )}
        <ul className="flex flex-col gap-3 pb-3" data-testid="cart-lines" data-count={lines.length}>
          {lines.map((line) => {
            const name = line.kind === "topup" ? `เติมเงิน ${line.carrierName}` : line.name;
            const hasDiscount = line.kind !== "topup" && line.discount > 0;
            const isDiscountOpen = hasDiscount || discountOpen.has(line.uid);
            return (
              <li key={line.uid} data-testid={`cart-line-${line.kind}`} className="flex flex-col gap-2.5 rounded-xl bg-muted p-3.5">
                <div className="flex items-start justify-between gap-2">
                  <div className="min-w-0">
                    <p className="text-sm leading-5 font-semibold text-foreground">{name}</p>
                    <p className="text-xs text-muted-foreground">
                      {line.kind === "product" ? `${baht(line.unitPrice)} / ชิ้น` : line.kind === "device" ? "เครื่อง" : "ตัดจากวอลเล็ตค่าย"}
                    </p>
                  </div>
                  <button
                    type="button"
                    onClick={() => onRemoveLine(line.uid)}
                    aria-label={`ลบ ${name} ออกจากบิล`}
                    className="grid size-10 shrink-0 place-items-center rounded-full bg-card text-muted-foreground hover:text-danger focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-primary"
                  >
                    <svg aria-hidden="true" className="size-4" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" viewBox="0 0 24 24"><path d="M6 6l12 12M18 6 6 18" /></svg>
                  </button>
                </div>

                {line.kind === "product" && (
                  <div className="flex items-center justify-between gap-2">
                    <div role="group" aria-label={`จำนวน ${name}`} className="flex items-center gap-1 rounded-full bg-card p-0.5">
                      <button
                        type="button"
                        aria-label="ลดจำนวน"
                        disabled={line.qty <= 1}
                        onClick={() => onUpdateLine(line.uid, { qty: Math.max(1, line.qty - 1) } as Partial<CartLine>)}
                        className="grid size-10 place-items-center rounded-full bg-muted text-lg text-foreground disabled:opacity-40"
                      >
                        −
                      </button>
                      <span className="min-w-8 text-center font-mono font-semibold tabular-nums">{line.qty}</span>
                      <button
                        type="button"
                        aria-label="เพิ่มจำนวน"
                        disabled={line.qty >= line.maxQty}
                        onClick={() => onUpdateLine(line.uid, { qty: Math.min(line.maxQty, line.qty + 1) } as Partial<CartLine>)}
                        className="grid size-10 place-items-center rounded-full bg-muted text-lg text-foreground disabled:opacity-40"
                      >
                        +
                      </button>
                    </div>
                    <span className="font-mono text-sm font-semibold tabular-nums">{baht(lineTotal(line))}</span>
                  </div>
                )}

                {line.kind === "device" && (
                  <label className="flex flex-col gap-1">
                    <span className={fieldLabel}>ราคาขาย</span>
                    <input
                      type="number"
                      inputMode="decimal"
                      value={line.unitPrice}
                      onChange={(e) => onUpdateLine(line.uid, { unitPrice: Number(e.target.value) || 0 } as Partial<CartLine>)}
                      data-testid="cart-device-price"
                      className={`${field} font-mono text-base font-semibold`}
                    />
                  </label>
                )}

                {line.kind === "topup" && <span className="self-end font-mono text-sm font-semibold tabular-nums">{baht(line.amount)}</span>}

                {(line.kind === "product" || line.kind === "device") && !compact && (
                  isDiscountOpen ? (
                    <div className="grid grid-cols-[7rem_minmax(0,1fr)] gap-2">
                      <label className="flex flex-col gap-1">
                        <span className={fieldLabel}>ส่วนลด</span>
                        <input
                          type="number"
                          inputMode="decimal"
                          value={line.discount}
                          onChange={(e) => onUpdateLine(line.uid, { discount: Number(e.target.value) || 0 } as Partial<CartLine>)}
                          className={`${field} font-mono`}
                        />
                      </label>
                      <label className="flex flex-col gap-1">
                        <span className={fieldLabel}>เหตุผลส่วนลด</span>
                        <input
                          value={line.discountReason}
                          onChange={(e) => onUpdateLine(line.uid, { discountReason: e.target.value } as Partial<CartLine>)}
                          className={field}
                        />
                      </label>
                    </div>
                  ) : (
                    <button
                      type="button"
                      onClick={() => setDiscountOpen((prev) => new Set(prev).add(line.uid))}
                      className="h-10 self-start rounded-full px-3 text-sm font-semibold text-primary hover:bg-card"
                    >
                      + ส่วนลด
                    </button>
                  )
                )}
                {compact && hasDiscount && <p className="text-xs text-muted-foreground">ส่วนลด {baht(line.discount)} (แก้ได้บนจอใหญ่)</p>}
              </li>
            );
          })}
        </ul>
      </div>

      <div className="flex shrink-0 flex-col gap-3 border-t border-border px-5 pt-4 pb-5">
        <dl className="flex flex-col gap-1.5 text-sm">
          <div className="flex justify-between">
            <dt className="text-muted-foreground">รวม {pieces} ชิ้น</dt>
            <dd className="font-mono tabular-nums">{baht(gross)}</dd>
          </div>
          {lineDiscounts > 0 && (
            <div className="flex justify-between">
              <dt className="text-muted-foreground">ส่วนลดรายชิ้น</dt>
              <dd className="font-mono text-danger tabular-nums">−{baht(lineDiscounts)}</dd>
            </div>
          )}
          <div className="flex items-center justify-between">
            <dt className="text-muted-foreground">
              ส่วนลดท้ายบิล{" "}
              <button type="button" onClick={() => setIsBillDiscountOpen((v) => !v)} className="h-10 rounded-full px-2 font-semibold text-primary hover:bg-muted" aria-expanded={isBillDiscountOpen}>
                {isBillDiscountOpen ? "ซ่อน" : billDiscountValue > 0 ? "แก้ไข" : "เพิ่ม"}
              </button>
            </dt>
            <dd className={`font-mono tabular-nums ${billDiscountValue > 0 ? "text-danger" : "text-muted-foreground"}`}>{billDiscountValue > 0 ? `−${baht(billDiscountValue)}` : baht(0)}</dd>
          </div>
          {isBillDiscountOpen && (
            <div className="grid grid-cols-[7rem_minmax(0,1fr)] gap-2">
              <label className="flex flex-col gap-1">
                <span className={fieldLabel}>ส่วนลดท้ายบิล</span>
                <input type="number" inputMode="decimal" value={billDiscount} onChange={(e) => setBillDiscount(e.target.value)} className={`${field} font-mono`} />
              </label>
              <label className="flex flex-col gap-1">
                <span className={fieldLabel}>เหตุผล</span>
                <input value={billDiscountReason} onChange={(e) => setBillDiscountReason(e.target.value)} className={field} />
              </label>
            </div>
          )}
          <div className="flex items-baseline justify-between pt-1">
            <dt className="text-base font-semibold text-foreground">ยอดสุทธิ</dt>
            <dd className="font-mono text-3xl font-bold text-primary tabular-nums">{baht(total)}</dd>
          </div>
        </dl>

        <div role="radiogroup" aria-label="วิธีชำระเงิน" className="grid grid-cols-3 gap-1 rounded-full bg-muted p-1">
          <button type="button" role="radio" aria-checked={paymentMethod === "cash" && !thaiAid} data-testid="pay-cash" onClick={() => { setPaymentMethod("cash"); setThaiAid(false); }} className={payOption(paymentMethod === "cash" && !thaiAid)}>
            เงินสด
          </button>
          <button type="button" role="radio" aria-checked={paymentMethod === "transfer" && !thaiAid} data-testid="pay-transfer" onClick={() => { setPaymentMethod("transfer"); setThaiAid(false); }} className={payOption(paymentMethod === "transfer" && !thaiAid)}>
            โอน
          </button>
          <button type="button" role="radio" aria-checked={thaiAid} onClick={() => { setPaymentMethod("transfer"); setReceivingAccount("ไทยช่วยไทย"); setThaiAid(true); }} className={payOption(thaiAid)}>
            ไทยช่วยไทย
          </button>
        </div>

        {paymentMethod === "transfer" && (
          <label className="flex flex-col gap-1">
            <span className={fieldLabel}>บัญชีที่รับเงิน</span>
            <input
              value={receivingAccount}
              onChange={(e) => { setReceivingAccount(e.target.value); setThaiAid(e.target.value === "ไทยช่วยไทย"); }}
              data-testid="receiving-account"
              className={field}
            />
          </label>
        )}

        <label className="flex flex-col gap-1">
          <span className={fieldLabel}>โน้ตท้ายบิล (ไม่บังคับ)</span>
          <input value={note} onChange={(e) => setNote(e.target.value)} data-testid="bill-note" className={field} />
        </label>

        {error && (
          <p data-testid="checkout-error" role="alert" className="rounded-xl bg-danger-bg p-3 text-sm leading-6 text-danger">
            {error}
          </p>
        )}

        <button
          type="button"
          data-testid="checkout-submit"
          disabled={lines.length === 0 || submitting}
          onClick={() =>
            onSubmit({
              paymentMethod,
              receivingAccount,
              billDiscount: billDiscountValue,
              billDiscountReason,
              note,
            })
          }
          className="flex h-14 items-center justify-center gap-2 rounded-full bg-primary text-lg font-bold text-primary-foreground hover:bg-primary/90 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-primary disabled:cursor-not-allowed disabled:bg-muted disabled:text-muted-foreground"
        >
          {submitting ? "กำลังบันทึก..." : <>ปิดบิล <span className="font-mono">{baht(total)}</span></>}
        </button>
      </div>
    </div>
  );
}
