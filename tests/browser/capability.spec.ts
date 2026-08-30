import { expect, test } from "@playwright/test";

test("shows a deterministic unsupported WebGL 2 state", async ({ page }) => {
  await page.goto("/?forceWebgl2=unsupported");

  const status = page.locator("[data-capability-state]");
  await expect(status).toHaveAttribute("data-capability-state", "unsupported");
  await expect(page.getByRole("heading", { name: "Auto CLPを利用できません" })).toBeVisible();
  await expect(
    page.getByRole("img", { name: "積荷を選択・床面移動できる3Dプレビュー" }),
  ).toHaveCount(0);
  await expect(page.getByRole("button", { name: "案件を保存" })).toHaveCount(0);
  await expect(page.getByRole("button", { name: "自動提案を開始" })).toHaveCount(0);
  await expect(page.getByRole("button", { name: "端末へ保存" })).toHaveCount(0);
  await expect(page.getByRole("button", { name: "JSONを読み込む" })).toHaveCount(0);
});

test("allows only read-only JSON rescue when WebGL 2 is unavailable", async ({ page }) => {
  await page.setViewportSize({ width: 305, height: 700 });
  await page.goto("/?forceWebgl2=unsupported");

  const currentDownload = page.waitForEvent("download");
  await page.getByRole("button", { name: "現在案件をJSON救出" }).click();
  expect((await currentDownload).suggestedFilename()).toBe(
    "auto-clp-project-0.1.0.json",
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
  await page.getByRole("button", { name: "端末保存をJSON救出" }).click();
  expect((await deviceDownload).suggestedFilename()).toBe(
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
  await expect(page.getByText("案件の読込・編集・削除・端末保存の上書きは行いません。", { exact: false })).toBeVisible();
  expect(
    await page.evaluate<boolean>(
      "document.documentElement.scrollWidth > document.documentElement.clientWidth",
    ),
  ).toBe(false);
});

test("shows the supported preview in the verification browser", async ({ page }) => {
  await page.goto("/");

  await expect(page.getByRole("heading", { level: 1, name: "Auto CLP" })).toBeVisible();
  const status = page.locator("[data-capability-state]");
  await expect(status).toHaveAttribute("data-capability-state", "supported");
  await expect(
    page.getByRole("img", { name: "積荷を選択・床面移動できる3Dプレビュー" }),
  ).toBeVisible();
  await expect(page.getByLabel("現在の制限")).toContainText("安全性");
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
  await expect(page.getByRole("button", { name: "現在案件をJSON救出" })).toBeVisible();
});
