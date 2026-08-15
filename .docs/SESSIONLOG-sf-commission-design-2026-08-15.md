# SESSIONLOG — SF+ รอค่าคอม · design & implementation gate · 2026-08-15

branch `feature/close-day` · Supabase project `bihgcdceovfettoxmgme`

## สิ่งที่เคาะแล้ว

- SF โอนค่าคอมแยกต่อเครื่อง; ไม่มี batch หรือเลขอ้างอิงการโอน
- `Commission Receipt` หนึ่งรายการต่อเครื่อง: `null` คือรอ, `0` คือยืนยันแล้วว่าไม่มีค่าคอม
- staff และ owner เข้า `/sf-commissions` และบันทึกยอดกับวันที่เงินเข้าจริงได้; ย้อนหลัง/วันนี้ได้ แต่ห้ามวันอนาคต
- owner เท่านั้นแก้ไข โดย void รายการเดิมพร้อมเหตุผลและสร้าง replacement เพื่อคง audit history
- `/report` รับรู้เฉพาะ receipt ที่ยังใช้งานและยอดมากกว่า 0 ในวันที่เงินเข้า; `v_close_day_sf` ยังคงนับเครื่องจาก `financed_at`
- staff เห็นค่าคอมเฉพาะ `/sf-commissions`; ยังคงเข้า `/report` และข้อมูลต้นทุนไม่ได้

## เอกสารที่เพิ่ม/แก้

- `docs/adr/0016-sf-commission-is-recognized-on-receipt.md`
- `docs/pos/plan-sf-commission-receipts.md`
- `docs/CONTEXT.md` (Commission และ Commission Receipt)
- `docs/pos/plan-close-day.md` (link ไปยังแผนที่เคาะแล้ว)

## Blocker ก่อน implementation

Supabase connector ปฏิเสธ `execute_sql` ด้วย permission error แม้เป็น query read-only จึงไม่ได้ query
production schema/current data และไม่ได้อ่านหรือพิมพ์ secret จาก `.env.local` เพื่อข้ามสิทธิ์

ต้อง authorize connector ให้ query project `bihgcdceovfettoxmgme` แบบ read-only ก่อน Gate 0:

1. ตรวจ columns/constraints ของ `device_units`, overload/grant ของ `rpc_finance_device`, และ view report จริง
2. นับ `financed` rows แยกตามมี/ไม่มี commission
3. หากมี commission เดิม ห้ามเดาวันเงินเข้าเพื่อ backfill — หยุดขอคำสั่งเจ้าของร้านก่อน

## สถานะอื่น

- ผู้ใช้ยืนยัน browser check ของ redesign Step 6 (`/login`, `/settings`) ผ่านแล้ว; `export.spec.ts` ยังไม่ได้รัน
- ไม่มี migration/code production หรือ commit/push ในช่วงนี้
