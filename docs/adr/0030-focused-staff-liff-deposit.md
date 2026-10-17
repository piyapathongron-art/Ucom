# ADR 0030: Focused two-stage staff LIFF deposit

Status: Accepted product decision on 2026-10-10; implementation and visual acceptance pending.

## Context

LIFF currently reuses the general cash dashboard. Staff need a short phone form for daily cash deposits rather than owner accounting tools. The existing cash contract tracks money before departure and reports the deposit after it occurs.

## Decision

Keep two financial stages and present them as short staff tasks:

1. Before departure, select outstanding receipt days, show each amount and total, specify change physically moved to the drawer, confirm the custodian and record the handover.
2. After depositing, open the existing handover, enter the actual bank amount and any physically returned funds, attach evidence and send the summary using the existing settlement action.

Use a dedicated LIFF presentation. Keep authentication, role enforcement, money checks, main-device pause/ACK, durable recovery and owner review unchanged. Ordinary cash dashboard remains available for owner accounting. LIFF does not show owner management/review or movement history.

For an unopened system, present a staff-facing preparation message and the two-stage outline without fake balances or enabled financial submission. Owner activation still requires physical counts and existing cutover checks.

## Alternative not selected

A single report after bank deposit would simplify the visible form further, but loses the existing before-departure custody boundary and requires a different accounting/recovery contract. The user selected two short stages instead.

## Acceptance

Reuse existing exact-money and financial action checks. Review the actual entry/auth/status/forms/recovery path independently. Build success does not establish mobile visual or native phone acceptance. User selected a local browser checklist for this UI revision; production deployment needs a separately approved concrete candidate.
