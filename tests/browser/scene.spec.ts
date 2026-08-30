import { expect, test, type Locator, type Page } from "@playwright/test";
import { inflateSync } from "node:zlib";

const previewName = "積荷を選択・床面移動できる3Dプレビュー";

async function addCargo(
  page: Page,
  name: string,
  tipping = false,
  dimensions: { readonly height?: string; readonly length?: string; readonly width?: string } = {},
  canSupportCargo = false,
) {
  await page.getByRole("button", { name: "積荷を追加" }).click();
  await page.getByLabel("積荷名").fill(name);
  await page.getByLabel("長さ", { exact: true }).fill(dimensions.length ?? "500");
  await page.getByLabel("幅", { exact: true }).fill(dimensions.width ?? "400");
  await page.getByLabel("高さ", { exact: true }).fill(dimensions.height ?? "300");
  await page.getByLabel("重量").fill("1");
  if (tipping) await page.getByLabel(/天地無用/).uncheck();
  if (canSupportCargo) {
    await page
      .getByLabel("この積荷の上面で別の積荷を幾何学的に支持できる")
      .check();
  }
  await page.getByRole("button", { name: "積荷を保存" }).click();
}

async function addContainer(page: Page, name: string) {
  await page.getByRole("button", { name: "候補を追加" }).click();
  await page.getByLabel("候補名").fill(name);
  await page.getByLabel("内部長さ").fill("6000");
  await page.getByLabel("内部幅").fill("2400");
  await page.getByLabel("内部高さ").fill("2600");
  await page.getByLabel("開口幅").fill("2400");
  await page.getByLabel("開口高さ").fill("2500");
  await page.getByLabel("総耐荷重").fill("100000");
  await page.getByRole("button", { name: "候補を保存" }).click();
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
    if ((await card.getAttribute("aria-current")) === "true") return point;
  }
  throw new Error("Synthetic cargo was not hit by the tested canvas points");
}

async function locateStagedCargoOnCanvas(canvas: Locator) {
  await canvas.scrollIntoViewIfNeeded();
  const bounds = await canvas.boundingBox();
  if (bounds === null) throw new Error("3D canvas has no bounding box");
  const warmCargo = measureStagedCargo(await canvas.screenshot());
  expect(warmCargo.count).toBeGreaterThan(20);
  return {
    bounds,
    point: {
      x: bounds.x + bounds.width * warmCargo.centerXRatio,
      y: bounds.y + bounds.height * warmCargo.centerYRatio,
    },
  };
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

function measureStagedCargo(image: Buffer) {
  const { channels, height, pixels, stride, width } = decodePng(image);
  const measuredHeight = Math.floor(height * 0.9);
  const mask = new Uint8Array(width * measuredHeight);
  for (let y = 0; y < measuredHeight; y += 1) {
    for (let x = 0; x < width; x += 1) {
      const pixelOffset = y * stride + x * channels;
      const red = pixels[pixelOffset]!;
      const green = pixels[pixelOffset + 1]!;
      const blue = pixels[pixelOffset + 2]!;
      if (red >= 30 && red >= green + 8 && green >= blue + 5) mask[y * width + x] = 1;
    }
  }
  let best = { count: 0, minX: width, minY: height, maxX: -1, maxY: -1 };
  const queue: number[] = [];
  for (let start = 0; start < mask.length; start += 1) {
    if (mask[start] !== 1) continue;
    mask[start] = 2;
    queue.length = 0;
    queue.push(start);
    let cursor = 0;
    let count = 0;
    let minX = width;
    let minY = height;
    let maxX = -1;
    let maxY = -1;
    while (cursor < queue.length) {
      const pixelIndex = queue[cursor++]!;
      const x = pixelIndex % width;
      const y = Math.floor(pixelIndex / width);
      count += 1;
      minX = Math.min(minX, x);
      minY = Math.min(minY, y);
      maxX = Math.max(maxX, x);
      maxY = Math.max(maxY, y);
      for (const neighbor of [pixelIndex - 1, pixelIndex + 1, pixelIndex - width, pixelIndex + width]) {
        if (
          neighbor < 0 ||
          neighbor >= mask.length ||
          (neighbor === pixelIndex - 1 && x === 0) ||
          (neighbor === pixelIndex + 1 && x === width - 1) ||
          mask[neighbor] !== 1
        ) continue;
        mask[neighbor] = 2;
        queue.push(neighbor);
      }
    }
    const area = (maxX - minX + 1) * (maxY - minY + 1);
    if (count / area >= 0.12 && count > best.count) {
      best = { count, minX, minY, maxX, maxY };
    }
  }
  return {
    centerXRatio: best.count === 0 ? 0 : (best.minX + best.maxX + 1) / 2 / width,
    centerYRatio: best.count === 0 ? 0 : (best.minY + best.maxY + 1) / 2 / height,
    count: best.count,
  };
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

test("renders the selected container and keeps the fallback controls without WebGL", async ({ page }) => {
  await page.goto("/");
  await addContainer(page, "scene候補");
  await expect(page.getByRole("img", { name: previewName })).toBeVisible();
  await expect(page.getByRole("button", { name: "拡大" })).toBeVisible();
  await page.goto("/?forceWebgl2=unsupported");
  await expect(page.getByRole("img", { name: previewName })).toHaveCount(0);
  await expect(page.getByRole("button", { name: "元に戻す" })).toBeVisible();
});

test("keeps all-cargo selection and oriented dimensions available with no candidate", async ({ page }) => {
  await page.goto("/?forceWebgl2=unsupported");
  await addCargo(page, "候補なし積荷");
  await page.getByLabel("操作する積荷").selectOption("cargo-1");
  const card = page.locator(".scene-selection-card");
  await expect(card).toContainText("奥行方向 500 × 横幅方向 400 × 高さ方向 300 mm");
  await expect(card.getByRole("button", { name: "座標を入力して配置" })).toHaveAttribute("aria-disabled", "true");
});

test("searches all Project cargoes and identifies unplaced, current, and other-container states", async ({ page }) => {
  await page.goto("/?forceWebgl2=unsupported");
  await addCargo(page, "検索積荷A");
  await addCargo(page, "検索積荷B");
  await addContainer(page, "候補A");
  await addContainer(page, "候補B");
  await place(page, "cargo-1");
  await page.getByLabel("表示する候補").selectOption("container-2");
  await page.getByLabel("積荷を検索").fill("積荷A");
  await expect(page.getByLabel("操作する積荷").locator("option")).toHaveCount(2);
  await page.getByLabel("操作する積荷").selectOption("cargo-1");
  const card = page.locator(".scene-selection-card");
  await expect(card).toContainText("候補Aに配置済み");
  await expect(card.getByRole("button", { name: "候補Aを表示" })).toBeVisible();
});

test("saves a partial coordinate as an invalid repair-in-progress placement", async ({ page }) => {
  await page.goto("/?forceWebgl2=unsupported");
  await addCargo(page, "partial積荷");
  await addContainer(page, "partial候補");
  await place(page, "cargo-1", "-499", "0");
  await expect(page.locator("#scene-workspace-status")).toContainText("配置1件");
  await expect(page.locator(".physical-validation__summary")).toContainText("不適合");
});

test("commits a staged fine-pointer partial drop once and cancels its preview safely", async ({ page }) => {
  await page.goto("/");
  await addCargo(page, "staged-partial積荷");
  await addContainer(page, "staged-partial候補");
  const canvas = page.getByRole("img", { name: previewName });
  const card = page.locator(".scene-selection-card");
  const history = page.locator(".project-history__summary");
  const historyBefore = await history.textContent();

  let staged = await locateStagedCargoOnCanvas(canvas);
  await page.mouse.move(staged.point.x, staged.point.y);
  await page.mouse.down();
  await page.mouse.move(staged.bounds.x + staged.bounds.width * 0.52, staged.bounds.y + staged.bounds.height * 0.58, { steps: 8 });
  await page.keyboard.press("Escape");
  await page.mouse.up();
  await expect(card).toContainText("荷室外（未配置）");
  expect(await history.textContent()).toBe(historyBefore);

  let partialCommitted = false;
  for (const targetRatio of [0.36, 0.38, 0.4, 0.42, 0.44, 0.46, 0.48, 0.5]) {
    staged = await locateStagedCargoOnCanvas(canvas);
    await page.mouse.move(staged.point.x, staged.point.y);
    await page.mouse.down();
    await page.mouse.move(staged.bounds.x + staged.bounds.width * targetRatio, staged.bounds.y + staged.bounds.height * 0.58, { steps: 10 });
    await page.mouse.up();
    if ((await card.textContent())?.includes("現在の候補に配置済み") !== true) continue;
    await page.waitForTimeout(150);
    if ((await page.locator(".physical-validation__summary").textContent())?.includes("不適合")) {
      partialCommitted = true;
      break;
    }
    await page.getByRole("button", { name: "元に戻す" }).click();
    await expect(card).toContainText("荷室外（未配置）");
  }
  expect(partialCommitted).toBe(true);
  await expect(card).toContainText("現在の候補に配置済み");
  await expect(page.locator(".physical-validation__summary")).toContainText("不適合");
  await expect(history).toContainText("配置の追加");
  await page.getByRole("button", { name: "元に戻す" }).click();
  await expect(card).toContainText("荷室外（未配置）");
  await page.getByRole("button", { name: "やり直す" }).click();
  await expect(card).toContainText("現在の候補に配置済み");
});

test("returns a fully dragged-out placement to staging as one undoable deletion", async ({ page }) => {
  await page.goto("/");
  await addCargo(page, "drag-out積荷");
  await addContainer(page, "drag-out候補");
  await place(page, "cargo-1", "2100", "500");
  const canvas = page.getByRole("img", { name: previewName });
  const card = page.locator(".scene-selection-card");
  await page.getByLabel("操作する積荷").selectOption("");
  const cargoPoint = await selectCargoOnCanvas(page, canvas, card);
  await page.mouse.move(cargoPoint.x, cargoPoint.y);
  await page.mouse.down();
  await page.mouse.move(1, cargoPoint.y, { steps: 12 });
  await page.mouse.up();
  await expect(card).toContainText("荷室外（未配置）");
  await expect(page.locator(".viewport__staging-label")).toContainText("荷室外の作業スペース");
  await expect(page.locator(".project-history__summary")).toContainText("配置の削除");
  await page.getByRole("button", { name: "元に戻す" }).click();
  await expect(card).toContainText("現在の候補に配置済み");
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
  const card = page.locator(".scene-selection-card");
  const status = page.locator("#scene-workspace-action-status");
  const targets = [
    [0.5, 0.5],
    [0.5, 0.58],
    [0.45, 0.55],
    [0.55, 0.55],
    [0.45, 0.62],
    [0.55, 0.62],
  ] as const;
  let snapped = false;
  for (const [xRatio, yRatio] of targets) {
    const staged = await locateStagedCargoOnCanvas(canvas);
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
  await expect(card).toContainText("現在の候補に配置済み");
  await expect(card).toContainText("500 mm");
  await expect(page.locator(".physical-validation")).toContainText(
    "単一積荷の上面による幾何学的な支持は成立しています",
  );
  await expect(page.locator(".project-history__summary")).toContainText("配置の追加");
  await page.getByRole("button", { name: "元に戻す" }).click();
  await expect(card).toContainText("荷室外（未配置）");
  await page.getByRole("button", { name: "やり直す" }).click();
  await expect(card).toContainText("500 mm");
});

test("renders drag focus and restores normal cargo rendering after cancel", async ({
  page,
}) => {
  await page.goto("/");
  await addCargo(page, "集中表示の背景積荷");
  await addCargo(page, "集中表示の操作積荷");
  await addContainer(page, "集中表示候補");
  await place(page, "cargo-1", "2400", "700");
  await page.getByLabel("操作する積荷").selectOption("cargo-2");

  const canvas = page.getByRole("img", { name: previewName });
  const staged = await locateStagedCargoOnCanvas(canvas);
  const before = countTurquoisePixels(await canvas.screenshot());

  await page.mouse.move(staged.point.x, staged.point.y);
  await page.mouse.down();
  await page.mouse.move(staged.point.x + 12, staged.point.y, { steps: 6 });
  const during = countTurquoisePixels(await canvas.screenshot());
  expect(Math.abs(during - before)).toBeGreaterThan(20);

  await page.keyboard.press("Escape");
  await page.mouse.up();
  const restored = countTurquoisePixels(await canvas.screenshot());
  expect(Math.abs(restored - before)).toBeLessThanOrEqual(
    Math.max(10, Math.round(before * 0.03)),
  );
});

test("keeps placed selection no-op and partial drag atomic while preserving camera and page", async ({ page }) => {
  await page.goto("/");
  await addCargo(page, "placed-partial積荷");
  await addContainer(page, "placed-partial候補");
  await place(page, "cargo-1", "2100", "500");
  const canvas = page.getByRole("img", { name: previewName });
  const card = page.locator(".scene-selection-card");
  const history = page.locator(".project-history__summary");

  await page.getByLabel("操作する積荷").selectOption("");
  let cargoPoint = await selectCargoOnCanvas(page, canvas, card);
  const historyBeforeNoOp = await history.textContent();
  await page.mouse.move(cargoPoint.x, cargoPoint.y);
  await page.mouse.down();
  await page.mouse.up();
  expect(await history.textContent()).toBe(historyBeforeNoOp);

  const bounds = await canvas.boundingBox();
  if (bounds === null) throw new Error("3D canvas has no bounding box");
  let partialCommitted = false;
  for (const targetRatio of [0.36, 0.38, 0.4, 0.42, 0.44, 0.46, 0.48, 0.5]) {
    await page.getByLabel("操作する積荷").selectOption("");
    cargoPoint = await selectCargoOnCanvas(page, canvas, card);
    await page.mouse.move(cargoPoint.x, cargoPoint.y);
    await page.mouse.down();
    await page.mouse.move(bounds.x + bounds.width * targetRatio, bounds.y + bounds.height * 0.58, { steps: 10 });
    await page.mouse.up();
    await page.waitForTimeout(150);
    if (
      (await card.textContent())?.includes("現在の候補に配置済み") === true &&
      (await page.locator(".physical-validation__summary").textContent())?.includes("不適合") === true
    ) {
      partialCommitted = true;
      break;
    }
    await page.getByRole("button", { name: "元に戻す" }).click();
    await expect(card).toContainText("現在の候補に配置済み");
  }
  expect(partialCommitted).toBe(true);
  await expect(history).toContainText("3Dでの配置移動");
  await page.getByRole("button", { name: "拡大" }).click();
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
  await page.getByLabel("案件名").fill("未保存busy案件");
  await expect(z).toHaveAttribute("aria-disabled", "true");
  await z.click({ force: true });
  await expect(page.locator("#scene-workspace-action-status")).toContainText("別の案件操作または保存処理の完了後");
  await page.getByLabel("案件名").fill("新規案件");
  await expect(z).not.toHaveAttribute("aria-disabled", "true");
  expect(await page.locator(".project-history__summary").textContent()).toBe(historyBefore);
});

test("uses distinct focusable X and Z rotation icons and reports disabled reasons", async ({ page }) => {
  await page.goto("/");
  await addCargo(page, "天地無用積荷");
  await addContainer(page, "回転候補");
  await place(page);
  const x = page.getByRole("button", { name: "X軸を中心に90°回転" });
  const z = page.getByRole("button", { name: "Z軸を中心に90°回転" });
  await expect(x).toHaveAttribute("aria-disabled", "true");
  await expect(z).not.toHaveAttribute("aria-disabled", "true");
  await x.focus();
  await expect(x).toBeFocused();
  expect(await x.locator("path").first().getAttribute("d")).not.toBe(await z.locator("path").first().getAttribute("d"));
  await x.click({ force: true });
  await expect(page.locator("#scene-workspace-action-status")).toContainText("X軸回転は利用できません");
});

test("rotates a tip-enabled cargo around X and keeps it undoable", async ({ page }) => {
  await page.goto("/");
  await addCargo(page, "X回転積荷", true);
  await addContainer(page, "X回転候補");
  await place(page);
  const card = page.locator(".scene-selection-card");
  await page.getByRole("button", { name: "X軸を中心に90°回転" }).click();
  await card.getByText("保存上の詳細").click();
  await expect(card).toContainText("保存上の向きコード: LHW");
  await page.getByRole("button", { name: "元に戻す" }).click();
  await expect(card).toContainText("保存上の向きコード: LWH");
});

test("wheel over the viewport scrolls the page without changing history", async ({ page }) => {
  await page.goto("/");
  await addCargo(page, "wheel積荷");
  await addContainer(page, "wheel候補");
  const canvas = page.getByRole("img", { name: previewName });
  await canvas.scrollIntoViewIfNeeded();
  const before = await page.locator(".project-history__summary").textContent();
  await canvas.hover();
  await page.mouse.wheel(0, 240);
  expect(await page.evaluate<number>("scrollY")).toBeGreaterThan(0);
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
  await page.getByLabel("操作する積荷").selectOption("cargo-1");
  await page.getByRole("button", { name: "座標を入力して配置" }).click();
  await expect(page.getByRole("dialog", { name: "touch積荷" })).toBeVisible();
  expect(await page.evaluate<boolean>("document.documentElement.scrollWidth > document.documentElement.clientWidth")).toBe(false);
});

test("keeps the selection card compact as cargo count grows", async ({ page }) => {
  await page.goto("/?forceWebgl2=unsupported");
  await addContainer(page, "many候補");
  for (let index = 0; index < 6; index += 1) await addCargo(page, `many積荷${index}`);
  const card = page.locator(".scene-selection-card");
  const height = (await card.boundingBox())?.height ?? 0;
  await page.getByLabel("操作する積荷").selectOption("cargo-6");
  expect((await card.boundingBox())?.height ?? 0).toBeLessThanOrEqual(height + 220);
  await expect(page.getByText("6 / 1,000件")).toBeVisible();
});
