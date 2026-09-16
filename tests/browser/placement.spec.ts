import { expect, test, type Page } from "./fixtures";
import {
  activateContainer,
  addCargoFromDrawer,
  addContainerFromDrawer,
} from "./ui-helpers";

async function addCargo(page: Page, name: string) {
  await addCargoFromDrawer(page, name, {
    lengthMm: "1200",
    widthMm: "800",
    heightMm: "900",
    massKg: "1.005",
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
  const card = page.locator(".viewport-context-actions");
  const firstTab = page.getByRole("tab", { name: /ID: container-1/ });
  await card.getByRole("button", { name: "座標を入力して配置" }).click();
  await expect(page.getByRole("dialog", { name: "合成配置積荷" })).toBeVisible();
  await expect(page.getByLabel("X最小角")).toBeFocused();
  await expect(firstTab).toBeDisabled();
  await page.getByLabel("X最小角").fill("1.5");
  await page.getByRole("button", { name: "配置を保存" }).click();
  await expect(page.getByLabel("X最小角")).toHaveAttribute("aria-invalid", "true");
  await page.getByLabel("X最小角").fill("-1000000");
  await page.getByLabel("Y最小角").fill("1000000");
  await page.getByLabel("Z最小角").fill("-1");
  await page.getByLabel("向き").selectOption("WLH");
  await page.getByRole("button", { name: "配置を保存" }).click();
  await expect(card).toContainText("X -1000000 / Y 1000000 / Z -1 mm");
  await expect(page.locator("#physical-validation-lamp")).toHaveAttribute("data-status", "invalid");
  await activateContainer(page, "container-2");
  await page.getByLabel("操作する積荷").selectOption("cargo-1");
  await expect(card).toContainText("合成配置候補Aに配置");
  await card.getByRole("button", { name: "合成配置候補Aを表示" }).click();
  await page.getByLabel("操作する積荷").selectOption("cargo-1");
  await card.getByRole("button", { name: "座標を微調整" }).click();
  await page.getByLabel("X最小角").fill("123");
  await page.getByRole("button", { name: "キャンセル" }).click();
  await page.getByRole("button", { name: "入力を破棄して閉じる" }).click();
  await expect(card).toContainText("X -1000000 / Y 1000000 / Z -1 mm");
  await card.getByRole("button", { name: "荷室から外す" }).click();
  await page.getByRole("dialog", { name: "荷室から外す" }).getByRole("button", { name: "荷室から外す", exact: true }).click();
  await expect(card).toContainText("荷室外（未配置）");
});

test("keeps placement CRUD available with the required 3D view", async ({ page }) => {
  await page.goto("/");
  await addCargo(page, "非対応時配置積荷");
  await addContainer(page, "非対応時配置候補");
  await page.getByLabel("操作する積荷").selectOption("cargo-1");
  const card = page.locator(".viewport-context-actions");
  await expect(page.getByRole("img", { name: /3Dプレビュー/ })).toBeVisible();
  await card.getByRole("button", { name: "座標を入力して配置" }).click();
  await page.getByLabel("X最小角").fill("-2");
  await page.getByRole("button", { name: "配置を保存" }).click();
  await expect(card).toContainText("X -2 / Y 0 / Z 0 mm");
  await card.getByRole("button", { name: "荷室から外す" }).click();
  await page.getByRole("dialog", { name: "荷室から外す" }).getByRole("button", { name: "荷室から外す", exact: true }).click();
  await expect(card).toContainText("荷室外（未配置）");
});

test("moves an exact three-level stack atomically and explains disabled support", async ({ page }) => {
  await page.goto("/");
  for (const [name, canSupportCargo] of [
    ["基礎積荷", true],
    ["中段積荷", true],
    ["上段積荷", false],
  ] as const) {
    await addCargoFromDrawer(page, name, {
      lengthMm: "500",
      widthMm: "400",
      heightMm: "300",
      massKg: "1",
      canSupportCargo,
    });
  }
  await addContainerFromDrawer(page, "積層候補", {
    lengthMm: "6000",
    widthMm: "2400",
    heightMm: "2600",
    openingWidthMm: "2400",
    openingHeightMm: "2500",
    payloadKg: "100000",
  });

  const card = page.locator(".viewport-context-actions");
  for (const [cargoId, zMm] of [
    ["cargo-1", "0"],
    ["cargo-2", "300"],
    ["cargo-3", "600"],
  ] as const) {
    await page.getByLabel("操作する積荷").selectOption(cargoId);
    await card.getByRole("button", { name: "座標を入力して配置" }).click();
    await page.getByLabel("X最小角").fill("100");
    await page.getByLabel("Y最小角").fill("100");
    await page.getByLabel("Z最小角").fill(zMm);
    await page.getByRole("button", { name: "配置を保存" }).click();
  }

  await page.getByLabel("操作する積荷").selectOption("cargo-1");
  await card.getByRole("button", { name: "座標を微調整" }).click();
  await page.getByLabel("X最小角").fill("150");
  await page.getByRole("button", { name: "配置を保存" }).click();
  await expect(page.locator(".project-history__summary")).toContainText("配置の更新");

  for (const cargoId of ["cargo-1", "cargo-2", "cargo-3"]) {
    await page.getByLabel("操作する積荷").selectOption(cargoId);
    await card.getByRole("button", { name: "座標を微調整" }).click();
    await expect(page.getByLabel("X最小角")).toHaveValue("150");
    await page.getByRole("button", { name: "キャンセル" }).click();
  }

  await page.getByRole("button", { name: "元に戻す" }).click();
  for (const cargoId of ["cargo-1", "cargo-2", "cargo-3"]) {
    await page.getByLabel("操作する積荷").selectOption(cargoId);
    await card.getByRole("button", { name: "座標を微調整" }).click();
    await expect(page.getByLabel("X最小角")).toHaveValue("100");
    await page.getByRole("button", { name: "キャンセル" }).click();
  }

  await page.getByLabel("操作する積荷").selectOption("cargo-1");
  await card.getByRole("button", { name: "荷室から外す" }).click();
  const removeDialog = page.getByRole("dialog", { name: "荷室から外す" });
  await removeDialog.getByRole("button", { name: "荷室から外す", exact: true }).click();
  await expect(removeDialog).toContainText(
    "上に積荷があるため荷室から外せません。先に上の積荷を外してください。",
  );
  await removeDialog.getByRole("button", { name: "キャンセル" }).click();

  await card.getByRole("button", { name: "積荷情報を編集" }).click();
  await page
    .getByLabel("この積荷の上面で別の積荷を幾何学的に支持できる")
    .uncheck();
  await page.getByRole("button", { name: "積荷情報を保存" }).click();
  await page.locator("#physical-validation-lamp").click();
  await expect(page.getByRole("dialog", { name: "物理判定" })).toContainText(
    "基礎積荷は段積みが許可されていないため、上にある中段積荷を支持できません。段積み設定または配置を変更してください。",
  );
});

test("confirms dirty close and restores the opener without scrolling", async ({ page }) => {
  await page.goto("/");
  await addCargo(page, "focus配置積荷");
  await addContainer(page, "focus配置候補");
  await page.getByLabel("操作する積荷").selectOption("cargo-1");
  const opener = page.getByRole("button", { name: "座標を入力して配置" });
  await opener.scrollIntoViewIfNeeded();
  const openerBox = await opener.boundingBox();
  if (openerBox === null) throw new Error("Placement dialog opener has no bounding box");
  const scrollBeforeOpen = await page.evaluate<number>("window.scrollY");
  await opener.focus();
  await opener.dispatchEvent("click");
  await expect(page.locator(".app-shell")).toHaveAttribute("inert", "");
  await page.getByLabel("X最小角").fill("12");
  await page.keyboard.press("Escape");
  await expect(page.getByText("未保存の座標入力を破棄して閉じますか。")).toBeVisible();
  await page.getByRole("button", { name: "入力を破棄して閉じる" }).click();
  await expect(opener).toBeFocused();
  await expect(page.locator(".app-shell")).not.toHaveAttribute("inert", "");
  await page.waitForTimeout(50);
  expect(await page.evaluate<number>("window.scrollY")).toBe(scrollBeforeOpen);
  expect((await opener.boundingBox())?.y).toBe(openerBox.y);
});

test("traps focus in the shared placement modal", async ({ page }) => {
  await page.goto("/");
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
  await page.goto("/");
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
