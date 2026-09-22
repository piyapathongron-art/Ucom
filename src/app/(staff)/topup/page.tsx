import { PageFrame, PageSection } from "@/app/_components/PageFrame";

// ponytail: UI shell only per docs/pos/plan-edu-ai-full-reskin-2026-09-22.md —
// no RPC, no wallet math, static demo numbers. Product decided top-up stays
// "coming soon" until it's wired for real; see docs/pos/plan-remaining.md.
const wallets = [
  { carrier: "True", dot: "🔴", balance: 17550, in: 50000, out: 32450 },
  { carrier: "AIS", dot: "🟢", balance: 18200, in: 40000, out: 21800 },
  { carrier: "Dtac", dot: "🔵", balance: 900, in: 20000, out: 19100, low: true },
];

const recent = [
  { time: "14:10", carrier: "True", dot: "🔴", amount: 300, commission: 9, staff: "สมชาย" },
  { time: "13:42", carrier: "AIS", dot: "🟢", amount: 100, commission: 3, staff: "สมชาย" },
  { time: "11:05", carrier: "Dtac", dot: "🔵", amount: 500, commission: 15, staff: "มานี" },
];

export default function TopupPage() {
  return (
    <PageFrame
      page="topup"
      eyebrow="WALLET / COMING SOON"
      title="เติมเงิน"
      description="ตัวอย่างหน้าตา — ยังไม่เปิดใช้งานจริง รอกติกาวอลเล็ต/ค่าคอมที่เจ้าของร้านยืนยันก่อน"
      actions={<span className="font-mono text-xs tracking-wide text-ink-muted">PREVIEW</span>}
    >
      <div className="ucom-surface !border-dashed rounded-2xl p-4 text-sm text-ink-muted">
        หน้านี้เป็นตัวอย่างดีไซน์เท่านั้น ปุ่มและตัวเลขทั้งหมดเป็นข้อมูลจำลอง ยังไม่เชื่อมระบบจริง
      </div>

      <PageSection title="ยอดวอลเล็ต" description="คำนวณสดจากเงินที่เติมเข้าลบต้นทุนที่ขายไปแล้ว (ตัวอย่าง)">
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
          {wallets.map((w) => (
            <div key={w.carrier} className="ucom-surface !border-dashed rounded-2xl p-4 space-y-2">
              <span className="flex items-center gap-2 text-sm font-semibold text-ink">
                <span>{w.dot}</span>{w.carrier}
              </span>
              <p className="font-mono text-2xl font-bold text-ink">฿{w.balance.toLocaleString()}</p>
              <p className="text-xs text-ink-muted">เติมเข้า ฿{w.in.toLocaleString()} · ขายไปแล้ว ฿{w.out.toLocaleString()}</p>
              {w.low ? (
                <span className="inline-block rounded-full bg-[#392a0c] px-2.5 py-0.5 text-[11px] font-semibold text-warning">
                  วอลเล็ตใกล้หมด
                </span>
              ) : (
                <p className="text-xs font-medium text-success">มีค่าคอมสะสมวันนี้</p>
              )}
            </div>
          ))}
        </div>
      </PageSection>

      <div className="grid grid-cols-1 gap-6 lg:grid-cols-[22rem_1fr]">
        <PageSection title="เติมเงินให้ลูกค้า">
          <div className="ucom-surface rounded-2xl p-5 space-y-4">
            <div className="flex gap-2">
              {wallets.map((w, i) => (
                <button
                  key={w.carrier}
                  type="button"
                  disabled
                  className={`flex-1 rounded-full py-2.5 text-xs font-semibold ${
                    i === 0 ? "bg-[#2c2a38] text-white" : "border border-dashed border-border-strong text-ink-muted"
                  }`}
                >
                  {w.dot} {w.carrier}
                </button>
              ))}
            </div>
            <label className="block space-y-1.5">
              <span className="block text-[0.68rem] font-semibold uppercase tracking-[0.06em] text-ink-muted">จำนวนเงิน</span>
              <input disabled value="฿300" className="ucom-field w-full px-3.5 py-2.5 text-sm font-semibold" />
            </label>
            <div className="border-t border-dashed border-border pt-3 space-y-1.5 text-sm">
              <div className="flex justify-between text-ink-muted">
                <span>ค่าคอมของร้าน (3%)</span>
                <span className="font-mono font-semibold text-success">฿9.00</span>
              </div>
            </div>
            <button type="button" disabled className="ucom-primary w-full !rounded-full px-4 py-3.5 text-sm font-semibold opacity-60">
              ยืนยันเติมเงิน · ฿300
            </button>
          </div>
        </PageSection>

        <PageSection title="รายการเติมเงินล่าสุด (ตัวอย่าง)">
          <div className="ucom-table-wrap">
            <table className="ucom-table">
              <thead>
                <tr>
                  <th className="p-2">เวลา</th>
                  <th className="p-2">ค่าย</th>
                  <th className="p-2 text-right">จำนวนเงิน</th>
                  <th className="p-2 text-right">ค่าคอม</th>
                  <th className="p-2">พนักงาน</th>
                </tr>
              </thead>
              <tbody>
                {recent.map((r) => (
                  <tr key={r.time}>
                    <td className="p-2 text-ink-muted">{r.time}</td>
                    <td className="p-2 font-medium">{r.dot} {r.carrier}</td>
                    <td className="p-2 text-right font-mono font-semibold">฿{r.amount.toLocaleString()}</td>
                    <td className="p-2 text-right font-mono font-semibold text-success">฿{r.commission.toFixed(2)}</td>
                    <td className="p-2 text-ink-muted">{r.staff}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </PageSection>
      </div>
    </PageFrame>
  );
}
