"use client";

import { useDeferredValue, useEffect, useRef, useState } from "react";
import { createClient } from "@/lib/supabase/client";
import { escapedSearchTerm, pageRange } from "@/lib/supabase/pagination";
import { todayInBangkok } from "../report/types";
import type { Tables } from "@/lib/types/database";

export type ExpenseRow = Tables<"expenses">;
export type WalletBalanceRow = Tables<"v_topup_wallet_balance">;
export type CarrierRow = Tables<"topup_carriers">;

export function useExpensesPage() {
  const supabase = createClient();

  // Expense form state
  const [expenseName, setExpenseName] = useState("");
  const [expenseAmount, setExpenseAmount] = useState("");
  const [expenseDate, setExpenseDate] = useState(() => todayInBangkok());

  // Expense list state
  const [expenses, setExpenses] = useState<ExpenseRow[]>([]);
  const firstDayOfMonth = todayInBangkok().slice(0, 7) + "-01";
  const today = todayInBangkok();
  const [filterFrom, setFilterFrom] = useState(firstDayOfMonth);
  const [filterTo, setFilterTo] = useState(today);
  const [expenseSearch, setExpenseSearch] = useState("");
  const deferredExpenseSearch = useDeferredValue(expenseSearch);
  const [expensePage, setExpensePage] = useState(1);
  const [expensePageSize, setExpensePageSize] = useState(25);
  const [expenseTotalCount, setExpenseTotalCount] = useState(0);
  const [totalExpense, setTotalExpense] = useState(0);
  const [isExpensesLoading, setIsExpensesLoading] = useState(true);
  const expensesRequestRef = useRef(0);

  // Wallet state
  const [walletBalances, setWalletBalances] = useState<WalletBalanceRow[]>([]);
  const [carriers, setCarriers] = useState<CarrierRow[]>([]);
  const [selectedCarrier, setSelectedCarrier] = useState("");
  const [topupAmount, setTopupAmount] = useState("");

  // UI state
  const [error, setError] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [deleteConfirmId, setDeleteConfirmId] = useState<string | null>(null);

  const fetchExpenses = async () => {
    const requestId = ++expensesRequestRef.current;
    setIsExpensesLoading(true);
    try {
      const { from, to } = pageRange(expensePage, expensePageSize);
      const expenseSearchTerm = escapedSearchTerm(deferredExpenseSearch);
      let pageQuery = supabase
        .from("expenses")
        .select("*", { count: "exact" })
        .gte("spent_at", filterFrom)
        .lte("spent_at", filterTo);
      if (expenseSearchTerm) {
        pageQuery = pageQuery.ilike("name", `%${expenseSearchTerm}%`);
      }
      let totalQuery = supabase
        .from("expenses")
        .select("amount")
        .gte("spent_at", filterFrom)
        .lte("spent_at", filterTo);
      if (expenseSearchTerm) {
        totalQuery = totalQuery.ilike("name", `%${expenseSearchTerm}%`);
      }
      const [pageResult, totalResult] = await Promise.all([
        pageQuery
          .order("spent_at", { ascending: false })
          .order("created_at", { ascending: false })
          .order("id", { ascending: false })
          .range(from, to),
        totalQuery,
      ]);
      if (pageResult.error) throw pageResult.error;
      if (totalResult.error) throw totalResult.error;
      if (requestId !== expensesRequestRef.current) return;
      const nextExpenses = pageResult.data ?? [];
      const nextCount = pageResult.count ?? nextExpenses.length;
      if (nextExpenses.length === 0 && nextCount > 0 && expensePage > 1) {
        setExpensePage((current) => Math.max(1, current - 1));
      } else {
        setExpenses(nextExpenses);
      }
      setExpenseTotalCount(nextCount);
      // No aggregate RPC/view exists in the current contract. Fetch only the amount
      // column for the selected range so the footer stays a whole-range total without
      // loading every expense row into the table.
      setTotalExpense(
        (totalResult.data ?? []).reduce((sum, row) => sum + (Number(row.amount) || 0), 0),
      );
      setError(null);
    } catch (err) {
      if (requestId !== expensesRequestRef.current) return;
      console.error(err);
      setError("โหลดรายการรายจ่ายไม่สำเร็จ");
      setExpenses([]);
      setExpenseTotalCount(0);
      setTotalExpense(0);
    } finally {
      if (requestId === expensesRequestRef.current) setIsExpensesLoading(false);
    }
  };

  const fetchWallet = (isStaleCheck?: () => boolean) => {
    const fetchBalance = supabase
      .from("v_topup_wallet_balance")
      .select("*")
      .then(
        ({ data, error: fetchErr }) => {
          if (isStaleCheck && isStaleCheck()) return;
          if (fetchErr) {
            console.error(fetchErr);
            setError("โหลดข้อมูลวอลเล็ตไม่สำเร็จ");
            setWalletBalances([]);
          } else {
            setWalletBalances(data ?? []);
          }
        },
        (err) => {
          if (isStaleCheck && isStaleCheck()) return;
          console.error(err);
          setError("โหลดข้อมูลวอลเล็ตไม่สำเร็จ");
          setWalletBalances([]);
        }
      );

    const fetchCarriersList = supabase
      .from("topup_carriers")
      .select("*")
      .eq("is_active", true)
      .then(
        ({ data, error: fetchErr }) => {
          if (isStaleCheck && isStaleCheck()) return;
          if (fetchErr) {
            console.error(fetchErr);
            setError("โหลดข้อมูลผู้ให้บริการไม่สำเร็จ");
            setCarriers([]);
          } else {
            const list = data ?? [];
            setCarriers(list);
            if (list.length > 0 && !selectedCarrier) {
              setSelectedCarrier(list[0].id);
            }
          }
        },
        (err) => {
          if (isStaleCheck && isStaleCheck()) return;
          console.error(err);
          setError("โหลดข้อมูลผู้ให้บริการไม่สำเร็จ");
          setCarriers([]);
        }
      );

    return Promise.all([fetchBalance, fetchCarriersList]);
  };

  const retry = () => {
    setIsLoading(true);
    void Promise.all([fetchExpenses(), fetchWallet()]).finally(() => setIsLoading(false));
  };

  useEffect(() => {
    let isStale = false;
    const checkStale = () => isStale;

    Promise.resolve().then(() => Promise.all([fetchExpenses(), fetchWallet(checkStale)])).then(
      () => {
        if (!isStale) setIsLoading(false);
      },
      () => {
        if (!isStale) setIsLoading(false);
      }
    );

    return () => {
      isStale = true;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [expensePage, expensePageSize, filterFrom, filterTo, deferredExpenseSearch]);

  const handleAddExpense = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    const amountNum = parseFloat(expenseAmount);
    if (!expenseName.trim() || isNaN(amountNum) || amountNum <= 0 || !expenseDate) {
      return;
    }

    try {
      const {
        data: { user },
      } = await supabase.auth.getUser();

      const { error: insertErr } = await supabase.from("expenses").insert({
        name: expenseName.trim(),
        amount: amountNum,
        spent_at: expenseDate,
        created_by: user?.id,
      });

      if (insertErr) {
        console.error(insertErr);
        setError("บันทึกรายจ่ายไม่สำเร็จ");
        return;
      }

      setExpenseName("");
      setExpenseAmount("");
      setExpenseDate(todayInBangkok());

      await fetchExpenses();
    } catch (err) {
      console.error(err);
      setError("บันทึกรายจ่ายไม่สำเร็จ");
    }
  };

  const handleDeleteExpense = async (id: string) => {
    setError(null);
    try {
      const { error: delErr } = await supabase.from("expenses").delete().eq("id", id);
      if (delErr) {
        console.error(delErr);
        setError("ลบรายจ่ายไม่สำเร็จ");
        return;
      }
      setDeleteConfirmId(null);
      await fetchExpenses();
    } catch (err) {
      console.error(err);
      setError("ลบรายจ่ายไม่สำเร็จ");
    }
  };

  const handleAddTopup = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    const amountNum = parseFloat(topupAmount);
    if (!selectedCarrier || isNaN(amountNum) || amountNum <= 0) {
      return;
    }

    try {
      const { error: insertErr } = await supabase.from("topup_wallet_entries").insert({
        carrier_id: selectedCarrier,
        amount: amountNum,
        occurred_at: new Date().toISOString(),
      });

      if (insertErr) {
        console.error(insertErr);
        setError("บันทึกการเติมเงินไม่สำเร็จ");
        return;
      }

      setTopupAmount("");
      await fetchWallet();
    } catch (err) {
      console.error(err);
      setError("บันทึกการเติมเงินไม่สำเร็จ");
    }
  };

  return {
    expenseName,
    setExpenseName,
    expenseAmount,
    setExpenseAmount,
    expenseDate,
    setExpenseDate,
    expenses,
    filterFrom,
    setFilterFrom,
    filterTo,
    setFilterTo,
    expenseSearch,
    setExpenseSearch,
    expensePage,
    setExpensePage,
    expensePageSize,
    setExpensePageSize,
    expenseTotalCount,
    isExpensesLoading,
    walletBalances,
    carriers,
    selectedCarrier,
    setSelectedCarrier,
    topupAmount,
    setTopupAmount,
    error,
    isLoading,
    deleteConfirmId,
    setDeleteConfirmId,
    handleAddExpense,
    handleDeleteExpense,
    handleAddTopup,
    totalExpense,
    retry,
  };
}
