import { defineConfig } from "@playwright/test";

// ponytail: no local Supabase stack (ADR-aligned with the rest of the repo) — every
// test run hits prod (bihgcdceovfettoxmgme) through the already-running dev server.
export default defineConfig({
  globalTeardown: "./tests/e2e/global-teardown.ts",
  testDir: "./tests/e2e",
  use: {
    baseURL: "http://localhost:3002",
  },
  reporter: "list",
  workers: 1,
});
