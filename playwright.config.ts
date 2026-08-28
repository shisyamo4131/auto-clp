import { defineConfig, devices } from "@playwright/test";

const runtimeBaseUrlEnvironmentVariable = "AUTO_CLP_BROWSER_BASE_URL";
const runtimeOutputDirectoryEnvironmentVariable = "AUTO_CLP_BROWSER_OUTPUT_DIR";
const baseURL = process.env[runtimeBaseUrlEnvironmentVariable];
if (baseURL === undefined || baseURL.length === 0) {
  throw new Error(
    `${runtimeBaseUrlEnvironmentVariable} is required; run browser tests through the package test:browser script`,
  );
}
const outputDir = process.env[runtimeOutputDirectoryEnvironmentVariable];
if (outputDir === undefined || outputDir.length === 0) {
  throw new Error(
    `${runtimeOutputDirectoryEnvironmentVariable} is required; run browser tests through the package test:browser script`,
  );
}
const chromeLogFile = process.env.CHROME_LOG_FILE;

export default defineConfig({
  outputDir,
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
