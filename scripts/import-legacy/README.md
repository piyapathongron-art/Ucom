# นำเข้าข้อมูลจากระบบเก่า (เฟส 2)

ข้อมูลต้นทาง: `~/Downloads/US_POS_Backup_2026-08-04.json` (schema v1.1.5)
กติกาว่าย้ายอะไรไม่ย้ายอะไร: `docs/adr/0007-migration-scope.md`

## ใช้ยังไง

```bash
# 1. สร้าง SQL (เขียนลง ./generated/ ซึ่ง .gitignore ไว้ — regenerate เอาไม่ต้อง commit)
python3 gen_import_sql.py

# 2. ซ้อมกับ Postgres เปล่าก่อนเสมอ — อย่ายิงตรงเข้า prod
docker run -d --name pos-check -e POSTGRES_PASSWORD=test postgres:17
docker cp 00_fake_supabase.sql pos-check:/tmp/
docker cp ../../supabase/migrations/. pos-check:/tmp/
docker cp generated pos-check:/tmp/generated
docker exec -u postgres pos-check psql -v ON_ERROR_STOP=1 -f /tmp/00_fake_supabase.sql
# แล้วรัน migration 3 ไฟล์ตามลำดับ ตามด้วยไฟล์ใน /tmp/generated เรียงชื่อ

# 3. ตรวจตัวเลข
docker cp verify_import.sql pos-check:/tmp/
docker exec -u postgres pos-check psql -f /tmp/verify_import.sql
```

`00_fake_supabase.sql` จำลองเฉพาะส่วนของ Supabase ที่ migration อ้างถึง
(`auth.users`, `auth.uid()`, role `authenticated`/`anon`) พอให้ SQL รันได้ในกระป๋องเปล่า
**ไม่ใช่ตัวแทนการทดสอบกับของจริง** — จับได้แค่ syntax กับตรรกะใน SQL ของเราเอง

## ตัวเลขที่ต้องได้ (ยืนยันจากการซ้อมจริงแล้ว 5 ส.ค. 2026)

| ของ | จำนวน |
|---|---|
| **ยอดขายรวม** | **1,454,600.00 พอดี** ← เกณฑ์ "เสร็จ" ของเฟส 2 |
| กำไรรวม | 384,268.51 (ตรงกับฟิลด์ `profit` เดิมทุกสตางค์) |
| เงินสด / โอน | 1,238,586 / 216,014 |
| บิล / บรรทัด | 1,071 / 1,573 (product 999 · service 122 · topup 452) |
| เครื่อง | 211 (ขายแล้ว 182 · คงเหลือ 29) |
| สินค้านับจำนวน | 39 |
| รายจ่าย | นำเข้า 53 · ข้ามต้นทุนซ่อม 108 · ข้าม SF 45 |

## กับดักที่เจอมาแล้ว อย่าทำซ้ำ

- **บรรทัดสินค้าในไฟล์เก่าใช้ `id` ของแถว inventory ซ้ำกัน** สินค้าตัวเดียวที่ขายหลายบิล
  ได้ `id` เดียวกันหมด ถ้าเอา `id` นั้นไปทำ primary key จะชนแล้วโดน `on conflict do nothing`
  กลืนหายไป 782 บรรทัด ยอดขายขาด 114,077 บาท **โดยไม่มี error สักตัว**
  → key ต้องมาจาก (บิล + ลำดับในบิล) มี assert ในสคริปต์กันไว้แล้ว

- **เครื่องมี 211 ไม่ใช่ 209** สองแถวเป็นโทรศัพท์จริง (IMEI 15 หลัก ราคาระดับเครื่อง)
  แต่จัดหมวดผิดเป็น `ท` กับ `ทั่วไป` — ถ้าคัดด้วย `group == 'โทรศัพท์'` อย่างเดียวจะหลุด
  ไปเป็นสินค้านับจำนวนที่มี IMEI เป็น SKU

- **IMEI 2 ตัวมีวรรณยุกต์ไทยหลงมาข้างหน้า** (`่้351481181497386`) ต้องตัด Unicode
  category `Mn` ออก · อีก 1 เครื่อง IMEI ว่างจริง ใส่ `IMPORT-<legacy id>` แทน

## ที่รู้อยู่แล้วว่าไม่ครบ

`v_topup_wallet_balance` จะติดลบราว **-201,679** หลังนำเข้า เพราะไฟล์เก่า
**ไม่มีบันทึกการเติมเงินเข้าวอลเล็ตเลย** มีแต่ฝั่งขายออก ไม่ใช่บั๊ก —
เจ้าของร้านต้องกรอกยอดเติมเข้าย้อนหลังเองถ้าต้องการให้ยอดคงเหลือถูก
