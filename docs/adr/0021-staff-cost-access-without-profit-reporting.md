# 0021 — Staff cost visibility without profit reporting

## Status

Accepted, 2026-09-22. Product and device stock cost access is implemented in a migration pending database apply; SF, consignment, and commission editors remain later work.

## Decision

Staff may eventually view and edit permitted cost inputs for products, devices, SF, consignment, and commission while their underlying records are open. Each change records `updated_at` and `updated_by`; a separate full audit ledger is not required.

The staff UI and staff-facing read model must not expose system-computed profit, aggregate profit, or profit KPIs. Cost visibility can allow staff to infer an item-level margin; that is an accepted business tradeoff. Records become immutable after sale, commission receipt, or consignment closure. Receipt corrections use void-and-replace rather than edits.

## Consequences

Staff report access remains unavailable and settings stay hidden. The stock migration exposes only current cost and a constrained cost-write RPC; it does not expose profit or any report view.
