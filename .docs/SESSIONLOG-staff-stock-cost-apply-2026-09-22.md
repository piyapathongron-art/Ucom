# Session log — Staff stock cost apply

## Production change applied

- Linked this checkout to Supabase project `DailyGold & Ucom` (`bihgcdceovfettoxmgme`).
- Applied only `20260922130451_staff_stock_cost_access.sql` through the Supabase Management API.
- Recorded only version `20260922130451` as applied. The pre-existing divergent migration history was not repaired or changed.

## Postflight evidence

- `products.updated_by` and `device_units.updated_by` exist.
- `v_pos_stock` exposes `cost`; the existing column order was retained and `cost` appended.
- Both stock update triggers use `pos_touch_stock_updated_at`.
- `rpc_set_stock_cost` exists, is executable by `authenticated`, and is not executable by `anon`.
- Browser owner session at `/stock` rendered remote cost values (for example, `580`) with no console errors; no cost was edited or saved.

## Local validation

- `npm run lint` passed.
- `npx tsc --noEmit --incremental false --allowImportingTsExtensions` passed.
- `node --experimental-strip-types supabase/migrations/staff-stock-cost-access.check.mts` passed.

## Remaining boundary

- Older local and remote migration versions remain divergent and require a separate reconciliation decision before any future `supabase db push`.
- No commit, push, or deploy was performed.
