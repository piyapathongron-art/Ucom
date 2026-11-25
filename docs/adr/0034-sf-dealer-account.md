# ADR 0034: SF devices come from a dealer account that is settled by statement, not at sale

Status: Accepted 2026-11-25 (owner answers below). Implemented in migration `20261125150000_sf_dealer_account.sql`; not yet applied to production.

Changes [ADR 0002](0002-sf-plus-is-not-revenue.md) and [ADR 0017](0017-sf-device-exits-by-instalment-or-cash-sale.md) as described under "What this replaces". ADR 0016 (commission recognised when received) stays.

## Context

On 2026-11-25 the owner answered the questions in `docs/pos/review-sf-consignment-practicality-2026-11-25.md` and shared a real dealer statement and a commission slip:

1. "SF+" is Samsung Finance+, but the phones come from **another dealer shop** (ร้านตัวแทนจำหน่าย), not from SF itself.
2. When a customer takes an SF instalment, **SF settles that phone with the dealer** ("SF หักเอง"), and the shop's debt for it goes down.
3. On a cash sale the shop keeps the money, and **pays the dealer for the phone later, by statement cycle**.
4. Commission arrives per phone as a bank transfer with a slip.
5. Any down payment the customer gives is passed straight to the dealer, so the shop does not count it.
6. Cancellations have never happened.
7. There is no credit limit, but there are payment cycles (statement below).
8. –9. Consignment out has not happened yet; consignment in is rare.
10. The shop is not VAT-registered and has no accountant.

The statement (one dealer account, as of about 9 Nov 2569) has these columns:

| Column | Meaning |
|---|---|
| วันที่ · ประเภท · เลขที่เอกสาร | date, type, document number |
| วันครบกำหนด | due date; only invoices have one |
| จำนวน · ชำระแล้ว · คงค้าง | amount, paid, outstanding |
| วัน | days past due as of the statement date |

The document types are:
- **การขาย** (`SO-…`): an invoice, the phones the dealer sent. Each has a due date about 12 days later, and the last column shows days overdue (27 and 14).
- **ลดหนี้-รับคืน** (`DCN-WD5-…`): a credit note that lowers the debt. This matches answer 2: a phone financed through SF.
- **ลดหนี้-อื่นๆ** (`DCN-JMB-…`): other credit notes (788, 1,577, 788). The cause is not yet confirmed.
- The footer gives ยอดขาย 40,770, ยอดลดหนี้ 20,063 and ยอดหนี้คงค้าง 20,707. These reconcile exactly: 40,770 − 20,063 = 20,707.

So the real model is an **accounts-payable account with a dealer**: invoices raise the debt, credit notes and payments lower it, and invoices have due dates and age. Today's system differs in three ways:

- **A cash sale clears the debt.** `rpc_create_sale` stamps `sf_paid_full_at`, and `v_sf_due` drops the phone. The statement shows the debt stays until the shop pays.
- **There are no due dates.** ADR 0017 removed them as "not real". The statement has them, and overdue days are what the dealer chases.
- **Payments and other credit notes have nowhere to go.** A payment to the dealer is neither an Expense nor a cash-book movement, so the drawer can't reconcile when cash is used, and nothing matches the statement balance.

## Decision

Model one **Dealer Account** (บัญชีร้านตัวแทน SF) as an append-only ledger. Its balance is what the shop owes the dealer.

| Entry | Effect on debt | Created by |
|---|---|---|
| **Invoice** (`sf_orders`, the dealer's SO number) | + total of its phones' tag prices; carries a due date | Receiving an SF bill (exists today; due date added back, optional) |
| **Financed credit** | − tag price of the phone | Automatically when a phone is financed (`rpc_finance_device`); can later carry the dealer's DCN number |
| **Other credit note** | − amount | Owner enters it from the statement: DCN number, date, amount, note |
| **Payment** | − amount | Owner records it: date, amount, method, reference |
| **Adjustment** | ± amount | Owner only, with a required reason, to reconcile with a statement |

Rules:

- **A cash sale no longer reduces the debt.** The phone's cost on the bill stays the tag price (ADR 0017, unchanged), and the debt stays until a payment covers it. `sf_paid_full_at` keeps its meaning of "sold for cash, cost fixed". It stops meaning "paid to SF".
- **Balance and ageing:** balance = invoices − credits − payments ± adjustments. Credits and payments are applied to the oldest invoice first, the way the statement shows it. An invoice that is not fully covered is open, and its overdue days count from its due date.
- **Reconciliation:** the owner types in the statement's date and ยอดหนี้คงค้าง. The page shows the system balance as of that date and the difference. A difference is fixed with a credit note, a payment or a reasoned adjustment, never by editing past entries.
- **No effect on sales or profit.** Payments are not Expenses (CONTEXT.md, unchanged). Financed credits are not income. Commission stays a separate receipt (ADR 0016).
- **Down payment and fee** are passed through and not recorded (answer 5). If they ever stay in the drawer, that becomes a new decision.
- **Who can do what:** the account page, payments, credit notes and adjustments are owner-only. Staff keep what they have today: receiving bills and choosing ผ่อน SF or ขายสด.
- **Payment method:** transfer only, recorded without touching the cash book. The owner confirmed the dealer is never paid in cash.

## What this replaces

- **ADR 0017:**
  - "ขายสด = the shop pays SF the full tag price at once" is replaced by "debt stays until a payment".
  - "No due date anywhere" is replaced by "an invoice may carry the dealer's due date". The device itself still has no due date, and a phone can still leave stock at any time, by either route.
- **ADR 0002:** "SF sends the phones against a credit line" is clarified: a dealer sends them on account, and SF settles financed phones with that dealer.
- **CONTEXT.md:** add Dealer Account, Payment to dealer and Credit note. Note that a phone financed through SF reduces the dealer debt.

## Owner answers to the follow-up questions (2026-11-25)

1. **What are the "ลดหนี้-อื่นๆ" (`DCN-JMB-…`) credit notes?** The owner is not sure. **Decision for now:** they are recorded as "other credit notes" that only reduce the debt. They are not income and do not touch the report. If the dealer later confirms they are a promotion or a commission paid as credit, they can be reclassified as income in a later step. The entries already store the DCN number and a note, so nothing has to be re-entered.
2. **Is the dealer ever paid in cash?** No, always by transfer. **Decision:** payments are transfer-only and never touch the cash book. There is no cash-book action.
3. One dealer is assumed. The schema can add a `dealer_id` later.

## Alternatives not selected

- **Keep "cash sale = paid" and add a free-text note:** cheap, but the debt figure stays wrong between sale and payment. That is exactly when the owner needs it.
- **Track payment per phone:** the dealer doesn't work that way. The statement settles the account, not individual phones.
- **Record payments as Expenses:** that would count the phone's cost twice, once as the sale's cost and again as an expense (CONTEXT.md).

## Consequences

- New tables for credit notes, payments and adjustments; `sf_orders` gets an optional `due_date` back; `v_sf_due` (or a new view) computes the balance and the ageing from the ledger. Each is a migration, tested in CI before production.
- Once this ships, `v_sf_due` stops dropping cash-sold phones. Any cash sales made before it may already have been paid to the dealer. The first statement after go-live is entered as an opening adjustment, so the system starts from the dealer's own figure.
- The owner gets one place to answer "how much do we owe the dealer, and what is overdue", and can check it against each statement.
