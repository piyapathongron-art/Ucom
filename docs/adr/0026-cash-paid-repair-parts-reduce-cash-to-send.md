# 0026 — Cash-paid repair parts reduce cash-to-send, and staff see them

## Status

Accepted, 2026-09-29. Supersedes ADR 0010 §1 in part (write-only `part_cost`).

## Context

Staff often pay for a repair part out of the drawer. The paper sheet deducts it ("อะไหล่มือถือ 950+180"), but the system's cash-to-send (ADR 0014) does not, so on those days the screen asks staff to hand over more cash than exists. The part cost cannot become an Expense: ADR 0003 puts it on the repair job, and `/report` would subtract it twice.

## Decision

- New column `repair_jobs.part_paid_from` (`cash` / `transfer` / null), chosen when entering the part cost (`rpc_set_part_cost`), mirroring `expenses.paid_from`. Existing rows stay null and are never deducted retroactively.
- `cash to send = cash bills + cash off-bill income − cash expenses − cash consignment payouts − cash-paid part costs`, attributed to the Bangkok day of `part_paid_at`.
- Shown as its own lines ("อะไหล่ · <job>") under "เงินออกจากลิ้นชัก" on the close-day screen and in the LINE digest — never merged into Expense.
- **Staff may now read the cash-paid part cost of the day** (per job), which ADR 0010 kept write-only. ADR 0021 already accepts staff seeing cost inputs as long as no profit is shown; staff also write these figures on paper daily.

## Consequences

- A cost entered the day after it was paid lands on the wrong day's drawer. Accepted; staff enter it when they pay.
- `v_pos_repairs` still carries no `part_cost`; exposure is limited to the close-day read model.
