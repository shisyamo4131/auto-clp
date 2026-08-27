import { expect, test } from "@playwright/test";

test("shows a deterministic unsupported WebGL 2 state", async ({ page }) => {
  await page.goto("/?forceWebgl2=unsupported");

  const status = page.getByRole("status");
  await expect(status).toHaveAttribute("data-capability-state", "unsupported");
  await expect(page.getByRole("heading", { name: "3D表示を利用できません" })).toBeVisible();
  await expect(
    page.getByRole("img", { name: "積荷を選択・床面移動できる3Dプレビュー" }),
  ).toHaveCount(0);
});

test("shows the supported preview in the verification browser", async ({ page }) => {
  await page.goto("/");

  await expect(page.getByRole("heading", { level: 1, name: "Auto CLP" })).toBeVisible();
  const status = page.getByRole("status");
  await expect(status).toHaveAttribute("data-capability-state", "supported");
  await expect(
    page.getByRole("img", { name: "積荷を選択・床面移動できる3Dプレビュー" }),
  ).toBeVisible();
  await expect(page.getByLabel("現在の制限")).toContainText("安全性");
});

test("does not report supported when the initial render fails", async ({ page }) => {
  await page.goto("/?forceRenderer=initial-render-error");

  const status = page.getByRole("status");
  await expect(status).toHaveAttribute("data-capability-state", "renderer-error");
  await expect(page.getByRole("heading", { name: "3D表示で問題が発生しました" })).toBeVisible();
  await expect(
    page.getByRole("img", { name: "積荷を選択・床面移動できる3Dプレビュー" }),
  ).toHaveCount(0);
});

test("stops rendering when the WebGL context is lost", async ({ page }) => {
  await page.goto("/");

  const status = page.getByRole("status");
  await expect(status).toHaveAttribute("data-capability-state", "supported");
  const preview = page.getByRole("img", {
    name: "積荷を選択・床面移動できる3Dプレビュー",
  });
  await expect(preview).toBeVisible();

  await preview.evaluate((canvas) => {
    canvas.dispatchEvent(new Event("webglcontextlost", { cancelable: true }));
  });

  await expect(status).toHaveAttribute("data-capability-state", "renderer-error");
  await expect(page.getByRole("heading", { name: "3D表示で問題が発生しました" })).toBeVisible();
  await expect(preview).toHaveCount(0);
});
