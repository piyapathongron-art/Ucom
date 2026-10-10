# Focused staff LIFF deposit UX

Status: accepted two short stages; implementation pending.

## Intent

Replace the general cash dashboard in LIFF with a focused phone workflow for staff: choose unpaid receipt days, show each day's amount and selected total, enter change moved to the drawer, attach deposit evidence, then send a readable group summary. Preserve owner review, authorization, exact money validation and recoverable submissions. Keep owner accounting controls in the normal cash dashboard.

## Layout

Use the existing Ucom tokens and typography. A single column has large selectable day rows, one prominent total, the drawer amount field and one primary next/submit action. Display drawer balance as supporting information. Hide movement history and owner administration from this focused entry. Put ongoing deposit reporting before a new deposit.

Before activation, show a staff-facing preparation message and the workflow outline, with submission disabled. Do not fabricate balances or permit financial actions before actual opening.

## Accepted timing

The user selected two short stages on 2026-10-10. Preserve the existing accounting contract: create a handover before money leaves, then report bank deposit/evidence afterward. Do not merge RPCs or change custody tracking. The alternative of one submission after depositing was not selected.

## Execution after decision

1. Record selected timing and independent scrutiny if the contract changes.
2. Implement the minimal dedicated LIFF presentation, reusing existing forms/actions where possible.
3. Verify exact sums, failed/repeated submissions and permission boundaries with existing checks.
4. Obtain browser-verification choice for this UI revision. Browser control is currently unavailable; do not claim visual acceptance from build alone.
5. Record evidence and request scoped commit/push/deploy only after the candidate is concrete.

Out of scope: production cash activation, mock opening balances, financial writes, automatic owner approval, changing the normal POS cash dashboard.
