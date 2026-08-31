import { expect, test, type Download, type Page } from "./fixtures";
import {
  addCargoFromDrawer,
  addContainerFromDrawer,
  openCargoAddEditor,
  openPersistenceDrawer as openDrawerFromMenu,
  openProjectSettings,
  saveProjectName,
} from "./ui-helpers";

const exportFilename = "auto-clp-project-0.1.0.json";
const runtimeBaseUrlEnvironmentVariable = "AUTO_CLP_BROWSER_BASE_URL";
const runtimeBaseUrl = process.env[runtimeBaseUrlEnvironmentVariable];
if (runtimeBaseUrl === undefined || runtimeBaseUrl.length === 0) {
  throw new Error(
    `${runtimeBaseUrlEnvironmentVariable} is required; run this test through the package test:browser script`,
  );
}

function projectJson(name: string, overrides: Record<string, unknown> = {}) {
  return {
    schemaVersion: "0.1.0",
    projectId: "persistence-browser",
    name,
    clearancesMm: { xMm: 0, yMm: 0, zMm: 0 },
    cargoes: [],
    containers: [],
    placements: [],
    ...overrides,
  };
}

async function importJson(
  page: Page,
  value: unknown,
  filename = "anonymous-project.json",
) {
  const text = typeof value === "string" ? value : JSON.stringify(value);
  await page.locator("input[type='file']").setInputFiles({
    name: filename,
    mimeType: "application/json",
    buffer: Buffer.from(text),
  });
}

async function downloadText(download: Download): Promise<string> {
  const stream = await download.createReadStream();
  const chunks: Buffer[] = [];
  for await (const chunk of stream) {
    chunks.push(Buffer.isBuffer(chunk) ? chunk : Buffer.from(chunk));
  }
  return Buffer.concat(chunks).toString("utf8");
}

async function installControlledPreflightWorker(page: Page) {
  await page.addInitScript(() => {
    interface ControlledPreflightGlobal {
      Worker: unknown;
      __hasPendingProjectImportPreflight: () => boolean;
      __releaseProjectImportPreflight: () => void;
    }
    interface PendingRequest {
      readonly requestId: number;
      readonly worker: ControlledPreflightWorker;
    }
    const browserGlobal = globalThis as unknown as ControlledPreflightGlobal;
    let pending: PendingRequest | undefined;

    class ControlledPreflightWorker {
      onmessage: ((event: { readonly data: unknown }) => void) | null = null;
      onerror: (() => void) | null = null;
      onmessageerror: (() => void) | null = null;
      private terminated = false;

      postMessage(request: { readonly requestId: number }) {
        pending = { requestId: request.requestId, worker: this };
      }

      release(requestId: number) {
        if (!this.terminated) {
          this.onmessage?.({
            data: {
              type: "project-import-preflight-ready",
              requestId,
            },
          });
        }
      }

      terminate() {
        this.terminated = true;
        if (pending?.worker === this) {
          pending = undefined;
        }
      }
    }

    browserGlobal.__hasPendingProjectImportPreflight = () => pending !== undefined;
    browserGlobal.__releaseProjectImportPreflight = () => {
      const current = pending;
      pending = undefined;
      current?.worker.release(current.requestId);
    };
    browserGlobal.Worker = ControlledPreflightWorker;
  });
}

async function expectControlledPreflightPending(page: Page) {
  await expect
    .poll(() =>
      page.evaluate(() => {
        const browserGlobal = globalThis as unknown as {
          __hasPendingProjectImportPreflight: () => boolean;
        };
        return browserGlobal.__hasPendingProjectImportPreflight();
      }),
    )
    .toBe(true);
}

async function releaseControlledPreflight(page: Page) {
  await page.evaluate(() => {
    const browserGlobal = globalThis as unknown as {
      __releaseProjectImportPreflight: () => void;
    };
    browserGlobal.__releaseProjectImportPreflight();
  });
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

async function scrollPageTo(page: Page, top: number) {
  await page.evaluate((targetTop) => {
    const browserGlobal = globalThis as unknown as {
      scrollTo: (left: number, top: number) => void;
    };
    browserGlobal.scrollTo(0, targetTop);
  }, top);
}

async function pageScrollTop(page: Page) {
  return page.evaluate(() => {
    const browserGlobal = globalThis as unknown as { readonly scrollY: number };
    return browserGlobal.scrollY;
  });
}

async function maxPageScrollTop(page: Page) {
  return page.evaluate(() => {
    const browserGlobal = globalThis as unknown as {
      readonly innerHeight: number;
      readonly document: { readonly documentElement: { readonly scrollHeight: number } };
    };
    return Math.max(
      0,
      browserGlobal.document.documentElement.scrollHeight - browserGlobal.innerHeight,
    );
  });
}

async function readDeviceSavedJson(page: Page) {
  return page.evaluate<string>(`
    new Promise((resolve, reject) => {
      const open = indexedDB.open("auto-clp", 1);
      open.onerror = () => reject(new Error("failed to open the synthetic device slot"));
      open.onsuccess = () => {
        const database = open.result;
        const transaction = database.transaction("projects", "readonly");
        const request = transaction.objectStore("projects").get("current-project");
        request.onerror = () => reject(new Error("failed to read the synthetic device slot"));
        request.onsuccess = () => {
          database.close();
          if (typeof request.result !== "string") {
            reject(new Error("the synthetic device slot did not contain JSON"));
            return;
          }
          resolve(request.result);
        };
      };
    })
  `);
}

async function selectedAnnotationGeometry(page: Page) {
  const annotation = page.locator(".viewport__dimension-annotations");
  return Promise.all(
    (["X", "Y", "Z"] as const).map(async (axis) => {
      const group = annotation.locator(`g[data-axis="${axis}"]`);
      const line = group.locator("line:not(.viewport__dimension-witness)");
      return {
        axis,
        line: {
          x1: await line.getAttribute("x1"),
          y1: await line.getAttribute("y1"),
          x2: await line.getAttribute("x2"),
          y2: await line.getAttribute("y2"),
        },
        labelBounds: await group.locator("text").boundingBox(),
      };
    }),
  );
}

function expectSameAnnotationGeometry(
  actual: Awaited<ReturnType<typeof selectedAnnotationGeometry>>,
  expected: Awaited<ReturnType<typeof selectedAnnotationGeometry>>,
) {
  expect(actual).toHaveLength(expected.length);
  for (const [index, actualAxis] of actual.entries()) {
    const expectedAxis = expected[index]!;
    expect(actualAxis.axis).toBe(expectedAxis.axis);
    for (const coordinate of ["x1", "y1", "x2", "y2"] as const) {
      expect(
        Math.abs(Number(actualAxis.line[coordinate]) - Number(expectedAxis.line[coordinate])),
      ).toBeLessThanOrEqual(0.01);
    }
    expect(actualAxis.labelBounds).not.toBeNull();
    expect(expectedAxis.labelBounds).not.toBeNull();
    for (const coordinate of ["x", "y", "width", "height"] as const) {
      expect(
        Math.abs(
          actualAxis.labelBounds![coordinate] - expectedAxis.labelBounds![coordinate],
        ),
      ).toBeLessThanOrEqual(0.1);
    }
  }
}

async function openPersistenceDrawer(page: Page) {
  const entry = page.getByRole("button", { name: "CLPデータを開く" });
  await openDrawerFromMenu(page);
  await expect(entry).toHaveAttribute("aria-expanded", "true");
  await expect(page.getByRole("button", { name: "CLPデータを閉じる" })).toBeFocused();
}

async function openOperationGuide(page: Page) {
  await openPersistenceDrawer(page);
  await page.getByRole("button", { name: "操作方法", exact: true }).click();
  await expect(page.getByRole("dialog", { name: "保存・再読込" })).toHaveCount(0);
  const dialog = page.getByRole("dialog", { name: "操作方法" });
  await expect(dialog).toBeVisible();
  return dialog;
}

async function expectModalFocusCycle(page: Page) {
  const drawer = page.getByRole("dialog", { name: "保存・再読込" });
  const close = page.getByRole("button", { name: "CLPデータを閉じる" });
  const fileInput = drawer.locator("input[type='file']");
  await expect(drawer).toHaveAttribute("aria-modal", "true");
  await close.focus();
  await page.keyboard.press("Shift+Tab");
  await expect(fileInput).toBeFocused();
  await page.keyboard.press("Tab");
  await expect(close).toBeFocused();
}

async function addCargo(page: Page, name: string) {
  await addCargoFromDrawer(page, name);
}

async function addContainer(page: Page, name: string) {
  await addContainerFromDrawer(page, name, {
    lengthMm: "1000",
    widthMm: "1000",
    heightMm: "1000",
    payloadKg: "1000",
  });
}

test("keeps the navigation drawer initially closed and restores focus while safely cancelling deletion", async ({
  page,
}) => {
  await page.goto("/");
  const entry = page.getByRole("button", { name: "CLPデータを開く" });
  const drawer = page.getByRole("dialog", { name: "保存・再読込" });
  const undo = page.getByRole("button", { name: "元に戻す" });
  const historySummary = page.locator(".project-history__summary");

  await expect(entry).toHaveAttribute("aria-controls", "project-persistence-drawer");
  await expect(entry).toHaveAttribute("aria-expanded", "false");
  await expect(drawer).toHaveCount(0);
  await expect(page.getByRole("button", { name: "端末へ保存" })).toHaveCount(0);

  await saveProjectName(page, "Drawer非ロックCLP");
  await expect(undo).toBeEnabled();
  await scrollPageTo(page, 300);
  await undo.scrollIntoViewIfNeeded();
  const scrollBeforeBackdrop = await pageScrollTop(page);
  const historyBeforeBackdrop = await historySummary.textContent();
  const undoBounds = await undo.boundingBox();
  if (undoBounds === null) throw new Error("Undo button has no bounding box");
  await openPersistenceDrawer(page);
  await expect(drawer).toBeVisible();
  await expectModalFocusCycle(page);
  await expect(undo).toBeDisabled();
  const historyBeforeModalInput = await historySummary.textContent();
  await page.keyboard.press("Control+z");
  expect(await historySummary.textContent()).toBe(historyBeforeModalInput);
  expect(
    await page.evaluate(({ x, y }) => {
      const browserGlobal = globalThis as unknown as {
        document: {
          elementFromPoint(clientX: number, clientY: number): {
            classList: { contains(value: string): boolean };
          } | null;
        };
      };
      return browserGlobal.document
        .elementFromPoint(x, y)
        ?.classList.contains("project-persistence__backdrop");
    }, {
        x: undoBounds.x + undoBounds.width / 2,
        y: undoBounds.y + undoBounds.height / 2,
      }),
  ).toBe(true);
  await page.mouse.click(
    undoBounds.x + undoBounds.width / 2,
    undoBounds.y + undoBounds.height / 2,
  );
  await expect(drawer).toHaveCount(0);
  await expect(undo).toBeEnabled();
  await expect(entry).toBeFocused();
  await expect(entry).toHaveAttribute("aria-expanded", "false");
  await expect(historySummary).toHaveText(historyBeforeBackdrop ?? "");
  await expect.poll(() => pageScrollTop(page)).toBe(scrollBeforeBackdrop);

  await openPersistenceDrawer(page);
  await page.getByRole("button", { name: "新規CLP", exact: true }).click();
  await expect(page.getByRole("button", { name: "破棄して新規CLPを作成" })).toBeFocused();
  await page.locator(".project-persistence__backdrop").click({ position: { x: 8, y: 8 } });
  await expect(drawer).toHaveCount(0);
  await expect(page.getByRole("dialog", { name: "CLP設定" })).toHaveCount(0);
  await expect(entry).toBeFocused();

  await openPersistenceDrawer(page);
  await page.getByRole("button", { name: "端末保存を削除" }).click();
  await expect(page.getByRole("button", { name: "端末保存の削除を確定" })).toBeFocused();
  await page.locator(".project-persistence__backdrop").click({ position: { x: 8, y: 8 } });
  await expect(entry).toBeFocused();
  await expect(drawer).toHaveCount(0);
  await expect(page.getByRole("alert")).toHaveCount(0);
  await expect(page.locator(".project-persistence__snackbar")).toHaveText(
    "端末保存の削除をキャンセルしました。",
  );
  await expect(undo).toBeEnabled();

  await openPersistenceDrawer(page);
  await page.getByRole("button", { name: "端末保存を削除" }).click();
  await page.keyboard.press("Escape");
  await expect(entry).toBeFocused();
  await expect(page.getByRole("alert")).toHaveCount(0);
  await expect(undo).toBeEnabled();
});

test("keeps future automatic proposal UI and worker out of the current product suite", async ({
  page,
}) => {
  await page.addInitScript(() => {
    const browserGlobal = globalThis as unknown as {
      Worker: new (scriptURL: unknown, options?: unknown) => object;
      __automaticProposalWorkerCount: () => number;
    };
    const NativeWorker = browserGlobal.Worker;
    let automaticProposalWorkerCount = 0;
    browserGlobal.Worker = class TrackingWorker extends NativeWorker {
      constructor(scriptURL: unknown, options?: unknown) {
        if (String(scriptURL).includes("automatic-proposal.worker")) {
          automaticProposalWorkerCount += 1;
        }
        super(scriptURL, options);
      }
    };
    browserGlobal.__automaticProposalWorkerCount = () => automaticProposalWorkerCount;
  });
  await page.goto("/");

  await expect(page.locator(".automatic-proposal")).toHaveCount(0);
  await expect(page.getByRole("heading", { name: "自動配置提案" })).toHaveCount(0);
  await expect(page.getByRole("button", { name: "自動提案を開始" })).toHaveCount(0);
  await expect(page.getByRole("button", { name: "配置案を適用" })).toHaveCount(0);
  expect(await page.evaluate(() =>
    (globalThis as unknown as { __automaticProposalWorkerCount: () => number })
      .__automaticProposalWorkerCount(),
  )).toBe(0);

  await expect(page.getByRole("button", { name: "積荷を追加", exact: true })).toHaveCount(0);
  await expect(page.getByRole("button", { name: "候補を追加", exact: true })).toHaveCount(0);
  await openPersistenceDrawer(page);
  const drawer = page.locator("#project-persistence-drawer");
  await expect(drawer.getByRole("button", { name: "積荷を追加", exact: true })).toHaveCount(1);
  await expect(drawer.getByRole("button", { name: "候補を追加", exact: true })).toHaveCount(1);
  await expect(drawer.locator(".automatic-proposal")).toHaveCount(0);
});

test("opens the operation guide without changing CLP, history, or scene and restores focus and scroll", async ({
  page,
}) => {
  await page.setViewportSize({ width: 900, height: 620 });
  await page.goto("/");
  await saveProjectName(page, "操作ガイド状態保持CLP");
  await addCargo(page, "操作ガイド状態保持積荷");
  await addContainer(page, "操作ガイド状態保持候補");
  await page.getByLabel("操作する積荷").selectOption("cargo-1");

  await openPersistenceDrawer(page);
  await page.getByRole("button", { name: "端末へ保存" }).click();
  await expect(page.locator(".project-persistence__status")).toHaveText(
    "現在のCLPをこの端末へ保存しました。",
  );
  await page.getByRole("button", { name: "CLPデータを閉じる" }).click();
  const savedJsonBefore = await readDeviceSavedJson(page);
  expect(JSON.parse(savedJsonBefore)).toMatchObject({
    name: "操作ガイド状態保持CLP",
    cargoes: [{ name: "操作ガイド状態保持積荷" }],
    containers: [{ name: "操作ガイド状態保持候補" }],
  });

  const annotation = page.locator(".viewport__dimension-annotations");
  const defaultAnnotationGeometry = await selectedAnnotationGeometry(page);
  await page.getByRole("button", { name: "拡大" }).click();
  await page.getByRole("button", { name: "拡大" }).click();
  await expect
    .poll(() => selectedAnnotationGeometry(page))
    .not.toEqual(defaultAnnotationGeometry);
  const zoomedAnnotationGeometry = await selectedAnnotationGeometry(page);

  const lamp = page.locator("#physical-validation-lamp");
  await expect(lamp).toHaveAttribute("data-status", "valid");
  const physicalBefore = {
    status: await lamp.getAttribute("data-status"),
    ariaLabel: await lamp.getAttribute("aria-label"),
  };
  await lamp.click();
  const physicalDialog = page.getByRole("dialog", { name: "物理判定" });
  await expect(physicalDialog).toBeVisible();
  const physicalSummaryBefore = await physicalDialog
    .locator(".physical-validation__summary")
    .textContent();
  await page.getByRole("button", { name: "物理判定を閉じる" }).click();

  const operationGuideScrollTarget = Math.min(600, await maxPageScrollTop(page));
  expect(operationGuideScrollTarget).toBeGreaterThan(0);
  await scrollPageTo(page, operationGuideScrollTarget);
  await expect.poll(() => pageScrollTop(page)).toBe(operationGuideScrollTarget);

  const menu = page.locator("#app-navigation-button");
  const canonical = page.getByTestId("canonical-project-settings");
  const history = page.locator(".project-history__summary");
  const selector = page.getByLabel("操作する積荷");
  const undo = page.getByRole("button", { name: "元に戻す" });
  const redo = page.getByRole("button", { name: "やり直す" });
  await expect(undo).toBeEnabled();
  await expect(redo).toBeDisabled();
  const stateBefore = {
    canonical: await canonical.textContent(),
    history: await history.textContent(),
    selectedCargo: await selector.inputValue(),
    annotation: await annotation.textContent(),
    scrollY: await pageScrollTop(page),
  };

  const dialog = await openOperationGuide(page);
  await expect(dialog).toHaveAttribute("aria-modal", "true");
  await expect(page.locator(".app-shell")).toHaveAttribute("inert", "");
  await expect(page.locator("html")).toHaveClass(/modal-active/);
  await expect(undo).toBeDisabled();
  await expect(redo).toBeDisabled();
  expectSameAnnotationGeometry(
    await selectedAnnotationGeometry(page),
    zoomedAnnotationGeometry,
  );
  const close = dialog.getByRole("button", { name: "操作方法を閉じる" });
  await expect(close).toBeFocused();
  for (const copy of [
    "3D上の積荷をクリックするか、画面下部の積荷選択から操作対象を選びます。",
    "積荷以外の3D領域を左ドラッグします。",
    "積荷以外の3D領域をShift＋左ドラッグ、または右ドラッグします。",
    "ホイールはページをスクロールします。",
    "立方体のボタンで荷室全体を表示します。",
    "積荷を左ドラッグして移動できます。",
    "X／Zボタンは90°回転し、天地無用の積荷はX軸回転できません。",
    "Undo／Redoボタンを使います。",
    "ランプから物理判定の詳細を開けます。",
    "座標調整、積荷情報の編集、荷室からの取り外し",
    "タッチ操作では積荷選択とページスクロールを行えます。",
    "正確な配置や編集には、画面下部のボタンとダイアログを使用してください。",
  ]) {
    await expect(dialog).toContainText(copy);
  }

  await page.keyboard.press("Tab");
  await expect(close).toBeFocused();
  await page.keyboard.press("Shift+Tab");
  await expect(close).toBeFocused();
  await page.keyboard.press("Control+z");
  await expect(canonical).toHaveText(stateBefore.canonical ?? "");
  await expect(history).toHaveText("入力または3D操作を完了すると、履歴操作を利用できます。");
  await expect(selector).toHaveValue(stateBefore.selectedCargo);
  await expect(annotation).toHaveText(stateBefore.annotation ?? "");

  await page.keyboard.press("Escape");
  await expect(dialog).toHaveCount(0);
  await expect(menu).toBeFocused();
  await expect(page.locator(".app-shell")).not.toHaveAttribute("inert", "");
  await expect(page.locator("html")).not.toHaveClass(/modal-active/);
  await expect(history).toHaveText(stateBefore.history ?? "");
  await expect.poll(() => pageScrollTop(page)).toBe(stateBefore.scrollY);
  expectSameAnnotationGeometry(
    await selectedAnnotationGeometry(page),
    zoomedAnnotationGeometry,
  );
  await expect(lamp).toHaveAttribute("data-status", physicalBefore.status ?? "");
  await expect(lamp).toHaveAttribute("aria-label", physicalBefore.ariaLabel ?? "");

  const reopened = await openOperationGuide(page);
  await reopened.getByRole("button", { name: "操作方法を閉じる" }).click();
  await expect(reopened).toHaveCount(0);
  await expect(menu).toBeFocused();
  await expect(canonical).toHaveText(stateBefore.canonical ?? "");
  await expect(history).toHaveText(stateBefore.history ?? "");
  await expect(selector).toHaveValue(stateBefore.selectedCargo);
  await expect(annotation).toHaveText(stateBefore.annotation ?? "");
  await expect.poll(() => pageScrollTop(page)).toBe(stateBefore.scrollY);

  const backdropDialog = await openOperationGuide(page);
  await page.locator(".modal-backdrop").click({ position: { x: 4, y: 4 } });
  await expect(backdropDialog).toHaveCount(0);
  await expect(menu).toBeFocused();
  await expect.poll(() => pageScrollTop(page)).toBe(stateBefore.scrollY);
  expectSameAnnotationGeometry(
    await selectedAnnotationGeometry(page),
    zoomedAnnotationGeometry,
  );

  await lamp.click();
  await expect(physicalDialog).toBeVisible();
  await expect(physicalDialog.locator(".physical-validation__summary")).toHaveText(
    physicalSummaryBefore ?? "",
  );
  await page.getByRole("button", { name: "物理判定を閉じる" }).click();
  expect(await readDeviceSavedJson(page)).toBe(savedJsonBefore);
});

for (const width of [305, 320, 375] as const) {
  test(`keeps the operation guide inside a ${width}px viewport with internal vertical scrolling`, async ({
    page,
  }) => {
    const height = 420;
    await page.setViewportSize({ width, height });
    await page.goto("/");
    const dialog = await openOperationGuide(page);
    const shell = dialog.locator(".modal-shell__body");
    const bounds = await dialog.boundingBox();
    expect(bounds).not.toBeNull();
    expect(bounds!.x).toBeGreaterThanOrEqual(0);
    expect(bounds!.y).toBeGreaterThanOrEqual(0);
    expect(bounds!.x + bounds!.width).toBeLessThanOrEqual(width + 0.5);
    expect(bounds!.y + bounds!.height).toBeLessThanOrEqual(height + 0.5);
    expect(
      await shell.evaluate((element) => ({
        hasVerticalOverflow: element.scrollHeight > element.clientHeight,
        hasHorizontalOverflow: element.scrollWidth > element.clientWidth,
      })),
    ).toEqual({ hasVerticalOverflow: true, hasHorizontalOverflow: false });
    await shell.evaluate((element) => element.scrollTo(0, element.scrollHeight));
    await expect.poll(() => shell.evaluate((element) => element.scrollTop)).toBeGreaterThan(0);
    await expectNoHorizontalOverflow(page);
  });
}

test("creates a fresh CLP across the unsaved barrier and restores focus without stale confirmation", async ({
  page,
}) => {
  await page.goto("/");
  const projectButton = page.locator("#current-project-settings-button");
  const undo = page.getByRole("button", { name: "元に戻す" });

  await openPersistenceDrawer(page);
  await page.getByRole("button", { name: "CLP設定" }).click();
  await expect(page.getByRole("dialog", { name: "CLP設定" })).toBeVisible();
  await page.getByRole("button", { name: "CLP設定を閉じる" }).click();
  await expect(projectButton).toBeFocused();

  await saveProjectName(page, "未保存の旧CLP");
  await expect(undo).toBeEnabled();
  await openPersistenceDrawer(page);
  const newProject = page.locator("#project-persistence-drawer").getByRole("button", { name: "新規CLP", exact: true });
  await newProject.click();
  const confirm = page.getByRole("button", { name: "破棄して新規CLPを作成" });
  await expect(confirm).toBeFocused();
  await page.getByRole("button", { name: "現在のCLPへ戻る" }).click();
  await expect(newProject).toBeFocused();

  await newProject.click();
  await confirm.click();
  await expect(page.getByRole("dialog", { name: "CLP設定" })).toBeVisible();
  await expect(page.getByLabel("CLP名")).toHaveValue("新規CLP");
  await page.getByRole("button", { name: "CLP設定を閉じる" }).click();
  await expect(projectButton).toBeFocused();
  await expect(undo).toBeDisabled();

  await openPersistenceDrawer(page);
  await expect(page.getByRole("button", { name: "破棄して新規CLPを作成" })).toHaveCount(0);
  await expect(newProject).toBeEnabled();
  const downloadPromise = page.waitForEvent("download");
  await page.getByRole("button", { name: "JSONを書き出す" }).click();
  const exported = JSON.parse(await downloadText(await downloadPromise)) as { projectId: string };
  expect(exported.projectId).toMatch(/^project-[0-9a-f-]{36}$/);
  expect(exported.projectId).not.toBe("project-1");
});

test("announces persistence outside the drawer, refreshes repeated copy, and applies notification lifetimes", async ({
  page,
}) => {
  await page.goto("/");
  await openPersistenceDrawer(page);
  const drawer = page.getByRole("dialog", { name: "保存・再読込" });
  const snackbar = page.locator(".project-persistence__snackbar");
  const save = page.getByRole("button", { name: "端末へ保存" });

  await save.click();
  await page.getByRole("button", { name: "CLPデータを閉じる" }).click();
  await expect(drawer).toHaveCount(0);
  await expect(snackbar).toHaveText("現在のCLPをこの端末へ保存しました。");
  await expect(snackbar).toHaveAttribute("role", "status");
  await expect(snackbar).toHaveAttribute("aria-live", "polite");
  await expect(snackbar).toHaveAttribute("aria-atomic", "true");
  const firstNotificationId = await snackbar.getAttribute("data-notification-id");

  await openPersistenceDrawer(page);
  await expect(page.locator(".project-persistence__status")).toHaveText(
    "現在のCLPをこの端末へ保存しました。",
  );
  await expect(page.locator(".project-persistence__status")).not.toHaveAttribute(
    "aria-live",
    "polite",
  );
  await save.click();
  await expect(snackbar).toHaveCount(0);
  await page.getByRole("button", { name: "CLPデータを閉じる" }).click();
  await expect(snackbar).toHaveText("現在のCLPをこの端末へ保存しました。");
  await expect
    .poll(() => snackbar.getAttribute("data-notification-id"))
    .not.toBe(firstNotificationId);
  await expect(snackbar).toHaveCount(0, { timeout: 7_000 });

  await openPersistenceDrawer(page);
  await page.evaluate(() => {
    const browserGlobal = globalThis as unknown as {
      readonly Object: ObjectConstructor;
      readonly indexedDB: object;
    };
    browserGlobal.Object.defineProperty(browserGlobal.indexedDB, "open", {
      configurable: true,
      value: () => {
        throw new Error("synthetic-persistent-snackbar-failure");
      },
    });
  });
  await save.click();
  await expect(snackbar).toHaveCount(0);
  await page.getByRole("button", { name: "CLPデータを閉じる" }).click();
  await expect(snackbar).toContainText("端末内保存領域を開けませんでした");
  await page.waitForTimeout(6_100);
  await expect(snackbar).toContainText("端末内保存領域を開けませんでした");
  await snackbar.getByRole("button", { name: "保存通知を閉じる" }).click();
  await expect(snackbar).toHaveCount(0);
});

test("keeps focus and global shortcuts inside the modal while a file preflight is pending", async ({
  page,
}) => {
  await installControlledPreflightWorker(page);
  await page.goto("/");
  const undo = page.getByRole("button", { name: "元に戻す" });
  const historySummary = page.locator(".project-history__summary");

  await saveProjectName(page, "focus trap A");
  await saveProjectName(page, "focus trap B");
  await undo.click();
  await expect(page.getByTestId("canonical-project-settings")).toContainText(
    "focus trap A",
  );

  await openPersistenceDrawer(page);
  const drawer = page.getByRole("dialog", { name: "保存・再読込" });
  const close = page.getByRole("button", { name: "CLPデータを閉じる" });
  const entry = page.getByRole("button", { name: "CLPデータを開く" });
  const fileInput = drawer.locator("input[type='file']");
  await fileInput.focus();
  await fileInput.setInputFiles({
    name: "focus-pending.json",
    mimeType: "application/json",
    buffer: Buffer.from(JSON.stringify(projectJson("focus pending import"))),
  });
  await expectControlledPreflightPending(page);
  await expect(close).toBeFocused();
  await expect
    .poll(() =>
      drawer.evaluate((element) => element.contains(element.ownerDocument.activeElement)),
    )
    .toBe(true);

  await page.keyboard.press("Tab");
  await expect(close).toBeFocused();
  await page.keyboard.press("Shift+Tab");
  await expect(close).toBeFocused();
  await entry.focus();
  await expect(close).toBeFocused();

  const historyWhilePending = await historySummary.textContent();
  for (const shortcut of [
    { key: "z", ctrlKey: true, metaKey: false },
    { key: "y", ctrlKey: true, metaKey: false },
    { key: "z", ctrlKey: false, metaKey: true },
    { key: "y", ctrlKey: false, metaKey: true },
  ]) {
    await page.evaluate((keyboard) => {
      const browserGlobal = globalThis as unknown as {
        readonly KeyboardEvent: new (
          type: string,
          init: Record<string, unknown>,
        ) => unknown;
        readonly document: {
          readonly body: { dispatchEvent: (event: unknown) => boolean };
        };
      };
      browserGlobal.document.body.dispatchEvent(
        new browserGlobal.KeyboardEvent("keydown", {
          bubbles: true,
          cancelable: true,
          ...keyboard,
        }),
      );
    }, shortcut);
    expect(await historySummary.textContent()).toBe(historyWhilePending);
  }

  await page.evaluate(() => {
    const browserGlobal = globalThis as unknown as {
      readonly KeyboardEvent: new (
        type: string,
        init: Record<string, unknown>,
      ) => unknown;
      readonly document: {
        readonly body: { dispatchEvent: (event: unknown) => boolean };
      };
    };
    browserGlobal.document.body.dispatchEvent(
      new browserGlobal.KeyboardEvent("keydown", {
        bubbles: true,
        cancelable: true,
        key: "Escape",
      }),
    );
  });
  await expect(entry).toBeFocused();
  await expect(drawer).toHaveCount(0);
  await expect(page.locator(".project-persistence__snackbar")).toContainText(
    "処理中です",
  );

  await releaseControlledPreflight(page);
  await expect(page.locator(".project-persistence__snackbar")).toContainText(
    "CLP JSONを読み込みました",
  );
  await expect(page.getByTestId("canonical-project-settings")).toContainText(
    "focus pending import",
  );
});

test("round-trips the single IndexedDB slot across reload, resets history, and deletes explicitly", async ({
  page,
}) => {
  await page.goto("/");
  const persistenceStatus = page.locator(".project-persistence__status");
  const historySummary = page.locator(".project-history__summary");
  const canonical = page.getByTestId("canonical-project-settings");

  await saveProjectName(page, "匿名端末保存A");
  await expect(historySummary).toContainText("次に元に戻せる操作: CLP設定の更新。");
  const beforeSaveHistory = await historySummary.textContent();

  await openPersistenceDrawer(page);
  await expect(persistenceStatus).not.toHaveAttribute("aria-live", "polite");
  await expect(persistenceStatus).not.toHaveAttribute("aria-atomic", "true");
  await page.getByRole("button", { name: "端末へ保存" }).click();
  await expect(persistenceStatus).toHaveText("現在のCLPをこの端末へ保存しました。");
  await page.getByRole("button", { name: "CLPデータを閉じる" }).click();
  await expect(page.getByRole("button", { name: "元に戻す" })).toBeEnabled();
  expect(await historySummary.textContent()).toBe(beforeSaveHistory);

  await saveProjectName(page, "画面だけの変更");
  await expect(canonical).toContainText("画面だけの変更");
  await openPersistenceDrawer(page);
  await page.getByRole("button", { name: "端末保存を読込" }).click();
  await expect(persistenceStatus).toContainText("端末内保存を読み込みました");
  await expect(canonical).toContainText("匿名端末保存A");
  await expect(page.getByRole("button", { name: "元に戻す" })).toBeDisabled();
  await expect(page.getByRole("button", { name: "やり直す" })).toBeDisabled();

  await page.getByRole("button", { name: "CLPデータを閉じる" }).click();
  await openCargoAddEditor(page);
  await page.getByLabel("積荷名").fill("再読込で破棄するdraft");
  await expect(page.locator(".app-shell")).toHaveAttribute("inert", "");
  await page.reload();
  await openPersistenceDrawer(page);
  await expect(page.getByLabel("積荷名")).toHaveCount(0);
  await expect(canonical).toContainText("新規CLP");
  await page.getByRole("button", { name: "端末保存を読込" }).click();
  await expect(canonical).toContainText("匿名端末保存A");

  await page.getByRole("button", { name: "端末保存を削除" }).click();
  await expect(page.getByRole("button", { name: "端末保存の削除を確定" })).toBeVisible();
  await page.getByRole("button", { name: "削除をやめる" }).click();
  await expect(persistenceStatus).toHaveText("端末保存の削除をキャンセルしました。");
  await page.getByRole("button", { name: "端末保存を削除" }).click();
  const deleteConfirm = page.getByRole("button", { name: "端末保存の削除を確定" });
  await expect(deleteConfirm).toBeFocused();
  await deleteConfirm.click();
  await expect(persistenceStatus).toHaveText("端末内の保存コピーを削除しました。");
  await expect(page.getByRole("button", { name: "端末保存を削除" })).toBeFocused();
  await page.reload();
  await openPersistenceDrawer(page);
  await page.getByRole("button", { name: "端末保存を読込" }).click();
  await expect(persistenceStatus).toHaveText("読込できる端末内保存はありません。");
});

test("normalizes a legacy one-orientation import so floor rotation remains available", async ({
  page,
}) => {
  await page.goto("/");
  await openPersistenceDrawer(page);
  await importJson(page, projectJson("旧向き方針", {
    cargoes: [{
      id: "cargo-legacy",
      name: "旧1向き積荷",
      dimensionsMm: { lengthMm: 200, widthMm: 180, heightMm: 150 },
      massGrams: 1000,
      canSupportCargo: false,
      allowedOrientations: ["LWH"],
    }],
    containers: [{
      id: "container-legacy",
      name: "旧向き候補",
      internalDimensionsMm: { lengthMm: 1000, widthMm: 800, heightMm: 800 },
      openingMm: { widthMm: 800, heightMm: 800 },
      payloadCapacityGrams: 10000,
    }],
  }));
  await expect(page.locator(".project-persistence__status")).toContainText(
    "CLP JSONを読み込みました",
  );
  await page.getByRole("button", { name: "CLPデータを閉じる" }).click();
  await page.getByLabel("操作する積荷").selectOption("cargo-legacy");

  await expect(page.getByRole("button", { name: "X軸を中心に90°回転" })).toHaveAttribute(
    "aria-disabled",
    "true",
  );
  await expect(page.getByRole("button", { name: "Z軸を中心に90°回転" })).not.toHaveAttribute(
    "aria-disabled",
    "true",
  );
  await page.getByRole("button", { name: "積荷情報を編集" }).click();
  await expect(page.getByLabel(/天地無用/)).toBeChecked();
  await expect(page.getByLabel(/^LWH/)).toHaveCount(0);
});

test("downloads the fixed JSON contract and reimports it without history or derived state", async ({
  page,
}) => {
  await page.goto("/");
  await saveProjectName(page, "匿名downloadCLP");
  await addCargo(page, "匿名download積荷");
  await addContainer(page, "匿名download候補");
  await page.getByLabel("操作する積荷").selectOption("cargo-1");
  await page.getByRole("button", { name: "座標を入力して配置" }).click();
  await page.getByLabel("X最小角").fill("-1");
  await page.getByRole("button", { name: "配置を保存" }).click();
  await expect(page.locator("#physical-validation-lamp")).toHaveAttribute("data-status", "invalid");
  const historyBeforeExport = await page.locator(".project-history__summary").textContent();

  await openPersistenceDrawer(page);
  const downloadPromise = page.waitForEvent("download");
  await page.getByRole("button", { name: "JSONを書き出す" }).click();
  const download = await downloadPromise;
  expect(download.suggestedFilename()).toBe(exportFilename);
  const text = await downloadText(download);
  const exported = JSON.parse(text) as Record<string, unknown>;
  expect(Object.keys(exported).sort()).toEqual([
    "cargoes",
    "clearancesMm",
    "containers",
    "name",
    "placements",
    "projectId",
    "schemaVersion",
  ]);
  expect(text).not.toContain("history");
  expect(text).not.toContain("camera");
  expect(text).not.toContain("validation");
  await page.getByRole("button", { name: "CLPデータを閉じる" }).click();
  await expect(page.getByRole("button", { name: "元に戻す" })).toBeEnabled();
  expect(await page.locator(".project-history__summary").textContent()).toBe(
    historyBeforeExport,
  );

  await saveProjectName(page, "import前の別CLP");
  await openPersistenceDrawer(page);
  await importJson(page, text, "private-looking-filename.json");
  const persistenceStatus = page.locator(".project-persistence__status");
  await expect(persistenceStatus).toContainText("CLP JSONを読み込みました");
  await expect(persistenceStatus).not.toContainText("private-looking-filename");
  await expect(page.getByTestId("canonical-project-settings")).toContainText(
    "匿名downloadCLP",
  );
  await expect(page.locator("#physical-validation-lamp")).toHaveAttribute("data-status", "invalid");
  await expect(page.getByRole("button", { name: "元に戻す" })).toBeDisabled();
});

test("rejects every JSON failure stage without reflecting filename or values", async ({
  page,
}) => {
  await page.goto("/");
  await saveProjectName(page, "保持する匿名CLP");
  await openPersistenceDrawer(page);
  const canonical = page.getByTestId("canonical-project-settings");
  const status = page.locator(".project-persistence__status");
  const sensitive = "private-looking-value";

  await page.locator("input[type='file']").setInputFiles({
    name: `${sensitive}.json`,
    mimeType: "application/json",
    buffer: Buffer.alloc(5_242_881, 0x20),
  });
  await expect(status).toContainText("5 MiBの上限を超えるため拒否しました");

  const cases: ReadonlyArray<readonly [unknown, string]> = [
    [`{${sensitive}`, "JSONの形式が正しくないため拒否しました"],
    [
      { ...projectJson(sensitive), schemaVersion: "9.9.9" },
      "対応していないCLPデータ版のため拒否しました",
    ],
    [
      { ...projectJson(sensitive), extra: sensitive },
      "CLPデータの構造または値域が契約に適合しないため拒否しました",
    ],
    [
      projectJson(sensitive, {
        cargoes: [
          {
            id: "cargo-1",
            name: "匿名積荷A",
            dimensionsMm: { lengthMm: 1, widthMm: 1, heightMm: 1 },
            massGrams: 1,
            canSupportCargo: false,
            allowedOrientations: ["LWH"],
          },
          {
            id: "cargo-1",
            name: "匿名積荷B",
            dimensionsMm: { lengthMm: 1, widthMm: 1, heightMm: 1 },
            massGrams: 1,
            canSupportCargo: false,
            allowedOrientations: ["LWH"],
          },
        ],
      }),
      "CLPデータのID、参照、向き、開口、または重量整合性を確認できないため拒否しました",
    ],
  ];
  for (const [value, copy] of cases) {
    await importJson(page, value, `${sensitive}.json`);
    await expect(status).toContainText(copy);
    await expect(status).not.toContainText(sensitive);
    await expect(canonical).toContainText("保持する匿名CLP");
  }
});

test("reports File read failure without changing or reflecting the current Project", async ({
  page,
}) => {
  await page.addInitScript(() => {
    const browserGlobal = globalThis as unknown as {
      readonly File: { readonly prototype: object };
      readonly Promise: PromiseConstructor;
      readonly Object: ObjectConstructor;
    };
    browserGlobal.Object.defineProperty(browserGlobal.File.prototype, "text", {
      configurable: true,
      value: () => browserGlobal.Promise.reject(new Error("private-looking-read")),
    });
  });
  await page.goto("/");
  await saveProjectName(page, "読取失敗でも保持");
  await openPersistenceDrawer(page);

  await importJson(page, projectJson("読まれないCLP"), "private-looking-read.json");

  const status = page.locator(".project-persistence__status");
  await expect(status).toContainText("データを読み取れませんでした");
  await expect(status).not.toContainText("private-looking-read");
  await expect(page.getByTestId("canonical-project-settings")).toContainText(
    "読取失敗でも保持",
  );
});

test("serializes a delayed import against project settings and replaces from its exact base", async ({
  page,
}) => {
  await installControlledPreflightWorker(page);
  await page.goto("/");
  await openPersistenceDrawer(page);

  const canonical = page.getByTestId("canonical-project-settings");
  const historySummary = page.locator(".project-history__summary");
  const status = page.locator(".project-persistence__status");

  await importJson(page, projectJson("遅延importCLP"));
  await expect(status).toContainText("処理中です");
  await expectControlledPreflightPending(page);
  await expect(page.getByRole("button", { name: "元に戻す" })).toBeDisabled();
  await page.getByRole("button", { name: "CLPデータを閉じる" }).click();
  await expect(page.getByRole("button", { name: "CLPデータを開く" })).toBeFocused();
  await expect(page.locator(".project-persistence__snackbar")).toContainText(
    "処理中です",
  );
  await expect(page.locator("#current-project-settings-button")).toBeDisabled();

  await releaseControlledPreflight(page);
  await expect(status).toContainText("CLP JSONを読み込みました");
  await expect(page.locator(".project-persistence__snackbar")).toContainText(
    "CLP JSONを読み込みました",
  );
  await expect(canonical).toContainText("遅延importCLP");
  await expect(page.getByRole("button", { name: "元に戻す" })).toBeDisabled();
  await expect(historySummary).toContainText("取り消し・やり直しできるCLP操作はありません");
});

test("blocks editor transitions while a delayed device replacement completes", async ({
  page,
}) => {
  await installControlledPreflightWorker(page);
  await page.goto("/");
  const canonical = page.getByTestId("canonical-project-settings");
  const status = page.locator(".project-persistence__status");

  await saveProjectName(page, "端末保存元");
  await openPersistenceDrawer(page);
  await page.getByRole("button", { name: "端末へ保存" }).click();
  await expect(status).toHaveText("現在のCLPをこの端末へ保存しました。");
  await page.getByRole("button", { name: "CLPデータを閉じる" }).click();
  await saveProjectName(page, "現在保持するCLP");
  await expect(page.getByRole("button", { name: "元に戻す" })).toBeEnabled();
  await openPersistenceDrawer(page);
  await page.getByRole("button", { name: "端末保存を読込" }).click();
  await expect(status).toContainText("処理中です");
  await expectControlledPreflightPending(page);
  await page.getByRole("button", { name: "CLPデータを閉じる" }).click();
  await openPersistenceDrawer(page);
  const pendingDrawer = page.locator("#project-persistence-drawer");
  await expect(pendingDrawer.getByRole("button", { name: "積荷を追加", exact: true })).toBeDisabled();
  await expect(pendingDrawer.getByRole("button", { name: "候補を追加", exact: true })).toBeDisabled();

  await releaseControlledPreflight(page);
  await expect(status).toContainText("端末内保存を読み込みました");
  await expect(canonical).toContainText("端末保存元");
  await openPersistenceDrawer(page);
  await page.getByRole("button", { name: "端末保存を読込" }).click();
  await expect(status).toContainText("処理中です");
  await expectControlledPreflightPending(page);
  await releaseControlledPreflight(page);
  await expect(status).toContainText("端末内保存を読み込みました");
  await expect(canonical).toContainText("端末保存元");
});

test("rejects a corrupt actual IndexedDB record without changing the current Project", async ({
  page,
}) => {
  await page.goto("/");
  await saveProjectName(page, "壊れた保存でも保持");
  await page.evaluate(async () => {
    const browserGlobal = globalThis as unknown as {
      readonly Promise: PromiseConstructor;
      readonly indexedDB: {
        open(name: string, version: number): {
          onerror: (() => void) | null;
          onsuccess: (() => void) | null;
          onupgradeneeded: (() => void) | null;
          result: {
            close(): void;
            createObjectStore(name: string): void;
            objectStoreNames: { contains(name: string): boolean };
            transaction(name: string, mode: "readwrite"): {
              onabort: (() => void) | null;
              oncomplete: (() => void) | null;
              onerror: (() => void) | null;
              objectStore(name: string): { put(value: unknown, key: string): void };
            };
          };
        };
      };
    };
    await new browserGlobal.Promise<void>((resolve, reject) => {
      const open = browserGlobal.indexedDB.open("auto-clp", 1);
      open.onupgradeneeded = () => {
        if (!open.result.objectStoreNames.contains("projects")) {
          open.result.createObjectStore("projects");
        }
      };
      open.onerror = () => reject(new Error("open failed"));
      open.onsuccess = () => {
        const transaction = open.result.transaction("projects", "readwrite");
        transaction.objectStore("projects").put(
          { privateLookingValue: "must-not-reflect" },
          "current-project",
        );
        transaction.onerror = () => reject(new Error("put failed"));
        transaction.onabort = () => reject(new Error("put aborted"));
        transaction.oncomplete = () => {
          open.result.close();
          resolve();
        };
      };
    });
  });

  await openPersistenceDrawer(page);
  await page.getByRole("button", { name: "端末保存を読込" }).click();
  const status = page.locator(".project-persistence__status");
  await expect(status).toContainText("端末内保存の形式を安全に読み取れないため拒否しました");
  await expect(status).not.toContainText("privateLookingValue");
  await expect(page.getByTestId("canonical-project-settings")).toContainText(
    "壊れた保存でも保持",
  );
});

test("locks persistence for drafts and delete confirmations and preserves keyboard access", async ({
  page,
}) => {
  await page.goto("/");
  const save = page.getByRole("button", { name: "端末へ保存" });
  const load = page.getByRole("button", { name: "端末保存を読込" });
  const status = page.locator(".project-persistence__status");

  await openProjectSettings(page);
  await page.getByLabel("CLP名").fill("未保存draft");
  await expect(page.getByRole("button", { name: /ナビゲーションメニューを開く/ })).toBeDisabled();
  await expect(save).toHaveCount(0);
  await expect(load).toHaveCount(0);
  await page.getByLabel("CLP名").fill("新規CLP");
  await page.getByRole("button", { name: "CLP設定を閉じる" }).click();
  await openPersistenceDrawer(page);

  const deleteButton = page.getByRole("button", { name: "端末保存を削除" });
  await deleteButton.click();
  await expect(save).toBeDisabled();
  await expect(page.getByRole("button", { name: "元に戻す" })).toBeDisabled();
  const confirm = page.getByRole("button", { name: "端末保存の削除を確定" });
  await expect(confirm).toBeFocused();
  const cancel = page.getByRole("button", { name: "削除をやめる" });
  await cancel.focus();
  await page.keyboard.press("Enter");
  await expect(status).toHaveText("端末保存の削除をキャンセルしました。");
  await expect(deleteButton).toBeFocused();
  await expect(save).toBeEnabled();

  await save.focus();
  await page.keyboard.press("Enter");
  await expect(status).toHaveText("現在のCLPをこの端末へ保存しました。");

  await deleteButton.click();
  await expect(confirm).toBeFocused();
  await page.evaluate(() => {
    const browserGlobal = globalThis as unknown as {
      readonly Object: ObjectConstructor;
      readonly indexedDB: object;
    };
    browserGlobal.Object.defineProperty(browserGlobal.indexedDB, "open", {
      configurable: true,
      value: () => {
        throw new Error("synthetic-open-failure");
      },
    });
  });
  await confirm.click();
  await expect(status).toHaveText(
    "端末内保存領域を開けませんでした。現在のCLPは変更していません。",
  );
  await expect(deleteButton).toBeFocused();
});

test("keeps persistence controls within 305, 320, and 375 pixel viewports", async ({
  page,
}) => {
  const widths = [305, 320, 375] as const;
  await page.setViewportSize({ width: widths[0], height: 900 });
  await page.goto("/");
  await expect(page.getByRole("heading", { name: "保存・再読込" })).toHaveCount(0);
  const drawer = page.getByRole("dialog", { name: "保存・再読込" });
  for (const width of widths) {
    await page.setViewportSize({ width, height: 900 });
    await openPersistenceDrawer(page);
    await expect(drawer).toBeVisible();
    const drawerBounds = await drawer.boundingBox();
    expect(drawerBounds?.width).toBeLessThanOrEqual(width);
    expect(drawerBounds?.height).toBeLessThanOrEqual(900);
    await expectModalFocusCycle(page);
    await expectNoHorizontalOverflow(page);
    await page.getByRole("button", { name: "CLPデータを閉じる" }).click();
  }

  await page.setViewportSize({ width: 320, height: 900 });
  await openPersistenceDrawer(page);
  await page.getByRole("button", { name: "端末保存を削除" }).click();
  const confirmationBounds = await drawer.boundingBox();
  expect(confirmationBounds?.width).toBeLessThanOrEqual(320);
  expect(confirmationBounds?.height).toBeLessThanOrEqual(900);
  await expectNoHorizontalOverflow(page);
});

test("runs a 1000-placement, 100-candidate preflight off the main thread", async ({
  page,
}) => {
  await page.goto("/");
  const workerUrl = new URL(
    "/src/workers/project-import-preflight.worker.ts",
    runtimeBaseUrl,
  ).href;
  const large = projectJson("匿名large-preflight", {
    cargoes: Array.from({ length: 1000 }, (_, index) => ({
      id: `cargo-${index + 1}`,
      name: `匿名積荷${index + 1}`,
      dimensionsMm: { lengthMm: 10, widthMm: 10, heightMm: 10 },
      massGrams: 1,
      canSupportCargo: false,
      allowedOrientations: ["LWH"],
    })),
    containers: Array.from({ length: 100 }, (_, index) => ({
      id: `container-${index + 1}`,
      name: `匿名候補${index + 1}`,
      internalDimensionsMm: { lengthMm: 1000, widthMm: 1000, heightMm: 1000 },
      openingMm: { widthMm: 1000, heightMm: 1000 },
      payloadCapacityGrams: 1000,
    })),
    placements: Array.from({ length: 1000 }, (_, index) => ({
      cargoId: `cargo-${index + 1}`,
      containerId: `container-${Math.floor(index / 10) + 1}`,
      positionMm: { xMm: (index % 10) * 20, yMm: 0, zMm: 0 },
      orientation: "LWH",
    })),
  });

  const result = await page.evaluate(async ({ input, workerUrl: workerUrlValue }) => {
    const browserGlobal = globalThis as unknown as {
      readonly Date: DateConstructor;
      readonly Promise: PromiseConstructor;
      readonly URL: typeof URL;
      readonly Worker: new (url: URL, options: { type: "module" }) => {
        onmessage: ((event: { data: unknown }) => void) | null;
        postMessage(value: unknown): void;
        terminate(): void;
      };
      clearInterval(id: number): void;
      setInterval(callback: () => void, delay: number): number;
    };
    let ticks = 0;
    const timer = browserGlobal.setInterval(() => {
      ticks += 1;
    }, 0);
    const started = browserGlobal.Date.now();
    const worker = new browserGlobal.Worker(
      new browserGlobal.URL(workerUrlValue),
      { type: "module" },
    );
    const response = await new browserGlobal.Promise<unknown>((resolve) => {
      worker.onmessage = (event) => resolve(event.data);
      worker.postMessage({
        type: "project-import-preflight",
        requestId: 91,
        project: input,
      });
    });
    worker.terminate();
    browserGlobal.clearInterval(timer);
    return { elapsedMs: browserGlobal.Date.now() - started, response, ticks };
  }, { input: large, workerUrl });

  expect(result.response).toEqual({
    type: "project-import-preflight-ready",
    requestId: 91,
  });
  expect(result.ticks).toBeGreaterThan(0);
  expect(result.elapsedMs).toBeGreaterThanOrEqual(0);
});

test("keeps 1000-cargo search and selection usable without narrow horizontal overflow", async ({
  page,
}) => {
  await page.setViewportSize({ width: 305, height: 900 });
  await page.goto("/");
  const largeCargoOnly = projectJson("1,000積荷CLP", {
    cargoes: Array.from({ length: 1000 }, (_, index) => ({
      id: `cargo-${index + 1}`,
      name: `積荷${index + 1}`,
      dimensionsMm: { lengthMm: 10, widthMm: 10, heightMm: 10 },
      massGrams: 1,
      canSupportCargo: false,
      allowedOrientations: ["LWH", "WLH"],
    })),
    containers: Array.from({ length: 100 }, (_, index) => ({
      id: `container-${index + 1}`,
      name: `候補${index + 1}`,
      internalDimensionsMm: { lengthMm: 1000, widthMm: 1000, heightMm: 1000 },
      openingMm: { widthMm: 1000, heightMm: 1000 },
      payloadCapacityGrams: 1000,
    })),
  });
  await openPersistenceDrawer(page);
  await importJson(page, largeCargoOnly);
  await expect(page.locator(".project-persistence__status")).toContainText("CLP JSONを読み込みました");
  const drawer = page.locator("#project-persistence-drawer");
  await expect(drawer.getByRole("button", { name: "積荷を追加", exact: true })).toBeDisabled();
  await expect(drawer.getByRole("button", { name: "候補を追加", exact: true })).toBeDisabled();
  await page.getByRole("button", { name: "CLPデータを閉じる" }).click();

  const viewport = await page.locator(".viewport").boundingBox();
  const search = page.getByLabel("積荷を検索");
  const select = page.getByLabel("操作する積荷");
  if (viewport === null) throw new Error("3D viewport is missing");
  for (const control of [search, select]) {
    const bounds = await control.boundingBox();
    if (bounds === null) throw new Error("Cargo overlay control is missing");
    expect(bounds.x).toBeGreaterThanOrEqual(viewport.x);
    expect(bounds.x + bounds.width).toBeLessThanOrEqual(viewport.x + viewport.width);
  }
  await expect(page.getByText("1000/1000件")).toBeVisible();
  await expectNoHorizontalOverflow(page);
  await search.fill("積荷1000");
  await expect(page.getByText("1/1000件")).toBeVisible();
  await expect(select.locator("option")).toHaveCount(2);
  await select.selectOption("cargo-1000");
  await expect(page.locator(".viewport-context-actions")).toContainText("積荷1000");
});
