"use client";

import { useState } from "react";
import type { CashStatus } from "@/lib/cash/types";
import { Modal } from "@/app/_components/Modal";
import CashForm, { Check, Field } from "./cash-form";
import { formatMoney } from "@/lib/cash/money";

export default function OwnerControls({ status }: { status: CashStatus }) {
  const [tool, setTool] = useState<string | null>(null);
  if (!status.isOwner) return null;
  if (!status.epoch && !status.activationReady) return <section className="ucom-surface p-4"><h2 className="font-bold">ระบบสองกองเงิน</h2><p className="mt-2 text-sm">ยังไม่เปิดใช้งานจนกว่าจะตรวจครบและอนุมัติ</p></section>;
  if (!status.epoch) return <section className="ucom-surface p-4"><h2 className="mb-3 font-bold">เปิดยอดตั้งต้นบนเครื่องรับเงินหลัก</h2>
    <p className="mb-3 text-sm">หยุดรับ/จ่ายเงิน ซิงก์คิวทุกบิลจนเซิร์ฟเวอร์รับครบ แล้วนับเงินสองกองบนเครื่อง POS หลัก ข้อมูลเก่าที่ยังไม่ซิงก์ต้องจัดประเภทก่อนเปิดใช้</p>
    <CashForm action="open" epoch={null} label="ยืนยันยอดตั้งต้น">
      <Field name="drawer" label="เงินเก๊ะที่นับจริง (บาท)" type="number" /><Field name="pending" label="เงินรอฝากที่นับจริง (บาท)" type="number" />
      <Field name="reason" label="บันทึกการตรวจยอด" />
      <Check name="queueDrained" label="ตรวจบนเครื่องรับเงินหลักแล้วว่าคิวซิงก์ว่างและเซิร์ฟเวอร์รับครบ" />
      <Check name="physicallyPaused" label="หยุดการรับ/จ่ายเงินและนับสองกองเรียบร้อย ไม่มีเงินอยู่ระหว่างนำฝาก" />
    </CashForm></section>;
  const sales = status.sources?.filter(item => item.table === "sales" || item.table === "shop_income") ?? [];
  const tools = [
    { id: "reminder", title: "ตั้งการเตือนนำฝาก", hint: "เปิด/ปิด วัน เวลา และยอดขั้นต่ำที่ให้เตือน" },
    { id: "correct", title: "แก้รายการต้นทาง", hint: "แก้ยอดหรือกองเงินของรายการที่บันทึกไปแล้ว" },
    { id: "adjust", title: "ปรับยอดจากการนับ", hint: "ปรับระบบให้ตรงกับเงินที่นับได้จริง" },
    { id: "refund", title: "คืนเงินจริงให้ลูกค้า", hint: "บันทึกการคืนเงินสดจากกองที่เลือก" },
  ];
  const current = tools.find(item => item.id === tool);
  return <section className="ucom-surface p-4">
    <h2 className="mb-1 font-bold">เครื่องมือเจ้าของ</h2>
    <ul className="divide-y divide-border">{tools.map(item => <li key={item.id}>
      <button type="button" className="flex w-full items-center justify-between gap-3 py-3 text-left" onClick={() => setTool(item.id)}>
        <span><span className="block text-sm font-semibold">{item.title}</span><span className="block text-xs text-ink-muted">{item.hint}</span></span>
        <span aria-hidden="true" className="text-ink-muted">›</span>
      </button>
    </li>)}</ul>
    {current && <Modal open onClose={() => setTool(null)} title={current.title} size="md" footer={<button type="button" className="ucom-secondary px-4 py-2" onClick={() => setTool(null)}>ปิด</button>}>
      {tool === "reminder" && <CashForm action="reminder" epoch={status.epoch} label="บันทึกการเตือน">
        <label className="text-sm">สถานะ<select name="enabled" defaultValue={String(status.reminder?.enabled ?? false)} className="ucom-field ml-2 p-2"><option value="false">ปิด</option><option value="true">เปิด</option></select></label>
        <label className="text-sm">วัน<select name="weekday" defaultValue={status.reminder?.weekday ?? 5} className="ucom-field ml-2 p-2">{["อาทิตย์", "จันทร์", "อังคาร", "พุธ", "พฤหัสบดี", "ศุกร์", "เสาร์"].map((day, i) => <option key={day} value={i}>{day}</option>)}</select></label>
        <Field name="time" type="time" label="เวลาไทย" value={status.reminder?.time ?? "10:00"} /><Field name="minimum" type="number" label="ยอดขั้นต่ำที่ให้เตือน (บาท)" value={status.reminder?.minimum ?? "0"} /><Field name="overdueHours" type="number" label="แจ้งเงินที่กำลังไปฝากเกิน (ชั่วโมง)" value={String(status.reminder?.overdueHours ?? 24)} />
      </CashForm>}
      {tool === "correct" && <CashForm action="correct" epoch={status.epoch} sources={status.sources ?? []} isDisabled={!status.sources?.length} disabledReason="ยังไม่มีรายการหลังเปิดระบบให้แก้" label="ยืนยันการแก้ไข">
        <SourceChoice status={status} /><Field name="amount" type="number" label="ยอดที่ถูกต้อง (บาท)" /><Fund /><Field name="reason" label="เหตุผลที่แก้" /><Check name="confirmedInput" label="ตรวจรายการต้นทางและยอดที่ถูกต้องแล้ว" />
      </CashForm>}
      {tool === "adjust" && <CashForm action="adjust" epoch={status.epoch} fields={{ kind: "reconciliation" }} isDisabled={!status.movements.length} disabledReason="ยังไม่มีรายการเงินสดให้อ้างอิง" label="ยืนยันปรับยอดจากการนับ">
        <label className="flex flex-col gap-1 text-sm">อ้างอิงรายการเงินสด<select name="sourceOperationId" required className="ucom-field p-2" defaultValue=""><option value="" disabled>เลือกรายการอ้างอิง</option>{[...new Map(status.movements.map(item => [item.operationId, item])).values()].map(item => <option key={item.operationId} value={item.operationId}>{new Date(item.createdAt).toLocaleString("th-TH", { timeZone: "Asia/Bangkok" })} · ยอดตั้งต้น/รายการเงินสด · {formatMoney(item.amount)} บาท</option>)}</select></label>
        <Fund cashOnly /><Field name="amount" label="ยอดปรับ (บาท เพิ่มเป็นบวก ลดเป็นลบ)" />
        <Field name="reason" label="เหตุผล" /><Check name="confirmedInput" label="ยืนยันการเปลี่ยนเงินจริงและแหล่งเงินแล้ว" />
      </CashForm>}
      {tool === "refund" && <CashForm action="adjust" epoch={status.epoch} fields={{ kind: "refund" }} sources={sales} isDisabled={!sales.length} disabledReason="ยังไม่มีรายการขายหรือรายรับให้คืนเงิน" label="ยืนยันคืนเงินจริง">
        <SourceChoice status={{ ...status, sources: sales }} /><Fund cashOnly /><Field name="amount" label="ยอดคืน (บาท ใส่เป็นจำนวนลบ)" />
        <Field name="reason" label="เหตุผลที่คืน" /><Check name="confirmedInput" label="คืนเงินจริงให้ลูกค้าจากกองที่เลือกแล้ว" />
      </CashForm>}
    </Modal>}
  </section>;
}

function Fund({ cashOnly = false }: { cashOnly?: boolean }) {
  return <label className="text-sm">กองเงิน<select name="fund" className="ucom-field ml-2 p-2"><option value="drawer">เงินเก๊ะ</option><option value="pending">เงินรอฝาก</option>{!cashOnly && <option value="transfer">บัญชีร้าน</option>}</select></label>;
}

function SourceChoice({ status }: { status: CashStatus }) {
  return <label className="flex flex-col gap-1 text-sm">รายการต้นทาง<select name="sourceChoice" required className="ucom-field p-2" defaultValue=""><option value="" disabled>เลือกรายการ</option>{status.sources?.map(item => <option key={`${item.table}:${item.id}`} value={`${item.table}:${item.id}`}>{new Date(item.movedAt).toLocaleDateString("th-TH", { timeZone: "Asia/Bangkok" })} · {item.label} · {formatMoney(item.amount)} บาท · {item.fund === "drawer" ? "เก๊ะ" : item.fund === "pending" ? "รอฝาก" : "โอน"}</option>)}</select>{!status.sources?.length && <span className="text-ink-muted">ยังไม่มีรายการหลังเปิดระบบที่เลือกได้</span>}</label>;
}
