import { expect, test, type Page } from "@playwright/test";

async function addContainer(page: Page, name: string) {
  await page.getByRole("button", { name: "候補を追加" }).click();
  await page.getByLabel("候補名").fill(name);
  await page.getByLabel("内部長さ").fill("6000");
  await page.getByLabel("内部幅").fill("2400");
  await page.getByLabel("内部高さ").fill("2600");
  await page.getByLabel("開口幅").fill("2400");
  await page.getByLabel("開口高さ").fill("2500");
  await page.getByLabel("総耐荷重").fill("100000");
  await page.getByRole("button", { name: "候補を保存" }).click();
}

async function addCargo(page: Page, name: string) {
  await page.getByRole("button", { name: "積荷を追加" }).click();
  await page.getByLabel("積荷名").fill(name);
  await page.getByLabel("長さ", { exact: true }).fill("100");
  await page.getByLabel("幅", { exact: true }).fill("100");
  await page.getByLabel("高さ", { exact: true }).fill("100");
  await page.getByLabel("重量").fill("1");
  await page.getByRole("button", { name: "積荷を保存" }).click();
}

async function installControllableWorker(page: Page) {
  await page.addInitScript(() => {
    type WorkerRequest = {
      readonly type: "evaluate" | "reason-page";
      readonly generation: number;
      readonly requestId?: number;
      readonly status?: "invalid" | "unverified";
      readonly offset?: number;
      readonly containerId?: string;
      readonly project?: {
        readonly containers?: readonly { readonly name?: string }[];
      };
    };
    type FakeStats = {
      created: number;
      terminated: number;
      posts: WorkerRequest[];
      observedSummaries: string[];
    };
    const browserGlobal = globalThis as unknown as {
      Worker: unknown;
      __physicalWorkerStats: FakeStats;
    };
    const stats: FakeStats = {
      created: 0,
      terminated: 0,
      posts: [],
      observedSummaries: [],
    };
    browserGlobal.__physicalWorkerStats = stats;

    class ControllableWorker {
      onmessage: ((event: { readonly data: unknown }) => void) | null = null;
      onerror: (() => void) | null = null;
      onmessageerror: (() => void) | null = null;

      constructor() {
        stats.created += 1;
      }

      postMessage(request: WorkerRequest) {
        stats.posts.push(structuredClone(request));
        if (request.type === "evaluate") {
          const latest = request.containerId === "container-2";
          const send = (summary: unknown) => {
            this.onmessage?.({
              data: {
                type: "evaluation-ready",
                generation: request.generation,
                summary,
              },
            });
          };
          setTimeout(
            () => {
              send(
                latest
                  ? {
                      kind: "evaluated",
                      status: "invalid",
                      invalidCount: 36,
                      unverifiedCount: 0,
                      placementCount: 0,
                    }
                  : {
                      kind: "evaluated",
                      status: "valid",
                      invalidCount: 0,
                      unverifiedCount: 0,
                      placementCount: 0,
                    },
              );
            },
            latest ? 20 : 180,
          );
          if (!latest) {
            setTimeout(
              () =>
                send({
                  kind: "evaluated",
                  status: "invalid",
                  invalidCount: 1,
                  unverifiedCount: 0,
                  placementCount: 0,
                }),
              420,
            );
          }
          return;
        }

        const offset = request.offset ?? 0;
        const reasons = Array.from(
          { length: Math.min(25, 36 - offset) },
          (_, index) => ({
            status: "invalid",
            code: "outside-container",
            target: { kind: "cargo", id: `fake-${offset + index + 1}` },
            relatedCargoIds: [],
          }),
        );
        const response = {
          type: "reason-page-ready",
          generation: request.generation,
          requestId: request.requestId,
          status: "invalid",
          offset,
          total: 36,
          reasons,
        };
        const delay = offset === 0 ? 5 : 20;
        setTimeout(() => this.onmessage?.({ data: structuredClone(response) }), delay);
        if (offset === 25) {
          setTimeout(() => this.onmessage?.({ data: structuredClone(response) }), 100);
        }
      }

      terminate() {
        stats.terminated += 1;
      }
    }

    browserGlobal.Worker = ControllableWorker;
  });
}

test("masks old generations and ignores terminated workers and stale page requestIds", async ({
  page,
}) => {
  await installControllableWorker(page);
  await page.goto("/?forceWebgl2=unsupported");
  await addContainer(page, "遅い候補A");
  await addContainer(page, "最新候補B");

  await page.evaluate(() => {
    const browserGlobal = globalThis as unknown as {
      __physicalWorkerStats: { observedSummaries: string[] };
      document: {
        querySelector(selector: string): { textContent: string | null } | null;
      };
      MutationObserver: new (callback: () => void) => {
        observe(target: unknown, options: Record<string, boolean>): void;
      };
    };
    const summary = browserGlobal.document.querySelector(
      ".physical-validation__summary",
    );
    if (summary === null) {
      throw new Error("physical summary missing");
    }
    browserGlobal.__physicalWorkerStats.observedSummaries = [];
    new browserGlobal.MutationObserver(() => {
      browserGlobal.__physicalWorkerStats.observedSummaries.push(
        summary.textContent ?? "",
      );
    }).observe(summary, { childList: true, characterData: true, subtree: true });
  });

  await page.getByLabel("表示する候補").selectOption("container-2");
  const panel = page.locator(".physical-validation");
  await expect(panel.locator(".physical-validation__summary")).toHaveText(
    "判定中：保存済み配置の物理判定を計算しています。",
  );
  await expect(panel.locator(".physical-validation__summary")).toHaveText(
    "不適合：修正が必要な理由が36件あります。未確認事項0件も保持して表示します。",
  );
  const group = panel.getByRole("region", { name: "不適合理由" });
  await expect(group.getByText("1〜25 / 36件")).toBeVisible();

  await group.getByRole("button", { name: "次の不適合理由" }).click();
  await expect(group.getByText("26〜36 / 36件")).toBeVisible();
  await group.getByRole("button", { name: "前の不適合理由" }).click();
  await expect(group.getByText("1〜25 / 36件")).toBeVisible();
  await page.waitForTimeout(220);
  await expect(group.getByText("1〜25 / 36件")).toBeVisible();
  await expect(group.getByRole("listitem")).toHaveCount(25);

  const stats = await page.evaluate(() => {
    const browserGlobal = globalThis as unknown as {
      __physicalWorkerStats: {
        created: number;
        terminated: number;
        observedSummaries: string[];
      };
    };
    return structuredClone(browserGlobal.__physicalWorkerStats);
  });
  expect(stats.created).toBeGreaterThanOrEqual(3);
  expect(stats.terminated).toBeGreaterThanOrEqual(2);
  expect(stats.observedSummaries.some((summary) => summary.startsWith("適合："))).toBe(
    false,
  );
});

test("terminates the completed last-candidate worker, clears old reasons, and evaluates a re-added candidate from the new Project", async ({
  page,
}) => {
  await installControllableWorker(page);
  await page.goto("/?forceWebgl2=unsupported");
  await addContainer(page, "削除前候補");

  const panel = page.locator(".physical-validation");
  const summary = panel.locator(".physical-validation__summary");
  await expect(summary).toHaveText(
    "適合：この候補には配置済みの積荷がありません。",
  );
  const beforeDelete = await page.evaluate(() => {
    const browserGlobal = globalThis as unknown as {
      __physicalWorkerStats: { created: number; terminated: number };
    };
    return structuredClone(browserGlobal.__physicalWorkerStats);
  });

  await page.getByRole("button", { name: "削除: 削除前候補" }).click();
  await page.getByRole("button", { name: "削除を確定: 削除前候補" }).click();
  await expect(page.getByText("候補0件、配置0件。物理判定の対象はありません。")).toBeVisible();
  await expect(summary).toHaveText("判定対象なし：候補コンテナを追加してください。");
  await expect(panel.getByRole("region", { name: "不適合理由" })).toHaveCount(0);
  await expect(panel.getByRole("region", { name: "未確認理由" })).toHaveCount(0);
  await page.waitForTimeout(460);
  await expect(summary).toHaveText("判定対象なし：候補コンテナを追加してください。");
  await expect(panel.locator(".physical-validation__reason")).toHaveCount(0);

  const afterDelete = await page.evaluate(() => {
    const browserGlobal = globalThis as unknown as {
      __physicalWorkerStats: { created: number; terminated: number };
    };
    return structuredClone(browserGlobal.__physicalWorkerStats);
  });
  expect(afterDelete.terminated).toBeGreaterThan(beforeDelete.terminated);

  await addContainer(page, "再追加候補");
  await expect(summary).toHaveText(
    "判定中：保存済み配置の物理判定を計算しています。",
  );
  await expect(summary).toHaveText(
    "適合：この候補には配置済みの積荷がありません。",
  );
  const afterReAdd = await page.evaluate(() => {
    const browserGlobal = globalThis as unknown as {
      __physicalWorkerStats: {
        created: number;
        posts: readonly {
          type: string;
          containerId?: string;
          project?: { containers?: readonly { name?: string }[] };
        }[];
      };
    };
    return structuredClone(browserGlobal.__physicalWorkerStats);
  });
  expect(afterReAdd.created).toBeGreaterThan(beforeDelete.created);
  const latestEvaluation = [...afterReAdd.posts]
    .reverse()
    .find((request) => request.type === "evaluate");
  expect(latestEvaluation).toMatchObject({
    containerId: "container-1",
    project: { containers: [{ name: "再追加候補" }] },
  });
});

test("surfaces worker-failed as a retryable transport error without synchronous fallback", async ({
  page,
}) => {
  await page.addInitScript(() => {
    const browserGlobal = globalThis as unknown as {
      Worker: unknown;
      __failureWorkerStats: { created: number; terminated: number };
    };
    const stats = { created: 0, terminated: 0 };
    browserGlobal.__failureWorkerStats = stats;
    browserGlobal.Worker = class FailingWorker {
      onmessage: ((event: { readonly data: unknown }) => void) | null = null;
      onerror: (() => void) | null = null;
      onmessageerror: (() => void) | null = null;

      constructor() {
        stats.created += 1;
      }

      postMessage(request: { readonly generation: number }) {
        queueMicrotask(() => {
          this.onmessage?.({
            data: {
              type: "worker-failed",
              generation: request.generation,
              code: "engine-failure",
            },
          });
        });
      }

      terminate() {
        stats.terminated += 1;
      }
    };
  });
  await page.goto("/?forceWebgl2=unsupported");
  await addCargo(page, "失敗時積荷");
  await addContainer(page, "失敗候補");

  const panel = page.locator(".physical-validation");
  const summary = panel.locator(".physical-validation__summary");
  await expect(summary).toHaveText(
    "判定不能：物理判定の処理を開始または完了できませんでした。再試行してください。",
  );
  await expect(summary).not.toContainText("案件データの参照または意味整合性");
  const placementPanel = page.locator(".placement-panel");
  await placementPanel.getByRole("button", { name: "配置を追加: 失敗時積荷" }).click();
  await placementPanel.getByRole("button", { name: "配置を保存" }).click();
  await expect(placementPanel.locator(".action-status")).toHaveText(
    "新しい配置を保存し、物理判定の再計算を開始しました。",
  );
  await expect(summary).toHaveText(
    "判定不能：物理判定の処理を開始または完了できませんでした。再試行してください。",
  );
  const retry = panel.getByRole("button", { name: "物理判定を再試行" });
  await retry.click();
  await expect(summary).toHaveText(
    "判定不能：物理判定の処理を開始または完了できませんでした。再試行してください。",
  );
  await retry.click();
  await expect(summary).toHaveText(
    "判定不能：物理判定の処理を開始または完了できませんでした。再試行してください。",
  );

  const stats = await page.evaluate(() => {
    const browserGlobal = globalThis as unknown as {
      __failureWorkerStats: { created: number; terminated: number };
    };
    return browserGlobal.__failureWorkerStats;
  });
  expect(stats.created).toBeGreaterThanOrEqual(3);
  expect(stats.terminated).toBe(stats.created);
  await expect(panel.getByText("適合", { exact: true })).toHaveCount(0);
});

test("keeps all 1000-placement reasons in the real module Worker and yields the main thread", async ({
  page,
}) => {
  test.setTimeout(120_000);
  await page.goto("/?forceWebgl2=unsupported");

  const measurement = await page.evaluate(async () => {
    type WorkerResponse = {
      readonly type: string;
      readonly generation: number;
      readonly requestId?: number;
      readonly status?: string;
      readonly offset?: number;
      readonly total?: number;
      readonly reasons?: readonly unknown[];
      readonly summary?: {
        readonly kind: string;
        readonly status: string;
        readonly invalidCount: number;
        readonly unverifiedCount: number;
        readonly placementCount: number;
      };
    };
    const browserGlobal = globalThis as unknown as {
      Worker: new (
        url: string,
        options: { readonly type: "module" },
      ) => {
        onmessage: ((event: { readonly data: WorkerResponse }) => void) | null;
        onerror: (() => void) | null;
        postMessage(value: unknown): void;
        terminate(): void;
      };
      requestAnimationFrame(callback: () => void): number;
    };
    const worker = new browserGlobal.Worker("/src/workers/physical-validation.worker.ts", {
      type: "module",
    });
    const pending = new Map<number, (response: WorkerResponse) => void>();
    let evaluateResolve: ((response: WorkerResponse) => void) | undefined;
    worker.onmessage = (event) => {
      if (event.data.type === "evaluation-ready") {
        evaluateResolve?.(event.data);
        return;
      }
      const requestId = event.data.requestId;
      if (requestId !== undefined) {
        pending.get(requestId)?.(event.data);
        pending.delete(requestId);
      }
    };
    const startedAt = performance.now();
    let timerTicks = 0;
    let animationFrameTicks = 0;
    let stopped = false;
    const timer = setInterval(() => {
      timerTicks += 1;
    }, 0);
    const countFrame = () => {
      animationFrameTicks += 1;
      if (!stopped) {
        browserGlobal.requestAnimationFrame(countFrame);
      }
    };
    browserGlobal.requestAnimationFrame(countFrame);
    const cargoes = Array.from({ length: 1_000 }, (_, index) => ({
      id: `anonymous-cargo-${index + 1}`,
      name: `匿名積荷${index + 1}`,
      dimensionsMm: { lengthMm: 100, widthMm: 100, heightMm: 100 },
      massGrams: 1,
      canSupportCargo: false,
      allowedOrientations: ["LWH"],
    }));
    const project = {
      schemaVersion: "0.1.0",
      projectId: "anonymous-worker-worst",
      name: "匿名worker最悪ケース",
      clearancesMm: { xMm: 0, yMm: 0, zMm: 0 },
      cargoes,
      containers: [
        {
          id: "container-1",
          name: "匿名候補",
          internalDimensionsMm: {
            lengthMm: 10_000,
            widthMm: 10_000,
            heightMm: 1_000,
          },
          openingMm: { widthMm: 10_000, heightMm: 1_000 },
          payloadCapacityGrams: 1_000_000,
        },
      ],
      placements: cargoes.map((cargo) => ({
        cargoId: cargo.id,
        containerId: "container-1",
        positionMm: { xMm: 0, yMm: 0, zMm: 0 },
        orientation: "LWH",
      })),
    };
    const initial = await new Promise<WorkerResponse>((resolve, reject) => {
      evaluateResolve = resolve;
      worker.onerror = () => reject(new Error("real worker failed"));
      worker.postMessage({
        type: "evaluate",
        generation: 1,
        project,
        containerId: "container-1",
      });
    });
    const elapsedMs = performance.now() - startedAt;
    stopped = true;
    clearInterval(timer);

    let requestId = 0;
    const requestPage = (
      status: "invalid" | "unverified",
      offset: number,
    ): Promise<WorkerResponse> =>
      new Promise((resolve) => {
        requestId += 1;
        pending.set(requestId, resolve);
        worker.postMessage({
          type: "reason-page",
          generation: 1,
          requestId,
          status,
          offset,
          limit: 25,
        });
      });
    const pages = await Promise.all([
      requestPage("invalid", 0),
      requestPage("invalid", 249_750),
      requestPage("invalid", 499_475),
      requestPage("unverified", 0),
      requestPage("unverified", 975),
    ]);
    worker.terminate();
    return {
      elapsedMs,
      timerTicks,
      animationFrameTicks,
      initial,
      pages: pages.map((response) => ({
        status: response.status,
        offset: response.offset,
        total: response.total,
        count: response.reasons?.length,
      })),
    };
  });

  expect(measurement.initial).toEqual({
    type: "evaluation-ready",
    generation: 1,
    summary: {
      kind: "evaluated",
      status: "invalid",
      invalidCount: 499_500,
      unverifiedCount: 1_000,
      placementCount: 1_000,
    },
  });
  expect(measurement.initial).not.toHaveProperty("reasons");
  expect(measurement.pages).toEqual([
    { status: "invalid", offset: 0, total: 499_500, count: 25 },
    { status: "invalid", offset: 249_750, total: 499_500, count: 25 },
    { status: "invalid", offset: 499_475, total: 499_500, count: 25 },
    { status: "unverified", offset: 0, total: 1_000, count: 25 },
    { status: "unverified", offset: 975, total: 1_000, count: 25 },
  ]);
  expect(
    measurement.timerTicks > 0 ||
      measurement.animationFrameTicks > 0 ||
      measurement.elapsedMs < 100,
  ).toBe(true);
  test.info().annotations.push({
    type: "worker elapsed",
    description: `${measurement.elapsedMs.toFixed(1)} ms; timer ${measurement.timerTicks}; rAF ${measurement.animationFrameTicks}`,
  });
});
