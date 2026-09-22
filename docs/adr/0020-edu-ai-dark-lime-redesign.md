# 0020 — Edu AI dark-lime visual system and staged rollout

## Status

Accepted, 2026-09-22. Supersedes the visual, typography, and navigation portions of ADR 0018 and ADR 0019. Existing domain rules, RPC contracts, RLS, and routes remain authoritative.

## Decision

Adopt the approved Build Brief and artifact as the visual authority:

- dark neutral layers: `#15141b` page, `#1e1d27` raised surface, `#111016` sidebar and fields;
- lime `#ddff8d` is reserved for the primary action and active operational state;
- use Inter with Noto Sans Thai;
- use a persistent desktop sidebar from `lg` (1024px), with the existing mobile drawer below it;
- retain the current route names. Surfaces without an implemented contract appear disabled, not as dead links.

The first delivery changes the shared foundation and `/pos` only. It retains the live catalog, cart, offline queue, sales RPC, and current route contracts. Receipt printing, barcode input, hold-bill, dedicated top-up, and consignment are deferred.

## Consequences

All existing pages inherit the new tokens and sidebar immediately. `/pos` remains unavailable below 1024px. No schema, migration, RPC, or role-policy change is part of this decision.

