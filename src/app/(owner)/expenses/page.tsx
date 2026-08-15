"use client";

import { useEffect, useState } from "react";
import { createClient } from "@/lib/supabase/client";
import { todayInBangkok } from "../report/types";
import type { Tables } from "@/lib/types/database";

type ExpenseRow = Tables<"expenses">;
type WalletBalanceRow = Tables<"v_topup_wallet_balance">;
type CarrierRow = Tables<"topup_carriers">;

export default function ExpensesPage() {
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
        if (!isStale) {
          setIsLoading(false);
        }
      },
      () => {
        if (!isStale) {
          setIsLoading(false);
        }
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

  return (
    <div className="p-8 space-y-8">
      <h1 className="text-2xl font-semibold">รายจ่าย & เติมเงินวอลเล็ต</h1>

      {error && (
        <div
          data-testid="expenses-error"
          className="rounded border border-red-200 bg-red-50 p-4 text-sm text-red-700"
        >
          {error}
        </div>
      )}

      {isLoading ? (
        <div className="text-neutral-500">กำลังโหลด...</div>
      ) : (
        <>
          {/* Section 1: Expenses */}
          <section className="space-y-6">
            <h2 className="text-xl font-semibold">รายจ่าย</h2>

            <form onSubmit={handleAddExpense} className="flex flex-wrap items-end gap-4">
              <div>
                <label className="block text-sm font-medium text-neutral-700 mb-1">
                  รายการ
                </label>
                <input
                  type="text"
                  required
                  data-testid="expense-name"
                  value={expenseName}
                  onChange={(e) => setExpenseName(e.target.value)}
                  className="rounded border border-neutral-200 px-3 py-2 text-sm focus:outline-none focus:ring-1 focus:ring-neutral-900"
                  placeholder="ชื่อรายการ"
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-neutral-700 mb-1">
                  จำนวนเงิน (บาท)
                </label>
                <input
                  type="number"
                  required
                  min="0.01"
                  step="any"
                  data-testid="expense-amount"
                  value={expenseAmount}
                  onChange={(e) => setExpenseAmount(e.target.value)}
                  className="rounded border border-neutral-200 px-3 py-2 text-sm focus:outline-none focus:ring-1 focus:ring-neutral-900"
                  placeholder="0.00"
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-neutral-700 mb-1">
                  วันที่
                </label>
                <input
                  type="date"
                  required
                  data-testid="expense-date"
                  value={expenseDate}
                  onChange={(e) => setExpenseDate(e.target.value)}
                  className="rounded border border-neutral-200 px-3 py-2 text-sm focus:outline-none focus:ring-1 focus:ring-neutral-900"
                />
              </div>

              <button
                type="submit"
                data-testid="expense-submit"
                className="rounded bg-neutral-900 px-4 py-2 text-sm font-medium text-white hover:bg-neutral-800"
              >
                บันทึกรายจ่าย
              </button>
            </form>

            <div className="rounded border border-neutral-200 overflow-hidden">
              <table className="w-full text-left text-sm">
                <thead className="bg-neutral-50 border-b border-neutral-200">
                  <tr>
                    <th className="px-4 py-3 font-medium text-neutral-700">รายการ</th>
                    <th className="px-4 py-3 font-medium text-neutral-700">จำนวนเงิน</th>
                    <th className="px-4 py-3 font-medium text-neutral-700">วันที่</th>
                    <th className="px-4 py-3 font-medium text-neutral-700">จัดการ</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-neutral-200">
                  {expenses.length === 0 ? (
                    <tr>
                      <td colSpan={4} className="px-4 py-4 text-center text-neutral-500">
                        ไม่มีรายการรายจ่ายในเดือนนี้
                      </td>
                    </tr>
                  ) : (
                    expenses.map((row) => (
                      <tr key={row.id} data-testid={`expense-row-${row.id}`}>
                        <td className="px-4 py-3">{row.name}</td>
                        <td className="px-4 py-3">
                          {Number(row.amount).toLocaleString("th-TH", {
                            minimumFractionDigits: 2,
                            maximumFractionDigits: 2,
                          })}
                        </td>
                        <td className="px-4 py-3">{row.spent_at}</td>
                        <td className="px-4 py-3">
                          {deleteConfirmId === row.id ? (
                            <div className="flex items-center gap-2">
                              <button
                                type="button"
                                onClick={() => handleDeleteExpense(row.id)}
                                data-testid={`expense-delete-confirm-${row.id}`}
                                className="rounded bg-red-600 px-2 py-1 text-xs text-white hover:bg-red-700"
                              >
                                ยืนยันลบ
                              </button>
                              <button
                                type="button"
                                onClick={() => setDeleteConfirmId(null)}
                                className="text-xs text-neutral-500 hover:text-neutral-700"
                              >
                                ยกเลิก
                              </button>
                            </div>
                          ) : (
                            <button
                              type="button"
                              onClick={() => setDeleteConfirmId(row.id)}
                              data-testid={`expense-delete-${row.id}`}
                              className="text-xs text-red-600 underline hover:text-red-800"
                            >
                              ลบ
                            </button>
                          )}
                        </td>
                      </tr>
                    ))
                  )}
                </tbody>
              </table>
            </div>

            <div data-testid="expense-total" className="text-right font-medium text-neutral-900">
              รวม:{" "}
              {totalExpense.toLocaleString("th-TH", {
                minimumFractionDigits: 2,
                maximumFractionDigits: 2,
              })}{" "}
              บาท
            </div>
          </section>

          <hr className="border-neutral-200" />

          {/* Section 2: Wallet top-up */}
          <section className="space-y-6">
            <h2 className="text-xl font-semibold">เติมเงินวอลเล็ต</h2>

            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
              {walletBalances.map((wb) => (
                <div
                  key={wb.carrier_id ?? wb.name}
                  data-testid={`wallet-balance-${wb.carrier_id}`}
                  className="rounded border border-neutral-200 p-4 space-y-2"
                >
                  <div className="font-semibold text-lg">{wb.name}</div>
                  <div className="text-sm text-neutral-600 flex justify-between">
                    <span>ยอดเติมสะสม:</span>
                    <span>
                      {Number(wb.topped_up ?? 0).toLocaleString("th-TH", {
                        minimumFractionDigits: 2,
                        maximumFractionDigits: 2,
                      })}{" "}
                      บาท
                    </span>
                  </div>
                  <div className="text-sm text-neutral-600 flex justify-between">
                    <span>ยอดใช้ไป:</span>
                    <span>
                      {Number(wb.spent ?? 0).toLocaleString("th-TH", {
                        minimumFractionDigits: 2,
                        maximumFractionDigits: 2,
                      })}{" "}
                      บาท
                    </span>
                  </div>
                  <div className="text-sm font-semibold flex justify-between pt-2 border-t border-neutral-100">
                    <span>คงเหลือ:</span>
                    <span>
                      {Number(wb.balance ?? 0).toLocaleString("th-TH", {
                        minimumFractionDigits: 2,
                        maximumFractionDigits: 2,
                      })}{" "}
                      บาท
                    </span>
                  </div>
                </div>
              ))}
            </div>

            <form onSubmit={handleAddTopup} className="flex flex-wrap items-end gap-4">
              <div>
                <label className="block text-sm font-medium text-neutral-700 mb-1">
                  ผู้ให้บริการ
                </label>
                <select
                  data-testid="topup-carrier"
                  value={selectedCarrier}
                  onChange={(e) => setSelectedCarrier(e.target.value)}
                  className="rounded border border-neutral-200 px-3 py-2 text-sm focus:outline-none focus:ring-1 focus:ring-neutral-900 bg-white"
                >
                  {carriers.map((c) => (
                    <option key={c.id} value={c.id}>
                      {c.name}
                    </option>
                  ))}
                </select>
              </div>

              <div>
                <label className="block text-sm font-medium text-neutral-700 mb-1">
                  จำนวนเงินเติม (บาท)
                </label>
                <input
                  type="number"
                  required
                  min="0.01"
                  step="any"
                  data-testid="topup-amount"
                  value={topupAmount}
                  onChange={(e) => setTopupAmount(e.target.value)}
                  className="rounded border border-neutral-200 px-3 py-2 text-sm focus:outline-none focus:ring-1 focus:ring-neutral-900"
                  placeholder="0.00"
                />
              </div>

              <button
                type="submit"
                data-testid="topup-submit"
                className="rounded bg-neutral-900 px-4 py-2 text-sm font-medium text-white hover:bg-neutral-800"
              >
                บันทึกเติมเงิน
              </button>
            </form>
          </section>
        </>
      )}
    </div>
  );
}
