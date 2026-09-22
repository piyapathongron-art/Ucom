# Plan — Edu AI app shell and POS vertical slice

## Done in this delivery

1. Replace the global visual foundation with the approved dark-lime palette and Inter/Noto Sans Thai typography.
2. Replace the shared top navigation with the responsive sidebar shell while preserving existing URLs and logout.
3. Restyle `/pos` around the live catalog and cart, preserve offline queue behavior, and add the approved Thai-aid payment preset as `transfer` with receiving account `ไทยช่วยไทย`.
4. Show unimplemented planned surfaces as disabled; staff settings remain hidden.

## Explicitly deferred

- receipt printing and barcode scanner;
- hold bill, dedicated top-up, and consignment workflows;
- staff report/read model and cost-write authorization rollout;
- repair loss redaction and the remaining page-by-page visual ports.

## Verification

- ESLint and TypeScript checks;
- existing POS queue self-check;
- browser comparison at desktop and tablet landscape after user approval.

