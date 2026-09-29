# Session Log: POS Offline Hardening & Queue Fix

- **วันที่:** 2026-09-21
- **เป้าหมาย:** แก้ไขจุดบกพร่องระบบ Offline หน้าขายตามผลการตรวจสอบ `/scrutinize` และแผนงานใน `docs/pos/plan-hardening.md` (เฟส 1)

---

## 1. การเปลี่ยนแปลงที่ทำ

1. **ป้องกันขาย IMEI / สต็อกซ้ำตอน Offline (`src/app/(staff)/pos/queue.ts` & `pos/page.tsx`):**
   - เพิ่มฟังก์ชัน `applyQueueToCatalog` ใน `queue.ts` เพื่อหักยอดบิลที่ค้างอยู่ใน Offline Queue ออกจาก Catalog แบบ Realtime
   - อัปเดต `loadCatalog` ใน `pos/page.tsx` ให้นำรายการสินค้า/เครื่อง IMEI ในคิวมาตัดออกจากหน้าจอเสมอ ทั้งตอนโหลดสำเร็จและตอน Fallback ไปใช้ LocalStorage Cache

2. **ปลดล็อก Deadlock บิลที่ DB ปฏิเสธ (`src/app/(staff)/pos/QueueBanner.tsx`):**
   - เพิ่ม `onRemove` callback และปุ่ม **"ลบบิลนี้ทิ้ง"** (`queue-remove-${uuid}`) สำหรับรายการบิลที่ติด `lastError`
   - เพิ่มฟังก์ชัน `handleRemoveQueuedSale` ใน `pos/page.tsx` มีกล่องยืนยันก่อนลบ ป้องกันการกดพลาด

3. **ปรับปรุงการแจ้งเตือนหน้าปิดร้าน (`src/app/(staff)/close-day/page.tsx`):**
   - แถบเตือนบิลค้างในคิวเพิ่มลิงก์ `<Link href="/pos">` เพื่อให้พนักงานสามารถกดไปยังหน้าขายเพื่อซิงก์หรือจัดการบิลที่มีปัญหาได้ทันที

4. **เพิ่มการทดสอบ (Tests):**
   - เขียน Unit Assertion `src/app/(staff)/pos/queue.check.mts` ทดสอบ 5 assertions ของ `applyQueueToCatalog` (ผ่านทั้งหมด)
   - เพิ่ม 2 E2E Test Cases ใน `tests/e2e/offline.spec.ts`:
     - `discarding a rejected offline sale clears the queue and banner` (ผ่าน)
     - `close-day page displays queue warning with link to pos` (ผ่าน)

---

## 2. ผลการตรวจสอบ (Verification)

- `npx tsc --noEmit` — ผ่าน (0 errors)
- `npm run lint` — ผ่าน (0 errors)
- `node --experimental-strip-types src/app/(staff)/pos/queue.check.mts` — ผ่านครบ 5 assertions
- `npx playwright test tests/e2e/offline.spec.ts` — ผ่านครบทั้ง 4 tests
