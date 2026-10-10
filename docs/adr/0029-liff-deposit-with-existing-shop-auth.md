# ADR 0029: LIFF deposit entry with existing shop authentication

Status: Accepted product direction; implementation and channel registration pending
Date: 2026-10-09

## Decision

The user chose LIFF with existing shop credentials. Open a Full-view LIFF application from the configured group's `/ฝากเงิน` Flex button. Keep Supabase username/password sessions and `profiles.role` authorization; LINE identity never grants cash permissions. Reuse the daily-deposit workflow and all accounting gates in ADR 0028.

Provide a dedicated `/liff/deposit` endpoint, public only for bootstrap/login. The page checks the current Supabase session and renders the existing login form or cash view. Protected cash data and server actions retain existing user/role checks. Initialize the official LIFF SDK at this endpoint before presenting interactive content; never use a browser-supplied LINE profile as authorization.

The login form returns to `/liff/deposit`; invalid/missing credentials return to that same endpoint with a generic error. Existing non-LIFF login behavior stays unchanged. No LINE identity mapping, OAuth-to-Supabase bridge, new database schema or account auto-provisioning.

Use server configuration `LINE_LIFF_ID` as a public application identifier. The webhook uses `https://liff.line.me/{id}` only for a valid configured identifier; without LIFF configuration, preserve the existing HTTPS web deposit link. A malformed configured identifier fails closed. Keep generated cash-summary links unchanged for this scoped entry change.

## Alternatives

- Existing web button: cheapest, already supported, but does not provide the requested LIFF entry/browser behavior.
- LINE account binding: potentially fewer credential prompts, but requires verified token exchange, owner-approved mappings, revocation and account recovery. Deferred by the user's selection.

## External setup and safety

Inspect existing provider and LINE Login/LIFF configuration before registering anything. Full-view endpoint must be the production HTTPS `/liff/deposit` URL. Channel creation, app registration, new consent scopes, environment changes and deployment require explicit bounded approval after exact settings are known. No paid verification or publication process is assumed. Current official docs recommend LINE MINI App for new LIFF apps; prefer inspecting/reusing an existing suitable app before introducing a broader channel/product migration.

Read-only LINE console login is currently pending. A LIFF identifier alone does not open the cash ledger. Production `activation_ready=false` and null epoch remain until separate hosted acceptance, actual counts and approved opening.

## Verification

Use existing Node assertion seams for link validation and login return paths. Check local browser initialization success/failure, unauthenticated shop login, credential failure, valid staff form, owner/staff authorization preservation and missing configuration. Local SDK fixtures cannot prove LIFF consent, native phone navigation, file chooser or session persistence. Verify those on a phone after channel configuration and deployment, with a separately authorized real cash/evidence acceptance scope.

## Sources

- https://developers.line.biz/en/docs/liff/registering-liff-apps/
- https://developers.line.biz/en/docs/liff/differences-between-liff-browser-and-line-in-app-browser/
- https://developers.line.biz/en/docs/liff/developing-liff-apps/
- https://developers.line.biz/en/reference/liff/
