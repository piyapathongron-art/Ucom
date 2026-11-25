import type { CashStatus } from "@/lib/cash/types";
import { formatMoney } from "@/lib/cash/money";
import CashRecovery from "./cash-recovery";
import DaySelection from "./day-selection";
import HandoverCard from "./handover-card";
import { CARD } from "./cash-styles";

const STEP = "flex size-8 shrink-0 items-center justify-center rounded-full bg-muted font-bold";

export default function CashDeposit({ status, userName }: { status: CashStatus; userName?: string }) {
  const ongoing = status.handovers.filter(item => ["handed_over", "disputed"].includes(item.state));
  const reported = status.handovers.filter(item => item.state === "reported");
  const isMoneyOut = status.handovers.some(item => item.state === "handed_over");
  return <main className="mx-auto w-full max-w-lg space-y-5 p-4" data-testid="cash-deposit">
    <header><p className="mb-1 text-sm font-semibold text-muted-foreground">Ucom · บัญชีร้าน</p><h1 className="text-2xl font-bold">ฝากเงินร้าน</h1></header>
    <CashRecovery />
    {!status.epoch ? <>
      <section className={`${CARD} space-y-2`} role="status">
        <h2 className="text-lg font-bold">เจ้าของร้านกำลังเตรียมยอดเงินเริ่มต้น</h2>
        <p className="text-sm text-muted-foreground">ยังฝากเงินผ่านหน้านี้ไม่ได้ กรุณาติดต่อเจ้าของร้าน เมื่อเตรียมยอดเรียบร้อยแล้วจึงเริ่มได้</p>
      </section>
      <ol className="space-y-4" aria-label="ขั้นตอนฝากเงิน">
        <li className="flex gap-3"><span aria-hidden="true" className={STEP}>1</span><div><h2 className="font-bold">เลือกวันและนำเงินออกไปฝาก</h2><p className="text-sm text-muted-foreground">เลือกยอดค้างฝาก แยกเงินเข้าเก๊ะ และยืนยันก่อนหยิบเงินออก</p></div></li>
        <li className="flex gap-3"><span aria-hidden="true" className={STEP}>2</span><div><h2 className="font-bold">แนบสลิปและส่งสรุปเข้า LINE</h2><p className="text-sm text-muted-foreground">แจ้งยอดที่ฝากจริง หลังฝากเงินเรียบร้อยแล้ว</p></div></li>
      </ol>
    </> : <>
      <p className="text-sm text-muted-foreground tabular-nums">เงินเก๊ะ ฿{formatMoney(status.drawer)} <span className="mx-1" aria-hidden="true">·</span> เงินรอฝากในร้าน ฿{formatMoney(status.available)}</p>
      {ongoing.length > 0 && <section className="space-y-3"><h2 className="text-lg font-bold">2 · แจ้งผลเงินที่นำออกไปฝาก</h2><p className="text-sm text-muted-foreground">ทำรายการที่ถือเงินอยู่ให้เรียบร้อยก่อนเริ่มรายการใหม่</p>{ongoing.map(item => <HandoverCard key={item.id} item={item} status={status} isCompact />)}</section>}
      {reported.length > 0 && <section className="space-y-3"><h2 className="text-lg font-bold">แจ้งฝากแล้ว รอเจ้าของตรวจ</h2>{reported.map(item => <HandoverCard key={item.id} item={item} status={status} isCompact />)}</section>}
      {!isMoneyOut && <section className={`${CARD} space-y-3`}>
        <h2 className="text-lg font-bold">1 · เลือกวันและนำเงินออกไปฝาก</h2>
        <p className="text-sm text-muted-foreground">ยืนยันรายการนี้ก่อนหยิบเงินออกจากร้าน หลังฝากแล้วจึงแนบสลิปในขั้นตอนที่ 2</p>
        {status.dayAllocationsEnabled ? <DaySelection key={`${status.epoch}:${status.version}`} status={status} userName={userName} isCompact />
          : <p role="status" className="text-sm text-muted-foreground">เจ้าของร้านกำลังเตรียมรายการวัน กรุณาติดต่อเจ้าของร้านก่อนนำเงินออก</p>}
      </section>}
    </>}
  </main>;
}
