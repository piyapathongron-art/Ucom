# plan — งานที่เหลือทั้งหมด (หลังลบข้อมูลเทส 14 ส.ค. 2026)

> **อัปเดต 17 ส.ค. 2026 — ข้อ 1–6 และ 9 ทำเสร็จหมดแล้ว** ไฟล์นี้ตกยุคอยู่พักใหญ่
> ตรวจซ้ำกับโค้ดจริงแล้วทีละข้อ (ดูคอลัมน์ "ตรวจแล้วเจออะไร") เนื้อหาสเปกด้านล่างเก็บไว้เป็นบันทึกว่าเคยเคาะอะไร
> **เหลือจริงแค่ข้อ 7 กับ 8** ซึ่งเป็นงานของผู้ใช้ทั้งคู่

สถานะฐาน: เฟส 0–8 จบ · schema/RLS/view/RPC บน prod ครบ

| # | งาน | สถานะ | ตรวจแล้วเจออะไร (17 ส.ค. 2026) |
|---|---|---|---|
| 1 | ปุ่ม export JSON | ✅ เสร็จ | `(owner)/settings/page.tsx` มี pagination `PAGE = 1000` ครบ 11 ตาราง + `tests/e2e/export.spec.ts` ใช้ `waitForEvent("download")` |
| 2 | เทส e2e เก็บกวาดข้อมูลตัวเอง | ✅ เสร็จ | `tests/e2e/global-teardown.ts` ลบด้วย prefix `ZZTEST%` อย่างเดียว เรียง device_units ก่อนเพราะ FK RESTRICT |
| 3 | หน้ารายจ่ายร้าน | ✅ เสร็จ | `(owner)/expenses/` + `/expenses` อยู่ใน `ownerOnlyPrefixes` ของ `src/proxy.ts:50` แล้ว |
| 4 | หน้าวอลเล็ตเติมเงิน | ✅ เสร็จ | รวมในหน้า `/expenses` ตามที่เคาะ — `useExpensesPage.ts` อ่าน `v_topup_wallet_balance`, มี testid `wallet-balance-*` / `topup-submit` |
| 5 | เพิกถอนสิทธิ์เขียนบน `v_sale_profit` | ✅ เสร็จ 15 ส.ค. | ตามด้วยการกวาดทั้ง schema 17 ส.ค. — ดูหัวข้อ 5 ด้านล่าง |
| 6 | เฟส 8 คิว offline | ✅ เสร็จ | `(staff)/pos/queue.ts` — key เป็น `ucom-pos-queue-v1` / `ucom-pos-catalog-v1` **มีเวอร์ชันตามกับดักที่เตือนไว้** + `tests/e2e/offline.spec.ts` |
| 7 | verify `/report` ด้วยตา + รันชุดเทสเต็ม | ⬜ **ยังเหลือ** | ผู้ใช้ |
| 8 | git remote + ภาษา PR | ⬜ **ยังเหลือ** | ผู้ใช้ — `git remote -v` ยังว่างอยู่จริง |
| 9 | รวม `docs/adr/` + `CONTEXT.md` เข้า git | ✅ เสร็จ | commit `68d19b7` บน `feature/report-drilldown` |

---

## 1. ปุ่ม export JSON — delegate ได้ทันที

สเปกครบอยู่แล้วที่ `docs/pos/plan-export-json.md` (พาธไฟล์ ตาราง 11 ตัว กับดัก pagination รูป payload testid เกณฑ์ verify)
ส่งสเปกให้ executor ตรงๆ ไม่ต้องเขียนเพิ่ม → **สเปกสั้นกว่าโค้ดที่จะได้ = เข้าเกณฑ์ delegate**

Claude ต้องรัน `tsc` + `eslint` เอง และดูไฟล์ที่ได้จริงก่อนบอกว่าเสร็จ

## 2. เทส e2e เก็บกวาดข้อมูลตัวเอง — delegate

วันนี้เพิ่งลบขยะเทสออกจาก prod ไป 13 บิล / 24 งานซ่อม / 10 สินค้า / 4 เครื่อง / 4 บิล SF
รันชุดเทสอีกรอบก็กลับมาใหม่ ตราบที่ไม่มี cleanup

- ทุก spec ที่สร้างข้อมูล (`pos.spec.ts`, `repairs.spec.ts`, `sf.spec.ts`) เพิ่ม `test.afterAll` ลบด้วย prefix เดิม (`ZZTEST-`, `TEST-SF-`)
- ลบผ่าน supabase client บทบาท owner (RLS ผ่านอยู่แล้ว) ลำดับ: sales → repair_jobs → device_units → sf_orders → products
- **ห้าม** ลบด้วยเงื่อนไขอื่นนอกจาก prefix
- ผลลัพธ์ที่ต้องได้: รันชุดเทสจบแล้ว `select count(*) ... like 'ZZTEST%'` = 0 ทุกตาราง

## 3. หน้ารายจ่ายร้าน — สเปกที่เคาะแล้ว (ยังต้องยืนยัน 1 ข้อ)

ตาราง `expenses` มี 53 แถว **`category` เป็น null ทั้ง 53 แถว** → ไม่ทำ UI หมวดหมู่ (YAGNI) เก็บคอลัมน์ไว้เฉยๆ

- หน้าใหม่ `/expenses` ใต้ `(owner)` + เพิ่มลิงก์ใน `src/app/(owner)/layout.tsx`
- ฟอร์ม 3 ช่อง: ชื่อ · จำนวนเงิน · วันที่ (default วันนี้เวลาไทย ใช้ `todayInBangkok()` จาก `report/types.ts`)
- ตารางรายการเดือนปัจจุบัน + ยอดรวม · ปุ่มลบมีขั้นยืนยัน (§8)
- เขียนตรงผ่าน browser client (RLS `pos_is_owner()` ครอบอยู่) ไม่ต้องมี RPC/API route
- เทส `tests/e2e/expenses.spec.ts` 1 ตัว: เพิ่มรายการ `ZZTEST-EXP-<ts>` → เห็นในตาราง → ยอดรวมเพิ่มตามจำนวนที่กรอก → ลบทิ้ง

**เคาะแล้ว (14 ส.ค. 2026):** owner เท่านั้น — ต้องเพิ่ม `/expenses` ใน `ownerOnlyPrefixes` ของ `src/proxy.ts` และวางหน้าไว้ใต้ `(owner)`

## 4. หน้าวอลเล็ตเติมเงิน — สเปกที่เคาะแล้ว

`topup_wallet_entries` = 0 แถว · view `v_topup_wallet_balance` คืน `carrier_id, name, commission_rate, topped_up, spent, balance` พร้อมใช้

- ทำในหน้าเดียวกับรายจ่าย (`/expenses` แท็บที่สอง) หรือ `/wallet` แยก — เลือกอันที่ทำน้อยกว่า: **แท็บที่สอง**
- แสดงยอดคงเหลือต่อค่าย 3 ค่ายจาก view
- ฟอร์มเติมเงิน: ค่าย (select) · จำนวนเงิน · วันที่ → insert `topup_wallet_entries`
- ยอดคงเหลือต้องขยับตามทันทีหลังเติม (refetch view ไม่ต้องคำนวณเอง — กฎกลางข้อ 3)
- เทสรวมอยู่ใน `expenses.spec.ts` ได้: เติม 100 → `balance` เพิ่ม 100

**เตือน:** entry ที่ insert แล้วยังไม่มีทางลบผ่าน UI — ตั้งใจ (ADR 0009 แนวเดียวกับไม่มี restore) เติมผิดแก้ผ่าน SQL

## 5. เพิกถอนสิทธิ์เขียนบน `v_sale_profit` — **เสร็จแล้ว (15 ส.ค. 2026)**

ตรวจแล้ว: `is_updatable = NO` (view มี join/aggregate) — ไม่ใช่ช่องโหว่ที่ยิงได้จริงตอนนั้น แต่เป็น grant ผิดหลัก least-privilege ค้างไว้
Migration `revoke_write_grants_on_v_sale_profit`: `revoke insert, update, delete, truncate on public.v_sale_profit from authenticated;`
Verify หลัง apply: `authenticated` เหลือแค่ `SELECT` (+ `REFERENCES`/`TRIGGER` ที่ไม่มีความหมายจริง) ตรงกับ view รายงานตัวอื่นแล้ว

**ต่อยอด 17 ส.ค. 2026 — กวาดทั้ง schema จนหมด**

ตอนทำงาน SF เจอว่า `v_sf_order_devices` (view ใหม่) เป็น **auto-updatable** (`is_updatable = YES`) และได้
`INSERT/UPDATE/DELETE` ติดมาจาก default privileges ของ Supabase ทั้งที่ migration สั่งแค่ `grant select`
รวมกับ `security_invoker = false` = **เขียนผ่าน view ข้าม RLS ของ `device_units` ได้จริง** ไม่ใช่แค่ผิดหลักการ
→ อุดด้วย `20260817124500_sf_order_devices_read_only.sql`

จากนั้น sweep ทั้ง schema พบอีก 5 view ที่มี grant เขียนค้างแบบเดียวกัน (`v_pos_catalog`, `v_pos_stock`,
`v_pos_top_products`, `v_sf_due`, `v_topup_wallet_balance`) — ทุกตัว `is_updatable = NO` จึงยิงไม่ได้จริง
เป็นแค่ผิดหลัก least-privilege → `20260817140000_revoke_write_grants_on_report_views.sql`

**ตอนนี้ไม่มี view ไหนใน `public` เหลือสิทธิ์เขียนให้ `authenticated` แล้ว**

> **กฎที่ต้องจำ:** `grant select` อย่างเดียวไม่พอ — object ใหม่ทุกตัวใน schema `public` ได้สิทธิ์เขียน
> จาก default privileges อัตโนมัติ ทุกครั้งที่สร้าง view ใหม่ต้อง `revoke insert, update, delete` ตามหลัง
> และถ้า view นั้น auto-updatable + `security_invoker = false` การลืม revoke = ประตูหลังข้าม RLS

## 6. เฟส 8 คิว offline — Claude ทำเอง

ตรรกะ sync พลาดแล้วบิลหาย (`plan-rebuild.md` ระบุไว้ตั้งแต่ต้นว่าเป็นงานของ Claude)
`rpc_create_sale` idempotent ด้วย `client_uuid` อยู่แล้ว ฝั่ง client เหลือ: แคชแคตตาล็อก · คิวใน localStorage (**ต้องมีเวอร์ชันใน key** — กับดักที่เคยโดน) · ส่งซ้ำเมื่อออนไลน์ · ตัวนับบิลค้าง
งานนี้ต้องเขียน plan แยกก่อนลงมือ

## 7–9. ที่เหลือ

- **verify `/report`**: เปิดเบราว์เซอร์ดู drill ปี→เดือน→วัน→บิล→รายการ + รันชุดเทสเต็มหลังแก้ `v_daily_report` (ยิง prod ต้องขออนุมัติ)
- **git remote + ภาษา PR**: branch `feature/report-drilldown` มี 4 commit ยัง push ไม่ได้เพราะไม่มี remote
- **เอกสาร**: `docs/adr/` มีสองชุด (ในรีโป + `/Users/arty/Desktop/Projects/Ucom/docs/adr/`) · `CONTEXT.md` อยู่นอก git — งานย้ายไฟล์ล้วน delegate ได้

---

## สรุป (17 ส.ค. 2026)

งานในไฟล์นี้ **เหลือแค่ข้อ 7 (verify `/report` + รันชุดเทสเต็ม) กับข้อ 8 (git remote)** ซึ่งเป็นของผู้ใช้ทั้งคู่
ที่เหลือปิดหมดแล้ว — การแบ่งงาน delegate/Claude ด้านบนเก็บไว้เป็นบันทึกว่าตอนนั้นตัดสินใจยังไง

`agy` ใช้งานได้ปกติแล้ว (เคยติด permission classifier ช่วงหนึ่ง — ไม่ติดแล้ว ใช้จริงสำเร็จ 17 ส.ค.)
