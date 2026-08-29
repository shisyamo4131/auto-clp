import { expect, test, type Page } from "@playwright/test";

async function addCargo(page: Page, name: string) {
  await page.getByRole("button", { name: "積荷を追加" }).click();
  await page.getByLabel("積荷名").fill(name);
  await page.getByLabel("長さ", { exact: true }).fill("100");
  await page.getByLabel("幅", { exact: true }).fill("100");
  await page.getByLabel("高さ", { exact: true }).fill("100");
  await page.getByLabel("重量").fill("1");
  await page.getByRole("button", { name: "積荷を保存" }).click();
}

async function addContainer(page: Page, name: string) {
  await page.getByRole("button", { name: "候補を追加" }).click();
  await page.getByLabel("候補名").fill(name);
  await page.getByLabel("内部長さ").fill("500");
  await page.getByLabel("内部幅").fill("500");
  await page.getByLabel("内部高さ").fill("500");
  await page.getByLabel("開口幅").fill("500");
  await page.getByLabel("開口高さ").fill("500");
  await page.getByLabel("総耐荷重").fill("100");
  await page.getByRole("button", { name: "候補を保存" }).click();
}

test("undoes and redoes project, cargo, container, placement, and removal", async ({ page }) => {
  await page.goto("/?forceWebgl2=unsupported");
  const undo = page.getByRole("button", { name: "元に戻す" });
  const redo = page.getByRole("button", { name: "やり直す" });
  await expect(undo).toHaveAttribute("aria-keyshortcuts", "Control+Z Meta+Z");
  await page.getByLabel("案件名").fill("履歴案件");
  await page.getByRole("button", { name: "案件を保存" }).click();
  await undo.click();
  await expect(page.getByTestId("canonical-project-settings")).toContainText("新規案件");
  await redo.click();
  await expect(page.getByTestId("canonical-project-settings")).toContainText("履歴案件");

  await addCargo(page, "履歴積荷");
  await expect(page.getByLabel("操作する積荷")).toHaveCount(1);
  await undo.click();
  await expect(page.getByLabel("操作する積荷")).toHaveCount(0);
  await redo.click();
  await addContainer(page, "履歴候補");
  await page.getByLabel("操作する積荷").selectOption("cargo-1");
  const card = page.locator(".scene-selection-card");
  await card.getByRole("button", { name: "座標を入力して配置" }).click();
  await page.getByRole("button", { name: "配置を保存" }).click();
  await expect(card).toContainText("0 mm");
  await undo.click();
  await expect(card).toContainText("荷室外（未配置）");
  await redo.click();
  await expect(card).toContainText("現在の候補に配置済み");
  await card.getByRole("button", { name: "荷室から外す" }).click();
  await page.getByRole("dialog", { name: "荷室から外す" }).getByRole("button", { name: "荷室から外す", exact: true }).click();
  await undo.click();
  await expect(card).toContainText("現在の候補に配置済み");
});

test("keeps native input undo local and blocks project history while a dialog is dirty", async ({ page }) => {
  await page.goto("/?forceWebgl2=unsupported");
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

test("falls back when a selected candidate disappears and does not auto-select it on undo", async ({ page }) => {
  await page.goto("/?forceWebgl2=unsupported");
  await addContainer(page, "候補A");
  await addContainer(page, "候補B");
  const select = page.getByLabel("表示する候補");
  await select.selectOption("container-2");
  await page.getByRole("button", { name: "削除: 候補B" }).click();
  await page.getByRole("button", { name: "削除を確定: 候補B" }).click();
  await expect(select).toHaveValue("container-1");
  await page.getByRole("button", { name: "元に戻す" }).click();
  await expect(select).toHaveValue("container-1");
  await expect(page.getByRole("list", { name: "候補一覧" })).toContainText("候補B");
});

test("discards redo after a new branch", async ({ page }) => {
  await page.goto("/?forceWebgl2=unsupported");
  await addCargo(page, "分岐積荷");
  await page.getByRole("button", { name: "元に戻す" }).click();
  await expect(page.getByRole("button", { name: "やり直す" })).toBeEnabled();
  await page.getByLabel("案件名").fill("履歴分岐");
  await page.getByRole("button", { name: "案件を保存" }).click();
  await expect(page.getByRole("button", { name: "やり直す" })).toBeDisabled();
});

test("history controls remain operable without horizontal overflow", async ({ page }) => {
  await page.setViewportSize({ width: 305, height: 700 });
  await page.goto("/?forceWebgl2=unsupported");
  await addCargo(page, "H".repeat(120));
  await page.getByRole("button", { name: "元に戻す" }).press("Enter");
  expect(await page.evaluate<boolean>("document.documentElement.scrollWidth > document.documentElement.clientWidth")).toBe(false);
});
