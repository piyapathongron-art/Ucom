# 0023 — Top-up sales cannot overdraw a carrier wallet

**Status:** Accepted, 2026-09-24.

The carrier wallet remains a derived balance: owner funding entries minus the cost of completed top-up sales. A top-up sale must be rejected atomically when its carrier cost exceeds the available balance. The check belongs at the `sale_items` insert boundary used by the existing idempotent sale RPC, so both the dedicated page and POS are covered; a disabled UI button alone cannot protect two tills selling simultaneously. The first implementation serializes top-up inserts shop-wide to avoid lock-order deadlocks in mixed-carrier bills.

The dedicated `/topup` page reuses that Sale and wallet model rather than creating another transaction ledger. Staff may see the operational balance and customer amount, but not the commission rate, carrier cost, or computed profit. Owner-only funding remains distinct from a customer top-up Sale.

Top-up cannot be accepted into the offline queue: the current wallet balance cannot be verified while disconnected. A retry after an uncertain network response keeps the same `client_uuid`, so the existing Sale idempotency rule prevents a duplicate charge.

The imported 452 top-up sale lines have no corresponding historical opening wallet ledger; subtracting them from today's wallet would make every carrier negative. For each carrier, the owner must record the actual physical opening balance once at cutover. The operational balance is that opening snapshot plus funding recorded after it minus top-up costs applied after it. Old imported sales and older funding entries remain in history but are not counted again. The opening entry is not a fabricated backdated funding transfer and cannot be changed through ordinary wallet funding.

Once recorded, funding entries and top-up sale lines are immutable through the application database role. Corrections require an explicit audited process rather than silently rewriting the wallet history.
