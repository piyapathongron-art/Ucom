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

## ยังไม่ได้ verify
- **SF edit (ลบแถวเครื่อง) ผ่าน UI/RPC** — ไม่มีบิล SF ค้างให้ทดสอบ; ต้องสร้างข้อมูล `ZZTEST` บน prod (ยังไม่ได้อนุมัติ)
- Playwright write layer หลังแก้ /pos (`pos.spec.ts`, `topup-live-acceptance.spec.ts`) ยังไม่ได้รัน
- ภาพจริงของสีไอคอนบนจอผู้ใช้ / มือถือ / dark-only contrast วัดด้วยตา
- ยังไม่ได้ deploy — **ต้อง apply migration ก่อน deploy หน้าบ้าน** (apply แล้วบน prod)

## เจอระหว่างทาง (ยังไม่แก้)
- SF edit โหมดแก้ไข: กด "+ เพิ่มแถวเครื่อง" แล้วบันทึก น่าจะพัง (`id: ""` แปลงเป็น uuid ไม่ได้) — ต้องแก้ RPC ถ้าจะให้เพิ่มเครื่องตอนแก้ไขได้
- สินค้าซ้ำที่น่าจะรวม: "Power Bank 10000 mAh OUKO" (2 แถว), "แบต BP 4L" / "แบต BP-4L"
- `pos/page.tsx` เกิน 300 บรรทัด (574) มาก่อนรอบนี้
- Ticket ที่ควรเปิด: ledger เพิ่มรายรับย้อนหลังไม่ได้ (`rpc_add_shop_income` ไม่มีวันที่), `PendingList`/`ReceiptsList` ยังเป็นฟอร์ม inline
- ผลข้างเคียงของการย้าย class เข้า layer: utility ที่เคยถูกเมิน (`text-sm`, `rounded-xl`, `p-*`) ทำงานทั้งแอปแล้ว

## Facts
- `supabase db push` ใช้ไม่ได้ (ประวัติ migration local ≠ remote) → apply ด้วย `supabase db query --linked -f <file>`
- เครื่องมือ MCP `execute_sql` ไม่มีสิทธิ์ในโปรเจกต์นี้ → ใช้ service-role script ใน `scripts/` แทน (ลบไฟล์ชั่วคราวหลังรัน)
