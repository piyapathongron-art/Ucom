# SESSIONLOG — UI/UX redesign v2, mockup phase · 2026-08-16

branch `design/main` · ไม่แตะโค้ด production ในรอบนี้

## บริบท

เจ้าของร้านสั่ง redesign ใหม่ทั้งระบบ (ทั้ง visual และ flow) โดยไม่อิงของเดิมเป็นตัวอย่าง —
ของเดิมคือ ADR 0015 ("ใบเสร็จ", zero accent color) ที่ deploy ไปแล้วบน `design/main`
(`3a370e4`, `e9e11c1`) แต่เจ้าของร้านดูแล้วไม่ถูกใจ

## ทำอะไร

1. **Grilling session** (`mattpocock-skills:grilling`, 3 รอบ) เคาะทิศทาง: scope
   (visual+flow), deliverable (mockup ก่อนแตะโค้ดจริง), style direction, หน้าที่จะทำก่อน,
   ความยืดหยุ่นของ `data-testid` ระหว่าง mockup, format (Claude Artifact)
2. เขียน **ADR 0018** (`ucom-pos/docs/adr/0018-uxui-redesign-v2-direction.md`) — superseded
   กติกา "ไม่มีสี accent" ของ ADR 0015 ด้วยทิศทาง "Operational Ledger 2.0" (เพิ่ม accent 1 สี
   โทนทอง `#A9790E`/`#D9A53C`) พร้อม cross-link สองทาง
3. สร้าง **static HTML/Tailwind-equivalent mockup 8 หน้า** เป็น Claude Artifact (ไม่ใช้
   component library ใดๆ ตามข้อจำกัดจริงของ repo) ครอบคลุมทุกหน้าที่มี UI: `/pos` `/stock`
   `/report` `/close-day` `/repairs` `/sf-commissions` `/login` `/settings`
4. ปรับ mockup ตาม feedback หลายรอบจากเจ้าของร้าน — รายละเอียดทั้งหมดบันทึกไว้ใน ADR 0018
   หัวข้อ "รายละเอียดที่เคาะเพิ่มระหว่างรีวิว mockup" (ตัดช่องรูปสินค้า, ส่วนลดรายชิ้น/ทั้งบิล,
   ตัดช่องทางบัตร, `/stock` เหลือแค่จำนวน+ราคา, `/report` เหลือ KPI ยอดขาย/กำไร, `/close-day`
   เพิ่มรายรับนอกบิล/รายจ่ายประจำวันพร้อม dropdown เงินสด/โอน และตารางบิลวันนี้ให้ recheck)
5. เจ้าของร้าน**อนุมัติทิศทางแล้ว** ("โอเค") — อัปเดตสถานะ ADR 0018 เป็นอนุมัติ

## สิ่งที่คงไว้ / ไม่ทำในรอบนี้

- ไม่แตะโค้ด production ใดๆ ทั้งหมดเป็น static Artifact แยกต่างหาก
- ไม่เพิ่ม dependency ใหม่ในโปรเจกต์จริง (mockup เองก็ไม่ใช้ library ภายนอก ยกเว้น embed font
  IBM Plex Sans Thai/Mono เป็น base64 ในตัว Artifact เอง)
- ยังไม่ตรวจว่า flow ใหม่ที่เคาะ (ส่วนลดรายชิ้น, ช่องทางเงินสด/โอนของรายรับ-รายจ่ายนอกบิล ฯลฯ)
  มี schema/RPC รองรับหรือยัง — ทิ้งไว้เป็นงานตรวจตอนวางแผน rollout

## Verify แล้ว

- เปิด mockup ทั้ง 8 หน้าดูจริงผ่าน Artifact ก่อนส่งให้ผู้ใช้ทุกรอบที่แก้ (ไม่ใช่แค่ generate
  แล้วส่ง) — ตรวจ layout, responsive breakpoint, light/dark token ครบตาม `artifact-design`
- ผู้ใช้รีวิว mockup เองผ่านลิงก์ Artifact หลายรอบ และยืนยันอนุมัติทิศทางท้ายสุด

## ยังไม่ได้ verify / ยังไม่ทำ

- ยังไม่มีแผน rollout ลงโค้ด production จริง (เป็นขั้นตอนที่ 4 ของแผนเดิม ตั้งใจแยกเป็นรอบถัดไป
  หลัง mockup อนุมัติ — ยังไม่ได้เริ่ม)
- ยังไม่ตรวจ schema/RPC ว่ารองรับฟีเจอร์ใหม่ที่โผล่จาก mockup (ส่วนลดต่อรายการ, ต่อบิล,
  รายรับ/รายจ่ายนอกบิลแยกช่องทางเงินสด/โอน) หรือยัง
- ยังไม่ commit/push — ทำงานเป็น session เดียวบน `design/main`, ยังไม่ได้ถามเรื่อง commit

## สถานะท้ายช่วงนี้

ADR 0018 อัปเดตครบพร้อม cross-link ADR 0015 · mockup 8 หน้าอนุมัติแล้ว รอสั่งขั้นตอนถัดไป (วางแผน
rollout ทีละหน้า) เมื่อพร้อม
