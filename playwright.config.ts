import { defineConfig, devices } from "@playwright/test";

const host = "127.0.0.1";
const port = 4173;
const baseURL = `http://${host}:${port}`;
const chromeLogFile = process.env.CHROME_LOG_FILE;

export default defineConfig({
  outputDir: "./test-results",
  testDir: "./tests/browser",
  fullyParallel: false,
  workers: 1,
  reporter: "list",
  use: {
    baseURL,
    launchOptions:
      chromeLogFile === undefined ? undefined : { env: { CHROME_LOG_FILE: chromeLogFile } },
    trace: "retain-on-failure",
  },
  projects: [
    {
      name: "chromium",
      use: { ...devices["Desktop Chrome"] },
    },
  ],
});
