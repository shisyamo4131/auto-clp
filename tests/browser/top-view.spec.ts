import { mkdir, readFile } from "node:fs/promises";
import { fileURLToPath } from "node:url";
import { expect, test, type Page } from "./fixtures";
import { openPersistenceDrawer } from "./ui-helpers";

const demo = fileURLToPath(new URL("../../docs/demos/2026-10-28/05-local-recessed-floor.json", import.meta.url));
async function openTop(page: Page) {
  await page.goto("/");
  await openPersistenceDrawer(page);
  await page.locator("#project-json-file-input").setInputFiles(demo);
  await expect(page.locator("#current-project-settings-button")).toContainText("段落ち");
  await page.getByRole("button", { name: "CLPデータを閉じる" }).click();
  await page.getByRole("button", { name: "2D", exact: true }).click();
  await page.getByLabel("操作する積荷", { exact: true }).selectOption("cargo-03");
  await expect(page.locator('.viewport[data-view-mode="2d"]')).toBeVisible();
}
test("top view measurements, nudge, cancellation and restored 3D camera", async ({ page }, testInfo) => {
  await openTop(page);
  const gaps = page.locator(".viewport__clearance-annotations text");
  await expect.poll(() => gaps.count()).toBeGreaterThan(4);
  await expect(page.getByRole("checkbox", { name: "実間隔", exact: true })).toHaveCount(0);
  for (const label of await gaps.allTextContents()) expect(label).toMatch(/^\d+$/);
  await expect(page.locator(".clearance-readout")).toHaveCount(0);
  await expect(page.locator('.viewport__dimension-annotations [data-axis="Z"]')).toHaveCount(0);
  await expect(page.locator(".viewport__top-labels")).toContainText("深さ 400");
  const left = page.locator('[data-sources~="cargo-03:x-"] text');
  await expect(left).toHaveText("200");
  const canvas = page.locator("#scene-viewport-canvas");
  await canvas.focus(); await page.keyboard.down("ArrowRight");
  await expect(left).toHaveText("201");
  await page.keyboard.press("Escape"); await page.keyboard.up("ArrowRight");
  await expect(left).toHaveText("200");
  await page.keyboard.press("ArrowRight");
  await expect(left).toHaveText("201");
  await expect(page.locator("#scene-workspace-action-status")).toBeEmpty();
  await expect(page.locator(".scene-workspace__action-status")).toHaveCount(0);
  await page.screenshot({ path: testInfo.outputPath("top-view.png") });
  const output = fileURLToPath(new URL("../../output/pdf/", import.meta.url));
  await mkdir(output, { recursive: true });
  await page.screenshot({ path: `${output}/top-view.png` });
  await page.getByRole("button", { name: "X軸を中心に90°回転" }).click({ force: true });
  await expect(page.locator("#scene-workspace-action-status")).toContainText("2Dでは床面上");
  await page.getByRole("button", { name: "3D", exact: true }).click();
  await expect(page.locator(".viewport__clearance-annotations")).toHaveCount(0);
  await expect(page.locator(".clearance-readout")).toHaveCount(0);
  const before = await page.locator(".viewport__dimension-annotations").innerHTML();
  await page.getByRole("button", { name: "2D", exact: true }).click();
  await expect(left).toHaveText("201");
  await page.getByRole("button", { name: "3D", exact: true }).click();
  await expect(page.locator(".viewport__dimension-annotations")).toHaveJSProperty("innerHTML", before);
});

test("top view actual pointer preview rejects crossing a step", async ({ page }) => {
  await openTop(page);
  const label = page.locator('.viewport__top-labels [data-cargo-id="cargo-03"]');
  const bounds = await label.boundingBox(); expect(bounds).not.toBeNull();
  const segment = page.locator('[data-sources~="cargo-03:x-"]');
  const pixels = Math.abs(Number(await segment.getAttribute("data-x2")) - Number(await segment.getAttribute("data-x1")));
  const center = { x: bounds!.x + bounds!.width / 2, y: bounds!.y + bounds!.height / 2 };
  await page.mouse.move(center.x, center.y); await page.mouse.down();
  await page.mouse.move(center.x - pixels * 2.5, center.y, { steps: 5 });
  await expect(page.locator("#scene-workspace-action-status")).toContainText("段差をまたいでいます");
  await expect(page.getByRole("button", { name: "3D", exact: true })).toBeDisabled();
  await page.mouse.up();
  await expect(page.locator('[data-sources~="cargo-03:x-"] text')).toHaveText("200");
});


test("2D floor transition, zoom/pan, rotation, JSON preservation and current-view image", async ({ page }) => {
  const data = JSON.parse(await readFile(demo, "utf8"));
  data.placements = data.placements.filter((p: { cargoId: string }) => p.cargoId === "cargo-03");
  await page.goto("/"); await openPersistenceDrawer(page);
  await page.locator("#project-json-file-input").setInputFiles({ name: "synthetic.json", mimeType: "application/json", buffer: Buffer.from(JSON.stringify(data)) });
  await expect(page.locator("#current-project-settings-button")).toContainText("段落ち");
  await page.getByRole("button", { name: "CLPデータを閉じる" }).click();
  await page.getByRole("button", { name: "2D", exact: true }).click();
  await page.getByLabel("操作する積荷", { exact: true }).selectOption("cargo-03");
  const label = page.locator('.viewport__top-labels [data-cargo-id="cargo-03"]');
  const box = await label.boundingBox(); expect(box).not.toBeNull();
  const segment = page.locator('[data-sources~="cargo-03:x-"]');
  const scale = Math.abs(Number(await segment.getAttribute("data-x2")) - Number(await segment.getAttribute("data-x1"))) / 200;
  const x = box!.x + box!.width / 2, y = box!.y + 3;
  await page.mouse.move(x, y); await page.mouse.down();
  await page.mouse.move(x + 1900 * scale, y, { steps: 5 }); await page.mouse.up();
  await expect(page.locator("#scene-workspace-action-status")).toContainText("Z 0 mm");
  await page.getByRole("button", { name: "Z軸を中心に90°回転" }).click();
  await expect(label).toContainText("950 × 1400");
  const initial = await label.getAttribute("x");
  await page.mouse.move(600, 350); await page.mouse.wheel(0, -100);
  await expect(label).not.toHaveAttribute("x", initial!);
  const zoomed = await label.getAttribute("x");
  await page.keyboard.down("Control"); await page.mouse.move(600, 350); await page.mouse.down();
  await page.mouse.move(630, 370); await page.mouse.up(); await page.keyboard.up("Control");
  await expect(label).not.toHaveAttribute("x", zoomed!);
  await page.getByRole("button", { name: "荷室全体を表示", exact: true }).click();
  await openPersistenceDrawer(page);
  const downloadEvent = page.waitForEvent("download");
  await page.getByRole("button", { name: "JSONへ保存", exact: true }).click();
  const stream = await (await downloadEvent).createReadStream(); const chunks: Buffer[] = [];
  for await (const chunk of stream) chunks.push(Buffer.from(chunk));
  const saved = JSON.parse(Buffer.concat(chunks).toString());
  expect(saved.schemaVersion).toBe("0.3.0"); expect(saved.viewMode).toBeUndefined();
  expect(saved.placements[0].positionMm.zMm).toBe(0); expect(saved.placements[0].orientation).toBe("WLH");
  await page.getByRole("button", { name: "CLPデータを閉じる" }).click();
  await page.locator("#loading-report-button").click();
  const dialog = page.getByRole("dialog", { name: "配置イメージ・PDF帳票" });
  await dialog.getByRole("button", { name: "配置画像を生成", exact: true }).click();
  await expect(dialog.getByAltText("上面図・配置イメージ")).toBeVisible();
  await expect(dialog.locator("img")).toHaveCount(6);
});

test("2D blocks elevated and supporting cargo edits", async ({ page }) => {
  const data = JSON.parse(await readFile(demo, "utf8"));
  data.placements.find((p: { cargoId: string }) => p.cargoId === "cargo-03").positionMm = { xMm: 4100, yMm: 150, zMm: 1600 };
  await page.goto("/"); await openPersistenceDrawer(page);
  await page.locator("#project-json-file-input").setInputFiles({ name: "stacked.json", mimeType: "application/json", buffer: Buffer.from(JSON.stringify(data)) });
  await expect(page.locator("#current-project-settings-button")).toContainText("段落ち");
  await page.getByRole("button", { name: "CLPデータを閉じる" }).click();
  await page.getByRole("button", { name: "2D", exact: true }).click();
  for (const id of ["cargo-03", "cargo-01"]) {
    await page.getByLabel("操作する積荷", { exact: true }).selectOption(id);
    await expect(page.getByRole("button", { name: "Z軸を中心に90°回転" })).toBeDisabled();
    await page.locator("#scene-viewport-canvas").focus(); await page.keyboard.press("ArrowRight");
    await expect(page.locator("#scene-workspace-action-status")).toContainText("3Dへ切り替えて");
  }
});


test("empty project supports both views without a renderer failure", async ({ page }) => {
  await page.goto("/");
  await page.getByRole("button", { name: "2D", exact: true }).click();
  await expect(page.locator('.viewport[data-view-mode="2d"]')).toBeVisible();
  await expect(page.getByRole("button", { name: "3D", exact: true })).toBeEnabled();
  await page.getByRole("button", { name: "荷室全体を表示", exact: true }).click();
  await page.getByRole("button", { name: "3D", exact: true }).click();
  await expect(page.locator('.viewport[data-view-mode="3d"]')).toBeVisible();
});


test("every cargo shows clearance without selection and neighbors follow a moving preview", async ({ page }) => {
  await openTop(page);
  const svg = page.locator(".viewport__clearance-annotations");
  const before = await svg.textContent();
  await page.mouse.click(110, 400);
  await expect(svg).toHaveText(before!);
  for (const id of ["cargo-01", "cargo-02", "cargo-03", "cargo-04", "cargo-05"]) {
    for (const direction of ["x-", "x+", "y-", "y+"]) {
      await expect(page.locator(`[data-sources~="${id}:${direction}"]`)).toHaveCount(1);
    }
  }
  await expect(page.locator('[data-sources~="cargo-03:y+"][data-sources~="cargo-04:y-"]')).toHaveCount(1);
  const neighbor = page.locator('[data-sources~="cargo-01:x-"] text');
  await expect(neighbor).toHaveText("500");
  await page.getByLabel("操作する積荷", { exact: true }).selectOption("cargo-03");
  await page.locator("#scene-viewport-canvas").focus(); await page.keyboard.down("ArrowRight");
  await expect(neighbor).toHaveText("499");
  await page.keyboard.press("Escape"); await page.keyboard.up("ArrowRight");
  await expect(neighbor).toHaveText("500");
  await page.getByRole("button", { name: "3D", exact: true }).click();
  await expect(svg).toHaveCount(0);
  await page.getByRole("button", { name: "2D", exact: true }).click();
  await expect(neighbor).toHaveText("500");
  await page.locator("#scene-container-tab-1").click();
  await expect(page.locator('[data-sources~="cargo-03:x-"]')).toHaveCount(0);
  await expect(page.locator('[data-sources~="cargo-06:x-"]')).toHaveCount(1);
});
