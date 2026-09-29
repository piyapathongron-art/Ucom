import { useEffect, useState } from "react";
import { toast } from "sonner";
import { toThaiError } from "@/lib/errors";
import type { LedgerValues } from "@/app/_components/LedgerAddDialog";
import { createClient } from "@/lib/supabase/client";
import { pageRange } from "@/lib/supabase/pagination";
import { todayInBangkok } from "../../(owner)/report/types";
import { readQueue } from "../pos/queue";
import type { Tables } from "@/lib/types/database";
import { closeDay, sendCloseDayDigest } from "./actions";
import { cashToSend } from "./cashToSend";

type BillRow = Tables<"v_close_day_bills">;
type ItemRow = Tables<"v_close_day_items">;
type ExpenseRow = Tables<"v_close_day_expenses">;
type IncomeRow = Tables<"v_close_day_income">;
type ConsignmentPayoutRow = Tables<"v_close_day_consignment_payouts">;
type PartRow = Tables<"v_close_day_parts">;
type ClosingRow = Tables<"day_closings">;

export function useCloseDayData() {
  const supabase = createClient();

  const [date, setDate] = useState(() => todayInBangkok());
  const [isOwner, setIsOwner] = useState(false);
  const [roleResolved, setRoleResolved] = useState(false);

  const [bills, setBills] = useState<BillRow[]>([]);
  const [items, setItems] = useState<ItemRow[]>([]);
  const [expenses, setExpenses] = useState<ExpenseRow[]>([]);
  const [parts, setParts] = useState<PartRow[]>([]);
  const [income, setIncome] = useState<IncomeRow[]>([]);
  const [billSummary, setBillSummary] = useState<Pick<BillRow, "bill_total" | "payment_method">[]>([]);
  const [expenseSummary, setExpenseSummary] = useState<Pick<ExpenseRow, "amount" | "paid_from">[]>([]);
  const [incomeSummary, setIncomeSummary] = useState<Pick<IncomeRow, "amount" | "received_to">[]>([]);
  const [consignmentPayoutSummary, setConsignmentPayoutSummary] = useState<Pick<ConsignmentPayoutRow, "amount" | "paid_from">[]>([]);
  const [partSummary, setPartSummary] = useState<Pick<PartRow, "amount">[]>([]);
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
  const [incomePage, setIncomePage] = useState(1);
  const [incomePageSize, setIncomePageSize] = useState(25);
  const [incomeTotal, setIncomeTotal] = useState(0);
  const [closing, setClosing] = useState<ClosingRow | null>(null);

  const [queuedCount, setQueuedCount] = useState(0);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const [deleteConfirmId, setDeleteConfirmId] = useState<string | null>(null);
  const [incomeDeleteConfirmId, setIncomeDeleteConfirmId] = useState<string | null>(null);

  const [countedCash, setCountedCash] = useState("");
  const [closeNote, setCloseNote] = useState("");
  const [isClosingSuccess, setIsClosingSuccess] = useState(false);
  const [isSending, setIsSending] = useState(false);

  useEffect(() => {
    const requestedDate = new URLSearchParams(window.location.search).get("date");
    if (requestedDate && /^\d{4}-\d{2}-\d{2}$/.test(requestedDate)) {
      Promise.resolve().then(() => setDate(requestedDate));
    }
  }, []);

  const applyDate = (nextDate: string) => {
    setIsLoading(true);
    setError(null);
    setIsClosingSuccess(false);
    setDeleteConfirmId(null);
    setBillPage(1);
    setItemPage(1);
    setExpensePage(1);
    setIncomePage(1);
    setDate(nextDate);
  };

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
      setError("โหลดรายจ่ายไม่สำเร็จ");
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

  const fetchIncomeOnly = async () => {
    const { from, to } = pageRange(incomePage, incomePageSize);
    const [pageResult, summaryResult] = await Promise.all([
      supabase
        .from("v_close_day_income")
        .select("*", { count: "exact" })
        .eq("day", date)
        .order("id", { ascending: false })
        .range(from, to),
      supabase.from("v_close_day_income").select("amount, received_to").eq("day", date),
    ]);
    if (pageResult.error || summaryResult.error) {
      setError("โหลดรายรับนอกบิลไม่สำเร็จ");
      return;
    }
    const nextIncome = pageResult.data ?? [];
    const nextTotal = pageResult.count ?? nextIncome.length;
    if (nextIncome.length === 0 && nextTotal > 0 && incomePage > 1) {
      setIncomePage((current) => Math.max(1, current - 1));
    } else {
      setIncome(nextIncome);
    }
    setIncomeTotal(nextTotal);
    setIncomeSummary(summaryResult.data ?? []);
  };

  const fetchData = async (targetDate: string, isStale: () => boolean) => {
    const billRange = pageRange(billPage, billPageSize);
    const itemRange = pageRange(itemPage, itemPageSize);
    const expenseRange = pageRange(expensePage, expensePageSize);
    const incomeRange = pageRange(incomePage, incomePageSize);
    const [rBills, rBillSummary, rItems, rExp, rExpSummary, rIncome, rIncomeSummary, rPayouts, rParts, rSf, rClosing] = await Promise.all([
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
      supabase
        .from("v_close_day_income")
        .select("*", { count: "exact" })
        .eq("day", targetDate)
        .order("id", { ascending: false })
        .range(incomeRange.from, incomeRange.to),
      supabase.from("v_close_day_income").select("amount, received_to").eq("day", targetDate),
      supabase.from("v_close_day_consignment_payouts").select("amount, paid_from").eq("day", targetDate),
      supabase.from("v_close_day_parts").select("*").eq("day", targetDate).order("amount", { ascending: false }),
      supabase.from("v_close_day_sf").select("imei", { count: "exact", head: true }).eq("day", targetDate),
      supabase.from("day_closings").select("*").eq("closing_date", targetDate).maybeSingle(),
    ]);
    if (isStale()) return;
    const firstError = [rBills, rBillSummary, rItems, rExp, rExpSummary, rIncome, rIncomeSummary, rPayouts, rParts, rSf, rClosing].find((result) => result.error)?.error;
    if (firstError) {
      setError(toThaiError(firstError));
      setIsLoading(false);
      return;
    }
    setError(null);
    const nextBills = rBills.data || [];
    const nextItems = rItems.data || [];
    const nextExpenses = rExp.data || [];
    const nextIncome = rIncome.data || [];
    const nextBillTotal = rBills.count ?? nextBills.length;
    const nextItemTotal = rItems.count ?? nextItems.length;
    const nextExpenseTotal = rExp.count ?? nextExpenses.length;
    const nextIncomeTotal = rIncome.count ?? nextIncome.length;
    if (nextBills.length === 0 && nextBillTotal > 0 && billPage > 1) setBillPage((current) => Math.max(1, current - 1));
    else setBills(nextBills);
    if (nextItems.length === 0 && nextItemTotal > 0 && itemPage > 1) setItemPage((current) => Math.max(1, current - 1));
    else setItems(nextItems);
    if (nextExpenses.length === 0 && nextExpenseTotal > 0 && expensePage > 1) setExpensePage((current) => Math.max(1, current - 1));
    else setExpenses(nextExpenses);
    if (nextIncome.length === 0 && nextIncomeTotal > 0 && incomePage > 1) setIncomePage((current) => Math.max(1, current - 1));
    else setIncome(nextIncome);
    setBillTotal(nextBillTotal);
    setItemTotal(nextItemTotal);
    setExpenseTotal(nextExpenseTotal);
    setIncomeTotal(nextIncomeTotal);
    setBillSummary(rBillSummary.data || []);
    setExpenseSummary(rExpSummary.data || []);
    setIncomeSummary(rIncomeSummary.data || []);
    setConsignmentPayoutSummary(rPayouts.data || []);
    setParts(rParts.data || []);
    setPartSummary(rParts.data || []);
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
  }, [date, billPage, billPageSize, itemPage, itemPageSize, expensePage, expensePageSize, incomePage, incomePageSize]);

  // Each write toasts a Thai message; add handlers resolve true on success so the dialog can close.
  async function write(call: PromiseLike<{ error: unknown }>, successMessage: string, refresh: () => Promise<void>) {
    try {
      const { error: rpcErr } = await call;
      if (rpcErr) throw rpcErr;
    } catch (err) {
      toast.error(toThaiError(err), { duration: Infinity });
      return false;
    }
    toast.success(successMessage);
    await refresh();
    return true;
  }

  const handleAddExpense = (v: LedgerValues) =>
    write(supabase.rpc("rpc_add_shop_expense", { p_name: v.name, p_amount: v.amount, p_paid_from: v.method }), "บันทึกรายจ่ายแล้ว", fetchExpensesOnly);

  const handleAddIncome = (v: LedgerValues) =>
    write(supabase.rpc("rpc_add_shop_income", { p_name: v.name, p_amount: v.amount, p_received_to: v.method }), "บันทึกรายรับแล้ว", fetchIncomeOnly);

  const handleDeleteExpense = async (id: string) => {
    if (await write(supabase.rpc("rpc_delete_shop_expense", { p_id: id }), "ลบรายจ่ายแล้ว", fetchExpensesOnly)) setDeleteConfirmId(null);
  };

  const handleDeleteIncome = async (id: string) => {
    if (await write(supabase.rpc("rpc_delete_shop_income", { p_id: id }), "ลบรายรับแล้ว", fetchIncomeOnly)) setIncomeDeleteConfirmId(null);
  };

  const handleCloseDay = async () => {
    const cashNum = parseFloat(countedCash);
    if (isNaN(cashNum) || cashNum < 0) return false;
    try {
      const result = await closeDay(cashNum, closeNote);
      if (!result.closed) {
        toast.error("ปิดร้านไม่สำเร็จ กรุณาลองใหม่", { duration: Infinity });
        return false;
      }
      setIsClosingSuccess(true);
      await fetchData(date, () => false);
      if (result.lineSent) toast.success("ปิดร้านและส่งสรุปเข้า LINE แล้ว");
      else toast.warning("ปิดร้านแล้ว แต่ส่งสรุปเข้า LINE ไม่สำเร็จ กรุณากดส่งซ้ำ");
      return true;
    } catch {
      toast.error("ตรวจสอบสถานะการปิดร้านไม่สำเร็จ กรุณาโหลดหน้านี้ใหม่", { duration: Infinity });
      return false;
    }
  };

  const handleResend = async () => {
    if (isSending || !closing) return;
    setIsSending(true);
    try {
      if (await sendCloseDayDigest(date)) toast.success("ส่งสรุปเข้า LINE แล้ว");
      else toast.error("ส่งสรุปเข้า LINE ไม่สำเร็จ กรุณาลองใหม่", { duration: Infinity });
    } catch {
      toast.error("ส่งสรุปเข้า LINE ไม่สำเร็จ กรุณาลองใหม่", { duration: Infinity });
    } finally {
      setIsSending(false);
    }
  };

  const fmt = (n: number) => n.toLocaleString("th-TH", { minimumFractionDigits: 2, maximumFractionDigits: 2 });

  const cashTotal = billSummary.filter(b => b.payment_method === "cash").reduce((s, b) => s + Number(b.bill_total), 0);
  const transferTotal = billSummary.filter(b => b.payment_method === "transfer").reduce((s, b) => s + Number(b.bill_total), 0);
  const cashExpenseTotal = expenseSummary.filter(e => e.paid_from === "cash").reduce((s, e) => s + Number(e.amount), 0);
  const cashIncomeTotal = incomeSummary.filter(i => i.received_to === "cash").reduce((s, i) => s + Number(i.amount), 0);
  const cashConsignmentPayoutTotal = consignmentPayoutSummary.filter(p => p.paid_from === "cash").reduce((s, p) => s + Number(p.amount), 0);
  const cashPartTotal = partSummary.reduce((s, p) => s + Number(p.amount), 0);
  const toSend = cashToSend({ cashBills: cashTotal, cashIncome: cashIncomeTotal, cashExpenses: cashExpenseTotal, cashConsignmentPayouts: cashConsignmentPayoutTotal, cashParts: cashPartTotal });

  const isToday = date === todayInBangkok();

  return {
    date, applyDate, isOwner, roleResolved,
    bills, items, expenses, income, parts,
    sfCount, closing,
    billPage, billPageSize, billTotal, setBillPage,
    setBillPageSize: (v: number) => { setBillPageSize(v); setBillPage(1); },
    itemPage, itemPageSize, itemTotal, setItemPage,
    setItemPageSize: (v: number) => { setItemPageSize(v); setItemPage(1); },
    expensePage, expensePageSize, expenseTotal, setExpensePage,
    setExpensePageSize: (v: number) => { setExpensePageSize(v); setExpensePage(1); },
    incomePage, incomePageSize, incomeTotal, setIncomePage,
    setIncomePageSize: (v: number) => { setIncomePageSize(v); setIncomePage(1); },
    queuedCount, isLoading, error, setIsLoading,
    deleteConfirmId, setDeleteConfirmId, incomeDeleteConfirmId, setIncomeDeleteConfirmId,
    countedCash, setCountedCash, closeNote, setCloseNote, isClosingSuccess,
    handleAddExpense, handleDeleteExpense, handleAddIncome, handleDeleteIncome, handleCloseDay, handleResend, isSending,
    fmt, cashTotal, transferTotal, cashExpenseTotal, cashIncomeTotal, cashConsignmentPayoutTotal, cashPartTotal, toSend, isToday,
    refetch: () => fetchData(date, () => false),
  };
}
