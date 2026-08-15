# แผน — SF+ รอค่าคอมและรับรู้รายได้ตอนเงินเข้า

สถานะ: เคาะ design แล้ว 15 ส.ค. 2026 · ADR [0016](../adr/0016-sf-commission-is-recognized-on-receipt.md) · risk = **R1** ก่อน apply, **R0** ตอน apply production migration

## เป้าหมาย

ให้ staff ปล่อยเครื่อง SF+ ได้โดยไม่ต้องเดาค่าคอม แล้วบันทึกค่าคอมต่อเครื่องพร้อมวันที่เงินเข้าจริงภายหลัง
รายงาน owner รับรู้เฉพาะเงินที่เข้าจริง ขณะที่หน้าปิดร้านยังนับเฉพาะจำนวนเครื่องที่ปล่อย

## ขอบเขตที่เคาะแล้ว

- หนึ่ง `Commission Receipt` ต่อหนึ่งเครื่อง; ไม่มี batch หรือเลขอ้างอิงการโอน
- `null` = รอค่าคอม, `0` = ยืนยันว่าไม่มีค่าคอม และ `0` ไม่ขึ้น `/report`
- staff/owner เข้า `/sf-commissions` และบันทึกได้; owner เท่านั้นแก้ไขผ่าน void + replacement ที่มีเหตุผล
- วันเงินเข้าเลือกย้อนหลังหรือวันนี้ได้ แต่ห้ามวันอนาคต
- staff เห็นค่าคอมเฉพาะหน้าจอนี้; `/report`, cost และกำไรอื่นยัง owner-only

## Gate 0 — ห้ามข้ามก่อนเขียนหรือ apply migration

1. Authenticate Supabase connector แบบ read-only แล้ว query production schema: `device_units` columns/constraints,
   `rpc_finance_device` overloads/grants, report-view definitions และจำนวน `financed` แยกตามมี/ไม่มี commission
2. ถ้ามีเครื่อง `financed` เดิมที่มี `commission` อยู่: **หยุด** — วันเงินเข้าจริง derive ไม่ได้จากข้อมูลเดิม
   ต้องให้เจ้าของร้านระบุวิธีจัดการแต่ละแถวก่อน ไม่ backfill ด้วย `financed_at`
3. บันทึกผล query ใน session log แล้วจึงสร้าง migration ด้วย `supabase migration new sf_commission_receipts`

## งาน implementation

### 1. Database contract และ migration

ไฟล์ migration ต้องสร้างด้วย `supabase migration new sf_commission_receipts`; ใช้ชื่อไฟล์ที่คำสั่งสร้างขึ้นจริง

- สร้าง `public.sf_commission_receipts`: `id`, `device_unit_id`, `amount numeric(12,2)`, `received_on date`,
  `recorded_by`, `recorded_at`, `voided_at`, `voided_by`, `void_reason`; เปิด RLS แต่ไม่มี direct-write policy
- สร้าง unique partial index ให้มี receipt ที่ยังใช้งานอยู่ได้เพียงหนึ่งรายการต่อเครื่อง
- ถอด `device_financed_needs_commission` และย้าย source of truth ออกจาก `device_units.commission`
- `drop function if exists public.rpc_finance_device(uuid, numeric)` ก่อนสร้าง `rpc_finance_device(uuid)`
  ที่ set แค่ `status = 'financed'` และ `financed_at = now()` สำหรับ SF-credit in-stock device
- สร้าง RPC member-only สำหรับบันทึก receipt: amount ต้องไม่ติดลบ, date ต้องไม่เกินวัน Bangkok ปัจจุบัน,
  device ต้อง financed และยังไม่มี active receipt
- สร้าง RPC owner-only สำหรับ correction: void receipt เดิมพร้อมเหตุผลที่ไม่ว่าง แล้วสร้าง replacement
  ใน transaction เดียว
- สร้าง member-gated read views สำหรับรายการรอ/receipt และแก้ SF pipe ของ `v_report_entries` ให้ join active receipt
  ยอดมากกว่า `0` และ bucket ด้วย `received_on`; คง `v_close_day_sf` ไม่แตะ
- revoke/grant ทุก view และ `SECURITY DEFINER` function ด้วย exact signature เหมือน migration ก่อนหน้า

### 2. Types และ UI

ไฟล์ที่จะเพิ่ม/แก้:

- `src/lib/types/database.ts` — regenerate หลัง migration; ต้องไม่มี `p_commission` ใน `rpc_finance_device`
- `src/app/(staff)/pos/Catalog.tsx`, `src/app/(staff)/pos/page.tsx` — เอาฟอร์ม/argument ค่าคอมออกจากการปล่อยผ่อน
- `src/app/(staff)/sf-commissions/page.tsx` และ leaf component ตามความจำเป็น — รายการรอ, ฟอร์มยอด/วันที่,
  รายการที่ยืนยันแล้ว; owner เท่านั้นเห็น correction control
- `src/app/(staff)/layout.tsx`, `src/app/(owner)/layout.tsx` — เพิ่มลิงก์ `ค่าคอม SF+`; ไม่เพิ่ม `/sf-commissions`
  ใน `ownerOnlyPrefixes` เพราะ staff เข้าได้
- `src/app/(owner)/report/types.ts` และ `DayEntries.tsx` เฉพาะจุดที่ต้องแสดง label/detail ใหม่จาก receipt

### 3. Tests และ verification

- แก้ `tests/e2e/sf.spec.ts` ให้พิสูจน์: staff ปล่อยผ่อนโดยไม่กรอกค่าคอม → pending; report ไม่เพิ่ม;
  staff บันทึก `250` วันที่วันนี้ → owner report เพิ่มเฉพาะ `sf_commission`; receipt `0` ปิด pending แต่ report ไม่เพิ่ม;
  staff แก้ receipt ไม่ได้ และ owner correction มีผลตามข้อมูลล่าสุด
- แก้ `tests/e2e/global-teardown.ts` ให้ลบ `sf_commission_receipts` ของ device `ZZTEST%` ก่อนลบ `device_units`
- ก่อน apply: dry-run schema/view comparison และ security advisor; หลัง apply: regenerate types, `tsc --noEmit`, `npm run lint`,
  focused `npx playwright test tests/e2e/sf.spec.ts --reporter=list`, และ browser verification ของ POS, `/sf-commissions`, `/report`
- การ apply migration, E2E ที่เขียน/ลบข้อมูล prod และ browser verification ต้องขออนุมัติแยกตามกติกา R0
