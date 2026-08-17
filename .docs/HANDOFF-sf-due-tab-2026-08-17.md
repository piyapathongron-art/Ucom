# HANDOFF — Move the "SF bills with outstanding devices" warning into a dedicated SF tab, with edit + delete

Repo root for every path below: `/Users/arty/Desktop/Projects/Ucom/ucom-pos`

## Goal

Today the warning box **"บิล SF ที่ยังมีเครื่องค้าง"** is hard-coded inside the `SfIntake` component on
the **/stock** page (`src/app/(staff)/stock/SfIntake.tsx:198-214`). It is a read-only `<ul>` with no
actions, and when an SF bill is keyed in wrong there is no way to fix or remove it through the UI.

Move that list to the **/sf-commissions** page ("ค่าคอม SF+"), which becomes a real 3-tab page, and give
it **edit** (bill header + still-in-stock devices) and **delete** (whole bill, only when nothing has been
financed/sold).

## Hard rules (from the repo's CLAUDE.md — do not violate)

- All user-facing copy is **Thai**. Code, identifiers, SQL, comments stay **English** except Thai error
  strings raised from RPCs (match the existing style in the migrations).
- **No new dependencies.** No new test runner. No `any`. No dead / commented-out code.
- **Every file you touch must end up ≤ 300 lines.**
- **Do NOT apply the migration.** Write the `.sql` file only. Do not run `supabase db push`, do not use
  any Supabase MCP tool, do not touch production.
- **Do NOT `git commit` or `git push`.** Leave everything in the working tree.
- ESLint forbids synchronous `setState` in a `useEffect` body (and inside async callees). Use the
  existing pattern: `Promise.resolve().then(() => load())` — see `src/app/(staff)/stock/page.tsx:124`.
- Never surface a raw DB/backend error string to the UI where an RPC already raises a Thai message.
- Do not use `confirm()` / `alert()` — use the in-page two-step confirm pattern described below.
- Component files are `PascalCase.tsx`, hooks are `useThing.ts`. Follow the surrounding code's comment
  density and idiom. Deliberate simplifications get a `// ponytail: <why> — <upgrade path>` comment.

---

## Part A — Migration file (write only, never apply)

New file: `supabase/migrations/20260817120000_sf_order_manage.sql`

Copy the house style from `supabase/migrations/20260816102841_sf_sale_price_no_due_date.sql`:
`security definer`, `set search_path = ''`, a `public.pos_is_member()` guard as the first statement,
`revoke all on function ... from public, anon;` + `grant execute ... to authenticated;`, and
**`drop function if exists <full signature>;` immediately before every `create function`** (a
`create or replace` that changes the parameter list silently creates an ambiguous overload — this repo
has been burned by it).

**Do not touch `rpc_upsert_device` or `rpc_upsert_product`.** They were redefined most recently by
`20260816233500_allow_cost_in_upsert_rpc.sql`; that migration is already applied to production and is the
current source of truth for those two functions. This change has nothing to do with them.

### A1. Recreate `v_sf_due` so staff can read it

The current definition is at `20260816102841_sf_sale_price_no_due_date.sql:367-388`. Use `drop view
public.v_sf_due;` then `create view` (not `create or replace`) — the repo convention, and the
`amount_due` expression type changes.

Two changes only:
- `where public.pos_is_owner()` → `where public.pos_is_member()`
- `amount_due` becomes owner-only, returning `null` for staff:
  ```sql
  case when public.pos_is_owner() then
    sum(coalesce(d.cost, d.list_price))
      filter (where d.status <> 'financed' and d.sf_paid_full_at is null)
  end as amount_due
  ```
  Add a short comment saying why: `amount_due` is derived from `cost`, and staff are deliberately kept
  away from cost everywhere else in this schema.

Keep every other column, the `group by`, and the existing grants
(`revoke all on public.v_sf_due from anon;` / `grant select on public.v_sf_due to authenticated;`).

### A2. New view `v_sf_order_devices`

Needed because `device_units` is owner-only under RLS, and `v_pos_stock` collapses
`list_price`/`sale_price` into one `price` column, which cannot be edited.

```sql
create view public.v_sf_order_devices with (security_invoker = false) as
select d.id, d.sf_order_id, d.imei, d.model_name, d.list_price, d.sale_price, d.status
from public.device_units d
where d.sf_order_id is not null and public.pos_is_member();
```
No `cost` column — that boundary stays. Same revoke/grant pair as the other views.

### A3. `rpc_update_sf_order(payload jsonb) returns void`

Payload shape:
```json
{ "id": "<uuid>", "order_no": "…", "ordered_at": "YYYY-MM-DD", "note": "…|null",
  "devices": [ { "id": "<uuid>", "imei": "…", "model_name": "…",
                 "list_price": 0, "sale_price": 0 } ] }
```
Body, in order:
1. `if not public.pos_is_member() then raise exception 'ไม่มีสิทธิ์ใช้งาน' using errcode = '42501'; end if;`
2. `order_no` blank → `raise exception 'ต้องระบุเลขที่บิล SF' using errcode = 'P0001';`
3. `update public.sf_orders set order_no = …, ordered_at = coalesce(…::date, ordered_at), note = nullif(…, '')
   where id = (payload ->> 'id')::uuid;` — `if not found then raise exception 'ไม่พบบิล SF' using errcode = 'P0001'; end if;`
4. Loop `jsonb_array_elements(payload -> 'devices')`; per device:
   ```sql
   update public.device_units
      set imei = …, model_name = …,
          list_price = (…)::numeric,
          sale_price = nullif(… , '')::numeric
    where id = (v_device ->> 'id')::uuid
      and sf_order_id = v_order_id
      and status = 'in_stock';
   if not found then
     raise exception 'แก้ไขได้เฉพาะเครื่องที่ยังอยู่ในคลัง' using errcode = 'P0001';
   end if;
   ```
   An empty `devices` array is valid (header-only edit) — do not raise on it.
5. **Never write `cost`, `status`, `acquisition`, or `sf_order_id`.**

### A4. `rpc_delete_sf_order(p_id uuid) returns void`

1. `pos_is_member()` guard, same as above.
2. Refuse when anything has moved:
   ```sql
   if exists (
     select 1 from public.device_units
      where sf_order_id = p_id
        and (status <> 'in_stock' or sf_paid_full_at is not null)
   ) then
     raise exception 'ลบไม่ได้: บิลนี้มีเครื่องที่ปล่อย/ขายไปแล้ว' using errcode = 'P0001';
   end if;
   ```
3. `delete from public.device_units where sf_order_id = p_id;` **then**
   `delete from public.sf_orders where id = p_id;` — this order is mandatory, the FK is
   `on delete restrict` (`supabase/migrations/20260805120000_pos_core_schema.sql:147`).
4. `if not found then raise exception 'ไม่พบบิล SF' using errcode = 'P0001'; end if;` after the second delete.

### A5. Hand-edit the generated types

`package.json` has exactly four scripts — `dev`, `build`, `start`, `lint` — so nothing regenerates
`src/lib/types/database.ts`, and the migration is not being applied either. Edit it **by hand** to stay
in sync (`v_sf_due` entry is at line 1045, the `Functions:` block starts at line 1125):
- Add `v_sf_order_devices` to `Views` (alphabetical, next to `v_sf_due` at line ~1045). Every column is
  nullable in this generated style: `id: string | null`, `sf_order_id: string | null`,
  `imei: string | null`, `model_name: string | null`, `list_price: number | null`,
  `sale_price: number | null`, `status: string | null`, plus `Relationships: []`.
- Add to `Functions` (~line 1125), matching the surrounding one-line style:
  ```ts
  rpc_update_sf_order: { Args: { payload: Json }; Returns: undefined }
  rpc_delete_sf_order: { Args: { p_id: string }; Returns: undefined }
  ```
  Keep them in the same alphabetical position the existing entries use.

---

## Part B — Make `Modal` shared

Move `src/app/(staff)/stock/Modal.tsx` → `src/app/_components/Modal.tsx`. **Do not change its contents.**
Update the two importers: `src/app/(staff)/stock/SfIntake.tsx` and `src/app/(staff)/stock/AddForms.tsx`
(`import { Modal } from "@/app/_components/Modal";`).

## Part C — Strip the warning out of /stock

- `src/app/(staff)/stock/SfIntake.tsx` — delete the whole block at `:198-214`, drop the `dueList` prop
  from the signature and its type, and drop the now-unused `SfDue` import. The `+ รับบิล SF` button and
  the intake modal must keep working exactly as before (`data-testid="open-sf-intake"` and
  `"sf-intake-submit"` are used by `tests/e2e/sf.spec.ts` and `tests/e2e/stock-staff.spec.ts` — do not
  rename them).
- `src/app/(staff)/stock/page.tsx` — remove the `dueList` state (`:19`), the `v_sf_due` fetch inside the
  mount effect (`:103-106`), the refetch after intake (`:200-203`), the `dueList={dueList}` prop
  (`:235`), and the `SfDue` import (`:11`).
- `src/app/(staff)/stock/types.ts` — remove `SfDue` if nothing imports it any more (grep first).

No e2e test references `data-testid="sf-due-list"`, so nothing breaks.

## Part D — Tabs + the new section on /sf-commissions

`src/app/(staff)/sf-commissions/page.tsx` is already 335 lines, over the 300-line ceiling. Do not add to
it without extracting. Target layout:

| File | Role |
|---|---|
| `sf-commissions/useSfDue.ts` (new) | all state + data access for the due list |
| `sf-commissions/SfDueList.tsx` (new) | renders the due list, the edit modal, the delete confirm |
| `sf-commissions/page.tsx` (edit) | tab state + tab bar; extract whatever is needed to land ≤300 lines |

To get `page.tsx` under 300 lines, extract the existing record/correct form state and the two handlers
(`handleRecord` at `:149-182`, `handleCorrect` at `:184-223`) into a `useSfCommissions.ts` hook, mirroring
`src/app/(staff)/close-day/useCloseDayData.ts`. Do not change their behaviour — the `rpc_record_sf_commission`
and `rpc_correct_sf_commission` calls and their validation must stay byte-for-byte equivalent.

### D1. `useSfDue.ts`

Follow the shape of `src/app/(staff)/close-day/useCloseDayData.ts`. It owns:
- `dueList: Tables<"v_sf_due">[]` loaded from `supabase.from("v_sf_due").select("*")`, ordered by
  `ordered_at` descending. Filter to `(unfinanced_count ?? 0) > 0` at render time, as the old code did.
- `devicesByOrder` — devices for the bill currently being edited, from
  `supabase.from("v_sf_order_devices").select("*").eq("sf_order_id", id)`. Load lazily when the edit modal
  opens; do not prefetch for every bill.
- `saveOrder(input)` → `supabase.rpc("rpc_update_sf_order", { payload: … })`
- `deleteOrder(id)` → `supabase.rpc("rpc_delete_sf_order", { p_id: id })`
- an `error: string | null` holding the RPC's Thai message, and a `reload()` used by both handlers on success.
- Guard against out-of-order responses with a `useRef` request counter, the way
  `sf-commissions/page.tsx:52` and `:88-118` already do.

### D2. `SfDueList.tsx`

Keep the existing warning look so it still reads as a warning: outer box
`className="ucom-surface w-full border-warning/30 bg-warning/5 p-3"`, heading
`className="text-sm font-medium text-warning"` reading **บิล SF ที่ยังมีเครื่องค้าง**, and keep
`data-testid="sf-due-list"` on the container.

Per row (`key={o.sf_order_id}`), Thai, roughly:
`{order_no} · {formatDate(ordered_at)} · เหลือ {unfinanced_count} / {device_count} เครื่อง` then the two
buttons. Reuse the `formatDate` / `fmtMoney` helpers already defined at
`sf-commissions/page.tsx:18-30` — lift them into a small shared spot rather than copying them.

- **แก้ไข** → opens `Modal` from `@/app/_components/Modal` with `size="lg"`, eyebrow `"SF+ / EDIT"`,
  title `"แก้ไขบิล SF"`. The form mirrors `SfIntake`'s: เลขที่บิล SF / วันที่รับ / โน้ต, then one row per
  device with IMEI / รุ่นเครื่อง / ราคาป้าย SF / ราคาขาย, same `ucom-field` classes and grid
  (`md:grid-cols-[1.2fr_1fr_9rem_9rem]`). Only `status === "in_stock"` devices are editable inputs;
  devices in any other status render as read-only text with a muted note that they can no longer be
  edited. **No add-row and no remove-row buttons** — that is out of scope for this change.
  Test ids: `sf-due-edit-<sf_order_id>` on the open button, `sf-due-edit-submit` on the save button.
- **ลบ** → the two-step in-page confirm used by `src/app/(staff)/close-day/ExpensesSection.tsx:140-166`:
  a `deleteConfirmId` state; the row's "ลบ" button swaps into "ยืนยันลบ" (`ucom-danger bg-danger`) +
  "ยกเลิก" (`ucom-secondary`). Test ids `sf-due-delete-<id>` and `sf-due-delete-confirm-<id>`.
  When `(financed_count ?? 0) > 0`, render the delete button `disabled` with a `title` explaining that a
  bill with released devices cannot be deleted — the RPC also refuses, this is just the UI half.
- Show `amount_due` only when it is not `null` (staff get `null` by design — see A1).
- Errors render in the same style as `sf-commissions/page.tsx:234-244`
  (`border border-danger bg-danger/10 … text-danger`).

### D3. The tab bar

There is no tab component anywhere in this codebase and you should not build a general one. The smallest
thing that works:

```tsx
const [tab, setTab] = useState<"due" | "pending" | "receipts">("due");
```
plus a `<div role="tablist">` of three `<button role="tab" aria-selected={…}>`, each with
`data-testid="sf-tab-due" | "sf-tab-pending" | "sf-tab-receipts"`. Style the active state after
`src/app/_components/NavBar.tsx:42-46`: `border-b-2 border-accent text-accent` when active,
`border-transparent text-ink-muted hover:border-border hover:text-ink` otherwise. Labels:

```
[ บิล SF ค้าง (n) ]  [ รอบันทึกค่าคอม ]  [ ยืนยันแล้ว ]
```
`n` = number of bills with `unfinanced_count > 0`. Render only the selected panel: `SfDueList`,
`PendingList`, or `ReceiptsList`. Default tab is `"due"`. Keep the existing `PageFrame` wrapper and its
eyebrow/title/description props unchanged.

After a successful save or delete, reload both the due list and the pending list — deleting a bill
removes device rows that the pending list may be showing.

---

## Definition of done

Run these yourself and paste the real output in your report. Do not claim a step passed without running it.

```
npx tsc --noEmit
npm run lint
npx next build
grep -rn "dueList\|SfDue" "src/app/(staff)/stock/"        # must return nothing
grep -rn "stock/Modal" src                                 # must return nothing
wc -l src/app/\(staff\)/sf-commissions/*.ts*  src/app/\(staff\)/stock/*.ts*  src/app/_components/Modal.tsx
```
Every file in that last command must be ≤ 300 lines.

Do **not** run the e2e suite (it points at production) and do **not** start a dev server.

## Report back

- Files added / modified / moved.
- The verbatim output of each command above.
- Anything in this spec you could not do, and why. Do not silently reduce scope.
