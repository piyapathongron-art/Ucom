# Plan — Edu AI operational surfaces

## Goal

Bring the existing staff operational routes into the approved dark-lime shell without changing their live Supabase reads, mutations, role rules, or URLs.

## Scope

1. Refine the shared page frame, toolbar, field, table, and action hierarchy used by `/stock`, `/repairs`, `/close-day`, and `/sf-commissions`.
2. Keep dense transactional tables readable and reserve lime for the selected state and primary commit action.
3. Preserve current report and settings authorization; ADR 0021 cost access is limited to its stock slice.

## Follow-up delivered

The stock screen now follows ADR 0021 for product and in-stock device cost only. The migration records `updated_by`, exposes cost through the stock view, and restricts staff cost writes to the cost RPC. It does not cover SF, consignment, commission, reports, or settings.

## Verification

- ESLint and TypeScript checks.
- Browser review of each operational route after user approval.
