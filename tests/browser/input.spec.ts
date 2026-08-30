import { expect, test, type Page } from "@playwright/test";
import { openProjectSettings } from "./ui-helpers";

async function fillCargo(page: Page, name: string) {
  await page.getByLabel("積荷名").fill(name);
  await page.getByLabel("長さ", { exact: true }).fill("1200");
  await page.getByLabel("幅", { exact: true }).fill("800");
  await page.getByLabel("高さ", { exact: true }).fill("900");
  await page.getByLabel("重量").fill("1.005");
}

async function addCargo(page: Page, name: string) {
  await page.getByRole("button", { name: "積荷を追加" }).click();
  await fillCargo(page, name);
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
  const card = page.locator(".scene-selection-card");
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
  const card = page.locator(".scene-selection-card");
  await card.getByRole("button", { name: "座標を入力して配置" }).click();
  await page.getByRole("button", { name: "配置を保存" }).click();
  const historyBeforeBlockedDelete = await page.locator(".project-history__summary").textContent();
  await card.getByRole("button", { name: "積荷自体を削除" }).click({ force: true });
  await expect(page.locator("#scene-workspace-action-status")).toContainText("先に荷室から外してください");
  await expect(card).toContainText("現在の候補に配置済み");
  expect(await page.locator(".project-history__summary").textContent()).toBe(historyBeforeBlockedDelete);

  await card.getByRole("button", { name: "荷室から外す" }).click();
  await page.getByRole("dialog", { name: "荷室から外す" }).getByRole("button", { name: "荷室から外す", exact: true }).click();
  await expect(card).toContainText("荷室外（未配置）");
  await expect(page.getByRole("button", { name: "座標を入力して配置" })).toBeFocused();

  await card.getByRole("button", { name: "積荷自体を削除" }).click();
  const deleteDialog = page.getByRole("dialog", { name: "非cascade積荷を削除" });
  await expect(deleteDialog.getByLabel("積荷名")).toHaveCount(0);
  await deleteDialog.getByRole("button", { name: "削除を確定: 非cascade積荷" }).click();
  await expect(page.getByRole("button", { name: "積荷を追加" })).toBeFocused();
  await expect(page.getByText("積荷 0件、候補 1件、配置 0件")).toBeVisible();
});

test("keeps cargo input available with WebGL and exposes specific safety boundaries", async ({ page }) => {
  await page.goto("/");
  await addCargo(page, "非対応積荷");
  await expect(page.getByRole("img", { name: /3Dプレビュー/ })).toBeVisible();
  await expect(page.getByRole("region", { name: "物理判定" })).toContainText("実積載の安全性を保証しません");
});

test("uses 天地無用 as the only cargo orientation setting", async ({ page }) => {
  await page.goto("/");
  await page.getByRole("button", { name: "積荷を追加" }).click();
  await fillCargo(page, "天地無用合成積荷");
  await expect(page.getByLabel(/天地無用/)).toBeChecked();
  await expect(page.getByLabel(/^LWH/)).toHaveCount(0);
  await expect(page.getByLabel(/^WLH/)).toHaveCount(0);
  await expect(page.getByLabel(/^LHW/)).toHaveCount(0);
  await expect(page.getByText("床面上のZ軸回転は常に利用できます。")).toBeVisible();
  await page.getByRole("button", { name: "積荷を保存" }).click();
  await page.getByLabel("操作する積荷").selectOption("cargo-1");
  await expect(page.locator(".scene-selection-card")).toContainText("天地無用合成積荷");
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

test("modal editors have no horizontal overflow at narrow widths", async ({ page }) => {
  await page.setViewportSize({ width: 305, height: 640 });
  await page.goto("/");
  await page.getByRole("button", { name: "積荷を追加" }).click();
  await fillCargo(page, "C".repeat(120));
  for (const width of [305, 320, 375]) {
    await page.setViewportSize({ width, height: 640 });
    expect(await page.evaluate<boolean>("document.documentElement.scrollWidth > document.documentElement.clientWidth")).toBe(false);
  }
});
