import { defineConfig, devices } from "@playwright/test";

// Fixed safe port: this machine's 45000-48999 TCP range is dead (see
// packages/core/test/perf-benchmark.test.ts); 34000-34999 is verified bindable.
const PORT = 34788;

export default defineConfig({
  testDir: "./e2e",
  timeout: 60_000,
  fullyParallel: false,
  workers: 1,
  reporter: [["list"], ["html", { open: "never" }]],
  use: {
    baseURL: `http://127.0.0.1:${PORT}`,
    ...devices["Desktop Chrome"],
  },
  webServer: {
    command: "npm run build && node node_modules/tsx/dist/cli.mjs server.ts",
    url: `http://127.0.0.1:${PORT}/api/health`,
    env: { NODE_ENV: "production", PORT: String(PORT) },
    reuseExistingServer: false,
    timeout: 120_000,
  },
});
