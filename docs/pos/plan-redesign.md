# plan — ออกแบบ UI/UX ใหม่ทั้งเว็บ + responsive (เฟส 10)

เคาะสเปกครบ 15 ส.ค. 2026 (grill 3 รอบ) · ทิศทางอยู่ที่ ADR 0015 · risk = **R1** ต่อขั้น (ย้อนได้ ไม่แตะ DB)

## ข้อเท็จจริงที่ยืนยันแล้ว — อย่า re-derive

- **9 หน้า**: `(owner)/expenses` `(owner)/report` `(owner)/settings` `(staff)/close-day`
  `(staff)/pos` `(staff)/repairs` `(staff)/stock` `login` `page.tsx`
- **คลาส responsive มีอยู่ 5 จุดในทั้งแอป** — `pos/Catalog.tsx:174`, `close-day/page.tsx:185,208`,
  `expenses/page.tsx:385`, `report/page.tsx:154` · ที่เหลือคือ layout ตายตัว
- **ฟอนต์พัง**: `layout.tsx` โหลด `Geist({ subsets: ["latin"] })` (ไม่มีไทย) แล้ว `globals.css`
  override `font-family: Arial, Helvetica` ทับทั้ง body · `--font-sans` ใน `@theme` ไม่ถูกใช้จริง
- **dark mode ตาย**: มี `@media (prefers-color-scheme: dark)` แต่ทุกหน้า hardcode `bg-white`
- ไม่มี dependency ด้าน UI เลย (ไม่มี shadcn/radix/headlessui) — **ห้ามเพิ่ม** ตาม §8
- Tailwind v4 (`@import "tailwindcss"` + `@theme inline`) ไม่ใช่ v3 — ไม่มี `tailwind.config.js`
- e2e ทั้งหมดจับด้วย `data-testid` ไม่ใช่คลาส → **จัดหน้าใหม่ไม่ทำให้เทสพัง ถ้าคง testid ไว้ครบ**

## สเปกที่เคาะแล้ว (สรุปจาก ADR 0015)

| ข้อ | เคาะว่า |
|---|---|
| ทิศทาง | "ใบเสร็จ" — เงิน mono tabular, เส้นคั่นบาง, หนาแน่น + สีเฉพาะสถานะที่ต้องลงมือ |
| สี | 5 กลาง + 3 สถานะ (ดู ADR 0015) · **ไม่มีสี accent** ยอดสำคัญเด่นด้วยขนาด/น้ำหนัก |
| ฟอนต์ | IBM Plex Sans Thai + IBM Plex Mono |
| mono ใช้ที่ไหน | เงินและจำนวน**ในตาราง/การ์ดสรุป** · วันเวลา/ตัวเลขในประโยคใช้ sans |
| breakpoint | ค่า default ของ Tailwind · **`md` (768px) เป็นเส้นตัดเดียว** |
| ตารางจอแคบ | การ์ด: `stock` `repairs` `close-day` `expenses` · ซ่อนคอลัมน์+scroll: `report` |
| `/pos` มือถือ | **ไม่รองรับ** — ต่ำกว่า `md` ขึ้นข้อความให้ใช้จอกว้าง |
| nav มือถือ | แฮมเบอร์เกอร์ + drawer · `/pos` แสดงจางพร้อมหมายเหตุ |
| dark mode | ถอดทิ้ง ลบโค้ดตาย |

## ลำดับลงมือ — แต่ละขั้นจบเป็น commit ที่ verify ได้เอง

**ห้ามรวบเป็น PR เดียว 9 หน้า** — ขั้นที่ 1–2 กระทบทุกหน้า ต้องเห็นผลก่อนเดินต่อ

### ขั้น 1 — Design system

- `src/app/layout.tsx`: เปลี่ยน `Geist`/`Geist_Mono` → `IBM_Plex_Sans_Thai` + `IBM_Plex_Mono`
  (`next/font/google`) · **subset ต้องมี `thai`** · น้ำหนักเท่าที่ใช้จริงเท่านั้น
- `src/app/globals.css`: ประกาศ token สีทั้ง 8 ใน `@theme` · ผูก `--font-sans`/`--font-mono`
  ให้ใช้จริง · **ลบบล็อก `prefers-color-scheme: dark` และ token ที่ไม่ถูกใช้ทิ้ง** ·
  ตั้ง `font-variant-numeric: tabular-nums` ให้ utility ตัวเลขเงิน
- Verify: `tsc` + `lint` + เปิด 1 หน้าดูว่าอักษรไทยเป็น IBM Plex จริง (ไม่ใช่ fallback)
  และ**ตัวเลข mono วางคู่อักษรไทยแล้วไม่ขัดตา** — ถ้าขัด กลับไปทบทวน ADR 0015 ก่อนไปต่อ

### ขั้น 2 — Layout + nav (ทั้ง `(staff)` และ `(owner)`)

- แถบ nav เดิมเป็นแถวลิงก์ตายตัว → ตั้งแต่ `md` ขึ้นไปคงแถวลิงก์ · ต่ำกว่า `md` เป็นปุ่ม
  แฮมเบอร์เกอร์เปิด drawer
- drawer เขียนเอง (`'use client'` เฉพาะ leaf ที่ต้องมี state) — **ไม่เพิ่ม dependency**
- `/pos` ใน drawer: แสดงจาง + หมายเหตุ "ใช้จอกว้าง"
- Verify: เปิดทั้งสอง role ที่ความกว้าง desktop / tablet / phone

### ขั้น 3 — `/stock` → `/report` (สองหน้าที่มือถือต้องดีจริง)

- `stock`: ตาราง → การ์ดต่ำกว่า `md`
- `report`: ซ่อนคอลัมน์รอง + `overflow-x-auto` · drill-down ต้องยังกดได้บนจอแคบ
- Verify: รัน `stock-staff.spec.ts` `stock-owner.spec.ts` `report.spec.ts` ให้ผ่านครบ + ดูด้วยตา

### ขั้น 4 — `/close-day` → `/repairs` → `/expenses`

- ทั้งสามหน้าใช้รูปแบบการ์ดเดียวกันกับขั้น 3
- `close-day` เพิ่งเสร็จ (เฟส 9) — จัดหน้าใหม่ต้องคง `data-testid` ครบทุกตัว
- Verify: `close-day.spec.ts` `repairs.spec.ts` `expenses.spec.ts`

### ขั้น 5 — `/pos`

- เดสก์ท็อป/แท็บเล็ต: จัดใหม่ตามทิศทางใบเสร็จ (ตะกร้าเป็นบิลจริงๆ)
- ต่ำกว่า `md`: หน้าแจ้งเตือนให้ใช้จอกว้าง
- Verify: `pos.spec.ts` `offline.spec.ts` `sf.spec.ts` — ชุดนี้เปราะสุดเพราะแตะคิว offline

### ขั้น 6 — `/settings` → `/login` → `page.tsx`

เบาสุด เก็บท้าย

## กติกาที่ห้ามพลาดระหว่างทำ

- **คง `data-testid` ทุกตัว** — e2e จับด้วย testid ไม่ใช่คลาส ถ้าเปลี่ยนชื่อ เทสพังทันที
- **ไม่เพิ่ม dependency** (§8) — drawer/การ์ด/ตารางเขียนเอง
- **ไฟล์ ≤ 300 บรรทัด** — หน้าที่ต้องมี markup สองชุด (ตาราง + การ์ด) จะยาว ให้แตก component ย่อย
- **Server Component เป็นค่าเริ่มต้น** `'use client'` เฉพาะ leaf ที่ต้องมี state (§8)
- **ห้าม setState แบบ synchronous ใน useEffect body** (§6 — ESLint จับ)
- ทุกขั้นจบด้วย `tsc` + `lint` + รันชุดเทสของหน้านั้น + **ถามก่อนเปิด browser ทุก verify point** (§3)

## ที่ยังไม่ตัดสิน

- **ยังไม่เคยเห็นอักษรไทย IBM Plex คู่กับตัวเลข mono ของจริง** — ขั้น 1 คือจุดที่จะรู้
  ถ้าผลออกมาขัดตา ต้องกลับมาเคาะ Q9 ของ ADR 0015 ใหม่ ไม่ใช่ฝืนทำต่อทั้ง 9 หน้า
