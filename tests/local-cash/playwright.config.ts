import { defineConfig } from "@playwright/test";

// Separate from shared-production acceptance config. LOCAL FIXTURES ONLY.
export default defineConfig({
  outputDir: `/tmp/ucom-cash-browser-${process.pid}-${Date.now()}`,
  testDir: ".", testMatch: ["cash.spec.ts", "online-only.spec.ts"], workers: 1, reporter: "list", timeout: 90000,
  use: { baseURL: "http://localhost:3007", viewport: { width: 390, height: 844 }, trace: "retain-on-failure" },
});
