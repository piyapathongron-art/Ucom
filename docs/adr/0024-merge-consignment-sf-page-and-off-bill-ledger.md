# 0024 — One page for consignment and SF+, one ledger for off-bill money

**Status:** Accepted, 2026-09-28.

Consignment (ฝากออก / ฝากเข้า) and SF+ share one screen, "ฝากขาย & SF+", because staff see them as the same thing: devices the shop holds but has not paid for, which must be settled with someone once they leave. The page has three top tabs (ฝากออก · ฝากเข้า · SF+) and SF+ keeps its own sub-tabs (บิลค้าง · รอค่าคอม · ยืนยันแล้ว). `/sf-commissions` stops being a separate menu item.

The merge is **UI only**. The data model stays as defined in CONTEXT.md and ADR 0022: SF+ remains its own Acquisition with SF Orders and Commission Receipts, and consigned-in stays a separate Acquisition. We rejected modelling SF as just another consign-in partner: a consigned-in sale records the customer's full payment as a Sale, but an SF-financed device never puts money through the shop and earns only a commission. Merging the models would break "ยอดขาย = เงินที่เข้าร้านจริง".

The owner's expense page becomes "รายรับ–รายจ่ายนอกบิล", one ledger with two tabs: Expense and the off-bill income that close-day already records. It covers only money outside Sales. Sales stay on the report page, so no figure is counted twice. The close-day cards for the day's expenses and off-bill income link to this ledger, and the ledger links back. Adding an entry during the day stays on the close-day page.

Top-up wallet balances and the owner's wallet top-up move to the top-up page. A wallet top-up is not a shop Expense (CONTEXT.md), and showing it next to expenses invited that misreading.

Design source: the Ucom POS canvas artifact (boards Consignment, Expenses, Closing, Topup, Settings; version 22).
