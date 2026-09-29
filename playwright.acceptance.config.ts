import { defineConfig } from "@playwright/test";

// WRITES to the shared (production) Supabase project. No globalTeardown on purpose (its ZZTEST% wildcard
// delete also removes rows from earlier runs): snapshot before, then `node scripts/e2e-zztest.mts cleanup`.
// The wallet top-up test in expenses.spec.ts is excluded — it adds ฿100 to a real wallet with no cleanup path.
export default defineConfig({
  testDir: "./tests/e2e",
  testMatch: [
    "consignments.spec.ts",
    "redesign-write.spec.ts",
    "repairs.spec.ts",
    "stock-staff.spec.ts",
    "stock-owner.spec.ts",
    "sf.spec.ts",
    "expenses.spec.ts",
    "close-day.spec.ts",
    "offline.spec.ts",
  ],
  grepInvert: /top up a wallet/i,
  use: { baseURL: "http://localhost:3002" },
  reporter: "list",
  workers: 1,
});
