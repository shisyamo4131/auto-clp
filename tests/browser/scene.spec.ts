import { expect, test, type Locator, type Page } from "@playwright/test";

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

async function addInteractiveCargo(page: Page, name: string) {
  await page.getByRole("button", { name: "積荷を追加" }).click();
  await page.getByLabel("積荷名").fill(name);
  await page.getByLabel("長さ", { exact: true }).fill("1800");
  await page.getByLabel("幅", { exact: true }).fill("1400");
  await page.getByLabel("高さ", { exact: true }).fill("1000");
  await page.getByLabel("重量").fill("1.005");
  await page.getByRole("button", { name: "積荷を保存" }).click();
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

async function placementSummary(row: Locator) {
  return (await row.locator("span").textContent()) ?? "";
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

test("shows an empty unjudged scene with a supported canvas", async ({ page }) => {
  await page.goto("/");

  await expect(page.getByRole("status")).toHaveAttribute(
    "data-capability-state",
    "supported",
  );
  await expect(page.getByText("表示する候補がありません。案件入力でコンテナ・車両候補を追加してください。")).toBeVisible();
  await expect(page.getByText("候補0件、配置0件。適合判定は未実施です。")).toBeVisible();
  await expect(page.getByRole("img", { name: previewName })).toBeVisible();
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
  await expect(sceneSelect).toHaveValue("container-1");
  await expect(page.getByText("選択中の候補: 合成候補A。配置0件。積荷は未選択です。適合判定は未実施です。")).toBeVisible();

  await addContainer(page, "合成候補B", "7001");
  await expect(sceneSelect).toHaveValue("container-1");
  const sceneStatus = page.locator("#scene-workspace-status");
  await expect(sceneStatus).toHaveAttribute("aria-live", "polite");
  await expect(sceneStatus).toHaveAttribute("aria-atomic", "true");
  await expect(capabilityStatus.getByLabel("表示する候補")).toHaveCount(0);
  await expect(capabilityStatus.getByRole("img", { name: previewName })).toHaveCount(0);
  const capabilityCopy = await capabilityStatus.textContent();
  await sceneSelect.selectOption({ label: "合成候補B" });
  await expect(sceneStatus).toHaveText("選択中の候補: 合成候補B。配置0件。積荷は未選択です。適合判定は未実施です。");
  await expect(capabilityStatus).toHaveText(capabilityCopy ?? "");

  await page.getByRole("button", { name: "編集: 合成候補B" }).click();
  await page.getByLabel("候補名").fill("合成候補B更新");
  await page.getByLabel("内部長さ").fill("8001");
  await page.getByRole("button", { name: "候補の変更を保存: 合成候補B" }).click();
  await expect(sceneSelect).toHaveValue("container-2");
  await expect(page.getByText("選択中の候補: 合成候補B更新。配置0件。積荷は未選択です。適合判定は未実施です。")).toBeVisible();
  await expect(page.getByRole("img", { name: previewName })).toBeVisible();

  await page.getByRole("button", { name: "削除: 合成候補B更新" }).click();
  await page.getByRole("button", { name: "削除を確定: 合成候補B更新" }).click();
  await expect(sceneSelect).toHaveValue("container-1");
  await expect(page.getByText("選択中の候補: 合成候補A。配置0件。積荷は未選択です。適合判定は未実施です。")).toBeVisible();
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
  await page.mouse.wheel(0, -240);
  await page.getByRole("button", { name: "視点を初期位置へ戻す" }).click();
  expect(await placementSummary(row)).toBe(originalSummary);
  await expect(sceneSelect).toBeEnabled();
});

test("commits one fine-pointer floor drag and synchronizes the placement form", async ({
  page,
}) => {
  await page.goto("/");
  const { canvas, panel, row, sceneSelect, status } = await createInteractiveScene(page);
  const originalSummary = await placementSummary(row);
  const cargoPoint = await selectCargoOnCanvas(page, canvas, row);
  const editButton = panel.getByRole("button", { name: "編集: 合成canvas積荷" });

  await page.mouse.move(cargoPoint.x, cargoPoint.y);
  await page.mouse.down();
  await page.mouse.move(cargoPoint.x + 70, cargoPoint.y + 24, { steps: 4 });
  await expect(sceneSelect).toBeDisabled();
  await expect(editButton).toBeDisabled();
  expect(await placementSummary(row)).toBe(originalSummary);
  await page.mouse.up();

  await expect(sceneSelect).toBeEnabled();
  await expect(editButton).toBeEnabled();
  await expect(row.locator("span")).not.toHaveText(originalSummary);
  const movedSummary = await placementSummary(row);
  expect(movedSummary).toMatch(/^最小角 X -?\d+・Y -?\d+・Z 250 mm \/ WLH$/);
  const statusText = (await status.textContent()) ?? "";
  expect(statusText.match(/移動しました/g)).toHaveLength(1);

  const match = movedSummary.match(/X (-?\d+)・Y (-?\d+)・Z (-?\d+) mm \/ (\w+)/);
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

test("rolls an active canvas drag back on Escape, pointer cancellation, and window blur", async ({
  page,
}) => {
  await page.goto("/");
  const { canvas, row, sceneSelect, status } = await createInteractiveScene(page);
  const originalSummary = await placementSummary(row);
  const cargoPoint = await selectCargoOnCanvas(page, canvas, row);

  await page.mouse.move(cargoPoint.x, cargoPoint.y);
  await page.mouse.down();
  await page.mouse.move(cargoPoint.x + 60, cargoPoint.y + 20, { steps: 3 });
  await expect(sceneSelect).toBeDisabled();
  await page.keyboard.press("Escape");
  await page.mouse.up();
  await expect(sceneSelect).toBeEnabled();
  await expect(status).toContainText("Escapeキーで配置の移動をキャンセルしました");
  expect(await placementSummary(row)).toBe(originalSummary);

  await page.mouse.move(cargoPoint.x, cargoPoint.y);
  await page.mouse.down();
  await page.mouse.move(cargoPoint.x - 60, cargoPoint.y + 20, { steps: 3 });
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

  await page.mouse.move(cargoPoint.x, cargoPoint.y);
  await page.mouse.down();
  await page.mouse.move(cargoPoint.x + 55, cargoPoint.y - 20, { steps: 3 });
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
  await expect(page.getByText("選択中の候補: 非対応時の合成候補。配置0件。積荷は未選択です。適合判定は未実施です。")).toBeVisible();
  await expect(page.getByRole("img", { name: previewName })).toHaveCount(0);
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
  await addContainer(page, "狭幅表示用合成候補");
  await expect(page.getByRole("img", { name: previewName })).toBeVisible();
  await expectNoHorizontalOverflow(page);

  for (const width of [320, 375]) {
    await page.setViewportSize({ width, height: 900 });
    await expectNoHorizontalOverflow(page);
  }
});
