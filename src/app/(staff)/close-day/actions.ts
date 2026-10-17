"use server";

import { createClient } from "@/lib/supabase/server";
import { pushCloseDayDigest, pushCashSnapshot } from "@/lib/line/push";
import type { DigestData } from "@/lib/line/digestFlex";
import type { CashStatus } from "@/lib/cash/types";

async function sendDigest(date: string, isResend: boolean) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user || !/^\d{4}-\d{2}-\d{2}$/.test(date)) return false;
  const { data: statusData, error: statusError } = await supabase.rpc("rpc_cash_status");
  if (statusError || !statusData) return false;
  const status = statusData as CashStatus;
  const openedDate = status.openedAt ? new Intl.DateTimeFormat("en-CA", { timeZone: "Asia/Bangkok", year: "numeric", month: "2-digit", day: "2-digit" }).format(new Date(status.openedAt)) : null;
  if (status.epoch && (!openedDate || date >= openedDate)) {
    const { data: snapshots, error: historyError } = await supabase.rpc("rpc_cash_closing", { p_date: date });
    if (historyError || !Array.isArray(snapshots) || !snapshots.length) return false;
    return pushCashSnapshot(snapshots[0] as CashStatus["closings"][number], "ปิดร้าน", isResend);
  }
  const { data, error } = await supabase.rpc("rpc_close_day_digest", { p_date: date });
  if (error || !data) return false;
  return pushCloseDayDigest(data as DigestData, isResend);
}

export async function closeDay(countedCash: number, note: string): Promise<{ closed: boolean; lineSent: boolean }> {
  if (!Number.isFinite(countedCash) || countedCash < 0 || note.length > 1000) return { closed: false, lineSent: false };
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return { closed: false, lineSent: false };
  const { data: status, error: statusError } = await supabase.rpc("rpc_cash_status");
  if (statusError || !status || (status as CashStatus).epoch) return { closed: false, lineSent: false };
  const { error } = await supabase.rpc("rpc_close_day", { p_counted_cash: countedCash, p_note: note.trim() });
  if (error) return { closed: false, lineSent: false };
  const today = new Intl.DateTimeFormat("en-CA", { timeZone: "Asia/Bangkok", year: "numeric", month: "2-digit", day: "2-digit" }).format(new Date());
  try {
    return { closed: true, lineSent: await sendDigest(today, false) };
  } catch {
    return { closed: true, lineSent: false };
  }
}

export async function sendCloseDayDigest(date: string) {
  return sendDigest(date, true);
}

export async function sendCashClosing(snapshotId: string, retryKey?: string, date?: string): Promise<boolean> {
  if (!/^[0-9a-f-]{36}$/i.test(snapshotId) || (retryKey && !/^[0-9a-f-]{36}$/i.test(retryKey))) return false;
  if (date && !/^\d{4}-\d{2}-\d{2}$/.test(date)) return false;
  try {
    const supabase = await createClient();
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return false;
    const { data, error } = date ? await supabase.rpc("rpc_cash_closing", { p_date: date }) : await supabase.rpc("rpc_cash_status");
    if (error || !data) return false;
    const rows = date && Array.isArray(data) ? data as CashStatus["closings"] : (data as CashStatus).closings;
    const snapshot = rows.find(row => row.id === snapshotId);
    if (!snapshot) return false;
    return pushCashSnapshot(snapshot, "ปิดร้าน", !retryKey, retryKey);
  } catch { return false; }
}
