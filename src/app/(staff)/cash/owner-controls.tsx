"use client";

import { useState } from "react";
import type { CashStatus } from "@/lib/cash/types";
import { Modal } from "@/app/_components/Modal";
import CashForm, { Check, Field } from "./cash-form";
import { formatMoney } from "@/lib/cash/money";
import { CARD, FIELD_LABEL, SELECT } from "./cash-styles";

export default function OwnerControls({ status }: { status: CashStatus }) {
  const [tool, setTool] = useState<string | null>(null);
  if (!status.isOwner) return null;
  if (!status.epoch && !status.activationReady) return <section className={CARD}><h2 className="text-lg font-bold">ระบบสองกองเงิน</h2><p className="mt-2 text-sm">ยังไม่เปิดใช้งานจนกว่าจะตรวจครบและอนุมัติ</p></section>;
  if (!status.epoch) return <section className={CARD}><h2 className="mb-2 text-lg font-bold">เปิดยอดตั้งต้นบนเครื่องรับเงินหลัก</h2>
    <p className="mb-4 text-sm text-muted-foreground">หยุดรับ/จ่ายเงิน ซิงก์คิวทุกบิลจนเซิร์ฟเวอร์รับครบ แล้วนับเงินสองกองบนเครื่อง POS หลัก ข้อมูลเก่าที่ยังไม่ซิงก์ต้องจัดประเภทก่อนเปิดใช้</p>
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
  return <section className={CARD}>
    <h2 className="mb-1 text-lg font-bold">เครื่องมือเจ้าของ</h2>
    <ul className="divide-y divide-border">{tools.map(item => <li key={item.id}>
      <button type="button" className="flex min-h-12 w-full items-center justify-between gap-3 py-3 text-left hover:text-primary" onClick={() => setTool(item.id)}>
        <span><span className="block text-sm font-semibold">{item.title}</span><span className="block text-sm text-muted-foreground">{item.hint}</span></span>
        <span aria-hidden="true" className="text-lg text-muted-foreground">›</span>
      </button>
    </li>)}</ul>
    {current && <Modal open onClose={() => setTool(null)} title={current.title} size="md" footer={<button type="button" className="ucom-secondary h-12 px-6" onClick={() => setTool(null)}>ปิด</button>}>
      {tool === "reminder" && <CashForm action="reminder" epoch={status.epoch} label="บันทึกการเตือน">
        <label className={FIELD_LABEL}>สถานะ<select name="enabled" defaultValue={String(status.reminder?.enabled ?? false)} className={SELECT}><option value="false">ปิด</option><option value="true">เปิด</option></select></label>
        <label className={FIELD_LABEL}>วัน<select name="weekday" defaultValue={status.reminder?.weekday ?? 5} className={SELECT}>{["อาทิตย์", "จันทร์", "อังคาร", "พุธ", "พฤหัสบดี", "ศุกร์", "เสาร์"].map((day, i) => <option key={day} value={i}>{day}</option>)}</select></label>
        <Field name="time" type="time" label="เวลาไทย" value={status.reminder?.time ?? "10:00"} /><Field name="minimum" type="number" label="ยอดขั้นต่ำที่ให้เตือน (บาท)" value={status.reminder?.minimum ?? "0"} /><Field name="overdueHours" type="number" label="แจ้งเงินที่กำลังไปฝากเกิน (ชั่วโมง)" value={String(status.reminder?.overdueHours ?? 24)} />
      </CashForm>}
      {tool === "correct" && <CashForm action="correct" epoch={status.epoch} sources={status.sources ?? []} isDisabled={!status.sources?.length} disabledReason="ยังไม่มีรายการหลังเปิดระบบให้แก้" label="ยืนยันการแก้ไข">
        <SourceChoice status={status} /><Field name="amount" type="number" label="ยอดที่ถูกต้อง (บาท)" /><Fund /><Field name="reason" label="เหตุผลที่แก้" /><Check name="confirmedInput" label="ตรวจรายการต้นทางและยอดที่ถูกต้องแล้ว" />
      </CashForm>}
      {tool === "adjust" && <CashForm action="adjust" epoch={status.epoch} fields={{ kind: "reconciliation" }} isDisabled={!status.movements.length} disabledReason="ยังไม่มีรายการเงินสดให้อ้างอิง" label="ยืนยันปรับยอดจากการนับ">
        <label className={FIELD_LABEL}>อ้างอิงรายการเงินสด<select name="sourceOperationId" required className={SELECT} defaultValue=""><option value="" disabled>เลือกรายการอ้างอิง</option>{[...new Map(status.movements.map(item => [item.operationId, item])).values()].map(item => <option key={item.operationId} value={item.operationId}>{new Date(item.createdAt).toLocaleString("th-TH", { timeZone: "Asia/Bangkok" })} · ยอดตั้งต้น/รายการเงินสด · {formatMoney(item.amount)} บาท</option>)}</select></label>
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
  return <label className={FIELD_LABEL}>กองเงิน<select name="fund" className={SELECT}><option value="drawer">เงินเก๊ะ</option><option value="pending">เงินรอฝาก</option>{!cashOnly && <option value="transfer">บัญชีร้าน</option>}</select></label>;
}

function SourceChoice({ status }: { status: CashStatus }) {
  return <label className={FIELD_LABEL}>รายการต้นทาง<select name="sourceChoice" required className={SELECT} defaultValue=""><option value="" disabled>เลือกรายการ</option>{status.sources?.map(item => <option key={`${item.table}:${item.id}`} value={`${item.table}:${item.id}`}>{new Date(item.movedAt).toLocaleDateString("th-TH", { timeZone: "Asia/Bangkok" })} · {item.label} · {formatMoney(item.amount)} บาท · {item.fund === "drawer" ? "เก๊ะ" : item.fund === "pending" ? "รอฝาก" : "โอน"}</option>)}</select>{!status.sources?.length && <span className="font-normal text-muted-foreground">ยังไม่มีรายการหลังเปิดระบบที่เลือกได้</span>}</label>;
}
