import { expect, type Page } from "@playwright/test";

export interface CargoInput {
  readonly lengthMm?: string;
  readonly widthMm?: string;
  readonly heightMm?: string;
  readonly massKg?: string;
  readonly canSupportCargo?: boolean;
  readonly uprightOnly?: boolean;
}

export interface ContainerInput {
  readonly lengthMm?: string;
  readonly widthMm?: string;
  readonly heightMm?: string;
  readonly openingWidthMm?: string;
  readonly openingHeightMm?: string;
  readonly payloadKg?: string;
}

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
  const drawer = page.locator("#project-persistence-drawer");
  if (await drawer.isVisible()) return;
  await page.getByRole("button", { name: "ナビゲーションメニューを開く" }).click();
  await drawer.waitFor({ state: "visible" });
}

export async function openCargoAddEditor(page: Page): Promise<void> {
  await openPersistenceDrawer(page);
  await page
    .locator("#project-persistence-drawer")
    .getByRole("button", { name: "積荷を追加", exact: true })
    .click();
  await page.getByRole("dialog", { name: "積荷を追加" }).waitFor({ state: "visible" });
}

export async function addCargoFromDrawer(
  page: Page,
  name: string,
  input: CargoInput = {},
): Promise<void> {
  await openCargoAddEditor(page);
  await page.getByLabel("積荷名").fill(name);
  await page.getByLabel("長さ", { exact: true }).fill(input.lengthMm ?? "100");
  await page.getByLabel("幅", { exact: true }).fill(input.widthMm ?? "100");
  await page.getByLabel("高さ", { exact: true }).fill(input.heightMm ?? "100");
  await page.getByLabel("重量").fill(input.massKg ?? "1");
  if (input.canSupportCargo !== undefined) {
    await page
      .getByLabel("この積荷の上面で別の積荷を幾何学的に支持できる")
      .setChecked(input.canSupportCargo);
  }
  if (input.uprightOnly !== undefined) {
    await page.getByLabel(/天地無用/).setChecked(input.uprightOnly);
  }
  await page.getByRole("button", { name: "積荷を保存" }).click();
  await expect(page.locator("#app-navigation-button")).toBeFocused();
}

export async function openContainerAddEditor(page: Page): Promise<void> {
  await openPersistenceDrawer(page);
  await page
    .locator("#project-persistence-drawer")
    .getByRole("button", { name: "コンテナを追加", exact: true })
    .click();
  await page.getByRole("dialog", { name: "コンテナを追加" }).waitFor({ state: "visible" });
}

export async function addContainerFromDrawer(
  page: Page,
  name: string,
  input: ContainerInput = {},
): Promise<void> {
  await openContainerAddEditor(page);
  await page.getByLabel("コンテナ名").fill(name);
  await page.getByLabel("内部長さ").fill(input.lengthMm ?? "500");
  await page.getByLabel("内部幅").fill(input.widthMm ?? "500");
  await page.getByLabel("内部高さ").fill(input.heightMm ?? "500");
  await page.getByLabel("開口幅").fill(input.openingWidthMm ?? input.widthMm ?? "500");
  await page.getByLabel("開口高さ").fill(input.openingHeightMm ?? input.heightMm ?? "500");
  await page.getByLabel("総耐荷重").fill(input.payloadKg ?? "100");
  await page.getByRole("button", { name: "コンテナを保存" }).click();
  await expect(page.locator("#app-navigation-button")).toBeFocused();
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
