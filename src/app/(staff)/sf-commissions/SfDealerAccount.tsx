"use client";

import { useEffect, useState } from "react";
import { toast } from "sonner";
import { Modal } from "@/app/_components/Modal";
import { ErrorPanel } from "@/app/_components/ErrorPanel";
import { SkeletonRows } from "@/app/_components/Skeleton";
import { EmptyState } from "@/app/_components/EmptyState";
import { createClient } from "@/lib/supabase/client";
import { toThaiError } from "@/lib/errors";
import type { Tables } from "@/lib/types/database";
import { DEALER_KIND_LABEL, balanceAsOf, dealerEntryProblem, statementDifference, type DealerEntryKind } from "./sfDealer";
import { fmtMoney, formatDate, todayInBangkok } from "./utils";

type Summary = Tables<"v_sf_dealer_summary">;
type Invoice = Tables<"v_sf_dealer_invoices">;
type LedgerRow = Tables<"v_sf_dealer_ledger">;

const label = "mb-1.5 block text-sm font-semibold text-foreground";
const input = "ucom-field h-12 w-full px-4 text-base";

const ENTRY_TITLE: Record<DealerEntryKind, string> = {
  payment: "บันทึกการโอนจ่ายร้านตัวแทน",
  credit_other: "บันทึกใบลดหนี้อื่นๆ",
  adjustment: "ปรับยอดบัญชีร้านตัวแทน",
};

type EntryDraft = { kind: DealerEntryKind; date: string; amount: string; docNo: string; reference: string; note: string };

// Owner-only "บัญชีร้านตัวแทน" sub-tab (ADR 0034): what the shop owes the SF dealer, what is overdue,
// and a check against the dealer's statement. Payments are transfers and never touch the cash book.
export function SfDealerAccount() {
  const supabase = createClient();
  const [summary, setSummary] = useState<Summary | null>(null);
  const [invoices, setInvoices] = useState<Invoice[]>([]);
  const [ledger, setLedger] = useState<LedgerRow[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [reloadKey, setReloadKey] = useState(0);

  const [entry, setEntry] = useState<EntryDraft | null>(null);
  const [entryError, setEntryError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);
  const [voidTarget, setVoidTarget] = useState<LedgerRow | null>(null);
  const [voidReason, setVoidReason] = useState("");
  const [dueDrafts, setDueDrafts] = useState<Record<string, string>>({});
  const [statementDate, setStatementDate] = useState(todayInBangkok());
  const [statementBalance, setStatementBalance] = useState("");
  const [showSettled, setShowSettled] = useState(false);

  useEffect(() => {
    let isCurrent = true;
    Promise.all([
      supabase.from("v_sf_dealer_summary").select("*").maybeSingle(),
      supabase.from("v_sf_dealer_invoices").select("*").order("ordered_at", { ascending: false }),
      supabase.from("v_sf_dealer_ledger").select("*").order("entry_date", { ascending: false }).order("created_at", { ascending: false }),
    ]).then(([s, i, l]) => {
      if (!isCurrent) return;
      const failed = s.error ?? i.error ?? l.error;
      if (failed) {
        setError(toThaiError(failed));
      } else {
        setError(null);
        setSummary(s.data);
        setInvoices(i.data ?? []);
        setLedger(l.data ?? []);
      }
      setIsLoading(false);
    });
    return () => { isCurrent = false; };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [reloadKey]);

  const refresh = () => { setIsLoading(true); setReloadKey((k) => k + 1); };
  const today = todayInBangkok();
  const difference = statementBalance.trim() ? statementDifference(ledger, statementDate, statementBalance) : null;
  const openInvoices = invoices.filter((i) => (i.open_amount ?? 0) > 0);
  const shownInvoices = showSettled ? invoices : openInvoices;

  function openEntry(kind: DealerEntryKind, over: Partial<EntryDraft> = {}) {
    setEntryError(null);
    setEntry({ kind, date: today, amount: "", docNo: "", reference: "", note: "", ...over });
  }

  async function saveEntry() {
    if (!entry) return;
    const problem = dealerEntryProblem(entry.kind, entry.amount, entry.note, entry.date, today);
    if (problem) { setEntryError(problem); return; }
    setSaving(true);
    const { error: rpcError } = await supabase.rpc("rpc_sf_dealer_record", {
      p_kind: entry.kind,
      p_entry_date: entry.date,
      p_amount: Number(entry.amount.replace(/,/g, "")),
      p_doc_no: entry.docNo || undefined,
      p_reference: entry.reference || undefined,
      p_note: entry.note || undefined,
    });
    setSaving(false);
    if (rpcError) { setEntryError(toThaiError(rpcError)); return; }
    toast.success("บันทึกแล้ว");
    setEntry(null);
    refresh();
  }

  async function confirmVoid() {
    if (!voidTarget?.id) return;
    if (!voidReason.trim()) { toast.error("ต้องระบุเหตุผลที่ยกเลิก"); return; }
    setSaving(true);
    const { error: rpcError } = await supabase.rpc("rpc_sf_dealer_void", { p_id: voidTarget.id, p_reason: voidReason });
    setSaving(false);
    if (rpcError) { toast.error(toThaiError(rpcError)); return; }
    toast.success("ยกเลิกรายการแล้ว");
    setVoidTarget(null);
    setVoidReason("");
    refresh();
  }

  async function saveDueDate(orderId: string) {
    const value = dueDrafts[orderId];
    if (!value) return;
    const { error: rpcError } = await supabase.rpc("rpc_set_sf_order_due_date", { p_order_id: orderId, p_due_date: value });
    if (rpcError) { toast.error(toThaiError(rpcError)); return; }
    toast.success("บันทึกวันครบกำหนดแล้ว");
    setDueDrafts((prev) => { const next = { ...prev }; delete next[orderId]; return next; });
    refresh();
  }

  if (isLoading && !summary) return <SkeletonRows cols={5} />;
  if (error) return <ErrorPanel message={error} onRetry={refresh} />;

  return (
    <div className="space-y-5" data-testid="sf-dealer-account">
      <div className="grid gap-3 sm:grid-cols-3">
        <div className="rounded-xl bg-card p-5 shadow-card">
          <p className="text-sm text-muted-foreground">ค้างจ่ายร้านตัวแทน</p>
          <p className="mt-1 text-2xl font-bold tabular-nums" data-testid="sf-dealer-balance">฿{fmtMoney(summary?.balance ?? 0)}</p>
        </div>
        <div className="rounded-xl bg-card p-5 shadow-card">
          <p className="text-sm text-muted-foreground">เกินกำหนดชำระ</p>
          <p className={`mt-1 text-2xl font-bold tabular-nums ${(summary?.overdue_amount ?? 0) > 0 ? "text-danger" : ""}`}>฿{fmtMoney(summary?.overdue_amount ?? 0)}</p>
          {(summary?.max_days_overdue ?? 0) > 0 && <p className="text-sm text-danger">เกินมาแล้วสูงสุด {summary?.max_days_overdue} วัน</p>}
        </div>
        <div className="rounded-xl bg-card p-5 shadow-card">
          <p className="text-sm text-muted-foreground">ใบส่งของที่ยังค้าง</p>
          <p className="mt-1 text-2xl font-bold tabular-nums">{summary?.open_invoices ?? 0} ใบ</p>
        </div>
      </div>

      <div className="flex flex-wrap gap-2">
        <button type="button" onClick={() => openEntry("payment")} className="ucom-primary min-h-11 px-5" data-testid="sf-dealer-add-payment">บันทึกการโอนจ่าย</button>
        <button type="button" onClick={() => openEntry("credit_other")} className="ucom-secondary min-h-11 px-5">บันทึกใบลดหนี้อื่นๆ</button>
        <button type="button" onClick={() => openEntry("adjustment")} className="ucom-secondary min-h-11 px-5">ปรับยอด</button>
      </div>

      <section className="space-y-3 rounded-xl bg-card p-5 shadow-card" aria-labelledby="sf-dealer-reconcile">
        <h3 id="sf-dealer-reconcile" className="text-base font-bold">เทียบกับ statement ของร้านตัวแทน</h3>
        <div className="grid gap-3 sm:grid-cols-3">
          <label className="block">
            <span className={label}>วันที่ของ statement</span>
            <input type="date" value={statementDate} max={today} onChange={(e) => setStatementDate(e.target.value)} className={input} />
          </label>
          <label className="block">
            <span className={label}>ยอดหนี้คงค้างตาม statement</span>
            <input inputMode="decimal" value={statementBalance} onChange={(e) => setStatementBalance(e.target.value)} placeholder="เช่น 20,707.00" className={input} data-testid="sf-dealer-statement-balance" />
          </label>
          <div className="text-sm">
            <p className="text-muted-foreground">ยอดในระบบ ณ วันนั้น</p>
            <p className="text-lg font-bold tabular-nums">฿{fmtMoney(balanceAsOf(ledger, statementDate))}</p>
          </div>
        </div>
        {statementBalance.trim() && difference === null && <p role="alert" className="text-sm font-semibold text-danger">กรอกยอดเป็นตัวเลข เช่น 20707 หรือ 20,707.00</p>}
        {difference !== null && (difference === 0
          ? <p className="text-sm font-semibold text-success">ตรงกับ statement</p>
          : <div className="flex flex-wrap items-center gap-3 text-sm">
              <p className="font-semibold text-warning">ต่างกัน ฿{fmtMoney(Math.abs(difference))} ({difference > 0 ? "ร้านตัวแทนบอกว่าค้างมากกว่าในระบบ" : "ในระบบค้างมากกว่า statement"})</p>
              <p className="text-muted-foreground">ตรวจว่ายังไม่ได้บันทึกการโอนจ่ายหรือใบลดหนี้ใบไหน ถ้าตรวจแล้วยังต่าง ให้ปรับยอด</p>
              <button type="button" className="ucom-secondary px-4" onClick={() => openEntry("adjustment", { date: statementDate, amount: String(difference), note: `ปรับให้ตรง statement วันที่ ${formatDate(statementDate)}` })}>ปรับยอดส่วนต่าง</button>
            </div>)}
      </section>

      <section className="space-y-2" aria-labelledby="sf-dealer-invoices">
        <div className="flex flex-wrap items-center justify-between gap-2">
          <h3 id="sf-dealer-invoices" className="text-base font-bold">ใบส่งของ</h3>
          <label className="flex min-h-10 items-center gap-2 text-sm text-muted-foreground">
            <input type="checkbox" className="size-5 accent-primary" checked={showSettled} onChange={(e) => setShowSettled(e.target.checked)} />
            แสดงใบที่จ่ายครบแล้ว
          </label>
        </div>
        {shownInvoices.length === 0
          ? <EmptyState title="ไม่มีใบส่งของที่ค้างจ่าย" />
          : <div className="ucom-table-wrap">
              <table className="ucom-table">
                <thead><tr><th>เลขที่</th><th>วันที่รับ</th><th>ครบกำหนด</th><th className="text-right">ยอด</th><th className="text-right">ค้าง</th><th>สถานะ</th></tr></thead>
                <tbody>
                  {shownInvoices.map((i) => (
                    <tr key={i.sf_order_id}>
                      <td>{i.order_no}</td>
                      <td>{formatDate(i.ordered_at)}</td>
                      <td>
                        <div className="flex items-center gap-2">
                          <label className="sr-only" htmlFor={`due-${i.sf_order_id}`}>วันครบกำหนดของ {i.order_no}</label>
                          <input id={`due-${i.sf_order_id}`} type="date" min={i.ordered_at ?? undefined} value={dueDrafts[i.sf_order_id ?? ""] ?? i.due_date ?? ""} onChange={(e) => setDueDrafts((prev) => ({ ...prev, [i.sf_order_id ?? ""]: e.target.value }))} className="ucom-field h-10 px-3 text-sm" />
                          {dueDrafts[i.sf_order_id ?? ""] && dueDrafts[i.sf_order_id ?? ""] !== (i.due_date ?? "") && (
                            <button type="button" onClick={() => void saveDueDate(i.sf_order_id!)} className="ucom-secondary px-4 text-sm">บันทึก</button>
                          )}
                        </div>
                      </td>
                      <td className="text-right tabular-nums">฿{fmtMoney(i.total ?? 0)}</td>
                      <td className="text-right tabular-nums">฿{fmtMoney(i.open_amount ?? 0)}</td>
                      <td>
                        {(i.open_amount ?? 0) === 0
                          ? <span className="rounded-full bg-success-bg px-2.5 py-0.5 text-xs font-semibold text-success">จ่ายครบ</span>
                          : (i.days_overdue ?? 0) > 0
                            ? <span className="rounded-full bg-danger-bg px-2.5 py-0.5 text-xs font-semibold text-danger">เกิน {i.days_overdue} วัน</span>
                            : <span className="rounded-full bg-warning-bg px-2.5 py-0.5 text-xs font-semibold text-warning">{i.due_date ? "ยังไม่ถึงกำหนด" : "ยังไม่ได้ใส่วันครบกำหนด"}</span>}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>}
        <p className="text-sm text-muted-foreground">ยอดลดหนี้และการโอนจ่ายจะถูกนำไปหักใบที่เก่าที่สุดก่อน แบบเดียวกับ statement</p>
      </section>

      <section className="space-y-2" aria-labelledby="sf-dealer-ledger">
        <h3 id="sf-dealer-ledger" className="text-base font-bold">รายการทั้งหมด</h3>
        {ledger.length === 0
          ? <EmptyState title="ยังไม่มีรายการ" />
          : <div className="ucom-table-wrap">
              <table className="ucom-table">
                <thead><tr><th>วันที่</th><th>ประเภท</th><th>เลขเอกสาร</th><th>หมายเหตุ</th><th className="text-right">หนี้เปลี่ยน</th><th className="text-right">คงค้าง</th><th><span className="sr-only">ยกเลิก</span></th></tr></thead>
                <tbody>
                  {ledger.map((row) => (
                    <tr key={`${row.kind}-${row.id}`} className={row.voided_at ? "text-muted-foreground line-through" : undefined}>
                      <td>{formatDate(row.entry_date)}</td>
                      <td>{DEALER_KIND_LABEL[row.kind ?? ""] ?? row.kind}</td>
                      <td>{row.doc_no ?? row.reference ?? ""}</td>
                      <td className="max-w-64">{row.voided_at ? `ยกเลิก: ${row.void_reason}` : row.note ?? ""}</td>
                      <td className={`text-right tabular-nums ${(row.debt_change ?? 0) < 0 ? "text-success" : ""}`}>{(row.debt_change ?? 0) > 0 ? "+" : "−"}฿{fmtMoney(Math.abs(row.debt_change ?? 0))}</td>
                      <td className="text-right tabular-nums">฿{fmtMoney(row.balance ?? 0)}</td>
                      <td>
                        {row.kind !== "invoice" && !row.voided_at && (
                          <button type="button" onClick={() => { setVoidTarget(row); setVoidReason(""); }} className="ucom-danger px-4 text-sm">ยกเลิก</button>
                        )}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>}
      </section>

      {entry && (
        <Modal
          open
          onClose={() => setEntry(null)}
          title={ENTRY_TITLE[entry.kind]}
          footer={<>
            <button type="button" onClick={() => setEntry(null)} className="ucom-secondary min-h-12 px-5">ยกเลิก</button>
            <button type="button" onClick={() => void saveEntry()} disabled={saving} className="ucom-primary min-h-12 px-6 disabled:opacity-40" data-testid="sf-dealer-entry-submit">{saving ? "กำลังบันทึก…" : "บันทึก"}</button>
          </>}
        >
          <div className="grid gap-3 sm:grid-cols-2">
            <label className="block">
              <span className={label}>วันที่</span>
              <input type="date" value={entry.date} max={today} onChange={(e) => setEntry({ ...entry, date: e.target.value })} className={input} />
            </label>
            <label className="block">
              <span className={label}>{entry.kind === "adjustment" ? "ยอดปรับ (+ เพิ่มหนี้ / − ลดหนี้)" : "จำนวนเงิน"}</span>
              <input inputMode="decimal" value={entry.amount} onChange={(e) => setEntry({ ...entry, amount: e.target.value })} className={input} data-testid="sf-dealer-entry-amount" />
            </label>
            {entry.kind !== "adjustment" && (
              <label className="block">
                <span className={label}>{entry.kind === "payment" ? "เลขอ้างอิงการโอน (ไม่บังคับ)" : "เลขที่ใบลดหนี้ เช่น DCN-…"}</span>
                <input value={entry.kind === "payment" ? entry.reference : entry.docNo} onChange={(e) => setEntry(entry.kind === "payment" ? { ...entry, reference: e.target.value } : { ...entry, docNo: e.target.value })} className={input} />
              </label>
            )}
            <label className="block sm:col-span-2">
              <span className={label}>{entry.kind === "adjustment" ? "เหตุผล (บังคับ)" : "หมายเหตุ (ไม่บังคับ)"}</span>
              <input value={entry.note} onChange={(e) => setEntry({ ...entry, note: e.target.value })} className={input} />
            </label>
          </div>
          {entry.kind === "payment" && <p className="ucom-info">บันทึกเฉพาะการโอน ไม่กระทบเงินสดในลิ้นชัก</p>}
          {entry.kind === "credit_other" && <p className="ucom-info">ใบลดหนี้อื่นๆ ลดหนี้อย่างเดียว ยังไม่นับเป็นรายได้ จนกว่าจะรู้ว่าร้านตัวแทนให้มาเพราะอะไร</p>}
          {entryError && <p role="alert" className="rounded-xl bg-danger-bg px-4 py-3 text-sm font-semibold text-danger">{entryError}</p>}
        </Modal>
      )}

      {voidTarget && (
        <Modal
          open
          onClose={() => setVoidTarget(null)}
          title="ยกเลิกรายการ"
          footer={<>
            <button type="button" onClick={() => setVoidTarget(null)} className="ucom-secondary min-h-12 px-5">ไม่ยกเลิก</button>
            <button type="button" onClick={() => void confirmVoid()} disabled={saving || !voidReason.trim()} className="ucom-primary min-h-12 px-6 disabled:opacity-40">ยืนยันยกเลิก</button>
          </>}
        >
          <p className="text-sm">{DEALER_KIND_LABEL[voidTarget.kind ?? ""]} {formatDate(voidTarget.entry_date)} ฿{fmtMoney(Math.abs(voidTarget.debt_change ?? 0))} จะไม่ถูกนับอีก แต่ยังเห็นในรายการ</p>
          <label className="block">
            <span className={label}>เหตุผลที่ยกเลิก</span>
            <input value={voidReason} onChange={(e) => setVoidReason(e.target.value)} className={input} />
          </label>
        </Modal>
      )}
    </div>
  );
}
