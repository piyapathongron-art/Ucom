"use client";

import { useEffect, useState } from "react";
import { createClient } from "@/lib/supabase/client";
import { PageFrame } from "@/app/_components/PageFrame";
import { pageRange } from "@/lib/supabase/pagination";
import { todayInBangkok } from "../../(owner)/report/types";
import { readQueue } from "../pos/queue";
import type { Tables } from "@/lib/types/database";
import BillsSection from "./BillsSection";
import ItemsSection from "./ItemsSection";
import ExpensesSection from "./ExpensesSection";

type BillRow = Tables<"v_close_day_bills">;
type ItemRow = Tables<"v_close_day_items">;
type ExpenseRow = Tables<"v_close_day_expenses">;
type ClosingRow = Tables<"day_closings">;

export default function CloseDayPage() {
  const supabase = createClient();

  const [date, setDate] = useState(() => todayInBangkok());
  const applyDate = (nextDate: string) => {
    setIsLoading(true);
    setError(null);
    setIsClosingSuccess(false);
    setDeleteConfirmId(null);
    setBillPage(1);
    setItemPage(1);
    setExpensePage(1);
    setDate(nextDate);
  };
  const [isOwner, setIsOwner] = useState(false);
  const [roleResolved, setRoleResolved] = useState(false);

  const [bills, setBills] = useState<BillRow[]>([]);
  const [items, setItems] = useState<ItemRow[]>([]);
  const [expenses, setExpenses] = useState<ExpenseRow[]>([]);
  const [billSummary, setBillSummary] = useState<Pick<BillRow, "bill_total" | "payment_method">[]>([]);
  const [expenseSummary, setExpenseSummary] = useState<Pick<ExpenseRow, "amount" | "paid_from">[]>([]);
  const [sfCount, setSfCount] = useState(0);
  const [billPage, setBillPage] = useState(1);
  const [billPageSize, setBillPageSize] = useState(25);
  const [billTotal, setBillTotal] = useState(0);
  const [itemPage, setItemPage] = useState(1);
  const [itemPageSize, setItemPageSize] = useState(25);
  const [itemTotal, setItemTotal] = useState(0);
  const [expensePage, setExpensePage] = useState(1);
  const [expensePageSize, setExpensePageSize] = useState(25);
  const [expenseTotal, setExpenseTotal] = useState(0);
  const [closing, setClosing] = useState<ClosingRow | null>(null);
  
  const [queuedCount, setQueuedCount] = useState(0);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  
  const [expenseName, setExpenseName] = useState("");
  const [expenseAmount, setExpenseAmount] = useState("");
  const [expensePaidFrom, setExpensePaidFrom] = useState<"cash" | "transfer">("cash");
  const [deleteConfirmId, setDeleteConfirmId] = useState<string | null>(null);

  const [countedCash, setCountedCash] = useState("");
  const [closeNote, setCloseNote] = useState("");
  const [isClosingSuccess, setIsClosingSuccess] = useState(false);

  useEffect(() => {
    supabase.auth.getUser().then(({ data: { user } }) => {
      if (user) {
        supabase.from("profiles").select("role").eq("id", user.id).single().then(({ data }) => {
          setIsOwner(data?.role === "owner");
          setRoleResolved(true);
        });
      } else {
        setRoleResolved(true);
      }
    });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const fetchExpensesOnly = async () => {
    const { from, to } = pageRange(expensePage, expensePageSize);
    const [pageResult, summaryResult] = await Promise.all([
      supabase
        .from("v_close_day_expenses")
        .select("*", { count: "exact" })
        .eq("day", date)
        .order("id", { ascending: false })
        .range(from, to),
      supabase.from("v_close_day_expenses").select("amount, paid_from").eq("day", date),
    ]);
    if (pageResult.error || summaryResult.error) {
      setError(pageResult.error?.message ?? summaryResult.error?.message ?? "โหลดรายจ่ายไม่สำเร็จ");
      return;
    }
    const nextExpenses = pageResult.data ?? [];
    const nextTotal = pageResult.count ?? nextExpenses.length;
    if (nextExpenses.length === 0 && nextTotal > 0 && expensePage > 1) {
      setExpensePage((current) => Math.max(1, current - 1));
    } else {
      setExpenses(nextExpenses);
    }
    setExpenseTotal(nextTotal);
    setExpenseSummary(summaryResult.data ?? []);
  };

  const fetchData = async (targetDate: string, isStale: () => boolean) => {
    const billRange = pageRange(billPage, billPageSize);
    const itemRange = pageRange(itemPage, itemPageSize);
    const expenseRange = pageRange(expensePage, expensePageSize);
    const [rBills, rBillSummary, rItems, rExp, rExpSummary, rSf, rClosing] = await Promise.all([
      supabase
        .from("v_close_day_bills")
        .select("*", { count: "exact" })
        .eq("day", targetDate)
        .order("sold_at", { ascending: false })
        .order("sale_id", { ascending: false })
        .range(billRange.from, billRange.to),
      supabase.from("v_close_day_bills").select("bill_total, payment_method").eq("day", targetDate),
      supabase
        .from("v_close_day_items")
        .select("*", { count: "exact" })
        .eq("day", targetDate)
        .order("revenue", { ascending: false })
        .order("name_snapshot", { ascending: true })
        .order("kind", { ascending: true })
        .range(itemRange.from, itemRange.to),
      supabase
        .from("v_close_day_expenses")
        .select("*", { count: "exact" })
        .eq("day", targetDate)
        .order("id", { ascending: false })
        .range(expenseRange.from, expenseRange.to),
      supabase.from("v_close_day_expenses").select("amount, paid_from").eq("day", targetDate),
      supabase.from("v_close_day_sf").select("imei", { count: "exact", head: true }).eq("day", targetDate),
      supabase.from("day_closings").select("*").eq("closing_date", targetDate).maybeSingle(),
    ]);
    if (isStale()) return;
    const firstError = [rBills, rBillSummary, rItems, rExp, rExpSummary, rSf, rClosing].find((result) => result.error)?.error;
    if (firstError) {
      setError(firstError.message);
      setIsLoading(false);
      return;
    }
    setError(null);
    const nextBills = rBills.data || [];
    const nextItems = rItems.data || [];
    const nextExpenses = rExp.data || [];
    const nextBillTotal = rBills.count ?? nextBills.length;
    const nextItemTotal = rItems.count ?? nextItems.length;
    const nextExpenseTotal = rExp.count ?? nextExpenses.length;
    if (nextBills.length === 0 && nextBillTotal > 0 && billPage > 1) setBillPage((current) => Math.max(1, current - 1));
    else setBills(nextBills);
    if (nextItems.length === 0 && nextItemTotal > 0 && itemPage > 1) setItemPage((current) => Math.max(1, current - 1));
    else setItems(nextItems);
    if (nextExpenses.length === 0 && nextExpenseTotal > 0 && expensePage > 1) setExpensePage((current) => Math.max(1, current - 1));
    else setExpenses(nextExpenses);
    setBillTotal(nextBillTotal);
    setItemTotal(nextItemTotal);
    setExpenseTotal(nextExpenseTotal);
    setBillSummary(rBillSummary.data || []);
    setExpenseSummary(rExpSummary.data || []);
    setSfCount(rSf.count ?? 0);
    setClosing(rClosing.data || null);

    if (targetDate === todayInBangkok()) setQueuedCount(readQueue().length);
    else setQueuedCount(0);
    setIsLoading(false);
  };

  useEffect(() => {
    let stale = false;
    Promise.resolve().then(() => {
      if (stale) return;
      setIsLoading(true);
      return fetchData(date, () => stale);
    });
    return () => { stale = true; };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [date, billPage, billPageSize, itemPage, itemPageSize, expensePage, expensePageSize]);

  const handleAddExpense = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    const amountNum = parseFloat(expenseAmount);
    if (!expenseName.trim() || isNaN(amountNum) || amountNum <= 0) return;
    try {
      const { error: rpcErr } = await supabase.rpc("rpc_add_shop_expense", {
        p_name: expenseName.trim(),
        p_amount: amountNum,
        p_paid_from: expensePaidFrom
      });
      if (rpcErr) return setError(rpcErr.message);
      setExpenseName("");
      setExpenseAmount("");
      await fetchExpensesOnly();
    } catch (err) {
      setError(err instanceof Error ? err.message : "บันทึกรายจ่ายไม่สำเร็จ");
    }
  };

  const handleDeleteExpense = async (id: string) => {
    setError(null);
    try {
      const { error: rpcErr } = await supabase.rpc("rpc_delete_shop_expense", { p_id: id });
      if (rpcErr) return setError(rpcErr.message);
      setDeleteConfirmId(null);
      await fetchExpensesOnly();
    } catch (err) {
      setError(err instanceof Error ? err.message : "ลบรายจ่ายไม่สำเร็จ");
    }
  };

  const handleCloseDay = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    const cashNum = parseFloat(countedCash);
    if (isNaN(cashNum) || cashNum < 0) return;
    try {
      const { error: rpcErr } = await supabase.rpc("rpc_close_day", {
        p_counted_cash: cashNum,
        p_note: (closeNote.trim() || null) as unknown as string
      });
      if (rpcErr) return setError(rpcErr.message);
      setIsClosingSuccess(true);
      const { data } = await supabase.from("day_closings").select("*").eq("closing_date", date).maybeSingle();
      if (data) setClosing(data);
    } catch (err) {
      setError(err instanceof Error ? err.message : "ปิดร้านไม่สำเร็จ");
    }
  };

  const fmt = (n: number) => n.toLocaleString("th-TH", { minimumFractionDigits: 2, maximumFractionDigits: 2 });
  
  const cashTotal = billSummary.filter(b => b.payment_method === "cash").reduce((s, b) => s + Number(b.bill_total), 0);
  const transferTotal = billSummary.filter(b => b.payment_method === "transfer").reduce((s, b) => s + Number(b.bill_total), 0);
  const cashExpenseTotal = expenseSummary.filter(e => e.paid_from === "cash").reduce((s, e) => s + Number(e.amount), 0);
  const toSend = cashTotal - cashExpenseTotal;

  const isToday = date === todayInBangkok();

  return (
    <PageFrame
      page="close-day"
      eyebrow="CASH HANDOVER / DAILY LEDGER"
      title="ปิดร้าน / สรุปรายวัน"
      description={isToday ? "ตรวจยอดเงินสดและส่งมอบก่อนปิดวัน" : "ดูประวัติการปิดวันแบบอ่านอย่างเดียว"}
      dataLoading={isLoading}
      actions={
        isOwner && roleResolved ? (
          <label className="flex items-center gap-2 text-sm text-ink-muted">
            <span>วันที่</span>
            <input
              type="date"
              value={date}
              onChange={e => applyDate(e.target.value)}
              className="ucom-field px-3 py-1.5 text-sm"
            />
          </label>
        ) : (
          <span className="font-mono text-xs tracking-wide text-ink-muted">TODAY / STAFF</span>
        )
      }
    >

      {error && (
        <div data-testid="close-day-error" className="flex flex-wrap items-center justify-between gap-3 rounded border border-danger bg-danger/10 p-4 text-sm text-danger">
          <span>{error}</span>
          <button
            type="button"
            onClick={() => {
              setIsLoading(true);
              void fetchData(date, () => false);
            }}
            className="ucom-danger px-3 py-1.5 text-sm"
          >
            ลองใหม่
          </button>
        </div>
      )}

      {queuedCount > 0 && isToday && (
        <div data-testid="close-day-queue-warning" className="rounded border border-warning bg-warning/10 p-4 text-sm text-warning">
          ยังมีบิลค้างในคิว {queuedCount} ใบ ยอดยังไม่ครบ กรุณาซิงก์ก่อนปิดร้าน
        </div>
      )}

      {isLoading ? (
        <div className="text-ink-muted">กำลังโหลด...</div>
      ) : (
        <>
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
            <div className="ucom-surface p-4">
              <p className="text-sm text-ink-muted">เงินสด</p>
              <p data-testid="close-day-cash-total" className="text-xl font-semibold font-mono tabular-nums mt-1">{fmt(cashTotal)}</p>
            </div>
            <div className="ucom-surface p-4">
              <p className="text-sm text-ink-muted">เงินโอน</p>
              <p data-testid="close-day-transfer-total" className="text-xl font-semibold font-mono tabular-nums mt-1">{fmt(transferTotal)}</p>
            </div>
            <div className="ucom-surface p-4">
              <p className="text-sm text-ink-muted">รายจ่าย (เงินสด)</p>
              <p data-testid="close-day-expense-total" className="text-xl font-semibold font-mono tabular-nums mt-1">{fmt(cashExpenseTotal)}</p>
            </div>
            <div className="ucom-surface bg-background p-4">
              <p className="text-sm font-medium text-ink">ยอดที่ต้องส่ง</p>
              <p data-testid="close-day-to-send" className="text-2xl font-bold font-mono tabular-nums mt-1 text-ink">{fmt(toSend)}</p>
            </div>
          </div>

          {sfCount > 0 && (
            <div className="text-ink font-medium">ปล่อย SF+ วันนี้ {sfCount} เครื่อง</div>
          )}

          <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
            <BillsSection
              bills={bills}
              fmt={fmt}
              page={billPage}
              pageSize={billPageSize}
              total={billTotal}
              isLoading={isLoading}
              onPageChange={setBillPage}
              onPageSizeChange={(value) => {
                setBillPageSize(value);
                setBillPage(1);
              }}
            />
            <ItemsSection
              items={items}
              fmt={fmt}
              page={itemPage}
              pageSize={itemPageSize}
              total={itemTotal}
              isLoading={isLoading}
              onPageChange={setItemPage}
              onPageSizeChange={(value) => {
                setItemPageSize(value);
                setItemPage(1);
              }}
            />
          </div>

          <ExpensesSection
            expenses={expenses}
            isToday={isToday}
            deleteConfirmId={deleteConfirmId}
            onSetDeleteConfirmId={setDeleteConfirmId}
            onAddExpense={handleAddExpense}
            onDeleteExpense={handleDeleteExpense}
            expenseName={expenseName}
            onExpenseNameChange={setExpenseName}
            expenseAmount={expenseAmount}
            onExpenseAmountChange={setExpenseAmount}
            expensePaidFrom={expensePaidFrom}
            onExpensePaidFromChange={setExpensePaidFrom}
            fmt={fmt}
            page={expensePage}
            pageSize={expensePageSize}
            total={expenseTotal}
            isLoading={isLoading}
            onPageChange={setExpensePage}
            onPageSizeChange={(value) => {
              setExpensePageSize(value);
              setExpensePage(1);
            }}
          />

          <hr className="border-border" />

          <section className="max-w-xl">
            <h2 className="text-xl font-semibold mb-4">สถานะการปิดร้าน</h2>
            {isToday ? (
              isClosingSuccess && !closing ? (
                 <div className="rounded border border-success bg-success/10 p-4 text-success font-medium">ปิดร้านสำเร็จ</div>
              ) : (
                <div className="ucom-surface space-y-4 bg-background p-6">
                  {closing && (
                    <div className="text-sm text-ink font-medium">
                      ปิดล่าสุดเวลา {closing.closed_at ? new Date(closing.closed_at || "").toLocaleTimeString("th-TH", { timeZone: "Asia/Bangkok", hour: "2-digit", minute: "2-digit" }) : ""} — นับได้ {fmt(Number(closing.counted_cash))} บาท
                    </div>
                  )}
                  <form onSubmit={handleCloseDay} className="space-y-4">
                    <div>
                      <label className="block text-sm font-medium text-ink-muted mb-1">เงินสดที่นับได้จริง</label>
                      <input type="number" required min="0" step="any" data-testid="close-day-counted-cash" value={countedCash} onChange={e => setCountedCash(e.target.value)} className="ucom-field w-full px-3 py-2 text-sm" placeholder="0.00" />
                      {countedCash && !isNaN(parseFloat(countedCash)) && (
                        <div className={`text-sm mt-1 font-medium ${(parseFloat(countedCash) - toSend) === 0 ? "text-success" : (parseFloat(countedCash) - toSend) > 0 ? "text-ink" : "text-danger"}`}>
                          ส่วนต่าง: {(parseFloat(countedCash) - toSend) === 0 ? "ตรงพอดี" : (parseFloat(countedCash) - toSend) > 0 ? `เกิน ${fmt(parseFloat(countedCash) - toSend)} บาท` : `ขาด ${fmt(toSend - parseFloat(countedCash))} บาท`}
                        </div>
                      )}
                    </div>
                    <div>
                      <label className="block text-sm font-medium text-ink-muted mb-1">หมายเหตุ (ถ้ามี)</label>
                      <textarea data-testid="close-day-note" value={closeNote} onChange={e => setCloseNote(e.target.value)} className="ucom-field w-full px-3 py-2 text-sm" rows={2} />
                    </div>
                    <button type="submit" disabled={queuedCount > 0} data-testid="close-day-confirm" className="ucom-primary w-full px-4 py-2 text-sm disabled:cursor-not-allowed disabled:opacity-50">
                      ยืนยันปิดร้าน
                    </button>
                  </form>
                </div>
              )
            ) : (
              <div className="ucom-surface bg-background p-6 text-center text-ink-muted">
                {closing ? (
                  <span>ปิดเมื่อ {closing.closed_at ? new Date(closing.closed_at || "").toLocaleTimeString("th-TH", { timeZone: "Asia/Bangkok", hour: "2-digit", minute: "2-digit" }) : ""} — เงินสดที่นับได้ {fmt(Number(closing.counted_cash))} บาท</span>
                ) : (
                  <span>ยังไม่ได้ปิดวันนี้</span>
                )}
              </div>
            )}
          </section>
        </>
      )}
    </PageFrame>
  );
}
