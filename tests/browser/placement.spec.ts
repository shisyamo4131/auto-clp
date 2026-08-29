import { expect, test, type Page } from "@playwright/test";

async function addCargo(page: Page, name: string) {
  await page.getByRole("button", { name: "積荷を追加" }).click();
  await page.getByLabel("積荷名").fill(name);
  await page.getByLabel("長さ", { exact: true }).fill("1200");
  await page.getByLabel("幅", { exact: true }).fill("800");
  await page.getByLabel("高さ", { exact: true }).fill("900");
  await page.getByLabel("重量").fill("1.005");
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

async function fixture(page: Page) {
  await addCargo(page, "合成配置積荷");
  await addContainer(page, "合成配置候補A");
  await addContainer(page, "合成配置候補B");
  await page.getByLabel("操作する積荷").selectOption("cargo-1");
}

async function expectNoHorizontalOverflow(page: Page) {
  expect(await page.evaluate<boolean>("document.documentElement.scrollWidth > document.documentElement.clientWidth")).toBe(false);
}

test("creates, validates, edits, switches, and removes a placement through compact dialogs", async ({ page }) => {
  await page.goto("/");
  await fixture(page);
  const card = page.locator(".scene-selection-card");
  const sceneSelect = page.getByLabel("表示する候補");
  await card.getByRole("button", { name: "座標を入力して配置" }).click();
  await expect(page.getByRole("dialog", { name: "合成配置積荷" })).toBeVisible();
  await expect(page.getByLabel("X最小角")).toBeFocused();
  await expect(sceneSelect).toBeDisabled();
  await page.getByLabel("X最小角").fill("1.5");
  await page.getByRole("button", { name: "配置を保存" }).click();
  await expect(page.getByLabel("X最小角")).toHaveAttribute("aria-invalid", "true");
  await page.getByLabel("X最小角").fill("-1000000");
  await page.getByLabel("Y最小角").fill("1000000");
  await page.getByLabel("Z最小角").fill("-1");
  await page.getByLabel("向き").selectOption("WLH");
  await page.getByRole("button", { name: "配置を保存" }).click();
  await expect(card).toContainText("-1000000 mm");
  await expect(page.locator(".physical-validation__summary")).toContainText("不適合");
  await sceneSelect.selectOption("container-2");
  await expect(card).toContainText("合成配置候補Aに配置済み");
  await card.getByRole("button", { name: "合成配置候補Aを表示" }).click();
  await card.getByRole("button", { name: "座標を微調整" }).click();
  await page.getByLabel("X最小角").fill("123");
  await page.getByRole("button", { name: "キャンセル" }).click();
  await page.getByRole("button", { name: "入力を破棄して閉じる" }).click();
  await expect(card).toContainText("-1000000 mm");
  await card.getByRole("button", { name: "荷室から外す" }).click();
  await page.getByRole("dialog", { name: "荷室から外す" }).getByRole("button", { name: "荷室から外す", exact: true }).click();
  await expect(card).toContainText("荷室外（未配置）");
});

test("keeps placement CRUD available without WebGL", async ({ page }) => {
  await page.goto("/?forceWebgl2=unsupported");
  await addCargo(page, "非対応時配置積荷");
  await addContainer(page, "非対応時配置候補");
  await page.getByLabel("操作する積荷").selectOption("cargo-1");
  const card = page.locator(".scene-selection-card");
  await expect(page.getByRole("img")).toHaveCount(0);
  await card.getByRole("button", { name: "座標を入力して配置" }).click();
  await page.getByLabel("X最小角").fill("-2");
  await page.getByRole("button", { name: "配置を保存" }).click();
  await expect(card).toContainText("-2 mm");
  await card.getByRole("button", { name: "荷室から外す" }).click();
  await page.getByRole("dialog", { name: "荷室から外す" }).getByRole("button", { name: "荷室から外す", exact: true }).click();
  await expect(card).toContainText("荷室外（未配置）");
});

test("confirms dirty close and restores the opener without scrolling", async ({ page }) => {
  await page.goto("/?forceWebgl2=unsupported");
  await addCargo(page, "focus配置積荷");
  await addContainer(page, "focus配置候補");
  await page.getByLabel("操作する積荷").selectOption("cargo-1");
  const opener = page.getByRole("button", { name: "座標を入力して配置" });
  await opener.scrollIntoViewIfNeeded();
  const openerBox = await opener.boundingBox();
  if (openerBox === null) throw new Error("Placement dialog opener has no bounding box");
  await page.mouse.click(openerBox.x + openerBox.width / 2, openerBox.y + openerBox.height / 2);
  await expect(page.locator(".app-shell")).toHaveAttribute("inert", "");
  await page.getByLabel("X最小角").fill("12");
  await page.keyboard.press("Escape");
  await expect(page.getByText("未保存の座標入力を破棄して閉じますか。")).toBeVisible();
  await page.getByRole("button", { name: "入力を破棄して閉じる" }).click();
  await expect(opener).toBeFocused();
  await expect(page.locator(".app-shell")).not.toHaveAttribute("inert", "");
  await page.waitForTimeout(50);
  expect((await opener.boundingBox())?.y).toBe(openerBox.y);
});

test("traps focus in the shared placement modal", async ({ page }) => {
  await page.goto("/?forceWebgl2=unsupported");
  await addCargo(page, "focus-trap積荷");
  await addContainer(page, "focus-trap候補");
  await page.getByLabel("操作する積荷").selectOption("cargo-1");
  await page.getByRole("button", { name: "座標を入力して配置" }).click();
  const dialog = page.getByRole("dialog", { name: "focus-trap積荷" });
  const closeButton = dialog.getByRole("button", { name: "focus-trap積荷を閉じる" });
  const cancelButton = dialog.getByRole("button", { name: "キャンセル" });
  await closeButton.focus();
  await page.keyboard.press("Shift+Tab");
  await expect(cancelButton).toBeFocused();
  await cancelButton.focus();
  await page.keyboard.press("Tab");
  await expect(closeButton).toBeFocused();
  await closeButton.click();
});

test("has no dialog overflow at 305, 320, and 375 pixels", async ({ page }) => {
  await page.setViewportSize({ width: 305, height: 640 });
  await page.goto("/?forceWebgl2=unsupported");
  await addCargo(page, "狭幅配置積荷");
  await addContainer(page, "狭幅配置候補");
  await page.getByLabel("操作する積荷").selectOption("cargo-1");
  await page.getByRole("button", { name: "座標を入力して配置" }).click();
  await expectNoHorizontalOverflow(page);
  for (const width of [320, 375]) {
    await page.setViewportSize({ width, height: 640 });
    await expectNoHorizontalOverflow(page);
  }
});
