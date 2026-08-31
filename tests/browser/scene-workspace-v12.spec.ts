import { expect, test, type Page } from "./fixtures";
import {
  addCargoFromDrawer,
  addContainerFromDrawer,
  openPersistenceDrawer,
  openPhysicalValidation,
} from "./ui-helpers";

async function addCargo(page: Page, name = "仕様12積荷") {
  await addCargoFromDrawer(page, name, {
    lengthMm: "500",
    widthMm: "400",
    heightMm: "300",
  });
}

async function addContainer(page: Page, name: string) {
  await addContainerFromDrawer(page, name, {
    lengthMm: "6000",
    widthMm: "2400",
    heightMm: "2600",
    openingWidthMm: "2400",
    openingHeightMm: "2500",
    payloadKg: "100000",
  });
}

async function placeCargo(page: Page, xMm = "100") {
  await page.getByLabel("操作する積荷").selectOption("cargo-1");
  await page.getByRole("button", { name: "座標を入力して配置" }).click();
  await page.getByLabel("X最小角").fill(xMm);
  await page.getByLabel("Y最小角").fill("100");
  await page.getByRole("button", { name: "配置を保存" }).click();
}

function hundredCandidateProject() {
  return {
    schemaVersion: "0.1.0",
    projectId: "project-tabs-100",
    name: "匿名100候補CLP",
    clearancesMm: { xMm: 0, yMm: 0, zMm: 0 },
    cargoes: [],
    containers: Array.from({ length: 100 }, (_, index) => ({
      id: `container-${index + 1}`,
      name: `候補${String(index + 1).padStart(3, "0")}-長い表示名`,
      internalDimensionsMm: { lengthMm: 6000 + index, widthMm: 2400, heightMm: 2600 },
      openingMm: { widthMm: 2400, heightMm: 2500 },
      payloadCapacityGrams: 100_000_000,
    })),
    placements: [],
  };
}

async function expectDimensionLabelsInsideCanvas(page: Page) {
  const canvas = page.getByRole("img", {
    name: "積荷を選択・床面移動できる3Dプレビュー",
  });
  const annotation = page.locator(".viewport__dimension-annotations");
  const bottomControls = page.locator(".viewport__overlay--bottom");
  const axes = ["X", "Y", "Z"] as const;
  await expect(annotation).toBeVisible();
  await expect(annotation.locator("g")).toHaveCount(axes.length);
  await expect.poll(async () => {
    const canvasBox = await canvas.boundingBox();
    const svgBox = await annotation.boundingBox();
    const controlsBox = await bottomControls.boundingBox();
    if (canvasBox === null || svgBox === null || controlsBox === null) return false;
    const labelBoxes = await Promise.all(
      axes.map((axis) => annotation.locator(`g[data-axis="${axis}"] text`).boundingBox()),
    );
    return labelBoxes.every((labelBox) => {
      if (labelBox === null) return false;
      const labelRight = labelBox.x + labelBox.width;
      const labelBottom = labelBox.y + labelBox.height;
      const insideCanvas =
        labelBox.x >= canvasBox.x - 0.5 &&
        labelBox.y >= canvasBox.y - 0.5 &&
        labelRight <= canvasBox.x + canvasBox.width + 0.5 &&
        labelBottom <= canvasBox.y + canvasBox.height + 0.5;
      const insideSvg =
        labelBox.x >= svgBox.x - 0.5 &&
        labelBox.y >= svgBox.y - 0.5 &&
        labelRight <= svgBox.x + svgBox.width + 0.5 &&
        labelBottom <= svgBox.y + svgBox.height + 0.5;
      const overlapsBottomControls =
        labelBox.x < controlsBox.x + controlsBox.width &&
        labelRight > controlsBox.x &&
        labelBox.y < controlsBox.y + controlsBox.height &&
        labelBottom > controlsBox.y;
      return insideCanvas && insideSvg && !overlapsBottomControls;
    });
  }).toBe(true);

  const canvasBox = await canvas.boundingBox();
  const svgBox = await annotation.boundingBox();
  const controlsBox = await bottomControls.boundingBox();
  expect(canvasBox).not.toBeNull();
  expect(svgBox).not.toBeNull();
  expect(controlsBox).not.toBeNull();
  for (const axis of axes) {
    const label = annotation.locator(`g[data-axis="${axis}"] text`);
    await expect(label).toBeVisible();
    const labelBox = await label.boundingBox();
    expect(labelBox, `${axis} label must have a rendered bounding box`).not.toBeNull();
    expect(
      labelBox!.x,
      `${axis} label left=${labelBox!.x}, canvas left=${canvasBox!.x}`,
    ).toBeGreaterThanOrEqual(canvasBox!.x - 0.5);
    expect(
      labelBox!.x + labelBox!.width,
      `${axis} label right must stay inside canvas and SVG`,
    ).toBeLessThanOrEqual(Math.min(
      canvasBox!.x + canvasBox!.width,
      svgBox!.x + svgBox!.width,
    ) + 0.5);
    expect(labelBox!.y, `${axis} label top must stay inside canvas`).toBeGreaterThanOrEqual(
      canvasBox!.y - 0.5,
    );
    expect(
      labelBox!.y + labelBox!.height,
      `${axis} label bottom must stay above the fixed bottom controls`,
    ).toBeLessThanOrEqual(Math.min(
      canvasBox!.y + canvasBox!.height,
      controlsBox!.y,
    ) + 0.5);
  }
}

async function canvasDocumentBox(page: Page) {
  const canvas = page.getByRole("img", {
    name: "積荷を選択・床面移動できる3Dプレビュー",
  });
  const box = await canvas.boundingBox();
  if (box === null) throw new Error("3D canvas has no bounding box");
  const scrollY = await page.evaluate<number>("scrollY");
  return { documentY: box.y + scrollY, height: box.height, width: box.width };
}

test("places the menu at the app-bar right edge and provides zero and single candidate states", async ({
  page,
}) => {
  await page.setViewportSize({ width: 375, height: 740 });
  await page.goto("/");
  await expect(page.getByRole("tablist", { name: "表示する荷室" })).toHaveCount(0);
  await expect(page.getByText("表示する候補がありません")).toBeVisible();

  const menu = page.locator("#app-navigation-button");
  const menuBox = await menu.boundingBox();
  const appBarBox = await page.locator(".application-bar").boundingBox();
  expect(menuBox).not.toBeNull();
  expect(appBarBox).not.toBeNull();
  expect(Math.abs((menuBox!.x + menuBox!.width) - (appBarBox!.x + appBarBox!.width))).toBeLessThan(24);
  expect(
    await page.locator(".application-bar button").last().getAttribute("id"),
  ).toBe("app-navigation-button");

  await addContainer(page, "単一候補");
  await expect(page.getByRole("tab")).toHaveCount(1);
  await expect(page.getByRole("tab")).toHaveAttribute("aria-selected", "true");
});

for (const width of [305, 320, 375] as const) {
  test(`keeps 100 candidate tabs scrollable and outside the viewport at ${width}px`, async ({
    page,
  }) => {
    await page.setViewportSize({ width, height: 740 });
    await page.goto("/");
    await page.locator("input[type='file']").setInputFiles({
      name: "anonymous-tabs.json",
      mimeType: "application/json",
      buffer: Buffer.from(JSON.stringify(hundredCandidateProject())),
    });
    const tabs = page.getByRole("tab");
    const first = tabs.first();
    const last = tabs.last();
    const tabShell = page.locator(".candidate-tabs");
    const candidateTabs = page.locator(".scene-workspace__candidate-tabs");
    const viewport = page.locator(".viewport");
    const scrollLeft = page.getByRole("button", { name: "候補タブを左へスクロール" });
    const scrollRight = page.getByRole("button", { name: "候補タブを右へスクロール" });

    await expect(tabs).toHaveCount(100);
    await expect(tabShell).toHaveAttribute("data-overflow", "true");
    await expect(scrollLeft).toBeVisible();
    await expect(scrollRight).toBeVisible();
    expect(await viewport.evaluate((element) => element.previousElementSibling?.className)).toBe(
      "scene-workspace__candidate-tabs",
    );
    const tabsBox = await candidateTabs.boundingBox();
    const tablistBox = await page.getByRole("tablist", { name: "表示する荷室" }).boundingBox();
    const viewportBox = await viewport.boundingBox();
    expect(tabsBox).not.toBeNull();
    expect(tablistBox).not.toBeNull();
    expect(viewportBox).not.toBeNull();
    expect(tabsBox!.x).toBeGreaterThanOrEqual(0);
    expect(tabsBox!.x + tabsBox!.width).toBeLessThanOrEqual(width + 0.5);
    expect(tablistBox!.x + tablistBox!.width).toBeLessThanOrEqual(width + 0.5);
    expect(tabsBox!.y + tabsBox!.height).toBeLessThanOrEqual(viewportBox!.y + 0.5);

    await expect(first).toHaveAttribute("aria-selected", "true");
    const canvasBeforeTabScroll = await canvasDocumentBox(page);
    await scrollRight.click();
    await expect(first).toHaveAttribute("aria-selected", "true");
    await expect.poll(() => canvasDocumentBox(page)).toEqual(canvasBeforeTabScroll);
    expect(
      await page.evaluate<boolean>(
        "document.documentElement.scrollWidth > document.documentElement.clientWidth",
      ),
    ).toBe(false);

    if (width === 375) {
      const second = tabs.nth(1);
      await second.focus();
      await expect(second).toBeFocused();
      await expect(first).toHaveAttribute("aria-selected", "true");
      await expect(second).toHaveAttribute("aria-selected", "false");
      await second.press("Enter");
      await expect(second).toBeFocused();
      await expect(second).toHaveAttribute("aria-selected", "true");
      await page.keyboard.press("End");
      await expect(last).toBeFocused();
      await expect(last).toHaveAttribute("aria-selected", "true");
      await last.press("Home");
      await expect(first).toBeFocused();
      await expect(first).toHaveAttribute("aria-selected", "true");
      await first.press(" ");
      await expect(first).toHaveAttribute("aria-selected", "true");
    }
  });
}

test("shows selected domain dimensions without pointer interception and exposes the fixed action matrix", async ({
  page,
}) => {
  await page.goto("/");
  await addCargo(page);
  await addContainer(page, "候補A");
  await addContainer(page, "候補B");
  const selector = page.getByLabel("操作する積荷");
  const actions = page.locator(".viewport-context-actions");

  await selector.selectOption("cargo-1");
  await expect(actions.getByRole("button", { name: "座標を入力して配置" })).toBeVisible();
  await expect(actions.getByRole("button", { name: "積荷自体を削除" })).toBeVisible();
  await expect(actions.getByRole("button", { name: "荷室から外す" })).toHaveCount(0);
  await placeCargo(page);

  const annotation = page.locator(".viewport__dimension-annotations");
  await expect(annotation).toBeVisible();
  await expect(annotation.locator("g")).toHaveCount(3);
  await expect(annotation.locator('g[data-axis="X"] text')).toHaveText("500 mm");
  await expect(annotation.locator('g[data-axis="Y"] text')).toHaveText("400 mm");
  await expect(annotation.locator('g[data-axis="Z"] text')).toHaveText("300 mm");
  await expect(annotation).not.toContainText("奥行");
  await expect(annotation).not.toContainText("横幅");
  await expect(annotation).not.toContainText("高さ");
  await expect(actions.locator(".visually-hidden")).toHaveText(
    "X奥行 500 mm、Y横幅 400 mm、Z高さ 300 mm",
  );
  const startMarker = annotation.locator("#dimension-arrow-start");
  const endMarker = annotation.locator("#dimension-arrow-end");
  for (const marker of [startMarker, endMarker]) {
    await expect(marker).toHaveAttribute("markerWidth", "4");
    await expect(marker).toHaveAttribute("markerHeight", "4");
    await expect(marker).toHaveAttribute("refX", "2");
    await expect(marker).toHaveAttribute("refY", "2");
    await expect(marker.locator("path")).toHaveAttribute("d", "M0 0 4 2 0 4Z");
  }
  await expect(startMarker).toHaveAttribute("orient", "auto-start-reverse");
  await expect(endMarker).toHaveAttribute("orient", "auto");
  expect(await startMarker.locator("path").getAttribute("d")).toBe(
    await endMarker.locator("path").getAttribute("d"),
  );
  for (const axis of ["X", "Y", "Z"] as const) {
    const dimensionLine = annotation.locator(`g[data-axis="${axis}"] > line:not(.viewport__dimension-witness)`);
    await expect(dimensionLine).toHaveAttribute("marker-start", "url(#dimension-arrow-start)");
    await expect(dimensionLine).toHaveAttribute("marker-end", "url(#dimension-arrow-end)");
  }
  await expect(annotation).toHaveCSS("pointer-events", "none");
  await expectDimensionLabelsInsideCanvas(page);
  await expect(actions).toContainText("現在の座標 — X 100 / Y 100 / Z 0 mm");
  await expect(actions).not.toContainText("現在の候補 — X");
  await expect(actions.getByRole("button", { name: "座標を微調整" })).toBeVisible();
  await expect(actions.getByRole("button", { name: "荷室から外す" })).toBeVisible();
  await expect(actions.getByRole("button", { name: "積荷自体を削除" })).toHaveCount(0);

  await page.getByRole("tab", { name: /ID: container-2/ }).click();
  await expect(annotation).toHaveCount(0);
  await expect(actions).toContainText("積荷を選択すると操作を表示します。");
  await selector.selectOption("cargo-1");
  await expect(actions).toContainText("候補Aに配置");
  await expect(actions.getByRole("button", { name: "候補Aを表示" })).toBeVisible();
  await expect(actions.getByRole("button", { name: "座標を微調整" })).toHaveCount(0);
  await expect(actions.getByRole("button", { name: "積荷情報を編集" })).toBeVisible();
});

for (const width of [1280, 375, 320, 305] as const) {
  test(`keeps staged X/Y/Z dimension labels inside the ${width}x720 canvas`, async ({
    page,
  }) => {
    await page.setViewportSize({ width, height: 720 });
    await page.goto("/");
    await addCargo(page, `境界確認積荷${width}`);
    await addContainer(page, `境界確認候補${width}`);
    const selector = page.getByLabel("操作する積荷");
    await selector.selectOption("cargo-1");
    await expect(page.locator(".viewport-context-actions")).toContainText(
      "荷室外（未配置）",
    );
    await expectDimensionLabelsInsideCanvas(page);

    await selector.selectOption("");
    await expect(page.locator(".viewport__dimension-annotations")).toHaveCount(0);
  });
}

test("keeps the physical controller fresh while its dialog is closed", async ({ page }) => {
  await page.goto("/");
  await addContainer(page, "判定候補");
  const lamp = page.locator("#physical-validation-lamp");
  await expect(lamp).toHaveAttribute("data-status", "valid");
  await expect(lamp).toHaveAttribute("aria-label", /不適合0件、未確認0件/);
  await expect(lamp).toHaveAttribute(
    "title",
    /実装済み確認項目内で問題なし.*不適合0件.*未確認0件.*詳細を開く/,
  );
  await expect(lamp.locator(".physical-validation-lamp__icon")).toHaveText("✓");
  expect((await lamp.textContent())?.trim()).toBe("✓");
  await expect(lamp.getByText("実装済み確認項目内で問題なし", { exact: true })).toHaveCount(0);
  await openPhysicalValidation(page);
  await expect(page.getByRole("dialog", { name: "物理判定" })).toContainText(
    "実装済み確認項目内で問題なし",
  );
  await page.getByRole("button", { name: "物理判定を閉じる" }).click();

  await addCargo(page, "判定更新積荷");
  await placeCargo(page, "-499");
  await expect(lamp).toHaveAttribute("data-status", "invalid");
  await expect(lamp).toHaveAttribute("aria-label", /不適合1件、未確認0件/);
  await expect(lamp).toHaveAttribute("title", /不適合.*不適合1件.*未確認0件.*詳細を開く/);
  await expect(lamp.locator(".physical-validation-lamp__icon")).toHaveText("!");
  expect((await lamp.textContent())?.trim()).toBe("!");
  await openPhysicalValidation(page);
  await expect(page.getByRole("dialog", { name: "物理判定" })).toContainText("不適合理由（1件）");
});

test("gates a new usage-requirements version and persists successful confirmation separately", async ({
  page,
}) => {
  await page.goto("/");
  await page.addInitScript(`
    if (sessionStorage.getItem('usage-gate-once') === null) {
      localStorage.removeItem('auto-clp.usage-requirements-version');
      sessionStorage.setItem('usage-gate-once', 'done');
    }
  `);
  await page.reload();
  const dialog = page.getByRole("dialog", { name: "使用上の重要事項" });
  await expect(dialog).toBeVisible();
  await expect(dialog).toContainText("内容版 1.0.0");
  await expect(dialog).toContainText("法的な利用規約への同意ではありません");
  await page.keyboard.press("Escape");
  await expect(dialog).toBeVisible();
  await dialog.getByRole("button", { name: "内容を確認して続ける" }).click();
  await expect(dialog).toHaveCount(0);
  await expect.poll(() => page.evaluate(() => localStorage.getItem("auto-clp.usage-requirements-version"))).toBe("1.0.0");
  await page.reload();
  await expect(dialog).toHaveCount(0);
  await openPersistenceDrawer(page);
  await page.getByRole("button", { name: "使用上の重要事項" }).click();
  await expect(dialog).toBeVisible();
});

test("allows session-only continuation when usage preference storage fails", async ({ page }) => {
  await page.goto("/");
  await page.addInitScript(`
    localStorage.removeItem('auto-clp.usage-requirements-version');
    Object.defineProperty(Storage.prototype, 'setItem', {
      configurable: true,
      value() { throw new Error('synthetic storage failure'); }
    });
  `);
  await page.reload();
  const dialog = page.getByRole("dialog", { name: "使用上の重要事項" });
  await dialog.getByRole("button", { name: "内容を確認して続ける" }).click();
  await expect(dialog).toContainText("このセッションでは続行できますが、次回は再確認します");
  await dialog.getByRole("button", { name: "このセッションだけ続ける" }).click();
  await expect(dialog).toHaveCount(0);
  await expect(page.locator("#app-navigation-button")).toBeEnabled();
  await expect(page.getByRole("button", { name: "積荷を追加", exact: true })).toHaveCount(0);
  await page.reload();
  await expect(dialog).toBeVisible();
});
