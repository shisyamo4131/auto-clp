/* global AbortSignal, console, fetch, process */

import { spawn } from "node:child_process";
import { once } from "node:events";
import { mkdtemp, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join, resolve } from "node:path";
import { setTimeout as delay } from "node:timers/promises";

const host = "127.0.0.1";
const port = 4173;
const baseURL = `http://${host}:${port}`;
const projectPath = process.cwd();
const viteEntry = resolve(projectPath, "node_modules/vite/bin/vite.js");
const playwrightEntry = resolve(projectPath, "node_modules/@playwright/test/cli.js");
const playwrightConfig = resolve(projectPath, "playwright.config.ts");
const chromeLogDirectory = await mkdtemp(join(tmpdir(), "auto-clp-browser-"));
const chromeLogFile = join(chromeLogDirectory, "chrome-debug.log");

const server = spawn(
  process.execPath,
  [viteEntry, "--host", host, "--port", String(port), "--strictPort"],
  {
    cwd: projectPath,
    stdio: ["ignore", "pipe", "pipe"],
    windowsHide: true,
  },
);

server.stdout.pipe(process.stdout);
server.stderr.pipe(process.stderr);

let serverExitState;
const serverExited = once(server, "exit").then(([code, signal]) => {
  serverExitState = { code, signal };
});

async function waitForServer() {
  const deadline = Date.now() + 10_000;

  while (Date.now() < deadline) {
    if (serverExitState !== undefined) {
      throw new Error(
        `Vite exited before becoming ready (code=${serverExitState.code}, signal=${serverExitState.signal})`,
      );
    }

    try {
      const response = await fetch(baseURL, { signal: AbortSignal.timeout(1_000) });
      await response.arrayBuffer();
      if (response.ok) {
        return;
      }
    } catch {
      // The server may still be starting; retry until the bounded deadline.
    }

    await delay(100);
  }

  throw new Error(`Vite did not become ready at ${baseURL} within 10 seconds`);
}

async function runPlaywright() {
  const tests = spawn(
    process.execPath,
    [playwrightEntry, "test", "--config", playwrightConfig, ...process.argv.slice(2)],
    {
      cwd: chromeLogDirectory,
      env: { ...process.env, CHROME_LOG_FILE: chromeLogFile },
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

async function stopServer() {
  if (serverExitState !== undefined) {
    return;
  }

  server.kill("SIGTERM");
  const stopped = await Promise.race([
    serverExited.then(() => true),
    delay(3_000).then(() => false),
  ]);

  if (!stopped && serverExitState === undefined) {
    server.kill("SIGKILL");
    await serverExited;
  }
}

let exitCode = 1;

try {
  await waitForServer();
  exitCode = await runPlaywright();
} catch (error) {
  console.error(error instanceof Error ? error.message : String(error));
} finally {
  await stopServer();
  await rm(chromeLogDirectory, { recursive: true, force: true });
}

process.exitCode = exitCode;
