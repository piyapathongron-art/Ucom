# Cash UX redesign — piece 2 (owner /cash page)

Plan from the grilling session (Q8–Q15). Piece 3 (close-day 3-step, blind count, ADR 0032) is not started.

## Changes (uncommitted)

- `cash-overview.tsx` rewritten in working order: LINE-retry notice → **ต้องตรวจ (n)** → balances (เงินเก๊ะ · เงินรอฝากในร้าน · กำลังไปฝาก only when > 0) → money-out handovers → collapsible **นำเงินไปฝาก** (hidden while money is out) → **ประวัติเงินสด** → **เครื่องมือเจ้าของ**.
- `review-card.tsx` (new): evidence image inline (signed URL fetched when the card mounts; PDF as link), buttons **ถูกต้อง** (fixed reason "ตรวจแล้วถูกต้อง") and **ขอแก้หลักฐาน** (reason required), each in a `Modal` with the existing required check box and the unchanged `review` action. Parent keys the card by `id:state` so the popup closes when the state moves. Disputed items show "รอพนักงานส่งหลักฐานใหม่" without buttons. The LINE deep-link handover is merged into the review list when it is reviewable and older than the status window.
- `cash-history.tsx` (new): collapsible; finished handovers (confirmed/returned) as one-liners; movements 20 at a time ("ดูเพิ่ม") up to the 50 the status RPC returns; generic `posting` rows are titled by their reason.
- `owner-controls.tsx`: four tool rows (reminder, correct source, adjust, refund), each opening a `Modal` with the same `CashForm`s; pre-activation sections unchanged; disabled forms say why.
- `handover-card.tsx`: old owner review `<details>` removed (moved to the review card).
- `tests/local-cash/daily-deposit.spec.ts`: owner step now checks the slip image, approves through the popup, and asserts the handover is `confirmed`. `cash.spec.ts` is stale (daily fixture rejects plain `handover`) and was not touched or run.
- No SQL, API or action changes.

## Verification

- Browser, local lab (fresh fixture `..._ux20261017g`, 375x812, then desktop), owner account: section order; slip image loaded; 2 balance boxes (reserved 0); dispute popup blocks empty reason/unchecked box, then sends back — popup closed, card became "รอพนักงานส่งหลักฐานใหม่" with note and no buttons; refund tool popup opens/closes with its fields; history opens; no horizontal scroll at 375px.
- `daily-deposit.spec.ts` on fresh fixture `..._ux20261017h`: 3 passed (includes approve path and slip image).
- History titles re-checked in the lab after the posting-reason tweak.
- `tsc`, `eslint src/app/(staff)/cash` pass.
- Not verified: "ดูเพิ่ม" paging (fixtures have < 20 movements), the 3-box balance row at 375px with real amounts (reserved > 0), PDF evidence, real phone, light mode.
