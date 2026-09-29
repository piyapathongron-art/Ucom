"use client";

import { useDeferredValue, useEffect, useRef, useState } from "react";
import { toast } from "sonner";
import { createClient } from "@/lib/supabase/client";
import { escapedSearchTerm, pageRange } from "@/lib/supabase/pagination";
import { toThaiError } from "@/lib/errors";
import type { LedgerValues } from "@/app/_components/LedgerAddDialog";
import { todayInBangkok } from "../report/types";

export type LedgerTab = "expense" | "income";
export type LedgerRow = { id: string; name: string; amount: number; day: string; method: string | null };

const bangkokDay = (iso: string) => new Intl.DateTimeFormat("en-CA", { timeZone: "Asia/Bangkok" }).format(new Date(iso));
const sum = (rows: { amount: number | string }[] | null) => (rows ?? []).reduce((total, row) => total + (Number(row.amount) || 0), 0);

// Off-bill ledger: shop expenses + shop income. Sales are never part of it (ADR 0024).
export function useLedgerPage() {
  const supabase = createClient();
  const today = todayInBangkok();
  const [tab, setTab] = useState<LedgerTab>("expense");
  const [filterFrom, setFilterFrom] = useState(today.slice(0, 7) + "-01");
  const [filterTo, setFilterTo] = useState(today);
  const [search, setSearch] = useState("");
  const deferredSearch = useDeferredValue(search);
  const [page, setPage] = useState(1);
  const [pageSize, setPageSize] = useState(25);
  const [rows, setRows] = useState<LedgerRow[]>([]);
  const [totalCount, setTotalCount] = useState(0);
  const [expenseTotal, setExpenseTotal] = useState(0);
  const [incomeTotal, setIncomeTotal] = useState(0);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [reloadKey, setReloadKey] = useState(0);
  const [deleteConfirmId, setDeleteConfirmId] = useState<string | null>(null);
  const requestRef = useRef(0);

  useEffect(() => {
    const requestId = ++requestRef.current;
    const term = escapedSearchTerm(deferredSearch);
    const fromTs = `${filterFrom}T00:00:00+07:00`;
    const toTs = `${filterTo}T23:59:59.999+07:00`;
    const { from, to } = pageRange(page, pageSize);

    const expenses = () => {
      let q = supabase.from("expenses").select("id, name, amount, spent_at, paid_from", { count: "exact" }).gte("spent_at", filterFrom).lte("spent_at", filterTo);
      if (term) q = q.ilike("name", `%${term}%`);
      return q;
    };
    const income = () => {
      let q = supabase.from("shop_income").select("id, name, amount, received_at, received_to", { count: "exact" }).gte("received_at", fromTs).lte("received_at", toTs);
      if (term) q = q.ilike("name", `%${term}%`);
      return q;
    };
    const pageQuery = tab === "expense"
      ? expenses().order("spent_at", { ascending: false }).order("created_at", { ascending: false }).order("id", { ascending: false }).range(from, to)
      : income().order("received_at", { ascending: false }).order("id", { ascending: false }).range(from, to);

    Promise.all([pageQuery, expenses(), income()])
      .then(([pageResult, expenseResult, incomeResult]) => {
        if (requestId !== requestRef.current) return;
        if (pageResult.error || expenseResult.error || incomeResult.error) throw new Error("ledger unavailable");
        const data = (pageResult.data ?? []) as Record<string, string | number | null>[];
        const count = pageResult.count ?? data.length;
        if (data.length === 0 && count > 0 && page > 1) {
          setPage((current) => Math.max(1, current - 1));
          return;
        }
        setRows(data.map((r) => tab === "expense"
          ? { id: String(r.id), name: String(r.name), amount: Number(r.amount), day: String(r.spent_at), method: r.paid_from as string | null }
          : { id: String(r.id), name: String(r.name), amount: Number(r.amount), day: bangkokDay(String(r.received_at)), method: r.received_to as string | null }));
        setTotalCount(count);
        setExpenseTotal(sum(expenseResult.data as { amount: number }[]));
        setIncomeTotal(sum(incomeResult.data as { amount: number }[]));
        setError(null);
      })
      .catch(() => {
        if (requestId !== requestRef.current) return;
        setRows([]);
        setTotalCount(0);
        setExpenseTotal(0);
        setIncomeTotal(0);
        setError("โหลดรายการไม่สำเร็จ");
      })
      .finally(() => { if (requestId === requestRef.current) setIsLoading(false); });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [tab, page, pageSize, filterFrom, filterTo, deferredSearch, reloadKey]);

  const reload = () => { setIsLoading(true); setReloadKey((v) => v + 1); };

  // Runs a write: toasts a Thai message and resolves false on failure; reloads on success.
  async function write(call: PromiseLike<{ error: unknown }>, successMessage: string) {
    const { error: err } = await call;
    if (err) {
      toast.error(toThaiError(err), { duration: Infinity });
      return false;
    }
    toast.success(successMessage);
    reload();
    return true;
  }

  async function addEntry(values: LedgerValues) {
    if (tab === "expense") {
      const { data: { user } } = await supabase.auth.getUser();
      return write(supabase.from("expenses").insert({ name: values.name, amount: values.amount, spent_at: values.date, paid_from: values.method, created_by: user?.id }), "บันทึกรายจ่ายแล้ว");
    }
    return write(supabase.rpc("rpc_add_shop_income", { p_name: values.name, p_amount: values.amount, p_received_to: values.method }), "บันทึกรายรับแล้ว");
  }

  async function deleteEntry(id: string) {
    const ok = await write(
      tab === "expense" ? supabase.from("expenses").delete().eq("id", id) : supabase.rpc("rpc_delete_shop_income", { p_id: id }),
      "ลบรายการแล้ว",
    );
    if (ok) setDeleteConfirmId(null);
  }

  return {
    tab, setTab: (next: LedgerTab) => { setTab(next); setPage(1); setDeleteConfirmId(null); setIsLoading(true); },
    filterFrom, setFilterFrom, filterTo, setFilterTo, search, setSearch,
    page, setPage, pageSize, setPageSize,
    rows, totalCount, expenseTotal, incomeTotal, isLoading, error, reload,
    deleteConfirmId, setDeleteConfirmId, addEntry, deleteEntry, today,
  };
}
