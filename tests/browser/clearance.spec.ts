import { mkdir } from "node:fs/promises";
import { fileURLToPath } from "node:url";
import { expect, test } from "./fixtures";
import { openPersistenceDrawer } from "./ui-helpers";

const demo = fileURLToPath(new URL("../../docs/demos/2026-10-28/05-local-recessed-floor.json", import.meta.url));
const output = fileURLToPath(new URL("../../output/pdf/", import.meta.url));

test("explicit migration cancellation, raw backup, measurements and new JSON", async ({ page }) => {
  await page.removeLocatorHandler(page.getByRole("button", { name: "変換して開く", exact: true }));
  await page.goto("/");
  await openPersistenceDrawer(page);
  await page.locator("#project-json-file-input").setInputFiles(demo);
  const dialog = page.getByRole("dialog", { name: "旧データの変換" });
  await expect(dialog).toBeVisible();
  await dialog.getByRole("button", { name: "キャンセル", exact: true }).click();
  await expect(page.locator("#current-project-settings-button")).toHaveText("新規CLP");
  await page.locator("#project-json-file-input").setInputFiles(demo);
  await expect(dialog).toBeVisible();
  const backup = page.waitForEvent("download");
  await dialog.getByRole("button", { name: "変換前の原本を保存" }).click();
  expect((await backup).suggestedFilename()).toBe("auto-clp-before-migration.json");
  await dialog.getByRole("button", { name: "変換して開く" }).click();
  await expect(page.locator("#current-project-settings-button")).toContainText("段落ち");
  await page.getByRole("button", { name: "CLPデータを閉じる" }).click();
  await page.getByLabel("操作する積荷", { exact: true }).selectOption({ label: "No.3 背高制御盤（段落ち検証・架空木枠） — 1400×950×2700 mm／650 kg" });
  await page.getByRole("button", { name: "2D", exact: true }).click();
  await expect(page.locator('[data-sources~="cargo-03:x-"] text')).toHaveText("200");
  const before = await page.locator("#top-clearance-description").textContent();
  const canvas = page.locator("#scene-viewport-canvas");
  await canvas.focus();
  await page.keyboard.down("ArrowRight");
  await expect(page.locator("#top-clearance-description")).not.toHaveText(before!);
  await page.keyboard.press("Escape");
  await page.keyboard.up("ArrowRight");
  await expect(page.locator("#top-clearance-description")).toHaveText(before!);
  await mkdir(output, { recursive: true });
  await page.screenshot({ path: `${output}/clearance-screen.png` });
  await expect(page.getByRole("checkbox", { name: "実間隔", exact: true })).toHaveCount(0);
  await page.getByRole("button", { name: "3D", exact: true }).click();
  await expect(page.locator(".viewport__clearance-annotations")).toHaveCount(0);
  await expect(page.locator("#top-clearance-description")).toHaveCount(0);
  await page.getByRole("button", { name: "2D", exact: true }).click();
  await expect(page.locator("#top-clearance-description")).toHaveText(before!);
  await openPersistenceDrawer(page);
  const saved = page.waitForEvent("download");
  await page.getByRole("button", { name: "JSONへ保存", exact: true }).click();
  const download = await saved;
  expect(download.suggestedFilename()).toBe("auto-clp-project-0.3.0.json");
  const stream = await download.createReadStream(); const chunks: Buffer[] = [];
  for await (const chunk of stream) chunks.push(Buffer.from(chunk));
  const value = JSON.parse(Buffer.concat(chunks).toString());
  expect(value.clearancesMm).toBeUndefined(); expect(value.nextCargoNo).toBe(11);
  expect(value.placements).toHaveLength(10);
});

test("recessed configuration exports same-page top view and fixed cargo numbers", async ({ page }) => {
  await page.removeLocatorHandler(page.getByRole("button", { name: "変換して開く", exact: true }));
  await mkdir(output, { recursive: true });
  await page.goto("/"); await openPersistenceDrawer(page);
  await page.locator("#project-json-file-input").setInputFiles(fileURLToPath(new URL("../../docs/demos/2026-10-28/06-current-sample.json", import.meta.url)));
  await expect(page.locator("#current-project-settings-button")).toContainText("段落ち");
  await expect(page.getByRole("dialog", { name: "旧データの変換" })).toHaveCount(0);
  await page.getByRole("button", { name: "CLPデータを閉じる" }).click();
  for (const index of [0, 1]) {
    await page.locator(`#scene-container-tab-${index}`).click();
    await page.locator("#loading-report-button").click();
    const dialog = page.getByRole("dialog", { name: "配置イメージ・PDF帳票" });
    await dialog.getByRole("button", { name: "配置画像を生成", exact: true }).click();
    await expect(dialog.getByAltText("上面図・配置イメージ")).toBeVisible();
    const event = page.waitForEvent("download");
    await dialog.getByRole("button", { name: "PDFを出力", exact: true }).click();
    await (await event).saveAs(`${output}/clearance-${index === 0 ? "A" : "B"}.pdf`);
    await dialog.getByRole("button", { name: "配置イメージ・PDF帳票を閉じる", exact: true }).click();
  }
});
