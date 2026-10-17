# Cash UX redesign — piece 1 (fund names, staff short view, select-all)

Grilling (18 questions, all recommended answers accepted except Q16: anyone may record a new closing revision) set a 3-piece plan; this is piece 1. Pieces 2 (owner `/cash` page) and 3 (close-day 3-step, blind count, ADR 0032) are not started.

## Changes (uncommitted)

- Fund names unified to: เงินเก๊ะ · เงินรอฝาก · เงินรอฝากในร้าน · กำลังไปฝาก, in `/cash`, LIFF, close-day cash zone, repairs fund selects, ledger tables, `FundSelect`, owner controls, and the LINE cash card (`cashFlex.ts`). Custodian stays "ผู้นำฝาก" (a person). Left alone on purpose: "ลิ้นชัก" wording in the ledger add dialog and the close-day digest card (other feature).
- Staff opening `/cash` now gets the short deposit view (same as LIFF); owners keep the full overview. `?handover=` deep links are only resolved for the owner view.
- "เลือกทุกวัน" / "ล้างวันที่เลือก" button: selects every dated line with available cash; unknown-day batches (opening/reconciliation) stay manual.
- `CashForm` shows a success toast as well as the inline message: in the short view a returned/confirmed handover leaves the list, taking its inline message with it.
- `tests/local-cash/daily-deposit.spec.ts` updated for the short view (heading, drawer split label, auto-open settle form, new confirmation/button labels, select-all, cancelled card disappears). `cash.spec.ts` only had its fund-name assertion renamed; it was already incompatible with the daily fixture (plain `handover` is rejected) and was not run.

## Verification

- Browser (local lab, fresh fixture `..._ux20261017e`, 375x812): staff `/cash` shows "ฝากเงินร้าน" short view with no owner tools; "เลือกทุกวัน" selected only the two dated lines and toggled to "ล้างวันที่เลือก"; close-day cash zone labels use the new names.
- `daily-deposit.spec.ts` against fresh fixture `..._ux20261017f`: first run found one failure caused by this change (cancelled handover vanishes from the short view); fixed with the toast + spec update; second run 3 passed.
- `tsc`, `eslint src/app/(staff)`, cashFlex/deposit/operations checks pass.
- Not run: real phone/LIFF SDK, light mode, owner overview screenshots (only covered by the spec's admin review step).

## Follow-up: custodian defaults to the signed-in user

`CashContent` now reads `profiles.display_name` with the role and passes it as `userName` to `CashDeposit`/`CashOverview` → `DaySelection`, which uses it as the default of the "ผู้ถือเงินไปฝาก" field (still editable, for when someone else carries the money). The default is also what the form returns to after a successful submit. Verified in the local lab as staff (field shows "LOCAL STAFF"); `tsc` and `eslint` pass. `daily-deposit.spec.ts` was not rerun for this one-field change (the spec `fill`s the field explicitly).
