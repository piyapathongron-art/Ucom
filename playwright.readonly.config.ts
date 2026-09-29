import { defineConfig } from "@playwright/test";

// This config runs only read-only specs and omits the default ZZTEST% cleanup.
export default defineConfig({
  testDir: "./tests/e2e",
  testMatch: ["features-readonly.spec.ts", "pagination-filter.spec.ts", "redesign-readonly.spec.ts"],
  use: { baseURL: "http://localhost:3002" },
  reporter: "list",
  workers: 1,
});
