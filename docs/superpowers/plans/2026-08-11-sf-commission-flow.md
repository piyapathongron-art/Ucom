
# SF+ Commission Flow Implementation Plan

> For agentic workers: REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox syntax for tracking.

**Goal:** Add the missing staff-facing SF+ financing action while preserving the existing cash-sale path and report accounting rules.

**Architecture:** Reuse v_pos_stock to enrich POS catalog device rows with acquisition; keep the interaction in the existing Catalog component; call the existing rpc_finance_device from PosPage. Add one migration that enforces acquisition = 'sf_credit' at the RPC boundary, and verify the complete flow through a new Playwright spec and the existing report view.

**Tech Stack:** Next.js/React, TypeScript, Supabase JS, PostgreSQL migration SQL, Playwright.

## Global Constraints

- Follow ADR 0002: SF+ financing creates no sales bill; manual commission is the only shop income.
- Only acquisition = 'sf_credit' and status = 'in_stock' devices may use the finance mutation.
- Commission is per device, numeric, non-negative, and zero is valid.
- Reuse existing views, RPCs, components, and installed dependencies; add no package.
- Do not apply the migration, deploy, push, open a PR, or delete production test data in this task.
- Playwright specs write to the shared production database; run them only after explicit approval for that test command.
- Do not print .env.local or any credential/token output.

## File Map

- Create: tests/e2e/sf.spec.ts — cross-flow intake, finance, and report regression coverage.
- Modify: src/app/(staff)/pos/types.ts — local catalog-row acquisition type.
- Modify: src/app/(staff)/pos/page.tsx — stock metadata loading and finance RPC adapter.
- Modify: src/app/(staff)/pos/Catalog.tsx — SF device actions and commission form.
- Create: supabase/migrations/20260811162006_enforce_sf_finance_device.sql — database boundary guard.
- Verify: tsc, targeted ESLint, targeted Playwright, then full suite only with approval.

### Task 1: Add the failing SF+ end-to-end test

Files:
- Create tests/e2e/sf.spec.ts

Interfaces:
- Consume loginAs(page, username) from tests/e2e/repairs-helpers.ts.
- Require final selectors finance-device, finance-commission, and finance-submit.
- Produce a regression test proving sf_commission increases while sale_revenue does not.

- [ ] Step 1: Write the complete failing test before production code.

~~~typescript
import { test, expect, type Page } from "@playwright/test";
import { loginAs } from "./repairs-helpers";

test.use({ baseURL: "http://localhost:3002" });

function todayInBangkok(): string {
  return new Intl.DateTimeFormat("en-CA", { timeZone: "Asia/Bangkok" }).format(new Date());
}

function parseMoney(text: string | null): number {
  return Number((text ?? "").replace(/,/g, "").trim());
}

async function readReportCell(page: Page, day: string, columnIndex: number): Promise<number> {
  await page.locator('main[data-loading="false"]').waitFor({ state: "visible", timeout: 15000 });
  const row = page.locator('[data-testid="report-row-' + day + '"]');
  if ((await row.count()) === 0) return 0;
  return parseMoney(await row.locator("td").nth(columnIndex).textContent());
}

async function createSfDevice(page: Page): Promise<string> {
  const suffix = String(Date.now()) + "-" + String(Math.floor(Math.random() * 1000));
  const modelName = "ZZTEST-SF-" + suffix;
  const imei = String(Date.now()) + String(Math.floor(Math.random() * 1000));

  await page.goto("/stock");
  await page.locator('[data-testid="open-sf-intake"]').click();
  await page.locator('[data-testid="sf-order-no"]').fill("TEST-SF-" + suffix);
  await page.locator('[data-testid="sf-device-imei-0"]').fill(imei.slice(0, 15));
  await page.locator('[data-testid="sf-device-model-0"]').fill(modelName);
  await page.locator('[data-testid="sf-device-price-0"]').fill("3000");
  await page.locator('[data-testid="sf-intake-submit"]').click();
  await page.waitForTimeout(3000);
  return modelName;
}

test("financing an SF device adds commission without sale revenue", async ({ browser }) => {
  const today = todayInBangkok();
  const ownerContext = await browser.newContext();
  const owner = await ownerContext.newPage();
  await loginAs(owner, "admin");
  await owner.goto("/report");
  await owner.locator('[data-testid="quick-today"]').click();
  const saleBefore = await readReportCell(owner, today, 1);
  const commissionBefore = await readReportCell(owner, today, 5);

  const staffContext = await browser.newContext();
  const staff = await staffContext.newPage();
  await loginAs(staff, "staff");
  const modelName = await createSfDevice(staff);
  await staff.goto("/pos");
  await staff.locator('[data-testid="catalog-search"]').fill(modelName);
  const deviceCard = staff.locator('[data-testid^="catalog-item-device-"]');
  await expect(deviceCard).toHaveCount(1);
  await deviceCard.locator('[data-testid="finance-device"]').click();
  await staff.locator('[data-testid="finance-commission"]').fill("250");
  await staff.locator('[data-testid="finance-submit"]').click();
  await expect(deviceCard).toHaveCount(0);

  await owner.reload();
  await owner.locator('[data-testid="quick-today"]').click();
  expect(await readReportCell(owner, today, 5)).toBe(commissionBefore + 250);
  expect(await readReportCell(owner, today, 1)).toBe(saleBefore);
  await staffContext.close();
  await ownerContext.close();
});
~~~

- [ ] Step 2: Run the targeted test to verify the expected RED state.

Run: npx --no-install playwright test tests/e2e/sf.spec.ts

Expected: it fails at the missing finance-device selector. This command writes an SF order/device to the shared database; obtain explicit approval immediately before running it.

- [ ] Step 3: Commit the test-only RED state.

~~~bash
git add tests/e2e/sf.spec.ts
git commit -m "test(sf): cover financing commission without sale revenue"
~~~

### Task 2: Enrich catalog rows with acquisition metadata

Files:
- Modify src/app/(staff)/pos/types.ts
- Modify src/app/(staff)/pos/page.tsx:20-38

Interfaces:
- CatalogRow becomes Tables<"v_pos_catalog"> with acquisition?: string | null.
- loadCatalog() continues to populate catalog and topProducts, and maps v_pos_stock rows by kind + id.
- Later tasks consume item.acquisition === "sf_credit" without changing the generated database type file.

- [ ] Step 1: Extend the local type.

~~~typescript
export type CatalogRow = Tables<"v_pos_catalog"> & {
  acquisition?: string | null;
};
~~~

- [ ] Step 2: Merge stock metadata in loadCatalog().

Use Promise.all for v_pos_catalog, v_pos_stock, and v_pos_top_products. Build a Map keyed by row.kind + "-" + row.id from stock rows, then map both catalog arrays so device rows carry acquisition; leave product rows unchanged.

- [ ] Step 3: Verify.

Run: npx --no-install tsc --noEmit --incremental false

Expected: exit 0.

- [ ] Step 4: Commit.

~~~bash
git add src/app/\\(staff\\)/pos/types.ts src/app/\\(staff\\)/pos/page.tsx
git commit -m "feat(pos): load device acquisition for catalog actions"
~~~

### Task 3: Add the minimal SF financing interaction

Files:
- Modify src/app/(staff)/pos/Catalog.tsx:6-133
- Modify src/app/(staff)/pos/page.tsx:111-180

Interfaces:
- Catalog receives onFinanceDevice(item: CatalogRow, commission: number): Promise<string | null>.
- The callback returns null on success or the Supabase error message on failure.
- Stable selectors are finance-device, finance-commission, finance-submit, and finance-error.

- [ ] Step 1: Implement the SF card without changing product behavior.

For item.kind === "device" and item.acquisition === "sf_credit", render a card container with data-testid catalog-item-device-ID, a sale button wired to onAddCatalog(item), and a finance-device button that opens the commission form. Keep the existing single button for products and non-SF devices.

~~~tsx
{item.kind === "device" && item.acquisition === "sf_credit" ? (
  <div data-testid={"catalog-item-device-" + item.id} className="rounded border border-neutral-200 p-3">
    <div className="font-medium">{item.name}</div>
    <div className="text-sm text-neutral-500">
      {item.code} · {item.price?.toLocaleString()} บาท
    </div>
    <div className="mt-2 flex gap-2">
      <button type="button" onClick={() => onAddCatalog(item)}>ขายสด</button>
      <button type="button" data-testid="finance-device" onClick={() => setFinanceItem(item)}>
        ผ่อน SF
      </button>
    </div>
  </div>
) : (
  <button
    type="button"
    data-testid={"catalog-item-" + item.kind + "-" + item.id}
    onClick={() => onAddCatalog(item)}
  >
    {/* existing card content */}
  </button>
)}
~~~

- [ ] Step 2: Implement the inline form.

Add local financeItem, commission, financeError, and financing state. Reject blank, NaN, and negative values; zero is valid. Keep the form open and show finance-error when the callback returns an error. Clear it only after the callback returns null.

- [ ] Step 3: Add the parent RPC adapter.

~~~typescript
async function financeDevice(item: CatalogRow, commission: number): Promise<string | null> {
  const { error } = await supabase.rpc("rpc_finance_device", {
    p_device_id: item.id!,
    p_commission: commission,
  });
  if (error) return error.message;
  loadCatalog();
  return null;
}
~~~

Pass it as onFinanceDevice to Catalog.

- [ ] Step 4: Verify and commit.

~~~bash
npx --no-install tsc --noEmit --incremental false
npx --no-install eslint src/app/\\(staff\\)/pos/Catalog.tsx src/app/\\(staff\\)/pos/page.tsx src/app/\\(staff\\)/pos/types.ts
git add src/app/\\(staff\\)/pos/Catalog.tsx src/app/\\(staff\\)/pos/page.tsx src/app/\\(staff\\)/pos/types.ts
git commit -m "feat(pos): add SF financing action"
~~~

Expected: typecheck and ESLint exit 0.

### Task 4: Enforce the SF boundary in PostgreSQL

Files:
- Create supabase/migrations/20260811162006_enforce_sf_finance_device.sql

Interfaces:
- Preserve rpc_finance_device(uuid, numeric) returns void.
- Preserve member and non-negative commission checks.
- Add and d.acquisition = 'sf_credit' to the guarded update.

- [ ] Step 1: Create the migration through the installed CLI.

Run: supabase migration new enforce_sf_finance_device

Use the generated file for the SQL below and keep the committed filename after 20260811120000_daily_report_view.sql.

~~~sql
create or replace function public.rpc_finance_device(p_device_id uuid, p_commission numeric)
returns void
language plpgsql
security definer
set search_path = ''
as $$
begin
  if not public.pos_is_member() then
    raise exception 'ไม่มีสิทธิ์ใช้งาน' using errcode = '42501';
  end if;
  if p_commission is null or p_commission < 0 then
    raise exception 'ต้องระบุค่าคอมมิชชั่น' using errcode = 'P0001';
  end if;
  update public.device_units d
     set status = 'financed', commission = p_commission, financed_at = now()
   where d.id = p_device_id
     and d.status = 'in_stock'
     and d.acquisition = 'sf_credit';
  if not found then
    raise exception 'เครื่องนี้ปล่อยผ่อนไม่ได้ — ต้องเป็นเครื่อง SF ที่อยู่ในสต็อก'
      using errcode = 'P0001';
  end if;
end;
$$;
~~~

- [ ] Step 2: Review and commit without applying the migration.

Run: git diff --check

Do not run supabase db push, supabase migration up, or production SQL.

~~~bash
git add supabase/migrations/20260811162006_enforce_sf_finance_device.sql
git commit -m "fix(db): restrict finance RPC to SF devices"
~~~

### Task 5: Verify the feature and review the final diff

Files:
- Verify all files from Tasks 1–4.

- [ ] Step 1: Run static verification.

~~~bash
npx --no-install tsc --noEmit --incremental false
npx --no-install eslint tests/e2e/sf.spec.ts src/app/\\(staff\\)/pos/Catalog.tsx src/app/\\(staff\\)/pos/page.tsx src/app/\\(staff\\)/pos/types.ts
git diff --check
~~~

Expected: all commands exit 0.

- [ ] Step 2: Obtain approval and run the targeted e2e.

Run: npx --no-install playwright test tests/e2e/sf.spec.ts

Expected: 1 passed. It creates and finances one uniquely named SF device in the shared database; do not run without explicit approval.

- [ ] Step 3: Run the full suite only after targeted e2e passes and approval.

Run: npx --no-install playwright test

Expected: the existing 22 tests plus the new SF test pass. The run creates additional test data and must not be followed by unapproved deletion.

- [ ] Step 4: Inspect final status.

~~~bash
git diff HEAD~4..HEAD --stat
git status --short --branch
~~~

Expected: only the spec, plan, SF test, POS files, and one migration are part of this feature; no .env.local, lockfile, generated type file, or unrelated file changes appear.
