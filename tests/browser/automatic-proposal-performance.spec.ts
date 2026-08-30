import { execFileSync } from "node:child_process";
import { createRequire } from "node:module";
import os from "node:os";
import process from "node:process";
import { fileURLToPath } from "node:url";

import { expect, test, type Page } from "@playwright/test";

const runtimeBaseUrlEnvironmentVariable = "AUTO_CLP_BROWSER_BASE_URL";
const baseUrl = process.env[runtimeBaseUrlEnvironmentVariable];
if (baseUrl === undefined || baseUrl.length === 0) {
  throw new Error(
    `${runtimeBaseUrlEnvironmentVariable} is required; run this test through the package test:browser script`,
  );
}
const proposalWorkerFragment = "automatic-proposal.worker";
const expectedAttemptCount = 210;

const ap08Project = {
  schemaVersion: "0.1.0",
  projectId: "ap08",
  name: "匿名AP08性能案件",
  clearancesMm: { xMm: 0, yMm: 0, zMm: 0 },
  cargoes: Array.from({ length: 20 }, (_, index) => ({
    id: `cargo-${String(index + 1).padStart(3, "0")}`,
    name: `匿名積荷${String(index + 1).padStart(2, "0")}`,
    dimensionsMm: { lengthMm: 200, widthMm: 200, heightMm: 200 },
    massGrams: 1_000,
    canSupportCargo: false,
    allowedOrientations: ["LWH"],
  })),
  containers: [
    {
      id: "container-ap08",
      name: "匿名AP08候補",
      internalDimensionsMm: {
        lengthMm: 1_000,
        widthMm: 800,
        heightMm: 1_000,
      },
      openingMm: { widthMm: 800, heightMm: 1_000 },
      payloadCapacityGrams: 20_000,
    },
  ],
  placements: [],
} as const;

interface BrowserRun {
  readonly label: string;
  readonly iteration: number;
  readonly timeOriginMs: number;
  readonly startedAtMs: number;
  readonly endedAtMs: number;
  readonly elapsedMs: number;
  readonly timerCount: number;
  readonly rafCount: number;
  readonly timerMaxGapMs: number;
  readonly rafMaxGapMs: number;
  readonly observability: "observable" | "too-fast-to-observe";
  readonly observabilityThresholdMs: number;
  readonly resultHashSha256?: string;
  readonly response?: unknown;
  readonly error?: string;
}

interface CancellationEvidence {
  readonly error?: string;
  readonly workerConstructCount: number;
  readonly postMessageCount: number;
  readonly responseSeenCount: number;
  readonly responseSeenBeforeCancel: boolean;
  readonly responseSeenAfterCancel: number;
  readonly terminateCount: number;
  readonly cancelRequestedAtMs?: number;
  readonly terminatedAtMs?: number;
  readonly terminateLatencyMs?: number;
  readonly cancelledObservedAtMs?: number;
  readonly cancelledUiLatencyMs?: number;
  readonly phase: string | null;
  readonly ariaBusy: string | null;
  readonly lateReady: boolean;
  readonly lateResponse: boolean;
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function assertReadyCompleteResponse(response: unknown, requestId: number) {
  expect(isRecord(response)).toBe(true);
  if (!isRecord(response)) {
    throw new Error("response must be an object");
  }
  expect(Object.keys(response).sort()).toEqual(["requestId", "result", "type"]);
  expect(response.type).toBe("automatic-proposal.ready");
  expect(response.requestId).toBe(requestId);
  expect(isRecord(response.result)).toBe(true);
  if (!isRecord(response.result)) {
    throw new Error("ready response result must be an object");
  }

  const result = response.result;
  expect(result.algorithmVersion).toBe("automatic-proposal-v1");
  expect(result.status).toBe("complete");
  expect(Object.prototype.hasOwnProperty.call(result, "cutoffSource")).toBe(false);
  expect(result.effectiveLimits).toEqual({
    candidateAttemptLimit: 10_000,
    requestAttemptLimit: 1_000_000,
    candidatePointLimit: 2_048,
  });
  expect(isRecord(result.attempts)).toBe(true);
  expect(isRecord(result.plan)).toBe(true);
  if (!isRecord(result.attempts) || !isRecord(result.plan)) {
    throw new Error("complete result must contain attempts and plan");
  }

  expect(result.attempts.requestAttemptCount).toBe(expectedAttemptCount);
  expect(result.attempts.candidates).toEqual([
    {
      containerId: "container-ap08",
      attemptCount: expectedAttemptCount,
      outcome: "complete",
    },
  ]);
  expect(result.plan.containerId).toBe("container-ap08");
  expect(result.plan.invalidReasonCount).toBe(0);
  expect(Array.isArray(result.plan.placements)).toBe(true);
  expect(Array.isArray(result.plan.unverifiedReasons)).toBe(true);
  if (
    !Array.isArray(result.plan.placements) ||
    !Array.isArray(result.plan.unverifiedReasons)
  ) {
    throw new Error("complete plan arrays are missing");
  }

  expect(result.plan.placements).toHaveLength(20);
  expect(
    result.plan.placements.map((placement) =>
      isRecord(placement) ? placement.cargoId : undefined,
    ),
  ).toEqual(ap08Project.cargoes.map(({ id }) => id));
  expect(
    result.plan.placements.every(
      (placement) =>
        isRecord(placement) &&
        placement.containerId === "container-ap08" &&
        placement.orientation === "LWH" &&
        isRecord(placement.positionMm),
    ),
  ).toBe(true);
  expect(result.plan.unverifiedReasons).toEqual([]);
}

async function importProject(page: Page) {
  await page.locator("input[type='file']").setInputFiles({
    name: "anonymous-ap08.json",
    mimeType: "application/json",
    buffer: Buffer.from(JSON.stringify(ap08Project)),
  });
  await expect(page.getByTestId("canonical-project-settings")).toContainText(
    ap08Project.name,
  );
}

async function installNativeProposalWorkerProbe(page: Page) {
  await page.addInitScript((workerFragment) => {
    interface WorkerLike {
      postMessage(message: unknown): void;
      terminate(): void;
      addEventListener(type: string, listener: () => void): void;
    }
    interface ElementLike {
      readonly textContent: string | null;
      getAttribute(name: string): string | null;
      click(): void;
    }
    interface DocumentLike {
      querySelector(selector: string): ElementLike | null;
      querySelectorAll(selector: string): readonly ElementLike[];
    }
    interface ObserverLike {
      observe(target: ElementLike, options: object): void;
      disconnect(): void;
    }
    interface ProbeState {
      workerConstructCount: number;
      postMessageCount: number;
      responseSeenCount: number;
      responseSeenBeforeCancel: boolean;
      responseSeenAfterCancel: number;
      terminateCount: number;
      cancelRequestedAtMs?: number;
      terminatedAtMs?: number;
      terminateLatencyMs?: number;
      cancelledObservedAtMs?: number;
      cancelledUiLatencyMs?: number;
      lateReady: boolean;
      lateResponse: boolean;
    }
    interface ProbeGlobal {
      Worker: new (...args: readonly unknown[]) => WorkerLike;
      MutationObserver: new (callback: () => void) => ObserverLike;
      document: DocumentLike;
      performance: { now(): number };
      setTimeout(callback: () => void, milliseconds: number): number;
      clearTimeout(handle: number): void;
      __ap08Probe: ProbeState;
      __ap08CancelAtFirstRunning(): Promise<object>;
    }

    const browserGlobal = globalThis as unknown as ProbeGlobal;
    const NativeWorker = browserGlobal.Worker;
    const probe: ProbeState = {
      workerConstructCount: 0,
      postMessageCount: 0,
      responseSeenCount: 0,
      responseSeenBeforeCancel: false,
      responseSeenAfterCancel: 0,
      terminateCount: 0,
      lateReady: false,
      lateResponse: false,
    };
    browserGlobal.__ap08Probe = probe;

    browserGlobal.Worker = new Proxy(NativeWorker, {
      construct(target, argumentsList) {
        const worker = Reflect.construct(target, argumentsList) as WorkerLike;
        if (!String(argumentsList[0]).includes(workerFragment)) {
          return worker;
        }

        probe.workerConstructCount += 1;
        const nativePostMessage = worker.postMessage.bind(worker);
        const nativeTerminate = worker.terminate.bind(worker);
        Object.defineProperty(worker, "postMessage", {
          configurable: true,
          value(message: unknown) {
            probe.postMessageCount += 1;
            nativePostMessage(message);
          },
        });
        Object.defineProperty(worker, "terminate", {
          configurable: true,
          value() {
            probe.terminateCount += 1;
            probe.terminatedAtMs = browserGlobal.performance.now();
            if (probe.cancelRequestedAtMs !== undefined) {
              probe.terminateLatencyMs =
                probe.terminatedAtMs - probe.cancelRequestedAtMs;
            }
            nativeTerminate();
          },
        });
        worker.addEventListener("message", () => {
          probe.responseSeenCount += 1;
          if (probe.cancelRequestedAtMs === undefined) {
            probe.responseSeenBeforeCancel = true;
          } else {
            probe.responseSeenAfterCancel += 1;
            probe.lateResponse = true;
          }
        });
        return worker;
      },
    });

    browserGlobal.__ap08CancelAtFirstRunning = () =>
      new Promise((resolve) => {
        const panel = browserGlobal.document.querySelector(".automatic-proposal");
        const startButton = [...browserGlobal.document.querySelectorAll("button")].find(
          (button) => button.textContent?.trim() === "自動提案を開始",
        );
        if (panel === null || startButton === undefined) {
          resolve({ ...probe, error: "proposal panel or start button missing" });
          return;
        }
        const activePanel = panel;

        let cancelClicked = false;
        let settled = false;
        let lateWindowStarted = false;
        const observer = new browserGlobal.MutationObserver(check);
        const failureGuard = browserGlobal.setTimeout(() => {
          finish("cancel observation timeout");
        }, 6_000);

        function finish(error?: string) {
          if (settled) {
            return;
          }
          settled = true;
          observer.disconnect();
          browserGlobal.clearTimeout(failureGuard);
          resolve({
            ...probe,
            ...(error === undefined ? {} : { error }),
            phase: activePanel.getAttribute("data-automatic-proposal-phase"),
            ariaBusy: activePanel.getAttribute("aria-busy"),
          });
        }

        function check() {
          if (settled) {
            return;
          }
          const phase = activePanel.getAttribute("data-automatic-proposal-phase");
          if (!cancelClicked && probe.responseSeenBeforeCancel) {
            finish("native Worker completed before cancellation was requested");
            return;
          }
          if (!cancelClicked && phase === "running" && probe.postMessageCount === 1) {
            const cancelButton = [
              ...browserGlobal.document.querySelectorAll(
                ".automatic-proposal__actions button",
              ),
            ].find((button) => button.textContent?.trim() === "探索を中止");
            if (cancelButton === undefined) {
              finish("running phase had no cancellation button");
              return;
            }
            cancelClicked = true;
            probe.cancelRequestedAtMs = browserGlobal.performance.now();
            cancelButton.click();
          }
          if (cancelClicked && phase === "ready") {
            probe.lateReady = true;
          }
          if (
            cancelClicked &&
            phase === "cancelled" &&
            activePanel.getAttribute("aria-busy") === "false" &&
            !lateWindowStarted
          ) {
            lateWindowStarted = true;
            probe.cancelledObservedAtMs = browserGlobal.performance.now();
            probe.cancelledUiLatencyMs =
              probe.cancelledObservedAtMs -
              (probe.cancelRequestedAtMs as number);
            browserGlobal.setTimeout(() => {
              const finalPhase = activePanel.getAttribute(
                "data-automatic-proposal-phase",
              );
              if (finalPhase === "ready") {
                probe.lateReady = true;
              }
              if (probe.responseSeenAfterCancel > 0) {
                probe.lateResponse = true;
              }
              finish();
            }, 250);
          }
        }

        observer.observe(activePanel, {
          attributes: true,
          childList: true,
          subtree: true,
        });
        startButton.click();
        check();
      });
  }, proposalWorkerFragment);
}

test.describe.configure({ mode: "serial", retries: 0 });

test("records the AP-08 native Worker gate and cancellation evidence", async ({
  browser,
}, testInfo) => {
  testInfo.setTimeout(120_000);
  const directConsole: string[] = [];
  const uiConsole: string[] = [];
  const directContext = await browser.newContext();
  const directPage = await directContext.newPage();
  directPage.on("console", (message) => {
    if (message.type() === "warning" || message.type() === "error") {
      directConsole.push(`${message.type()}: ${message.text()}`);
    }
  });
  directPage.on("pageerror", (error) => directConsole.push(`pageerror: ${error.message}`));
  await directPage.goto(`${baseUrl}/?forceWebgl2=unsupported`);

  const runtime = await directPage.evaluate(async () => {
    interface BatteryLike {
      readonly charging: boolean;
      readonly level: number;
    }
    interface CanvasLike {
      getContext(name: string): unknown;
    }
    interface BrowserGlobal {
      readonly navigator: {
        readonly userAgent: string;
        readonly hardwareConcurrency: number;
        readonly deviceMemory?: number;
        getBattery?: () => Promise<BatteryLike>;
      };
      readonly devicePixelRatio: number;
      readonly document: { createElement(name: string): CanvasLike };
    }
    const browserGlobal = globalThis as unknown as BrowserGlobal;
    let battery: {
      available: boolean;
      charging?: boolean;
      level?: number;
      reason?: string;
    } = { available: false };
    if (browserGlobal.navigator.getBattery !== undefined) {
      try {
        const value = await browserGlobal.navigator.getBattery();
        battery = {
          available: true,
          charging: value.charging,
          level: value.level,
        };
      } catch {
        battery = { available: false, reason: "battery-query-failed" };
      }
    }
    const canvas = browserGlobal.document.createElement("canvas");
    return {
      userAgent: browserGlobal.navigator.userAgent,
      hardwareConcurrency: browserGlobal.navigator.hardwareConcurrency,
      deviceMemoryGiB: browserGlobal.navigator.deviceMemory ?? null,
      devicePixelRatio: browserGlobal.devicePixelRatio,
      nativeWebgl2: canvas.getContext("webgl2") !== null,
      battery,
    };
  });

  const direct = await directPage.evaluate(async (project) => {
    interface WorkerLike {
      onmessage: ((event: { readonly data: unknown }) => void) | null;
      onerror: ((event: { readonly message?: string }) => void) | null;
      postMessage(message: unknown): void;
      terminate(): void;
    }
    interface BrowserGlobal {
      Worker: new (url: string, options: { readonly type: "module" }) => WorkerLike;
      readonly performance: { readonly timeOrigin: number; now(): number };
      readonly crypto: {
        readonly subtle: {
          digest(algorithm: string, value: Uint8Array): Promise<ArrayBuffer>;
        };
      };
      TextEncoder: new () => { encode(value: string): Uint8Array };
      requestAnimationFrame(callback: (timestamp: number) => void): number;
      cancelAnimationFrame(handle: number): void;
      setTimeout(callback: () => void, milliseconds: number): number;
      clearTimeout(handle: number): void;
    }
    const browserGlobal = globalThis as unknown as BrowserGlobal;

    const timerBasisStarted = browserGlobal.performance.now();
    await new Promise<void>((resolve) => {
      browserGlobal.setTimeout(resolve, 0);
    });
    const timerBasisMs = browserGlobal.performance.now() - timerBasisStarted;
    const rafBasisStarted = browserGlobal.performance.now();
    await new Promise<void>((resolve) => {
      browserGlobal.requestAnimationFrame(() => resolve());
    });
    const rafBasisMs = browserGlobal.performance.now() - rafBasisStarted;
    const observabilityThresholdMs = Math.max(timerBasisMs, rafBasisMs);

    const canonicalJson = (value: unknown): string => {
      if (value === null || typeof value !== "object") {
        return JSON.stringify(value);
      }
      if (Array.isArray(value)) {
        return `[${value.map(canonicalJson).join(",")}]`;
      }
      const record = value as Record<string, unknown>;
      return `{${Object.keys(record)
        .sort()
        .map((key) => `${JSON.stringify(key)}:${canonicalJson(record[key])}`)
        .join(",")}}`;
    };
    const sha256 = async (value: unknown) => {
      const encoded = new browserGlobal.TextEncoder().encode(canonicalJson(value));
      const digest = await browserGlobal.crypto.subtle.digest("SHA-256", encoded);
      return [...new Uint8Array(digest)]
        .map((byte) => byte.toString(16).padStart(2, "0"))
        .join("");
    };

    const runOnce = async (iteration: number) => {
      const label = iteration === 1 ? "cold-1" : `warm-${iteration - 1}`;
      const startedAtMs = browserGlobal.performance.now();
      let timerCount = 0;
      let rafCount = 0;
      let timerMaxGapMs = 0;
      let rafMaxGapMs = 0;
      let lastTimerAtMs = startedAtMs;
      let lastRafAtMs = startedAtMs;
      let active = true;
      const timerTick = () => {
        if (!active) {
          return;
        }
        const now = browserGlobal.performance.now();
        timerCount += 1;
        timerMaxGapMs = Math.max(timerMaxGapMs, now - lastTimerAtMs);
        lastTimerAtMs = now;
        browserGlobal.setTimeout(timerTick, 0);
      };
      const rafTick = (now: number) => {
        if (!active) {
          return;
        }
        rafCount += 1;
        rafMaxGapMs = Math.max(rafMaxGapMs, now - lastRafAtMs);
        lastRafAtMs = now;
        browserGlobal.requestAnimationFrame(rafTick);
      };
      const timerHandle = browserGlobal.setTimeout(timerTick, 0);
      const rafHandle = browserGlobal.requestAnimationFrame(rafTick);

      let worker: WorkerLike | undefined;
      let response: unknown;
      let error: string | undefined;
      try {
        response = await new Promise<unknown>((resolve, reject) => {
          worker = new browserGlobal.Worker(
            "/src/workers/automatic-proposal.worker.ts",
            { type: "module" },
          );
          const timeout = browserGlobal.setTimeout(() => {
            reject(new Error("hard timeout after 6000ms"));
          }, 6_000);
          worker.onmessage = (event) => {
            browserGlobal.clearTimeout(timeout);
            resolve(event.data);
          };
          worker.onerror = (event) => {
            browserGlobal.clearTimeout(timeout);
            reject(new Error(event.message ?? "native Worker error"));
          };
          worker.postMessage({
            type: "automatic-proposal.generate",
            requestId: iteration,
            project,
          });
        });
      } catch (caught) {
        error = caught instanceof Error ? caught.message : "unknown Worker failure";
      } finally {
        active = false;
        browserGlobal.clearTimeout(timerHandle);
        browserGlobal.cancelAnimationFrame(rafHandle);
        worker?.terminate();
      }
      const endedAtMs = browserGlobal.performance.now();
      const elapsedMs = endedAtMs - startedAtMs;
      return {
        label,
        iteration,
        timeOriginMs: browserGlobal.performance.timeOrigin,
        startedAtMs,
        endedAtMs,
        elapsedMs,
        timerCount,
        rafCount,
        timerMaxGapMs,
        rafMaxGapMs,
        observability:
          elapsedMs >= observabilityThresholdMs
            ? ("observable" as const)
            : ("too-fast-to-observe" as const),
        observabilityThresholdMs,
        ...(response === undefined
          ? {}
          : {
              response,
              resultHashSha256: await sha256(
                typeof response === "object" &&
                  response !== null &&
                  !Array.isArray(response) &&
                  "result" in response
                  ? (response as Record<string, unknown>).result
                  : response,
              ),
            }),
        ...(error === undefined ? {} : { error }),
      };
    };

    const runs = [];
    for (let iteration = 1; iteration <= 4; iteration += 1) {
      runs.push(await runOnce(iteration));
    }
    return { timerBasisMs, rafBasisMs, observabilityThresholdMs, runs };
  }, ap08Project);

  await directContext.close();

  const uiContext = await browser.newContext();
  const uiPage = await uiContext.newPage();
  uiPage.on("console", (message) => {
    if (message.type() === "warning" || message.type() === "error") {
      uiConsole.push(`${message.type()}: ${message.text()}`);
    }
  });
  uiPage.on("pageerror", (error) => uiConsole.push(`pageerror: ${error.message}`));
  await installNativeProposalWorkerProbe(uiPage);
  await uiPage.goto(`${baseUrl}/?forceWebgl2=unsupported`);
  await expect(
    uiPage.getByRole("heading", { name: "3D表示を利用できません" }),
  ).toBeVisible();
  await importProject(uiPage);
  const cancellation = (await uiPage.evaluate(() => {
    const browserGlobal = globalThis as unknown as {
      __ap08CancelAtFirstRunning(): Promise<object>;
    };
    return browserGlobal.__ap08CancelAtFirstRunning();
  })) as CancellationEvidence;
  await uiContext.close();

  const require = createRequire(import.meta.url);
  const playwrightVersion = (
    require("@playwright/test/package.json") as { readonly version: string }
  ).version;
  const repositoryRoot = fileURLToPath(new URL("../..", import.meta.url));
  const commitSha = execFileSync(
    "git",
    [
      "-c",
      `safe.directory=${repositoryRoot.replaceAll("\\", "/")}`,
      "rev-parse",
      "HEAD",
    ],
    { cwd: repositoryRoot, encoding: "utf8" },
  ).trim();

  const summarizedRuns = (direct.runs as readonly BrowserRun[]).map((run) => {
    let resultSummary: object = {};
    if (isRecord(run.response) && isRecord(run.response.result)) {
      const result = run.response.result;
      const attempts = isRecord(result.attempts) ? result.attempts : {};
      const plan = isRecord(result.plan) ? result.plan : {};
      resultSummary = {
        status: result.status,
        algorithmVersion: result.algorithmVersion,
        selectedContainerId: plan.containerId ?? null,
        candidateAttemptCount:
          Array.isArray(attempts.candidates) && isRecord(attempts.candidates[0])
            ? attempts.candidates[0].attemptCount
            : null,
        requestAttemptCount: attempts.requestAttemptCount ?? null,
        placementCount: Array.isArray(plan.placements) ? plan.placements.length : 0,
        invalidReasonCount: plan.invalidReasonCount ?? null,
        unverifiedCount: Array.isArray(plan.unverifiedReasons)
          ? plan.unverifiedReasons.length
          : 0,
        cutoffSource: result.cutoffSource ?? null,
      };
    }
    const { response, ...withoutResponse } = run;
    void response;
    return { ...withoutResponse, result: resultSummary };
  });

  const hashes = summarizedRuns.map(({ resultHashSha256 }) => resultHashSha256);
  const directPass = (direct.runs as readonly BrowserRun[]).every(
    (run) =>
      run.error === undefined &&
      run.elapsedMs <= 5_000 &&
      (run.observability === "too-fast-to-observe" ||
        (run.timerCount > 0 && run.rafCount > 0)),
  );
  const cancellationPass =
    cancellation.error === undefined &&
    cancellation.postMessageCount === 1 &&
    cancellation.responseSeenCount === 0 &&
    cancellation.terminateCount === 1 &&
    cancellation.terminateLatencyMs !== undefined &&
    cancellation.terminateLatencyMs >= 0 &&
    cancellation.terminateLatencyMs <= 250 &&
    cancellation.cancelledUiLatencyMs !== undefined &&
    cancellation.cancelledUiLatencyMs >= 0 &&
    cancellation.cancelledUiLatencyMs <= 250 &&
    cancellation.phase === "cancelled" &&
    cancellation.ariaBusy === "false" &&
    !cancellation.lateReady &&
    !cancellation.lateResponse;
  const evidence = {
    checkpoint: "CP-AUTO-PROPOSAL-AP08-TEST-001",
    commitSha,
    schemaVersion: ap08Project.schemaVersion,
    algorithmVersion: "automatic-proposal-v1",
    environment: {
      nodeVersion: process.version,
      playwrightVersion,
      browserName: "chromium",
      browserVersion: browser.version(),
      userAgent: runtime.userAgent,
      headless: true,
      os: { platform: process.platform, release: os.release(), arch: os.arch() },
      cpu: os.cpus()[0]?.model ?? "unavailable",
      logicalProcessors: os.cpus().length,
      totalMemoryBytes: os.totalmem(),
      browserHardwareConcurrency: runtime.hardwareConcurrency,
      browserDeviceMemoryGiB: runtime.deviceMemoryGiB,
      viewport: { width: 1280, height: 720 },
      devicePixelRatio: runtime.devicePixelRatio,
      webgl: { forced: "unsupported", nativeWebgl2: runtime.nativeWebgl2 },
      power: runtime.battery,
    },
    fixture: {
      projectId: ap08Project.projectId,
      cargoCount: ap08Project.cargoes.length,
      containerCount: ap08Project.containers.length,
      placementCount: 0,
      cargoDimensionsMm: { lengthMm: 200, widthMm: 200, heightMm: 200 },
      cargoMassGrams: 1_000,
      orientation: "LWH",
      canSupportCargo: false,
      containerId: "container-ap08",
      internalDimensionsMm: {
        lengthMm: 1_000,
        widthMm: 800,
        heightMm: 1_000,
      },
      openingMm: { widthMm: 800, heightMm: 1_000 },
      payloadCapacityGrams: 20_000,
      clearancesMm: { xMm: 0, yMm: 0, zMm: 0 },
    },
    observabilityBasis: {
      timerBasisMs: direct.timerBasisMs,
      rafBasisMs: direct.rafBasisMs,
      thresholdMs: direct.observabilityThresholdMs,
    },
    runs: summarizedRuns,
    cancellation,
    console: {
      warningOrErrorCount: directConsole.length + uiConsole.length,
      direct: directConsole,
      ui: uiConsole,
    },
    pass:
      directPass &&
      new Set(hashes).size === 1 &&
      cancellationPass &&
      directConsole.length === 0 &&
      uiConsole.length === 0,
    notes: [
      "5秒/250msはこの記録環境の受入gateであり一般端末SLAではない。",
      runtime.battery.available === true
        ? "browser battery API available"
        : "power state unavailable from browser battery API",
      "maximum timer/rAF gaps are observations, not SLA thresholds",
    ],
  };

  const compactEvidence = JSON.stringify(evidence);
  await testInfo.attach("ap08-performance.json", {
    body: Buffer.from(JSON.stringify(evidence, null, 2)),
    contentType: "application/json",
  });
  process.stdout.write(`AP08_EVIDENCE_JSON=${compactEvidence}\n`);

  expect(commitSha).toMatch(/^[0-9a-f]{40}$/);
  expect(direct.runs).toHaveLength(4);
  for (const [index, run] of (direct.runs as readonly BrowserRun[]).entries()) {
    expect(run.error, `${run.label} Worker error`).toBeUndefined();
    expect(run.elapsedMs, `${run.label} elapsed`).toBeLessThanOrEqual(5_000);
    assertReadyCompleteResponse(run.response, index + 1);
    if (run.observability === "observable") {
      expect(run.timerCount, `${run.label} timer progress`).toBeGreaterThan(0);
      expect(run.rafCount, `${run.label} rAF progress`).toBeGreaterThan(0);
    }
  }
  expect(new Set(hashes).size, "all four canonical response hashes").toBe(1);
  expect(directConsole).toEqual([]);
  expect(uiConsole).toEqual([]);
  expect(cancellation.error).toBeUndefined();
  expect(cancellation.workerConstructCount).toBe(1);
  expect(cancellation.postMessageCount).toBe(1);
  expect(cancellation.responseSeenBeforeCancel).toBe(false);
  expect(cancellation.responseSeenCount).toBe(0);
  expect(cancellation.terminateCount).toBe(1);
  expect(cancellation.terminateLatencyMs).toBeGreaterThanOrEqual(0);
  expect(cancellation.terminateLatencyMs).toBeLessThanOrEqual(250);
  expect(cancellation.cancelledUiLatencyMs).toBeGreaterThanOrEqual(0);
  expect(cancellation.cancelledUiLatencyMs).toBeLessThanOrEqual(250);
  expect(cancellation.phase).toBe("cancelled");
  expect(cancellation.ariaBusy).toBe("false");
  expect(cancellation.lateReady).toBe(false);
  expect(cancellation.lateResponse).toBe(false);
  expect(evidence.pass).toBe(true);
});
