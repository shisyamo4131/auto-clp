import { expect, test, type Download, type Page } from "./fixtures";
import { weightBalanceProject } from "./fixtures";
import {
  openPersistenceDrawer,
} from "./ui-helpers";

const csvHeader = "name,length_mm,width_mm,height_mm,weight_kg";

async function downloadBytes(download: Download): Promise<Buffer> {
  const stream = await download.createReadStream();
  const chunks: Buffer[] = [];
  for await (const chunk of stream) {
    chunks.push(Buffer.isBuffer(chunk) ? chunk : Buffer.from(chunk));
  }
  return Buffer.concat(chunks);
}

async function importProject(page: Page, project: unknown): Promise<void> {
  await openPersistenceDrawer(page);
  await page.locator("#project-json-file-input").setInputFiles({
    name: "anonymous-project.json",
    mimeType: "application/json",
    buffer: Buffer.from(JSON.stringify(project)),
  });
  await expect(page.locator(".project-persistence__status")).toContainText(
    "CLP JSONを読み込みました",
  );
  await page.getByRole("button", { name: "CLPデータを閉じる" }).click();
}

async function chooseCsv(page: Page, contents: Buffer | string): Promise<void> {
  await openPersistenceDrawer(page);
  await page.locator("#cargo-csv-file-input").setInputFiles({
    name: "anonymous-cargo.csv",
    mimeType: "text/csv",
    buffer: typeof contents === "string" ? Buffer.from(contents) : contents,
  });
}

function csvFixture(): Buffer {
  return Buffer.from(
    `\uFEFF${csvHeader}\r\n匿名荷A,100,200,300,1.001\r\n"同名, ""引用""",400,500,600,2\r\n"同名, ""引用""",700,800,900,3.125\r\n`,
  );
}

function csvHistorySessionProject() {
  return {
    schemaVersion: "0.1.0",
    projectId: "cargo-csv-history-session",
    name: "匿名履歴セッションCLP",
    clearancesMm: { xMm: 0, yMm: 0, zMm: 0 },
    cargoes: [
      {
        id: "cargo-1",
        name: "置換前匿名荷",
        dimensionsMm: { lengthMm: 100, widthMm: 200, heightMm: 300 },
        massGrams: 1_000,
        canSupportCargo: true,
        allowedOrientations: ["LWH", "WLH", "LHW", "HLW", "WHL", "HWL"],
      },
    ],
    containers: [
      {
        id: "container-1",
        name: "匿名コンテナ1",
        internalDimensionsMm: { lengthMm: 3000, widthMm: 2000, heightMm: 2000 },
        openingMm: { widthMm: 2000, heightMm: 2000 },
        payloadCapacityGrams: 100_000,
      },
      {
        id: "container-2",
        name: "匿名コンテナ2",
        internalDimensionsMm: { lengthMm: 3000, widthMm: 2000, heightMm: 2000 },
        openingMm: { widthMm: 2000, heightMm: 2000 },
        payloadCapacityGrams: 100_000,
      },
    ],
    placements: [],
  };
}

async function selectedWitnessGeometry(page: Page) {
  const witnesses = page.locator(".viewport__dimension-witness");
  await expect(witnesses).toHaveCount(6);
  return witnesses.evaluateAll((lines) =>
    lines.map((line) => [
      line.getAttribute("x1"),
      line.getAttribute("y1"),
      line.getAttribute("x2"),
      line.getAttribute("y2"),
    ]),
  );
}

test("downloads exact template bytes and atomically replaces cargoes with one undo/redo", async ({
  page,
}) => {
  await page.goto("/");
  await importProject(page, weightBalanceProject());
  await page.getByLabel("操作する積荷").selectOption("cargo-a");
  await expect(page.locator('.viewport__weight-balance[data-state="available"]')).toBeVisible();

  await openPersistenceDrawer(page);
  const downloadPromise = page.waitForEvent("download");
  await page.locator("#cargo-csv-template-download").click();
  const download = await downloadPromise;
  expect(download.suggestedFilename()).toBe("auto-clp-cargo-template.csv");
  expect(await downloadBytes(download)).toEqual(
    Buffer.concat([Buffer.from([0xef, 0xbb, 0xbf]), Buffer.from(`${csvHeader}\r\n`)]),
  );

  await page.locator("#cargo-csv-file-input").setInputFiles({
    name: "anonymous-cargo.csv",
    mimeType: "text/csv",
    buffer: csvFixture(),
  });
  const dialog = page.getByRole("dialog", { name: "CSVで積荷を一括登録" });
  await expect(dialog).toContainText(
    "新規積荷3件を一括登録します。既存の積荷と配置情報は破棄されます。",
  );
  await expect(dialog).toContainText(
    "CLP名、隙間、コンテナは保持します。端末保存は自動更新しません。",
  );
  await dialog.getByRole("button", { name: "置換をやめる" }).click();
  await expect(page.getByLabel("操作する積荷")).toHaveValue("cargo-a");
  await expect(page.locator('.viewport__weight-balance[data-state="available"]')).toBeVisible();

  await chooseCsv(page, csvFixture());
  await page.getByRole("button", { name: "積荷と配置の置換を確定" }).click();
  const picker = page.getByLabel("操作する積荷");
  await expect(picker).toHaveValue("");
  await expect(picker.locator("option")).toHaveCount(4);
  await expect(page.locator('.viewport__weight-balance[data-state="empty"]')).toBeVisible();
  await expect(page.locator(".viewport__weight-balance-marker--cargo")).toHaveCount(0);
  await expect(page.getByRole("tab", { name: /重心確認コンテナ/ })).toBeVisible();

  await page.getByRole("button", { name: "元に戻す" }).click();
  await expect(picker.locator("option")).toHaveCount(3);
  await expect(page.locator('.viewport__weight-balance[data-state="available"]')).toBeVisible();
  await page.getByRole("button", { name: "やり直す" }).click();
  await expect(picker.locator("option")).toHaveCount(4);
  await expect(page.locator('.viewport__weight-balance[data-state="empty"]')).toBeVisible();
});

test("clears same-ID scene session state across CSV undo and redo without resetting container or camera", async ({
  page,
}) => {
  await page.goto("/");
  await importProject(page, csvHistorySessionProject());
  const containerTab = page.getByRole("tab", { name: /ID: container-2/ });
  await containerTab.click();
  const picker = page.getByLabel("操作する積荷");
  await picker.selectOption("cargo-1");
  const unzoomedGeometry = await selectedWitnessGeometry(page);
  await page.getByRole("button", { name: "拡大" }).click();
  await expect.poll(() => selectedWitnessGeometry(page)).not.toEqual(unzoomedGeometry);
  const zoomedDefaultGeometry = await selectedWitnessGeometry(page);

  await chooseCsv(page, `${csvHeader}\r\n置換後匿名荷,100,200,300,1\r\n`);
  await page.getByRole("button", { name: "積荷と配置の置換を確定" }).click();
  await expect(picker).toHaveValue("");
  await expect(containerTab).toHaveAttribute("aria-selected", "true");
  await picker.selectOption("cargo-1");
  expect(await selectedWitnessGeometry(page)).toEqual(zoomedDefaultGeometry);

  const context = page.locator(".viewport-context-actions");
  const status = page.locator("#scene-workspace-action-status");
  await page.getByRole("button", { name: "Z軸を中心に90°回転" }).click();
  await expect(context).toContainText("X奥行 200 mm、Y横幅 100 mm、Z高さ 300 mm");
  await expect(status).toContainText("作業スペースでZ軸中心に90°回転");

  await page.getByRole("button", { name: "元に戻す" }).click();
  await expect(picker).toHaveValue("");
  await expect(status).toHaveText("");
  await expect(containerTab).toHaveAttribute("aria-selected", "true");
  await picker.selectOption("cargo-1");
  await expect(context).toContainText("X奥行 100 mm、Y横幅 200 mm、Z高さ 300 mm");
  expect(await selectedWitnessGeometry(page)).toEqual(zoomedDefaultGeometry);

  await page.getByRole("button", { name: "Z軸を中心に90°回転" }).click();
  await expect(status).toContainText("作業スペースでZ軸中心に90°回転");
  await page.getByRole("button", { name: "やり直す" }).click();
  await expect(picker).toHaveValue("");
  await expect(status).toHaveText("");
  await expect(containerTab).toHaveAttribute("aria-selected", "true");
  await picker.selectOption("cargo-1");
  await expect(context).toContainText("X奥行 100 mm、Y横幅 200 mm、Z高さ 300 mm");
  expect(await selectedWitnessGeometry(page)).toEqual(zoomedDefaultGeometry);
});

test("rejects invalid bytes without leaking filename or content and preserves derived state", async ({
  page,
}) => {
  await page.goto("/");
  await importProject(page, weightBalanceProject());
  const yellowStyle = await page.locator(".viewport__weight-balance-marker--cargo").getAttribute("style");

  await chooseCsv(page, Buffer.from([0xc3, 0x28]));
  const dialog = page.getByRole("dialog", { name: "CSVで積荷を一括登録" });
  await expect(dialog).toContainText("cargo-csv.utf8 /file");
  await expect(dialog).not.toContainText("anonymous-cargo.csv");
  await expect(dialog).not.toContainText("�");
  await dialog.getByRole("button", { name: "閉じる", exact: true }).click();
  await expect(page.getByLabel("操作する積荷").locator("option")).toHaveCount(3);
  await expect(page.locator(".viewport__weight-balance-marker--cargo")).toHaveAttribute(
    "style",
    yellowStyle ?? "",
  );
  await expect(page.getByRole("button", { name: "元に戻す" })).toBeDisabled();
});

test("uses manual defaults and blocks only new cargo creation at 30 or legacy counts", async ({
  page,
}) => {
  await page.goto("/");
  const cargoes = Array.from({ length: 29 }, (_, index) => ({
    id: `cargo-${index + 1}`,
    name: `匿名荷${index + 1}`,
    dimensionsMm: { lengthMm: 10, widthMm: 10, heightMm: 10 },
    massGrams: 1,
    canSupportCargo: false,
    allowedOrientations: ["LWH", "WLH"],
  }));
  await importProject(page, {
    schemaVersion: "0.1.0",
    projectId: "cargo-limit-browser",
    name: "匿名上限CLP",
    clearancesMm: { xMm: 0, yMm: 0, zMm: 0 },
    cargoes,
    containers: [],
    placements: [],
  });

  await openPersistenceDrawer(page);
  await page.getByRole("button", { name: "積荷を追加", exact: true }).click();
  await expect(page.getByLabel(/天地無用/)).not.toBeChecked();
  await expect(
    page.getByLabel("この積荷の上面で別の積荷を幾何学的に支持できる"),
  ).toBeChecked();
  await page.getByLabel("積荷名").fill("匿名荷30");
  await page.getByLabel("長さ", { exact: true }).fill("1");
  await page.getByLabel("幅", { exact: true }).fill("1");
  await page.getByLabel("高さ", { exact: true }).fill("1");
  await page.getByLabel("重量").fill("0.001");
  await page.getByRole("button", { name: "積荷を保存" }).click();
  await openPersistenceDrawer(page);
  await expect(page.getByRole("button", { name: "積荷を追加", exact: true })).toBeDisabled();
  await expect(page.getByText(/30 \/ 30件/)).toBeVisible();

  await importProject(page, {
    schemaVersion: "0.1.0",
    projectId: "legacy-cargo-count-browser",
    name: "匿名既存上限超過CLP",
    clearancesMm: { xMm: 0, yMm: 0, zMm: 0 },
    cargoes: [
      ...cargoes,
      {
        ...cargoes[0],
        id: "cargo-30",
        name: "匿名荷30",
      },
      {
        ...cargoes[0],
        id: "cargo-31",
        name: "匿名荷31",
      },
    ],
    containers: [],
    placements: [],
  });
  await expect(page.getByLabel("操作する積荷").locator("option")).toHaveCount(32);
  await openPersistenceDrawer(page);
  await expect(page.getByRole("button", { name: "積荷を追加", exact: true })).toBeDisabled();
  await expect(page.getByText("既存データは31件。編集・削除・書出しは継続できます", { exact: false }))
    .toBeVisible();
});

test("keeps confirmation modal focus, busy isolation, narrow layout, and WebGL stop contract", async ({
  page,
}) => {
  await page.setViewportSize({ width: 305, height: 700 });
  await page.goto("/");
  const canvasBefore = await page.locator("#scene-viewport-canvas").boundingBox();
  await chooseCsv(page, `${csvHeader}\n匿名荷,1,2,3,1`);
  const dialog = page.getByRole("dialog", { name: "CSVで積荷を一括登録" });
  await expect(page.locator(".app-shell")).toHaveAttribute("inert", "");
  await expect(page.locator("#cargo-csv-confirm")).toBeFocused();
  const canvasDuring = await page.locator("#scene-viewport-canvas").boundingBox();
  expect(canvasDuring).toEqual(canvasBefore);
  for (const width of [305, 320, 375]) {
    await page.setViewportSize({ width, height: 700 });
    expect(
      await page.evaluate(() => {
        const browserGlobal = globalThis as unknown as {
          document: {
            documentElement: { scrollWidth: number; clientWidth: number };
          };
        };
        return (
          browserGlobal.document.documentElement.scrollWidth >
          browserGlobal.document.documentElement.clientWidth
        );
      }),
    ).toBe(false);
  }
  await page.keyboard.press("Control+Z");
  await page.keyboard.press("Escape");
  await expect(dialog).toHaveCount(0);
  await expect(page.locator("#app-navigation-button")).toBeFocused();
  await expect(page.getByLabel("操作する積荷")).toHaveCount(0);

  await page.goto("/?forceWebgl2=unsupported");
  await expect(page.getByText("CSVテンプレートを取得")).toHaveCount(0);
  await expect(page.getByText("CSVで積荷を一括登録")).toHaveCount(0);
});
