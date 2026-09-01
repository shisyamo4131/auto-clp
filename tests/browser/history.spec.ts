import { expect, test, type Page } from "./fixtures";
import {
  activateContainer,
  addCargoFromDrawer,
  addContainerFromDrawer,
  openPersistenceDrawer,
  saveProjectName,
} from "./ui-helpers";

async function addCargo(page: Page, name: string) {
  await addCargoFromDrawer(page, name);
}

async function addContainer(page: Page, name: string) {
  await addContainerFromDrawer(page, name);
}

test("undoes and redoes project, cargo, container, placement, and removal", async ({ page }) => {
  await page.goto("/");
  const undo = page.getByRole("button", { name: "元に戻す" });
  const redo = page.getByRole("button", { name: "やり直す" });
  await expect(undo).toHaveAttribute("aria-keyshortcuts", "Control+Z Meta+Z");
  await saveProjectName(page, "履歴CLP");
  await undo.click();
  await expect(page.getByTestId("canonical-project-settings")).toContainText("新規CLP");
  await redo.click();
  await expect(page.getByTestId("canonical-project-settings")).toContainText("履歴CLP");

  await addCargo(page, "履歴積荷");
  await expect(page.getByLabel("操作する積荷")).toHaveCount(1);
  await undo.click();
  await expect(page.getByLabel("操作する積荷")).toHaveCount(0);
  await redo.click();
  await addContainer(page, "履歴候補");
  await page.getByLabel("操作する積荷").selectOption("cargo-1");
  const card = page.locator(".viewport-context-actions");
  await card.getByRole("button", { name: "座標を入力して配置" }).click();
  await page.getByRole("button", { name: "配置を保存" }).click();
  await expect(card).toContainText("X 0 / Y 0 / Z 0 mm");
  await undo.click();
  await expect(card).toContainText("荷室外（未配置）");
  await redo.click();
  await expect(card).toContainText("現在の座標 — X 0 / Y 0 / Z 0 mm");
  await card.getByRole("button", { name: "荷室から外す" }).click();
  await page.getByRole("dialog", { name: "荷室から外す" }).getByRole("button", { name: "荷室から外す", exact: true }).click();
  await undo.click();
  await expect(card).toContainText("現在の座標 — X 0 / Y 0 / Z 0 mm");
});

test("keeps native input undo local and blocks project history while a dialog is dirty", async ({ page }) => {
  await page.goto("/");
  await addCargo(page, "shortcut積荷");
  const undo = page.getByRole("button", { name: "元に戻す" });
  await page.getByLabel("操作する積荷").selectOption("cargo-1");
  await page.getByRole("button", { name: "積荷情報を編集" }).click();
  await page.getByLabel("積荷名").fill("未保存名");
  await expect(undo).toBeDisabled();
  await page.getByLabel("積荷名").press("Control+z");
  await expect(page.getByLabel("積荷名")).toHaveValue("shortcut積荷");
  await page.keyboard.press("Escape");
  await expect(undo).toBeEnabled();
});

test("falls back when a selected container disappears and does not auto-select it on undo", async ({ page }) => {
  await page.goto("/");
  await addContainer(page, "候補A");
  await addContainer(page, "候補B");
  await activateContainer(page, "container-2");
  await openPersistenceDrawer(page);
  await page.getByRole("button", { name: "選択中のコンテナを削除" }).click();
  await page.getByRole("button", { name: "削除を確定: 候補B" }).click();
  await expect(page.getByRole("tab", { name: /ID: container-1/ })).toHaveAttribute("aria-selected", "true");
  await page.getByRole("button", { name: "元に戻す" }).click();
  await expect(page.getByRole("tab", { name: /ID: container-1/ })).toHaveAttribute("aria-selected", "true");
  await expect(page.getByRole("tab", { name: /候補B/ })).toBeVisible();
});

test("discards redo after a new branch", async ({ page }) => {
  await page.goto("/");
  await addCargo(page, "分岐積荷");
  await page.getByRole("button", { name: "元に戻す" }).click();
  await expect(page.getByRole("button", { name: "やり直す" })).toBeEnabled();
  await saveProjectName(page, "履歴分岐");
  await expect(page.getByRole("button", { name: "やり直す" })).toBeDisabled();
});

test("history controls remain operable without horizontal overflow", async ({ page }) => {
  await page.setViewportSize({ width: 305, height: 700 });
  await page.goto("/");
  await addCargo(page, "H".repeat(120));
  await page.getByRole("button", { name: "元に戻す" }).press("Enter");
  expect(await page.evaluate<boolean>("document.documentElement.scrollWidth > document.documentElement.clientWidth")).toBe(false);
});
