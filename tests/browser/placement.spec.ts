import { expect, test, type Page } from "@playwright/test";

const previewName = "積荷を選択・床面移動できる3Dプレビュー";

async function addCargo(page: Page, name: string) {
  await page.getByRole("button", { name: "積荷を追加" }).click();
  await page.getByLabel("積荷名").fill(name);
  await page.getByLabel("長さ", { exact: true }).fill("1200");
  await page.getByLabel("幅", { exact: true }).fill("800");
  await page.getByLabel("高さ", { exact: true }).fill("900");
  await page.getByLabel("重量").fill("1.005");
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

async function createPlacementFixture(page: Page) {
  await addCargo(page, "合成配置積荷");
  await addContainer(page, "合成配置候補A");
  await addContainer(page, "合成配置候補B");
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

test("creates, edits, switches, cancels, and deletes a placement transactionally", async ({
  page,
}) => {
  await page.goto("/");
  await expect(page.getByRole("status")).toHaveAttribute("data-capability-state", "supported");
  await createPlacementFixture(page);

  const sceneSelect = page.getByLabel("表示する候補");
  const placementPanel = page.locator(".placement-panel");
  const physicalPanel = page.locator(".physical-validation");
  const placementStatus = placementPanel.locator(".action-status");
  await expect(sceneSelect).toHaveValue("container-1");
  await expect(placementStatus).toHaveAttribute("aria-live", "polite");
  await expect(placementStatus).toHaveAttribute("aria-atomic", "true");

  await placementPanel.getByRole("button", { name: "配置を追加: 合成配置積荷" }).click();
  await expect(page.getByLabel("X最小角")).toBeFocused();
  await expect(sceneSelect).toBeDisabled();
  await expect(page.getByLabel("X最小角")).toHaveValue("0");
  await expect(page.getByLabel("Y最小角")).toHaveValue("0");
  await expect(page.getByLabel("Z最小角")).toHaveValue("0");
  await expect(page.getByLabel("向き")).toHaveValue("LWH");
  await expect(
    placementPanel.getByText("この候補に配置された積荷はありません。"),
  ).toBeVisible();
  await expect(page.locator("#scene-workspace-status")).toHaveText(
    "選択中の候補: 合成配置候補A。配置0件。仮置き場1件。積荷は未選択です。物理判定は保存済み配置だけから自動更新されます。",
  );
  await expect(physicalPanel.locator(".physical-validation__summary")).toHaveText(
    "適合：この候補には配置済みの積荷がありません。",
  );

  await placementPanel.getByRole("button", { name: "配置編集をキャンセル" }).click();
  await expect(
    placementPanel.getByRole("button", { name: "配置を追加: 合成配置積荷" }),
  ).toBeFocused();
  await expect(placementPanel.getByText("新しい配置を追加せず、未保存入力を破棄しました。")).toBeVisible();
  await expect(sceneSelect).toBeEnabled();
  await expect(page.locator("#scene-workspace-status")).toContainText("配置0件");

  await placementPanel.getByRole("button", { name: "配置を追加: 合成配置積荷" }).click();
  await page.getByLabel("X最小角").fill("-1000000");
  await expect(physicalPanel.locator(".physical-validation__summary")).toHaveText(
    "適合：この候補には配置済みの積荷がありません。",
  );

  await page.getByLabel("X最小角").fill("1.5");
  await placementPanel.getByRole("button", { name: "配置を保存" }).click();
  await expect(page.getByLabel("X最小角")).toBeFocused();
  await expect(page.getByLabel("X最小角")).toHaveAttribute("aria-invalid", "true");
  await expect(
    placementPanel.getByText("この候補に配置された積荷はありません。"),
  ).toBeVisible();
  await expect(page.locator("#scene-workspace-status")).toContainText("配置0件");

  await page.getByLabel("X最小角").fill("-1000000");
  await page.getByLabel("Y最小角").fill("1000000");
  await page.getByLabel("Z最小角").fill("-1");
  await page.getByLabel("向き").selectOption("WLH");
  await placementPanel.getByRole("button", { name: "配置を保存" }).click();
  await expect(sceneSelect).toBeEnabled();
  await expect(placementPanel.getByText("最小角 X -1000000・Y 1000000・Z -1 mm / WLH")).toBeVisible();
  await expect(page.locator("#scene-workspace-status")).toHaveText(
    "選択中の候補: 合成配置候補A。配置1件。仮置き場0件。積荷は未選択です。物理判定は保存済み配置だけから自動更新されます。",
  );
  await expect(physicalPanel.locator(".physical-validation__summary")).toHaveText(
    "不適合：修正が必要な理由が1件あります。未確認事項1件も保持して表示します。",
  );
  await expect(physicalPanel.getByRole("heading", { name: "不適合理由（1件）" })).toBeVisible();
  await expect(physicalPanel.locator(".physical-validation__reason").first()).toContainText(
    "積荷が床より下へ貫通しています。Z座標を0以上に修正してください。",
  );
  await expect(physicalPanel.getByText("opening-path-unverified")).toHaveCount(0);
  await expect(physicalPanel.getByText("床にない積荷の底面が", { exact: false })).toHaveCount(0);
  await expect(physicalPanel.getByText("軸別隙間が不足", { exact: false })).toHaveCount(0);
  await expect(physicalPanel.getByRole("heading", { name: "未確認理由（1件）" })).toBeVisible();
  await expect(physicalPanel).toContainText("完全な搬入経路は未確認です");
  await expect(page.getByRole("img", { name: previewName })).toBeVisible();

  await sceneSelect.selectOption("container-2");
  await expect(page.locator("#scene-workspace-status")).toHaveText(
    "選択中の候補: 合成配置候補B。配置0件。仮置き場0件。積荷は未選択です。物理判定は保存済み配置だけから自動更新されます。",
  );
  await expect(physicalPanel.locator(".physical-validation__summary")).toHaveText(
    "適合：この候補には配置済みの積荷がありません。",
  );
  await expect(placementPanel.getByText("未配置の積荷はありません。")).toBeVisible();
  await expect(placementPanel.getByRole("button", { name: "配置を追加: 合成配置積荷" })).toHaveCount(0);

  await sceneSelect.selectOption("container-1");
  await placementPanel.getByRole("button", { name: "編集: 合成配置積荷" }).click();
  await page.getByLabel("X最小角").fill("123");
  await expect(physicalPanel.locator(".physical-validation__summary")).toHaveText(
    "不適合：修正が必要な理由が1件あります。未確認事項1件も保持して表示します。",
  );
  await expect(sceneSelect).toBeDisabled();
  await placementPanel.getByRole("button", { name: "配置編集をキャンセル" }).click();
  await expect(placementPanel.getByRole("button", { name: "編集: 合成配置積荷" })).toBeFocused();
  await expect(placementPanel.getByText("最小角 X -1000000・Y 1000000・Z -1 mm / WLH")).toBeVisible();
  await expect(physicalPanel.locator(".physical-validation__summary")).toHaveText(
    "不適合：修正が必要な理由が1件あります。未確認事項1件も保持して表示します。",
  );

  await placementPanel.getByRole("button", { name: "配置を削除: 合成配置積荷" }).click();
  await expect(sceneSelect).toBeDisabled();
  await expect(placementPanel.getByRole("button", { name: "配置の削除を確定" })).toBeFocused();
  await placementPanel.getByRole("button", { name: "配置の削除をやめる" }).click();
  await expect(placementPanel.getByRole("button", { name: "配置を削除: 合成配置積荷" })).toBeFocused();
  await expect(placementPanel.getByText("最小角 X -1000000・Y 1000000・Z -1 mm / WLH")).toBeVisible();

  await placementPanel.getByRole("button", { name: "配置を削除: 合成配置積荷" }).click();
  await placementPanel.getByRole("button", { name: "配置の削除を確定" }).click();
  await expect(sceneSelect).toBeEnabled();
  await expect(placementPanel.getByRole("button", { name: "配置を追加: 合成配置積荷" })).toBeFocused();
  await expect(placementPanel.getByText("積荷は未配置一覧へ戻りました。")).toBeVisible();
  await expect(page.locator("#scene-workspace-status")).toHaveText(
    "選択中の候補: 合成配置候補A。配置0件。仮置き場1件。積荷は未選択です。物理判定は保存済み配置だけから自動更新されます。",
  );
  await expect(physicalPanel.locator(".physical-validation__summary")).toHaveText(
    "適合：この候補には配置済みの積荷がありません。",
  );
});

test("closes a new-placement draft safely when its selected container is deleted", async ({
  page,
}) => {
  await page.goto("/?forceWebgl2=unsupported");
  await addCargo(page, "stale検証積荷");
  await addContainer(page, "stale検証候補A");
  await addContainer(page, "stale検証候補B");

  const sceneSelect = page.getByLabel("表示する候補");
  const panel = page.locator(".placement-panel");
  await panel.getByRole("button", { name: "配置を追加: stale検証積荷" }).click();
  await page.getByLabel("X最小角").fill("123");
  await expect(sceneSelect).toBeDisabled();

  await page.getByRole("button", { name: "削除: stale検証候補A" }).click();
  await page.getByRole("button", { name: "削除を確定: stale検証候補A" }).click();

  await expect(page.getByLabel("X最小角")).toHaveCount(0);
  await expect(sceneSelect).toBeEnabled();
  await expect(sceneSelect).toHaveValue("container-2");
  await expect(
    panel.getByRole("heading", { name: "配置", exact: true }),
  ).toBeFocused();
  await expect(panel.getByText("積荷または候補の状態が変わったため、新しい配置を追加せず編集を閉じました。")).toBeVisible();
  await expect(
    panel.getByRole("button", { name: "配置を追加: stale検証積荷" }),
  ).toBeVisible();
  await expect(page.locator("#scene-workspace-status")).toContainText("配置0件");
});

test("supports placement CRUD without WebGL while keeping the canvas absent", async ({ page }) => {
  await page.goto("/?forceWebgl2=unsupported");
  await expect(page.getByRole("status")).toHaveAttribute("data-capability-state", "unsupported");
  await addCargo(page, "非対応時配置積荷");
  await addContainer(page, "非対応時配置候補");
  const panel = page.locator(".placement-panel");
  await expect(page.getByRole("img", { name: previewName })).toHaveCount(0);

  await panel.getByRole("button", { name: "配置を追加: 非対応時配置積荷" }).click();
  await page.getByLabel("X最小角").fill("-1");
  await panel.getByRole("button", { name: "配置を保存" }).click();
  await panel.getByRole("button", { name: "編集: 非対応時配置積荷" }).click();
  await page.getByLabel("X最小角").fill("-2");
  await panel.getByRole("button", { name: "配置を保存" }).click();
  await expect(panel.getByText("最小角 X -2・Y 0・Z 0 mm / LWH")).toBeVisible();
  await panel.getByRole("button", { name: "配置を削除: 非対応時配置積荷" }).click();
  await panel.getByRole("button", { name: "配置の削除を確定" }).click();
  await expect(panel.getByRole("button", { name: "配置を追加: 非対応時配置積荷" })).toBeVisible();
  await expect(page.getByRole("img", { name: previewName })).toHaveCount(0);
});

test("has no placement editor overflow at 305, 320, and 375 pixels", async ({ page }) => {
  await page.setViewportSize({ width: 305, height: 900 });
  await page.goto("/?forceWebgl2=unsupported");
  await addCargo(page, "狭幅配置積荷");
  await addContainer(page, "狭幅配置候補");
  const panel = page.locator(".placement-panel");
  await panel.getByRole("button", { name: "配置を追加: 狭幅配置積荷" }).click();
  await expectNoHorizontalOverflow(page);

  await page.setViewportSize({ width: 320, height: 900 });
  await expectNoHorizontalOverflow(page);
  await panel.getByRole("button", { name: "配置を保存" }).click();
  await panel.getByRole("button", { name: "配置を削除: 狭幅配置積荷" }).click();

  await page.setViewportSize({ width: 375, height: 900 });
  await expectNoHorizontalOverflow(page);
});
