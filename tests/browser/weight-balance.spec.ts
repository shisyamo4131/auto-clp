import {
  expect,
  test,
  type Locator,
  type Page,
  weightBalanceProject,
} from "./fixtures";

const balance = ".viewport__weight-balance";
const containerMarker = `${balance} [data-center-kind="container"]`;
const cargoMarker = `${balance} [data-center-kind="cargo"]`;

async function importWeightBalanceFixture(page: Page) {
  await page.goto("/");
  await page.locator("input[type='file']").setInputFiles({
    name: "anonymous-weight-balance.json",
    mimeType: "application/json",
    buffer: Buffer.from(JSON.stringify(weightBalanceProject())),
  });
  await expect(page.getByRole("tab", { name: /ID: container-balanced/ })).toBeVisible();
  await expect(page.locator(balance)).toHaveAttribute("data-state", "available");
}

function screenCoincidenceProject() {
  const project = weightBalanceProject();
  return {
    ...project,
    cargoes: [{
      ...project.cargoes[0]!,
      dimensionsMm: { lengthMm: 100, widthMm: 100, heightMm: 100 },
    }],
    placements: [{
      cargoId: "cargo-a",
      containerId: "container-balanced",
      positionMm: { xMm: 1_850, yMm: 860, zMm: 1_022 },
      orientation: "LWH",
    }],
  };
}

async function editCargoBX(page: Page, xMm: string) {
  await page.getByLabel("操作する積荷").selectOption("cargo-b");
  await page.getByRole("button", { name: "座標を微調整" }).click();
  await page.getByLabel("X最小角").fill(xMm);
  await page.getByRole("button", { name: "配置を保存" }).click();
}

async function markerCenter(page: Page, selector: string) {
  const box = await page.locator(selector).boundingBox();
  if (box === null) throw new Error(`${selector} has no rendered bounds`);
  return { x: box.x + box.width / 2, y: box.y + box.height / 2 };
}

async function projectedPlacedCargoCanvasPoints(
  page: Page,
  canvas: Locator,
  cargoId: string,
) {
  await canvas.scrollIntoViewIfNeeded();
  const bounds = await canvas.boundingBox();
  if (bounds === null) throw new Error("3D canvas has no bounding box");
  const selector = page.getByLabel("操作する積荷");
  await selector.selectOption(cargoId);
  const witnesses = page.locator(".viewport__dimension-witness");
  await expect(witnesses).toHaveCount(6);
  const projectedCorners = await witnesses.evaluateAll((lines) => {
    const unique = new Map<string, readonly [number, number]>();
    for (const line of lines) {
      const x = Number(line.getAttribute("x1"));
      const y = Number(line.getAttribute("y1"));
      if (!Number.isFinite(x) || !Number.isFinite(y)) continue;
      unique.set(`${x}:${y}`, [x, y] as const);
    }
    return [...unique.values()];
  });
  expect(projectedCorners.length).toBeGreaterThanOrEqual(4);
  const projectedCenter = projectedCorners.reduce(
    (total, [x, y]) => ({ x: total.x + x, y: total.y + y }),
    { x: 0, y: 0 },
  );
  projectedCenter.x /= projectedCorners.length;
  projectedCenter.y /= projectedCorners.length;
  const candidates = [
    projectedCenter,
    ...projectedCorners.map(([x, y]) => ({
      x: x + (projectedCenter.x - x) * 0.5,
      y: y + (projectedCenter.y - y) * 0.5,
    })),
  ].map((point) => ({ x: bounds.x + point.x, y: bounds.y + point.y }));

  const canvasPoints = [];
  for (const point of candidates) {
    const hitCanvas = await page.evaluate(({ x, y }) => {
      const browserGlobal = globalThis as unknown as {
        document: {
          elementFromPoint(clientX: number, clientY: number): {
            readonly tagName: string;
          } | null;
        };
      };
      const element = browserGlobal.document.elementFromPoint(x, y);
      return element?.tagName.toLowerCase() === "canvas";
    }, point);
    if (hitCanvas) canvasPoints.push(point);
  }
  if (canvasPoints.length === 0) {
    throw new Error(`Placed cargo ${cargoId} has no unobscured projected canvas point`);
  }
  return canvasPoints;
}

async function locatePlacedCargoOnCanvas(
  page: Page,
  canvas: Locator,
  cargoId: string,
) {
  const selector = page.getByLabel("操作する積荷");
  const candidates = await projectedPlacedCargoCanvasPoints(page, canvas, cargoId);
  for (const point of candidates) {
    await selector.selectOption("");
    await page.mouse.click(point.x, point.y);
    if ((await selector.inputValue()) === cargoId) return point;
  }
  throw new Error(`Placed cargo ${cargoId} could not be located on the canvas`);
}

async function moveDragToCommittedPreview(
  page: Page,
  start: { readonly x: number; readonly y: number },
) {
  const status = page.locator("#scene-workspace-action-status");
  await page.mouse.move(start.x, start.y);
  await page.mouse.down();
  for (const [xDelta, yDelta] of [
    [32, 0],
    [-32, 0],
    [0, 32],
    [0, -32],
  ] as const) {
    const target = { x: start.x + xDelta, y: start.y + yDelta };
    await page.mouse.move(target.x, target.y, { steps: 8 });
    if ((await status.textContent())?.includes("スナップ中")) return target;
  }
  await page.keyboard.press("Escape");
  await page.mouse.up();
  throw new Error("Placed cargo drag did not reach a committable preview");
}

test("shows exact coincident cargo-only COG as same-size yellow-over-red inert markers", async ({
  page,
}) => {
  await importWeightBalanceFixture(page);
  const overlay = page.locator(balance);
  const legend = overlay.locator(".viewport__weight-balance-legend");
  await expect(overlay).toHaveAttribute("data-coincident", "true");
  await expect(page.locator(containerMarker)).toBeVisible();
  await expect(page.locator(cargoMarker)).toBeVisible();
  await expect(legend).toContainText("赤い点：コンテナ幾何中心");
  await expect(legend).toContainText("黄色い点：現在重心（積荷のみ）");
  await expect(legend).not.toContainText("外側の点");
  await expect(legend).not.toContainText("内側の点");
  await expect(legend).not.toContainText(/mm|許容|合否|距離/);

  const redCenter = await markerCenter(page, containerMarker);
  const yellowCenter = await markerCenter(page, cargoMarker);
  expect(Math.abs(redCenter.x - yellowCenter.x)).toBeLessThan(0.1);
  expect(Math.abs(redCenter.y - yellowCenter.y)).toBeLessThan(0.1);
  const redBox = await page.locator(containerMarker).boundingBox();
  const yellowBox = await page.locator(cargoMarker).boundingBox();
  expect(redBox).toMatchObject({ width: 10, height: 10 });
  expect(yellowBox).toMatchObject({ width: 10, height: 10 });
  await expect(page.locator(containerMarker)).toHaveCSS("z-index", "1");
  await expect(page.locator(cargoMarker)).toHaveCSS("z-index", "2");
  await expect(page.locator(containerMarker)).toHaveCSS("box-shadow", "none");
  for (const marker of [
    page.locator(containerMarker),
    page.locator(cargoMarker),
  ]) {
    await expect(marker).toHaveCSS("border-top-width", "0px");
    await expect(marker).toHaveCSS("outline-style", "none");
    expect(await marker.evaluate((element) => {
      const browserGlobal = globalThis as unknown as {
        getComputedStyle(target: unknown): { readonly boxShadow: string };
      };
      return browserGlobal.getComputedStyle(element).boxShadow;
    }))
      .not.toContain("255, 255, 255");
  }
  const redSwatch = legend.locator(".viewport__weight-balance-swatch--container");
  const yellowSwatch = legend.locator(".viewport__weight-balance-swatch--cargo");
  for (const swatch of [redSwatch, yellowSwatch]) {
    await expect(swatch).toHaveCSS("width", "10px");
    await expect(swatch).toHaveCSS("height", "10px");
    await expect(swatch).toHaveCSS("border-top-width", "0px");
    await expect(swatch).toHaveCSS("outline-style", "none");
    await expect(swatch).toHaveCSS("box-shadow", "none");
  }
  await expect(overlay).toHaveCSS("pointer-events", "none");
  await expect(overlay).toHaveCSS("z-index", "2");
  await expect(page.locator(".viewport__top-controls")).toHaveCSS("z-index", "3");
  await expect(page.locator(".viewport__overlay--bottom")).toHaveCSS("z-index", "3");
  await expect(page.locator(containerMarker)).toHaveCSS("pointer-events", "none");
  await expect(page.locator(cargoMarker)).toHaveCSS("pointer-events", "none");
  await expect(overlay.locator("button, input, [tabindex]")).toHaveCount(0);
});

test("uses coincident glyphs when distinct 3D centers share one screen projection", async ({
  page,
}) => {
  await page.goto("/");
  await page.locator("input[type='file']").setInputFiles({
    name: "anonymous-screen-coincidence.json",
    mimeType: "application/json",
    buffer: Buffer.from(JSON.stringify(screenCoincidenceProject())),
  });
  await expect(page.locator(balance)).toHaveAttribute("data-state", "available");
  await expect(page.locator(balance)).toHaveAttribute("data-coincident", "true");
  const redCenter = await markerCenter(page, containerMarker);
  const yellowCenter = await markerCenter(page, cargoMarker);
  expect(Math.abs(redCenter.x - yellowCenter.x)).toBeLessThanOrEqual(0.01);
  expect(Math.abs(redCenter.y - yellowCenter.y)).toBeLessThanOrEqual(0.01);
});

test("recomputes after committed edits and undo while preserving real near and offscreen positions", async ({
  page,
}) => {
  await importWeightBalanceFixture(page);
  const canvas = page.getByRole("img", {
    name: "積荷を選択・床面移動できる3Dプレビュー",
  });
  const canvasBefore = await canvas.boundingBox();
  const redBefore = await page.locator(containerMarker).getAttribute("style");

  await editCargoBX(page, "2999");
  await expect(page.locator(balance)).toHaveAttribute("data-coincident", "false");
  await expect(page.locator(containerMarker)).toHaveAttribute("style", redBefore!);
  const nearRed = await markerCenter(page, containerMarker);
  const nearYellow = await markerCenter(page, cargoMarker);
  expect(Math.hypot(nearRed.x - nearYellow.x, nearRed.y - nearYellow.y)).toBeGreaterThan(0);
  expect(Math.hypot(nearRed.x - nearYellow.x, nearRed.y - nearYellow.y)).toBeLessThan(2);

  await editCargoBX(page, "2000");
  const shiftedStyle = await page.locator(cargoMarker).getAttribute("style");
  await page.getByRole("button", { name: "拡大" }).click();
  await expect.poll(() => page.locator(cargoMarker).getAttribute("style"))
    .not.toBe(shiftedStyle);
  await expect(page.locator(containerMarker)).toHaveAttribute("style", redBefore!);

  await editCargoBX(page, "1000000");
  await expect(page.locator(cargoMarker)).toHaveCount(0);
  await expect(page.locator(`${balance} .viewport__weight-balance-legend`))
    .toContainText("現在重心は画面外");
  const canvasOffscreen = await canvas.boundingBox();
  expect(canvasOffscreen).toEqual(canvasBefore);

  await page.getByRole("button", { name: "元に戻す" }).click();
  await expect(page.locator(cargoMarker)).toBeVisible();
  await expect(page.locator(`${balance} .viewport__weight-balance-legend`))
    .not.toContainText("現在重心は画面外");
});

test("clears stale markers across no-container, empty, available and container switches", async ({
  page,
}) => {
  await page.goto("/");
  await expect(page.locator(balance)).toHaveAttribute("data-state", "no-container");
  await expect(page.locator(containerMarker)).toHaveCount(0);
  await expect(page.locator(cargoMarker)).toHaveCount(0);
  await expect(page.locator(`${balance} .viewport__weight-balance-legend`))
    .toContainText("コンテナ未選択またはコンテナなし");

  await page.locator("input[type='file']").setInputFiles({
    name: "anonymous-weight-balance.json",
    mimeType: "application/json",
    buffer: Buffer.from(JSON.stringify(weightBalanceProject())),
  });
  await expect(page.locator(balance)).toHaveAttribute("data-state", "available");
  await expect(page.locator(cargoMarker)).toBeVisible();

  await page.getByRole("tab", { name: /ID: container-empty/ }).click();
  await expect(page.locator(balance)).toHaveAttribute("data-state", "empty");
  await expect(page.locator(containerMarker)).toBeVisible();
  await expect(page.locator(cargoMarker)).toHaveCount(0);
  await expect(page.locator(`${balance} .viewport__weight-balance-legend`))
    .toContainText("配置積荷なし");

  await page.getByRole("tab", { name: /ID: container-balanced/ }).click();
  await expect(page.locator(balance)).toHaveAttribute("data-state", "available");
  await expect(page.locator(cargoMarker)).toBeVisible();
  await expect(page.locator(balance)).toHaveAttribute("data-coincident", "true");
});

test("recomputes from committed cargo definition, rotation, removal, undo and redo", async ({
  page,
}) => {
  await importWeightBalanceFixture(page);
  const redStyle = await page.locator(containerMarker).getAttribute("style");
  const initialCargoStyle = await page.locator(cargoMarker).getAttribute("style");
  await page.getByLabel("操作する積荷").selectOption("cargo-b");
  await page.getByRole("button", { name: "積荷情報を編集" }).click();
  await page.getByLabel("長さ", { exact: true }).fill("1200");
  await page.getByLabel("重量").fill("500");
  await page.getByRole("button", { name: "積荷情報を保存" }).click();
  await expect.poll(() => page.locator(cargoMarker).getAttribute("style"))
    .not.toBe(initialCargoStyle);
  const editedCargoStyle = await page.locator(cargoMarker).getAttribute("style");
  await expect(page.locator(containerMarker)).toHaveAttribute("style", redStyle!);

  await page.getByRole("button", { name: "元に戻す" }).click();
  await expect(page.locator(cargoMarker)).toHaveAttribute("style", initialCargoStyle!);
  await page.getByRole("button", { name: "やり直す" }).click();
  await expect(page.locator(cargoMarker)).toHaveAttribute("style", editedCargoStyle!);

  await page.getByRole("button", { name: "Z軸を中心に90°回転" }).click();
  await expect.poll(() => page.locator(cargoMarker).getAttribute("style"))
    .not.toBe(editedCargoStyle);
  await page.getByRole("button", { name: "元に戻す" }).click();
  await expect(page.locator(cargoMarker)).toHaveAttribute("style", editedCargoStyle!);

  await page.getByRole("button", { name: "荷室から外す" }).click();
  await page.getByRole("dialog", { name: "荷室から外す" })
    .getByRole("button", { name: "荷室から外す", exact: true })
    .click();
  await expect(page.locator(balance)).toHaveAttribute("data-state", "available");
  await expect.poll(() => page.locator(cargoMarker).getAttribute("style"))
    .not.toBe(editedCargoStyle);
  await page.getByRole("button", { name: "元に戻す" }).click();
  await expect(page.locator(cargoMarker)).toHaveAttribute("style", editedCargoStyle!);
});

test("keeps the Project-corresponding markers after rejected JSON imports", async ({ page }) => {
  await importWeightBalanceFixture(page);
  const overlay = page.locator(balance);
  const stateBefore = await overlay.getAttribute("data-state");
  const coincidentBefore = await overlay.getAttribute("data-coincident");
  const redBefore = await page.locator(containerMarker).getAttribute("style");
  const yellowBefore = await page.locator(cargoMarker).getAttribute("style");

  await page.locator("input[type='file']").setInputFiles({
    name: "anonymous-invalid.json",
    mimeType: "application/json",
    buffer: Buffer.from("{"),
  });

  await expect(page.locator(".project-persistence__status")).toContainText(
    "JSONの形式が正しくないため拒否しました。現在のCLPは変更していません。",
  );
  await expect(overlay).toHaveAttribute("data-state", stateBefore!);
  await expect(overlay).toHaveAttribute("data-coincident", coincidentBefore!);
  await expect(page.locator(containerMarker)).toHaveAttribute("style", redBefore!);
  await expect(page.locator(cargoMarker)).toHaveAttribute("style", yellowBefore!);

  const missingReferenceProject = weightBalanceProject();
  missingReferenceProject.cargoes = missingReferenceProject.cargoes.filter(
    (cargo) => cargo.id !== "cargo-a",
  );
  await page.locator("input[type='file']").setInputFiles({
    name: "anonymous-missing-reference.json",
    mimeType: "application/json",
    buffer: Buffer.from(JSON.stringify(missingReferenceProject)),
  });
  await expect(page.locator(".project-persistence__status")).toContainText(
    "CLPデータのID、参照、向き、開口、または重量整合性を確認できないため拒否しました。",
  );
  await expect(overlay).toHaveAttribute("data-state", stateBefore!);
  await expect(overlay).toHaveAttribute("data-coincident", coincidentBefore!);
  await expect(page.locator(containerMarker)).toHaveAttribute("style", redBefore!);
  await expect(page.locator(cargoMarker)).toHaveAttribute("style", yellowBefore!);
});

test("renders a read-only unavailable recovery scene for a missing cargo reference", async ({
  page,
}) => {
  await page.goto("/tests/browser/harnesses/unavailable-scene.html");
  const harness = page.getByTestId("unavailable-scene-harness");
  const overlay = page.locator(balance);
  const canvas = page.getByRole("img", {
    name: "積荷を選択・床面移動できる3Dプレビュー",
  });
  const selector = page.getByLabel("操作する積荷");
  const history = page.locator(".project-history__summary");

  await expect(harness).toHaveAttribute("data-renderer-state", "ready");
  await expect(page.getByRole("alert")).toContainText(
    "配置が参照する積荷がCLP内に見つからないため、3D表示を更新できません。",
  );
  await expect(overlay).toHaveAttribute("data-state", "unavailable");
  await expect(page.locator(containerMarker)).toBeVisible();
  await expect(page.locator(cargoMarker)).toHaveCount(0);
  await expect(overlay.locator(".viewport__weight-balance-legend")).toContainText(
    "現在重心を計算できません",
  );
  await expect(harness).toHaveAttribute("data-project-original", "true");
  await expect(harness).toHaveAttribute("data-commit-attempts", "0");
  await expect(harness).toHaveAttribute("data-history-past", "0");
  await expect(harness).toHaveAttribute("data-history-future", "0");

  const cargoPoints = await projectedPlacedCargoCanvasPoints(
    page,
    canvas,
    "cargo-resolved",
  );
  const cargoPoint = cargoPoints[0]!;
  await selector.selectOption("");
  await page.mouse.click(cargoPoint.x, cargoPoint.y);
  await expect(selector).toHaveValue("");

  await selector.selectOption("cargo-resolved");
  const witnesses = page.locator(".viewport__dimension-witness");
  await expect(witnesses).toHaveCount(6);
  const witnessGeometryBefore = await witnesses.evaluateAll((lines) =>
    lines.map((line) => [
      line.getAttribute("x1"),
      line.getAttribute("y1"),
      line.getAttribute("x2"),
      line.getAttribute("y2"),
    ]),
  );
  const historyBefore = await history.textContent();
  await page.mouse.move(cargoPoint.x, cargoPoint.y);
  await page.mouse.down();
  await page.mouse.move(cargoPoint.x + 40, cargoPoint.y, { steps: 8 });
  await page.mouse.up();
  await expect(selector).toHaveValue("cargo-resolved");
  expect(await history.textContent()).toBe(historyBefore);
  await expect(harness).toHaveAttribute("data-project-original", "true");
  await expect(harness).toHaveAttribute("data-commit-attempts", "0");
  await expect(harness).toHaveAttribute("data-history-past", "0");

  const xRotation = page.getByRole("button", { name: "X軸を中心に90°回転" });
  const zRotation = page.getByRole("button", { name: "Z軸を中心に90°回転" });
  await expect(xRotation).toHaveAttribute("aria-disabled", "true");
  await expect(zRotation).toHaveAttribute("aria-disabled", "true");
  await xRotation.click({ force: true });
  await zRotation.click({ force: true });
  await expect(harness).toHaveAttribute("data-project-original", "true");
  await expect(harness).toHaveAttribute("data-commit-attempts", "0");
  await expect(harness).toHaveAttribute("data-history-past", "0");
  await expect(page.locator(cargoMarker)).toHaveCount(0);

  await page.getByRole("button", { name: "拡大" }).click();
  await expect.poll(() => witnesses.evaluateAll((lines) =>
    lines.map((line) => [
      line.getAttribute("x1"),
      line.getAttribute("y1"),
      line.getAttribute("x2"),
      line.getAttribute("y2"),
    ]),
  )).not.toEqual(witnessGeometryBefore);
  await expect(overlay).toHaveAttribute("data-state", "unavailable");
  await expect(page.locator(containerMarker)).toBeVisible();
  await expect(page.locator(cargoMarker)).toHaveCount(0);
});

test("ignores placed-cargo drag preview and cancel, then updates after drop", async ({ page }) => {
  await importWeightBalanceFixture(page);
  const canvas = page.getByRole("img", {
    name: "積荷を選択・床面移動できる3Dプレビュー",
  });
  const history = page.locator(".project-history__summary");
  const cargo = page.locator(cargoMarker);
  const initialStyle = await cargo.getAttribute("style");
  const initialHistory = await history.textContent();
  const cargoPoint = await locatePlacedCargoOnCanvas(page, canvas, "cargo-a");

  await page.mouse.move(cargoPoint.x, cargoPoint.y);
  await page.mouse.down();
  await page.mouse.up();
  await expect(cargo).toHaveAttribute("style", initialStyle!);
  expect(await history.textContent()).toBe(initialHistory);

  await moveDragToCommittedPreview(page, cargoPoint);
  await expect(cargo).toHaveAttribute("style", initialStyle!);
  await page.keyboard.press("Escape");
  await page.mouse.up();
  await expect(page.locator("#scene-workspace-action-status")).toContainText("Escapeキー");
  await expect(cargo).toHaveAttribute("style", initialStyle!);
  expect(await history.textContent()).toBe(initialHistory);

  await moveDragToCommittedPreview(page, cargoPoint);
  await page.mouse.up();
  await expect.poll(() => cargo.getAttribute("style")).not.toBe(initialStyle);
  await expect(history).toContainText("3Dでの配置移動");
});

test.describe("device scale factor 2", () => {
  test.use({ deviceScaleFactor: 2, viewport: { width: 1280, height: 720 } });

  test("keeps CSS marker sizes, coincidence, and camera reprojection", async ({ page }) => {
    await importWeightBalanceFixture(page);
    expect(await page.evaluate(
      "globalThis.devicePixelRatio",
    )).toBe(2);
    const red = page.locator(containerMarker);
    const yellow = page.locator(cargoMarker);
    await expect(page.locator(balance)).toHaveAttribute("data-coincident", "true");
    await expect(red).toHaveCSS("width", "10px");
    await expect(red).toHaveCSS("height", "10px");
    await expect(yellow).toHaveCSS("width", "10px");
    await expect(yellow).toHaveCSS("height", "10px");

    await editCargoBX(page, "2000");
    const shiftedStyle = await yellow.getAttribute("style");
    await page.getByRole("button", { name: "拡大" }).click();
    await expect.poll(() => yellow.getAttribute("style")).not.toBe(shiftedStyle);
    await expect(red).toHaveCSS("width", "10px");
    await expect(yellow).toHaveCSS("width", "10px");
  });
});

for (const width of [305, 320, 375] as const) {
  test(`keeps the weight-balance legend within the ${width}px viewport without layout shift`, async ({
    page,
  }) => {
    await page.setViewportSize({ width, height: 740 });
    await importWeightBalanceFixture(page);
    const viewport = page.locator(".viewport");
    const legend = page.locator(`${balance} .viewport__weight-balance-legend`);
    const viewportBox = await viewport.boundingBox();
    const legendBox = await legend.boundingBox();
    expect(viewportBox).not.toBeNull();
    expect(legendBox).not.toBeNull();
    expect(legendBox!.x).toBeGreaterThanOrEqual(viewportBox!.x);
    expect(legendBox!.x + legendBox!.width).toBeLessThanOrEqual(
      viewportBox!.x + viewportBox!.width + 0.5,
    );
    expect(await page.evaluate<boolean>(
      "document.documentElement.scrollWidth > document.documentElement.clientWidth",
    ))
      .toBe(false);
  });
}
