import { expect, test, type Page } from "./fixtures";
import { activateContainer, openPersistenceDrawer } from "./ui-helpers";

function cargo(id: string, name: string) {
  return {
    id,
    name,
    dimensionsMm: { lengthMm: 200, widthMm: 100, heightMm: 50 },
    massGrams: 1_250,
    canSupportCargo: true,
    allowedOrientations: ["LWH", "WLH", "LHW", "HLW", "WHL", "HWL"],
  };
}

function reportProject(overlap = false) {
  return {
    schemaVersion: "0.1.0",
    projectId: overlap ? "report-overlap" : "report-available",
    name: "匿名帳票CLP",
    clearancesMm: { xMm: 0, yMm: 0, zMm: 0 },
    cargoes: [
      cargo("cargo-front", "手前の積荷"),
      cargo("cargo-back", "奥の積荷"),
      cargo("cargo-other", "別コンテナの積荷"),
    ],
    containers: [
      {
        id: "container-main",
        name: "帳票対象コンテナ",
        internalDimensionsMm: { lengthMm: 2_000, widthMm: 1_000, heightMm: 1_000 },
        openingMm: { widthMm: 1_000, heightMm: 1_000 },
        payloadCapacityGrams: 100_000,
      },
      {
        id: "container-other",
        name: "別コンテナ",
        internalDimensionsMm: { lengthMm: 1_000, widthMm: 1_000, heightMm: 1_000 },
        openingMm: { widthMm: 1_000, heightMm: 1_000 },
        payloadCapacityGrams: 100_000,
      },
    ],
    placements: [
      {
        cargoId: "cargo-front",
        containerId: "container-main",
        positionMm: { xMm: 0, yMm: 0, zMm: 0 },
        orientation: "WLH",
      },
      {
        cargoId: "cargo-back",
        containerId: "container-main",
        positionMm: { xMm: overlap ? 50 : 300, yMm: 0, zMm: 0 },
        orientation: "LWH",
      },
      {
        cargoId: "cargo-other",
        containerId: "container-other",
        positionMm: { xMm: 100, yMm: 0, zMm: 0 },
        orientation: "LWH",
      },
    ],
  };
}

async function importProject(page: Page, value: unknown) {
  await openPersistenceDrawer(page);
  await page.locator("#project-json-file-input").setInputFiles({
    name: "anonymous-loading-report.json",
    mimeType: "application/json",
    buffer: Buffer.from(JSON.stringify(value)),
  });
  await expect(page.locator(".project-persistence__status")).toContainText(
    "CLP JSONを読み込みました",
  );
  await page.getByRole("button", { name: "CLPデータを閉じる" }).click();
}

async function openReport(page: Page) {
  const opener = page.getByRole("button", { name: "積込順とPDF帳票を確認" });
  await opener.click();
  const dialog = page.getByRole("dialog", { name: "積込順・PDF帳票" });
  await expect(dialog).toBeVisible();
  return { dialog, opener };
}

test("shows the selected container sequence, reasons, notes, and restores focus", async ({ page }) => {
  await page.goto("/");
  await importProject(page, reportProject());

  const { dialog, opener } = await openReport(page);
  await expect(dialog).toContainText("匿名帳票CLP");
  await expect(dialog).toContainText("帳票対象コンテナ");
  await expect(dialog.locator(".loading-report__sequence > ol > li")).toHaveCount(2);
  await expect(dialog.locator(".loading-report__sequence > ol > li").nth(0)).toContainText("奥の積荷");
  await expect(dialog.locator(".loading-report__sequence > ol > li").nth(1)).toContainText("手前の積荷");
  await expect(dialog).toContainText("直線搬入帯の確保");
  await expect(dialog).toContainText("100 × 200 × 50 mm");
  await expect(dialog).toContainText("1.25 kg");
  await expect(dialog).toContainText("現在配置の物理判定");
  await expect(dialog).toContainText("搬送機器、作業空間");
  await expect(dialog.getByRole("button", { name: "PDFを出力" })).toBeDisabled();
  await expect(dialog).toContainText("次のPDF実装フェーズへ渡す内容を確認できます");
  await expect(page.locator(".app-shell")).toHaveAttribute("inert", "");

  await dialog.getByRole("button", { name: "積込順・PDF帳票を閉じる" }).click();
  await expect(opener).toBeFocused();

  await activateContainer(page, "container-other");
  const other = await openReport(page);
  await expect(other.dialog).toContainText("別コンテナ");
  await expect(other.dialog.locator(".loading-report__sequence > ol > li")).toHaveCount(1);
  await expect(other.dialog).toContainText("別コンテナの積荷");
  await expect(other.dialog).not.toContainText("手前の積荷");
});

test("shows a fixed reason and related cargoes when sequence generation is unavailable", async ({ page }) => {
  await page.goto("/");
  await importProject(page, reportProject(true));
  const { dialog } = await openReport(page);

  await expect(dialog).toContainText("積込順を提案できません");
  await expect(dialog).toContainText("積荷同士が立体的に重なっている");
  await expect(dialog).toContainText("手前の積荷（ID: cargo-front）");
  await expect(dialog).toContainText("奥の積荷（ID: cargo-back）");
  await expect(dialog.locator(".loading-report__sequence")).toHaveCount(0);
});

test("generates five numbered views and keeps fixed views independent from the current camera", async ({ page }) => {
  await page.goto("/");
  await importProject(page, reportProject());
  const first = await openReport(page);
  await first.dialog.getByRole("button", { name: "5視点画像を生成" }).click();
  const firstFigures = first.dialog.locator(".loading-report__image-grid figure");
  await expect(firstFigures).toHaveCount(5);
  await expect(first.dialog.getByRole("button", { name: "5視点画像を再生成" })).toBeEnabled();
  for (const figure of await firstFigures.all()) {
    await expect(figure).toHaveAttribute("data-label-count", "2");
  }
  await expect(firstFigures.locator("img")).toHaveCount(5);
  for (const title of ["現在視点", "正面（開口側）", "背面", "左面", "右面"]) {
    await expect(first.dialog.getByText(title, { exact: true })).toBeVisible();
  }
  for (const image of await firstFigures.locator("img").all()) {
    await expect(image).toHaveAttribute("src", /^data:image\/png;base64,/);
    await expect(image).toHaveJSProperty("naturalWidth", 1200);
    await expect(image).toHaveJSProperty("naturalHeight", 800);
  }
  const firstSources = await firstFigures.locator("img").evaluateAll((images) =>
    images.map((image) => image.getAttribute("src")),
  );
  await first.dialog.getByRole("button", { name: "積込順・PDF帳票を閉じる" }).click();

  const canvas = page.locator("#scene-viewport-canvas");
  await canvas.hover();
  await page.mouse.wheel(0, -520);

  const second = await openReport(page);
  await second.dialog.getByRole("button", { name: "5視点画像を生成" }).click();
  const secondFigures = second.dialog.locator(".loading-report__image-grid figure");
  await expect(secondFigures).toHaveCount(5);
  const secondSources = await secondFigures.locator("img").evaluateAll((images) =>
    images.map((image) => image.getAttribute("src")),
  );
  expect(secondSources[0]).not.toBe(firstSources[0]);
  expect(secondSources.slice(1)).toEqual(firstSources.slice(1));
});

test("rejects an incomplete image set after canvas export failure and allows retry", async ({ page }) => {
  await page.addInitScript(`(() => {
    const original = HTMLCanvasElement.prototype.toDataURL;
    globalThis.__failReportImageCapture = true;
    HTMLCanvasElement.prototype.toDataURL = function(...args) {
      if (globalThis.__failReportImageCapture) throw new Error("anonymous capture failure");
      return original.apply(this, args);
    };
  })()`);
  await page.goto("/");
  await importProject(page, reportProject());
  const { dialog } = await openReport(page);
  await dialog.getByRole("button", { name: "5視点画像を生成" }).click();
  await expect(dialog.getByRole("alert")).toContainText("不完全な画像は使用せず");
  await expect(dialog.locator(".loading-report__image-grid")).toHaveCount(0);

  await page.evaluate("globalThis.__failReportImageCapture = false");
  await dialog.getByRole("button", { name: "5視点画像を生成" }).click();
  await expect(dialog.locator(".loading-report__image-grid figure")).toHaveCount(5);
});

for (const width of [305, 320, 375] as const) {
  test(`keeps the loading report usable without horizontal page overflow at ${width}px`, async ({ page }) => {
    await page.setViewportSize({ width, height: 640 });
    await page.goto("/");
    await importProject(page, reportProject());
    const { dialog } = await openReport(page);

    await expect(dialog).toBeVisible();
    const overflow = await page.evaluate<{
      document: number;
      dialog: number;
    }>(`(() => ({
      document: document.documentElement.scrollWidth - document.documentElement.clientWidth,
      dialog: (() => {
        const body = document.querySelector(".modal-shell__body");
        return body === null ? Number.POSITIVE_INFINITY : body.scrollWidth - body.clientWidth;
      })(),
    }))()`);
    expect(overflow.document).toBeLessThanOrEqual(1);
    expect(overflow.dialog).toBeLessThanOrEqual(1);
    await expect(dialog.getByRole("button", { name: "積込順・PDF帳票を閉じる" })).toBeVisible();
  });
}
