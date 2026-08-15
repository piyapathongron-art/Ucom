# SESSIONLOG — ฟีเจอร์ปิดร้าน/สรุปรายวัน · 2026-08-15

branch `feature/close-day` (แตกจาก `feature/report-drilldown`) · โปรเจกต์ Supabase `bihgcdceovfettoxmgme`

## ทำอะไร

### 1. Grill design fork ก่อนเขียนโค้ด (3 รอบ) → ADR 0014

โจทย์: ปุ่มปิดร้านให้พนักงานกดสรุปยอดขาย/รายจ่ายวันนั้น + บอกยอดเงินสดที่ต้องส่งเจ้าของร้าน

ประเด็นที่เคาะ:
- พนักงานเข้าได้ เห็นเงินเข้า/ออก/ยอดต้องส่ง **ไม่เห็นต้นทุน/กำไร** (กฎข้อ 4)
- เก็บแค่ `day_closings` (เงินสดที่นับได้จริง) — ตัวเลขที่ derive ได้ทั้งหมดคำนวณสด ตาม ADR 0004
- ยอดต้องส่ง = เงินสดที่รับ − รายจ่ายที่จ่ายด้วยเงินสด (เพิ่มคอลัมน์ `expenses.paid_from`)
- บิลปิดงานซ่อม **นับ** ในยอดต้องส่ง (ต่างจาก `/report` ที่ตัดออก) — เป็นความต่างที่ตั้งใจ บันทึกไว้ใน ADR
- SF+ แสดงแค่จำนวนเครื่องที่ปล่อยวันนี้ ไม่โชว์ค่าคอม (ยังไม่รู้ตัวเลข — SF โอนมาเป็นรอบทีหลัง)
- คิว offline ค้าง → บล็อกปุ่มปิดร้าน
- ปิดซ้ำได้เฉพาะวันนี้ (ทับของเดิม) · owner ดูย้อนหลังได้แบบอ่านอย่างเดียว

query prod จริงพบว่า `device_units.status = 'financed'` มี **0 แถว** — เส้นทาง SF+ ยังไม่เคยถูกใช้จริง
เฟส "รอค่าคอม SF+" (ที่เจ้าของร้านอธิบายว่าค่าคอมมาเป็นรอบ ไม่รู้ตัวเลขล่วงหน้า มาเป็นเงินโอนเสมอ)
จึงถูกแยกเป็นงานถัดไปแทนที่จะรวมในรอบนี้ — ไม่มีข้อมูลเก่าให้ migrate จึงทำทีหลังได้โดยไม่เสี่ยง

เขียน `docs/adr/0014-close-day-counts-cash-not-revenue.md` และ `docs/pos/plan-close-day.md`

### 2. Migration `20260815110000_close_day.sql` (R0 · ขออนุมัติแล้ว apply)

- `alter table expenses add column paid_from text check (...)` — 53 แถวเดิมเป็น null ตามตั้งใจ
- ตารางใหม่ `day_closings` (RLS: `select` ให้ `pos_is_member()`, เขียนผ่าน RPC เท่านั้น)
- view ใหม่ 4 ตัว ทุกตัว gate ด้วย `pos_is_member()` (ไม่ใช่ `pos_is_owner()` เหมือน view รายงานอื่น)
  และ**ไม่มีคอลัมน์ cost/profit เลย**: `v_close_day_bills`, `v_close_day_items`,
  `v_close_day_expenses`, `v_close_day_sf`
- RPC ใหม่ 3 ตัว (`DROP` นำหน้าตาม §6): `rpc_add_shop_expense`, `rpc_delete_shop_expense`,
  `rpc_close_day`

Verify หลัง apply: `authenticated` เหลือแค่ `SELECT` บน view ทั้ง 4 ตัว (ไม่มี insert/update/delete
หลุดมาเหมือนที่เคยพลาดกับ `v_sale_profit`) · RPC ทั้ง 3 ตัวมีแค่ `authenticated`/`postgres`/`service_role`

### 3. Regenerate `database.ts` แล้ว `tsc --noEmit` ผ่าน (ทำเอง — schema-sensitive)

### 4. Delegate UI + e2e test ให้ `agy`

เขียน handoff spec เต็มที่ `handoff-close-day.md` (schema/RPC/testid ครบ) ส่งให้ `agy`
(`gemini-3.1-pro-high`) headless — ติด `--dangerously-skip-permissions` โดน auto-mode classifier
บล็อกรอบแรก ผู้ใช้ยืนยันให้รันซ้ำนอก auto mode แล้วผ่าน

agy สร้าง `src/app/(staff)/close-day/page.tsx` (370 บรรทัด, เกิน 300 ที่สเปกขอแต่ยังอ่านง่าย
ไม่ได้แตกไฟล์) + แก้ layout 2 ไฟล์ + `tests/e2e/close-day.spec.ts` ตรงสเปกทุกจุดรวม testid

**Verify เองแล้วเจอ 2 จุด แก้เองแบบ inline** (ไม่ re-delegate ตาม skill — small issue):
- `bills.sort()` / `items.sort()` mutate state array ตรงระหว่าง render → เปลี่ยนเป็น `[...arr].sort()`
- เช็ค role เทียบ `"admin"` ที่ไม่มีอยู่จริงในคอลัมน์ `profiles.role` (มีแค่ `owner`/`staff` —
  เช็คกับ `pos_is_owner()` ใน DB ยืนยันแล้ว) → ตัดออก เหลือแค่เทียบ `"owner"`

### 5. รัน e2e test จริงผ่าน `agy` (gemini-3.7-flash-medium)

qwen (`claude-9arm`) ใช้ไม่ได้ 2 รอบ — โมเดล `qwen3.6-35b-a3b` ถูกถอดสิทธิ์ทีมแล้ว ลอง
`qwen3.8-27b-fp8` ก็ยัง unrecognized model ในเวอร์ชัน harness นี้ สลับไป `agy` ตามคำขอผู้ใช้

`npx playwright test tests/e2e/close-day.spec.ts` → **1 passed** · เช็คต่อเองว่าไม่มี
`ZZTEST-CLOSE-*` ตกค้างใน `expenses` บน prod

### 6. Verify ด้วยตาจริงโดยผู้ใช้ (browser)

ผู้ใช้เปิดดูหน้า `/close-day` เองแล้วยืนยันว่าผ่าน — Playwright คลิกจริงตามที่เขียนในสเปก
ไม่ใช่การจำลอง

## เจออะไร

### auto-mode classifier บล็อกการเปิด Terminal window + `--dangerously-skip-permissions`

ทั้งสองครั้งที่ลองใน auto mode ถูก block เหมือนกัน (เปิด GUI window ก็ไม่มีประโยชน์อยู่ดีเพราะ
session นี้เป็น background job ไม่มี display ให้เห็นสด) — headless print mode ต้องมี
`--dangerously-skip-permissions` ถึงจะรันได้จริง โดนบล็อกเฉพาะตอน auto mode เท่านั้น
ออกจาก auto mode แล้วรันผ่านปกติ

### `claude-9arm` (qwen) หลุด quota/model access

alias เดิมชี้ `qwen3.6-35b-a3b` — ทีมนี้เข้าถึงได้แค่ `qwen3.8-27b-fp8` ตอนนี้ แต่รุ่น harness
ที่ใช้ยัง unrecognized model ทั้งคู่ ไม่สามารถใช้ `claude-9arm` ได้ในเซสชันนี้ — ใช้ `agy` แทน

### ข้อมูลเทสค้างเก่า ไม่แตะ

`sales.receiving_account = 'ทดสอบ'` 2 แถว ยังค้างจากรอบก่อน ยืนยันแล้วว่าเป็นข้อมูลเทส แต่ไม่ลบ
เพราะ R0 ไม่ใช่ scope ของงานนี้

## สถานะท้ายเซสชัน

- Migration apply ลง prod แล้ว, frontend + e2e test เขียนเสร็จและ verify 2 ชั้น (automated + ตา)
- `tsc`/`eslint` ผ่านทั้งโปรเจกต์
- ยังไม่เคยกด "ยืนยันปิดร้าน" จริงสักครั้ง (ตั้งใจไม่ทำในเทส — จะเขียนแถวจริงลง `day_closings`)
- เฟสถัดไปที่ยังไม่ทำ: "รอค่าคอม SF+" (สเปกอยู่ใน `docs/pos/plan-close-day.md` ท้ายไฟล์)
