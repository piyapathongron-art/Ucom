# SF+ Commission Flow

**Status:** Approved design
**Date:** 2026-08-11

## Context

The database already supports the SF+ accounting rule from ADR 0002:
`rpc_finance_device` moves a device to `financed` and records a manually entered
commission without creating a sales bill. `v_daily_report` already derives
`sf_commission` from `device_units.financed_at` and `device_units.commission`.

The missing path is the staff-facing action. The POS catalog currently exposes
only one action for a device (add it to a cash/transfer sale), and there is no
end-to-end test proving that financing contributes commission without creating
sales revenue.

## Goals

- Let staff choose `ขายสด` or `ผ่อน SF` for an SF-credit device from the POS
  catalog.
- Let staff enter a non-negative, per-device commission.
- Use the existing `rpc_finance_device` mutation and refresh the catalog after
  success.
- Enforce the SF-credit boundary in the database RPC, not only in the UI.
- Add one cross-flow e2e test covering intake, financing, and the report delta.

## Non-goals

- No new SF due-date or paid-in-full workflow.
- No new commission formula; the value remains manual per device.
- No cleanup of existing production test data.
- No migration application, deployment, push, or PR creation in this change.
- No offline queue for financing; this follows the existing direct RPC pattern.

## Design

### Catalog data

Reuse the existing `v_pos_stock` view, which already exposes `acquisition` to
staff without exposing cost or commission. `PosPage` will load the stock
metadata alongside `v_pos_catalog` and enrich matching catalog device rows with
their acquisition type. This avoids introducing another database view or
duplicating the catalog SQL.

### POS interaction

- Product cards keep their current single-button behavior.
- A device with `acquisition = 'sf_credit'` renders two actions:
  - `ขายสด`: the current path that adds the device to the cart.
  - `ผ่อน SF`: opens an inline commission form for that device.
- A non-SF device keeps the current sale action only.
- The commission input is numeric, allows zero, and rejects blank or negative
  values before calling the server.
- On RPC failure, the form stays open and shows the returned error. On success,
  the form closes and the catalog reloads so the financed device disappears.

### Database boundary

Add a migration that replaces `rpc_finance_device` with the same contract plus
`acquisition = 'sf_credit'` in the guarded update. The existing membership,
non-negative commission, and `status = 'in_stock'` checks remain. A direct RPC
caller therefore cannot finance a purchased or consigned device by bypassing
the UI.

### Reporting

No report SQL changes are needed. The existing daily report should show the
entered commission under `sf_commission`, leave `sale_revenue` unchanged, and
include the commission in `net_profit`.

### Verification

Add `tests/e2e/sf.spec.ts` with unique order/IMEI/model values:

1. Read today's owner report values for sales revenue and SF commission.
2. As staff, receive one SF order from `/stock`.
3. From `/pos`, choose the device's `ผ่อน SF` action and submit a commission.
4. Confirm the device is no longer available as an in-stock catalog item.
5. Read the owner report again and assert:
   - `sf_commission` increased by exactly the entered amount.
   - `sale_revenue` did not increase.

This test proves the no-sales-bill rule through the public report contract
without requiring a new privileged test-only database query.

## Error and safety rules

- Client validation handles blank and negative commission values.
- The RPC remains the source of truth for authorization and state transitions.
- The conditional update prevents a second finance operation on the same device.
- The migration file is reviewed and verified locally but is not applied to the
  shared production project as part of this task.
