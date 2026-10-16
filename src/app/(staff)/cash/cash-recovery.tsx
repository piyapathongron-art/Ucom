"use client";
import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { cashActor, executeCash, inspectCashOperation, resendCashSnapshot } from "./actions";
import { CASH_OPERATION_EVENT, assertStoredCashIntent, validatesCashProof, clearCashIntent, refreshCashOperations, saveCashIntent, withCashOperationLock, type CashInvestigation } from "@/lib/cash/operations";

const actionNames: Record<string, string> = { handover_days: "นำเงินออกไปฝาก", settle: "แจ้งฝากเงิน", return: "คืนเงินเข้าร้าน", evidence: "ส่งหลักฐานใหม่", review: "ตรวจหลักฐาน" };

export default function CashRecovery() {
  const [entries, setEntries] = useState<CashInvestigation[]>([]);
  const [message, setMessage] = useState("");
  const [isBusy, setIsBusy] = useState(false);
  const [notifications, setNotifications] = useState<string[]>([]);
  const router = useRouter();
  useEffect(() => {
    const refresh = () => {
      setEntries(refreshCashOperations());
      try { setNotifications(Object.keys(localStorage).filter(key => key.startsWith("ucom-cash-notification-v1:")).map(key => key.slice("ucom-cash-notification-v1:".length))); } catch { setMessage("อ่านสถานะการแจ้ง LINE ไม่ได้"); }
    };
    Promise.resolve().then(refresh);
    window.addEventListener("storage", refresh); window.addEventListener(CASH_OPERATION_EVENT, refresh);
    return () => { window.removeEventListener("storage", refresh); window.removeEventListener(CASH_OPERATION_EVENT, refresh); };
  }, []);
  async function retry(entry: CashInvestigation) {
    if (!entry.intent) return;
    setIsBusy(true);
    try {
      await withCashOperationLock(entry.intent.id, async () => {
        let intent = entry.intent!;
        assertStoredCashIntent(intent);
        const actorId = await cashActor();
        if (!actorId) throw new Error("เข้าสู่ระบบด้วยบัญชีผู้ทำรายการเดิมก่อน");
        if (!intent.actorId) {
          const proof = await inspectCashOperation(intent.id);
          if (!validatesCashProof(proof, { ...intent, actorId })) throw new Error("รายการเก่ายังพิสูจน์เจ้าของคำขอไม่ได้ ต้องให้เจ้าของตรวจสอบ ห้ามสร้างคำขอทดแทน");
          intent = { ...intent, actorId }; saveCashIntent(intent);
        }
        if (actorId !== intent.actorId) throw new Error("รายการนี้เป็นของบัญชีอื่น กรุณาให้ผู้ทำรายการเดิมยืนยันผล");
        const result = await executeCash(intent.id, intent.epoch, intent.action, intent.payload, intent.actorId);
        setMessage(result.message);
        if ((result.ok || ("rejected" in result && result.rejected)) && "id" in result && result.id === intent.id && "actorId" in result && result.actorId === actorId) {
          if (result.ok && "notificationSent" in result && result.notificationSent === false) localStorage.setItem(`ucom-cash-notification-v1:${intent.id}`, actorId);
          clearCashIntent(intent); router.refresh();
        }
      });
    } catch (failure) { setMessage(failure instanceof Error ? failure.message : "ยังไม่ทราบผลรายการเดิม"); }
    finally { setIsBusy(false); }
  }
  async function resendAll() {
    setIsBusy(true);
    try {
      const actor = await cashActor();
      let sent = 0; let skipped = 0;
      for (const id of notifications) {
        const key = `ucom-cash-notification-v1:${id}`;
        if (!actor || localStorage.getItem(key) !== actor) { skipped++; continue; }
        if (await resendCashSnapshot(id)) { localStorage.removeItem(key); sent++; }
      }
      setNotifications(items => items.filter(id => localStorage.getItem(`ucom-cash-notification-v1:${id}`) !== null));
      setMessage(sent === notifications.length ? "ส่งแจ้ง LINE แล้ว" : skipped && !sent ? "ใช้บัญชีผู้ทำรายการเดิมเพื่อส่งการแจ้งเตือนซ้ำ" : `ส่งแล้ว ${sent} จาก ${notifications.length} รายการ ที่เหลือลองอีกครั้ง ยอดเงินบันทึกแล้ว`);
    } catch (failure) { setMessage(failure instanceof Error ? failure.message : "ส่ง LINE ไม่สำเร็จ"); }
    finally { setIsBusy(false); }
  }
  if (!entries.length && !notifications.length && !message) return null;
  return <section className="ucom-surface space-y-3 p-4" data-testid="cash-event-recovery">
    <h2 className="font-bold">มีรายการที่ต้องตรวจ</h2>
    {entries.map(entry => <div key={entry.key} className="text-sm"><p>{entry.reason} · {(entry.intent && actionNames[entry.intent.action]) ?? "ต้องตรวจสอบข้อมูลในเครื่อง"}</p>{entry.intent && <button disabled={isBusy} className="ucom-secondary mt-2 px-3 py-2" onClick={() => void retry(entry)}>ยืนยันข้อมูลเดิม</button>}</div>)}
    {notifications.length > 0 && <div className="text-sm"><p>บันทึกยอดเงินแล้ว แต่แจ้งเข้า LINE ไม่สำเร็จ {notifications.length} รายการ</p><button disabled={isBusy} className="underline" onClick={() => void resendAll()}>ส่งแจ้ง LINE อีกครั้ง</button></div>}
    {message && <p role="status" className="text-sm">{message}</p>}
  </section>;
}
