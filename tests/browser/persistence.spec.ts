import { expect, test, type Download, type Page } from "@playwright/test";

const exportFilename = "auto-clp-project-0.1.0.json";

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
  await page.getByLabel("内部長さ").fill("1000");
  await page.getByLabel("内部幅").fill("1000");
  await page.getByLabel("内部高さ").fill("1000");
  await page.getByLabel("開口幅").fill("1000");
  await page.getByLabel("開口高さ").fill("1000");
  await page.getByLabel("総耐荷重").fill("1000");
  await page.getByRole("button", { name: "候補を保存" }).click();
}

test("round-trips the single IndexedDB slot across reload, resets history, and deletes explicitly", async ({
  page,
}) => {
  await page.goto("/?forceWebgl2=unsupported");
  const persistenceStatus = page.locator(".project-persistence__status");
  const historySummary = page.locator(".project-history__summary");
  const canonical = page.getByTestId("canonical-project-settings");

  await expect(persistenceStatus).toHaveAttribute("aria-live", "polite");
  await expect(persistenceStatus).toHaveAttribute("aria-atomic", "true");
  await page.getByLabel("案件名").fill("匿名端末保存A");
  await page.getByRole("button", { name: "案件を保存" }).click();
  await expect(historySummary).toContainText("次に元に戻せる操作: 案件設定の更新。");
  const beforeSaveHistory = await historySummary.textContent();

  await page.getByRole("button", { name: "端末へ保存" }).click();
  await expect(persistenceStatus).toHaveText("現在の案件をこの端末へ保存しました。");
  expect(await historySummary.textContent()).toBe(beforeSaveHistory);

  await page.getByLabel("案件名").fill("画面だけの変更");
  await page.getByRole("button", { name: "案件を保存" }).click();
  await expect(canonical).toContainText("画面だけの変更");
  await page.getByRole("button", { name: "端末保存を読込" }).click();
  await expect(persistenceStatus).toContainText("端末内保存を読み込みました");
  await expect(canonical).toContainText("匿名端末保存A");
  await expect(page.getByRole("button", { name: "元に戻す" })).toBeDisabled();
  await expect(page.getByRole("button", { name: "やり直す" })).toBeDisabled();

  await page.getByRole("button", { name: "積荷を追加" }).click();
  await page.getByLabel("積荷名").fill("再読込で破棄するdraft");
  await expect(page.getByRole("button", { name: "端末保存を読込" })).toBeDisabled();
  await page.reload();
  await expect(page.getByLabel("積荷名")).toHaveCount(0);
  await expect(canonical).toContainText("新規案件");
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
  await page.getByRole("button", { name: "端末保存を読込" }).click();
  await expect(persistenceStatus).toHaveText("読込できる端末内保存はありません。");
});

test("downloads the fixed JSON contract and reimports it without history or derived state", async ({
  page,
}) => {
  await page.goto("/?forceWebgl2=unsupported");
  await page.getByLabel("案件名").fill("匿名download案件");
  await page.getByRole("button", { name: "案件を保存" }).click();
  await addCargo(page, "匿名download積荷");
  await addContainer(page, "匿名download候補");
  const panel = page.locator(".placement-panel");
  await panel.getByRole("button", { name: "配置を追加: 匿名download積荷" }).click();
  await page.getByLabel("X最小角").fill("-1");
  await panel.getByRole("button", { name: "配置を保存" }).click();
  await expect(page.locator(".physical-validation__summary")).toContainText("不適合：");
  const historyBeforeExport = await page.locator(".project-history__summary").textContent();

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
  expect(await page.locator(".project-history__summary").textContent()).toBe(
    historyBeforeExport,
  );

  await page.getByLabel("案件名").fill("import前の別案件");
  await page.getByRole("button", { name: "案件を保存" }).click();
  await importJson(page, text, "private-looking-filename.json");
  const persistenceStatus = page.locator(".project-persistence__status");
  await expect(persistenceStatus).toContainText("案件JSONを読み込みました");
  await expect(persistenceStatus).not.toContainText("private-looking-filename");
  await expect(page.getByTestId("canonical-project-settings")).toContainText(
    "匿名download案件",
  );
  await expect(page.locator(".physical-validation__summary")).toContainText("不適合：");
  await expect(page.getByRole("button", { name: "元に戻す" })).toBeDisabled();
});

test("rejects every JSON failure stage without reflecting filename or values", async ({
  page,
}) => {
  await page.goto("/?forceWebgl2=unsupported");
  await page.getByLabel("案件名").fill("保持する匿名案件");
  await page.getByRole("button", { name: "案件を保存" }).click();
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
      "対応していない案件データ版のため拒否しました",
    ],
    [
      { ...projectJson(sensitive), extra: sensitive },
      "案件データの構造または値域が契約に適合しないため拒否しました",
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
      "案件データのID、参照、向き、開口、または重量整合性を確認できないため拒否しました",
    ],
  ];
  for (const [value, copy] of cases) {
    await importJson(page, value, `${sensitive}.json`);
    await expect(status).toContainText(copy);
    await expect(status).not.toContainText(sensitive);
    await expect(canonical).toContainText("保持する匿名案件");
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
  await page.goto("/?forceWebgl2=unsupported");
  await page.getByLabel("案件名").fill("読取失敗でも保持");
  await page.getByRole("button", { name: "案件を保存" }).click();

  await importJson(page, projectJson("読まれない案件"), "private-looking-read.json");

  const status = page.locator(".project-persistence__status");
  await expect(status).toContainText("データを読み取れませんでした");
  await expect(status).not.toContainText("private-looking-read");
  await expect(page.getByTestId("canonical-project-settings")).toContainText(
    "読取失敗でも保持",
  );
});

test("rejects a delayed import and concurrent Project commit while preserving the exact base and draft", async ({
  page,
}) => {
  await installControlledPreflightWorker(page);
  await page.goto("/?forceWebgl2=unsupported");

  const canonical = page.getByTestId("canonical-project-settings");
  const historySummary = page.locator(".project-history__summary");
  const historyBefore = await historySummary.textContent();
  const status = page.locator(".project-persistence__status");

  await importJson(page, projectJson("遅延import案件"));
  await expect(status).toContainText("処理中です");
  await expectControlledPreflightPending(page);
  await expect(page.getByRole("button", { name: "元に戻す" })).toBeDisabled();
  await page.getByLabel("案件名").fill("未保存の並行draft");
  await page.getByRole("button", { name: "案件を保存" }).click();
  const settingsStatus = page
    .getByRole("heading", { name: "案件と隙間" })
    .locator("..")
    .locator(".action-status");
  await expect(settingsStatus).toHaveText(
    "案件が更新されたため保存できませんでした。入力内容を確認して再度保存してください。",
  );

  await releaseControlledPreflight(page);
  await expect(status).toContainText("操作中に案件が更新されたため");
  await expect(canonical).toContainText("新規案件");
  await expect(canonical).not.toContainText("遅延import案件");
  await expect(page.getByLabel("案件名")).toHaveValue("未保存の並行draft");
  await expect(page.getByRole("button", { name: "元に戻す" })).toBeDisabled();
  await page.getByLabel("案件名").fill("新規案件");
  expect(await historySummary.textContent()).toBe(historyBefore);
});

test("rejects delayed device replacement after a cancelled editor transition and preserves the stored slot", async ({
  page,
}) => {
  await installControlledPreflightWorker(page);
  await page.goto("/?forceWebgl2=unsupported");
  const canonical = page.getByTestId("canonical-project-settings");
  const status = page.locator(".project-persistence__status");
  const historySummary = page.locator(".project-history__summary");

  await page.getByLabel("案件名").fill("端末保存元");
  await page.getByRole("button", { name: "案件を保存" }).click();
  await page.getByRole("button", { name: "端末へ保存" }).click();
  await expect(status).toHaveText("現在の案件をこの端末へ保存しました。");
  await page.getByLabel("案件名").fill("現在保持する案件");
  await page.getByRole("button", { name: "案件を保存" }).click();
  await expect(page.getByRole("button", { name: "元に戻す" })).toBeEnabled();
  const historyBefore = await historySummary.textContent();

  await page.getByRole("button", { name: "端末保存を読込" }).click();
  await expect(status).toContainText("処理中です");
  await expectControlledPreflightPending(page);
  await page.getByRole("button", { name: "積荷を追加" }).click();
  await page.getByLabel("積荷名").fill("取消す一時draft");
  await page.getByRole("button", { name: "積荷編集をキャンセル" }).click();
  await expect(page.getByText("取消す一時draft")).toHaveCount(0);

  await releaseControlledPreflight(page);
  await expect(status).toContainText("操作中に案件が更新されたため");
  await expect(canonical).toContainText("現在保持する案件");
  expect(await historySummary.textContent()).toBe(historyBefore);
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
  await page.goto("/?forceWebgl2=unsupported");
  await page.getByLabel("案件名").fill("壊れた保存でも保持");
  await page.getByRole("button", { name: "案件を保存" }).click();
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
  await page.goto("/?forceWebgl2=unsupported");
  const save = page.getByRole("button", { name: "端末へ保存" });
  const load = page.getByRole("button", { name: "端末保存を読込" });
  const status = page.locator(".project-persistence__status");

  await page.getByLabel("案件名").fill("未保存draft");
  await expect(save).toBeDisabled();
  await expect(load).toBeDisabled();
  await page.getByLabel("案件名").fill("新規案件");

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
  await expect(status).toHaveText("現在の案件をこの端末へ保存しました。");

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
    "端末内保存領域を開けませんでした。現在の案件は変更していません。",
  );
  await expect(deleteButton).toBeFocused();
});

test("keeps persistence controls within 305, 320, and 375 pixel viewports", async ({
  page,
}) => {
  await page.setViewportSize({ width: 305, height: 900 });
  await page.goto("/?forceWebgl2=unsupported");
  await expect(page.getByRole("heading", { name: "保存・再読込" })).toBeVisible();
  await expectNoHorizontalOverflow(page);
  await page.setViewportSize({ width: 320, height: 900 });
  await page.getByRole("button", { name: "端末保存を削除" }).click();
  await expectNoHorizontalOverflow(page);
  await page.setViewportSize({ width: 375, height: 900 });
  await expectNoHorizontalOverflow(page);
});

test("runs a 1000-placement, 100-candidate preflight off the main thread", async ({
  page,
}) => {
  await page.goto("/?forceWebgl2=unsupported");
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

  const result = await page.evaluate(async (input) => {
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
      new browserGlobal.URL(
        "/src/workers/project-import-preflight.worker.ts",
        "http://127.0.0.1:4173/",
      ),
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
  }, large);

  expect(result.response).toEqual({
    type: "project-import-preflight-ready",
    requestId: 91,
  });
  expect(result.ticks).toBeGreaterThan(0);
  expect(result.elapsedMs).toBeGreaterThanOrEqual(0);
});
