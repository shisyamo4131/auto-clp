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

async function addCargo(
  page: Page,
  name: string,
  options: { massKg?: string; canSupportCargo?: boolean } = {},
) {
  await page.getByRole("button", { name: "積荷を追加" }).click();
  await page.getByLabel("積荷名").fill(name);
  await page.getByLabel("長さ", { exact: true }).fill("100");
  await page.getByLabel("幅", { exact: true }).fill("100");
  await page.getByLabel("高さ", { exact: true }).fill("100");
  await page.getByLabel("重量").fill(options.massKg ?? "1");
  if (options.canSupportCargo === true) {
    await page
      .getByLabel("この積荷の上面で別の積荷を幾何学的に支持できる")
      .check();
  }
  await page.getByRole("button", { name: "積荷を保存" }).click();
}

async function addContainer(
  page: Page,
  name: string,
  options: {
    lengthMm?: string;
    heightMm?: string;
    openingHeightMm?: string;
    payloadKg?: string;
  } = {},
) {
  await page.getByRole("button", { name: "候補を追加" }).click();
  await page.getByLabel("候補名").fill(name);
  await page.getByLabel("内部長さ").fill(options.lengthMm ?? "200");
  await page.getByLabel("内部幅").fill("100");
  await page.getByLabel("内部高さ").fill(options.heightMm ?? "100");
  await page.getByLabel("開口幅").fill("100");
  await page.getByLabel("開口高さ").fill(options.openingHeightMm ?? "100");
  await page.getByLabel("総耐荷重").fill(options.payloadKg ?? "1000");
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
      __setProposalCompleteWithCutoff: (enabled: boolean) => void;
      __setProposalPhysicallyInvalid: (enabled: boolean) => void;
    }

    const browserGlobal = globalThis as unknown as ControlledGlobal;
    const NativeWorker = browserGlobal.Worker as new (
      ...argumentsList: readonly unknown[]
    ) => object;
    const pending: PendingWorker[] = [];
    let terminatedCount = 0;
    let cancelRequestedAt: number | undefined;
    let cancelLatencyMs: number | undefined;
    let completeWithCutoff = false;
    let physicallyInvalid = false;

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
        completeWithCutoff && index === 0
          ? {
              containerId: container.id,
              attemptCount: 10_000,
              outcome: "cutoff",
              cutoffSource: "candidate",
            }
          : index === request.project.containers.length - 1
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
            candidates.reduce(
              (total, candidate) => total + candidate.attemptCount,
              0,
            ),
          candidates,
        },
        status: completeWithCutoff ? "complete-with-cutoff" : "complete",
        ...(completeWithCutoff ? { cutoffSource: "candidate" } : {}),
        plan: {
          containerId: finalContainer.id,
          placements: request.project.cargoes.map((cargo, index) => ({
            cargoId: cargo.id,
            containerId: finalContainer.id,
            orientation: cargo.allowedOrientations[0],
            positionMm: {
              xMm: physicallyInvalid ? 1 + index * 10 : index * 10,
              yMm: 0,
              zMm: 0,
            },
          })),
          invalidReasonCount: 0,
          unverifiedReasons:
            request.project.cargoes.length > 25
              ? request.project.cargoes.map((cargo, index, cargoes) => ({
                  status: "unverified",
                  code: "structure-stability-unverified",
                  target: { kind: "cargo", id: cargo.id },
                  relatedCargoIds: [cargoes[(index + 1) % cargoes.length]!.id],
                }))
              : [],
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
    browserGlobal.__setProposalCompleteWithCutoff = (enabled) => {
      completeWithCutoff = enabled;
    };
    browserGlobal.__setProposalPhysicallyInvalid = (enabled) => {
      physicallyInvalid = enabled;
    };
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

test("runs the real worker for no-cargo and no-candidates without changing the project", async ({
  page,
}) => {
  await page.goto("/");
  const panel = page.locator(".automatic-proposal");
  const history = page.locator(".project-history__summary");
  const canonical = page.getByTestId("canonical-project-settings");

  await expect(panel).toBeVisible();
  await expect(page.getByRole("heading", { name: "3D表示を利用できます" })).toBeVisible();
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
  await panel.getByRole("button", { name: "現在のCLPで再試行" }).click();
  await expect(panel).toHaveAttribute("data-automatic-proposal-phase", "ready");
  await expect(panel).toContainText("候補なし");
  expect(await history.textContent()).toBe(cargoHistory);
  expect(await canonical.textContent()).toBe(cargoProject);
  await expect(panel.getByRole("button", { name: /適用/ })).toHaveCount(0);
});

test("applies the real AP-02 plan as one confirmed history action and restores it with undo and redo", async ({
  page,
}) => {
  await page.goto("/");
  await addCargo(page, "匿名積荷A");
  await addCargo(page, "匿名積荷B");
  await addContainer(page, "匿名AP02候補");
  await page.getByLabel("操作する積荷").selectOption("cargo-1");
  await page.getByRole("button", { name: "座標を入力して配置" }).click();
  await page.getByLabel("X最小角").fill("50");
  await page.getByRole("button", { name: "配置を保存" }).click();
  const panel = page.locator(".automatic-proposal");
  const history = page.locator(".project-history__summary");
  const canonical = page.getByTestId("canonical-project-settings");
  const cargoList = page.getByLabel("操作する積荷");
  const containerList = page.getByRole("list", { name: "候補一覧" });
  const projectBefore = await canonical.textContent();
  const containersBefore = await containerList.textContent();
  const historyBefore = await history.textContent();

  await panel.getByRole("button", { name: "自動提案を開始" }).click();
  await expect(panel).toHaveAttribute("data-automatic-proposal-phase", "ready");
  await expect(panel).toContainText("案あり・未適用");
  await expect(panel).toContainText("現在の配置1件");
  await expect(panel).toContainText("配置案2件");
  await expect(panel).toContainText("automatic-proposal-v1");
  await expect(panel).toContainText("匿名AP02候補 (container-1)");
  await expect(panel).toContainText("匿名積荷A (cargo-1)");
  await expect(panel).toContainText("匿名積荷B (cargo-2)");
  await expect(panel).toContainText("完全な搬入経路、構造・安定性、実積載の安全性を保証しません");
  expect(await history.textContent()).toBe(historyBefore);
  expect(await canonical.textContent()).toBe(projectBefore);
  const sceneStatus = page.locator("#scene-workspace-status");
  await expect(sceneStatus).toContainText("配置1件");
  await expect(page.locator(".scene-selection-card")).toContainText("50 mm");

  const applyButton = panel.getByRole("button", { name: "配置案を適用", exact: true });
  await applyButton.click();
  const confirmation = panel.getByRole("alert");
  await expect(confirmation).toContainText("現在の配置1件を");
  await expect(confirmation).toContainText("配置案2件で一括置換します");
  await expect(confirmation).toContainText(
    "配置が変わる場合は、1回の取り消しで元へ戻せます。",
  );
  await expect(confirmation.getByRole("button", { name: "配置案を適用" })).toBeFocused();
  await confirmation.getByRole("button", { name: "適用をやめる" }).click();
  await expect(applyButton).toBeFocused();

  await applyButton.click();
  await confirmation.getByRole("button", { name: "配置案を適用" }).click();
  await expect(panel).toHaveAttribute("data-automatic-proposal-phase", "applied");
  await expect(panel).toContainText("適用済み");
  await expect(panel.locator(".automatic-proposal__summary")).toBeFocused();
  await expect(history).toContainText("次に元に戻せる操作: 自動提案の一括適用。");
  await expect(sceneStatus).toContainText("配置2件");
  expect(await canonical.textContent()).toBe(projectBefore);
  await expect(cargoList).toContainText("匿名積荷A");
  await expect(cargoList).toContainText("匿名積荷B");
  expect(await containerList.textContent()).toBe(containersBefore);

  await page.getByRole("button", { name: "元に戻す" }).click();
  await expect(sceneStatus).toContainText("配置1件");
  await page.getByRole("button", { name: "やり直す" }).click();
  await expect(sceneStatus).toContainText("配置2件");
});

test("confirms a zero-current add, commits rapid double confirmation once, and keeps a same-plan reapply unchanged", async ({
  page,
}) => {
  await page.goto("/");
  await addCargo(page, "匿名単一積荷");
  await addContainer(page, "匿名単一候補");
  const panel = page.locator(".automatic-proposal");
  const history = page.locator(".project-history__summary");
  const sceneStatus = page.locator("#scene-workspace-status");

  await panel.getByRole("button", { name: "自動提案を開始" }).click();
  await expect(panel).toHaveAttribute("data-automatic-proposal-phase", "ready");
  await panel.getByRole("button", { name: "配置案を適用", exact: true }).click();
  const confirmation = panel.getByRole("alert");
  await expect(confirmation).toContainText("配置案1件を追加します");
  const confirmButton = confirmation.getByRole("button", { name: "配置案を適用" });
  await confirmButton.evaluate((element) => {
    const clickable = element as unknown as { click(): void };
    clickable.click();
    clickable.click();
  });
  await expect(panel).toHaveAttribute("data-automatic-proposal-phase", "applied");
  await expect(sceneStatus).toContainText("配置1件");
  await expect(history).toContainText("次に元に戻せる操作: 自動提案の一括適用。");

  await page.getByRole("button", { name: "元に戻す" }).click();
  await expect(sceneStatus).toContainText("配置0件");
  await page.getByRole("button", { name: "やり直す" }).click();
  await expect(sceneStatus).toContainText("配置1件");
  await expect(panel).toHaveAttribute("data-automatic-proposal-phase", "idle");

  await panel.getByRole("button", { name: "自動提案を開始" }).click();
  await expect(panel).toHaveAttribute("data-automatic-proposal-phase", "ready");
  await panel.getByRole("button", { name: "配置案を適用", exact: true }).click();
  await expect(panel.getByRole("alert")).toContainText(
    "配置が変わる場合は、1回の取り消しで元へ戻せます。",
  );
  const historyBeforeNoOp = await history.textContent();
  await panel
    .getByRole("alert")
    .getByRole("button", { name: "配置案を適用" })
    .click();
  await expect(panel).toHaveAttribute("data-automatic-proposal-phase", "unchanged");
  await expect(panel).toContainText("変更なし");
  expect(await history.textContent()).toBe(historyBeforeNoOp);
  await expect(sceneStatus).toContainText("配置1件");
});

test("preserves the AP-03 structure warning through real preview, confirmation, apply, and physical validation", async ({
  page,
}) => {
  await page.goto("/");
  await addCargo(page, "匿名支持積荷", {
    massKg: "1.001",
    canSupportCargo: true,
  });
  await addCargo(page, "匿名上段積荷", { massKg: "1" });
  await addContainer(page, "匿名AP03候補", {
    lengthMm: "100",
    heightMm: "200",
    openingHeightMm: "200",
    payloadKg: "2.001",
  });
  const panel = page.locator(".automatic-proposal");

  await panel.getByRole("button", { name: "自動提案を開始" }).click();
  await expect(panel).toHaveAttribute("data-automatic-proposal-phase", "ready");
  await expect(panel.getByRole("heading", { name: "未確認事項（1件）" })).toBeVisible();
  await expect(panel.getByText("支持後の構造・安定性は未確認です。")).toHaveCount(1);
  await panel.getByRole("button", { name: "配置案を適用", exact: true }).click();
  const confirmation = panel.getByRole("alert");
  await expect(confirmation).toContainText("未確認事項が1件あります");
  await confirmation.getByRole("button", { name: "配置案を適用" }).click();

  await expect(panel).toHaveAttribute("data-automatic-proposal-phase", "applied");
  await expect(panel).toContainText("未確認事項1件を保持しています");
  const physical = page.locator(".physical-validation");
  await expect(physical.locator(".physical-validation__summary")).toContainText(
    "確認が必要な理由が1件あります",
  );
  await expect(physical.getByRole("heading", { name: "未確認理由（1件）" })).toBeVisible();
  await expect(physical).toContainText(
    "幾何学的な支持は成立していますが、構造強度と安定性は未確認です。",
  );
});

test("keeps a controlled complete-with-cutoff warning applicable in preview and confirmation", async ({
  page,
}) => {
  await installControlledProposalWorker(page);
  await page.goto("/");
  await addCargo(page, "匿名cutoff積荷");
  await addContainer(page, "優先匿名候補");
  await addContainer(page, "採用匿名候補");
  await page.evaluate(() => {
    const browserGlobal = globalThis as unknown as {
      __setProposalCompleteWithCutoff: (enabled: boolean) => void;
    };
    browserGlobal.__setProposalCompleteWithCutoff(true);
  });
  const panel = page.locator(".automatic-proposal");

  await panel.getByRole("button", { name: "自動提案を開始" }).click();
  await expectPendingCount(page, 1);
  await releaseProposal(page);
  await expect(panel).toHaveAttribute("data-automatic-proposal-phase", "ready");
  await expect(panel).toContainText("案あり・最良未確認・未適用");
  await panel.getByRole("button", { name: "配置案を適用", exact: true }).click();
  await expect(panel.getByRole("alert")).toContainText(
    "この案が目的関数上の最良とは確認できません",
  );
  for (const width of [305, 320, 375]) {
    await page.setViewportSize({ width, height: 900 });
    await expectNoHorizontalOverflow(page);
  }
});

test("closes confirmation on generation and persistence changes and shows fixed apply failure without a commit", async ({
  page,
}) => {
  await installControlledProposalWorker(page);
  await page.goto("/");
  await addCargo(page, "marker-sensitive-cargo");
  await addContainer(page, "匿名失敗候補", { lengthMm: "100" });
  const panel = page.locator(".automatic-proposal");
  const history = page.locator(".project-history__summary");

  await panel.getByRole("button", { name: "自動提案を開始" }).click();
  await releaseProposal(page);
  await expect(panel).toHaveAttribute("data-automatic-proposal-phase", "ready");
  await panel.getByRole("button", { name: "配置案を適用", exact: true }).click();
  const historyBeforeDraft = await history.textContent();
  await page.getByLabel("CLP名").fill("未保存変更");
  await expect(panel.getByRole("alert")).toHaveCount(0);
  await expect(panel).toHaveAttribute("data-automatic-proposal-phase", "stale");
  await expect(page.getByRole("button", { name: "元に戻す" })).toBeDisabled();
  await page.getByLabel("CLP名").fill("新規CLP");
  await expect(history).toHaveText(historyBeforeDraft ?? "");

  await panel.getByRole("button", { name: "現在のCLPで再試行" }).click();
  await releaseProposal(page);
  await panel.getByRole("button", { name: "配置案を適用", exact: true }).click();
  await page.getByRole("button", { name: "CLPデータを開く" }).click();
  await page.getByRole("button", { name: "端末へ保存" }).click();
  await expect(page.locator(".project-persistence__status")).toHaveText(
    "現在のCLPをこの端末へ保存しました。",
  );
  await page.getByRole("button", { name: "CLPデータを閉じる" }).click();
  await expect(panel.getByRole("alert")).toHaveCount(0);
  await expect(panel).toHaveAttribute("data-automatic-proposal-phase", "stale");
  await expect(history).toHaveText(historyBeforeDraft ?? "");

  await panel.getByRole("button", { name: "現在のCLPで再試行" }).click();
  await page.evaluate(() => {
    const browserGlobal = globalThis as unknown as {
      __setProposalPhysicallyInvalid: (enabled: boolean) => void;
    };
    browserGlobal.__setProposalPhysicallyInvalid(true);
  });
  await releaseProposal(page);
  await panel.getByRole("button", { name: "配置案を適用", exact: true }).click();
  await panel.getByRole("alert").getByRole("button", { name: "配置案を適用" }).click();
  await expect(panel).toHaveAttribute("data-automatic-proposal-phase", "apply-failed");
  await expect(panel).toContainText(
    "配置案を再検証できなかったため適用しませんでした。CLPは変更していません。",
  );
  await expect(panel).not.toContainText("marker-sensitive-cargo");
  expect(await history.textContent()).toBe(historyBeforeDraft);
  await expect(page.locator("#scene-workspace-status")).toContainText("配置0件");
});

test("cancels a controlled slow worker responsively, ignores its late result, and retries", async ({
  page,
}) => {
  await installControlledProposalWorker(page);
  await page.goto("/");
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
  await panel.getByRole("button", { name: "現在のCLPで再試行" }).click();
  await expectPendingCount(page, 2);
  await releaseProposal(page, 1);
  await expect(panel).toHaveAttribute("data-automatic-proposal-phase", "ready");
  await expect(panel).toContainText("対象なし");
});

test("invalidates a running preview for Project commits, undo, redo, and generation-only drafts", async ({
  page,
}) => {
  await installControlledProposalWorker(page);
  await page.goto("/");
  const panel = page.locator(".automatic-proposal");
  const canonical = page.getByTestId("canonical-project-settings");
  const retry = () => panel.getByRole("button", { name: "現在のCLPで再試行" });

  await panel.getByRole("button", { name: "自動提案を開始" }).click();
  await expectPendingCount(page, 1);
  await page.getByLabel("CLP名").fill("提案中に更新");
  await page.getByRole("button", { name: "CLPを保存" }).click();
  await expect(canonical).toContainText("提案中に更新");
  await expect(panel).toHaveAttribute("data-automatic-proposal-phase", "stale");
  await releaseProposal(page, 0);
  await expect(panel).not.toContainText("対象なし");

  await retry().click();
  await expectPendingCount(page, 2);
  await page.getByRole("button", { name: "元に戻す" }).click();
  await expect(canonical).toContainText("新規CLP");
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
  await page.getByRole("button", { name: "キャンセル" }).click();
  await expect(canonical).toContainText("提案中に更新");
});

test("invalidates a running proposal when persistence starts and after a valid JSON replacement", async ({
  page,
}) => {
  await installControlledProposalWorker(page);
  await page.goto("/");
  const panel = page.locator(".automatic-proposal");
  const persistenceStatus = page.locator(".project-persistence__status");

  await panel.getByRole("button", { name: "自動提案を開始" }).click();
  await expectPendingCount(page, 1);
  await page.getByRole("button", { name: "CLPデータを開く" }).click();
  await page.getByRole("button", { name: "端末へ保存" }).click();
  await expect(panel).toHaveAttribute("data-automatic-proposal-phase", "stale");
  await expect(persistenceStatus).toHaveText("現在のCLPをこの端末へ保存しました。");
  await page.getByRole("button", { name: "CLPデータを閉じる" }).click();

  await panel.getByRole("button", { name: "現在のCLPで再試行" }).click();
  await expectPendingCount(page, 2);
  await importJson(page, projectJson("読込後CLP", 0, 0));
  await expect(page.getByTestId("canonical-project-settings")).toContainText("読込後CLP");
  await expect(persistenceStatus).toContainText("CLP JSONを読み込みました");
  await expect(panel).toHaveAttribute("data-automatic-proposal-phase", "stale");
  await releaseProposal(page, 1);
  await expect(panel).not.toContainText("対象なし");
});

test("disables start for a draft and exposes keyboard, live, busy, and narrow-screen semantics", async ({
  page,
}) => {
  await installControlledProposalWorker(page);
  await page.goto("/");
  const panel = page.locator(".automatic-proposal");
  const summary = panel.locator(".automatic-proposal__summary");
  const start = panel.getByRole("button", { name: "自動提案を開始" });

  await expect(summary).toHaveAttribute("aria-live", "polite");
  await expect(summary).toHaveAttribute("aria-atomic", "true");
  await page.getByRole("button", { name: "積荷を追加" }).click();
  await expect(start).toBeDisabled();
  await expect(start).toHaveAttribute("aria-describedby", "automatic-proposal-blocked");
  await expect(panel).toContainText("未保存入力、削除確認、3D移動、または保存処理");
  await page.getByRole("button", { name: "キャンセル" }).click();

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
  await page.goto("/");
  await importJson(page, projectJson("大量匿名CLP", 26, 26));
  await expect(page.getByTestId("canonical-project-settings")).toContainText("大量匿名CLP");
  const panel = page.locator(".automatic-proposal");

  await panel.getByRole("button", { name: "自動提案を開始" }).click();
  await expectPendingCount(page, 1);
  await releaseProposal(page);
  await expect(panel).toHaveAttribute("data-automatic-proposal-phase", "ready");
  await expect(panel).toContainText("案あり・未適用");

  const candidates = panel.getByRole("region", { name: "候補別の探索結果" });
  const placements = panel.getByRole("region", { name: "配置案（未適用）" });
  const unverified = panel.getByRole("region", { name: "未確認事項（26件）" });
  await expect(candidates.getByRole("listitem")).toHaveCount(25);
  await candidates.getByRole("button", { name: "次の候補" }).click();
  await expect(candidates.getByRole("listitem")).toHaveCount(1);
  await expect(candidates).toContainText("26〜26 / 26件");

  await expect(placements.getByRole("listitem")).toHaveCount(25);
  await placements.getByRole("button", { name: "次の配置案" }).click();
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
