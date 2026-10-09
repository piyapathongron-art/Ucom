"use client";

import type { CashStatus } from "@/lib/cash/types";
import CashForm, { Check, Field } from "./cash-form";
import { formatMoney } from "@/lib/cash/money";

export default function OwnerControls({ status }: { status: CashStatus }) {
  if (!status.isOwner) return null;
  if (!status.epoch && !status.activationReady) return <section className="ucom-surface p-4"><h2 className="font-bold">ระบบสองกองเงิน</h2><p className="mt-2 text-sm">ยังไม่เปิดใช้งานจนกว่าจะตรวจครบและอนุมัติ</p></section>;
  if (!status.epoch) return <section className="ucom-surface p-4"><h2 className="mb-3 font-bold">เปิดยอดตั้งต้นบนเครื่องรับเงินหลัก</h2>
    <p className="mb-3 text-sm">หยุดรับ/จ่ายเงิน ซิงก์คิวทุกบิลจนเซิร์ฟเวอร์รับครบ แล้วนับเงินสองกองบนเครื่อง POS หลัก ข้อมูลเก่าที่ยังไม่ซิงก์ต้องจัดประเภทก่อนเปิดใช้</p>
    <CashForm action="open" epoch={null} label="ยืนยันยอดตั้งต้น">
      <Field name="drawer" label="เงินเก๊ะที่นับจริง (บาท)" type="number" /><Field name="pending" label="ยอดขายรอฝากที่นับจริง (บาท)" type="number" />
      <Field name="reason" label="บันทึกการตรวจยอด" />
      <Check name="queueDrained" label="ตรวจบนเครื่องรับเงินหลักแล้วว่าคิวซิงก์ว่างและเซิร์ฟเวอร์รับครบ" />
      <Check name="physicallyPaused" label="หยุดการรับ/จ่ายเงินและนับสองกองเรียบร้อย ไม่มีเงินอยู่ระหว่างนำฝาก" />
    </CashForm></section>;
  return <div className="space-y-4">
    <details className="ucom-surface p-4"><summary className="cursor-pointer font-bold">ตั้งการเตือนนำฝาก</summary>
      <div className="mt-3"><CashForm action="reminder" epoch={status.epoch} label="บันทึกการเตือน">
        <label className="text-sm">สถานะ<select name="enabled" defaultValue={String(status.reminder?.enabled ?? false)} className="ucom-field ml-2 p-2"><option value="false">ปิด</option><option value="true">เปิด</option></select></label>
        <label className="text-sm">วัน<select name="weekday" defaultValue={status.reminder?.weekday ?? 5} className="ucom-field ml-2 p-2">{["อาทิตย์", "จันทร์", "อังคาร", "พุธ", "พฤหัสบดี", "ศุกร์", "เสาร์"].map((day, i) => <option key={day} value={i}>{day}</option>)}</select></label>
        <Field name="time" type="time" label="เวลาไทย" value={status.reminder?.time ?? "10:00"} /><Field name="minimum" type="number" label="ยอดขั้นต่ำที่ให้เตือน (บาท)" value={status.reminder?.minimum ?? "0"} /><Field name="overdueHours" type="number" label="แจ้งเงินที่อยู่กับผู้นำฝากเกิน (ชั่วโมง)" value={String(status.reminder?.overdueHours ?? 24)} />
      </CashForm></div>
    </details>
    <details className="ucom-surface p-4"><summary className="cursor-pointer font-bold">แก้รายการต้นทาง</summary><div className="mt-3"><CashForm action="correct" epoch={status.epoch} sources={status.sources ?? []} isDisabled={!status.sources?.length} label="ยืนยันการแก้ไข">
      <SourceChoice status={status} /><Field name="amount" type="number" label="ยอดที่ถูกต้อง (บาท)" /><Fund /><Field name="reason" label="เหตุผลที่แก้" /><Check name="confirmedInput" label="ตรวจรายการต้นทางและยอดที่ถูกต้องแล้ว" />
    </CashForm></div></details>
    <details className="ucom-surface p-4"><summary className="cursor-pointer font-bold">ปรับยอดจากการนับ</summary><div className="mt-3"><CashForm action="adjust" epoch={status.epoch} fields={{ kind: "reconciliation" }} isDisabled={!status.movements.length} label="ยืนยันปรับยอดจากการนับ">
      <label className="flex flex-col gap-1 text-sm">อ้างอิงรายการเงินสด<select name="sourceOperationId" required className="ucom-field p-2" defaultValue=""><option value="" disabled>เลือกรายการอ้างอิง</option>{[...new Map(status.movements.map(item => [item.operationId, item])).values()].map(item => <option key={item.operationId} value={item.operationId}>{new Date(item.createdAt).toLocaleString("th-TH", { timeZone: "Asia/Bangkok" })} · ยอดตั้งต้น/รายการเงินสด · {formatMoney(item.amount)} บาท</option>)}</select></label>
      <Fund cashOnly /><Field name="amount" label="ยอดปรับ (บาท เพิ่มเป็นบวก ลดเป็นลบ)" />
      <Field name="reason" label="เหตุผล" /><Check name="confirmedInput" label="ยืนยันการเปลี่ยนเงินจริงและแหล่งเงินแล้ว" />
    </CashForm></div></details>
    <details className="ucom-surface p-4"><summary className="cursor-pointer font-bold">คืนเงินจริงให้ลูกค้า</summary><div className="mt-3"><CashForm action="adjust" epoch={status.epoch} fields={{ kind: "refund" }} sources={status.sources?.filter(item => item.table === "sales" || item.table === "shop_income") ?? []} isDisabled={!status.sources?.some(item => item.table === "sales" || item.table === "shop_income")} label="ยืนยันคืนเงินจริง">
      <SourceChoice status={{ ...status, sources: status.sources?.filter(item => item.table === "sales" || item.table === "shop_income") }} /><Fund cashOnly /><Field name="amount" label="ยอดคืน (บาท ใส่เป็นจำนวนลบ)" />
      <Field name="reason" label="เหตุผลที่คืน" /><Check name="confirmedInput" label="คืนเงินจริงให้ลูกค้าจากกองที่เลือกแล้ว" />
    </CashForm></div></details>
  </div>;
}

function Fund({ cashOnly = false }: { cashOnly?: boolean }) {
  return <label className="text-sm">กองเงิน<select name="fund" className="ucom-field ml-2 p-2"><option value="drawer">เก๊ะร้าน</option><option value="pending">ยอดขายรอฝาก</option>{!cashOnly && <option value="transfer">บัญชีร้าน</option>}</select></label>;
}

function SourceChoice({ status }: { status: CashStatus }) {
  return <label className="flex flex-col gap-1 text-sm">รายการต้นทาง<select name="sourceChoice" required className="ucom-field p-2" defaultValue=""><option value="" disabled>เลือกรายการ</option>{status.sources?.map(item => <option key={`${item.table}:${item.id}`} value={`${item.table}:${item.id}`}>{new Date(item.movedAt).toLocaleDateString("th-TH", { timeZone: "Asia/Bangkok" })} · {item.label} · {formatMoney(item.amount)} บาท · {item.fund === "drawer" ? "เก๊ะ" : item.fund === "pending" ? "รอฝาก" : "โอน"}</option>)}</select>{!status.sources?.length && <span className="text-ink-muted">ยังไม่มีรายการหลังเปิดระบบที่เลือกได้</span>}</label>;
}
