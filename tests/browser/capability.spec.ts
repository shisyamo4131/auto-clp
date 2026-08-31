import { expect, test } from "./fixtures";

test("shows a deterministic unsupported WebGL 2 state", async ({ page }) => {
  await page.goto("/?forceWebgl2=unsupported");

  const status = page.locator("[data-capability-state]");
  await expect(status).toHaveAttribute("data-capability-state", "unsupported");
  await expect(page.getByRole("heading", { name: "Auto CLPを利用できません" })).toBeVisible();
  await expect(
    page.getByRole("img", { name: "積荷を選択・床面移動できる3Dプレビュー" }),
  ).toHaveCount(0);
  await expect(page.getByRole("button", { name: "CLPを保存" })).toHaveCount(0);
  await expect(page.getByRole("button", { name: "自動提案を開始" })).toHaveCount(0);
  await expect(page.getByRole("button", { name: "端末へ保存" })).toHaveCount(0);
  await expect(page.getByRole("button", { name: "JSONを読み込む" })).toHaveCount(0);
  await expect(
    page.getByRole("heading", { name: "作業データをファイルへ退避" }),
  ).toBeVisible();
});

test("allows only read-only JSON rescue when WebGL 2 is unavailable", async ({ page }) => {
  await page.setViewportSize({ width: 305, height: 700 });
  await page.goto("/?forceWebgl2=unsupported");

  await expect(page.getByRole("heading", { name: "現在の作業データ" })).toBeVisible();
  await expect(page.getByText("障害直前の内容を含みます。", { exact: false })).toBeVisible();
  await expect(page.getByText("auto-clp-project-0.1.0.json", { exact: true })).toBeVisible();
  await expect(
    page.getByRole("heading", { name: "端末に保存済みのデータ" }),
  ).toBeVisible();
  await expect(page.getByText("その後の未保存の作業は含みません。", { exact: false })).toBeVisible();
  await expect(
    page.getByText("auto-clp-device-rescue-0.1.0.json", { exact: true }),
  ).toBeVisible();

  const currentDownload = page.waitForEvent("download");
  await page.getByRole("button", { name: "現在の作業データをダウンロード" }).click();
  expect((await currentDownload).suggestedFilename()).toBe(
    "auto-clp-project-0.1.0.json",
  );
  await expect(page.locator('[data-rescue-outcome="success"]')).toContainText(
    "ダウンロードを開始しました。",
  );
  await expect(page.locator('[data-rescue-outcome="success"]')).toContainText(
    "auto-clp-project-0.1.0.json",
  );
  await expect(page.locator('[data-rescue-outcome="success"]')).toContainText(
    "ダウンロード一覧またはダウンロードフォルダーを確認してください。",
  );

  const storedJson = JSON.stringify({
    schemaVersion: "0.1.0",
    projectId: "rescue-project",
    name: "端末保存救出fixture",
    clearancesMm: { xMm: 0, yMm: 0, zMm: 0 },
    cargoes: [],
    containers: [],
    placements: [],
  });
  await page.evaluate(async (json) => {
    const browserGlobal = globalThis as unknown as {
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
              oncomplete: (() => void) | null;
              onerror: (() => void) | null;
              objectStore(name: string): { put(value: unknown, key: string): void };
            };
          };
        };
      };
    };
    await new Promise<void>((resolve, reject) => {
      const request = browserGlobal.indexedDB.open("auto-clp", 1);
      request.onupgradeneeded = () => {
        if (!request.result.objectStoreNames.contains("projects")) {
          request.result.createObjectStore("projects");
        }
      };
      request.onerror = () => reject(new Error("IndexedDB open failed"));
      request.onsuccess = () => {
        const database = request.result;
        const transaction = database.transaction("projects", "readwrite");
        transaction.objectStore("projects").put(json, "current-project");
        transaction.oncomplete = () => {
          database.close();
          resolve();
        };
        transaction.onerror = () => reject(new Error("IndexedDB write failed"));
      };
    });
  }, storedJson);

  const deviceDownload = page.waitForEvent("download");
  await page.getByRole("button", { name: "端末保存済みデータをダウンロード" }).click();
  expect((await deviceDownload).suggestedFilename()).toBe(
    "auto-clp-device-rescue-0.1.0.json",
  );
  await expect(page.locator('[data-rescue-outcome="success"]')).toContainText(
    "auto-clp-device-rescue-0.1.0.json",
  );
  const storedAfterRescue = await page.evaluate(async () =>
    new Promise<unknown>((resolve, reject) => {
      const browserGlobal = globalThis as unknown as {
        readonly indexedDB: {
          open(name: string, version: number): {
            onerror: (() => void) | null;
            onsuccess: (() => void) | null;
            result: {
              close(): void;
              transaction(name: string, mode: "readonly"): {
                oncomplete: (() => void) | null;
                objectStore(name: string): {
                  get(key: string): {
                    onerror: (() => void) | null;
                    onsuccess: (() => void) | null;
                    result: unknown;
                  };
                };
              };
            };
          };
        };
      };
      const request = browserGlobal.indexedDB.open("auto-clp", 1);
      request.onerror = () => reject(new Error("IndexedDB reopen failed"));
      request.onsuccess = () => {
        const database = request.result;
        const transaction = database.transaction("projects", "readonly");
        const read = transaction.objectStore("projects").get("current-project");
        read.onsuccess = () => resolve(read.result);
        read.onerror = () => reject(new Error("IndexedDB reread failed"));
        transaction.oncomplete = () => database.close();
      };
    }),
  );
  expect(storedAfterRescue).toBe(storedJson);
  await expect(
    page.getByText("作業データを変更したり、端末保存を上書きしたりすることはありません。", {
      exact: false,
    }),
  ).toBeVisible();
  await expect(page.getByRole("heading", { name: "ダウンロード後の手順" })).toBeVisible();
  await expect(
    page.getByRole("button", { name: "3D表示を再確認して再読み込み" }),
  ).toBeVisible();
  expect(
    await page.evaluate<boolean>(
      "document.documentElement.scrollWidth > document.documentElement.clientWidth",
    ),
  ).toBe(false);
});

test("explains when no device-saved data is available to download", async ({ page }) => {
  await page.goto("/?forceWebgl2=unsupported");

  await page.getByRole("button", { name: "端末保存済みデータをダウンロード" }).click();

  const feedback = page.locator('[data-rescue-outcome="error"]');
  await expect(feedback).toBeVisible();
  await expect(feedback).toContainText("端末に保存済みのデータはありません。");
  await expect(feedback).toContainText("ダウンロードは開始していません。");
});

test("shows the supported preview in the verification browser", async ({ page }) => {
  await page.goto("/");

  await expect(page.getByRole("heading", { level: 1, name: "Auto CLP" })).toBeVisible();
  const status = page.locator("[data-capability-state]");
  await expect(status).toHaveAttribute("data-capability-state", "supported");
  await expect(
    page.getByRole("img", { name: "積荷を選択・床面移動できる3Dプレビュー" }),
  ).toBeVisible();
  await page.getByRole("button", { name: "ナビゲーションメニューを開く" }).click();
  await page.getByRole("button", { name: "使用上の重要事項" }).click();
  await expect(page.getByRole("dialog", { name: "使用上の重要事項" })).toContainText("実積載の安全性");
});

test("does not report supported when the initial render fails", async ({ page }) => {
  await page.goto("/?forceRenderer=initial-render-error");

  const status = page.locator("[data-capability-state]");
  await expect(status).toHaveAttribute("data-capability-state", "renderer-error");
  await expect(page.getByRole("heading", { name: "Auto CLPの操作を停止しました" })).toBeVisible();
  await expect(
    page.getByRole("img", { name: "積荷を選択・床面移動できる3Dプレビュー" }),
  ).toHaveCount(0);
});

test("stops rendering when the WebGL context is lost", async ({ page }) => {
  await page.goto("/");

  const status = page.locator("[data-capability-state]");
  await expect(status).toHaveAttribute("data-capability-state", "supported");
  const preview = page.getByRole("img", {
    name: "積荷を選択・床面移動できる3Dプレビュー",
  });
  await expect(preview).toBeVisible();

  await preview.evaluate((canvas) => {
    canvas.dispatchEvent(new Event("webglcontextlost", { cancelable: true }));
  });

  await expect(status).toHaveAttribute("data-capability-state", "renderer-error");
  await expect(page.getByRole("heading", { name: "Auto CLPの操作を停止しました" })).toBeVisible();
  await expect(preview).toHaveCount(0);
  await expect(
    page.getByRole("button", { name: "現在の作業データをダウンロード" }),
  ).toBeVisible();
});
