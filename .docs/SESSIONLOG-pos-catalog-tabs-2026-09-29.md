# SESSIONLOG — /pos catalog tabs, /stock alignment, SF device removal (2026-09-29)

## ทำอะไร
- **ลบแถวทดสอบ 2 แถวใน `expenses`** (`ZZTEST-EXP-…` ฿321, `ZZTEST-CLOSE-…` ฿150) ตาม ID หลังผู้ใช้อนุมัติ (R0) — query ซ้ำไม่เหลือ `ZZTEST`
- **/stock + ทั้งแอป:** class กลางใน `globals.css` (`.ucom-table/.ucom-field/.ucom-surface/...`) ไม่อยู่ใน layer จึงชนะ utility ของ Tailwind v4 ทำให้ `text-right` บน `<th>`, `border-dashed`, `rounded-*` ถูกเมิน → ย้ายเข้า `@layer components`; `select.ucom-field` ทำลูกศรเองและเว้น `padding-right`
- **/pos:** แท็บตามประเภท (ทั้งหมด / โทรศัพท์ / หมวดสินค้า / เติมเงิน) + การ์ดสินค้ามีไอคอนเส้นแยกสีต่อประเภท (`CategoryIcon.tsx`, `CatalogCard.tsx`, token `--color-tone-*`) · การ์ดสินค้าหมดกดไม่ได้ · เติมเงินย้ายไปแท็บของตัวเอง
- **ข้อมูล prod (R0, อนุมัติแล้ว):** สร้างหมวดใหม่ 7 หมวดใน `categories` แล้วย้าย `products.category_id` ครบ 39 ชิ้น (หัวชาร์จ&ชุดชาร์จ 12, สายชาร์จ 5, เคส 3, ฟิล์ม 3, หูฟัง 2, แบต&พาวเวอร์แบงก์ 5, เมมโมรี่&แฟลชไดรฟ์ 3, ซิม 2, ทั่วไป 4) · หมวด "อุปกรณ์เสริม" เหลือ 0 ชิ้น (ยังไม่ลบ)
- **SF edit ลบแถวเครื่องเดิมได้:** migration `20260929120000_sf_order_remove_devices.sql` (`CREATE OR REPLACE rpc_update_sf_order(jsonb)` signature เดิม, รับ `removed_device_ids`, ลบได้เฉพาะ `in_stock` + ยังไม่จ่าย SF, บิลต้องเหลือ ≥1 เครื่อง) — apply ลง prod แล้ว, dump `prosrc` เทียบไฟล์ตรง, grants = authenticated/service_role/postgres · dialog: ปุ่ม × ใช้กับเครื่องเดิมได้ และมีข้อความ "จะลบ N เครื่องเมื่อบันทึก"
- แก้ `pos.spec.ts` / `topup-live-acceptance.spec.ts` ให้กดแท็บเติมเงินก่อน

## Verify แยกตาม layer
| layer | ผล |
|---|---|
| `tsc` / `eslint src` / `queue.check.mts` / `staff-stock-cost-access.check.mts` | ผ่าน |
| SQL (prod) | function 1 ตัว, `prosrc` = ไฟล์, grants ถูก |
| Browser (owner, 1440×900) `/pos` | แท็บ 12 อัน จำนวนรวมตรง (29+39=68), แท็บสายชาร์จได้ 5 ชิ้น, แท็บเติมเงินแสดง 3 เครือข่าย · **เจอและแก้:** แท็บล้นจอ (แท็บเติมเงินหลุด) → เปลี่ยนเป็น wrap |
| Browser `/stock` | หัวคอลัมน์ชิดขวาตรงตัวเลข, dropdown ปกติ, ชื่อหมวดใหม่ถูก |
| Playwright read-only | 17/17 ผ่าน |

## Verify รอบสอง (เขียนลง prod จริง — ผู้ใช้อนุมัติ, DB จะถูก reset ทีหลัง จึงไม่ cleanup)
| รายการ | ผล |
|---|---|
| SF edit ลบแถวเครื่อง ผ่าน UI (W4b ใหม่) | ผ่าน — **เจอ bug จริง:** `useSfDue` ไม่ล้าง cache รายการเครื่องหลังบันทึก เปิดแก้ไขซ้ำยังเห็นเครื่องที่ลบแล้ว → แก้ (`saveOrder` ล้าง cache ของบิลนั้น) |
| top-up: ตั้งยอดตั้งต้น 3 ค่าย, ขายเติมเงินหน้า /topup (ต้นทุน 48.5), ขายผ่าน /pos (ต้นทุน 19.4), ยอดไม่พอถูกปฏิเสธ, ยอดหลังขาย ฿932.1 | ผ่าน (สเปกเดิมพัง 2 จุดเพราะ toast: แก้เป็น `getByText`) — ขั้นหลังขายแรกรันต่อด้วยสเปกชั่วคราว (ลบแล้ว) เพราะ openings ถูกสร้างไปแล้ว |
| top-up wallet เพิ่มยอด (`expenses.spec`) | ผ่านเมื่อรันเดี่ยว (รอบรวมพังครั้งเดียว ไม่ทราบสาเหตุ — เดาว่า race ตอนอ่านยอดเริ่มต้น) |
| `rpc_close_day` เขียนจริง + ปิดใหม่ (W8 ใหม่) | ผ่าน (banner + reload ยืนยัน `day_closings`) |
| `pos.spec`, `barcode.spec`, `pagination-filter`, `report.spec` | ผ่าน (`report.spec` แก้ drift 2 จุด: dialog ซ้ำ desktop/mobile, คลิกเดือนที่เปิดอยู่ซ้ำจนพับ) |
| write suite ทั้งชุดหลังแก้ | 26/32 — ที่ตกอธิบายได้จาก state ที่เทสต์เองสร้าง (ด้านล่าง) |

**ผลข้างเคียงของการเทสต์ (ตั้งใจ, รอ reset DB):**
- W8 ปิดร้านวันนี้แล้ว → RPC ลบ/เพิ่มรายการ ledger ของวันนี้ถูกบล็อกตามกติกา ("วันนี้ปิดร้านไปแล้ว") ทำให้ `close-day.spec` ×3, `expenses.spec` (record expense), W7 ตกเมื่อรันซ้ำ และทิ้งแถว `ZZTEST` ไว้ (`expenses` 4, `shop_income` 2) — ยืนยันจาก `e2e-zztest.mts list`
- ตั้ง wallet openings แล้ว → `features-readonly` ตก (ต้องการ wallet ที่ยังไม่ตั้งยอด)
- `sf.spec` financing ตกครั้งเดียวจาก timeout 30s (รันเดี่ยวผ่าน 25s — ใกล้ขีดจำกัด)
- W10 ตกครั้งเดียวตอนคืนค่า (รันซ้ำผ่าน) → ค่าคอม Ais ตอนนี้ 3.02% (ค่ายอื่น 3.00%) **ไม่ทราบค่าเดิม** ตรวจก่อนใช้ข้อมูลนี้จริง
- ข้อมูลทดสอบสะสมบน prod: sales 14, repair_jobs 16, device_units 14, sf_orders 12, products 13 ฯลฯ (ทั้งหมด marker ZZTEST/TEST-SF)

## ยังไม่ได้ verify
- เครื่องสแกนบาร์โค้ดจริง
- การรันบน Vercel ที่ deploy แล้ว
- ภาพจริงของสีไอคอนบนจอผู้ใช้/มือถือ

## เจอระหว่างทาง (ยังไม่แก้)
- SF edit โหมดแก้ไข: กด "+ เพิ่มแถวเครื่อง" แล้วบันทึก น่าจะพัง (`id: ""` แปลงเป็น uuid ไม่ได้) — ต้องแก้ RPC ถ้าจะให้เพิ่มเครื่องตอนแก้ไขได้
- สินค้าซ้ำที่น่าจะรวม: "Power Bank 10000 mAh OUKO" (2 แถว), "แบต BP 4L" / "แบต BP-4L"
- `pos/page.tsx` เกิน 300 บรรทัด (574) มาก่อนรอบนี้
- Ticket ที่ควรเปิด: ledger เพิ่มรายรับย้อนหลังไม่ได้ (`rpc_add_shop_income` ไม่มีวันที่), `PendingList`/`ReceiptsList` ยังเป็นฟอร์ม inline
- ผลข้างเคียงของการย้าย class เข้า layer: utility ที่เคยถูกเมิน (`text-sm`, `rounded-xl`, `p-*`) ทำงานทั้งแอปแล้ว

## Facts
- `supabase db push` ใช้ไม่ได้ (ประวัติ migration local ≠ remote) → apply ด้วย `supabase db query --linked -f <file>`
- เครื่องมือ MCP `execute_sql` ไม่มีสิทธิ์ในโปรเจกต์นี้ → ใช้ service-role script ใน `scripts/` แทน (ลบไฟล์ชั่วคราวหลังรัน)

## รอบสาม — /report ให้ตรงแคนวาส (เฟส 1: หน้าบ้านล้วน ไม่แตะ DB)
- ผู้ใช้เคาะ: ทำ 2 เฟส, เก็บตารางเจาะลึกเดิมเป็นแท็บที่ 3
- ช่องว่างที่ควรบอกตั้งแต่แรก: แผน redesign ตั้งไว้ว่า Reports เปลี่ยนแค่ shell/token จึงไม่ได้ทำบอร์ด Reports
- `page.tsx` เป็น server component อ่าน `?view=summary|bills|drill` → `ReportClient` (ช่วงเวลา วันนี้/สัปดาห์นี้/เดือนนี้/ปีนี้ + กำหนดเอง, แท็บ 3 อัน, การ์ด 4 ใบ) · `ReportSummary` (ช่องทางรับเงิน, สินค้าขายดี, ค่าคอม SF+, งานซ่อมที่ปิด) · `ReportBills` (บิลในช่วง, คลิกดูรายการ) · `summary.ts` + `summary.check.mts` · `fetchAllPages` ใน `lib/supabase/pagination.ts` (ยอดเงินต้องเห็นทุกแถว เกิน 1000 แถวของ PostgREST)
- ช่วงเริ่มต้นเปลี่ยนจาก "เดือนนี้" เป็น "วันนี้" ตามแคนวาส
- ไทยช่วยไทย แยกจาก โอนเงิน ด้วย `sales.receiving_account` (ตามที่ Cart บันทึก)
- สเปกที่ใช้ตารางเจาะลึก (`report`, `sf`, `pagination-filter`) เปิด `/report?view=drill`; `parseMoney` รับ ฿ และ −

### Verify
- `tsc` / `eslint` / `summary.check.mts` ผ่าน
- Playwright: `report` 5/5, `sf` 2/2, `pagination-filter` 3/3, read-only 13/13 (รวม R13 ไม่มี console error ทุกหน้า) = 23/23
- ภาพหน้าจอ 1440×960 (Playwright, บัญชี owner): สรุป + รายการบิล (เปิดบิล 1 ใบ) + reload แล้วยังอยู่แท็บเดิม

### เฟส 2 (ยังไม่ทำ — ต้อง migration = R0)
- เลขที่บิล (ระบบไม่มีเลขรัน), % เทียบเมื่อวาน, กราฟกำไรรายวันในแท็บบิล, ใบเสร็จ/พิมพ์
- ถ้าช่วงยาวมากจนบิลหลักหมื่น ควรย้ายการรวมยอดช่องทาง/สินค้าขายดีเข้า view (มี `ponytail:` คอมเมนต์ไว้)
