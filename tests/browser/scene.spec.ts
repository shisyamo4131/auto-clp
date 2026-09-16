import { expect, test, type Locator, type Page } from "./fixtures";
import {
  activateContainer,
  addCargoFromDrawer,
  addContainerFromDrawer,
  openProjectSettings,
} from "./ui-helpers";
import { inflateSync } from "node:zlib";

const previewName = "積荷を選択・床面移動できる3Dプレビュー";

async function addCargo(
  page: Page,
  name: string,
  tipping = false,
  dimensions: { readonly height?: string; readonly length?: string; readonly width?: string } = {},
  canSupportCargo = false,
) {
  await addCargoFromDrawer(page, name, {
    lengthMm: dimensions.length ?? "500",
    widthMm: dimensions.width ?? "400",
    heightMm: dimensions.height ?? "300",
    uprightOnly: !tipping,
    canSupportCargo,
  });
}

async function addContainer(
  page: Page,
  name: string,
  dimensions: { readonly height?: string; readonly length?: string; readonly width?: string } = {},
) {
  await addContainerFromDrawer(page, name, {
    lengthMm: dimensions.length ?? "6000",
    widthMm: dimensions.width ?? "2400",
    heightMm: dimensions.height ?? "2600",
    openingWidthMm: dimensions.width ?? "2400",
    openingHeightMm: dimensions.height ?? "2500",
    payloadKg: "100000",
  });
}

async function place(page: Page, cargoId = "cargo-1", x = "100", y = "100") {
  await page.getByLabel("操作する積荷").selectOption(cargoId);
  await page.getByRole("button", { name: "座標を入力して配置" }).click();
  await page.getByLabel("X最小角").fill(x);
  await page.getByLabel("Y最小角").fill(y);
  await page.getByRole("button", { name: "配置を保存" }).click();
}

async function selectCargoOnCanvas(
  page: Page,
  canvas: Locator,
  card: Locator,
) {
  await canvas.scrollIntoViewIfNeeded();
  const bounds = await canvas.boundingBox();
  if (bounds === null) throw new Error("3D canvas has no bounding box");
  const candidates = [
    [0.5, 0.58],
    [0.5, 0.5],
    [0.42, 0.58],
    [0.58, 0.58],
    [0.42, 0.5],
    [0.58, 0.5],
    [0.5, 0.66],
  ] as const;
  for (const [xRatio, yRatio] of candidates) {
    const point = {
      x: bounds.x + bounds.width * xRatio,
      y: bounds.y + bounds.height * yRatio,
    };
    await page.mouse.click(point.x, point.y);
    if ((await card.textContent())?.includes("積荷を選択すると操作を表示します。") !== true) return point;
  }
  throw new Error("Synthetic cargo was not hit by the tested canvas points");
}

async function locateStagedCargoOnCanvas(page: Page, canvas: Locator) {
  await canvas.scrollIntoViewIfNeeded();
  const bounds = await canvas.boundingBox();
  if (bounds === null) throw new Error("3D canvas has no bounding box");
  const selector = page.getByLabel("操作する積荷");
  let expectedCargoId = await selector.inputValue();
  if (expectedCargoId === "") {
    const firstCargoId = await selector.locator("option").nth(1).getAttribute("value");
    if (firstCargoId === null) throw new Error("Staged cargo selector has no cargo option");
    expectedCargoId = firstCargoId;
  }
  await selector.selectOption(expectedCargoId);
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
  const pointSets = [
    projectedCorners,
    ...projectedCorners.slice(1).map((_, omittedIndex) =>
      projectedCorners.filter((__, index) => index !== omittedIndex + 1),
    ),
  ];
  const projectedCenter = projectedCorners.reduce(
    (total, [x, y]) => ({ x: total.x + x, y: total.y + y }),
    { x: 0, y: 0 },
  );
  projectedCenter.x /= projectedCorners.length;
  projectedCenter.y /= projectedCorners.length;
  const projectedCandidates = [
    ...pointSets.map((points) => {
      const sum = points.reduce(
        (total, [x, y]) => ({ x: total.x + x, y: total.y + y }),
        { x: 0, y: 0 },
      );
      return { x: sum.x / points.length, y: sum.y / points.length };
    }),
    ...projectedCorners.flatMap(([x, y]) => [0.25, 0.5, 0.75].map((ratio) => ({
      x: x + (projectedCenter.x - x) * ratio,
      y: y + (projectedCenter.y - y) * ratio,
    }))),
  ].map((point) => ({
    x: bounds.x + point.x,
    y: bounds.y + point.y,
  }));
  const diagnostics: string[] = [];
  for (const point of projectedCandidates) {
    const hitElement = await page.evaluate(({ x, y }) => {
      const browserGlobal = globalThis as unknown as {
        document: {
          elementFromPoint(clientX: number, clientY: number): {
            readonly className?: unknown;
            readonly tagName: string;
          } | null;
        };
      };
      const element = browserGlobal.document.elementFromPoint(x, y);
      return element === null
        ? "none"
        : `${element.tagName.toLowerCase()}.${typeof element.className === "string" ? element.className.trim().replaceAll(" ", ".") : ""}`;
    }, point);
    diagnostics.push(`${Math.round(point.x)},${Math.round(point.y)}=${hitElement}`);
    if (hitElement !== "canvas.") continue;
    await selector.selectOption("");
    await page.mouse.click(point.x, point.y);
    if ((await selector.inputValue()) === expectedCargoId) return { bounds, point };
  }
  throw new Error(
    `Selected cargo did not accept a pointer hit inside its projected annotation: ${diagnostics.join("; ")}`,
  );
}

async function dragCargoToPartialFloorBoundary(
  page: Page,
  start: { readonly x: number; readonly y: number },
  bounds: { readonly x: number; readonly y: number; readonly width: number; readonly height: number },
) {
  const status = page.locator("#scene-workspace-action-status");
  await page.mouse.move(start.x, start.y);
  await page.mouse.down();
  let inside: { x: number; y: number } | undefined;
  for (const [xRatio, yRatio] of [
    [0.5, 0.55], [0.45, 0.55], [0.55, 0.55], [0.5, 0.48], [0.5, 0.62],
  ] as const) {
    const candidate = {
      x: bounds.x + bounds.width * xRatio,
      y: bounds.y + bounds.height * yRatio,
    };
    await page.mouse.move(candidate.x, candidate.y, { steps: 8 });
    await page.waitForTimeout(30);
    if ((await status.textContent())?.includes("荷室床面にスナップ中")) {
      inside = candidate;
      break;
    }
  }
  if (inside === undefined) {
    await page.keyboard.press("Escape");
    await page.mouse.up();
    throw new Error("Could not find an inside floor preview for partial-boundary search");
  }

  const viewport = page.viewportSize();
  const outsideCandidates = [
    { x: 1, y: inside.y },
    { x: Math.max(1, (viewport?.width ?? 1280) - 2), y: inside.y },
    { x: inside.x, y: 1 },
    { x: inside.x, y: Math.max(1, (viewport?.height ?? 720) - 2) },
  ];
  let outside: { x: number; y: number } | undefined;
  for (const candidate of outsideCandidates) {
    await page.mouse.move(candidate.x, candidate.y, { steps: 8 });
    await page.waitForTimeout(30);
    if ((await status.textContent())?.includes("荷室外の作業スペース")) {
      outside = candidate;
      break;
    }
  }
  if (outside === undefined) {
    await page.keyboard.press("Escape");
    await page.mouse.up();
    throw new Error("Could not find an outside preview for partial-boundary search");
  }

  let boundaryInside = inside;
  let boundaryOutside = outside;
  for (let iteration = 0; iteration < 12; iteration += 1) {
    const midpoint: { x: number; y: number } = {
      x: (boundaryInside.x + boundaryOutside.x) / 2,
      y: (boundaryInside.y + boundaryOutside.y) / 2,
    };
    await page.mouse.move(midpoint.x, midpoint.y);
    await page.waitForTimeout(20);
    if ((await status.textContent())?.includes("荷室外の作業スペース")) {
      boundaryOutside = midpoint;
    } else {
      boundaryInside = midpoint;
    }
  }
  await page.mouse.move(boundaryInside.x, boundaryInside.y);
  await page.waitForTimeout(30);
  await page.mouse.up();
}

function paethPredictor(left: number, up: number, upperLeft: number): number {
  const estimate = left + up - upperLeft;
  const leftDistance = Math.abs(estimate - left);
  const upDistance = Math.abs(estimate - up);
  const upperLeftDistance = Math.abs(estimate - upperLeft);
  if (leftDistance <= upDistance && leftDistance <= upperLeftDistance) return left;
  return upDistance <= upperLeftDistance ? up : upperLeft;
}

function decodePng(image: Buffer) {
  const idatChunks: Buffer[] = [];
  let width = 0;
  let height = 0;
  let channels = 0;
  for (let offset = 8; offset < image.length; ) {
    const length = image.readUInt32BE(offset);
    const type = image.toString("ascii", offset + 4, offset + 8);
    const dataStart = offset + 8;
    const dataEnd = dataStart + length;
    if (type === "IHDR") {
      width = image.readUInt32BE(dataStart);
      height = image.readUInt32BE(dataStart + 4);
      const bitDepth = image[dataStart + 8];
      const colorType = image[dataStart + 9];
      const interlace = image[dataStart + 12];
      if (bitDepth !== 8 || interlace !== 0 || (colorType !== 2 && colorType !== 6)) {
        throw new Error("Unsupported screenshot PNG format");
      }
      channels = colorType === 6 ? 4 : 3;
    } else if (type === "IDAT") {
      idatChunks.push(image.subarray(dataStart, dataEnd));
    }
    offset = dataEnd + 4;
  }
  if (width === 0 || height === 0 || channels === 0 || idatChunks.length === 0) {
    throw new Error("Incomplete screenshot PNG");
  }
  const filtered = inflateSync(Buffer.concat(idatChunks));
  const stride = width * channels;
  const pixels = Buffer.alloc(stride * height);
  let sourceOffset = 0;
  for (let y = 0; y < height; y += 1) {
    const filter = filtered[sourceOffset++]!;
    const rowOffset = y * stride;
    for (let x = 0; x < stride; x += 1) {
      const encoded = filtered[sourceOffset++]!;
      const left = x >= channels ? pixels[rowOffset + x - channels]! : 0;
      const up = y > 0 ? pixels[rowOffset - stride + x]! : 0;
      const upperLeft = y > 0 && x >= channels
        ? pixels[rowOffset - stride + x - channels]!
        : 0;
      const predictor = filter === 0
        ? 0
        : filter === 1
          ? left
          : filter === 2
            ? up
            : filter === 3
              ? Math.floor((left + up) / 2)
              : filter === 4
                ? paethPredictor(left, up, upperLeft)
                : Number.NaN;
      if (!Number.isFinite(predictor)) throw new Error("Unsupported PNG row filter");
      pixels[rowOffset + x] = (encoded + predictor) & 0xff;
    }
  }
  return { channels, height, pixels, stride, width };
}

function measureContainerFrame(image: Buffer) {
  const { channels, height, pixels, stride, width } = decodePng(image);
  let count = 0;
  let minX = width;
  let minY = height;
  let maxX = -1;
  let maxY = -1;
  for (let y = 0; y < height; y += 1) {
    for (let x = 0; x < width; x += 1) {
      const offset = y * stride + x * channels;
      const red = pixels[offset]!;
      const green = pixels[offset + 1]!;
      const blue = pixels[offset + 2]!;
      if (green >= 60 && green >= red + 15 && blue >= red + 15) {
        count += 1;
        minX = Math.min(minX, x);
        minY = Math.min(minY, y);
        maxX = Math.max(maxX, x);
        maxY = Math.max(maxY, y);
      }
    }
  }
  return { count, height: maxY - minY + 1, width: maxX - minX + 1 };
}

function countTurquoisePixels(image: Buffer) {
  const { channels, height, pixels, stride, width } = decodePng(image);
  let count = 0;
  for (let y = 0; y < height; y += 1) {
    for (let x = 0; x < width; x += 1) {
      const offset = y * stride + x * channels;
      const red = pixels[offset]!;
      const green = pixels[offset + 1]!;
      const blue = pixels[offset + 2]!;
      if (green >= red + 25 && blue >= red + 25) count += 1;
    }
  }
  return count;
}

function expectSameContainerFrame(
  actual: ReturnType<typeof measureContainerFrame>,
  expected: ReturnType<typeof measureContainerFrame>,
) {
  expect(expected.count).toBeGreaterThan(100);
  expect(actual.count).toBeGreaterThanOrEqual(expected.count * 0.85);
  expect(actual.count).toBeLessThanOrEqual(expected.count * 1.15);
  expect(Math.abs(actual.width - expected.width)).toBeLessThanOrEqual(4);
  expect(Math.abs(actual.height - expected.height)).toBeLessThanOrEqual(4);
}

test("renders the selected container and keeps the viewport controls after reload", async ({ page }) => {
  await page.goto("/");
  await addContainer(page, "scene候補");
  await expect(page.getByRole("img", { name: previewName })).toBeVisible();
  await expect(page.getByRole("button", { name: "拡大" })).toHaveCount(0);
  await expect(page.getByRole("button", { name: "荷室外の積荷をコンテナへ寄せる" })).toBeVisible();
  await page.goto("/");
  await expect(page.getByRole("img", { name: previewName })).toBeVisible();
  await expect(page.getByRole("button", { name: "元に戻す" })).toBeVisible();
});

test("shows cargo weight, four selection states, load totals, compact staging, and Ctrl pan cursor", async ({ page }) => {
  await page.goto("/");
  await addCargo(page, "状態積荷A");
  await addCargo(page, "状態積荷B");
  await addContainer(page, "状態コンテナA");
  await addContainer(page, "状態コンテナB");

  const selector = page.getByLabel("操作する積荷");
  const state = page.locator(".viewport-control__cargo-state");
  await expect(state).toHaveAttribute("data-state", "none");
  await expect(state).toHaveAttribute("aria-label", "積荷未選択");
  await expect(state).toHaveCSS("background-color", "rgb(129, 144, 157)");
  await expect(selector.locator('option[value="cargo-1"]')).toHaveText(
    "状態積荷A — 500×400×300 mm／1 kg",
  );

  await selector.selectOption("cargo-1");
  await expect(state).toHaveAttribute("data-state", "unplaced");
  await expect(state).toHaveCSS("background-color", "rgb(255, 214, 0)");
  await place(page, "cargo-1");
  await expect(state).toHaveAttribute("data-state", "current");
  await expect(state).toHaveCSS("background-color", "rgb(66, 165, 245)");
  const legend = page.locator(".viewport__weight-balance-legend");
  await expect(legend).toContainText("総重量: 1 kg/100000 kg");
  await expect(legend).toContainText("積込済: 1個/2個");

  await activateContainer(page, "container-2");
  await place(page, "cargo-2");
  await activateContainer(page, "container-1");
  await selector.selectOption("cargo-2");
  await expect(state).toHaveAttribute("data-state", "other");
  await expect(state).toHaveAttribute("aria-label", "別のコンテナに配置済み");
  await expect(state).toHaveCSS("background-color", "rgb(102, 187, 106)");
  await expect(legend).toContainText("積込済: 2個/2個");

  await expect(page.getByRole("button", { name: "荷室から外す" })).toHaveCount(0);
  await activateContainer(page, "container-2");
  await selector.selectOption("cargo-2");
  await page.getByRole("button", { name: "荷室から外す" }).click();
  await page.getByRole("dialog", { name: "荷室から外す" })
    .getByRole("button", { name: "荷室から外す", exact: true })
    .click();
  const historyBefore = await page.locator(".project-history__summary").textContent();
  const magnet = page.getByRole("button", { name: "荷室外の積荷をコンテナへ寄せる" });
  await expect(magnet).toBeEnabled();
  await magnet.click();
  await expect(page.locator("#scene-workspace-action-status")).toContainText(
    "荷室外の積荷1件をコンテナの近くへ寄せました",
  );
  expect(await page.locator(".project-history__summary").textContent()).toBe(historyBefore);

  const canvas = page.getByRole("img", { name: previewName });
  await canvas.hover();
  await page.keyboard.down("Control");
  await expect(canvas).toHaveCSS("cursor", "move");
  await page.keyboard.up("Control");
  await expect(canvas).toHaveCSS("cursor", "grab");
});

test("shares camera framing across resized candidates and restores the same candidate view", async ({ page }) => {
  await page.goto("/");
  await addContainer(page, "camera候補A");
  await addContainer(page, "camera候補B", {
    length: "3000",
    width: "1200",
    height: "1300",
  });
  await activateContainer(page, "container-1");
  const canvas = page.getByRole("img", { name: previewName });
  await canvas.hover();
  await page.mouse.wheel(0, -480);
  await page.waitForTimeout(100);
  const candidateAFrame = measureContainerFrame(await canvas.screenshot());

  await activateContainer(page, "container-2");
  await page.waitForTimeout(100);
  const candidateBFrame = measureContainerFrame(await canvas.screenshot());
  expect(
    Math.abs(candidateBFrame.width - candidateAFrame.width),
    `proportional A/B camera widths diverged: A=${JSON.stringify(candidateAFrame)}, B=${JSON.stringify(candidateBFrame)}`,
  ).toBeLessThanOrEqual(4);
  expect(Math.abs(candidateBFrame.height - candidateAFrame.height)).toBeLessThanOrEqual(4);

  await activateContainer(page, "container-1");
  await page.waitForTimeout(100);
  const restoredCandidateAFrame = measureContainerFrame(await canvas.screenshot());
  expect(Math.abs(restoredCandidateAFrame.width - candidateAFrame.width)).toBeLessThanOrEqual(4);
  expect(Math.abs(restoredCandidateAFrame.height - candidateAFrame.height)).toBeLessThanOrEqual(4);
});

test("keeps all-cargo selection and oriented dimensions available with no candidate", async ({ page }) => {
  await page.goto("/");
  await addCargo(page, "候補なし積荷");
  await page.getByLabel("操作する積荷").selectOption("cargo-1");
  await expect(page.locator("#scene-workspace-action-status")).not.toContainText("操作対象として選択しました");
  await expect(page.getByText("3D描画と判定は、積載可能性や物理的安全性を保証しません。", { exact: true })).toHaveCount(0);
  await expect(page.locator("#physical-validation-lamp")).toHaveAttribute("data-status", "neutral");
  const card = page.locator(".viewport-context-actions");
  await expect(card).toContainText("X奥行 500 mm、Y横幅 400 mm、Z高さ 300 mm");
  await expect(card.getByRole("button", { name: "座標を入力して配置" })).toHaveAttribute("aria-disabled", "true");
});

test("searches all Project cargoes and identifies unplaced, current, and other-container states", async ({ page }) => {
  await page.goto("/");
  await addCargo(page, "検索積荷A");
  await addCargo(page, "検索積荷B");
  await addContainer(page, "候補A");
  await addContainer(page, "候補B");
  await place(page, "cargo-1");
  await activateContainer(page, "container-2");
  await page.getByLabel("積荷を検索").fill("積荷A");
  await expect(page.getByLabel("操作する積荷").locator("option")).toHaveCount(2);
  await page.getByLabel("操作する積荷").selectOption("cargo-1");
  const card = page.locator(".viewport-context-actions");
  await expect(card).toContainText("候補Aに配置");
  await expect(card.getByRole("button", { name: "候補Aを表示" })).toBeVisible();
});

test("saves a partial coordinate as an invalid repair-in-progress placement", async ({ page }) => {
  await page.goto("/");
  await addCargo(page, "partial積荷");
  await addContainer(page, "partial候補");
  await place(page, "cargo-1", "-499", "0");
  await expect(page.locator("#scene-workspace-status")).toContainText("配置1件");
  await expect(page.locator("#physical-validation-lamp")).toHaveAttribute("data-status", "invalid");
});

test("commits a staged fine-pointer partial drop once and cancels its preview safely", async ({ page }) => {
  await page.goto("/");
  await addCargo(page, "staged-partial積荷", false, {
    length: "2000",
    width: "1500",
    height: "300",
  });
  await addContainer(page, "staged-partial候補");
  const canvas = page.getByRole("img", { name: previewName });
  const card = page.locator(".viewport-context-actions");
  const history = page.locator(".project-history__summary");
  const historyBefore = await history.textContent();

  await page.getByLabel("操作する積荷").selectOption("cargo-1");
  let staged = await locateStagedCargoOnCanvas(page, canvas);
  await page.mouse.move(staged.point.x, staged.point.y);
  await page.mouse.down();
  await page.mouse.move(staged.bounds.x + staged.bounds.width * 0.52, staged.bounds.y + staged.bounds.height * 0.58, { steps: 8 });
  await page.keyboard.press("Escape");
  await page.mouse.up();
  await expect(page.locator("#scene-workspace-action-status")).toContainText("Escapeキー");
  await expect(card).toContainText("荷室外（未配置）");
  expect(await history.textContent()).toBe(historyBefore);

  staged = await locateStagedCargoOnCanvas(page, canvas);
  await dragCargoToPartialFloorBoundary(page, staged.point, staged.bounds);
  await expect(card).toContainText("現在の座標 —");
  await expect(page.locator("#physical-validation-lamp")).toHaveAttribute("data-status", "invalid");
  await expect(history).toContainText("配置の追加");
  await page.getByRole("button", { name: "元に戻す" }).click();
  await expect(card).toContainText("荷室外（未配置）");
  await page.getByRole("button", { name: "やり直す" }).click();
  await expect(card).toContainText("現在の座標 —");
});

test("returns a fully dragged-out placement to staging as one undoable deletion", async ({ page }) => {
  await page.goto("/");
  await addCargo(page, "drag-out積荷");
  await addContainer(page, "drag-out候補");
  await place(page, "cargo-1", "2100", "500");
  const canvas = page.getByRole("img", { name: previewName });
  const card = page.locator(".viewport-context-actions");
  await page.getByLabel("操作する積荷").selectOption("");
  const cargoPoint = await selectCargoOnCanvas(page, canvas, card);
  await page.mouse.move(cargoPoint.x, cargoPoint.y);
  await page.mouse.down();
  await page.mouse.move(1, cargoPoint.y, { steps: 12 });
  await page.mouse.up();
  await expect(card).toContainText("荷室外（未配置）");
  await expect(page.locator(".viewport__staging-label")).toHaveCount(0);
  await expect(page.locator(".project-history__summary")).toContainText("配置の削除");
  await page.getByRole("button", { name: "元に戻す" }).click();
  await expect(card).toContainText("現在の座標 —");
  await page.getByRole("button", { name: "やり直す" }).click();
  await expect(card).toContainText("荷室外（未配置）");
});

test("snaps a staged cargo onto a containing support surface and keeps the drop undoable", async ({ page }) => {
  await page.goto("/");
  await addCargo(
    page,
    "支持スナップ台",
    false,
    { length: "1200", width: "1000", height: "500" },
    true,
  );
  await addCargo(page, "支持スナップ上段", false, {
    length: "400",
    width: "300",
    height: "200",
  });
  await addContainer(page, "支持スナップ候補");
  await place(page, "cargo-1", "2400", "700");
  await page.getByLabel("操作する積荷").selectOption("cargo-2");

  const canvas = page.getByRole("img", { name: previewName });
  const card = page.locator(".viewport-context-actions");
  const status = page.locator("#scene-workspace-action-status");
  const targets = [
    [0.4, 0.45], [0.5, 0.45], [0.6, 0.45],
    [0.4, 0.52], [0.5, 0.52], [0.6, 0.52],
    [0.4, 0.58], [0.5, 0.58], [0.6, 0.58],
    [0.4, 0.64], [0.5, 0.64], [0.6, 0.64],
  ] as const;
  let snapped = false;
  for (const [xRatio, yRatio] of targets) {
    const staged = await locateStagedCargoOnCanvas(page, canvas);
    await page.mouse.move(staged.point.x, staged.point.y);
    await page.mouse.down();
    await page.mouse.move(
      staged.bounds.x + staged.bounds.width * xRatio,
      staged.bounds.y + staged.bounds.height * yRatio,
      { steps: 12 },
    );
    await page.waitForTimeout(80);
    if ((await status.textContent())?.includes("単独支持としてスナップ中")) {
      await page.mouse.up();
      snapped = true;
      break;
    }
    await page.keyboard.press("Escape");
    await page.mouse.up();
  }

  expect(snapped).toBe(true);
  await expect(card).toContainText("現在の座標 —");
  await expect(card).toContainText("Z 500 mm");
  await expect(page.locator("#physical-validation-lamp")).toHaveAttribute("data-status", "valid");
  await expect(page.locator(".project-history__summary")).toContainText("配置の追加");
  await page.getByRole("button", { name: "元に戻す" }).click();
  await expect(card).toContainText("荷室外（未配置）");
  await page.getByRole("button", { name: "やり直す" }).click();
  await expect(card).toContainText("500 mm");
});

test("renders drag focus and restores normal cargo rendering after cancel", async ({
  page,
}) => {
  const runtimeErrors: string[] = [];
  page.on("console", (message) => {
    if (message.type() === "error") runtimeErrors.push(`console: ${message.text()}`);
  });
  page.on("pageerror", (error) => runtimeErrors.push(`pageerror: ${error.message}`));
  await page.goto("/");
  await addCargo(page, "集中表示の背景積荷");
  await addCargo(page, "集中表示の操作積荷");
  await addContainer(page, "集中表示候補");
  await place(page, "cargo-1", "2400", "700");
  await page.getByLabel("操作する積荷").selectOption("cargo-2");

  const canvas = page.getByRole("img", { name: previewName });
  const staged = await locateStagedCargoOnCanvas(page, canvas);
  const before = countTurquoisePixels(await canvas.screenshot());

  await page.mouse.move(staged.point.x, staged.point.y);
  await page.mouse.down();
  await page.mouse.move(staged.point.x + 12, staged.point.y, { steps: 6 });
  const during = countTurquoisePixels(await canvas.screenshot());
  expect(Math.abs(during - before)).toBeGreaterThan(20);

  await page.keyboard.press("Escape");
  await page.mouse.up();
  await expect(page.locator("#scene-workspace-action-status")).toContainText("Escapeキー");
  await page.waitForTimeout(200);
  const restored = countTurquoisePixels(await canvas.screenshot());
  expect(
    Math.abs(restored - before),
    `normal rendering did not recover: before=${before}, during=${during}, restored=${restored}`,
  ).toBeLessThanOrEqual(Math.max(10, Math.round(before * 0.03)));
  expect(runtimeErrors).toEqual([]);
});

test("keeps placed selection no-op and partial drag atomic while preserving camera and page", async ({ page }) => {
  await page.goto("/");
  await addCargo(page, "placed-partial積荷", false, {
    length: "2000",
    width: "1500",
    height: "300",
  });
  await addContainer(page, "placed-partial候補");
  await place(page, "cargo-1", "2000", "400");
  const canvas = page.getByRole("img", { name: previewName });
  const card = page.locator(".viewport-context-actions");
  const history = page.locator(".project-history__summary");

  await page.getByLabel("操作する積荷").selectOption("");
  const cargoPoint = await selectCargoOnCanvas(page, canvas, card);
  const historyBeforeNoOp = await history.textContent();
  await page.mouse.move(cargoPoint.x, cargoPoint.y);
  await page.mouse.down();
  await page.mouse.up();
  expect(await history.textContent()).toBe(historyBeforeNoOp);

  const bounds = await canvas.boundingBox();
  if (bounds === null) throw new Error("3D canvas has no bounding box");
  await dragCargoToPartialFloorBoundary(page, cargoPoint, bounds);
  await expect(page.locator("#physical-validation-lamp")).toHaveAttribute("data-status", "invalid");
  await expect(history).toContainText("3Dでの配置移動");
  await canvas.hover();
  await page.mouse.wheel(0, -240);
  const cameraFrame = measureContainerFrame(await canvas.screenshot());
  await page.getByRole("button", { name: "Z軸を中心に90°回転" }).click();
  expectSameContainerFrame(measureContainerFrame(await canvas.screenshot()), cameraFrame);
  const scrollBeforeUndo = await page.evaluate<number>("scrollY");
  await page.getByRole("button", { name: "元に戻す" }).click();
  expect(await page.evaluate<number>("scrollY")).toBe(scrollBeforeUndo);
  await page.getByRole("button", { name: "やり直す" }).click();
  expect(await page.evaluate<number>("scrollY")).toBe(scrollBeforeUndo);
});

test("blocks scene rotation while a project draft owns the busy gate", async ({ page }) => {
  await page.goto("/");
  await addCargo(page, "busy積荷");
  await addContainer(page, "busy候補");
  await place(page);
  const z = page.getByRole("button", { name: "Z軸を中心に90°回転" });
  const historyBefore = await page.locator(".project-history__summary").textContent();
  await openProjectSettings(page);
  await page.getByLabel("CLP名").fill("未保存busyCLP");
  await expect(z).toHaveAttribute("aria-disabled", "true");
  await page.getByLabel("CLP名").fill("新規CLP");
  await page.getByRole("button", { name: "CLP設定を閉じる" }).click();
  await expect(z).not.toHaveAttribute("aria-disabled", "true");
  expect(await page.locator(".project-history__summary").textContent()).toBe(historyBefore);
});

test("keeps axis rotation controls fixed, always visible, and distinguishable by orientation", async ({ page }) => {
  await page.goto("/");
  const x = page.getByRole("button", { name: "X軸を中心に90°回転" });
  const z = page.getByRole("button", { name: "Z軸を中心に90°回転" });
  await expect(x).toBeVisible();
  await expect(z).toBeVisible();
  await expect(x).toHaveAttribute("aria-disabled", "true");
  await expect(z).toHaveAttribute("aria-disabled", "true");
  await expect(x).toHaveAttribute("title", "積荷を選択するとX軸回転できます。");
  await expect(z).toHaveAttribute("title", "積荷を選択するとZ軸回転できます。");
  await addCargo(page, "天地無用積荷");
  await addContainer(page, "回転候補");
  await place(page);
  await expect(x).toHaveAttribute("aria-disabled", "true");
  await expect(z).not.toHaveAttribute("aria-disabled", "true");
  await expect(x).toHaveCSS("background-color", "rgba(7, 17, 31, 0.9)");
  await expect(x).toHaveCSS("border-color", "rgba(88, 112, 136, 0.48)");
  await expect(x).toHaveCSS("color", "rgb(102, 120, 135)");
  await expect(x).toHaveCSS("opacity", "1");
  await expect(z).toHaveCSS("background-color", "rgba(7, 17, 31, 0.9)");
  await expect(z).toHaveCSS("border-color", "rgba(114, 234, 220, 0.75)");
  await expect(z).toHaveCSS("color", "rgb(237, 247, 255)");
  await expect(page.getByRole("button", { name: "荷室全体を表示" })).toHaveCSS(
    "border-color",
    "rgba(114, 234, 220, 0.75)",
  );
  await x.focus();
  await expect(x).toBeFocused();
  expect(await x.locator("path").first().getAttribute("d")).toBe(await z.locator("path").first().getAttribute("d"));
  await expect(x.locator("svg")).toHaveCSS("transform", /matrix\(0, 1, -1, 0/);
  await expect(z.locator("svg")).toHaveCSS("transform", "none");
  await z.evaluate((element) => element.scrollIntoView({ block: "center" }));
  const stableBefore = await z.boundingBox();
  await z.click({ force: true });
  await expect.poll(() => z.boundingBox()).toEqual(stableBefore);
  await z.click({ force: true });
  await expect.poll(() => z.boundingBox()).toEqual(stableBefore);
  await x.click({ force: true });
  await expect(page.locator("#scene-workspace-action-status")).toContainText("X軸回転は利用できません");
});

test("rotates a tip-enabled cargo around X and keeps it undoable", async ({ page }) => {
  await page.goto("/");
  await addCargo(page, "X回転積荷", true);
  await addContainer(page, "X回転候補");
  await place(page);
  const card = page.locator(".viewport-context-actions");
  await page.getByRole("button", { name: "X軸を中心に90°回転" }).click();
  await card.getByRole("button", { name: "座標を微調整" }).click();
  await expect(page.getByLabel("向き")).toHaveValue("LHW");
  await page.getByRole("button", { name: "キャンセル" }).click();
  await page.getByRole("button", { name: "元に戻す" }).click();
  await card.getByRole("button", { name: "座標を微調整" }).click();
  await expect(page.getByLabel("向き")).toHaveValue("LWH");
});

test("wheel over the viewport zooms without scrolling the page or changing history", async ({ page }) => {
  await page.setViewportSize({ width: 1280, height: 540 });
  await page.goto("/");
  await addCargo(page, "wheel積荷");
  await addContainer(page, "wheel候補");
  const canvas = page.getByRole("img", { name: previewName });
  await canvas.scrollIntoViewIfNeeded();
  const before = await page.locator(".project-history__summary").textContent();
  await canvas.hover();
  const scrollBefore = await page.evaluate<number>("scrollY");
  const imageBefore = await canvas.screenshot();
  await page.mouse.wheel(0, 240);
  await page.waitForTimeout(100);
  expect(await page.evaluate<number>("scrollY")).toBe(scrollBefore);
  expect((await canvas.screenshot()).equals(imageBefore)).toBe(false);
  expect(await page.locator(".project-history__summary").textContent()).toBe(before);
});

test("keeps the viewport position stable when action status changes", async ({ page }) => {
  await page.goto("/");
  await addCargo(page, "status積荷");
  await addContainer(page, "status候補");
  await place(page);
  const canvas = page.getByRole("img", { name: previewName });
  const status = page.locator("#scene-workspace-action-status");
  const measureLayout = async () => {
    const [canvasBounds, statusBounds, scrollY] = await Promise.all([
      canvas.boundingBox(),
      status.boundingBox(),
      page.evaluate<number>("scrollY"),
    ]);
    return {
      documentY: canvasBounds === null ? undefined : canvasBounds.y + scrollY,
      statusHeight: statusBounds?.height,
    };
  };
  const before = await measureLayout();
  await page.getByRole("button", { name: "Z軸を中心に90°回転" }).click();
  await expect(status).toContainText("Z軸中心に90°回転しました");
  const after = await measureLayout();
  expect(after).toEqual(before);
});

test("keeps touch selection form fallback and narrow modal layouts", async ({ page }) => {
  await page.setViewportSize({ width: 305, height: 700 });
  await page.goto("/");
  await addCargo(page, "touch積荷");
  await addContainer(page, "touch候補");
  for (const width of [305, 320, 375, 720]) {
    await page.setViewportSize({ width, height: 700 });
    const candidate = await page.locator(".scene-workspace__candidate-tabs").boundingBox();
    const viewport = await page.locator(".viewport").boundingBox();
    const canvas = await page.getByRole("img", { name: previewName }).boundingBox();
    if (viewport === null || candidate === null || canvas === null) {
      throw new Error("external candidate tabs or viewport are missing");
    }
    expect(candidate.height).toBeLessThanOrEqual(64);
    expect(candidate.y + candidate.height).toBeLessThanOrEqual(viewport.y + 0.5);
    expect(canvas.y).toBeGreaterThanOrEqual(viewport.y - 0.5);
    expect(await page.evaluate<boolean>("document.documentElement.scrollWidth > document.documentElement.clientWidth")).toBe(false);
  }
  await page.setViewportSize({ width: 305, height: 700 });
  const resetViewButton = page.getByRole("button", { name: "荷室全体を表示" });
  await expect(resetViewButton).toHaveAttribute("title", "荷室全体を表示");
  await expect(resetViewButton.locator("svg.viewport__reset-view-icon")).toHaveCount(1);
  expect((await resetViewButton.textContent())?.trim()).toBe("");
  await page.getByRole("button", { name: "荷室外の積荷をコンテナへ寄せる" }).focus();
  await expect(page.getByRole("button", { name: "荷室外の積荷をコンテナへ寄せる" })).toBeFocused();
  await page.getByLabel("操作する積荷").selectOption("cargo-1");
  await page.getByRole("button", { name: "座標を入力して配置" }).click();
  await expect(page.getByRole("dialog", { name: "touch積荷" })).toBeVisible();
  expect(await page.evaluate<boolean>("document.documentElement.scrollWidth > document.documentElement.clientWidth")).toBe(false);
});

test("keeps the 3D action row compact as cargo count grows", async ({ page }) => {
  await page.goto("/");
  await addContainer(page, "many候補");
  for (let index = 0; index < 6; index += 1) await addCargo(page, `many積荷${index}`);
  const card = page.locator(".viewport-context-actions");
  const height = (await card.boundingBox())?.height ?? 0;
  await page.getByLabel("操作する積荷").selectOption("cargo-6");
  expect((await card.boundingBox())?.height ?? 0).toBeLessThanOrEqual(height + 220);
  await expect(page.getByText("6/6件")).toHaveCount(0);
});
