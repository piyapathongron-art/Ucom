"use client";

import { useEffect, useState } from "react";
import { createClient } from "@/lib/supabase/client";
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

  // Wallet state
  const [walletBalances, setWalletBalances] = useState<WalletBalanceRow[]>([]);
  const [carriers, setCarriers] = useState<CarrierRow[]>([]);
  const [selectedCarrier, setSelectedCarrier] = useState("");
  const [topupAmount, setTopupAmount] = useState("");

  // UI state
  const [error, setError] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [deleteConfirmId, setDeleteConfirmId] = useState<string | null>(null);

  // Month bounds for fetching expenses
  const firstDayOfMonth = todayInBangkok().slice(0, 7) + "-01";
  const today = todayInBangkok();

  const fetchExpenses = (isStaleCheck?: () => boolean) => {
    return supabase
      .from("expenses")
      .select("*")
      .gte("spent_at", firstDayOfMonth)
      .lte("spent_at", today)
      .order("spent_at", { ascending: false })
      .order("created_at", { ascending: false })
      .then(
        ({ data, error: fetchErr }) => {
          if (isStaleCheck && isStaleCheck()) return;
          if (fetchErr) {
            console.error(fetchErr);
            setError("โหลดรายการรายจ่ายไม่สำเร็จ");
            setExpenses([]);
          } else {
            setExpenses(data ?? []);
          }
        },
        (err) => {
          if (isStaleCheck && isStaleCheck()) return;
          console.error(err);
          setError("โหลดรายการรายจ่ายไม่สำเร็จ");
          setExpenses([]);
        }
      );
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

  useEffect(() => {
    let isStale = false;
    const checkStale = () => isStale;

    Promise.all([fetchExpenses(checkStale), fetchWallet(checkStale)]).then(
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
  }, []);

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

  const totalExpense = expenses.reduce((sum, item) => sum + (Number(item.amount) || 0), 0);

  return {
    expenseName,
    setExpenseName,
    expenseAmount,
    setExpenseAmount,
    expenseDate,
    setExpenseDate,
    expenses,
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
  };
}
