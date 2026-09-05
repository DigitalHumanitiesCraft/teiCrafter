// Source-server diagnostic only. The release gate uses playwright.config.js and the built artifact.
import { defineConfig } from "@playwright/test";
export default defineConfig({
  testDir: "../test/e2e", workers: 1, reporter: "line",
  use: { baseURL: "http://127.0.0.1:4199", browserName: "chromium", headless: true },
});
