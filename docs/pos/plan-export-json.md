# plan — ปุ่ม export JSON (เฟส 7 · ADR 0009)

**เป้า:** หน้า `/settings` มีปุ่มเดียว เจ้าของกดแล้วได้ไฟล์ JSON ไฟล์เดียวที่มีทุกตารางครบทุกแถว

**เสร็จเมื่อ:** กด export แล้วไฟล์ที่ได้มีบิลครบทุกใบ นับจำนวนแถวเทียบกับตารางจริงแล้วตรง

## กติกา

- ไม่เพิ่ม dependency (§8) — ใช้ `Blob` + `URL.createObjectURL` + `<a download>` ของเบราว์เซอร์
- ไม่มีปุ่ม restore (ADR 0009 ตัดออกโดยตั้งใจ)
- ไม่ต้องสร้าง API route / ไม่ใช้ service role — ทุกตารางมี RLS policy `pos_is_owner()` แบบ ALL อยู่แล้ว
  เจ้าของ select ตรงจาก browser client ได้ทั้งหมด (ตรวจจาก `pg_policies` แล้ว)
- ไม่ต้องเพิ่ม gate เอง — `/settings` ถูกกันด้วย `src/proxy.ts` (`ownerOnlyPrefixes`) + RLS อยู่แล้ว
- ไม่แตะ DB ไม่แตะ migration ไม่ commit ไม่ push

## ไฟล์

- แก้: `src/app/(owner)/settings/page.tsx` (ตอนนี้เป็น stub "ยังไม่ implement")
- สร้าง: `tests/e2e/export.spec.ts`

## ตารางที่ต้องอยู่ในไฟล์ (11 ตัว)

```
categories, products, device_units, sf_orders, sales, sale_items,
repair_jobs, expenses, topup_carriers, topup_wallet_entries, profiles
```

**ห้ามใส่** `display_settings` — เป็นตารางของอีกแอปที่ใช้โปรเจกต์ Supabase ร่วมกัน (ADR 0008)

## กับดักที่ต้องกัน — PostgREST คืนแถวได้ไม่เกิน 1000 ต่อคำขอ

ตอนนี้ `sales` = 1,089 แถว · `sale_items` = 1,591 แถว → **ยิง `.select("*")` เฉยๆ ได้ backup ที่ขาด**
ซึ่งพังเงื่อนไข "เสร็จเมื่อ" ตรงๆ ต้องวนดึงเป็นหน้าๆ:

```ts
async function fetchAll(table: string) {
  const rows: unknown[] = [];
  const PAGE = 1000;
  for (let from = 0; ; from += PAGE) {
    const { data, error } = await supabase.from(table).select("*").range(from, from + PAGE - 1);
    if (error) throw new Error(table + ": " + error.message);
    rows.push(...(data ?? []));
    if ((data?.length ?? 0) < PAGE) return rows;
  }
}
```

ดึงทีละตารางตามลำดับ (11 คำขอขึ้นไป ไม่ต้อง `Promise.all` ให้ซับซ้อน)

## รูปไฟล์

ชื่อ: `ucom-backup-YYYY-MM-DD.json` (วันที่ตามเวลาไทย — ดู `todayInBangkok()` ใน `src/app/(owner)/report/types.ts` ใช้ซ้ำได้)

```json
{
  "exported_at": "2026-08-14T09:00:00.000Z",
  "tables": { "categories": [...], "products": [...], "...": [] }
}
```

`JSON.stringify(payload, null, 2)` → `new Blob([json], { type: "application/json" })`

## หน้าจอ

`"use client"` component ปุ่มเดียว + สรุปผลหลังกด (สรุปนี้คือเครื่องมือที่เจ้าของใช้เทียบจำนวนแถว):

- ปุ่ม `data-testid="export-button"` ข้อความ "ดาวน์โหลดไฟล์สำรอง" · ระหว่างทำงาน disable + เปลี่ยนข้อความเป็น "กำลังรวบรวมข้อมูล"
- หลังเสร็จ แสดงรายการ `ชื่อตาราง — n แถว` ครบทุกตัวใน `data-testid="export-summary"`
- error แสดงใน `data-testid="export-error"` (ห้ามโชว์ raw error ดิบจาก DB — §8 ให้ขึ้นข้อความไทยสั้นๆ แล้ว `console.error` ตัวจริง)
- ห้าม `setState` แบบ sync ใน `useEffect` body — งานนี้ทั้งหมดอยู่ใน onClick อยู่แล้ว ไม่ต้องมี effect
- `createClient()` เรียก**ในตัว component** ไม่ใช่ module scope (ให้ตรงกับ `src/app/(owner)/report/page.tsx`)

## เทส `tests/e2e/export.spec.ts` — 1 เทส

ใช้ `loginAs(page, "admin")` จาก `tests/e2e/repairs-helpers.ts` · `test.use({ baseURL: "http://localhost:3002" })`

1. ไป `/settings` กด `export-button`
2. รับไฟล์ด้วย `page.waitForEvent("download")` → `download.path()` → `readFile` → `JSON.parse`
3. assert:
   - มีครบทั้ง 11 key ใน `payload.tables`
   - `payload.tables.sales.length > 1000` — **นี่คือข้อพิสูจน์ว่า pagination ทำงาน** (ห้าม assert ตัวเลขเป๊ะ ชุดเทสตัวอื่นสร้างบิลเพิ่มระหว่างรัน)
   - `payload.tables.sale_items.length >= payload.tables.sales.length`
   - ชื่อไฟล์ `download.suggestedFilename()` ขึ้นต้น `ucom-backup-`

## verify ก่อนส่งงาน

```bash
npx --no-install tsc --noEmit --incremental false
npx --no-install eslint "src/app/(owner)/settings/page.tsx" tests/e2e/export.spec.ts
```

ทั้งคู่ต้อง exit 0 · **ห้ามรัน playwright เอง** (เทสยิงฐานข้อมูล prod ต้องขออนุมัติก่อน) · **ห้าม commit / push**
