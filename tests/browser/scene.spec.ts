import { expect, test, type Page } from "@playwright/test";

const previewName = "操作・判定結果ではない確認用直方体の3Dプレビュー";

async function addContainer(page: Page, name: string, lengthMm = "6000") {
  await page.getByRole("button", { name: "候補を追加" }).click();
  await page.getByLabel("候補名").fill(name);
  await page.getByLabel("内部長さ").fill(lengthMm);
  await page.getByLabel("内部幅").fill("2400");
  await page.getByLabel("内部高さ").fill("2600");
  await page.getByLabel("開口幅").fill("2399");
  await page.getByLabel("開口高さ").fill("2500");
  await page.getByLabel("総耐荷重").fill("100000");
  await page.getByRole("button", { name: "候補を保存" }).click();
}

async function expectNoHorizontalOverflow(page: Page) {
  const overflows = await page.evaluate(() => {
    const browserGlobal = globalThis as unknown as {
      readonly document: {
        readonly documentElement: { readonly scrollWidth: number; readonly clientWidth: number };
      };
    };
    const root = browserGlobal.document.documentElement;
    return root.scrollWidth > root.clientWidth;
  });
  expect(overflows).toBe(false);
}

test("shows an empty unjudged scene with a supported canvas", async ({ page }) => {
  await page.goto("/");

  await expect(page.getByRole("status")).toHaveAttribute(
    "data-capability-state",
    "supported",
  );
  await expect(page.getByText("表示する候補がありません。案件入力でコンテナ・車両候補を追加してください。")).toBeVisible();
  await expect(page.getByText("候補0件、配置0件。適合判定は未実施です。")).toBeVisible();
  await expect(page.getByRole("img", { name: previewName })).toBeVisible();
});

test("keeps scene selection stable across add, edit, switch, and delete", async ({ page }) => {
  await page.goto("/");
  const capabilityStatus = page.getByRole("status");
  await expect(capabilityStatus).toHaveAttribute(
    "data-capability-state",
    "supported",
  );

  await addContainer(page, "合成候補A");
  const sceneSelect = page.getByLabel("表示する候補");
  await expect(sceneSelect).toHaveValue("container-1");
  await expect(page.getByText("選択中: 合成候補A。配置0件。適合判定は未実施です。")).toBeVisible();

  await addContainer(page, "合成候補B", "7001");
  await expect(sceneSelect).toHaveValue("container-1");
  const sceneStatus = page.locator("#scene-workspace-status");
  await expect(sceneStatus).toHaveAttribute("aria-live", "polite");
  await expect(sceneStatus).toHaveAttribute("aria-atomic", "true");
  await expect(capabilityStatus.getByLabel("表示する候補")).toHaveCount(0);
  await expect(capabilityStatus.getByRole("img", { name: previewName })).toHaveCount(0);
  const capabilityCopy = await capabilityStatus.textContent();
  await sceneSelect.selectOption({ label: "合成候補B" });
  await expect(sceneStatus).toHaveText("選択中: 合成候補B。配置0件。適合判定は未実施です。");
  await expect(capabilityStatus).toHaveText(capabilityCopy ?? "");

  await page.getByRole("button", { name: "編集: 合成候補B" }).click();
  await page.getByLabel("候補名").fill("合成候補B更新");
  await page.getByLabel("内部長さ").fill("8001");
  await page.getByRole("button", { name: "候補の変更を保存: 合成候補B" }).click();
  await expect(sceneSelect).toHaveValue("container-2");
  await expect(page.getByText("選択中: 合成候補B更新。配置0件。適合判定は未実施です。")).toBeVisible();
  await expect(page.getByRole("img", { name: previewName })).toBeVisible();

  await page.getByRole("button", { name: "削除: 合成候補B更新" }).click();
  await page.getByRole("button", { name: "削除を確定: 合成候補B更新" }).click();
  await expect(sceneSelect).toHaveValue("container-1");
  await expect(page.getByText("選択中: 合成候補A。配置0件。適合判定は未実施です。")).toBeVisible();
});

test("keeps scene input available without WebGL and does not mount a canvas", async ({
  page,
}) => {
  await page.goto("/?forceWebgl2=unsupported");

  await expect(page.getByRole("status")).toHaveAttribute(
    "data-capability-state",
    "unsupported",
  );
  await expect(page.getByRole("img", { name: previewName })).toHaveCount(0);
  await addContainer(page, "非対応時の合成候補");
  await expect(page.getByLabel("表示する候補")).toHaveValue("container-1");
  await expect(page.getByText("選択中: 非対応時の合成候補。配置0件。適合判定は未実施です。")).toBeVisible();
  await expect(page.getByRole("img", { name: previewName })).toHaveCount(0);
});

test("keeps the scene workspace within 305, 320, and 375 pixel viewports", async ({
  page,
}) => {
  await page.setViewportSize({ width: 305, height: 900 });
  await page.goto("/");
  await expect(page.getByRole("status")).toHaveAttribute(
    "data-capability-state",
    "supported",
  );
  await addContainer(page, "狭幅表示用合成候補");
  await expect(page.getByRole("img", { name: previewName })).toBeVisible();
  await expectNoHorizontalOverflow(page);

  for (const width of [320, 375]) {
    await page.setViewportSize({ width, height: 900 });
    await expectNoHorizontalOverflow(page);
  }
});
