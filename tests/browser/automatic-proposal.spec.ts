import { expect, test, type Page } from "@playwright/test";

const proposalWorkerFragment = "automatic-proposal.worker";

function projectJson(
  name: string,
  cargoCount: number,
  containerCount: number,
) {
  return {
    schemaVersion: "0.1.0",
    projectId: "proposal-browser",
    name,
    clearancesMm: { xMm: 0, yMm: 0, zMm: 0 },
    cargoes: Array.from({ length: cargoCount }, (_, index) => ({
      id: `cargo-${index + 1}`,
      name: index === 0 ? `匿名積荷${"長".repeat(48)}` : `匿名積荷${index + 1}`,
      dimensionsMm: { lengthMm: 10, widthMm: 10, heightMm: 10 },
      massGrams: 1,
      canSupportCargo: false,
      allowedOrientations: ["LWH"],
    })),
    containers: Array.from({ length: containerCount }, (_, index) => ({
      id: `container-${index + 1}`,
      name: index === 0 ? `匿名候補${"長".repeat(48)}` : `匿名候補${index + 1}`,
      internalDimensionsMm: {
        lengthMm: Math.max(100, cargoCount * 10),
        widthMm: 100,
        heightMm: 100,
      },
      openingMm: { widthMm: 100, heightMm: 100 },
      payloadCapacityGrams: 1_000,
    })),
    placements: [],
  };
}

async function importJson(page: Page, value: unknown) {
  await page.locator("input[type='file']").setInputFiles({
    name: "anonymous-project.json",
    mimeType: "application/json",
    buffer: Buffer.from(JSON.stringify(value)),
  });
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

async function addContainer(page: Page, name: string) {
  await page.getByRole("button", { name: "候補を追加" }).click();
  await page.getByLabel("候補名").fill(name);
  await page.getByLabel("内部長さ").fill("200");
  await page.getByLabel("内部幅").fill("100");
  await page.getByLabel("内部高さ").fill("100");
  await page.getByLabel("開口幅").fill("100");
  await page.getByLabel("開口高さ").fill("100");
  await page.getByLabel("総耐荷重").fill("1000");
  await page.getByRole("button", { name: "候補を保存" }).click();
}

async function expectNoHorizontalOverflow(page: Page) {
  expect(
    await page.evaluate(() => {
      const browserGlobal = globalThis as unknown as {
        readonly document: {
          readonly documentElement: {
            readonly clientWidth: number;
            readonly scrollWidth: number;
          };
        };
      };
      const root = browserGlobal.document.documentElement;
      return root.scrollWidth > root.clientWidth;
    }),
  ).toBe(false);
}

async function installControlledProposalWorker(page: Page) {
  await page.addInitScript((workerFragment) => {
    interface ProposalRequest {
      readonly requestId: number;
      readonly project: {
        readonly cargoes: readonly {
          readonly id: string;
          readonly allowedOrientations: readonly string[];
        }[];
        readonly containers: readonly { readonly id: string }[];
      };
    }
    interface PendingWorker {
      readonly request: ProposalRequest;
      readonly deliver: (data: unknown) => void;
    }
    interface ControlledGlobal {
      Worker: unknown;
      __proposalPendingCount: () => number;
      __releaseProposal: (index?: number) => void;
      __proposalTerminatedCount: () => number;
      __cancelProposalFromBrowser: () => void;
      __proposalCancelLatencyMs: () => number | undefined;
    }

    const browserGlobal = globalThis as unknown as ControlledGlobal;
    const NativeWorker = browserGlobal.Worker as new (
      ...argumentsList: readonly unknown[]
    ) => object;
    const pending: PendingWorker[] = [];
    let terminatedCount = 0;
    let cancelRequestedAt: number | undefined;
    let cancelLatencyMs: number | undefined;

    const resultFor = (request: ProposalRequest) => {
      const base = {
        algorithmVersion: "automatic-proposal-v1",
        effectiveLimits: {
          candidateAttemptLimit: 10_000,
          requestAttemptLimit: 1_000_000,
          candidatePointLimit: 2_048,
        },
      };
      if (request.project.cargoes.length === 0) {
        return {
          ...base,
          attempts: { requestAttemptCount: 0, candidates: [] },
          status: "no-cargo",
        };
      }
      if (request.project.containers.length === 0) {
        return {
          ...base,
          attempts: { requestAttemptCount: 0, candidates: [] },
          status: "no-candidates",
        };
      }

      const finalContainer = request.project.containers.at(-1) as {
        readonly id: string;
      };
      const candidates = request.project.containers.map((container, index) =>
        index === request.project.containers.length - 1
          ? {
              containerId: container.id,
              attemptCount: request.project.cargoes.length,
              outcome: "complete",
            }
          : { containerId: container.id, attemptCount: 1, outcome: "exhausted" },
      );
      return {
        ...base,
        attempts: {
          requestAttemptCount:
            request.project.containers.length - 1 + request.project.cargoes.length,
          candidates,
        },
        status: "complete",
        plan: {
          containerId: finalContainer.id,
          placements: request.project.cargoes.map((cargo, index) => ({
            cargoId: cargo.id,
            containerId: finalContainer.id,
            orientation: cargo.allowedOrientations[0],
            positionMm: { xMm: index * 10, yMm: 0, zMm: 0 },
          })),
          invalidReasonCount: 0,
          unverifiedReasons: request.project.cargoes.map((cargo) => ({
            status: "unverified",
            code: "opening-path-unverified",
            target: { kind: "cargo", id: cargo.id },
            relatedCargoIds: [],
          })),
        },
      };
    };

    class ControlledProposalWorker {
      onmessage: ((event: { readonly data: unknown }) => void) | null = null;
      onerror: (() => void) | null = null;
      onmessageerror: (() => void) | null = null;

      postMessage(request: ProposalRequest) {
        const listener = this.onmessage;
        pending.push({
          request,
          deliver: (data) => listener?.({ data }),
        });
      }

      terminate() {
        terminatedCount += 1;
        if (cancelRequestedAt !== undefined) {
          cancelLatencyMs = performance.now() - cancelRequestedAt;
          cancelRequestedAt = undefined;
        }
      }
    }

    browserGlobal.Worker = new Proxy(NativeWorker, {
      construct(target, argumentsList) {
        if (String(argumentsList[0]).includes(workerFragment)) {
          return new ControlledProposalWorker();
        }
        return Reflect.construct(target, argumentsList);
      },
    });
    browserGlobal.__proposalPendingCount = () => pending.length;
    browserGlobal.__proposalTerminatedCount = () => terminatedCount;
    browserGlobal.__proposalCancelLatencyMs = () => cancelLatencyMs;
    browserGlobal.__cancelProposalFromBrowser = () => {
      const browserDocument = (
        globalThis as unknown as {
          readonly document: {
            querySelector: (
              selector: string,
            ) => { click(): void } | null;
          };
        }
      ).document;
      const cancelButton = browserDocument.querySelector(
        ".automatic-proposal__actions button",
      );
      if (cancelButton === null) {
        throw new Error("controlled proposal cancel button was not available");
      }
      cancelRequestedAt = performance.now();
      cancelButton.click();
    };
    browserGlobal.__releaseProposal = (index = pending.length - 1) => {
      const selected = pending[index];
      selected?.deliver({
        type: "automatic-proposal.ready",
        requestId: selected.request.requestId,
        result: resultFor(selected.request),
      });
    };
  }, proposalWorkerFragment);
}

async function expectPendingCount(page: Page, count: number) {
  await expect
    .poll(() =>
      page.evaluate(() => {
        const browserGlobal = globalThis as unknown as {
          __proposalPendingCount: () => number;
        };
        return browserGlobal.__proposalPendingCount();
      }),
    )
    .toBe(count);
}

async function releaseProposal(page: Page, index?: number) {
  await page.evaluate((selectedIndex) => {
    const browserGlobal = globalThis as unknown as {
      __releaseProposal: (index?: number) => void;
    };
    browserGlobal.__releaseProposal(selectedIndex);
  }, index);
}

test("runs the real worker without WebGL for no-cargo and no-candidates without changing the project", async ({
  page,
}) => {
  await page.goto("/?forceWebgl2=unsupported");
  const panel = page.locator(".automatic-proposal");
  const history = page.locator(".project-history__summary");
  const canonical = page.getByTestId("canonical-project-settings");

  await expect(panel).toBeVisible();
  await expect(page.getByRole("heading", { name: "3D表示を利用できません" })).toBeVisible();
  const initialHistory = await history.textContent();
  const initialProject = await canonical.textContent();
  await panel.getByRole("button", { name: "自動提案を開始" }).click();
  await expect(panel).toHaveAttribute("data-automatic-proposal-phase", "ready");
  await expect(panel).toContainText("対象なし");
  expect(await history.textContent()).toBe(initialHistory);
  expect(await canonical.textContent()).toBe(initialProject);
  await expect(panel.getByRole("button", { name: /適用/ })).toHaveCount(0);

  await addCargo(page, "匿名積荷");
  await expect(panel).toHaveAttribute("data-automatic-proposal-phase", "stale");
  await expect(history).toContainText("次に元に戻せる操作: 積荷の追加。");
  const cargoHistory = await history.textContent();
  const cargoProject = await canonical.textContent();
  await panel.getByRole("button", { name: "現在の案件で再試行" }).click();
  await expect(panel).toHaveAttribute("data-automatic-proposal-phase", "ready");
  await expect(panel).toContainText("候補なし");
  expect(await history.textContent()).toBe(cargoHistory);
  expect(await canonical.textContent()).toBe(cargoProject);
  await expect(panel.getByRole("button", { name: /適用/ })).toHaveCount(0);
});

test("shows a real-worker complete proposal as an unapplied immutable preview", async ({ page }) => {
  await page.goto("/?forceWebgl2=unsupported");
  await addCargo(page, "小規模積荷");
  await addContainer(page, "小規模候補");
  const panel = page.locator(".automatic-proposal");
  const history = page.locator(".project-history__summary");
  const before = await history.textContent();

  await panel.getByRole("button", { name: "自動提案を開始" }).click();
  await expect(panel).toHaveAttribute("data-automatic-proposal-phase", "ready");
  await expect(panel).toContainText("案あり・未適用");
  await expect(panel).toContainText("現在の配置0件");
  await expect(panel).toContainText("提案1件");
  await expect(panel).toContainText("automatic-proposal-v1");
  await expect(panel).toContainText("小規模候補 (container-1)");
  await expect(panel).toContainText("小規模積荷 (cargo-1)");
  await expect(panel).toContainText("完全な搬入経路は未確認です。");
  await expect(panel).toContainText("完全な搬入経路、構造・安定性、実積載の安全性を保証しません");
  expect(await history.textContent()).toBe(before);
  await expect(panel.getByRole("button", { name: /適用/ })).toHaveCount(0);
});

test("cancels a controlled slow worker responsively, ignores its late result, and retries", async ({
  page,
}) => {
  await installControlledProposalWorker(page);
  await page.goto("/?forceWebgl2=unsupported");
  const panel = page.locator(".automatic-proposal");

  await panel.getByRole("button", { name: "自動提案を開始" }).click();
  await expectPendingCount(page, 1);
  await expect(panel).toHaveAttribute("aria-busy", "true");
  await page.evaluate(() => {
    const browserGlobal = globalThis as unknown as {
      __cancelProposalFromBrowser: () => void;
    };
    browserGlobal.__cancelProposalFromBrowser();
  });
  await expect(panel).toHaveAttribute("data-automatic-proposal-phase", "cancelled");
  await expect(panel).toHaveAttribute("aria-busy", "false");
  await expect(panel).toContainText("取消済み");
  const cancellation = await page.evaluate(() => {
    const browserGlobal = globalThis as unknown as {
      __proposalTerminatedCount: () => number;
      __proposalCancelLatencyMs: () => number | undefined;
    };
    return {
      terminatedCount: browserGlobal.__proposalTerminatedCount(),
      latencyMs: browserGlobal.__proposalCancelLatencyMs(),
    };
  });
  expect(cancellation.terminatedCount).toBe(1);
  expect(cancellation.latencyMs).toBeDefined();
  expect(cancellation.latencyMs as number).toBeGreaterThanOrEqual(0);
  expect(cancellation.latencyMs as number).toBeLessThanOrEqual(250);

  await releaseProposal(page, 0);
  await expect(panel).toHaveAttribute("data-automatic-proposal-phase", "cancelled");
  expect(
    await page.evaluate(() => {
      const browserGlobal = globalThis as unknown as {
        __proposalTerminatedCount: () => number;
      };
      return browserGlobal.__proposalTerminatedCount();
    }),
  ).toBe(1);
  await panel.getByRole("button", { name: "現在の案件で再試行" }).click();
  await expectPendingCount(page, 2);
  await releaseProposal(page, 1);
  await expect(panel).toHaveAttribute("data-automatic-proposal-phase", "ready");
  await expect(panel).toContainText("対象なし");
});

test("invalidates a running preview for Project commits, undo, redo, and generation-only drafts", async ({
  page,
}) => {
  await installControlledProposalWorker(page);
  await page.goto("/?forceWebgl2=unsupported");
  const panel = page.locator(".automatic-proposal");
  const canonical = page.getByTestId("canonical-project-settings");
  const retry = () => panel.getByRole("button", { name: "現在の案件で再試行" });

  await panel.getByRole("button", { name: "自動提案を開始" }).click();
  await expectPendingCount(page, 1);
  await page.getByLabel("案件名").fill("提案中に更新");
  await page.getByRole("button", { name: "案件を保存" }).click();
  await expect(canonical).toContainText("提案中に更新");
  await expect(panel).toHaveAttribute("data-automatic-proposal-phase", "stale");
  await releaseProposal(page, 0);
  await expect(panel).not.toContainText("対象なし");

  await retry().click();
  await expectPendingCount(page, 2);
  await page.getByRole("button", { name: "元に戻す" }).click();
  await expect(canonical).toContainText("新規案件");
  await expect(panel).toHaveAttribute("data-automatic-proposal-phase", "stale");

  await retry().click();
  await expectPendingCount(page, 3);
  await page.getByRole("button", { name: "やり直す" }).click();
  await expect(canonical).toContainText("提案中に更新");
  await expect(panel).toHaveAttribute("data-automatic-proposal-phase", "stale");

  await retry().click();
  await expectPendingCount(page, 4);
  await page.getByRole("button", { name: "積荷を追加" }).click();
  await expect(panel).toHaveAttribute("data-automatic-proposal-phase", "stale");
  await expect(page.getByLabel("積荷名")).toBeFocused();
  await page.getByRole("button", { name: "積荷編集をキャンセル" }).click();
  await expect(canonical).toContainText("提案中に更新");
});

test("invalidates a running proposal when persistence starts and after a valid JSON replacement", async ({
  page,
}) => {
  await installControlledProposalWorker(page);
  await page.goto("/?forceWebgl2=unsupported");
  const panel = page.locator(".automatic-proposal");
  const persistenceStatus = page.locator(".project-persistence__status");

  await panel.getByRole("button", { name: "自動提案を開始" }).click();
  await expectPendingCount(page, 1);
  await page.getByRole("button", { name: "端末へ保存" }).click();
  await expect(panel).toHaveAttribute("data-automatic-proposal-phase", "stale");
  await expect(persistenceStatus).toHaveText("現在の案件をこの端末へ保存しました。");

  await panel.getByRole("button", { name: "現在の案件で再試行" }).click();
  await expectPendingCount(page, 2);
  await importJson(page, projectJson("読込後案件", 0, 0));
  await expect(page.getByTestId("canonical-project-settings")).toContainText("読込後案件");
  await expect(persistenceStatus).toContainText("案件JSONを読み込みました");
  await expect(panel).toHaveAttribute("data-automatic-proposal-phase", "stale");
  await releaseProposal(page, 1);
  await expect(panel).not.toContainText("対象なし");
});

test("disables start for a draft and exposes keyboard, live, busy, and narrow-screen semantics", async ({
  page,
}) => {
  await installControlledProposalWorker(page);
  await page.goto("/?forceWebgl2=unsupported");
  const panel = page.locator(".automatic-proposal");
  const summary = panel.locator(".automatic-proposal__summary");
  const start = panel.getByRole("button", { name: "自動提案を開始" });

  await expect(summary).toHaveAttribute("aria-live", "polite");
  await expect(summary).toHaveAttribute("aria-atomic", "true");
  await page.getByRole("button", { name: "積荷を追加" }).click();
  await expect(start).toBeDisabled();
  await expect(start).toHaveAttribute("aria-describedby", "automatic-proposal-blocked");
  await expect(panel).toContainText("未保存入力、削除確認、3D移動、または保存処理");
  await page.getByRole("button", { name: "積荷編集をキャンセル" }).click();

  await expect(start).toBeEnabled();
  await start.press("Enter");
  await expectPendingCount(page, 1);
  await expect(panel).toHaveAttribute("aria-busy", "true");
  await expect(panel).toContainText("探索中");
  await panel.getByRole("button", { name: "探索を中止" }).click();
  await expect(panel).toHaveAttribute("aria-busy", "false");

  for (const width of [305, 320, 375]) {
    await page.setViewportSize({ width, height: 900 });
    await expectNoHorizontalOverflow(page);
  }
});

test("paginates more than 25 controlled candidate, placement, and unverified rows without overflow", async ({
  page,
}) => {
  await installControlledProposalWorker(page);
  await page.goto("/?forceWebgl2=unsupported");
  await importJson(page, projectJson("大量匿名案件", 26, 26));
  await expect(page.getByTestId("canonical-project-settings")).toContainText("大量匿名案件");
  const panel = page.locator(".automatic-proposal");

  await panel.getByRole("button", { name: "自動提案を開始" }).click();
  await expectPendingCount(page, 1);
  await releaseProposal(page);
  await expect(panel).toHaveAttribute("data-automatic-proposal-phase", "ready");
  await expect(panel).toContainText("案あり・未適用");

  const candidates = panel.getByRole("region", { name: "候補別の探索結果" });
  const placements = panel.getByRole("region", { name: "提案配置（未適用）" });
  const unverified = panel.getByRole("region", { name: "未確認事項（26件）" });
  await expect(candidates.getByRole("listitem")).toHaveCount(25);
  await candidates.getByRole("button", { name: "次の候補" }).click();
  await expect(candidates.getByRole("listitem")).toHaveCount(1);
  await expect(candidates).toContainText("26〜26 / 26件");

  await expect(placements.getByRole("listitem")).toHaveCount(25);
  await placements.getByRole("button", { name: "次の提案配置" }).click();
  await expect(placements.getByRole("listitem")).toHaveCount(1);
  await expect(placements).toContainText("26〜26 / 26件");

  await expect(unverified.getByRole("listitem")).toHaveCount(25);
  await unverified.getByRole("button", { name: "次の未確認事項" }).click();
  await expect(unverified.getByRole("listitem")).toHaveCount(1);
  await expect(unverified).toContainText("26〜26 / 26件");

  for (const width of [305, 320, 375]) {
    await page.setViewportSize({ width, height: 900 });
    await expectNoHorizontalOverflow(page);
  }
});
