# plan — งานที่เหลือทั้งหมด (หลังลบข้อมูลเทส 14 ส.ค. 2026)

สถานะฐาน: เฟส 0–6 จบ · เฟส 7 เหลือ 3 ชิ้น · เฟส 8 ยังไม่เริ่ม
schema/RLS/view/RPC บน prod **ครบแล้ว** (`v_sf_due`, `v_topup_wallet_balance` มีอยู่จริง ยังไม่มีหน้าจอเรียกใช้) — งานที่เหลือเกือบทั้งหมดเป็นฝั่ง UI

| # | งาน | tag | ใครทำ |
|---|---|---|---|
| 1 | ปุ่ม export JSON | R1 | **delegate** |
| 2 | เทส e2e เก็บกวาดข้อมูลตัวเอง | R2 | **delegate** |
| 3 | หน้ารายจ่ายร้าน | R1 | delegate (หลังเคาะสเปกด้านล่าง) |
| 4 | หน้าวอลเล็ตเติมเงิน | R1 | delegate (หลังเคาะสเปกด้านล่าง) |
| 5 | เพิกถอนสิทธิ์เขียนบน `v_sale_profit` | R0 | **Claude** |
| 6 | เฟส 8 คิว offline | R1 ใหญ่ | **Claude** |
| 7 | verify `/report` ด้วยตา + รันชุดเทสเต็ม | — | ผู้ใช้ |
| 8 | git remote + ภาษา PR | R0 | ผู้ใช้ |
| 9 | รวม `docs/adr/` สองชุด + `CONTEXT.md` เข้า git | R2 | delegate |

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

## 6. เฟส 8 คิว offline — Claude ทำเอง

ตรรกะ sync พลาดแล้วบิลหาย (`plan-rebuild.md` ระบุไว้ตั้งแต่ต้นว่าเป็นงานของ Claude)
`rpc_create_sale` idempotent ด้วย `client_uuid` อยู่แล้ว ฝั่ง client เหลือ: แคชแคตตาล็อก · คิวใน localStorage (**ต้องมีเวอร์ชันใน key** — กับดักที่เคยโดน) · ส่งซ้ำเมื่อออนไลน์ · ตัวนับบิลค้าง
งานนี้ต้องเขียน plan แยกก่อนลงมือ

## 7–9. ที่เหลือ

- **verify `/report`**: เปิดเบราว์เซอร์ดู drill ปี→เดือน→วัน→บิล→รายการ + รันชุดเทสเต็มหลังแก้ `v_daily_report` (ยิง prod ต้องขออนุมัติ)
- **git remote + ภาษา PR**: branch `feature/report-drilldown` มี 4 commit ยัง push ไม่ได้เพราะไม่มี remote
- **เอกสาร**: `docs/adr/` มีสองชุด (ในรีโป + `/Users/arty/Desktop/Projects/Ucom/docs/adr/`) · `CONTEXT.md` อยู่นอก git — งานย้ายไฟล์ล้วน delegate ได้

---

## สรุปว่า delegate อะไรได้

**delegate ได้ (สเปกสั้นกว่าโค้ด ผลตรวจได้ด้วยตัวเลข):** 1 export · 2 test cleanup · 3 รายจ่าย · 4 วอลเล็ต · 9 ย้ายเอกสาร
**Claude ทำเอง (security / prod / ตรรกะที่พลาดแล้วข้อมูลหาย):** 5 grant · 6 คิว offline
**ผู้ใช้:** 7 verify ผ่านเบราว์เซอร์ · 8 remote + ภาษา PR

ติดอยู่: `Bash(agy:*)` ถูก permission classifier บล็อก — ยังสั่ง `agy` / `claude-9arm` ไม่ได้จนกว่าจะเปิดใน `.claude/settings.json`
