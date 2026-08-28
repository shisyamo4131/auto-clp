/* global console, process */

import { spawn } from "node:child_process";
import { once } from "node:events";
import { mkdtemp, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join, resolve } from "node:path";

import { createServer } from "vite";

const host = "127.0.0.1";
const runtimeBaseUrlEnvironmentVariable = "AUTO_CLP_BROWSER_BASE_URL";
const runtimeOutputDirectoryEnvironmentVariable = "AUTO_CLP_BROWSER_OUTPUT_DIR";
const projectPath = process.cwd();
const playwrightEntry = resolve(projectPath, "node_modules/@playwright/test/cli.js");
const playwrightConfig = resolve(projectPath, "playwright.config.ts");
const chromeLogDirectory = await mkdtemp(join(tmpdir(), "auto-clp-browser-"));
const chromeLogFile = join(chromeLogDirectory, "chrome-debug.log");
const playwrightOutputDirectory = join(chromeLogDirectory, "playwright-output");

function getOwnedServerBaseUrl(server) {
  const address = server.httpServer?.address();
  if (address === null || address === undefined || typeof address === "string") {
    throw new Error("Vite did not expose its owned loopback TCP listener");
  }
  return `http://${host}:${address.port}`;
}

async function runPlaywright(baseURL) {
  const tests = spawn(
    process.execPath,
    [playwrightEntry, "test", "--config", playwrightConfig, ...process.argv.slice(2)],
    {
      cwd: chromeLogDirectory,
      env: {
        ...process.env,
        CHROME_LOG_FILE: chromeLogFile,
        [runtimeBaseUrlEnvironmentVariable]: baseURL,
        [runtimeOutputDirectoryEnvironmentVariable]: playwrightOutputDirectory,
      },
      stdio: "inherit",
      windowsHide: true,
    },
  );
  const [code, signal] = await once(tests, "exit");

  if (code !== null) {
    return code;
  }

  console.error(`Playwright exited from signal ${signal ?? "unknown"}`);
  return 1;
}

let server;
let exitCode = 1;

try {
  server = await createServer({
    root: projectPath,
    server: {
      host,
      port: 0,
      strictPort: true,
    },
  });
  await server.listen();
  const baseURL = getOwnedServerBaseUrl(server);
  console.log(`${runtimeBaseUrlEnvironmentVariable}=${baseURL}`);
  console.log(
    `${runtimeOutputDirectoryEnvironmentVariable}=${playwrightOutputDirectory}`,
  );
  exitCode = await runPlaywright(baseURL);
} catch (error) {
  console.error(error instanceof Error ? error.message : String(error));
} finally {
  try {
    await server?.close();
  } catch (error) {
    console.error(
      `Failed to close the owned Vite server: ${
        error instanceof Error ? error.message : String(error)
      }`,
    );
    if (exitCode === 0) {
      exitCode = 1;
    }
  }

  if (exitCode === 0) {
    try {
      await rm(chromeLogDirectory, { recursive: true, force: true });
      console.log(`Removed browser-test temporary directory: ${chromeLogDirectory}`);
    } catch (error) {
      console.error(
        `Failed to remove browser-test temporary directory ${chromeLogDirectory}: ${
          error instanceof Error ? error.message : String(error)
        }`,
      );
      exitCode = 1;
    }
  }

  if (exitCode !== 0) {
    console.error(`Browser-test diagnostics retained at: ${chromeLogDirectory}`);
  }
}

process.exitCode = exitCode;
