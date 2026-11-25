# Plan: ADR 0033 redesign rollout (light soft cards on shadcn/ui)

Date: 2026-11-24. Status: draft for owner review; nothing below is started except the foundation step that is marked done.

Inputs:
- [ADR 0033](../adr/0033-light-soft-cards-redesign-with-shadcn.md), the decision this plan carries out.
- The design canvas: <https://claude.ai/artifact/N2vy7A6ETGcCCWwxWxoj3b>, with 40 artboards and one page per route.
- Two read-only reviews made on 2026-11-24. Their full notes live outside the repo, in the session notes folder, as `canvas-ux-check.md` and `consign-sf-logic-review.md`. The findings this plan depends on are summarised below.

## Ground rules

- **The canvas shows the look and the intent. The code and the SQL decide what is true.** Where the canvas invents a field, a status or an action, the page is built from the code and the canvas gets corrected. It does not work the other way round.
- **Visual work does not change schema, RPCs or RLS** (ADR 0033 and ADR 0020). Anything that needs a backend change goes into its own step with its own ADR or migration, and that step is listed separately below.
- **e2e tests run against the production Supabase project** (`playwright.config.ts`). They are never run without the owner's go-ahead. The day-to-day checks are ESLint, `tsc`, `next build`, the `*.check.mts` self-checks and a browser check against local dev.
- **One route per PR.** Each PR rewrites that page's e2e spec where its flow changed, as ADR 0018 already accepted.

## Step 0. Fix SF and consignment logic first (backend, separate from the redesign)

These bugs exist today, whatever the look. They need migrations, so each one needs owner approval before it is applied to the shared Supabase project.

| # | Severity | Problem | Fix direction |
|---|---|---|---|
| 0.1 | High | `rpc_upsert_device` (latest in `20260816233500_allow_cost_in_upsert_rpc.sql`) takes `status` straight from the payload, and every logged-in user can call it. A staff member can move a financed, sold or consigned device back to in-stock and sell it again, or mark a device sold with no Sale. | Allow only in_stock ↔ inactive through this RPC (or no status change at all). Every other transition stays in its own RPC (finance, sale, consignment). Reject inserting `consigned_in` with no case. |
| 0.2 | High | `rpc_set_stock_cost` lets staff set a cost on an unpaid SF device (`sf_credit`). The cost field also shows in `stock/StockDrawer.tsx:32`. `rpc_create_sale` and `v_sf_due` use that cost ahead of the tag price, so a cost of 0 turns the whole price into profit and removes the device from the SF debt. This contradicts ADR 0017. | Block cost writes on `sf_credit` devices in the RPC, and hide the field in the drawer. |
| 0.3 | High | SF prices are not validated. `SfIntakeDialog.tsx` defaults the tag price to "0" and turns a bad number into 0. The SQL accepts 0. | Require tag price > 0 in the RPC and in the form, and show an error when a number cannot be read. |
| 0.4 | Medium | Editing an SF bill cannot add a device. New rows are sent with an empty id, so `rpc_update_sf_order` fails the whole save. | Either support new rows in the RPC, or remove "+ เพิ่มแถวเครื่อง" from the edit dialog. |
| 0.5 | Medium | Scanning an SF device in `/pos` puts it straight into the cart as a cash sale, skipping the ขายสด / ผ่อน SF choice that ADR 0002 requires. | In the scan path, when the device is SF, open the same choice the card shows. UI only. |
| 0.6 | Medium | Financing a device that is already in the cart leaves it there, and the whole bill then fails at checkout. | Remove it from the cart when it is financed, or block financing while it is in the cart. UI only. |
| 0.7 | Medium | `ConsignmentsTab.tsx` shows one generic "refresh" toast for every error, which hides duplicate IMEI, not-receiving-device, paused receiving and share ≥ price. | Map the RPC errors to their Thai messages, the same way `/pos` does. UI only. |

Owner decisions this step needs:
- **SF debt payment.** A cash sale of an SF device clears what the shop owes SF straight away, but nothing records paying SF. Is that intended, or do we need an "owed to SF" list?
- **SF bill permissions.** May staff delete an SF bill or edit its tag prices? Today anyone can, and nothing is logged.

Items 0.5, 0.6 and 0.7 are UI only and can ship with the redesign of their page. Items 0.1 to 0.4 change SQL and must ship first.

**Status (2026-11-25): merged in PR #6, tested in CI, not yet applied to production.**
- 0.1 to 0.4 are one migration, `supabase/migrations/20261125090000_sf_consign_device_guards.sql`, with the contract check `sf-consign-device-guards.check.mts`.
  - It applies cleanly in CI (PR #8), and `supabase/tests/database/02_*` covers it.
  - The steps for applying it to production are in `apply-2026-11-25-migrations.md`.
- The same day's RPC audit (`audit-rpc-2026-11-25.md`) added `20261125120000_rpc_audit_fixes.sql` (PR #7). It is applied right after this one.
- UI changes, all pure UI:
  - SF row validation in `SfIntakeDialog` (new `sfRowProblem` in `sfDuplicates.ts`, with a check);
  - no cost field on unpaid SF devices in `StockDrawer`;
  - the SF scan choice and removing a financed device from the cart in `pos/page.tsx`;
  - real error messages in `ConsignmentsTab`.

## Step 1. Correct the canvas before building from it

Most of what the UX review found belongs in the mockup, not in the code. Fix these on the canvas, or write them down as decided, before the matching page is built:

- **Shell:**
  - Staff artboards (Main, Stock) show รายงาน and รายรับ–รายจ่าย, which are owner-only in `navLinks.ts`. Use the Sidebar component with `owner=false`.
  - Add logout and the user/role card.
  - Design the mobile "more" menu so it is filtered by role.
- **/pos:**
  - Devices are one catalogue row per unit (no "IMEI ×3"), and there is no "SF+" category in `v_pos_catalog`.
  - The SF card has two buttons (ขายสด / ผ่อน SF), not "+ เพิ่ม".
  - Remove the invented bill number "บิลที่ 0142", the online/synced chip and ล้างบิล, or decide to build them.
  - The top-up amount must start empty, not at 100.
  - Add the loading, empty, error and offline states, the best-seller row and pagination.
  - In PosQueue, hide "ลบบิลนี้ทิ้ง" while the cash book is on, and add the confirm dialog, the owner classify dialog and the not-main-device state.
- **PosSuccess** needs a bill number and printing, which staff cannot read today (no RPC returns it; `sales` is owner-only). This is an owner decision: drop the dialog, show it without a number, or approve a backend step to return the bill number.
- **MobilePos** has no cart, checkout or error screens yet. Draw them, plus the "not available on mobile" state for SF installment and per-line discount.
- **/login:** remove the "ทำงานต่อได้แม้เน็ตหลุด" chip. Offline billing is switched off (`RECEIPT_OFFLINE_MESSAGE`).
- **/close-day:**
  - Fix the impossible state: step 2 is unlocked while the queue still holds a bill.
  - Draw the staff view after closing, without system figures.
  - Draw the revision, retry and stale-version states.
  - Pick one fund name: "เงินเก๊ะ" or "เงินสด".
- **/stock:**
  - Keep the ต้นทุน column; staff can see it under ADR 0021, except on SF devices after 0.2.
  - Use the real statuses: ขายอยู่ / เลิกขาย and the device statuses.
  - Add the device table and the edit drawer.
  - Inline +/- steppers would write an absolute qty and could overwrite a sale. Keep editing in the drawer unless the owner approves a delta RPC.
- **/report:**
  - Remove "ส่งออก JSON".
  - Keep the code's ranges: วันนี้ / สัปดาห์นี้ / เดือนนี้ / ปีนี้ plus a custom range.
  - Keep the four profit cards and the channel, best-seller, SF and repair panels.
  - Show full baht amounts, not K/M.
- **Consign & SF:**
  - Show each step's date, not the created date.
  - Add artboards for consign-in, receive money, pay owner and return.
  - Decide whether staff see the SF outstanding amount. Today they see "-".
- **Accessibility, everywhere:**
  - The disabled blue buttons (`#93b4f5` and `#c7d4f2` with white text) and the `#93b4f5` chart bars fail contrast.
  - Several 36px buttons are too small: ล้างบิล, ×, the queue row buttons and ตรวจอีกครั้ง.
  - SF purple is not in the ADR palette. Either add it to ADR 0033 as the SF tone or use brand blue.

## Step 2. Foundation (partly done)

Done on 2026-11-24 (not committed):
- `shadcn init`: Radix base, Nova preset, `components.json`, `button.tsx`, `lib/utils.ts`.
- Light tokens in `globals.css`. The old token names are mapped onto the new ones so pages not yet moved still work.
- Anuphan font.
- Brand `accent` utilities renamed to `primary`.

Still to do, in one PR:
- Add the shadcn components the first pages need: input, label, card, badge, dialog, sheet, select, radio-group, tabs, table, skeleton, separator, tooltip, and toast (keep sonner).
- Set sizes to ADR 0033: buttons and inputs default 40px, `lg` 44px, pill buttons; card radius `rounded-xl` (about 22px).
- Add status badge variants: success, warning, danger, muted.
- Add a `Field` pattern (label, control, hint, error) so no input has only a placeholder.
- Add app-level `error.tsx`, `not-found.tsx` and `global-error.tsx` with Thai copy.
- Add a type scale (for example 12, 13, 14, 16, 18, 22, 28) and a lint check that flags new `text-[Npx]` values. The existing 104 are removed page by page.
- Remove the `font-mono` mapping once its pages use `tabular-nums` directly.

## Step 3. Shell

- Rebuild `NavBar` and the `(staff)`/`(owner)` layouts on the Sidebar design: a persistent sidebar from `lg`, and a drawer or a role-filtered bottom bar below it (owner decision).
- Keep `navLinks.ts` as the single source of role filtering.
- Add logout and the role card. All nav targets must be at least 44px.
- Check that every route still renders inside the new shell. Pages not yet moved will look out of place, which is accepted.

## Step 4. /pos

**Status (2026-11-25): done on PR #11, not merged.**
- Steps 2 and 3 (foundation and shell) are on the same PR.
- **Large screens:**
  - status card, queue cards, search card, white catalogue cards, and a 22–25rem white cart card;
  - honest totals: subtotal → per-line discounts → bill discount → net;
  - per-line and bill discounts collapse behind "+ ส่วนลด" / "เพิ่ม";
  - SF cards use brand blue, not purple.
- **Below lg:**
  - the catalogue fills the screen, and a fixed "ดูบิล" bar opens the cart in a bottom sheet;
  - ผ่อน SF shows "ผ่อนบนจอใหญ่", and per-line discounts are hidden;
  - the cart renders once (`useIsLarge`), so its state never splits.
- **Defaults chosen for the open owner decisions:**
  - top-up and the bill discount are allowed on phones;
  - the receiving pause/resume controls stay large-screen only, so a phone is not offered as the receiving device.

  Either can change once the owner decides.
- **Checked:** in the browser with sample data at 1440×900 and 375px. No overflow; every control is at least 40px; the checkout button is 56px. Shared pagination buttons went from 34px to 40px.
- **Not checked:** e2e against real data, and the post-checkout dialog (not built; owner decision 1).

1. **Desktop/tablet (≥ lg).** Rebuild `Catalog`, `CatalogCard`, `Cart`, `QueueBanner` and `OpeningCoveredQueue` on the canvas, corrected as in Step 1. Keep `queue.ts`, the cash client, `rpc_create_sale` and `rpc_finance_device` as they are.
   - Include fixes 0.5 and 0.6.
   - Fix the totals labels: show subtotal, discount and net instead of the misleading "ยอดรวมก่อนส่วนลด".
   - Keep the per-line discount and its reason; they are real.
   - Make `QtyStepper` and all controls at least 40px.
2. **Mobile (< lg).**
   - Replace the "หน้าขายต้องใช้จอกว้างขึ้น" gate with search → cart sheet → checkout.
   - SF installment and per-line discount show "ใช้ได้บนจอใหญ่" instead of a control.
   - Owner decisions:
     - Can a phone be the receiving device (pause/resume controls are hidden below `lg` today)?
     - Are top-up and the bill discount allowed on mobile?
3. **Checks.**
   - Run `queue.check.mts` and `useBarcodeScanner.check.mts`.
   - Browser check at 1440, 1024 and 390 wide.
   - Rewrite `pos.spec.ts`, `barcode.spec.ts` and `offline.spec.ts`; run them only with the owner's go-ahead.

## Step 5. /login, /stock, /close-day, /report

**Status (2026-11-25): /login and /stock done on PR #11; /close-day and /report not started.**
- **/login:**
  - a brand panel from lg, without the false offline claim;
  - 48px labelled fields and a Thai error with `role="alert"`;
  - a submit button with a pending state;
  - the "use a tablet" tip is gone.
- **/stock:**
  - a 40px segmented kind toggle and a labelled search (same placeholder);
  - the table below md becomes cards;
  - status chips on the status pairs, and the quantity stepper at 40px (was 28px).
- **Shared:**
  - `PageFrame`, `Drawer`, `ConfirmDialog` and the legacy `.ucom-*` classes are now sized to ADR 0033 (40px controls, 14px button text, no uppercase labels).
  - Every page not yet redesigned gets these too.
  - Arbitrary text-size warnings went from 60 to 42.
- **/close-day (done on PR #11, 2026-11-25):**
  - The two-fund card follows ADR 0032's three steps as tinted step cards: done is green with a tick, the current step is outlined, later steps are muted. Step 2 stays locked until step 1 is done, so the canvas's "count while a bill is queued" state cannot happen.
  - Count fields are 52px with labels in baht and a one-line hint for each fund. The review button is 48px and full width.
  - Staff never see system balances; the owner sees three balance tiles. After closing, everyone sees the latest revision as a green status card with the counts and a ตรง / ขาด / เกิน chip per fund, which is the difference ADR 0032 already shows staff. The system figures stay owner-only.
  - The confirm dialog tints each fund by its difference, and the cancel button reads "กลับไปนับใหม่".
  - Ledger, bills and items are white cards with list rows instead of tables, so they fit 375px. Item kinds are in Thai. Ledger pagination shows only when there is more than one page.
  - The cash-book-off path (`ClosingSummary`, `ClosingForm`) gets the same cards and a 52px count field.
  - The undefined `ucom-error` class is replaced with the danger pair on this page.
  - The fund name stays "เงินเก๊ะ" until owner decision 7.
  - **Checked:** a sample-data harness with stubbed cash RPCs at 1440, 1280 and 375 wide, for staff and owner, before and after closing, and with the cash book off. No overflow; every control is at least 40px. Text-size warnings went from 42 to 33.
  - **Not checked:** against real data, and e2e (`close-day.spec.ts`, `redesign-*.spec.ts`). Test IDs are unchanged.
- **/report (done on PR #11, 2026-11-25):**
  - Kept the code's ranges (วันนี้ / สัปดาห์นี้ / เดือนนี้ / ปีนี้ plus a custom range), its four profit cards, and the channel, best-seller, SF and repair panels. No "ส่งออก JSON", no K/M: every amount is in full baht.
  - Range, view and grouping controls are the /stock segmented pills (40px, active brand blue). The custom range is a labelled fieldset with 40px date fields, side by side on a phone.
  - The sales card is the brand-blue hero, as on the canvas; the other three are white. The change against the previous period is a chip. Cards are 2×2 on a phone and 4 across from xl.
  - Summary panels, the daily-profit strip, the empty state and the loading skeletons are white cards. Bars are decorative, with the value always in text beside them.
  - Bills keep their table (e2e reads cells by column). The bill number is a button, so a row opens from the keyboard. The open row is tinted, channels are chips, and the bill detail is a card with the net amount in brand blue.
  - Drill-down rows show Thai dates (2569, พฤศจิกายน 2569, อ. 24 พ.ย. 2569) and expand through a button. Day entries get kind chips (SF in neutral grey, not purple) and labelled 40px search and type filters.
  - Removed the two `globals.css` rules that styled the old dashed report cards.
  - **Checked:** a harness with stubbed PostgREST responses at 1440 and 375 wide, on all three views, with a bill and a day opened. No overflow; every control is at least 40px. Text-size warnings went from 33 to 13.
  - **Not checked:** real data, printing a bill, and e2e (`report.spec.ts`, `export.spec.ts`, `redesign-*.spec.ts`). Test IDs and column order are unchanged.

In this order:
- **/login:** small. Remove the "use a tablet" tip, and add the empty-field error, the pending state and the mobile layout.
- **/stock:**
  - Include fix 0.2 on the UI side.
  - Label the search input.
  - Rebuild `QtyStepper` to at least 40px.
- **/close-day:**
  - Keep the blind count (ADR 0032).
  - Staff never get system figures, including after closing.
  - The LINE status stays a toast unless a stored status is approved.
- **/report:** keep the code's data and controls, restyle them, and use Thai date labels in the drill-down.

## Step 6. Remaining routes

/consignments (with fix 0.7 and the Step 1 artboards), /sf-commissions, /repairs, /topup, /cash, /expenses, /settings and /liff/deposit. Do one PR each and follow the canvas page for each route. After that, remove the old `ucom-*` classes and token aliases from `globals.css`.

- **/liff/deposit (2026-11-25, stacked on PR #17):**
  - The form itself is `CashDeposit`, which #17 already restyled, covering the canvas boards `LiffDeposit`, `LiffSlip` and `LiffDone`. The signed-out view is the phone `LoginForm` from /login. This PR changes only `LiffShell`'s loading and failed states, following `LiffLoading`.
  - Loading: a white card with `role="status"`, a brand spinner (`motion-reduce:animate-none`) and the existing copy.
  - Failed: a danger-tint card with `role="alert"`. ลองใหม่ is the 48px primary, and เปิดฟอร์มผ่านเว็บ is a 48px outline link to `/cash`. Before, these were an `ucom-primary` button and a bare underline link. The button name ลองใหม่ is unchanged.
  - The canvas line "ถ้ายังไม่ได้เข้าสู่ระบบ …" is shown under both states. The page does show the login form when signed out.
  - Not taken from the canvas:
    - the "U" brand tile;
    - the two-step progress bar on `LiffDeposit`/`LiffSlip`, because the section headings already number the steps;
    - the `LiffDone` button ปิดหน้านี้, which the code does not have (it would need `liff.closeWindow()`; owner decision). ส่งสรุปเดิมเข้า LINE อีกครั้ง does exist, as the `HandoverCard` text link.
  - Follow-up (PR `design/0033-liff-polish`): `CashForm` no longer flashes the blocked-intent warning while it checks localStorage, its error messages render as danger alerts, and the settle form shows a live total (green when bank + drawer + returned equals the amount, amber otherwise). The canvas has matching v2 boards on the LIFF page.
  - **Checked:**
    - ESLint (0 errors, 13 warnings, unchanged), `tsc`, `next build`, and all 17 `*.check.mts`.
    - A harness rendering `LiffShell` in the failed, pending (stub SDK whose `init` never resolves) and ready states at 375 and 1440 wide: no overflow, both failed-state controls 48px and equal width, alert text contrast 5.30:1, the spinner animates, and ready shows only the children.
  - **Not checked:** `motion-reduce` (could not be emulated), the real LIFF SDK inside LINE, and e2e or `tests/local-cash`.

- **/settings (2026-11-25, stacked on PR #11):**
  - Three white cards (`rounded-xl bg-card shadow-card`) in a `max-w-3xl` column: shop info, carrier commission rates and backup.
  - Shop info is two muted tiles in a `<dl>` (one column on a phone, two from sm up).
  - Each carrier rate is still its own `<form>` with an `input[type="number"]` and a "บันทึก" submit, because e2e W10 finds the form that way. The label is linked with `htmlFor`/`id`. The input is the house `Input` at 44px with right-aligned `tabular-nums` (it was `font-mono`). The button is `Button size="lg"` (44px). The rate error uses the danger pair.
  - The backup button is the 48px primary and keeps `data-testid="export-button"`. The export error uses the danger pair with `role="alert"` and keeps `export-error`. The summary is a success-tinted card with a grid of `table · N แถว`, and keeps `export-summary`.
  - Dropped from the canvas:
    - The Thai table names and the "อื่น ๆ · 5 ตาราง" grouping in the summary. The code exports raw table names, so the summary shows those.
    - The file name in the summary heading. The download already carries it.
    - The canvas copy for the backup and rate descriptions. The code's copy stays.
  - **Checked:**
    - ESLint (0 errors, 13 warnings, unchanged), `tsc`, `next build`, and all 17 `*.check.mts`.
    - A harness with stubbed auth, profile, carrier and export responses at 1440 and 375 wide: no overflow (also with the summary open), every control at least 40px (inputs and save buttons 44px, export 48px), linked labels, one form per carrier, no duplicate test IDs. A rate save showed the toast and disabled the button again.
    - Known, unchanged: the input has `max="99.99"`, so out-of-range values hit the browser's native validation tooltip before the red alert. The alert still covers the regex cases the native check misses.
  - **Not checked:** real writes and real data, and e2e (`export.spec.ts`, `redesign-write.spec.ts` W10, `redesign-readonly.spec.ts`). Test IDs, the form/input markup and the button names are unchanged.
- **/expenses (2026-11-25, stacked on PR #11):**
  - Built from the code, not the canvas, in two places:
    - The fund stays a `<select>` (`FundSelect`), not the canvas's radio cards. It is shared with the consignment pay dialog, and e2e calls `selectOption` on it.
    - The canvas hint "บันทึกแล้วจะลบเองไม่ได้ …" shows only while the cash book is on. When it is off, both /expenses and /close-day still let owners delete.
  - Tabs are the segmented pills: 40px, active brand blue, still `role="tab"` with `aria-selected`. The date filters are labelled 40px fields, side by side on a phone. The search has a label and an icon.
  - The table stays from md up, because e2e finds rows with `locator("tr", { hasText })`. Each method is a muted chip. Below md each entry is a white card. The cards carry no test IDs, so the shared `RowAction` takes `withTestIds`.
  - Row actions are 40px. ลบ is the red outline, ยืนยันลบ is red-filled, and the edit-with-reason link points to `/cash`.
  - Totals are a white card with large `tabular-nums` figures. The text the e2e `num()` parser reads is unchanged.
  - `LedgerAddDialog` is shared with /close-day, so its dialog changes too:
    - 48px fields with 14px semibold labels;
    - a decimal input mode;
    - a pending label on submit;
    - the error in the danger pair.
  - `FundSelect` is now 48px. It is only used inside dialogs.
  - Shared: the `Modal` close button is 40×40, the same one-line change as in #15 to #17.
  - **Checked:**
    - ESLint (0 errors; text-size warnings went from 13 to 9), `tsc`, `next build`, and all 17 `*.check.mts`.
    - A harness with stubbed PostgREST and cash-status responses at 1440 and 375 wide, with the cash book off and on, on both tabs. The delete confirm and the add dialog were opened, never submitted.
    - No overflow, every control at least 40px, and no duplicate test IDs. The totals text matches the e2e parser. The cash-book hint shows only when the cash book is on.
  - **Not checked:** real writes, real data and e2e (`expenses.spec.ts`, `redesign-*.spec.ts`, `close-day.spec.ts`). Test IDs and row markup are unchanged.
- **/cash (2026-11-25, stacked on PR #11):**
  - Visual only. The cash logic is untouched: `CashForm`'s submit, retry and lock flow, the payloads, `rpc_cash_*` and the intents. Every label text, `<summary>` text, button name, heading and test ID that `tests/local-cash` matches is unchanged.
  - **ADR 0032 conflict, left for the owner:** the staff page, which /liff/deposit also uses, still shows "เงินเก๊ะ ฿X · เงินรอฝากในร้าน ฿Y". Those are the system balances that close-day hides from staff, so staff can read them here before counting. The owner chose to keep the line in this PR.
    - Hiding the drawer balance would stop that leak.
    - The pending balance would still show through the per-day list, which staff need for deposits.
  - Shared classes live in `cash/cash-styles.ts`:
    - card, summary, text link, select, field label and file input;
    - a status chip per handover state: กำลังไปฝาก is warning, รอตรวจ is brand tint, ยืนยันแล้ว is success, ต้องแก้ไข is danger, and คืนแล้ว is muted.
  - `CashForm`:
    - 48px fields with semibold labels;
    - 20px checkboxes with 40px rows;
    - a 48px full-width submit;
    - the blocked and retry messages as warning boxes.
  - Owner page:
    - It now uses `PageFrame`, with "ยอด ณ …" as the description and ปิดร้าน as a secondary button.
    - Balance tiles are white cards with 2xl amounts, and กำลังไปฝาก is a warning tile. They stack below sm, so 375px does not overflow.
    - Review cards have a brand ring and the status chip. ถูกต้อง is primary and ขอแก้หลักฐาน is the red outline, both 48px. The slip preview is on muted.
    - History rows are green for money in and red for money out. The owner tools rows are 48px.
  - Staff page and /liff/deposit:
    - white cards and muted step circles;
    - each day to choose is a 2px-bordered card that is brand tint when selected, as on the canvas;
    - the selection summary is a muted box with "นำออกไปฝาก" in large brand blue;
    - the slip upload has a 40px tinted file button;
    - the leftover-money section is a muted panel;
    - "ยกเลิกและคืนเงินทั้งหมด" is a red summary.
  - The recovery panel is warning-tinted, and the error states use the danger pair.
  - Not taken from the canvas:
    - the 2×2 owner tool buttons, because the code's list rows keep their hints;
    - the canvas's side-by-side layouts.
  - Shared: the `Modal` close button is 40×40, the same one-line change as in #15 and #16.
  - **Checked:**
    - ESLint (0 errors; text-size warnings stay at 13), `tsc`, `next build`, and all 17 `*.check.mts`.
    - A harness that renders `CashOverview` and `CashDeposit` with a stubbed status and a stubbed `rpc_cash_pending_days`, at 1440 and 375 wide. It covered owner, staff with money out, staff picking days, and both not-yet-opened views, with the details panels, history, the dispute modal and every owner tool open. No page overflow, every control at least 40px, and the texts the tests match are present.
    - It found one problem. At 375 the correct, adjust and refund owner-tool modals overflowed sideways inside the dialog, because a `<fieldset>` defaults to `min-width: min-content` and the long select options pushed it wider. The fieldset now has `min-w-0` and the selects have `w-full min-w-0`. That fix was not re-measured.
  - **Not checked:** the server component `cash-content.tsx` with real data, any real submit, `tests/local-cash`, which needs a local Supabase stack, and e2e.
- **/topup (2026-11-25, stacked on PR #11):**
  - Built from the code, not the canvas:
    - no "ใกล้หมด" low-balance state, because there is no threshold in the code or the SQL;
    - no quick-amount chips (50 / 100 / 300 / 500), because they would be a new feature;
    - errors stay toasts, where the canvas shows them inline.
  - Wallet cards:
    - an initialized wallet is a white card with its balance in `tabular-nums`, plus the owner-only commission for today;
    - a wallet that is not set yet is outlined with a dashed border, with the owner's opening field, a 40px ตั้งยอด button and the one-time hint;
    - the opening input and its button keep the same parent, because e2e finds the button through the input.
  - Sale form:
    - a white card with 48px carrier select and a 52px amount field;
    - the owner's estimate (wallet deduction and commission) shows as a tinted box;
    - cash/transfer is a segmented `radiogroup`, as in /pos, and the account field has a label;
    - the submit button is 56px and full width.
  - The fund button is now secondary (outlined), as on the canvas, so the sale stays the main action.
  - Fund dialog:
    - 48px and 52px fields;
    - the balance under the carrier, and "ยอดหลังเติม" in brand tint (current balance plus amount);
    - the not-set warning and the form error as tinted boxes.
  - History is split into `TopupHistory.tsx`, which keeps `page.tsx` under 300 lines:
    - a table from md up and a list below md;
    - Thai dates with time;
    - the "นำเข้า" chip;
    - commission only for the owner;
    - 40px pagination.
  - Shared: the `Modal` close button is 40×40. This is the same one-line change as on the /repairs PR, so the two merge cleanly.
  - **Checked:**
    - ESLint (0 errors; text-size warnings stay at 13), `tsc`, `next build`, and all 17 `*.check.mts`.
    - A harness with stubbed auth and PostgREST responses at 1440 and 375 wide, for owner and staff, with set and unset wallets, the fund dialog and the set-balance confirm open. No overflow, every control at least 40px, and no console errors. Staff see no commission and no fund button.
  - **Not checked:** real writes, real data and e2e (`topup-live-acceptance.spec.ts`, `features-readonly.spec.ts`, `expenses.spec.ts`, `redesign-readonly.spec.ts`). Test IDs, labels and button names are unchanged.
- **/repairs (2026-11-25, stacked on PR #11):**
  - Built from the code, not the canvas, in three places:
    - no count tiles (รอซ่อม / กำลังซ่อม / รอรับเครื่อง), because they would need extra count queries;
    - no separate part-cost panel, so each job keeps its own inline field;
    - the abandon dialog has no line about part cost counting as a repair cost, because the SQL has not been checked for that.
  - The abandon confirm stays amber, since it is irreversible and not a delete.
  - The status filter uses the /stock segmented pills (40px, active brand blue, `aria-pressed`). The search has a label and a search icon, and keeps its placeholder.
  - Status chips:
    - รอซ่อม is neutral, กำลังซ่อม is brand tint, and รอรับเครื่อง is green;
    - รับแล้ว is muted;
    - ลูกค้าทิ้ง is the danger pair.
  - The forward step is a brand-tint button. ปิดงาน/ออกบิล is the primary button, and ลูกค้าทิ้ง is a red text button. Every control is at least 40px.
  - Prices show as ฿ with `tabular-nums`, right-aligned in the table. The part-cost input has an `aria-label`, and "กรอกแล้ว" is a green chip.
  - The table stays at md and up, with all 7 columns and every test ID. Below md, each job is a white card. The cards carry no test IDs, so no ID appears twice.
  - Intake dialog:
    - 48px fields, with `*` and `required` on the name and device;
    - `tel` and decimal input modes;
    - a pending label on submit;
    - the "data stays if saving fails" hint.
  - Close dialog:
    - a summary card with the status chip;
    - a 52px price field with a hint;
    - cash/transfer as a segmented `radiogroup`, as in /pos;
    - a bill line with the total in brand blue (`formatMoney`).

    The undefined `ucom-error` is replaced with the danger pair.
  - Shared: the `Modal` close button is now 40×40 (it was 32px wide).
  - **Checked:**
    - ESLint (0 errors; text-size warnings stay at 13), `tsc`, `next build`, and all 17 `*.check.mts`.
    - A harness with stubbed PostgREST and cash-status responses at 1440 and 375 wide, with the cash book off and on, and with the intake, close and abandon dialogs open. No overflow, no console errors.
    - The harness found one control under 40px, the 30px-wide "แก้ไข" text button, which is now `min-w-10`. That fix was not re-measured.
  - **Not checked:** real data and e2e (`repairs.spec.ts`, `redesign-*.spec.ts`, `pagination-filter.spec.ts`). Test IDs are unchanged, except that `close-payment-method` is now on the radiogroup instead of a `<select>`; no spec reads it.

**/sf-commissions, the SF+ tab (done 2026-11-25 on branch `design/0033-sf-commissions`, stacked on PR #11):**
- Sub-tabs are 40px pills. The active one is tinted brand and the others are outlined, so they read as second level under the page tabs. The canvas's side-by-side due/pending layout was not used; the code's sub-tabs stay.
- Due bills:
  - from md up a table (e2e finds rows by bill number), and cards below md;
  - a "ใหม่" chip on the bill just saved;
  - 40px edit and delete buttons. A bill with a released device shows a disabled "ลบไม่ได้" instead of a greyed "ลบ".
- Pending commissions and confirmed commissions:
  - labelled search fields;
  - the inline record and correct forms now link each label to its field;
  - 40px fields and buttons, and red errors.
- Intake dialog:
  - 48px header fields and 44px row cells;
  - a "ยิงบาร์โค้ดเพื่อเพิ่มแถว" chip, a 44px remove button, and a dashed brand "+ เพิ่มแถวเครื่อง";
  - the SF credit total in bold brand blue, and red row errors.
- Dealer account (owner only): white stat cards, 44px action buttons, 40px due-date fields and buttons, 48px dialog fields, and a 20px checkbox in a 40px row.
- Shared fix: `.ucom-table-wrap` is now `position: relative`. An sr-only header inside a scrolling table escaped the scroll box and widened the page to 608px on a phone.
- **Checked:** a harness with stubbed views at 1440 and 375 wide, on all three sub-tabs, with the record form and intake dialog opened and the dealer account rendered. No page overflow; every control is at least 40px (the checkbox sits in a 40px row).
- **Not checked:** real data, and e2e (`sf.spec.ts`, `redesign-write.spec.ts`). Test IDs are unchanged, except that the locked delete button now reads "ลบไม่ได้".

**/consignments, ฝากออก and ฝากเข้า tabs (done 2026-11-25 on branch `design/0033-consignments`, stacked on PR #11):**
- The tabs are 44px segmented pills and the call to action is a 48px primary button. The SF+ tab still renders `SfPlusTab` unchanged; it is the /sf-commissions step.
- From md up the table keeps its rows (e2e finds rows by role). Below md each case is a card. Status is a chip (amber waiting on money, green money done, neutral open or returned) with the date of the current step from `reported_at`, `sold_at`, `settled_at`, `paid_at` or `returned_at`, not the created date. Fix 0.7's error mapping is unchanged.
- Next-step buttons are 40px; คืนเครื่อง is amber because it cannot be undone. Pagination buttons are 40px. A dashed note under the list spells out each direction's flow.
- In the dialogs, fields are 48px with the same label text e2e uses (ราคาตั้ง gains "(บาท)"). The action dialog shows the counterparty and list price, and the amount due as a blue total. Report and sell show a live "what the shop gets" preview (price − share). Errors are red, not amber.
- Not built: the canvas's tab counts and its "found in stock" IMEI lookup (no data source), and the canvas artboards for consign-in, pay owner and return (the code's dialogs are used).
- **Checked:** a harness with stubbed rows at 1440 and 375 wide, plus the report dialog's preview. No overflow; every control is at least 40px.
- **Not checked:** real data, and e2e (`consignments.spec.ts`).

## Owner decisions, collected

1. PosSuccess: drop it, show it without a bill number, or approve a backend step that returns the bill number.
2. Mobile POS: can a phone be the receiving device? Are top-up and the bill discount allowed on mobile?
3. Mobile navigation: a bottom bar or the current drawer?
4. Stock qty: keep the drawer, or approve a delta RPC for inline +/-?
5. SF: record payments to SF? May staff delete SF bills or edit tag prices? Do staff see the SF outstanding amount?
6. SF colour: add purple to the palette, or use brand blue?
7. Fund name on close-day: "เงินเก๊ะ" or "เงินสด"?
