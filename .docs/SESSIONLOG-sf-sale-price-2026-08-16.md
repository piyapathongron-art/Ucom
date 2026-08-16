# SESSIONLOG — SF ไม่มีวันครบกำหนด · เพิ่มราคาขาย · 2026-08-16

branch `feature/sf-sale-price` · Supabase project `bihgcdceovfettoxmgme`

## สิ่งที่เคาะแล้ว (grilling)

- flow SF จริงคือ 2 ทางออกเท่านั้น: ผ่อน SF (เดิมถูกต้องอยู่แล้ว) หรือขายสดปกติ — ไม่มีวันครบกำหนดบังคับ
- ราคาขายเก็บที่ `device_units.sale_price` (คอลัมน์ใหม่) ตั้งตอนรับบิล SF หรือแก้ที่หน้าสต็อก และแก้ได้อีก
  ทีตอนขายจริงใน POS · `list_price` คงความหมายเดิม = หนี้ที่ต้องจ่ายคืน SF
- ขายสดเครื่อง SF ลงต้นทุนอัตโนมัติ = `list_price` และประทับ `sf_paid_full_at`
- ลบ `sf_orders.due_date` และ `v_sf_due.days_left` ออกทั้งระบบ — R0 ตรวจก่อนว่า production มี `sf_orders`
  0 แถว จึงกระทบข้อมูลจริง 0 แถว ก่อนขออนุมัติลบ

## Migration ที่ apply

`supabase/migrations/20260816102841_sf_sale_price_no_due_date.sql` (apply ผ่าน MCP ตรงไปยัง production
เพราะ repo ไม่มี local Supabase stack — `.env` ทุกตัวชี้ prod):

- เพิ่ม `device_units.sale_price numeric(12,2)`
- แก้ `v_pos_catalog`, `v_pos_stock` device branch ให้โชว์ `coalesce(sale_price, list_price)`
- `create or replace function rpc_create_sale` — device branch ลง `cost`/`sf_paid_full_at` อัตโนมัติเมื่อ
  `acquisition = 'sf_credit'`
- `rpc_upsert_device`, `rpc_receive_sf_order` รับ `sale_price` เพิ่ม, `rpc_receive_sf_order` เลิกอ่าน `due_date`
- `drop view v_sf_due; create view` ใหม่ตัด `due_date`/`days_left` ออก
- `alter table sf_orders drop column due_date` (0 แถวกระทบ ยืนยันด้วย `select count(*)` ก่อน apply)

หลัง apply: ยืนยัน schema จริงตรงกับไฟล์ (columns, view shape) + `get_advisors` ไม่มี finding ใหม่ที่ไม่ใช่
pattern เดิมของ repo (ทุก view/RPC เป็น `SECURITY DEFINER` โดยตั้งใจ) + regenerate
`src/lib/types/database.ts` ด้วย codegen

## โค้ด frontend

- `stock/SfIntake.tsx` — ตัดฟอร์มวันครบกำหนดออก, เพิ่มช่อง `sale_price` ต่อแถวเครื่อง, เปลี่ยน placeholder
  ราคาป้ายเป็น "ราคาป้าย SF", ตัดคอลัมน์วันครบกำหนดในรายการบิลค้าง
- `stock/page.tsx` — `submitSfIntake`/`saveDevice` ส่ง `sale_price`, ตัด `due_date` ออกจาก payload
- `stock/StockTable.tsx` + `useStockRowEdit.ts` — `DeviceSave.list_price`/`sale_price` เป็น optional, แก้ราคา
  ที่หน้าสต็อกของเครื่อง `sf_credit` เขียนไปที่ `sale_price` แทน `list_price` (เพราะ `v_pos_stock.price` โชว์
  `coalesce(sale_price, list_price)` แล้ว ตัวเลขที่เห็นคือราคาขาย ไม่ใช่หนี้)
- `pos/Cart.tsx` — ราคาเครื่องในตะกร้าแก้ไขได้ (`<input type="number">`, `data-testid="cart-device-price"`)
- `pos/Catalog.tsx` — เพิ่ม `data-testid="sell-cash-device"` ให้ปุ่ม "ขายสด" (สำหรับเทส)

## เอกสาร

- `docs/adr/0017-sf-device-exits-by-instalment-or-cash-sale.md` (ใหม่)
- `docs/adr/0002-sf-plus-is-not-revenue.md` — เพิ่มหมายเหตุ superseded ชี้ไป 0017
- `docs/CONTEXT.md` — แก้ glossary `SF Credit`, `SF Order`

## Verification

- **SQL**: ยืนยัน schema หลัง apply ตรงกับไฟล์ migration ✅
- **tsc + eslint**: `npx tsc --noEmit`, `npx eslint .` ผ่านทั้งคู่ ไม่มี error ✅
- **e2e**: `npx playwright test tests/e2e/sf.spec.ts` — ผ่านทั้ง 2 เคส (ผ่อน SF เดิม + เคสใหม่ "cash sale of
  an SF device books cost = list_price, not 0") ✅ รันผ่าน dev server จริงที่ localhost:3002 ซึ่งชี้ไปยัง
  production project เดียวกัน
- **cleanup**: teardown ลบข้อมูลทดสอบหมด ยืนยันด้วย count — `ZZTEST` devices/orders = 0 ✅
- **browser (manual)**: **ยังไม่ได้ทำ** — ต้องถามผู้ใช้ก่อนทุกครั้งตาม working agreement ยังไม่ได้ถาม/รับคำตอบ
  ในเซสชันนี้ ดังนั้น **PR ควรเปิดเป็น Draft** จนกว่าจะได้ยืนยันผ่าน browser จริงหรือ checklist

## สถานะ

- โค้ดอยู่บน branch `feature/sf-sale-price` ยังไม่ commit/push (รอสั่ง)
- ไม่มี R0 อื่นค้าง — migration apply ไปแล้วตามที่ขออนุมัติ
