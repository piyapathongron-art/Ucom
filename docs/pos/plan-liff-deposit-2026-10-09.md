# LIFF deposit implementation plan

1. Review ADR 0029 independently before implementation. Preserve the existing deployment baseline `d587bfd`; unrelated `tsconfig.json` Next dev changes stay separate.
2. Add `/liff/deposit` endpoint with existing server-authenticated login/cash rendering and official SDK initialization. Reuse login/cash components rather than copy accounting forms. Make only this exact bootstrap path public in proxy; no new public API or financial permission.
3. Add validated LIFF URL selection to the `/ฝากเงิน` webhook, using `LINE_LIFF_ID`. Keep the old web link when absent; fail closed if invalid. Add small meaningful checks.
4. Check local browser with mock SDK and local Auth/SQL: successful initialization/login, invalid credentials, SDK/config failure, staff permissions and preserved unopened-book message. User selected agent local browser verification; no production writes or LINE sends.
5. Inspect signed-in LINE Developers provider/channel/apps read-only. Prepare exact app ID/Full-view endpoint/scopes/required configuration for approval; never invent identifiers or broaden consent implicitly.
6. Obtain scoped registration/configuration/commit/push/deploy approval only after a concrete reviewed implementation and settings exist. Keep financial activation separate.
7. Verify actual `/ฝากเงิน` reply and LIFF form on a phone. Obtain actual cash counts and approved opening to complete live deposit/evidence/accounting acceptance. Do not initialize mock production balances.

Scope excludes LINE account binding, chat image ingestion, rich-menu creation, reminder activation, clearing business records and new accounting behavior.
