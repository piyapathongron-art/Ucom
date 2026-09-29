"use server";

import { createClient } from "@/lib/supabase/server";
import { pushCloseDayDigest } from "@/lib/line/push";
import type { DigestData } from "@/lib/line/digestFlex";

async function sendDigest(date: string, isResend: boolean) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user || !/^\d{4}-\d{2}-\d{2}$/.test(date)) return false;
  const { data, error } = await supabase.rpc("rpc_close_day_digest", { p_date: date });
  if (error || !data) return false;
  return pushCloseDayDigest(data as DigestData, isResend);
}

export async function closeDay(countedCash: number, note: string): Promise<{ closed: boolean; lineSent: boolean }> {
  if (!Number.isFinite(countedCash) || countedCash < 0 || note.length > 1000) return { closed: false, lineSent: false };
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return { closed: false, lineSent: false };
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
