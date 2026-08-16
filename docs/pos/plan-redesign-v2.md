# plan — rollout ทิศทาง Operational Ledger 2.0 (ADR 0018) ลงหน้าจริง

สืบเนื่องจาก [ADR 0018](../adr/0018-uxui-redesign-v2-direction.md) · mockup อนุมัติแล้ว 2026-08-16
(8 หน้า, Claude Artifact) · แทนที่ `plan-redesign.md` เดิม (ที่ execute ADR 0015 ซึ่งถูก supersede)
risk = **R1 ต่อขั้น**

## ข้อเท็จจริงที่ยืนยันแล้ว — อย่า re-derive

จากการสำรวจ schema/RPC จริงวันที่ 2026-08-16 (ไม่ใช่แค่จาก mockup):

- **ส่วนลด (รายชิ้น+ทั้งบิล) มีอยู่แล้วครบ end-to-end** — schema: `sale_items.item_discount`/
  `item_discount_reason`, `sales.bill_discount`/`bill_discount_reason`
  (`supabase/migrations/20260805120000_pos_core_schema.sql:182-183,209-210`) · RPC:
  `rpc_create_sale` (`20260805120200_pos_rpc.sql`, re-declared ใน
  `20260816102841_sf_sale_price_no_due_date.sql`) · frontend: `src/app/(staff)/pos/Cart.tsx:129-142`,
  `src/app/(staff)/pos/page.tsx:200-217,331-352`. **mockup ของ `/pos` แค่โชว์ของที่มีอยู่แล้ว
  ไม่ต้องแตะ schema/RPC เลย**
- **ช่องทางชำระ**: constraint คือ `payment_method in ('cash','transfer')`
  (`20260805120000_pos_core_schema.sql:180`) — **"บัตร" ไม่เคยมีอยู่จริงที่ไหนเลย** ไม่ใช่ของที่ทำ
  ค้างไว้ ตัดออกจาก UI = ไม่ต้องแตะ backend
- **รายจ่ายประจำวัน (close-day) มีอยู่แล้ว**: ตาราง `expenses` + `rpc_add_shop_expense(p_name,
  p_amount, p_paid_from)` มี `paid_from check (cash/transfer)` อยู่แล้ว
  (`supabase/migrations/20260815110000_close_day.sql:15-16,128-197`) อ่านผ่าน `v_close_day_expenses`
- **รายรับนอกบิล (close-day) ยังไม่มีเลย** — ไม่มีตาราง ไม่มี RPC เป็นช่องว่างจริงที่ต้องเพิ่ม
  (รายละเอียดขั้น 6.1)
- **ต้นทุนงานซ่อมถูกซ่อนจากพนักงานแล้วในระดับ structural** ไม่ใช่แค่ UI —
  `v_pos_repairs` ไม่มีคอลัมน์ `part_cost` และ `repair_jobs` (base table) ไม่มี RLS policy ให้
  staff อ่านเลย (`supabase/migrations/20260807100000_pos_phase6_repairs.sql:1-9,17-39`) —
  mockup ตรงกับของจริงอยู่แล้ว ไม่ต้องแก้ backend
- e2e ที่มีอยู่: `pos.spec.ts` `offline.spec.ts` `sf.spec.ts` · `stock-staff.spec.ts`
  `stock-owner.spec.ts` · `close-day.spec.ts` `expenses.spec.ts` · `repairs.spec.ts`
  (+`repairs-helpers.ts`) · `report.spec.ts` `pagination-filter.spec.ts` · `export.spec.ts`
  (ครอบคลุม settings) — **`/login` และ `/settings` ไม่มี e2e เฉพาะของตัวเอง** (export.spec.ts
  ครอบแค่ export flow)
- ตาม ADR 0018: `data-testid` เปลี่ยนได้อิสระตอน mockup แต่ **ต้องตัดสินใจใหม่ทีละหน้าตอนลงโค้ดจริง**
  — ระบุไว้ในแต่ละขั้นด้านล่างว่าคงหรือเปลี่ยน
- accent color เคาะแล้ว: `#A9790E` (light) / `#D9A53C` (dark) — ต้องแยกจาก `--color-warning`
  ที่มีอยู่ (`#A85B00`) ให้ชัดในสายตา ห้ามใกล้กันจนแยกไม่ออก
- ADR 0015 (font, tabular-nums, breakpoint `md`, ไม่มี dark mode) **implement ไปแล้วจริงบน
  `design/main`** (`3a370e4`, `e9e11c1`) — งานรอบนี้คือ**เพิ่ม accent + แก้ flow ที่ mockup ระบุ**
  ไม่ใช่ทำ design system ใหม่ทั้งหมดตั้งแต่ศูนย์ — **ขั้น 0 ต้องเปิด `globals.css` ดูของจริงก่อน**
  ว่า token อะไรมีอยู่แล้วบ้าง ห้ามสมมติ

## การตัดสินใจเรื่องขอบเขต `/stock` (เคาะแล้ว 2026-08-16)

mockup รอบแรกของ `/stock` ตัดคอลัมน์ประเภท (SF/ซื้อขาด) และสถานะ (ผ่อนอยู่/ซ่อมอยู่) ออกจากตาราง
หลักทั้งหมด เหลือแค่จำนวน+ราคา — ถามผู้ใช้แล้วว่าจะตัดทิ้งจริงหรือย้ายไปที่อื่น **เลือก: ขยายดูได้
ในแถวเดิม** (ไม่ย้ายไปหน้าอื่น ไม่ทิ้งไปเฉยๆ) ตารางหลักยังโชว์แค่ จำนวน/ราคา เป็นค่าเริ่มต้น แต่ละ
แถวมีปุ่ม chevron ท้ายแถวกดขยายดู "ประเภท" + "สถานะ" ได้ (mockup อัปเดตแล้วให้ตรงกับการตัดสินใจนี้)
ขั้น 4 ด้านล่างจึงทำได้ทันทีไม่ต้องรอคำตอบเพิ่ม

## แพทเทิร์นร่วมของทุกขั้น (อ่านครั้งเดียว ใช้ทุกหน้า)

ทุกขั้นด้านล่างทำตามลำดับนี้เหมือนกัน ไม่ต้องเขียนซ้ำ:

1. เปิด mockup Artifact ของหน้านั้น (ลิงก์ที่ผู้ใช้มีอยู่แล้วจากการรีวิวรอบ 2026-08-16) เทียบกับ
   หน้าจริงปัจจุบันบน `design/main`
2. แก้ markup/CSS ให้ตรงกับ mockup — ใช้ token จาก `globals.css`, ห้ามเพิ่ม dependency, ไฟล์ที่ต้อง
   มี markup 2 ชุด (ตาราง+การ์ด) ให้แตก component ย่อยถ้าจะเกิน 300 บรรทัด
3. ตัดสินใจ testid: คงของเดิมถ้า element/flow เดิมยังอยู่ ตั้งใหม่เฉพาะจุดที่ flow เปลี่ยนจริง แล้ว
   แก้ e2e spec ของหน้านั้นให้ตรง
4. Server Component เป็นค่าเริ่มต้น `'use client'` เฉพาะ leaf ที่ต้องมี state
5. Verify: `./node_modules/.bin/tsc --noEmit` และ `npm run lint` ต้อง exit 0 · รัน e2e spec ของ
   หน้านั้น (ระบุต่อขั้น) ให้ผ่าน
6. **ถามผู้ใช้ก่อนเปิด browser verify ทุกครั้ง** (ไม่ใช่แค่ครั้งแรก) — เสนอ 3 ทาง: รันเองผ่าน
   browser tool / ทำ checklist ให้ไปเช็คเอง / ข้าม — ถ้าข้ามหรือให้ผู้ใช้เช็คเอง นับเป็น unverified
7. Commit แยกต่อหน้า (ไม่รวมหลายหน้าใน commit เดียว) — **ไม่ push**

## ลำดับหน้า และเหตุผลการเรียง

เรียงจาก **เสี่ยงต่ำ/เล็กสุดไปเสี่ยงสูง/ใหญ่สุด** เพื่อให้เจอปัญหาเรื่อง token ตั้งแต่ขั้นแรกๆ
ก่อนไปหน้าที่ซับซ้อน และเลื่อน `/stock` (มีคำถามค้าง) กับ `/pos`+`/close-day` (งานใหญ่สุด/มี backend
work) ไปท้าย

### ขั้น 0 — Design tokens: เพิ่ม accent color

- เปิด `src/app/globals.css` ดู `@theme` block ปัจจุบันจริงก่อนแก้ (มาจาก ADR 0015 ที่ implement ไปแล้ว)
- เพิ่ม token accent: light `#A9790E`, dark `#D9A53C` — ตั้งชื่อให้สอดคล้องกับ token เดิมที่มีอยู่
  (เช่นถ้าเดิมใช้ `--color-warning` ก็ตั้ง `--color-accent` คู่กัน)
- ห้ามแก้ token อื่นที่ ADR 0015 วางไว้แล้วและยังไม่มีใครบ่น (font, breakpoint, semantic 3 สี)
- Verify: `tsc` + `lint` เท่านั้น (ยังไม่มีหน้าไหนใช้ token นี้ให้ดูผลจริง) → commit
  `style: add accent color token per ADR 0018`

### ขั้น 1 — `/login`

- ไม่มี flow เปลี่ยน (mockup คือ restyle + เพิ่มข้อความแนะนำจอกว้างตอนหน้าจอแคบ) — คง testid เดิมทั้งหมด
  (`#username`, `#password`, `button[type="submit"]`, server action `login` — ตาม
  SESSIONLOG-ucom-redesign-step-6 ที่เคยบันทึกไว้ตอนแก้หน้านี้รอบ ADR 0015)
- Verify: `tsc` + `lint` (ไม่มี `login.spec.ts` ให้รัน — เป็นช่องว่าง e2e ที่รู้อยู่แล้ว ไม่ใช่ของ
  ต้องแก้ในรอบนี้) → ถามก่อน browser verify → commit

### ขั้น 2 — `/settings`

- Restyle ตาม mockup (การ์ดข้อมูลร้าน + การ์ดสำรองข้อมูล) — คง `export-button`, `export-error`,
  `export-summary` testid ตามที่ SESSIONLOG เดิมยืนยันไว้ว่าเป็นจุดที่ `export.spec.ts` จับอยู่
- Verify: `tsc` + `lint` + `npx playwright test tests/e2e/export.spec.ts` (ต้องถามผู้ใช้ก่อนรัน
  เพราะ suite นี้ login เข้า prod จริงและ export ข้อมูลจริง — ตาม SESSIONLOG เดิมที่เคยติดจุดนี้)
  → ถามก่อน browser verify → commit

### ขั้น 3 — `/repairs` และ `/sf-commissions`

สองหน้านี้ mockup เป็น visual restyle ล้วน ไม่มี flow เปลี่ยน (cost hiding ของ repairs ถูก enforce
ระดับ view/RLS อยู่แล้วจริง ไม่ใช่ต้องซ่อนเพิ่มที่ UI) — ทำเป็นคนละ commit แต่ pattern เดียวกัน:

- `/repairs`: คง testid เดิม, รัน `repairs.spec.ts` เป็น verify
- `/sf-commissions`: คง testid เดิม (ไม่มี spec เฉพาะ — เช็คว่ามี e2e อื่นแตะหน้านี้ทางอ้อมหรือไม่
  ก่อนสรุปว่าไม่มีอะไรให้รัน)
- ทั้งสอง: ถามก่อน browser verify ทีละหน้า → commit แยกกัน

### ขั้น 4 — `/stock`

- ตารางหลักเหลือ จำนวนคงเหลือ (+/−) กับราคาขายเป็นค่าเริ่มต้นตาม mockup ล่าสุด — เพิ่มคอลัมน์/ปุ่ม
  ขยายท้ายแถว (chevron toggle) ที่กดแล้วโชว์ "ประเภท" (SF/ซื้อขาด) + "สถานะ" (ผ่อนอยู่/ซ่อมอยู่/
  พร้อมขาย) แทรกเป็นแถวย่อยใต้แถวเดิม — **ข้อมูลไม่หายไปจากหน้านี้ แค่ซ่อนเป็นค่าเริ่มต้น**
  ('use client' เฉพาะปุ่ม toggle นี้จุดเดียว ที่เหลือยังเป็น Server Component ได้)
- เปิดดู `src/app/(staff)/stock/` ก่อนแก้จริงว่าปัจจุบันแตก component ย่อยยังไง (ยังไม่ยืนยัน path
  ไฟล์ในแผนนี้ — ต้องดูของจริงตอนลงมือ ห้ามสมมติชื่อไฟล์)
- Verify: `tsc` + `lint` + `stock-staff.spec.ts` + `stock-owner.spec.ts` — ถ้า spec เดิมเช็คว่า
  คอลัมน์ประเภท/สถานะ "แสดงอยู่บนตาราง" ตรงๆ (ไม่ใช่แค่มี data-testid ของ toggle) ต้องแก้ spec ให้
  เปิด detail ก่อนเช็คค่าเหล่านั้น ไม่ใช่ลบ assertion ทิ้ง → ถามก่อน browser verify → commit

### ขั้น 5 — `/report` — **ข้าม (ไม่มีอะไรให้ทำ, เช็คแล้ว 2026-08-16)**

แผนเดิมเขียนไว้ว่าให้ตัด KPI tile คอมมิชชั่น SF สะสม + เงินสดปิดร้าน ออกจาก UI แต่เปิด
`page.tsx` จริงแล้วพบว่า KPI card ปัจจุบันมีแค่ 4 อัน (`net_profit`, `sale_profit`,
`repair_profit`, `expense`) — ไม่เคยมี SF commission หรือเงินสดปิดร้านเป็น KPI tile อยู่แล้ว
(มีแค่เป็นคอลัมน์ในตาราง `ReportTable` ซึ่งคนละส่วนกับ KPI card ด้านบน) จึงไม่มีอะไรให้ตัดจริง
ถามผู้ใช้แล้ว — เลือกข้ามขั้นนี้ทั้งขั้น ไม่แก้โค้ด `/report` ในรอบ redesign v2 นี้

### ขั้น 6 — `/close-day` (มีงาน backend จริง แยกเป็น 2 sub-step)

#### 6.1 Backend: เพิ่มรายรับนอกบิล (migration ใหม่ — ยังไม่ apply ลง production จนกว่าจะขอ)

- Migration ใหม่ (ตั้งชื่อไฟล์ตาม timestamp convention เดิมที่เห็นใน `supabase/migrations/`)
  เพิ่มตาราง `shop_income` (หรือชื่อที่สอดคล้อง `expenses` — เช็คชื่อ column ใน `expenses` จริงก่อน
  ตั้งชื่อคู่กันให้ symmetric) พร้อม `received_to check (received_to in ('cash','transfer'))`
  ตาม pattern เดียวกับ `expenses.paid_from`
- เพิ่ม `rpc_add_shop_income(p_name, p_amount, p_received_to)` และ `rpc_delete_shop_income`
  mirror `rpc_add_shop_expense`/`rpc_delete_shop_expense` แบบตรงๆ (เปิด
  `20260815110000_close_day.sql:128-197` ดูโครงจริงก่อนเขียน ห้ามเดา signature)
- เพิ่ม view `v_close_day_income` mirror `v_close_day_expenses`
- แก้ RPC/view ที่คำนวณ "ยอดที่คาดว่าจะมีในลิ้นชัก" ให้บวกเฉพาะ income ที่ `received_to = 'cash'`
  และลบเฉพาะ expense ที่ `paid_from = 'cash'` (รายการ `transfer` บันทึกไว้แต่ไม่กระทบยอดเงินสด —
  ตรงกับที่ mockup อธิบายไว้)
- Verify ระดับ SQL: เขียน query ทดสอบ insert income ทั้งสองช่องทางแล้วเช็คว่ายอดคาดหวังเปลี่ยนถูก
  เฉพาะฝั่ง cash — รันผ่าน Supabase MCP หรือ CLI local ก่อน apply จริง
- **Migration ที่ยังไม่ apply = R2 (ย้อนได้)** เขียนได้เลยไม่ต้องขอ แต่ **apply ลง production = R0
  ต้องขอก่อนเสมอ** ตาม CLAUDE.md §1/§6

#### 6.2 Frontend: restyle + wiring UI ใหม่

- จัด layout เป็น 2 คอลัมน์ 50/50 ตาม mockup: ซ้าย = กล่องปิดร้าน (ยอดระบบ, รายรับนอกบิล,
  รายจ่ายประจำวัน, นับเงินสด, ยืนยัน), ขวา = ตารางบิลวันนี้ (ใช้ `v_close_day_bills`/
  `BillsSection.tsx` ที่มีอยู่แล้ว จัดตำแหน่งใหม่ ไม่ต้องเขียนใหม่) ตามด้วยประวัติปิดร้าน
- ต่อ UI รายรับนอกบิลเข้ากับ `rpc_add_shop_income` ใหม่จากขั้น 6.1 (dropdown เงินสด/โอน = ส่ง
  `p_received_to`)
- Verify: `tsc` + `lint` + `close-day.spec.ts` + `expenses.spec.ts` (มีโอกาสต้องเพิ่ม test case
  ใหม่สำหรับรายรับนอกบิล — เขียนเพิ่มในสไตล์เดียวกับ test รายจ่ายที่มีอยู่แล้ว) → ถามก่อน browser
  verify → commit (แยกจาก commit migration ของ 6.1)

### ขั้น 7 — `/pos` (ใหญ่สุด เก็บท้าย)

- ตัดช่องรูปสินค้า (เช็คว่าปัจจุบันมี image slot จริงไหมก่อน — ถ้าไม่มีอยู่แล้วก็ข้ามขั้นนี้)
- ปุ่มเครื่อง SF เหลือ label เฉยๆ "ผ่อน SF"/"ขายสด" ไม่โชว์ตัวเลขในปุ่ม
- เปิดใช้ UI ส่วนลดรายชิ้น+ทั้งบิลที่ schema/RPC/`Cart.tsx` รองรับอยู่แล้ว (ขั้นนี้คือ expose ของเดิม
  ไม่ใช่สร้างใหม่ — อ้างอิง `Cart.tsx:129-142`, `page.tsx:200-217,331-352`)
- ตัดตัวเลือกช่องทางชำระ "บัตร" ออกจาก UI (ไม่เคยมีอยู่จริง เป็นแค่การไม่ render ตัวเลือกที่ไม่เคย
  ทำงาน)
- Verify: `tsc` + `lint` + `pos.spec.ts` + `offline.spec.ts` + `sf.spec.ts` (ชุดนี้เปราะสุดเพราะแตะ
  คิว offline — รันให้ครบทั้งสามอย่าละเอียด) → ถามก่อน browser verify → commit

## Verification รวมท้ายแผน

หลังทำครบทุกขั้น: รัน `tsc` + `lint` + e2e ทั้งชุดอีกรอบเดียวรวด (ไม่ใช่แค่ต่อหน้า) เพื่อจับ
regression ข้ามหน้า (เช่น nav ที่ใช้ accent color ร่วมกันทุกหน้า) ก่อนถือว่า redesign v2 เสร็จ
