"use client";

import { useState } from "react";
import { PageFrame, PageSection } from "@/app/_components/PageFrame";

// ponytail: UI shell only per docs/pos/plan-edu-ai-full-reskin-2026-09-22.md —
// no RPC, no stock/status logic. Consignment carries real cash/stock rules
// (see the mockup's own note below) that need a grill-with-docs + ADR pass
// before anyone wires it up — out of scope here.
const outgoing = [
  { name: "iPhone XR 64GB", code: "...XXXX4432", shop: "ร้านสมศักดิ์มือถือ", since: "12 ก.ย.", price: 5900, status: "ฝากอยู่" as const },
  { name: "Samsung Note 10", code: "...XXXX7788", shop: "ร้านเจริญโฟน", since: "5 ก.ย.", price: 7500, status: "ขายแล้ว รอโอนเงิน" as const },
  { name: "iPhone 8 Plus", code: "...XXXX1120", shop: "ร้านสมศักดิ์มือถือ", since: "1 ก.ย.", price: 3200, status: "ขายแล้ว เคลียร์แล้ว" as const },
];

const STATUS_BADGE: Record<string, string> = {
  "ฝากอยู่": "bg-sunken text-ink-muted border border-border-strong",
  "ขายแล้ว รอโอนเงิน": "bg-[#392a0c] text-warning",
  "ขายแล้ว เคลียร์แล้ว": "bg-[#0f3322] text-success",
};

export default function ConsignmentsPage() {
  const [tab, setTab] = useState<"out" | "in">("out");

  return (
    <PageFrame
      page="consignments"
      eyebrow="STOCK STATUS / COMING SOON"
      title="ฝากขาย"
      description="ตัวอย่างหน้าตา — ยังไม่เปิดใช้งานจริง รอกติกาแบ่งเงิน/สถานะที่เจ้าของร้านยืนยันก่อน"
      actions={<span className="font-mono text-xs tracking-wide text-ink-muted">PREVIEW</span>}
    >
      <div className="ucom-surface !border-dashed rounded-2xl p-4 text-sm text-ink-muted">
        หน้านี้เป็นตัวอย่างดีไซน์เท่านั้น รายการทั้งหมดเป็นข้อมูลจำลอง ยังไม่เชื่อมระบบจริง — ฝากขายเป็น
        &quot;สถานะ&quot; ของเครื่อง ไม่ใช่สินค้าคนละชนิด: ฝากออก = เครื่องร้านเราไปวางขายที่ร้านอื่น,
        ฝากเข้า = เครื่องร้านอื่นมาวางขายที่เรา
      </div>

      <PageSection>
        <div className="flex items-center justify-between gap-3">
          <div className="flex gap-1 rounded-full bg-sunken p-1">
            <button
              type="button"
              onClick={() => setTab("out")}
              className={`rounded-full px-4 py-1.5 text-sm ${tab === "out" ? "bg-[#2c2a38] text-white font-semibold" : "text-ink-muted"}`}
            >
              📤 ฝากออก
            </button>
            <button
              type="button"
              onClick={() => setTab("in")}
              className={`rounded-full px-4 py-1.5 text-sm ${tab === "in" ? "bg-[#2c2a38] text-white font-semibold" : "text-ink-muted"}`}
            >
              📥 ฝากเข้า
            </button>
          </div>
          <button type="button" disabled className="ucom-primary !rounded-full px-4 py-2 text-sm font-semibold opacity-60">
            + ฝากเครื่องออก
          </button>
        </div>

        {tab === "out" ? (
          <div className="ucom-table-wrap">
            <table className="ucom-table">
              <thead>
                <tr>
                  <th className="p-2">เครื่อง</th>
                  <th className="p-2">ฝากที่ร้าน</th>
                  <th className="p-2">ฝากเมื่อ</th>
                  <th className="p-2 text-right">ราคาตั้ง</th>
                  <th className="p-2">สถานะ</th>
                </tr>
              </thead>
              <tbody>
                {outgoing.map((row) => (
                  <tr key={row.code}>
                    <td className="p-2">
                      <div className="font-medium">{row.name}</div>
                      <div className="text-xs text-ink-muted">IMEI {row.code}</div>
                    </td>
                    <td className="p-2 text-ink-muted">{row.shop}</td>
                    <td className="p-2 text-ink-muted">{row.since}</td>
                    <td className="p-2 text-right font-mono font-semibold">฿{row.price.toLocaleString()}</td>
                    <td className="p-2">
                      <span className={`inline-block rounded-full px-2.5 py-1 text-[11px] font-semibold ${STATUS_BADGE[row.status]}`}>
                        {row.status}
                      </span>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        ) : (
          <p className="rounded-2xl border border-dashed border-border p-8 text-center text-sm text-ink-muted">
            ยังไม่มีเครื่องฝากเข้า (ตัวอย่าง)
          </p>
        )}
      </PageSection>
    </PageFrame>
  );
}
