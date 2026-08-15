# plan — ปุ่มปิดร้าน / สรุปรายวัน (เฟส 9)

เคาะสเปกครบ 15 ส.ค. 2026 · ดีไซน์อยู่ที่ ADR 0014 · risk = **R1** (ตาราง+คอลัมน์ใหม่ ย้อนได้)

## สเปกที่เคาะแล้ว

| ข้อ | เคาะว่า |
|---|---|
| ใครเข้าได้ | พนักงาน + เจ้าของ · พนักงานเห็นเงินเข้า–เงินออก–ยอดต้องส่ง **ไม่เห็นต้นทุน/กำไร** |
| เก็บอะไร | แถว `day_closings` เฉพาะ: วันที่ · เวลาปิด · คนปิด · **เงินสดที่นับได้จริง** · หมายเหตุ |
| ยอดที่ต้องส่ง | เงินสดที่รับ − รายจ่ายที่จ่ายด้วยเงินสดของวันนั้น · **เงินโอนไม่รวม** |
| รายจ่าย | ใช้ตาราง `expenses` เดิม + คอลัมน์ใหม่ `paid_from` |
| บิลปิดงานซ่อม | **นับ** ในยอดต้องส่ง (เงินเข้าลิ้นชักจริง) |
| SF+ | แสดงแค่ **จำนวนเครื่องที่ปล่อยวันนี้** ไม่แสดงค่าคอม |
| คิว offline ค้าง | **บล็อก** ไม่ให้กดปิดจนคิวว่าง |
| ปิดซ้ำ | ทับของเดิมได้ เฉพาะวันนี้ · วันที่ผ่านไปแล้วแก้ไม่ได้ |
| ดูย้อนหลัง | พนักงาน = วันนี้เท่านั้น · เจ้าของเลือกวันย้อนหลังได้ (อ่านอย่างเดียว) |
| ช่องนับเงินสด | **บังคับกรอก ไม่ prefill** · โชว์ส่วนต่างก่อนกดยืนยัน |

## ข้อเท็จจริงที่ query จาก prod แล้ว (15 ส.ค. 2026)

- `sales` 1076 แถว — cash 983 / transfer 93 · `payment_method` มีอยู่แล้ว **ไม่ต้องแก้ schema เพื่อแยกสด/โอน**
- `expenses` 53 แถว · `category` null ทั้งหมด (ยังไม่ทำ UI หมวดหมู่ ตามที่เคยเคาะ)
- `device_units` 211 แถว — `in_stock` 29 / `sold` 182 · **`financed` 0 แถว** · `commission` null ทั้งหมด
- `profiles` — owner 1 / staff 1
- RLS: `sales`, `sale_items`, `expenses`, `device_units` มี policy เดียวคือ `pos_is_owner()`
  → **พนักงานอ่านตรงไม่ได้เลย ทุกอย่างต้องผ่าน view `security_invoker = false`**
- ค้างไว้ไม่แตะ: `sales.receiving_account = 'ทดสอบ'` 2 แถว (ข้อมูลเทสค้าง ยังไม่ลบ — ลบ = R0)

## งานที่ต้องทำ

### 1. Migration `supabase/migrations/<ts>_close_day.sql`

```sql
alter table public.expenses
  add column paid_from text check (paid_from in ('cash', 'transfer'));

create table public.day_closings (
  id            uuid primary key default gen_random_uuid(),
  closing_date  date not null unique,          -- ร้านเดียว หนึ่งวันหนึ่งแถว
  closed_at     timestamptz not null default now(),
  closed_by     uuid references public.profiles (id) on delete set null,
  counted_cash  numeric(12, 2) not null check (counted_cash >= 0),
  note          text,
  created_at    timestamptz not null default now()
);
```

RLS `day_closings`: `select` ให้ `pos_is_member()` · เขียนผ่าน RPC เท่านั้น
(ไม่มีคอลัมน์ต้นทุน/กำไร จึงไม่ต้องซ่อนหลัง view)

### 2. View ชุด `v_close_day_*` — ทุกตัว `security_invoker = false` + gate `pos_is_member()`

**ห้ามมีคอลัมน์ `cost` / `profit` / `unit_cost` โผล่ใน view เหล่านี้แม้แต่ตัวเดียว** —
ซ่อนใน UI ไม่นับ พนักงานยิง PostgREST ตรงได้

| view | คอลัมน์ | หมายเหตุ |
|---|---|---|
| `v_close_day_bills` | `day`, `sale_id`, `sold_at`, `payment_method`, `bill_total`, `item_count` | **ทุกบิล ไม่ตัดบิลซ่อมออก** (ต่างจาก `v_daily_report` โดยตั้งใจ — ADR 0014) · `bill_total = Σ(unit_price×qty − item_discount) − bill_discount` |
| `v_close_day_items` | `day`, `name_snapshot`, `kind`, `qty`, `revenue` | รวมยอดต่อชื่อสินค้า |
| `v_close_day_expenses` | `day`, `id`, `name`, `amount`, `paid_from`, `created_by` | อ่าน `expenses` ของวันนั้น |
| `v_close_day_sf` | `day`, `imei`, `model_name` | เครื่องที่ `financed_at` ตรงวัน · **ไม่มีคอลัมน์ `commission`** · หน้าจอนับแถวเอง |

`day` ทุกตัวใช้ `(ts at time zone 'Asia/Bangkok')::date` เหมือนทุก view ที่มีอยู่

ยอดสรุป (สด/โอน/รายจ่ายสด/ต้องส่ง) **คำนวณฝั่ง client จาก bills + expenses** — ไม่ทำ view สรุปเพิ่ม

### 3. RPC — write path เดียวของพนักงาน (`security definer`, เช็ค `pos_is_member()` ก่อนเสมอ)

`DROP FUNCTION IF EXISTS` นำหน้าทุกตัว (§6 — `create or replace` ไม่ replace เมื่อ signature เปลี่ยน)

- `rpc_add_shop_expense(p_name text, p_amount numeric, p_paid_from text) returns uuid`
  บังคับ `spent_at` = วันนี้เวลาไทย ฝั่ง server (ไม่รับจาก payload) · `created_by = auth.uid()`
- `rpc_delete_shop_expense(p_id uuid) returns void`
  ลบได้เฉพาะแถวที่ `created_by = auth.uid()` **และ** `spent_at` = วันนี้ **และ** วันยังไม่ถูกปิด
- `rpc_close_day(p_counted_cash numeric, p_note text) returns uuid`
  upsert บน `closing_date` = วันนี้เวลาไทย (`on conflict (closing_date) do update`)

owner ยังใช้หน้า `/expenses` เขียนตรงเหมือนเดิม ไม่แก้

### 4. UI — `src/app/(staff)/close-day/`

- `page.tsx` (`'use client'`) + component ย่อยตามเดิม (ไฟล์ ≤ 300 บรรทัด)
- เพิ่มลิงก์ **"ปิดร้าน"** ใน nav **ทั้งสอง** layout — `(staff)/layout.tsx` และ `(owner)/layout.tsx`
- **ไม่แตะ `ownerOnlyPrefixes`** ใน `src/proxy.ts`
- โครงหน้า:
  1. การ์ดบน 4 ใบ — เงินสด · เงินโอน · รายจ่ายเงินสด · **ยอดที่ต้องส่ง** (เน้น)
  2. ตารางบิลของวัน + วิธีจ่าย + ยอด
  3. สรุปสินค้าที่ขาย (ชื่อ + จำนวน + ยอด)
  4. บรรทัด "ปล่อย SF+ วันนี้ N เครื่อง" (ซ่อนถ้า N = 0)
  5. รายจ่ายของวัน + ฟอร์มเพิ่ม (ชื่อ · จำนวน · จ่ายด้วย สด/โอน) · ลบมีขั้นยืนยัน (§8)
  6. ช่อง "เงินสดที่นับได้" (บังคับ ไม่ prefill) → โชว์ส่วนต่าง → ปุ่มยืนยันปิดร้าน
- ถ้าคิว offline ไม่ว่าง (`readQueue()` จาก `pos/queue.ts`) → แถบเตือน + **disable ปุ่มยืนยัน**
- date picker โผล่เฉพาะ owner · เลือกวันย้อนหลัง = อ่านอย่างเดียว ฟอร์มและปุ่มปิดหายไป

### 5. เทส

- `tests/e2e/close-day.spec.ts` 1 ตัว: เพิ่มรายจ่าย `ZZTEST-CLOSE-<ts>` จ่ายสด →
  ยอดที่ต้องส่งลดลงเท่าจำนวนที่กรอก → ลบทิ้ง → ยอดกลับเท่าเดิม
- ปิดร้านจริงในเทส **ไม่ทำ** — เขียนแถวลง `day_closings` ของวันจริงบน prod
- เพิ่ม `day_closings` + `expenses.paid_from` เข้า `global-teardown.ts` เผื่อหลุด
- หลัง apply migration: dump schema กลับมาเทียบกับไฟล์ (§6)

### 6. Verify

ต้องเทสที่ layer ที่ผู้ใช้ใช้จริง — **ถามก่อนเปิด browser ทุก verify point** (§3)
`tsc` + `lint` ผ่าน ยังไม่นับว่าเสร็จ

## เฟสถัดไป — SF+ "รอค่าคอม" (ยังไม่ทำในงานนี้)

สเปกที่เจ้าของร้านอธิบายไว้ 15 ส.ค. 2026 จดไว้กันหาย:

- ตอนกดปล่อยผ่อน **ยังไม่รู้ว่าค่าคอมเครื่องนี้เท่าไหร่** — SF โอนมาเป็นรอบ อาจอีกอาทิตย์
- ต้องมี state **"รอค่าคอม"** แล้วค่อยกรอกตัวเลขตอนเงินเข้าจริง
- **ค่าคอมมาเป็นเงินโอนเสมอ** → ไม่เคยเข้าลิ้นชัก ไม่โผล่ในหน้าปิดร้านตลอดไป

สิ่งที่ต้องรื้อ (ทั้งหมดยังไม่เคยถูกใช้จริง — `financed` 0 แถว จึงไม่มีข้อมูลเก่าให้ migrate):

- constraint `device_financed_needs_commission` — บังคับกรอกค่าคอมตอนปล่อยผ่อน ซึ่งขัดความจริง
- `rpc_finance_device(uuid, numeric)` — ต้องถอด param ค่าคอมออก (`DROP` ก่อน ตาม §6)
- RPC ใหม่สำหรับกรอกค่าคอมทีหลัง + คอลัมน์วันที่รับเงิน
- `v_report_entries` — ย้ายการนับค่าคอมจากวัน `financed_at` ไปวันที่รับเงินจริง
  (**เปลี่ยนนิยามเงิน → ต้องมี ADR ของตัวเอง**)
- หน้าจอรายการ "รอค่าคอม"
