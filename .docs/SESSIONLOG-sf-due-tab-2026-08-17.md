# SESSIONLOG — ย้ายเรื่อง SF ออกจาก /stock ไปเป็นแท็บใน /sf-commissions

วันที่: 2026-08-17 · branch: `feat/sf-due-tab` · โมเดล: Opus (วางแผน/ตรวจ) + `agy` gemini-3.1-pro-high (เขียนโค้ด)

## โจทย์

กล่องเตือน "บิล SF ที่ยังมีเครื่องค้าง" hard-code อยู่ใน `SfIntake` บนหน้า `/stock` เป็น `<ul>` อ่านอย่างเดียว
คีย์บิลผิดแล้วแก้/ลบผ่าน UI ไม่ได้ ซ้ำร้าย `v_sf_due` กรองด้วย `pos_is_owner()` → พนักงานมองไม่เห็นกล่องนี้เลย

## สิ่งที่ทำ

### 0. ปิดงานค้างก่อน
commit งาน `allow-cost-in-forms` ที่ค้างใน working tree → `31adee4` บน `main` แล้วแตก `feat/sf-due-tab`
(งานนั้นแตะ `SfIntake.tsx`/`stock/page.tsx` ทับกับงานนี้ ถ้าไม่แยกจะ verify diff ไม่ได้)

### 1. ตรวจ spec เดิมกับโค้ดจริง
`.docs/HANDOFF-sf-due-tab-2026-08-17.md` เขียนไว้ก่อนหน้า ตรวจด้วย explore agent 2 ตัว — แม่นเกือบหมด แก้ 4 จุด:
- `v_sf_due` อยู่บรรทัด 367-388 ไม่ใช่ 366-386
- FK `on delete restrict` อยู่บรรทัด 147 ไม่ใช่ 149
- **ไม่มี npm script regen `database.ts`** (`package.json` มีแค่ dev/build/start/lint) → ต้องแก้มือ
- เพิ่มคำเตือนห้ามแตะ `rpc_upsert_device`/`rpc_upsert_product` (ถูก redefine โดย `20260816233500` ซึ่ง apply prod แล้ว)

### 2. ข้อเคาะรอบนี้
| ประเด็น | เคาะ |
|---|---|
| ใครลบบิล SF ได้ | staff ลบได้ (`rpc_delete_sf_order` ใช้ `pos_is_member`) แต่ RPC ปฏิเสธถ้ามีเครื่อง financed/ขายแล้ว |
| `amount_due` | ซ่อนจาก staff (คืน `null`) — มันคำนวณจาก `cost` ที่กัน staff ไว้ทั้งระบบ |

### 3. ไฟล์ที่เปลี่ยน

**ใหม่**
- `supabase/migrations/20260817120000_sf_order_manage.sql` — recreate `v_sf_due` (`pos_is_member` + `amount_due` owner-only + เพิ่มคอลัมน์ `note`), view ใหม่ `v_sf_order_devices`, `rpc_update_sf_order(jsonb)`, `rpc_delete_sf_order(uuid)` · **ยังไม่ apply**
- `src/app/_components/Modal.tsx` — ย้ายมาจาก `stock/Modal.tsx` เนื้อไม่เปลี่ยน
- `src/app/(staff)/sf-commissions/{useSfDue.ts, SfDueList.tsx, useSfCommissions.ts, utils.ts}`

**แก้**
- `src/app/(staff)/stock/{SfIntake.tsx, page.tsx, types.ts, AddForms.tsx}` — ถอด `dueList`/`SfDue`/fetch `v_sf_due` ออกหมด, ชี้ import Modal ไปที่ใหม่
- `src/app/(staff)/sf-commissions/page.tsx` — แท็บ 3 อัน (`บิล SF ค้าง (n)` / `รอบันทึกค่าคอม` / `ยืนยันแล้ว`), ดึง handler ออกไปเป็นฮุก 335 → 274 บรรทัด
- `src/lib/types/database.ts` — เพิ่ม `v_sf_order_devices` + RPC 2 ตัว + คอลัมน์ `note` ใน `v_sf_due` (แก้มือ)

## สิ่งที่ agy ทำพลาด แล้วผมแก้เอง

1. **บั๊กจริง — โน้ตบิลหายทุกครั้งที่กดบันทึก** `EditModal` init `note` เป็น `""` เพราะ `v_sf_due` ไม่มีคอลัมน์ `note`
   → RPC ทำ `note = nullif('', '')` = NULL ทับของเดิม แก้โดยเพิ่ม `o.note` เข้า view + `database.ts` + prefill ในฟอร์ม
2. **`page.tsx` 318 บรรทัด เกินเพดาน 300** — ปุ่มแท็บ copy-paste 3 ชุด ยุบเป็น map เหลือ 274
3. **promise rejection ลอย** — `void submit()` / `void deleteOrder()` ทั้งที่ฮุก rethrow ใส่ catch ให้ modal ค้างไว้ตอน error
4. **scope creep + เปลี่ยนพฤติกรรม** — agy ไปบีบบรรทัด `StockTable.tsx` (พัง JSX ครั้งหนึ่ง แล้ว `git checkout` กู้เอง)
   และ `AddForms.tsx` โดยเปลี่ยน reset ราคา/จำนวน/ต้นทุนจาก `"0"` เป็น `""` ทั้งที่ไม่มีใครสั่ง
   → `git checkout` ทั้งสองไฟล์ แล้วใส่กลับเฉพาะบรรทัด import Modal · หยุด agy ตรงนั้น

## ผลตรวจ (รันเอง)

```
npx tsc --noEmit                                        → ผ่าน ไม่มี output
npm run lint                                            → ผ่าน ไม่มี finding
npx next build                                          → ✓ Compiled successfully, 11 route ครบ
grep -rn "dueList\|SfDue" "src/app/(staff)/stock/"      → (none)
grep -rn "stock/Modal" src                              → (none)
```

ไฟล์ทุกตัวที่งานนี้แตะ ≤ 300 บรรทัด ยกเว้น `AddForms.tsx` (308) และ `StockTable.tsx` (301)
ซึ่ง**เกินมาก่อนงานนี้แล้ว** จาก commit `31adee4` — งานนี้แตะ `AddForms.tsx` แค่บรรทัด import เดียว

## Apply ลง prod แล้ว (ได้รับอนุมัติ)

โปรเจกต์ `DailyGold & Ucom` (`bihgcdceovfettoxmgme`) — ตัวที่ `.env` ชี้จริง

1. `20260817120000_sf_order_manage.sql` → success
   dump กลับมาเทียบแล้ว: `prosrc` ของ RPC ทั้งสองตรงกับไฟล์ · `prosecdef = true` · `search_path = ""` ·
   ไม่มี overload ซ้ำ · คอลัมน์ view ตรงทั้ง 2 ตัว · ข้อมูลเท่าเดิม (sf_orders 1 / device 1)

2. **ช่องโหว่ที่เจอตอนตรวจหลัง apply** — `v_sf_order_devices` เป็น auto-updatable view (`is_updatable = YES`)
   และ `authenticated` ได้ `INSERT/UPDATE/DELETE` ติดมาจาก **default privileges ของ Supabase**
   ทั้งที่ migration สั่งแค่ `grant select` · view สร้างด้วย `security_invoker = false` → เขียนผ่าน view
   จะรันในสิทธิ์เจ้าของ = **ข้าม RLS owner-only ของ `device_units`** และล้มการ์ด `status = 'in_stock'`
   ใน `rpc_update_sf_order` ทั้งหมด (`cost` ปลอดภัยเพราะไม่ได้อยู่ใน view)

   → apply `20260817124500_sf_order_devices_read_only.sql` อุดแล้ว
   ยืนยัน: `authenticated` เหลือ `SELECT, TRIGGER` เท่านั้น

   **บทเรียน (เพิ่มเข้ากับดัก §6):** `grant select` อย่างเดียวไม่พอ — object ใหม่ทุกตัวใน schema `public`
   ได้ INSERT/UPDATE/DELETE จาก default privileges ของ Supabase อัตโนมัติ
   view ที่ auto-updatable + `security_invoker = false` = ประตูหลังข้าม RLS ต้อง revoke ทุกครั้ง

   **ยังค้าง (ไม่ใช่ของงานนี้):** `v_sf_pending` เป็นแบบเดียวกัน (`is_updatable = YES`) มีมาก่อนงานนี้
   ไม่แตะตามกฎ no scope creep แต่ควรตามไปอุด

## ผลทดสอบระดับ UI — ผ่าน

เดินตาม `.docs/CHECKLIST-sf-due-tab-2026-08-17.md` (เจ้าของงานเดินเอง ไม่ใช่ Claude) → **แจ้งว่าผ่าน**

ยืนยันซ้ำจากฝั่ง DB: หลังเดิน checklist `sf_orders` และ `device_units` ที่ผูก SF **ว่างทั้งคู่**
= ข้อ 5.3 (กดลบบิลผ่าน UI) ทำงานจริง ลบทั้งบิลและเครื่องสำเร็จ ลำดับ FK `on delete restrict` ถูกต้อง
— เป็นหลักฐาน end-to-end ของ `rpc_delete_sf_order` ที่ระดับผู้ใช้จริง

**ข้อจำกัดที่ต้องบันทึกตามจริง:** ผลข้อ 1–4 และ 6 มาจากการรายงานของเจ้าของงาน Claude ไม่ได้เห็นหน้าจอเอง
ส่วนข้อ 5.3 ยืนยันได้อิสระจาก state ของ DB · ข้อ 5.4 (บิลที่มีเครื่อง financed) ข้ามเพราะไม่มีข้อมูลแบบนั้นบน prod
→ เส้นทาง "RPC ปฏิเสธการลบบิลที่มีเครื่องปล่อยแล้ว" **ยังไม่เคยถูกเดินจริง** ตรวจแค่ระดับโค้ด SQL

## ยังไม่ทำ

- ยังไม่ commit / ไม่ push / ไม่เปิด PR
- `v_sf_pending` ยังเปิดช่องเขียนผ่าน view อยู่ (มีมาก่อนงานนี้ — ดูหัวข้อ apply ด้านบน)
