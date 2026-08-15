"use client";

import { useEffect, useState } from "react";
import { createClient } from "@/lib/supabase/client";
import { todayInBangkok } from "../../(owner)/report/types";
import { readQueue } from "../pos/queue";
import type { Tables } from "@/lib/types/database";

type BillRow = Tables<"v_close_day_bills">;
type ItemRow = Tables<"v_close_day_items">;
type ExpenseRow = Tables<"v_close_day_expenses">;
type SFRow = Tables<"v_close_day_sf">;
type ClosingRow = Tables<"day_closings">;

export default function CloseDayPage() {
  const supabase = createClient();

  const [date, setDate] = useState(() => todayInBangkok());
  const applyDate = (nextDate: string) => {
    setIsLoading(true);
    setError(null);
    setIsClosingSuccess(false);
    setDeleteConfirmId(null);
    setDate(nextDate);
  };
  const [isOwner, setIsOwner] = useState(false);
  const [roleResolved, setRoleResolved] = useState(false);

  const [bills, setBills] = useState<BillRow[]>([]);
  const [items, setItems] = useState<ItemRow[]>([]);
  const [expenses, setExpenses] = useState<ExpenseRow[]>([]);
  const [sfs, setSfs] = useState<SFRow[]>([]);
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
    const { data } = await supabase.from("v_close_day_expenses").select("*").eq("day", date);
    if (data) setExpenses(data);
  };

  const fetchData = (targetDate: string, isStale: () => boolean) => {
    Promise.all([
      supabase.from("v_close_day_bills").select("*").eq("day", targetDate),
      supabase.from("v_close_day_items").select("*").eq("day", targetDate),
      supabase.from("v_close_day_expenses").select("*").eq("day", targetDate),
      supabase.from("v_close_day_sf").select("*").eq("day", targetDate),
      supabase.from("day_closings").select("*").eq("closing_date", targetDate).maybeSingle()
    ]).then(([rBills, rItems, rExp, rSf, rClosing]) => {
      if (isStale()) return;
      setBills(rBills.data || []);
      setItems(rItems.data || []);
      setExpenses(rExp.data || []);
      setSfs(rSf.data || []);
      setClosing(rClosing.data || null);

      if (targetDate === todayInBangkok()) setQueuedCount(readQueue().length);
      else setQueuedCount(0);
      setIsLoading(false);
    });
  };

  useEffect(() => {
    let stale = false;
    fetchData(date, () => stale);
    return () => { stale = true; };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [date]);

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
  
  const cashTotal = bills.filter(b => b.payment_method === "cash").reduce((s, b) => s + Number(b.bill_total), 0);
  const transferTotal = bills.filter(b => b.payment_method === "transfer").reduce((s, b) => s + Number(b.bill_total), 0);
  const cashExpenseTotal = expenses.filter(e => e.paid_from === "cash").reduce((s, e) => s + Number(e.amount), 0);
  const toSend = cashTotal - cashExpenseTotal;

  const isToday = date === todayInBangkok();

  return (
    <div className="p-8 space-y-8">
      <div className="flex justify-between items-center">
        <h1 className="text-2xl font-semibold">ปิดร้าน / สรุปรายวัน</h1>
        {isOwner && roleResolved && (
          <input
            type="date"
            value={date}
            onChange={e => applyDate(e.target.value)}
            className="rounded border border-neutral-300 px-3 py-1.5 text-sm"
          />
        )}
      </div>

      {error && (
        <div data-testid="close-day-error" className="rounded border border-red-200 bg-red-50 p-4 text-sm text-red-700">
          {error}
        </div>
      )}

      {queuedCount > 0 && isToday && (
        <div data-testid="close-day-queue-warning" className="rounded border border-amber-200 bg-amber-50 p-4 text-sm text-amber-700">
          ยังมีบิลค้างในคิว {queuedCount} ใบ ยอดยังไม่ครบ กรุณาซิงก์ก่อนปิดร้าน
        </div>
      )}

      {isLoading ? (
        <div className="text-neutral-500">กำลังโหลด...</div>
      ) : (
        <>
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
            <div className="rounded border border-neutral-200 bg-white p-4 shadow-sm">
              <p className="text-sm text-neutral-500">เงินสด</p>
              <p data-testid="close-day-cash-total" className="text-xl font-semibold mt-1">{fmt(cashTotal)}</p>
            </div>
            <div className="rounded border border-neutral-200 bg-white p-4 shadow-sm">
              <p className="text-sm text-neutral-500">เงินโอน</p>
              <p data-testid="close-day-transfer-total" className="text-xl font-semibold mt-1">{fmt(transferTotal)}</p>
            </div>
            <div className="rounded border border-neutral-200 bg-white p-4 shadow-sm">
              <p className="text-sm text-neutral-500">รายจ่าย (เงินสด)</p>
              <p data-testid="close-day-expense-total" className="text-xl font-semibold mt-1">{fmt(cashExpenseTotal)}</p>
            </div>
            <div className="rounded border border-neutral-200 bg-neutral-50 p-4 shadow-sm">
              <p className="text-sm font-medium text-neutral-900">ยอดที่ต้องส่ง</p>
              <p data-testid="close-day-to-send" className="text-2xl font-bold mt-1 text-neutral-900">{fmt(toSend)}</p>
            </div>
          </div>

          {sfs.length > 0 && (
            <div className="text-neutral-700 font-medium">ปล่อย SF+ วันนี้ {sfs.length} เครื่อง</div>
          )}

          <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
            <section className="space-y-4">
              <h2 className="text-xl font-semibold">บิลขาย</h2>
              <div className="rounded border border-neutral-200 overflow-hidden">
                <table className="w-full text-left text-sm">
                  <thead className="bg-neutral-50 border-b border-neutral-200">
                    <tr>
                      <th className="px-4 py-3 font-medium text-neutral-700">เวลา</th>
                      <th className="px-4 py-3 font-medium text-neutral-700">ชำระด้วย</th>
                      <th className="px-4 py-3 font-medium text-neutral-700">จำนวนชิ้น</th>
                      <th className="px-4 py-3 font-medium text-neutral-700">ยอดบิล</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-neutral-200">
                    {[...bills].sort((a,b) => (b.sold_at || "").localeCompare(a.sold_at || "")).map(b => (
                      <tr key={b.sale_id}>
                        <td className="px-4 py-3">{new Date(b.sold_at || "").toLocaleTimeString("th-TH", { timeZone: "Asia/Bangkok", hour: "2-digit", minute: "2-digit" })}</td>
                        <td className="px-4 py-3">{b.payment_method === "cash" ? "เงินสด" : "เงินโอน"}</td>
                        <td className="px-4 py-3">{b.item_count}</td>
                        <td className="px-4 py-3">{fmt(Number(b.bill_total))}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </section>

            <section className="space-y-4">
              <h2 className="text-xl font-semibold">สินค้าที่ขายได้</h2>
              <div className="rounded border border-neutral-200 overflow-hidden">
                <table className="w-full text-left text-sm">
                  <thead className="bg-neutral-50 border-b border-neutral-200">
                    <tr>
                      <th className="px-4 py-3 font-medium text-neutral-700">สินค้า</th>
                      <th className="px-4 py-3 font-medium text-neutral-700">ประเภท</th>
                      <th className="px-4 py-3 font-medium text-neutral-700">จำนวน</th>
                      <th className="px-4 py-3 font-medium text-neutral-700">ยอดขาย</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-neutral-200">
                    {[...items].sort((a,b) => Number(b.revenue) - Number(a.revenue)).map((item, i) => (
                      <tr key={i}>
                        <td className="px-4 py-3">{item.name_snapshot}</td>
                        <td className="px-4 py-3">{item.kind}</td>
                        <td className="px-4 py-3">{item.qty}</td>
                        <td className="px-4 py-3">{fmt(Number(item.revenue))}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </section>
          </div>

          <section className="space-y-4 max-w-4xl">
            <h2 className="text-xl font-semibold">รายจ่ายร้าน</h2>
            {isToday && (
              <form onSubmit={handleAddExpense} className="flex flex-wrap items-end gap-4">
                <div>
                  <label className="block text-sm font-medium text-neutral-700 mb-1">รายการ</label>
                  <input type="text" required data-testid="close-day-expense-name" value={expenseName} onChange={e => setExpenseName(e.target.value)} className="rounded border border-neutral-200 px-3 py-2 text-sm focus:outline-none focus:ring-1 focus:ring-neutral-900" placeholder="ชื่อรายการ" />
                </div>
                <div>
                  <label className="block text-sm font-medium text-neutral-700 mb-1">จำนวนเงิน (บาท)</label>
                  <input type="number" required min="0.01" step="any" data-testid="close-day-expense-amount" value={expenseAmount} onChange={e => setExpenseAmount(e.target.value)} className="rounded border border-neutral-200 px-3 py-2 text-sm focus:outline-none focus:ring-1 focus:ring-neutral-900" placeholder="0.00" />
                </div>
                <div>
                  <label className="block text-sm font-medium text-neutral-700 mb-1">จ่ายจาก</label>
                  <select data-testid="close-day-expense-paid-from" value={expensePaidFrom} onChange={e => setExpensePaidFrom(e.target.value as "cash"|"transfer")} className="rounded border border-neutral-200 px-3 py-2 text-sm focus:outline-none focus:ring-1 focus:ring-neutral-900 bg-white">
                    <option value="cash">เงินสดในลิ้นชัก</option>
                    <option value="transfer">เงินโอน/ส่วนตัว</option>
                  </select>
                </div>
                <button type="submit" data-testid="close-day-expense-submit" className="rounded bg-neutral-900 px-4 py-2 text-sm font-medium text-white hover:bg-neutral-800">บันทึกรายจ่าย</button>
              </form>
            )}

            <div className="rounded border border-neutral-200 overflow-hidden">
              <table className="w-full text-left text-sm">
                <thead className="bg-neutral-50 border-b border-neutral-200">
                  <tr>
                    <th className="px-4 py-3 font-medium text-neutral-700">รายการ</th>
                    <th className="px-4 py-3 font-medium text-neutral-700">จำนวนเงิน</th>
                    <th className="px-4 py-3 font-medium text-neutral-700">จ่ายจาก</th>
                    {isToday && <th className="px-4 py-3 font-medium text-neutral-700">จัดการ</th>}
                  </tr>
                </thead>
                <tbody className="divide-y divide-neutral-200">
                  {expenses.length === 0 ? (
                    <tr><td colSpan={isToday ? 4 : 3} className="px-4 py-4 text-center text-neutral-500">ไม่มีรายการรายจ่าย</td></tr>
                  ) : expenses.map(row => (
                    <tr key={row.id} data-testid={`close-day-expense-row-${row.id}`}>
                      <td className="px-4 py-3">{row.name}</td>
                      <td className="px-4 py-3">{fmt(Number(row.amount))}</td>
                      <td className="px-4 py-3">{row.paid_from === "cash" ? "เงินสดในลิ้นชัก" : "เงินโอน/ส่วนตัว"}</td>
                      {isToday && (
                        <td className="px-4 py-3">
                          {deleteConfirmId === row.id ? (
                            <div className="flex items-center gap-2">
                              <button type="button" onClick={() => handleDeleteExpense(row.id!)} data-testid={`close-day-expense-delete-confirm-${row.id}`} className="rounded bg-red-600 px-2 py-1 text-xs text-white hover:bg-red-700">ยืนยันลบ</button>
                              <button type="button" onClick={() => setDeleteConfirmId(null)} className="text-xs text-neutral-500 hover:text-neutral-700">ยกเลิก</button>
                            </div>
                          ) : (
                            <button type="button" onClick={() => setDeleteConfirmId(row.id!)} data-testid={`close-day-expense-delete-${row.id}`} className="text-xs text-red-600 underline hover:text-red-800">ลบ</button>
                          )}
                        </td>
                      )}
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </section>

          <hr className="border-neutral-200" />

          <section className="max-w-xl">
            <h2 className="text-xl font-semibold mb-4">สถานะการปิดร้าน</h2>
            {isToday ? (
              isClosingSuccess && !closing ? (
                 <div className="rounded border border-green-200 bg-green-50 p-4 text-green-800 font-medium">ปิดร้านสำเร็จ</div>
              ) : (
                <div className="space-y-4 rounded border border-neutral-200 bg-neutral-50 p-6">
                  {closing && (
                    <div className="text-sm text-neutral-700 font-medium">
                      ปิดล่าสุดเวลา {closing.closed_at ? new Date(closing.closed_at || "").toLocaleTimeString("th-TH", { timeZone: "Asia/Bangkok", hour: "2-digit", minute: "2-digit" }) : ""} — นับได้ {fmt(Number(closing.counted_cash))} บาท
                    </div>
                  )}
                  <form onSubmit={handleCloseDay} className="space-y-4">
                    <div>
                      <label className="block text-sm font-medium text-neutral-700 mb-1">เงินสดที่นับได้จริง</label>
                      <input type="number" required min="0" step="any" data-testid="close-day-counted-cash" value={countedCash} onChange={e => setCountedCash(e.target.value)} className="w-full rounded border border-neutral-300 px-3 py-2 text-sm focus:outline-none focus:ring-1 focus:ring-neutral-900" placeholder="0.00" />
                      {countedCash && !isNaN(parseFloat(countedCash)) && (
                        <div className={`text-sm mt-1 font-medium ${(parseFloat(countedCash) - toSend) === 0 ? "text-green-600" : (parseFloat(countedCash) - toSend) > 0 ? "text-blue-600" : "text-red-600"}`}>
                          ส่วนต่าง: {(parseFloat(countedCash) - toSend) === 0 ? "ตรงพอดี" : (parseFloat(countedCash) - toSend) > 0 ? `เกิน ${fmt(parseFloat(countedCash) - toSend)} บาท` : `ขาด ${fmt(toSend - parseFloat(countedCash))} บาท`}
                        </div>
                      )}
                    </div>
                    <div>
                      <label className="block text-sm font-medium text-neutral-700 mb-1">หมายเหตุ (ถ้ามี)</label>
                      <textarea data-testid="close-day-note" value={closeNote} onChange={e => setCloseNote(e.target.value)} className="w-full rounded border border-neutral-300 px-3 py-2 text-sm focus:outline-none focus:ring-1 focus:ring-neutral-900" rows={2} />
                    </div>
                    <button type="submit" disabled={queuedCount > 0} data-testid="close-day-confirm" className="w-full rounded bg-neutral-900 px-4 py-2 text-sm font-medium text-white hover:bg-neutral-800 disabled:opacity-50 disabled:cursor-not-allowed">
                      ยืนยันปิดร้าน
                    </button>
                  </form>
                </div>
              )
            ) : (
              <div className="rounded border border-neutral-200 bg-neutral-50 p-6 text-center text-neutral-600">
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
    </div>
  );
}
