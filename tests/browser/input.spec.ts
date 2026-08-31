import { expect, test, type Page } from "./fixtures";
import {
  addCargoFromDrawer,
  addContainerFromDrawer,
  openCargoAddEditor,
  openContainerAddEditor,
  openProjectSettings,
} from "./ui-helpers";

async function fillCargo(page: Page, name: string) {
  await page.getByLabel("積荷名").fill(name);
  await page.getByLabel("長さ", { exact: true }).fill("1200");
  await page.getByLabel("幅", { exact: true }).fill("800");
  await page.getByLabel("高さ", { exact: true }).fill("900");
  await page.getByLabel("重量").fill("1.005");
}

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

test("edits project settings transactionally and focuses invalid input", async ({ page }) => {
  await page.goto("/");
  await openProjectSettings(page);
  await page.getByLabel("CLP名").fill("更新CLP");
  await page.getByLabel("X方向の隙間").fill("1.5");
  await page.getByRole("button", { name: "CLPを保存" }).click();
  await expect(page.getByLabel("X方向の隙間")).toBeFocused();
  await expect(page.getByLabel("X方向の隙間")).toHaveAttribute("aria-invalid", "true");
  await page.getByLabel("X方向の隙間").fill("10");
  await page.getByRole("button", { name: "CLPを保存" }).click();
  await expect(page.getByTestId("canonical-project-settings")).toContainText("更新CLP");
});

test("adds, edits, cancels, and explicitly deletes cargo through the compact card", async ({ page }) => {
  await page.goto("/");
  await addCargo(page, "合成積荷");
  const picker = page.getByLabel("操作する積荷");
  await picker.selectOption("cargo-1");
  const card = page.locator(".viewport-context-actions");
  await expect(card).toContainText("合成積荷");
  await card.getByRole("button", { name: "積荷情報を編集" }).click();
  await page.getByLabel("積荷名").fill("未保存名");
  await page.getByRole("button", { name: "キャンセル" }).click();
  await page.getByRole("button", { name: "入力を破棄して閉じる" }).click();
  await expect(card).toContainText("合成積荷");
  await card.getByRole("button", { name: "積荷情報を編集" }).click();
  await page.getByLabel("積荷名").fill("合成積荷更新");
  await page.getByRole("button", { name: "積荷情報を保存" }).click();
  await expect(card).toContainText("合成積荷更新");
  await card.getByRole("button", { name: "積荷自体を削除" }).click();
  await page.getByRole("button", { name: "削除を確定: 合成積荷更新" }).click();
  await expect(picker).toHaveCount(0);
});

test("separates placement removal from cargo deletion and restores fallback focus", async ({ page }) => {
  await page.goto("/");
  await addCargo(page, "非cascade積荷");
  await addContainer(page, "非cascade候補");
  await page.getByLabel("操作する積荷").selectOption("cargo-1");
  const card = page.locator(".viewport-context-actions");
  await card.getByRole("button", { name: "座標を入力して配置" }).click();
  await page.getByRole("button", { name: "配置を保存" }).click();
  const historyBeforeBlockedDelete = await page.locator(".project-history__summary").textContent();
  await expect(card.getByRole("button", { name: "積荷自体を削除" })).toHaveCount(0);
  await expect(card.getByRole("button", { name: "荷室から外す" })).toBeVisible();
  await expect(card).toContainText("現在の座標 — X 0 / Y 0 / Z 0 mm");
  expect(await page.locator(".project-history__summary").textContent()).toBe(historyBeforeBlockedDelete);

  await card.getByRole("button", { name: "荷室から外す" }).click();
  await page.getByRole("dialog", { name: "荷室から外す" }).getByRole("button", { name: "荷室から外す", exact: true }).click();
  await expect(card).toContainText("荷室外（未配置）");
  await expect(page.getByRole("button", { name: "座標を入力して配置" })).toBeFocused();

  await card.getByRole("button", { name: "積荷自体を削除" }).click();
  const deleteDialog = page.getByRole("dialog", { name: "非cascade積荷を削除" });
  await expect(deleteDialog.getByLabel("積荷名")).toHaveCount(0);
  await deleteDialog.getByRole("button", { name: "削除を確定: 非cascade積荷" }).click();
  await expect(page.locator("#app-navigation-button")).toBeFocused();
  await expect(page.getByText("積荷 0件、候補 1件、配置 0件")).toBeVisible();
});

test("keeps cargo input available with WebGL and exposes specific safety boundaries", async ({ page }) => {
  await page.goto("/");
  await addCargo(page, "非対応積荷");
  await expect(page.getByRole("img", { name: /3Dプレビュー/ })).toBeVisible();
  await page.getByRole("button", { name: "ナビゲーションメニューを開く" }).click();
  await page.getByRole("button", { name: "使用上の重要事項" }).click();
  await expect(page.getByRole("dialog", { name: "使用上の重要事項" })).toContainText("実積載の安全性");
});

test("uses 天地無用 as the only cargo orientation setting", async ({ page }) => {
  await page.goto("/");
  await openCargoAddEditor(page);
  await fillCargo(page, "天地無用合成積荷");
  await expect(page.getByLabel(/天地無用/)).toBeChecked();
  await expect(page.getByLabel(/^LWH/)).toHaveCount(0);
  await expect(page.getByLabel(/^WLH/)).toHaveCount(0);
  await expect(page.getByLabel(/^LHW/)).toHaveCount(0);
  await expect(page.getByText("床面上のZ軸回転は常に利用できます。")).toBeVisible();
  await page.getByRole("button", { name: "積荷を保存" }).click();
  await page.getByLabel("操作する積荷").selectOption("cargo-1");
  await expect(page.locator(".viewport-context-actions")).toContainText("天地無用合成積荷");
});

test("container CRUD remains transactional", async ({ page }) => {
  await page.goto("/");
  await addContainer(page, "合成候補");
  const list = page.getByRole("list", { name: "候補一覧" });
  await expect(list).toContainText("合成候補");
  await page.getByRole("button", { name: "編集: 合成候補" }).click();
  await page.getByLabel("候補名").fill("合成候補更新");
  await page.getByRole("button", { name: "候補の変更を保存: 合成候補" }).click();
  await expect(list).toContainText("合成候補更新");
});

test("opens Drawer additions through the existing cargo modal and container inline editor", async ({
  page,
}) => {
  await page.goto("/");
  const menu = page.locator("#app-navigation-button");

  await openCargoAddEditor(page);
  const cargoDialog = page.getByRole("dialog", { name: "積荷を追加" });
  await expect(cargoDialog).toBeVisible();
  await expect(page.getByLabel("積荷名")).toBeFocused();
  await page.getByLabel("積荷名").fill("破棄する積荷draft");
  await cargoDialog.getByRole("button", { name: "キャンセル" }).click();
  await expect(cargoDialog.getByText("未保存の積荷入力を破棄して閉じますか。")).toBeVisible();
  await cargoDialog.getByRole("button", { name: "入力を破棄して閉じる" }).click();
  await expect(cargoDialog).toHaveCount(0);
  await expect(menu).toBeFocused();

  await openContainerAddEditor(page);
  await expect(page.getByRole("dialog", { name: "候補を追加" })).toHaveCount(0);
  await expect(page.getByLabel("候補名")).toBeFocused();
  await page.getByLabel("候補名").fill("破棄する候補draft");
  await page.getByRole("button", { name: "候補編集をキャンセル" }).click();
  await expect(page.getByLabel("候補名")).toHaveCount(0);
  await expect(menu).toBeFocused();

  await addCargo(page, "Drawer追加積荷");
  await expect(menu).toBeFocused();
  await addContainer(page, "Drawer追加候補");
  await expect(menu).toBeFocused();
  await expect(page.getByText("積荷 1件、候補 1件、配置 0件")).toBeVisible();
});

test("modal editors have no horizontal overflow at narrow widths", async ({ page }) => {
  await page.setViewportSize({ width: 305, height: 640 });
  await page.goto("/");
  await openCargoAddEditor(page);
  await fillCargo(page, "C".repeat(120));
  for (const width of [305, 320, 375]) {
    await page.setViewportSize({ width, height: 640 });
    expect(await page.evaluate<boolean>("document.documentElement.scrollWidth > document.documentElement.clientWidth")).toBe(false);
  }
  await page.getByRole("button", { name: "キャンセル" }).click();
  await page.getByRole("button", { name: "入力を破棄して閉じる" }).click();

  await openContainerAddEditor(page);
  await page.getByLabel("候補名").fill("候補".repeat(60));
  for (const width of [305, 320, 375]) {
    await page.setViewportSize({ width, height: 640 });
    expect(await page.evaluate<boolean>("document.documentElement.scrollWidth > document.documentElement.clientWidth")).toBe(false);
  }
});
