import type { Page } from "@playwright/test";

export async function openProjectSettings(page: Page): Promise<void> {
  const dialog = page.getByRole("dialog", { name: "CLP設定" });
  if (await dialog.isVisible()) return;
  await page.locator("#current-project-settings-button").click();
}

export async function saveProjectName(page: Page, name: string): Promise<void> {
  await openProjectSettings(page);
  await page.getByLabel("CLP名").fill(name);
  await page.getByRole("button", { name: "CLPを保存" }).click();
}

export async function openPersistenceDrawer(page: Page): Promise<void> {
  await page.getByRole("button", { name: "ナビゲーションメニューを開く" }).click();
}

export async function openPhysicalValidation(page: Page): Promise<void> {
  const dialog = page.getByRole("dialog", { name: "物理判定" });
  if (await dialog.isVisible()) return;
  await page.locator("#physical-validation-lamp").click();
  await dialog.waitFor({ state: "visible" });
}

export async function activateContainer(page: Page, containerId: string): Promise<void> {
  await page.getByRole("tab", { name: new RegExp(`ID: ${containerId}`) }).click();
}
