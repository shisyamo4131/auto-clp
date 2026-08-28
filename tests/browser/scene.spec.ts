import { expect, test, type Locator, type Page } from "@playwright/test";
import { inflateSync } from "node:zlib";

const previewName = "積荷を選択・床面移動できる3Dプレビュー";

async function addContainer(page: Page, name: string, lengthMm = "6000") {
  await page.getByRole("button", { name: "候補を追加" }).click();
  await page.getByLabel("候補名").fill(name);
  await page.getByLabel("内部長さ").fill(lengthMm);
  await page.getByLabel("内部幅").fill("2400");
  await page.getByLabel("内部高さ").fill("2600");
  await page.getByLabel("開口幅").fill("2399");
  await page.getByLabel("開口高さ").fill("2500");
  await page.getByLabel("総耐荷重").fill("100000");
  await page.getByRole("button", { name: "候補を保存" }).click();
}

async function addInteractiveCargo(
  page: Page,
  name: string,
  dimensions: {
    readonly lengthMm?: string;
    readonly widthMm?: string;
    readonly heightMm?: string;
    readonly singleOrientation?: boolean;
  } = {},
) {
  await page.getByRole("button", { name: "積荷を追加" }).click();
  await page.getByLabel("積荷名").fill(name);
  await page.getByLabel("長さ", { exact: true }).fill(dimensions.lengthMm ?? "1800");
  await page.getByLabel("幅", { exact: true }).fill(dimensions.widthMm ?? "1400");
  await page.getByLabel("高さ", { exact: true }).fill(dimensions.heightMm ?? "1000");
  await page.getByLabel("重量").fill("1.005");
  if (dimensions.singleOrientation === true) {
    await page.getByLabel(/WLH/).uncheck();
  }
  await page.getByRole("button", { name: "積荷を保存" }).click();
}

async function addValidationCargo(
  page: Page,
  name: string,
  options: {
    readonly lengthMm?: string;
    readonly widthMm?: string;
    readonly heightMm?: string;
    readonly canSupportCargo?: boolean;
  } = {},
) {
  await page.getByRole("button", { name: "積荷を追加" }).click();
  await page.getByLabel("積荷名").fill(name);
  await page.getByLabel("長さ", { exact: true }).fill(options.lengthMm ?? "100");
  await page.getByLabel("幅", { exact: true }).fill(options.widthMm ?? "100");
  await page.getByLabel("高さ", { exact: true }).fill(options.heightMm ?? "100");
  await page.getByLabel("重量").fill("1");
  if (options.canSupportCargo === true) {
    await page
      .getByLabel("この積荷の上面で別の積荷を幾何学的に支持できる")
      .check();
  }
  await page.getByRole("button", { name: "積荷を保存" }).click();
}

async function placeCargo(
  page: Page,
  cargoName: string,
  position: { readonly xMm?: string; readonly yMm?: string; readonly zMm?: string } = {},
) {
  const panel = page.locator(".placement-panel");
  await panel.getByRole("button", { name: `配置を追加: ${cargoName}` }).click();
  await page.getByLabel("X最小角").fill(position.xMm ?? "0");
  await page.getByLabel("Y最小角").fill(position.yMm ?? "0");
  await page.getByLabel("Z最小角").fill(position.zMm ?? "0");
  await panel.getByRole("button", { name: "配置を保存" }).click();
}

async function createInteractiveScene(page: Page) {
  await addInteractiveCargo(page, "合成canvas積荷");
  await addContainer(page, "合成canvas候補");
  const panel = page.locator(".placement-panel");
  await panel.getByRole("button", { name: "配置を追加: 合成canvas積荷" }).click();
  await page.getByLabel("X最小角").fill("2100");
  await page.getByLabel("Y最小角").fill("500");
  await page.getByLabel("Z最小角").fill("250");
  await page.getByLabel("向き").selectOption("WLH");
  await panel.getByRole("button", { name: "配置を保存" }).click();
  return {
    canvas: page.getByRole("img", { name: previewName }),
    panel,
    row: panel.getByRole("list", { name: "選択候補の配置一覧" }).getByRole("listitem"),
    sceneSelect: page.getByLabel("表示する候補"),
    status: page.locator("#scene-workspace-status"),
  };
}

async function selectCargoOnCanvas(
  page: Page,
  canvas: Locator,
  row: Locator,
) {
  await canvas.scrollIntoViewIfNeeded();
  const bounds = await canvas.boundingBox();
  if (bounds === null) {
    throw new Error("3D canvas has no bounding box");
  }
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
    if ((await row.getAttribute("aria-current")) === "true") {
      return point;
    }
  }
  throw new Error("Synthetic cargo was not hit by the tested canvas points");
}

async function locateStagedCargoOnCanvas(canvas: Locator) {
  await canvas.scrollIntoViewIfNeeded();
  const bounds = await canvas.boundingBox();
  if (bounds === null) {
    throw new Error("3D canvas has no bounding box");
  }
  const warmCargo = measureStagedCargo(await canvas.screenshot());
  expect(warmCargo.count).toBeGreaterThan(20);
  const point = {
    x: bounds.x + bounds.width * warmCargo.centerXRatio,
    y: bounds.y + bounds.height * warmCargo.centerYRatio,
  };
  return { bounds, point, warmCargo };
}

async function selectStagedCargoOnCanvas(page: Page, canvas: Locator) {
  const located = await locateStagedCargoOnCanvas(canvas);
  await page.mouse.click(located.point.x, located.point.y);
  return located;
}

async function placementSummary(row: Locator) {
  return (await row.locator(".placement-list__position").textContent()) ?? "";
}

async function expectNoHorizontalOverflow(page: Page) {
  const overflows = await page.evaluate(() => {
    const browserGlobal = globalThis as unknown as {
      readonly document: {
        readonly documentElement: { readonly scrollWidth: number; readonly clientWidth: number };
      };
    };
    const root = browserGlobal.document.documentElement;
    return root.scrollWidth > root.clientWidth;
  });
  expect(overflows).toBe(false);
}

interface ContainerFrameMeasurement {
  readonly count: number;
  readonly height: number;
  readonly width: number;
}

interface DecodedPng {
  readonly channels: number;
  readonly height: number;
  readonly pixels: Buffer;
  readonly stride: number;
  readonly width: number;
}

interface StagedCargoMeasurement {
  readonly centerXRatio: number;
  readonly centerYRatio: number;
  readonly count: number;
  readonly heightRatio: number;
  readonly widthRatio: number;
}

function paethPredictor(left: number, up: number, upperLeft: number): number {
  const estimate = left + up - upperLeft;
  const leftDistance = Math.abs(estimate - left);
  const upDistance = Math.abs(estimate - up);
  const upperLeftDistance = Math.abs(estimate - upperLeft);
  if (leftDistance <= upDistance && leftDistance <= upperLeftDistance) return left;
  return upDistance <= upperLeftDistance ? up : upperLeft;
}

function decodePng(image: Buffer): DecodedPng {
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
      const predictor =
        filter === 0
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

function measureContainerFrame(image: Buffer): ContainerFrameMeasurement {
  const { channels, height, pixels, stride, width } = decodePng(image);
  let count = 0;
  let minX = width;
  let minY = height;
  let maxX = -1;
  let maxY = -1;
  for (let y = 0; y < height; y += 1) {
    for (let x = 0; x < width; x += 1) {
      const pixelOffset = y * stride + x * channels;
      const red = pixels[pixelOffset]!;
      const green = pixels[pixelOffset + 1]!;
      const blue = pixels[pixelOffset + 2]!;
      if (green >= 60 && green >= red + 15 && blue >= red + 15) {
        count += 1;
        minX = Math.min(minX, x);
        minY = Math.min(minY, y);
        maxX = Math.max(maxX, x);
        maxY = Math.max(maxY, y);
      }
    }
  }
  return {
    count,
    height: count === 0 ? 0 : maxY - minY + 1,
    width: count === 0 ? 0 : maxX - minX + 1,
  };
}

function measureStagedCargo(image: Buffer): StagedCargoMeasurement {
  const { channels, height, pixels, stride, width } = decodePng(image);
  const measuredHeight = Math.floor(height * 0.9);
  const mask = new Uint8Array(width * measuredHeight);
  for (let y = 0; y < measuredHeight; y += 1) {
    for (let x = 0; x < width; x += 1) {
      const pixelOffset = y * stride + x * channels;
      const red = pixels[pixelOffset]!;
      const green = pixels[pixelOffset + 1]!;
      const blue = pixels[pixelOffset + 2]!;
      if (red >= 30 && red >= green + 8 && green >= blue + 5) {
        mask[y * width + x] = 1;
      }
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
        const neighborX = neighbor % width;
        if (
          neighbor < 0 ||
          neighbor >= mask.length ||
          (neighbor === pixelIndex - 1 && x === 0) ||
          (neighbor === pixelIndex + 1 && x === width - 1) ||
          neighborX < 0 ||
          mask[neighbor] !== 1
        ) {
          continue;
        }
        mask[neighbor] = 2;
        queue.push(neighbor);
      }
    }
    const area = (maxX - minX + 1) * (maxY - minY + 1);
    const density = count / area;
    if (density >= 0.12 && count > best.count) {
      best = { count, minX, minY, maxX, maxY };
    }
  }

  return {
    centerXRatio: best.count === 0 ? 0 : (best.minX + best.maxX + 1) / 2 / width,
    centerYRatio: best.count === 0 ? 0 : (best.minY + best.maxY + 1) / 2 / height,
    count: best.count,
    heightRatio: best.count === 0 ? 0 : (best.maxY - best.minY + 1) / height,
    widthRatio: best.count === 0 ? 0 : (best.maxX - best.minX + 1) / width,
  };
}

function expectSameContainerFrame(
  actual: ContainerFrameMeasurement,
  baseline: ContainerFrameMeasurement,
) {
  expect(baseline.count).toBeGreaterThan(100);
  expect(actual.count).toBeGreaterThanOrEqual(baseline.count * 0.85);
  expect(actual.count).toBeLessThanOrEqual(baseline.count * 1.15);
  expect(Math.abs(actual.width - baseline.width)).toBeLessThanOrEqual(4);
  expect(Math.abs(actual.height - baseline.height)).toBeLessThanOrEqual(4);
}

test("shows an empty unjudged scene with a supported canvas", async ({ page }) => {
  await page.goto("/");

  await expect(page.getByRole("status")).toHaveAttribute(
    "data-capability-state",
    "supported",
  );
  await expect(page.getByText("表示する候補がありません。案件入力でコンテナ・車両候補を追加してください。")).toBeVisible();
  await expect(page.getByText("候補0件、配置0件。物理判定の対象はありません。")).toBeVisible();
  const physicalPanel = page.locator(".physical-validation");
  await expect(physicalPanel.getByRole("heading", { name: "物理判定" })).toBeVisible();
  await expect(physicalPanel.locator(".physical-validation__summary")).toHaveText(
    "判定対象なし：候補コンテナを追加してください。",
  );
  await expect(physicalPanel.locator(".physical-validation__summary")).toHaveAttribute(
    "aria-live",
    "polite",
  );
  await expect(physicalPanel.locator(".physical-validation__summary")).toHaveAttribute(
    "aria-atomic",
    "true",
  );
  await expect(physicalPanel.getByRole("status")).toHaveCount(0);
  await expect(page.getByRole("img", { name: previewName })).toBeVisible();
});

test("stages an unplaced cargo and commits one in-container drag through history", async ({
  page,
}) => {
  await page.goto("/");
  await addInteractiveCargo(page, "合成仮置き積荷", {
    lengthMm: "500",
    widthMm: "400",
    heightMm: "300",
  });
  await addContainer(page, "合成仮置き候補");
  const canvas = page.getByRole("img", { name: previewName });
  const panel = page.locator(".placement-panel");
  const status = page.locator("#scene-workspace-status");
  const historySummary = page.locator(".project-history__summary");
  const emptyPlacement = page.getByText("この候補に配置された積荷はありません。");

  await expect(page.locator(".viewport__staging-label")).toHaveText("仮置き場 1件");
  await expect(status).toContainText("配置0件。仮置き場1件");
  await expect(emptyPlacement).toBeVisible();
  await expect(page.locator(".physical-validation__summary")).toHaveText(
    "適合：この候補には配置済みの積荷がありません。",
  );
  const historyBefore = await historySummary.textContent();
  const { bounds, point, warmCargo } = await selectStagedCargoOnCanvas(page, canvas);
  expect(warmCargo.centerXRatio).toBeGreaterThan(0);
  expect(warmCargo.centerXRatio).toBeLessThan(1);
  expect(warmCargo.centerYRatio).toBeGreaterThan(0);
  expect(warmCargo.centerYRatio).toBeLessThan(1);
  expect(warmCargo.widthRatio).toBeGreaterThan(0);
  expect(warmCargo.heightRatio).toBeGreaterThan(0);
  await expect(status).toContainText("選択中の積荷: 合成仮置き積荷");
  await expect(page.getByRole("button", { name: "床面で90°回転" })).toHaveCount(0);

  await page.mouse.move(point.x, point.y);
  await page.mouse.down();
  await page.mouse.move(point.x - 24, point.y - 8, { steps: 3 });
  await page.mouse.up();
  await expect(status).toContainText("積荷全体が荷室内に入っていないため配置せず");
  await expect(emptyPlacement).toBeVisible();
  await expect(page.locator(".viewport__staging-label")).toHaveText("仮置き場 1件");
  expect(await historySummary.textContent()).toBe(historyBefore);

  await page.mouse.move(point.x, point.y);
  await page.mouse.down();
  await page.mouse.move(bounds.x + bounds.width * 0.52, bounds.y + bounds.height * 0.58, {
    steps: 8,
  });
  await expect(status).toContainText("床面に平行な配置移動をプレビュー中です");
  await expect(emptyPlacement).toBeVisible();
  await expect(page.getByRole("button", { name: "元に戻す" })).toBeDisabled();
  await page.mouse.up();

  const row = panel
    .getByRole("list", { name: "選択候補の配置一覧" })
    .getByRole("listitem");
  await expect(row).toHaveCount(1);
  await expect(row).toHaveAttribute("aria-current", "true");
  await expect(row.locator(".placement-list__position")).toContainText(
    "床から下面まで 0 mm",
  );
  await expect(row.locator(".placement-list__size")).toContainText(
    "奥行方向 500 × 横幅方向 400 × 高さ方向 300 mm",
  );
  await expect(status).toContainText("合成仮置き積荷を荷室内");
  await expect(status).toContainText("配置1件。仮置き場0件");
  await expect(page.locator(".viewport__staging-label")).toHaveCount(0);
  await expect(page.getByRole("button", { name: "床面で90°回転" })).toBeVisible();
  await expect(historySummary).toContainText("次に元に戻せる操作: 配置の追加");

  await page.getByRole("button", { name: "元に戻す" }).click();
  await expect(emptyPlacement).toBeVisible();
  await expect(status).toContainText("選択中の積荷: 合成仮置き積荷");
  await expect(status).toContainText("配置0件。仮置き場1件");
  await expect(page.locator(".viewport__staging-label")).toHaveText("仮置き場 1件");
  await expect(page.getByRole("button", { name: "床面で90°回転" })).toHaveCount(0);

  await page.getByRole("button", { name: "やり直す" }).click();
  await expect(row).toHaveCount(1);
  await expect(row).toHaveAttribute("aria-current", "true");
  await expect(page.getByRole("button", { name: "床面で90°回転" })).toBeVisible();
});

test("returns a fully dragged-out placement to staging as one undoable deletion", async ({
  page,
}) => {
  await page.goto("/");
  const { canvas, row, status } = await createInteractiveScene(page);
  const originalSummary = await placementSummary(row);
  const originalDetails = await row.locator(".placement-list__details").textContent();
  const cargoPoint = await selectCargoOnCanvas(page, canvas, row);
  const bounds = await canvas.boundingBox();
  if (bounds === null) {
    throw new Error("3D canvas has no bounding box");
  }

  await page.mouse.move(cargoPoint.x, cargoPoint.y);
  await page.mouse.down();
  await page.mouse.move(1, cargoPoint.y, { steps: 12 });
  await page.mouse.up();

  await expect(row).toHaveCount(0);
  await expect(page.locator(".viewport__staging-label")).toHaveText("仮置き場 1件");
  await expect(status).toContainText("配置を削除して仮置き場へ戻しました");
  await expect(page.locator(".physical-validation__summary")).toHaveText(
    "適合：この候補には配置済みの積荷がありません。",
  );
  await expect(page.locator(".project-history__summary")).toContainText(
    "次に元に戻せる操作: 配置の削除。",
  );

  await page.getByRole("button", { name: "元に戻す" }).click();
  await expect(row).toHaveCount(1);
  expect(await placementSummary(row)).toBe(originalSummary);
  expect(await row.locator(".placement-list__details").textContent()).toBe(originalDetails);
  await expect(page.locator(".viewport__staging-label")).toHaveCount(0);

  await page.getByRole("button", { name: "やり直す" }).click();
  await expect(row).toHaveCount(0);
  await expect(page.locator(".viewport__staging-label")).toHaveText("仮置き場 1件");
});

test("shows result-oriented scene actions and opens the existing coordinate form", async ({
  page,
}) => {
  await page.goto("/");
  const cargoName = `選択中の長い合成積荷${"名".repeat(70)}`;
  await addInteractiveCargo(page, cargoName, {
    lengthMm: "500",
    widthMm: "400",
    heightMm: "300",
  });
  await addContainer(page, "選択操作用合成候補");
  const canvas = page.getByRole("img", { name: previewName });
  await selectStagedCargoOnCanvas(page, canvas);

  const card = page.locator(".scene-selection-card");
  const action = card.getByRole("button", { name: "座標を入力して配置" });
  const history = page.locator(".project-history");
  const historySummary = history.locator(".project-history__summary");
  const emptyPlacement = page.getByText("この候補に配置された積荷はありません。");
  await expect(card).toContainText(cargoName);
  await expect(card).toContainText("未配置（仮置き場）");
  await expect(card.locator(".scene-selection-card__size")).toHaveText(
    "大きさ: 奥行方向 500 × 横幅方向 400 × 高さ方向 300 mm",
  );
  await expect(card).not.toContainText("入口から手前面まで");
  await expect(card).not.toContainText("保存上の向きコード");
  await expect(action).toBeEnabled();
  await expect(history).toHaveCount(1);
  await expect(history.getByRole("heading", { name: "案件全体の操作" })).toBeVisible();
  expect(
    await page.locator(".scene-workspace__history").evaluate((element) =>
      element.firstElementChild?.classList.contains("project-history") === true &&
      element.nextElementSibling?.classList.contains("viewport") === true,
    ),
  ).toBe(true);

  await page.getByRole("button", { name: "元に戻す" }).focus();
  await page.keyboard.press("Tab");
  await expect(page.getByRole("button", { name: "拡大" })).toBeFocused();
  for (const width of [305, 320, 375]) {
    await page.setViewportSize({ width, height: 900 });
    await expectNoHorizontalOverflow(page);
    const cardBounds = await card.locator(".scene-selection-card__content").boundingBox();
    const actionBounds = await action.boundingBox();
    if (cardBounds === null || actionBounds === null) {
      throw new Error("Scene selection card has no narrow-width bounding box");
    }
    expect(actionBounds.width).toBeGreaterThanOrEqual(cardBounds.width - 2);
  }
  await page.setViewportSize({ width: 1280, height: 900 });

  const historyBefore = await historySummary.textContent();
  await page.evaluate(() => {
    const browserGlobal = globalThis as unknown as {
      placementFormScrollCount?: number;
      readonly Element: {
        readonly prototype: {
          scrollIntoView: (options?: unknown) => void;
        };
      };
    };
    browserGlobal.placementFormScrollCount = 0;
    const elementPrototype = browserGlobal.Element.prototype;
    const originalScrollIntoView = elementPrototype.scrollIntoView;
    elementPrototype.scrollIntoView = function scrollIntoView(this: {
      readonly classList: { contains: (name: string) => boolean };
    }, options?: unknown) {
      if (this.classList.contains("placement-form")) {
        browserGlobal.placementFormScrollCount =
          (browserGlobal.placementFormScrollCount ?? 0) + 1;
      }
      Reflect.apply(
        originalScrollIntoView,
        this,
        options === undefined ? [] : [options],
      );
    };
  });
  await action.focus();
  await page.keyboard.press("Enter");
  await expect(page.getByLabel("X最小角")).toBeFocused();
  expect(
    await page.evaluate(() => {
      const browserGlobal = globalThis as unknown as {
        readonly placementFormScrollCount?: number;
      };
      return browserGlobal.placementFormScrollCount ?? 0;
    }),
  ).toBe(1);
  await expect(page.getByLabel("X最小角")).toHaveValue("0");
  await expect(action).toBeDisabled();
  await expect(card).toContainText("開いている配置操作を完了すると座標入力を開けます");
  await expect(emptyPlacement).toBeVisible();
  await page.getByLabel("X最小角").fill("100");
  await page.getByLabel("Y最小角").fill("200");
  await page.getByLabel("向き").selectOption("WLH");
  await expect(page.getByLabel("向き").locator("option").nth(1)).toHaveText(
    "奥行方向 400 × 横幅方向 500 × 高さ方向 300 mm（元の高さが上）— 保存上の向きコード WLH",
  );
  await page.locator(".placement-panel").getByRole("button", { name: "配置を保存" }).click();

  await expect(historySummary).not.toHaveText(historyBefore ?? "");
  await expect(historySummary).toContainText("次に元に戻せる操作: 配置の追加。");
  await expect(card).toContainText("荷室内に配置済み");
  await expect(card.locator(".scene-selection-card__size")).toHaveText(
    "大きさ: 奥行方向 400 × 横幅方向 500 × 高さ方向 300 mm",
  );
  await expect(card.locator(".scene-selection-card__position")).toContainText(
    "入口から手前面まで 100 mm",
  );
  await expect(card.locator(".scene-selection-card__position")).toContainText(
    "入口から見て右壁から右側面まで 200 mm",
  );
  await expect(card.locator(".scene-selection-card__position")).toContainText(
    "床から下面まで 0 mm",
  );
  await expect(card.locator(".scene-selection-card__size")).not.toContainText("WLH");
  await expect(card.getByText("保存上の詳細", { exact: true })).toBeVisible();
  await expect(card.getByText("保存上の向きコード: WLH", { exact: true })).toBeHidden();

  const fineTune = card.getByRole("button", { name: "座標を微調整" });
  await fineTune.click();
  await expect(page.getByLabel("X最小角")).toBeFocused();
  await expect(page.getByLabel("X最小角")).toHaveValue("100");
  await expect(fineTune).toBeDisabled();
  await page.locator(".placement-panel").getByRole("button", { name: "配置編集をキャンセル" }).click();

  await page.locator(".placement-panel").getByRole("button", {
    name: `配置を削除: ${cargoName}`,
  }).click();
  await expect(fineTune).toBeDisabled();
  await expect(card).toContainText("開いている配置操作を完了すると座標入力を開けます");
  await page.locator(".placement-panel").getByRole("button", { name: "配置の削除をやめる" }).click();

  await page.getByRole("button", { name: "案件データを開く" }).click();
  await expect(fineTune).toBeEnabled();
  await page.getByRole("button", { name: "端末保存を削除" }).click();
  await expect(fineTune).toBeDisabled();
  await expect(card).toContainText("別の案件操作または保存処理を完了すると座標入力を開けます");
  await page.getByRole("button", { name: "削除をやめる" }).click();
  await expect(fineTune).toBeEnabled();
  await page.getByRole("button", { name: "案件データを閉じる" }).click();
  await expect(fineTune).toBeEnabled();

  await page.getByRole("button", { name: "元に戻す" }).click();
  await expect(card).toContainText("未配置（仮置き場）");
  await expect(card).not.toContainText("入口から手前面まで");
  await expect(card.getByRole("button", { name: "座標を入力して配置" })).toBeVisible();
});

test("keeps staged cargo touch interaction selection-only with the form fallback available", async ({
  page,
}) => {
  await page.goto("/");
  await addInteractiveCargo(page, "合成touch仮置き積荷", {
    lengthMm: "500",
    widthMm: "400",
    heightMm: "300",
  });
  await addContainer(page, "合成touch仮置き候補");
  const canvas = page.getByRole("img", { name: previewName });
  const { point } = await locateStagedCargoOnCanvas(canvas);
  const historySummary = page.locator(".project-history__summary");
  const historyBefore = await historySummary.textContent();

  await canvas.dispatchEvent("pointerdown", {
    bubbles: true,
    button: 0,
    clientX: point.x,
    clientY: point.y,
    pointerId: 41,
    pointerType: "touch",
  });
  await canvas.dispatchEvent("pointermove", {
    bubbles: true,
    buttons: 1,
    clientX: point.x + 120,
    clientY: point.y - 90,
    pointerId: 41,
    pointerType: "touch",
  });
  await canvas.dispatchEvent("pointerup", {
    bubbles: true,
    button: 0,
    clientX: point.x + 120,
    clientY: point.y - 90,
    pointerId: 41,
    pointerType: "touch",
  });

  await expect(page.locator("#scene-workspace-status")).toContainText(
    "選択中の積荷: 合成touch仮置き積荷",
  );
  await expect(page.getByText("この候補に配置された積荷はありません。")).toBeVisible();
  expect(await historySummary.textContent()).toBe(historyBefore);
  await expect(
    page.locator(".placement-panel").getByRole("button", {
      name: "配置を追加: 合成touch仮置き積荷",
    }),
  ).toBeVisible();
});

test("does not stage cargo that is already placed in another container", async ({ page }) => {
  await page.goto("/");
  await addInteractiveCargo(page, "合成別候補配置積荷", {
    lengthMm: "500",
    widthMm: "400",
    heightMm: "300",
  });
  await addContainer(page, "合成配置元候補");
  await placeCargo(page, "合成別候補配置積荷");
  await addContainer(page, "合成別候補");
  await page.getByLabel("表示する候補").selectOption({ label: "合成別候補" });

  await expect(page.locator("#scene-workspace-status")).toContainText(
    "選択中の候補: 合成別候補。配置0件。仮置き場0件",
  );
  await expect(page.locator(".viewport__staging-label")).toHaveCount(0);
  await expect(page.getByText("この候補に配置された積荷はありません。")).toBeVisible();
});

test("keeps scene selection stable across add, edit, switch, and delete", async ({ page }) => {
  await page.goto("/");
  const capabilityStatus = page.getByRole("status");
  await expect(capabilityStatus).toHaveAttribute(
    "data-capability-state",
    "supported",
  );

  await addContainer(page, "合成候補A");
  const sceneSelect = page.getByLabel("表示する候補");
  const physicalSummary = page.locator(".physical-validation__summary");
  await expect(sceneSelect).toHaveValue("container-1");
  await expect(page.getByText("選択中の候補: 合成候補A。配置0件。仮置き場0件。積荷は未選択です。物理判定は保存済み配置だけから自動更新されます。")).toBeVisible();
  await expect(physicalSummary).toHaveText("適合：この候補には配置済みの積荷がありません。");

  await addContainer(page, "合成候補B", "7001");
  await expect(sceneSelect).toHaveValue("container-1");
  const sceneStatus = page.locator("#scene-workspace-status");
  await expect(sceneStatus).toHaveAttribute("aria-live", "polite");
  await expect(sceneStatus).toHaveAttribute("aria-atomic", "true");
  await expect(capabilityStatus.getByLabel("表示する候補")).toHaveCount(0);
  await expect(capabilityStatus.getByRole("img", { name: previewName })).toHaveCount(0);
  const capabilityCopy = await capabilityStatus.textContent();
  await sceneSelect.selectOption({ label: "合成候補B" });
  await expect(sceneStatus).toHaveText("選択中の候補: 合成候補B。配置0件。仮置き場0件。積荷は未選択です。物理判定は保存済み配置だけから自動更新されます。");
  await expect(capabilityStatus).toHaveText(capabilityCopy ?? "");
  await expect(physicalSummary).toHaveText("適合：この候補には配置済みの積荷がありません。");

  await page.getByRole("button", { name: "編集: 合成候補B" }).click();
  await page.getByLabel("候補名").fill("合成候補B更新");
  await page.getByLabel("内部長さ").fill("8001");
  await page.getByRole("button", { name: "候補の変更を保存: 合成候補B" }).click();
  await expect(sceneSelect).toHaveValue("container-2");
  await expect(page.getByText("選択中の候補: 合成候補B更新。配置0件。仮置き場0件。積荷は未選択です。物理判定は保存済み配置だけから自動更新されます。")).toBeVisible();
  await expect(page.getByRole("img", { name: previewName })).toBeVisible();

  await page.getByRole("button", { name: "削除: 合成候補B更新" }).click();
  await page.getByRole("button", { name: "削除を確定: 合成候補B更新" }).click();
  await expect(sceneSelect).toHaveValue("container-1");
  await expect(page.getByText("選択中の候補: 合成候補A。配置0件。仮置き場0件。積荷は未選択です。物理判定は保存済み配置だけから自動更新されます。")).toBeVisible();
});

test("selects cargo, clears on blank space, and keeps clicks and camera controls non-mutating", async ({
  page,
}) => {
  await page.goto("/");
  const { canvas, panel, row, sceneSelect, status } = await createInteractiveScene(page);
  const originalSummary = await placementSummary(row);
  const touchAction = await canvas.evaluate((element) => {
    const canvasElement = element as unknown as {
      readonly style: { readonly touchAction: string };
    };
    const browserGlobal = globalThis as unknown as {
      getComputedStyle: (target: unknown) => { readonly touchAction: string };
    };
    return {
      computed: browserGlobal.getComputedStyle(element).touchAction,
      inline: canvasElement.style.touchAction,
    };
  });
  expect(touchAction).toEqual({ computed: "pan-y", inline: "pan-y" });
  const cargoPoint = await selectCargoOnCanvas(page, canvas, row);

  await expect(row).toHaveAttribute("aria-current", "true");
  await expect(row).toHaveClass(/placement-list__item--selected/);
  await expect(status).toContainText("選択中の積荷: 合成canvas積荷");

  await page.mouse.move(cargoPoint.x, cargoPoint.y);
  await page.mouse.down();
  await page.mouse.move(cargoPoint.x + 3, cargoPoint.y);
  await page.mouse.up();
  expect(await placementSummary(row)).toBe(originalSummary);
  await expect(sceneSelect).toBeEnabled();

  const bounds = await canvas.boundingBox();
  if (bounds === null) {
    throw new Error("3D canvas has no bounding box");
  }
  const blankPoint = { x: bounds.x + 8, y: bounds.y + bounds.height - 8 };
  await page.mouse.click(blankPoint.x, blankPoint.y);
  await expect(row).not.toHaveAttribute("aria-current", "true");
  await expect(status).toContainText("積荷は未選択です");

  await canvas.dispatchEvent("pointerdown", {
    bubbles: true,
    button: 0,
    clientX: cargoPoint.x,
    clientY: cargoPoint.y,
    pointerId: 41,
    pointerType: "touch",
  });
  await canvas.dispatchEvent("pointermove", {
    bubbles: true,
    button: 0,
    clientX: cargoPoint.x + 80,
    clientY: cargoPoint.y + 30,
    pointerId: 41,
    pointerType: "touch",
  });
  await canvas.dispatchEvent("pointerup", {
    bubbles: true,
    button: 0,
    clientX: cargoPoint.x,
    clientY: cargoPoint.y,
    pointerId: 41,
    pointerType: "touch",
  });
  await expect(row).toHaveAttribute("aria-current", "true");
  expect(await placementSummary(row)).toBe(originalSummary);
  await expect(sceneSelect).toBeEnabled();
  await expect(panel.getByRole("button", { name: "編集: 合成canvas積荷" })).toBeEnabled();

  await canvas.dispatchEvent("pointerdown", {
    bubbles: true,
    button: 0,
    clientX: blankPoint.x,
    clientY: blankPoint.y,
    pointerId: 42,
    pointerType: "touch",
  });
  await canvas.dispatchEvent("pointermove", {
    bubbles: true,
    button: 0,
    clientX: blankPoint.x + 70,
    clientY: blankPoint.y - 40,
    pointerId: 42,
    pointerType: "touch",
  });
  await canvas.dispatchEvent("pointerup", {
    bubbles: true,
    button: 0,
    clientX: blankPoint.x + 70,
    clientY: blankPoint.y - 40,
    pointerId: 42,
    pointerType: "touch",
  });
  await expect(row).not.toHaveAttribute("aria-current", "true");
  expect(await placementSummary(row)).toBe(originalSummary);
  await expect(sceneSelect).toBeEnabled();
  await expect(panel.getByRole("button", { name: "編集: 合成canvas積荷" })).toBeEnabled();

  await page.mouse.move(blankPoint.x, blankPoint.y);
  await page.mouse.down();
  await page.mouse.move(blankPoint.x + 45, blankPoint.y - 35, { steps: 3 });
  await page.mouse.up();
  const historyBeforeCameraButtons = await page
    .locator(".project-history__summary")
    .textContent();
  await canvas.hover();
  const scrollBeforeWheel = await page.evaluate(() => {
    const browserGlobal = globalThis as unknown as {
      readonly document: { readonly documentElement: { readonly scrollHeight: number } };
      readonly innerHeight: number;
      readonly scrollY: number;
    };
    return {
      maximum:
        browserGlobal.document.documentElement.scrollHeight - browserGlobal.innerHeight,
      y: browserGlobal.scrollY,
    };
  });
  const wheelDelta = scrollBeforeWheel.y < scrollBeforeWheel.maximum ? 240 : -240;
  const beforeWheel = await canvas.screenshot();
  await page.mouse.wheel(0, wheelDelta);
  await expect
    .poll(() =>
      page.evaluate(
        () =>
          (globalThis as unknown as { readonly scrollY: number }).scrollY,
      ),
    )
    .not.toBe(scrollBeforeWheel.y);
  const afterWheel = await canvas.screenshot();
  expect(afterWheel.equals(beforeWheel)).toBe(true);
  expect(await page.locator(".project-history__summary").textContent()).toBe(
    historyBeforeCameraButtons,
  );
  const beforeZoom = await canvas.screenshot();
  await page.getByRole("button", { name: "拡大" }).click();
  const afterZoom = await canvas.screenshot();
  expect(afterZoom.equals(beforeZoom)).toBe(false);
  const initialContainerView = await canvas.screenshot();
  const zoomOut = page.getByRole("button", { name: "縮小" });
  for (let index = 0; index < 6; index += 1) {
    await zoomOut.click();
  }
  const zoomedOutView = await canvas.screenshot();
  expect(zoomedOutView.equals(initialContainerView)).toBe(false);
  await page.getByRole("button", { name: "荷室全体を表示" }).click();
  expect(await placementSummary(row)).toBe(originalSummary);
  expect(await page.locator(".project-history__summary").textContent()).toBe(
    historyBeforeCameraButtons,
  );
  await expect(sceneSelect).toBeEnabled();
});

test("rotates a selected cargo once beside the mesh and preserves its minimum corner through history", async ({
  page,
}) => {
  await page.goto("/");
  const { canvas, row, status } = await createInteractiveScene(page);
  const rotationButton = page.getByRole("button", { name: "床面で90°回転" });
  const rotationCard = page.locator(".viewport__cargo-action");
  const cameraControls = page.getByRole("group", { name: "3D表示の視点操作" });
  await expect(rotationButton).toHaveCount(0);
  const originalSummary = await placementSummary(row);
  const cargoPoint = await selectCargoOnCanvas(page, canvas, row);

  await expect(rotationButton).toBeVisible();
  const canvasBounds = await canvas.boundingBox();
  const cardBounds = await rotationCard.boundingBox();
  const cameraControlsBounds = await cameraControls.boundingBox();
  if (
    canvasBounds === null ||
    cardBounds === null ||
    cameraControlsBounds === null
  ) {
    throw new Error("3D canvas or contextual rotation control has no bounding box");
  }
  expect(cardBounds.x).toBeGreaterThanOrEqual(canvasBounds.x);
  expect(cardBounds.y).toBeGreaterThanOrEqual(canvasBounds.y);
  expect(cardBounds.x + cardBounds.width).toBeLessThanOrEqual(
    canvasBounds.x + canvasBounds.width,
  );
  expect(cardBounds.y + cardBounds.height).toBeLessThanOrEqual(
    canvasBounds.y + canvasBounds.height,
  );
  expect(
    cardBounds.x < cameraControlsBounds.x + cameraControlsBounds.width &&
      cardBounds.x + cardBounds.width > cameraControlsBounds.x &&
      cardBounds.y < cameraControlsBounds.y + cameraControlsBounds.height &&
      cardBounds.y + cardBounds.height > cameraControlsBounds.y,
  ).toBe(false);
  const cargoControlMarginPx = 96;
  expect(cargoPoint.x).toBeGreaterThanOrEqual(cardBounds.x - cargoControlMarginPx);
  expect(cargoPoint.x).toBeLessThanOrEqual(
    cardBounds.x + cardBounds.width + cargoControlMarginPx,
  );
  expect(cargoPoint.y).toBeGreaterThanOrEqual(cardBounds.y - cargoControlMarginPx);
  expect(cargoPoint.y).toBeLessThanOrEqual(
    cardBounds.y + cardBounds.height + cargoControlMarginPx,
  );

  await page.getByRole("button", { name: "拡大" }).click();
  await expect(row).toHaveAttribute("aria-current", "true");
  await expect(rotationButton).toBeVisible();
  await expect
    .poll(async () => {
      const trackedBounds = await rotationCard.boundingBox();
      return trackedBounds === null
        ? 0
        : Math.hypot(
            trackedBounds.x - cardBounds.x,
            trackedBounds.y - cardBounds.y,
          );
    })
    .toBeGreaterThan(2);

  await rotationButton.focus();
  await page.keyboard.press("Enter");
  await expect(rotationButton).toBeFocused();
  await expect(row.locator(".placement-list__position")).toHaveText(
    "位置: 入口から手前面まで 2100 mm / 入口から見て右壁から右側面まで 500 mm / 床から下面まで 250 mm",
  );
  await expect(row).toHaveAttribute("aria-current", "true");
  await expect(status).toContainText("床面で90°回転しました");
  await expect(status).toContainText("最小角X 2100・Y 500・Z 250 mmは保持しています");
  await expect(page.locator(".project-history__summary")).toContainText(
    "次に元に戻せる操作: 配置の更新。",
  );

  await page.getByRole("button", { name: "元に戻す" }).click();
  expect(await placementSummary(row)).toBe(originalSummary);
  await expect(page.locator(".project-history__summary")).toContainText(
    "次にやり直せる操作: 配置の更新。",
  );
  await page.getByRole("button", { name: "やり直す" }).click();
  await expect(row.locator(".placement-list__position")).toHaveText(
    "位置: 入口から手前面まで 2100 mm / 入口から見て右壁から右側面まで 500 mm / 床から下面まで 250 mm",
  );

  await page.setViewportSize({ width: 305, height: 900 });
  await expect(rotationButton).toBeVisible();
  await expectNoHorizontalOverflow(page);
  const narrowCanvasBounds = await canvas.boundingBox();
  const narrowCardBounds = await rotationCard.boundingBox();
  const narrowCameraControlsBounds = await cameraControls.boundingBox();
  if (
    narrowCanvasBounds === null ||
    narrowCardBounds === null ||
    narrowCameraControlsBounds === null
  ) {
    throw new Error("Narrow 3D canvas or contextual rotation control has no bounding box");
  }
  expect(narrowCardBounds.x).toBeGreaterThanOrEqual(narrowCanvasBounds.x);
  expect(narrowCardBounds.x + narrowCardBounds.width).toBeLessThanOrEqual(
    narrowCanvasBounds.x + narrowCanvasBounds.width,
  );
  expect(
    narrowCardBounds.x <
      narrowCameraControlsBounds.x + narrowCameraControlsBounds.width &&
      narrowCardBounds.x + narrowCardBounds.width > narrowCameraControlsBounds.x &&
      narrowCardBounds.y <
        narrowCameraControlsBounds.y + narrowCameraControlsBounds.height &&
      narrowCardBounds.y + narrowCardBounds.height > narrowCameraControlsBounds.y,
  ).toBe(false);
});

test("explains why floor rotation is unavailable for a single-orientation cargo", async ({
  page,
}) => {
  await page.goto("/");
  await addInteractiveCargo(page, "向き固定合成積荷", {
    singleOrientation: true,
  });
  await addContainer(page, "向き固定合成候補");
  await placeCargo(page, "向き固定合成積荷", {
    xMm: "2100",
    yMm: "500",
    zMm: "250",
  });
  const panel = page.locator(".placement-panel");
  const row = panel
    .getByRole("list", { name: "選択候補の配置一覧" })
    .getByRole("listitem");
  const canvas = page.getByRole("img", { name: previewName });
  await selectCargoOnCanvas(page, canvas, row);

  const rotationButton = page.getByRole("button", { name: "床面で90°回転" });
  await expect(rotationButton).toBeVisible();
  await expect(rotationButton).toBeDisabled();
  await expect(
    page.getByText("この積荷では床面90°回転後の向きが許可されていません。", {
      exact: true,
    }),
  ).toBeVisible();
  await expect(rotationButton).toHaveAttribute(
    "aria-describedby",
    "viewport-floor-rotation-explanation",
  );
  await expect(row.locator(".placement-list__details")).toContainText(
    "保存上の向きコード: LWH",
  );
});

test("restores a container-sized view when cargo is saved at an extreme coordinate", async ({
  page,
}) => {
  await page.goto("/");
  await addInteractiveCargo(page, "合成遠方積荷", {
    lengthMm: "1200",
    widthMm: "800",
    heightMm: "600",
  });
  await addContainer(page, "合成遠方候補");
  const canvas = page.getByRole("img", { name: previewName });
  await expect(canvas).toBeVisible();
  const baselineContainerFrame = measureContainerFrame(await canvas.screenshot());
  const panel = page.locator(".placement-panel");
  await panel.getByRole("button", { name: "配置を追加: 合成遠方積荷" }).click();
  await page.getByLabel("X最小角").fill("1000000");
  await page.getByLabel("Y最小角").fill("0");
  await page.getByLabel("Z最小角").fill("0");
  await panel.getByRole("button", { name: "配置を保存" }).click();
  const row = panel
    .getByRole("list", { name: "選択候補の配置一覧" })
    .getByRole("listitem");
  await expect(row.locator(".placement-list__position")).toContainText(
    "入口から手前面まで 1000000 mm",
  );
  const initialExtremeContainerFrame = measureContainerFrame(await canvas.screenshot());
  expectSameContainerFrame(initialExtremeContainerFrame, baselineContainerFrame);
  const placementBeforeCameraActions = await placementSummary(row);
  const historyBeforeCameraActions = await page
    .locator(".project-history__summary")
    .textContent();

  await page.getByRole("button", { name: "縮小" }).click();
  await page.getByRole("button", { name: "荷室全体を表示" }).click();

  const restoredContainerFrame = measureContainerFrame(await canvas.screenshot());
  expectSameContainerFrame(restoredContainerFrame, baselineContainerFrame);
  expect(await placementSummary(row)).toBe(placementBeforeCameraActions);
  expect(await page.locator(".project-history__summary").textContent()).toBe(
    historyBeforeCameraActions,
  );
});

test("commits one fine-pointer floor drag and synchronizes the placement form", async ({
  page,
}) => {
  await page.goto("/");
  const { canvas, panel, row, sceneSelect, status } = await createInteractiveScene(page);
  const originalSummary = await placementSummary(row);
  const cargoPoint = await selectCargoOnCanvas(page, canvas, row);
  const rotationButton = page.getByRole("button", { name: "床面で90°回転" });
  const coordinateButton = page.getByRole("button", { name: "座標を微調整" });
  const editButton = panel.getByRole("button", { name: "編集: 合成canvas積荷" });
  const undo = page.getByRole("button", { name: "元に戻す" });
  const redo = page.getByRole("button", { name: "やり直す" });
  const persistenceEntry = page.getByRole("button", { name: "案件データを開く" });

  await page.mouse.move(cargoPoint.x, cargoPoint.y);
  await page.mouse.down();
  await page.mouse.move(cargoPoint.x + 70, cargoPoint.y + 24, { steps: 4 });
  await expect(sceneSelect).toBeDisabled();
  await expect(editButton).toBeDisabled();
  await expect(rotationButton).toBeDisabled();
  await expect(coordinateButton).toBeDisabled();
  await expect(page.locator(".scene-selection-card")).toContainText(
    "3D移動を完了すると座標入力を開けます",
  );
  await expect(undo).toBeDisabled();
  await expect(redo).toBeDisabled();
  await persistenceEntry.evaluate((element) =>
    (element as unknown as { click(): void }).click(),
  );
  await expect(page.getByRole("button", { name: "端末へ保存" })).toBeDisabled();
  await expect(page.getByRole("button", { name: "JSONを書き出す" })).toBeDisabled();
  expect(await placementSummary(row)).toBe(originalSummary);
  await page.mouse.up();
  await page.getByRole("button", { name: "案件データを閉じる" }).click();

  await expect(sceneSelect).toBeEnabled();
  await expect(editButton).toBeEnabled();
  await expect(row.locator(".placement-list__position")).not.toHaveText(originalSummary);
  const movedSummary = await placementSummary(row);
  expect(movedSummary).toMatch(
    /^位置: 入口から手前面まで -?\d+ mm \/ 入口から見て右壁から右側面まで -?\d+ mm \/ 床から下面まで 250 mm$/,
  );
  const statusText = (await status.textContent()) ?? "";
  expect(statusText.match(/移動しました/g)).toHaveLength(1);
  await expect(status).toContainText("物理判定の再計算を開始しました");
  await expect(page.locator(".physical-validation__summary")).toHaveText(
    "不適合：修正が必要な理由が1件あります。未確認事項1件も保持して表示します。",
  );
  await expect(page.locator(".project-history__summary")).toContainText(
    "次に元に戻せる操作: 3Dでの配置移動。",
  );
  await undo.click();
  expect(await placementSummary(row)).toBe(originalSummary);
  await redo.click();
  expect(await placementSummary(row)).toBe(movedSummary);

  const match = movedSummary.match(
    /入口から手前面まで (-?\d+) mm \/ 入口から見て右壁から右側面まで (-?\d+) mm \/ 床から下面まで (-?\d+) mm/,
  );
  expect(match).not.toBeNull();
  await editButton.click();
  await expect(page.getByLabel("X最小角")).toHaveValue(match?.[1] ?? "");
  await expect(page.getByLabel("Y最小角")).toHaveValue(match?.[2] ?? "");
  await expect(page.getByLabel("Z最小角")).toHaveValue("250");
  await expect(page.getByLabel("向き")).toHaveValue("WLH");
  await expect(sceneSelect).toBeDisabled();
  await panel.getByRole("button", { name: "配置編集をキャンセル" }).click();
  await expect(sceneSelect).toBeEnabled();
});

test("rejects a placed-cargo canvas update while import is active and rolls the preview back", async ({
  page,
}) => {
  await page.addInitScript(() => {
    type WorkerConstructor = new (
      scriptUrl: string | URL,
      options?: { readonly type?: string },
    ) => object;
    interface PendingRequest {
      readonly requestId: number;
      readonly worker: ControlledPreflightWorker;
    }
    const browserGlobal = globalThis as unknown as {
      Worker: WorkerConstructor;
      __hasPendingProjectImportPreflight: () => boolean;
      __releaseProjectImportPreflight: () => void;
    };
    const NativeWorker = browserGlobal.Worker;
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
    class RoutingWorker {
      constructor(scriptUrl: string | URL, options?: { readonly type?: string }) {
        if (String(scriptUrl).includes("project-import-preflight.worker")) {
          return new ControlledPreflightWorker();
        }
        return new NativeWorker(scriptUrl, options);
      }
    }
    browserGlobal.__hasPendingProjectImportPreflight = () => pending !== undefined;
    browserGlobal.__releaseProjectImportPreflight = () => {
      const current = pending;
      pending = undefined;
      current?.worker.release(current.requestId);
    };
    browserGlobal.Worker = RoutingWorker as unknown as WorkerConstructor;
  });
  await page.goto("/");
  const { canvas, row, status } = await createInteractiveScene(page);
  const originalSummary = await placementSummary(row);
  const historySummary = page.locator(".project-history__summary");
  const historyBefore = await historySummary.textContent();
  const cargoPoint = await selectCargoOnCanvas(page, canvas, row);
  const persistenceStatus = page.locator(".project-persistence__status");

  await page.locator("input[type='file']").setInputFiles({
    name: "anonymous-project.json",
    mimeType: "application/json",
    buffer: Buffer.from(
      JSON.stringify({
        schemaVersion: "0.1.0",
        projectId: "scene-import",
        name: "置換を拒否する案件",
        clearancesMm: { xMm: 0, yMm: 0, zMm: 0 },
        cargoes: [],
        containers: [],
        placements: [],
      }),
    ),
  });
  await expect(persistenceStatus).toContainText("処理中です");
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
  await expect(page.getByRole("button", { name: "元に戻す" })).toBeDisabled();

  await page.mouse.move(cargoPoint.x, cargoPoint.y);
  await page.mouse.down();
  await page.mouse.move(cargoPoint.x + 70, cargoPoint.y + 24, { steps: 4 });
  await expect(status).toContainText("床面に平行な配置移動をプレビュー中です");
  await expect(persistenceStatus).toContainText("処理中です");
  await page.mouse.up();

  await expect(status).toContainText("案件が更新されたため移動を保存できませんでした");
  expect(await placementSummary(row)).toBe(originalSummary);
  await page.evaluate(() => {
    const browserGlobal = globalThis as unknown as {
      __releaseProjectImportPreflight: () => void;
    };
    browserGlobal.__releaseProjectImportPreflight();
  });
  await expect(persistenceStatus).toContainText("操作中に案件が更新されたため");
  expect(await placementSummary(row)).toBe(originalSummary);
  expect(await historySummary.textContent()).toBe(historyBefore);
  await expect(page.getByTestId("canonical-project-settings")).toContainText("新規案件");
  await expect(page.getByText("置換を拒否する案件")).toHaveCount(0);
});

test("rejects a staged-cargo canvas add while import is active and rolls the preview back", async ({
  page,
}) => {
  await page.addInitScript(() => {
    type WorkerConstructor = new (
      scriptUrl: string | URL,
      options?: { readonly type?: string },
    ) => object;
    interface PendingRequest {
      readonly requestId: number;
      readonly worker: ControlledPreflightWorker;
    }
    const browserGlobal = globalThis as unknown as {
      Worker: WorkerConstructor;
      __hasPendingProjectImportPreflight: () => boolean;
      __releaseProjectImportPreflight: () => void;
    };
    const NativeWorker = browserGlobal.Worker;
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
    class RoutingWorker {
      constructor(scriptUrl: string | URL, options?: { readonly type?: string }) {
        if (String(scriptUrl).includes("project-import-preflight.worker")) {
          return new ControlledPreflightWorker();
        }
        return new NativeWorker(scriptUrl, options);
      }
    }
    browserGlobal.__hasPendingProjectImportPreflight = () => pending !== undefined;
    browserGlobal.__releaseProjectImportPreflight = () => {
      const current = pending;
      pending = undefined;
      current?.worker.release(current.requestId);
    };
    browserGlobal.Worker = RoutingWorker as unknown as WorkerConstructor;
  });
  await page.goto("/");
  await addInteractiveCargo(page, "合成stale仮置き積荷", {
    lengthMm: "500",
    widthMm: "400",
    heightMm: "300",
  });
  await addContainer(page, "合成stale仮置き候補");
  const canvas = page.getByRole("img", { name: previewName });
  const status = page.locator("#scene-workspace-status");
  const emptyPlacement = page.getByText("この候補に配置された積荷はありません。");
  const historySummary = page.locator(".project-history__summary");
  const historyBefore = await historySummary.textContent();
  const { bounds, point: cargoPoint } = await selectStagedCargoOnCanvas(page, canvas);
  const persistenceStatus = page.locator(".project-persistence__status");

  await page.locator("input[type='file']").setInputFiles({
    name: "anonymous-project.json",
    mimeType: "application/json",
    buffer: Buffer.from(
      JSON.stringify({
        schemaVersion: "0.1.0",
        projectId: "scene-import",
        name: "置換を拒否する案件",
        clearancesMm: { xMm: 0, yMm: 0, zMm: 0 },
        cargoes: [],
        containers: [],
        placements: [],
      }),
    ),
  });
  await expect(persistenceStatus).toContainText("処理中です");
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
  await expect(page.getByRole("button", { name: "元に戻す" })).toBeDisabled();

  await page.mouse.move(cargoPoint.x, cargoPoint.y);
  await page.mouse.down();
  await page.mouse.move(bounds.x + bounds.width * 0.52, bounds.y + bounds.height * 0.58, {
    steps: 8,
  });
  await expect(status).toContainText("床面に平行な配置移動をプレビュー中です");
  await expect(persistenceStatus).toContainText("処理中です");
  await page.mouse.up();

  await expect(status).toContainText("案件が更新されたため配置を保存できませんでした");
  await expect(emptyPlacement).toBeVisible();
  await expect(page.locator(".viewport__staging-label")).toHaveText("仮置き場 1件");
  await expect(page.getByTestId("canonical-project-settings")).toContainText("新規案件");
  await page.evaluate(() => {
    const browserGlobal = globalThis as unknown as {
      __releaseProjectImportPreflight: () => void;
    };
    browserGlobal.__releaseProjectImportPreflight();
  });
  await expect(persistenceStatus).toContainText("操作中に案件が更新されたため");
  expect(await historySummary.textContent()).toBe(historyBefore);
  await expect(emptyPlacement).toBeVisible();
  await expect(page.locator(".viewport__staging-label")).toHaveText("仮置き場 1件");
  await expect(page.getByTestId("canonical-project-settings")).toContainText("新規案件");
  await expect(page.getByText("置換を拒否する案件")).toHaveCount(0);
});

test("rolls an active canvas drag back on Escape, pointer cancellation, and window blur", async ({
  page,
}) => {
  await page.goto("/");
  const { canvas, row, sceneSelect, status } = await createInteractiveScene(page);
  const originalSummary = await placementSummary(row);
  const cargoPoint = await selectCargoOnCanvas(page, canvas, row);
  const historySummary = page.locator(".project-history__summary");
  const undo = page.getByRole("button", { name: "元に戻す" });
  const beforeHistory = await historySummary.textContent();
  const persistenceEntry = page.getByRole("button", { name: "案件データを開く" });

  await page.mouse.move(cargoPoint.x, cargoPoint.y);
  await page.mouse.down();
  await page.mouse.move(cargoPoint.x + 60, cargoPoint.y + 20, { steps: 3 });
  await expect(sceneSelect).toBeDisabled();
  await expect(undo).toBeDisabled();
  await persistenceEntry.evaluate((element) =>
    (element as unknown as { click(): void }).click(),
  );
  await expect(page.getByRole("button", { name: "端末へ保存" })).toBeDisabled();
  await page
    .getByRole("button", { name: "案件データを閉じる" })
    .evaluate((element) => (element as unknown as { click(): void }).click());
  await expect(persistenceEntry).toHaveAttribute("aria-expanded", "false");
  await page.keyboard.press("Escape");
  await page.mouse.up();
  await expect(sceneSelect).toBeEnabled();
  await expect(status).toContainText("Escapeキーで配置の移動をキャンセルしました");
  expect(await placementSummary(row)).toBe(originalSummary);
  expect(await historySummary.textContent()).toBe(beforeHistory);
  const cargoPointAfterModal = await selectCargoOnCanvas(page, canvas, row);

  await page.mouse.move(cargoPointAfterModal.x, cargoPointAfterModal.y);
  await page.mouse.down();
  await page.mouse.move(cargoPointAfterModal.x - 60, cargoPointAfterModal.y + 20, {
    steps: 3,
  });
  await expect(sceneSelect).toBeDisabled();
  await canvas.dispatchEvent("pointercancel", {
    bubbles: true,
    pointerId: 1,
    pointerType: "mouse",
  });
  await page.mouse.up();
  await expect(sceneSelect).toBeEnabled();
  await expect(status).toContainText("ポインター操作が中断されたため");
  expect(await placementSummary(row)).toBe(originalSummary);
  expect(await historySummary.textContent()).toBe(beforeHistory);

  await page.mouse.move(cargoPointAfterModal.x, cargoPointAfterModal.y);
  await page.mouse.down();
  await page.mouse.move(cargoPointAfterModal.x + 55, cargoPointAfterModal.y - 20, {
    steps: 3,
  });
  await expect(sceneSelect).toBeDisabled();
  await page.evaluate(() => {
    const browserGlobal = globalThis as unknown as {
      readonly Event: new (type: string) => unknown;
      dispatchEvent: (event: unknown) => boolean;
    };
    browserGlobal.dispatchEvent(new browserGlobal.Event("blur"));
  });
  await page.mouse.up();
  await expect(sceneSelect).toBeEnabled();
  await expect(status).toContainText("ウィンドウの操作が中断されたため");
  expect(await placementSummary(row)).toBe(originalSummary);
  expect(await historySummary.textContent()).toBe(beforeHistory);
});

test("rolls an active drag back and unlocks the form when the WebGL context is lost", async ({
  page,
}) => {
  await page.goto("/");
  const capabilityStatus = page.getByRole("status");
  const { canvas, panel, row, sceneSelect, status } = await createInteractiveScene(page);
  const originalSummary = await placementSummary(row);
  const cargoPoint = await selectCargoOnCanvas(page, canvas, row);
  const editButton = panel.getByRole("button", { name: "編集: 合成canvas積荷" });

  await page.mouse.move(cargoPoint.x, cargoPoint.y);
  await page.mouse.down();
  await page.mouse.move(cargoPoint.x + 65, cargoPoint.y + 22, { steps: 3 });
  await expect(status).toContainText("床面に平行な配置移動をプレビュー中です");
  await expect(sceneSelect).toBeDisabled();
  await expect(editButton).toBeDisabled();
  expect(await placementSummary(row)).toBe(originalSummary);

  await canvas.evaluate((element) => {
    element.dispatchEvent(new Event("webglcontextlost", { cancelable: true }));
  });
  await page.mouse.up();

  await expect(capabilityStatus).toHaveAttribute("data-capability-state", "renderer-error");
  await expect(page.getByRole("heading", { name: "3D表示で問題が発生しました" })).toBeVisible();
  await expect(page.locator(".physical-validation")).toBeVisible();
  await expect(page.locator(".physical-validation__summary")).toContainText("不適合：");
  await expect(canvas).toHaveCount(0);
  await expect(sceneSelect).toBeEnabled();
  await expect(editButton).toBeEnabled();
  expect(await placementSummary(row)).toBe(originalSummary);
});

test("keeps scene input available without WebGL and does not mount a canvas", async ({
  page,
}) => {
  await page.goto("/?forceWebgl2=unsupported");

  await expect(page.getByRole("status")).toHaveAttribute(
    "data-capability-state",
    "unsupported",
  );
  await expect(page.getByRole("img", { name: previewName })).toHaveCount(0);
  await addContainer(page, "非対応時の合成候補");
  await expect(page.getByLabel("表示する候補")).toHaveValue("container-1");
  await expect(page.getByText("選択中の候補: 非対応時の合成候補。配置0件。仮置き場0件。積荷は未選択です。物理判定は保存済み配置だけから自動更新されます。")).toBeVisible();
  await expect(page.locator(".physical-validation__summary")).toHaveText(
    "適合：この候補には配置済みの積荷がありません。",
  );
  await expect(page.getByRole("img", { name: previewName })).toHaveCount(0);
});

test("keeps the physical panel visible after an initial renderer error", async ({ page }) => {
  await page.goto("/?forceRenderer=initial-render-error");

  await expect(page.getByRole("status")).toHaveAttribute(
    "data-capability-state",
    "renderer-error",
  );
  await expect(page.getByRole("img", { name: previewName })).toHaveCount(0);
  await expect(page.locator(".physical-validation")).toBeVisible();
  await expect(page.locator(".physical-validation__summary")).toHaveText(
    "判定対象なし：候補コンテナを追加してください。",
  );
});

test("shows named overlap relations and a fully supported stack without dropping warnings", async ({
  page,
}) => {
  await page.goto("/?forceWebgl2=unsupported");
  await addValidationCargo(page, "重なり積荷A");
  await addValidationCargo(page, "重なり積荷B");
  await addValidationCargo(page, "支持積荷", { canSupportCargo: true });
  await addValidationCargo(page, "上段積荷");
  await addContainer(page, "物理理由候補");

  await placeCargo(page, "重なり積荷A");
  await placeCargo(page, "重なり積荷B");
  await placeCargo(page, "支持積荷", { xMm: "1000" });
  await placeCargo(page, "上段積荷", { xMm: "1000", zMm: "100" });

  const physicalPanel = page.locator(".physical-validation");
  await expect(physicalPanel.locator(".physical-validation__summary")).toHaveText(
    "不適合：修正が必要な理由が1件あります。未確認事項5件も保持して表示します。",
  );
  const invalidGroup = physicalPanel.getByRole("region", { name: "不適合理由" });
  await expect(invalidGroup.getByRole("list")).toBeVisible();
  const overlapReason = invalidGroup.getByRole("listitem");
  await expect(overlapReason).toContainText("積荷同士が立体的に重なっています。");
  await expect(overlapReason).toContainText("重なり積荷A（ID: cargo-1）");
  await expect(overlapReason).toContainText("重なり積荷B（ID: cargo-2）");

  const unverifiedGroup = physicalPanel.getByRole("region", { name: "未確認理由" });
  await expect(unverifiedGroup.getByRole("list")).toBeVisible();
  const structureReason = unverifiedGroup
    .getByRole("listitem")
    .filter({ hasText: "構造強度と安定性は未確認です。" });
  await expect(structureReason).toHaveCount(1);
  await expect(structureReason).toContainText("上段積荷（ID: cargo-4）");
  await expect(structureReason).toContainText("支持積荷（ID: cargo-3）");
  await expect(physicalPanel.getByText("床にない積荷の底面が", { exact: false })).toHaveCount(0);
  await expect(physicalPanel.getByText("軸別隙間が不足", { exact: false })).toHaveCount(0);
});

test("paginates a representative large reason set, caps the DOM, and resets after a saved result change", async ({
  page,
}) => {
  await page.goto("/?forceWebgl2=unsupported");
  const cargoNames = Array.from({ length: 9 }, (_, index) => `多理由積荷${index + 1}`);
  for (const cargoName of cargoNames) {
    await addValidationCargo(page, cargoName);
  }
  await addContainer(page, "多理由候補");
  for (const cargoName of cargoNames) {
    await placeCargo(page, cargoName);
  }

  const physicalPanel = page.locator(".physical-validation");
  const invalidGroup = physicalPanel.getByRole("region", { name: "不適合理由" });
  await expect(invalidGroup.getByRole("heading", { name: "不適合理由（36件）" })).toBeVisible();
  await expect(invalidGroup.getByRole("listitem")).toHaveCount(25);
  await expect(invalidGroup.getByText("1〜25 / 36件")).toBeVisible();
  const nextButton = invalidGroup.getByRole("button", { name: "次の不適合理由" });
  await nextButton.focus();
  await page.keyboard.press("Enter");
  await expect(invalidGroup.getByText("26〜36 / 36件")).toBeVisible();
  await expect(invalidGroup.getByRole("listitem")).toHaveCount(11);
  await expect(invalidGroup.getByRole("button", { name: "前の不適合理由" })).toBeEnabled();
  await expect(nextButton).toBeDisabled();

  const placementPanel = page.locator(".placement-panel");
  await placementPanel.getByRole("button", { name: "編集: 多理由積荷9" }).click();
  await page.getByLabel("X最小角").fill("-1000");
  await placementPanel.getByRole("button", { name: "配置を保存" }).click();

  await expect(invalidGroup.getByRole("heading", { name: "不適合理由（29件）" })).toBeVisible();
  await expect(invalidGroup.getByText("1〜25 / 29件")).toBeVisible();
  await expect(invalidGroup.getByRole("listitem")).toHaveCount(25);
  await expect(invalidGroup.getByRole("button", { name: "前の不適合理由" })).toBeDisabled();
});

test("keeps maximum names and multiple physical reasons within narrow viewports", async ({
  page,
}) => {
  await page.setViewportSize({ width: 305, height: 900 });
  await page.goto("/?forceWebgl2=unsupported");
  const firstName = `甲${"長".repeat(119)}`;
  const secondName = `乙${"幅".repeat(119)}`;
  await addValidationCargo(page, firstName);
  await addValidationCargo(page, secondName);
  await addContainer(page, `候${"補".repeat(119)}`);
  await placeCargo(page, firstName);
  await placeCargo(page, secondName);

  const physicalPanel = page.locator(".physical-validation");
  await expect(physicalPanel.getByRole("heading", { name: "不適合理由（1件）" })).toBeVisible();
  await expect(physicalPanel.getByRole("heading", { name: "未確認理由（2件）" })).toBeVisible();
  await expectNoHorizontalOverflow(page);
  for (const width of [320, 375]) {
    await page.setViewportSize({ width, height: 900 });
    await expectNoHorizontalOverflow(page);
  }
});

test("keeps the scene workspace within 305, 320, and 375 pixel viewports", async ({
  page,
}) => {
  await page.setViewportSize({ width: 305, height: 900 });
  await page.goto("/");
  await expect(page.getByRole("status")).toHaveAttribute(
    "data-capability-state",
    "supported",
  );
  await addInteractiveCargo(page, "狭幅仮置き積荷A", {
    lengthMm: "500",
    widthMm: "400",
    heightMm: "300",
  });
  await addInteractiveCargo(page, "狭幅仮置き積荷B", {
    lengthMm: "450",
    widthMm: "350",
    heightMm: "250",
  });
  await addContainer(page, "狭幅表示用合成候補");
  await expect(page.getByRole("img", { name: previewName })).toBeVisible();
  await expect(page.locator(".viewport__staging-label")).toHaveText("仮置き場 2件");
  await expect(page.getByRole("group", { name: "3D表示の視点操作" })).toBeVisible();
  await expect(page.getByRole("button", { name: "拡大" })).toBeVisible();
  await expect(page.getByRole("button", { name: "縮小" })).toBeVisible();
  await expect(page.getByRole("button", { name: "荷室全体を表示" })).toBeVisible();
  await expectNoHorizontalOverflow(page);

  for (const width of [320, 375]) {
    await page.setViewportSize({ width, height: 900 });
    await expectNoHorizontalOverflow(page);
  }
});
