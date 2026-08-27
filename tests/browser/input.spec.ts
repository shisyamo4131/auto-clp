import { expect, test, type Page } from "@playwright/test";

async function fillCargo(page: Page, name: string) {
  await page.getByLabel("積荷名").fill(name);
  await page.getByLabel("長さ", { exact: true }).fill("1200");
  await page.getByLabel("幅", { exact: true }).fill("800");
  await page.getByLabel("高さ", { exact: true }).fill("900");
  await page.getByLabel("重量").fill("1.005");
}

async function fillContainer(page: Page, name: string) {
  await page.getByLabel("候補名").fill(name);
  await page.getByLabel("内部長さ").fill("6000");
  await page.getByLabel("内部幅").fill("2400");
  await page.getByLabel("内部高さ").fill("2600");
  await page.getByLabel("開口幅").fill("2400");
  await page.getByLabel("開口高さ").fill("2500");
  await page.getByLabel("総耐荷重").fill("100000");
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

test("edits project settings transactionally and focuses invalid input", async ({ page }) => {
  await page.goto("/?forceWebgl2=unsupported");

  const canonical = page.getByTestId("canonical-project-settings");
  await expect(canonical).toContainText("新規案件 / 隙間 X 0・Y 0・Z 0 mm");
  await page.getByLabel("案件名").fill("匿名案件A");
  await page.getByLabel("X方向の隙間").fill("10001");
  await page.getByRole("button", { name: "案件を保存" }).click();

  const invalid = page.getByLabel("X方向の隙間");
  await expect(invalid).toBeFocused();
  await expect(invalid).toHaveAttribute("aria-invalid", "true");
  await expect(page.locator("#project-settings-errors")).toHaveAttribute("tabindex", "-1");
  await expect(canonical).toContainText("新規案件 / 隙間 X 0・Y 0・Z 0 mm");

  await invalid.fill("10");
  await page.getByLabel("Y方向の隙間").fill("20");
  await page.getByLabel("Z方向の隙間").fill("30");
  await page.getByRole("button", { name: "案件を保存" }).click();
  await expect(canonical).toContainText("匿名案件A / 隙間 X 10・Y 20・Z 30 mm");
});

test("adds, edits, cancels, and explicitly deletes cargo", async ({ page }) => {
  await page.goto("/?forceWebgl2=unsupported");
  await page.getByRole("button", { name: "積荷を追加" }).click();
  await expect(page.getByLabel("積荷名")).toBeFocused();
  await fillCargo(page, "合成積荷A");
  await expect(page.getByLabel("長さ", { exact: true })).toHaveAccessibleDescription(
    "mm 1〜100,000の半角整数",
  );
  await expect(page.getByLabel("重量")).toHaveAccessibleDescription(
    "kg 0.001〜100,000 kg、小数3桁まで",
  );
  await expect(page.getByLabel("LWH — X=長さ・Y=幅・Z=高さ（既定）")).toBeChecked();
  await expect(page.getByLabel("WLH — X=幅・Y=長さ・Z=高さ（既定）")).toBeChecked();
  await expect(page.getByText("幾何判定用です。強度・安定性は未確認です。")).toBeVisible();
  await page.getByLabel("重量").fill("1.0001");
  await page.getByRole("button", { name: "積荷を保存" }).click();
  await expect(page.getByLabel("重量")).toBeFocused();
  await expect(page.getByRole("list", { name: "積荷一覧" })).not.toContainText("合成積荷A");
  await page.getByLabel("重量").fill("1.005");
  await page.getByRole("button", { name: "積荷を保存" }).click();
  await expect(page.getByRole("button", { name: "積荷を追加" })).toBeFocused();
  await expect(page.getByText("積荷を追加しました。")).toBeVisible();

  const list = page.getByRole("list", { name: "積荷一覧" });
  await expect(list).toContainText("合成積荷A");
  await page.getByRole("button", { name: "編集: 合成積荷A" }).click();
  await expect(page.getByLabel("積荷名")).toBeFocused();
  await expect(page.getByLabel("重量")).toHaveValue("1.005");
  await page.getByLabel("積荷名").fill("破棄する積荷名");
  await page.getByRole("button", { name: "積荷を追加" }).click();
  await expect(page.getByText("未保存の積荷入力があります。破棄して切り替えますか。")).toBeVisible();
  await expect(page.getByRole("button", { name: "未保存入力を破棄して切り替える" })).toBeFocused();
  await page.getByRole("button", { name: "積荷の編集を続ける" }).click();
  await expect(page.getByLabel("積荷名")).toBeFocused();
  await expect(page.getByLabel("積荷名")).toHaveValue("破棄する積荷名");
  await page.getByRole("button", { name: "積荷編集をキャンセル" }).click();
  await expect(page.getByRole("button", { name: "編集: 合成積荷A" })).toBeFocused();
  await expect(list).not.toContainText("破棄する積荷名");

  await page.getByRole("button", { name: "編集: 合成積荷A" }).click();
  await page.getByLabel("積荷名").fill("合成積荷B");
  await page.getByRole("button", { name: "積荷の変更を保存: 合成積荷A" }).click();
  await expect(list).toContainText("合成積荷B");

  await page.getByRole("button", { name: "積荷を追加" }).click();
  await fillCargo(page, "合成積荷C");
  await page.getByRole("button", { name: "積荷を保存" }).click();
  await page.getByRole("button", { name: "編集: 合成積荷B" }).click();
  await page.getByLabel("積荷名").fill("未保存の積荷B");
  await page.getByRole("button", { name: "編集: 合成積荷C" }).click();
  await page.getByRole("button", { name: "削除: 合成積荷C" }).click();
  await page.getByRole("button", { name: "削除を確定: 合成積荷C" }).click();
  await expect(page.getByText("未保存の積荷入力があります。破棄して切り替えますか。")).toHaveCount(0);
  await expect(page.getByLabel("積荷名")).toHaveValue("未保存の積荷B");
  await page.getByRole("button", { name: "積荷編集をキャンセル" }).click();

  await page.getByRole("button", { name: "削除: 合成積荷B" }).click();
  await expect(page.getByRole("button", { name: "削除を確定: 合成積荷B" })).toBeFocused();
  await page.getByRole("button", { name: "削除をやめる: 合成積荷B" }).click();
  await expect(page.getByRole("button", { name: "削除: 合成積荷B" })).toBeFocused();
  await expect(page.getByText("積荷の削除をキャンセルしました。")).toBeVisible();
  await expect(list).toContainText("合成積荷B");
  await page.getByRole("button", { name: "削除: 合成積荷B" }).click();
  await page.getByRole("button", { name: "削除を確定: 合成積荷B" }).click();
  await expect(page.getByRole("button", { name: "積荷を追加" })).toBeFocused();
  await expect(page.getByText("積荷を削除しました。")).toBeVisible();
  await expect(list).not.toContainText("合成積荷B");
});

test("adds, edits, cancels, and explicitly deletes a container candidate", async ({ page }) => {
  await page.goto("/?forceWebgl2=unsupported");
  await page.getByRole("button", { name: "候補を追加" }).click();
  await expect(page.getByLabel("候補名")).toBeFocused();
  await fillContainer(page, "合成候補A");
  await expect(page.getByLabel("内部長さ")).toHaveAccessibleDescription(
    "mm 1〜100,000の半角整数",
  );
  await expect(page.getByLabel("総耐荷重")).toHaveAccessibleDescription(
    "kg 0.001〜100,000 kg、小数3桁まで",
  );
  await expect(page.getByText("開口内回転や斜め通過を含む搬入経路は未確認です。")).toBeVisible();
  await page.getByRole("button", { name: "候補を保存" }).click();

  const list = page.getByRole("list", { name: "候補一覧" });
  await expect(list).toContainText("合成候補A");
  await page.getByRole("button", { name: "編集: 合成候補A" }).click();
  await page.getByLabel("候補名").fill("破棄する候補名");
  await page.getByRole("button", { name: "候補編集をキャンセル" }).click();
  await expect(list).not.toContainText("破棄する候補名");

  await page.getByRole("button", { name: "編集: 合成候補A" }).click();
  await page.getByLabel("候補名").fill("合成候補B");
  await page.getByRole("button", { name: "候補の変更を保存: 合成候補A" }).click();
  await expect(list).toContainText("合成候補B");

  await page.getByRole("button", { name: "候補を追加" }).click();
  await fillContainer(page, "合成候補C");
  await page.getByRole("button", { name: "候補を保存" }).click();
  await page.getByRole("button", { name: "編集: 合成候補B" }).click();
  await page.getByLabel("候補名").fill("未保存の候補B");
  await page.getByRole("button", { name: "編集: 合成候補C" }).click();
  await page.getByRole("button", { name: "削除: 合成候補C" }).click();
  await page.getByRole("button", { name: "削除を確定: 合成候補C" }).click();
  await expect(page.getByText("未保存の候補入力があります。破棄して切り替えますか。")).toHaveCount(0);
  await expect(page.getByLabel("候補名")).toHaveValue("未保存の候補B");
  await page.getByRole("button", { name: "候補編集をキャンセル" }).click();
  await page.getByRole("button", { name: "削除: 合成候補B" }).click();
  await page.getByRole("button", { name: "削除をやめる: 合成候補B" }).click();
  await expect(list).toContainText("合成候補B");
  await page.getByRole("button", { name: "削除: 合成候補B" }).click();
  await page.getByRole("button", { name: "削除を確定: 合成候補B" }).click();
  await expect(page.getByRole("button", { name: "候補を追加" })).toBeFocused();
  await expect(page.getByText("候補を削除しました。")).toBeVisible();
  await expect(list).not.toContainText("合成候補B");
});

test("keeps input available without WebGL and shows permanent safety notices", async ({ page }) => {
  await page.goto("/?forceWebgl2=unsupported");
  await expect(page.getByRole("status")).toHaveAttribute("data-capability-state", "unsupported");
  await expect(page.getByRole("heading", { name: "案件入力" })).toBeVisible();
  await expect(page.getByLabel("入力データの注意")).toContainText("実在する顧客名");
  await expect(page.getByLabel("現在の制限")).toContainText("入力が有効でも積載可能・安全とは限りません");

  await page.getByRole("button", { name: "積荷を追加" }).click();
  await fillCargo(page, "非対応時の合成積荷");
  await page.getByRole("button", { name: "積荷を保存" }).click();
  await expect(page.getByRole("list", { name: "積荷一覧" })).toContainText("非対応時の合成積荷");
});

test("supports keyboard operation and focuses an invalid orientation group", async ({ page }) => {
  await page.goto("/?forceWebgl2=unsupported");
  const addButton = page.getByRole("button", { name: "積荷を追加" });
  await addButton.focus();
  await page.keyboard.press("Enter");
  await expect(page.getByLabel("積荷名")).toBeFocused();

  await fillCargo(page, "キーボード合成積荷");
  const lwh = page.getByLabel("LWH — X=長さ・Y=幅・Z=高さ（既定）");
  const wlh = page.getByLabel("WLH — X=幅・Y=長さ・Z=高さ（既定）");
  await lwh.focus();
  await page.keyboard.press("Space");
  await wlh.focus();
  await page.keyboard.press("Space");
  await page.getByRole("button", { name: "積荷を保存" }).focus();
  await page.keyboard.press("Enter");

  const invalidGroup = page.locator("[aria-invalid='true'][aria-describedby='orientation-error']");
  await expect(invalidGroup).toBeFocused();
  await expect(page.locator("#orientation-error")).toBeVisible();
  await lwh.focus();
  await page.keyboard.press("Space");
  await page.getByRole("button", { name: "積荷を保存" }).focus();
  await page.keyboard.press("Enter");
  await expect(page.getByRole("list", { name: "積荷一覧" })).toContainText(
    "キーボード合成積荷",
  );
});

test("has no horizontal page overflow at narrow widths", async ({ page }) => {
  await page.setViewportSize({ width: 305, height: 900 });
  await page.goto("/?forceWebgl2=unsupported");
  await expectNoHorizontalOverflow(page);

  await page.setViewportSize({ width: 320, height: 900 });
  await page.getByRole("button", { name: "候補を追加" }).click();
  await expect(page.getByRole("heading", { name: "案件入力" })).toBeVisible();
  await expectNoHorizontalOverflow(page);
});

test("wraps maximum-length names and confirmations at 305, 320, and 375px", async ({ page }) => {
  const projectName = "P".repeat(120);
  const cargoName = "C".repeat(120);
  const containerName = "V".repeat(120);
  await page.setViewportSize({ width: 305, height: 900 });
  await page.goto("/?forceWebgl2=unsupported");
  await page.getByLabel("案件名").fill(projectName);
  await page.getByRole("button", { name: "案件を保存" }).click();
  await page.getByRole("button", { name: "積荷を追加" }).click();
  await fillCargo(page, cargoName);
  await page.getByRole("button", { name: "積荷を保存" }).click();
  await page.getByRole("button", { name: "候補を追加" }).click();
  await fillContainer(page, containerName);
  await page.getByRole("button", { name: "候補を保存" }).click();
  await page.getByRole("button", { name: `編集: ${cargoName}` }).click();
  await page.getByRole("button", { name: `削除: ${cargoName}` }).click();
  await page.getByRole("button", { name: `削除: ${containerName}` }).click();
  await expectNoHorizontalOverflow(page);

  await page.setViewportSize({ width: 320, height: 900 });
  await expectNoHorizontalOverflow(page);
  await page.setViewportSize({ width: 375, height: 900 });
  await expectNoHorizontalOverflow(page);
});
