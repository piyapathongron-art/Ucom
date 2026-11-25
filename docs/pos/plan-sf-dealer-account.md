# Plan: SF dealer account (ADR 0034)

Status: draft, 2026-11-25. Waiting on the two open owner questions in ADR 0034. Steps 1–3 can start before those are answered; step 4 cannot.

Goal: the owner can see what the shop owes the SF dealer, what is overdue, and whether it matches the dealer's statement. Recording a payment or a credit note takes one form.

## 1. Schema (one migration, tested in CI)

- `sf_orders.due_date date null`: the invoice's due date from the dealer, re-added and optional.
- `sf_dealer_entries`: an append-only ledger, one row per credit note, payment or adjustment. Columns:
  - `kind` (`credit_financed` | `credit_other` | `payment` | `adjustment`), `entry_date`, `amount numeric(12,2)`;
  - `doc_no`, `method` (`transfer` for payments in the first release), `reference`, `note`;
  - `device_unit_id` (for `credit_financed`), `created_by`, `created_at`;
  - `voided_at`, `voided_by` and `void_reason` (a correction voids the row and adds a new one; nothing is updated or deleted);
  - amount checks: `> 0` and not NaN, with the sign implied by `kind`; an `adjustment` takes a signed amount and requires a note.
- RLS: owner-only for everything. Staff get no access to the table.
- `rpc_finance_device` writes a `credit_financed` row for the phone's tag price in the same transaction.
- **Backfill:** a `credit_financed` row for every phone that is already `financed`. On go-live the owner records one opening `adjustment` equal to the difference from the latest statement.
- `rpc_create_sale` keeps setting `cost = list_price` and `sf_paid_full_at` (the phone's cost is fixed). Nothing that computes the debt reads `sf_paid_full_at` any more.

## 2. Views and RPCs

- `v_sf_dealer_account` (owner-only): the ledger with a running balance, oldest first.
- `v_sf_dealer_invoices` (owner-only): each invoice with its total, the amount applied to it (FIFO across non-voided credits and payments), what is open, its due date and days overdue.
- `v_sf_due`: `amount_due` comes from the invoice view, so cash-sold phones stay in the debt until they are paid.
- RPCs, all owner-only:
  - `rpc_sf_dealer_record(kind, date, amount, doc_no, method, reference, note)`;
  - `rpc_sf_dealer_void(id, reason)`;
  - `rpc_set_sf_order_due_date(order_id, date)`.
- pgTAP tests:
  - staff can't read or write the ledger;
  - financing a phone writes exactly one credit;
  - a cash sale leaves the debt unchanged;
  - FIFO ageing gives the right open invoices;
  - a void restores the balance.

## 3. Owner page: the "บัญชีร้านตัวแทน" sub-tab on ฝากขาย & SF+

- **Summary:** what is owed now, what is overdue, and the oldest overdue invoice with its days overdue.
- **Open invoices:** SO number, date, due date, days overdue, open amount.
- **Ledger:** each entry with a running balance and void.
- **Forms:**
  - record payment;
  - record credit note (type: other credit, with the DCN number);
  - adjustment (reason required).
- **Reconcile:** the owner enters the statement date and the statement's ยอดหนี้คงค้าง. The page shows the system balance on that date and the difference, with a link to add the adjustment.
- The SF bill dialog gets an optional "วันครบกำหนด" field.

## 4. After the owner answers

- **If "ลดหนี้-อื่นๆ" is income:** add it to `v_report_entries` as its own channel, the way commission is (ADR 0013), and write that decision into ADR 0034.
- **If the dealer is paid in cash:** add a cash-book action for paying the dealer (drawer or pending fund). That follows the cash-book rules in ADR 0027 and comes with its own tests.

## 5. Rollout

1. Merge and apply the migration by the runbook process (ADR 0008).
2. Backfill the financed credits.
3. The owner enters the latest statement balance as the opening adjustment. From then on, each new statement is reconciled on the page.

## Not in scope

- Several dealers. The first release assumes one account, and the schema can add a `dealer_id` later.
- Down payments and fees, which are passed through and not recorded (owner answer 5).
- Consignment improvements, which the owner rarely uses for now (answers 8–9).
