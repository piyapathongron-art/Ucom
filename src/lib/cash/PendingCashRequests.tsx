"use client";

import { useEffect, useState } from "react";
import { CASH_REQUEST_KEY, cashExecute, isDefiniteCashError } from "./client";
import { CASH_RECEIPT_KEY, CASH_RECEIPT_ROUTE_KEY, sendReceipt, sendRepairReceipt } from "./receipt";
import type { Json } from "@/lib/types/database";
import { toThaiError } from "@/lib/errors";
import CashRecovery from "@/app/(staff)/cash/cash-recovery";
import { CASH_OPERATION_EVENT, withCashOperationLock } from "./operations";

type Pending = { key: string; id: string; epoch: string | null; action: string; payload: Json; jobId?: string; isReceipt: boolean };
const labels: Record<string, string> = { sale: "บิลขาย", repair_close: "บิลค่าซ่อม", part: "จ่ายอะไหล่", expense: "รายจ่าย", income: "รายรับนอกบิล", consign_sell: "ขายเครื่องฝากเข้า", consign_settle: "รับเงินฝากออก", consign_pay: "จ่ายเจ้าของเครื่อง" };

function readPending(queuedIds: string[]): Pending[] {
  const result: Pending[] = [];
  for (const key of Object.keys(localStorage)) {
    if (!key.startsWith(CASH_REQUEST_KEY) && !key.startsWith(CASH_RECEIPT_KEY)) continue;
    try {
      const value: unknown = JSON.parse(localStorage.getItem(key) ?? "null");
      if (!value || typeof value !== "object" || Array.isArray(value)) continue;
      if (key.startsWith(CASH_RECEIPT_KEY)) {
        if (!("client_uuid" in value) || typeof value.client_uuid !== "string" || queuedIds.includes(value.client_uuid)) continue;
        const route: unknown = JSON.parse(localStorage.getItem(CASH_RECEIPT_ROUTE_KEY + value.client_uuid) ?? "null");
        if (!route || typeof route !== "object" || !("action" in route) || (route.action !== "sale" && route.action !== "repair_close")) continue;
        const jobId = "id" in route && typeof route.id === "string" ? route.id : undefined;
        if (route.action === "repair_close" && !jobId) continue;
        result.push({ key, id: value.client_uuid, epoch: "cash_epoch" in value && typeof value.cash_epoch === "string" ? value.cash_epoch : null, action: route.action, jobId, payload: value as Json, isReceipt: true });
      } else if ("id" in value && typeof value.id === "string" && "epoch" in value && typeof value.epoch === "string" && "action" in value && typeof value.action === "string" && "payload" in value) {
        result.push({ key, id: value.id, epoch: value.epoch, action: value.action, payload: value.payload as Json, isReceipt: false });
      }
    } catch { /* Preserve unreadable data for owner investigation. */ }
  }
  return result;
}

export function PendingCashRequests({ queuedIds, onResolved, onBusyChange }: { queuedIds: string[]; onResolved: (action: string, id: string) => void; onBusyChange: (isBusy: boolean) => void }) {
  const [requests, setRequests] = useState<Pending[]>([]);
  const [busyId, setBusyId] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const queueSignature = queuedIds.join(",");
  useEffect(() => {
    const refresh = () => setRequests(readPending(queueSignature ? queueSignature.split(",") : []));
    Promise.resolve().then(refresh);
    const timer = window.setInterval(refresh, 5000);
    window.addEventListener("storage", refresh); window.addEventListener(CASH_OPERATION_EVENT, refresh);
    return () => { window.clearInterval(timer); window.removeEventListener("storage", refresh); window.removeEventListener(CASH_OPERATION_EVENT, refresh); };
  }, [queueSignature]);

  async function retry(request: Pending) {
    setBusyId(request.id); setError(null); onBusyChange(true);
    try {
      const payload = request.payload;
      const result = request.isReceipt
        ? request.action === "repair_close" && request.jobId && payload && typeof payload === "object" && !Array.isArray(payload)
          ? await sendRepairReceipt(request.jobId, payload)
          : await sendReceipt(payload)
        : await withCashOperationLock(request.id, () => cashExecute(request.id, request.epoch, request.action, payload));
      if (!request.isReceipt && (!result.error || isDefiniteCashError(result.error))) localStorage.removeItem(request.key);
      if (result.error) setError(toThaiError(result.error));
      else onResolved(request.action, request.id);
      setRequests(readPending(queuedIds));
    } finally { setBusyId(null); onBusyChange(false); }
  }

  return <><CashRecovery />{requests.length > 0 && <section className="border-b border-border bg-warning-bg px-5 py-3 text-sm" data-testid="cash-pending-requests">
    <p className="font-semibold">มีรายการเดิมที่ยังไม่ยืนยันผล เครื่อง POS จะยืนยันคิวหลังตรวจสอบครบ</p>
    <ul className="mt-2 space-y-2">{requests.map(request => <li key={request.key} className="flex flex-wrap items-center gap-3">
      <span>{labels[request.action] ?? "รายการเงินสด"} · {request.id}</span>
      <button type="button" disabled={Boolean(busyId)} onClick={() => void retry(request)} className="ucom-secondary px-3 py-1 disabled:opacity-50">{busyId === request.id ? "กำลังยืนยัน..." : "ลองยืนยันข้อมูลเดิม"}</button>
    </li>)}</ul>
    {error && <p role="alert" className="ucom-error mt-2">{error}</p>}
  </section>}</>;
}
