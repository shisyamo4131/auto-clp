import { expect, test, type Page } from "@playwright/test";

interface CargoInput {
  readonly lengthMm?: string;
  readonly widthMm?: string;
  readonly heightMm?: string;
  readonly massKg?: string;
  readonly canSupportCargo?: boolean;
  readonly onlyLwh?: boolean;
}

interface ContainerInput {
  readonly lengthMm?: string;
  readonly widthMm?: string;
  readonly heightMm?: string;
  readonly openingWidthMm?: string;
  readonly openingHeightMm?: string;
  readonly payloadKg?: string;
}

async function addCargo(page: Page, name: string, input: CargoInput = {}) {
  await page.getByRole("button", { name: "積荷を追加" }).click();
  await page.getByLabel("積荷名").fill(name);
  await page.getByLabel("長さ", { exact: true }).fill(input.lengthMm ?? "100");
  await page.getByLabel("幅", { exact: true }).fill(input.widthMm ?? "100");
  await page.getByLabel("高さ", { exact: true }).fill(input.heightMm ?? "100");
  await page.getByLabel("重量").fill(input.massKg ?? "1");
  if (input.canSupportCargo === true) {
    await page
      .getByLabel("この積荷の上面で別の積荷を幾何学的に支持できる")
      .check();
  }
  if (input.onlyLwh === true) {
    await page
      .getByLabel("WLH — X=幅・Y=長さ・Z=高さ（既定）")
      .uncheck();
  }
  await page.getByRole("button", { name: "積荷を保存" }).click();
}

async function addContainer(
  page: Page,
  name: string,
  input: ContainerInput = {},
) {
  await page.getByRole("button", { name: "候補を追加" }).click();
  await page.getByLabel("候補名").fill(name);
  await page.getByLabel("内部長さ").fill(input.lengthMm ?? "500");
  await page.getByLabel("内部幅").fill(input.widthMm ?? "500");
  await page.getByLabel("内部高さ").fill(input.heightMm ?? "500");
  await page.getByLabel("開口幅").fill(input.openingWidthMm ?? "500");
  await page.getByLabel("開口高さ").fill(input.openingHeightMm ?? "500");
  await page.getByLabel("総耐荷重").fill(input.payloadKg ?? "100");
  await page.getByRole("button", { name: "候補を保存" }).click();
}

async function placeCargo(
  page: Page,
  cargoName: string,
  position: {
    readonly xMm?: string;
    readonly yMm?: string;
    readonly zMm?: string;
    readonly orientation?: "LWH" | "WLH";
  },
) {
  const panel = page.locator(".placement-panel");
  await panel.getByRole("button", { name: `配置を追加: ${cargoName}` }).click();
  await page.getByLabel("X最小角").fill(position.xMm ?? "0");
  await page.getByLabel("Y最小角").fill(position.yMm ?? "0");
  await page.getByLabel("Z最小角").fill(position.zMm ?? "0");
  if (position.orientation !== undefined) {
    await page.getByLabel("向き").selectOption(position.orientation);
  }
  await panel.getByRole("button", { name: "配置を保存" }).click();
}

async function setClearances(page: Page, valueMm: string) {
  await page.getByLabel("X方向の隙間").fill(valueMm);
  await page.getByLabel("Y方向の隙間").fill(valueMm);
  await page.getByLabel("Z方向の隙間").fill(valueMm);
  await page.getByRole("button", { name: "案件を保存" }).click();
}

test("executes the AC-01 form subset for orientation, removal, undo, and no-WebGL fallback", async ({
  page,
}) => {
  await page.goto("/?forceWebgl2=unsupported");
  await expect(page.getByRole("status")).toHaveAttribute(
    "data-capability-state",
    "unsupported",
  );
  await setClearances(page, "100");
  await addCargo(page, "合成積荷A", {
    lengthMm: "1200",
    widthMm: "800",
    heightMm: "600",
    massKg: "500",
    canSupportCargo: true,
  });
  await addCargo(page, "合成積荷B", {
    lengthMm: "800",
    widthMm: "600",
    heightMm: "500",
    massKg: "400",
  });
  await addContainer(page, "合成コンテナA", {
    lengthMm: "4000",
    widthMm: "2400",
    heightMm: "2400",
    openingWidthMm: "2200",
    openingHeightMm: "2200",
    payloadKg: "3000",
  });
  await placeCargo(page, "合成積荷A", { xMm: "100", yMm: "100", zMm: "0" });
  await placeCargo(page, "合成積荷B", { xMm: "1500", yMm: "100", zMm: "0" });

  const panel = page.locator(".placement-panel");
  const validation = page.locator(".physical-validation");
  await panel.getByRole("button", { name: "編集: 合成積荷B" }).click();
  await page.getByLabel("向き").selectOption("WLH");
  await panel.getByRole("button", { name: "配置を保存" }).click();
  await expect(panel).toContainText("最小角 X 1500・Y 100・Z 0 mm / WLH");
  await expect(validation.getByRole("heading", { name: "不適合理由", exact: false })).toHaveCount(0);
  await expect(validation.getByRole("heading", { name: "未確認理由（2件）" })).toBeVisible();

  await panel.getByRole("button", { name: "配置を削除: 合成積荷B" }).click();
  await panel.getByRole("button", { name: "配置の削除を確定" }).click();
  await expect(panel.getByRole("button", { name: "配置を追加: 合成積荷B" })).toBeVisible();
  await page.getByRole("button", { name: "元に戻す" }).click();
  await expect(panel).toContainText("最小角 X 1500・Y 100・Z 0 mm / WLH");
  await expect(page.getByRole("img", { name: "積荷を選択・床面移動できる3Dプレビュー" })).toHaveCount(0);
});

test("reports a 1 mm support strip loss and undo restores the exact stack", async ({
  page,
}) => {
  await page.goto("/?forceWebgl2=unsupported");
  await addCargo(page, "合成支持台", {
    lengthMm: "1000",
    widthMm: "800",
    heightMm: "500",
    massKg: "500",
    canSupportCargo: true,
    onlyLwh: true,
  });
  await addCargo(page, "合成上段荷", {
    lengthMm: "1000",
    widthMm: "800",
    heightMm: "400",
    massKg: "300",
    onlyLwh: true,
  });
  await addContainer(page, "合成コンテナB", {
    lengthMm: "3000",
    widthMm: "2000",
    heightMm: "2000",
    openingWidthMm: "2000",
    openingHeightMm: "2000",
    payloadKg: "2000",
  });
  await placeCargo(page, "合成支持台", { xMm: "500", yMm: "500", zMm: "0" });
  await placeCargo(page, "合成上段荷", { xMm: "500", yMm: "500", zMm: "500" });

  const validation = page.locator(".physical-validation");
  const placementPanel = page.locator(".placement-panel");
  await expect(validation).toContainText(
    "幾何学的な支持は成立していますが、構造強度と安定性は未確認です。",
  );
  await expect(validation).not.toContainText("100%覆われていません");

  await placementPanel.getByRole("button", { name: "編集: 合成上段荷" }).click();
  await page.getByLabel("X最小角").fill("501");
  await placementPanel.getByRole("button", { name: "配置を保存" }).click();
  await expect(validation).toContainText(
    "床にない積荷の底面が、段積み可能な支持面で100%覆われていません。",
  );
  await expect(placementPanel).toContainText("最小角 X 501・Y 500・Z 500 mm / LWH");

  await page.getByRole("button", { name: "元に戻す" }).click();
  await expect(placementPanel).toContainText("最小角 X 500・Y 500・Z 500 mm / LWH");
  await expect(validation).not.toContainText("100%覆われていません");
  await expect(validation).toContainText(
    "幾何学的な支持は成立していますが、構造強度と安定性は未確認です。",
  );
});

test("orders floor penetration before independent opening and payload failures", async ({
  page,
}) => {
  await page.goto("/?forceWebgl2=unsupported");
  await addCargo(page, "合成不適合荷", {
    lengthMm: "1000",
    widthMm: "1800",
    heightMm: "2300",
    massKg: "100.001",
    onlyLwh: true,
  });
  await addContainer(page, "合成コンテナC", {
    lengthMm: "3000",
    widthMm: "2400",
    heightMm: "2400",
    openingWidthMm: "1700",
    openingHeightMm: "2100",
    payloadKg: "100",
  });
  await placeCargo(page, "合成不適合荷", {
    xMm: "100",
    yMm: "100",
    zMm: "-1",
  });

  const validation = page.locator(".physical-validation");
  await expect(validation.getByRole("heading", { name: "不適合理由（3件）" })).toBeVisible();
  const invalidReasons = validation.locator(".physical-validation__reason--invalid");
  await expect(invalidReasons).toHaveCount(3);
  const copies = await invalidReasons.allTextContents();
  expect(copies[0]).toContain(
    "積荷が床より下へ貫通しています。Z座標を0以上に修正してください。",
  );
  expect(copies[1]).toContain(
    "許可されたどの向きでも矩形開口の幅と高さに収まりません。",
  );
  expect(copies[2]).toContain(
    "配置した積荷の合計重量がコンテナの耐荷重を超えています。",
  );
  await expect(validation).not.toContainText(
    "積荷がコンテナの壁または天井の境界を越えています。",
  );
  await expect(validation).not.toContainText("必要な軸別隙間がありません");
  await expect(validation).not.toContainText("100%覆われていません");
});

test("suppresses the human-trial floor-derived support message through the Worker", async ({
  page,
}) => {
  await page.goto("/?forceWebgl2=unsupported");
  await addCargo(page, "テスト積荷A", {
    lengthMm: "1000",
    widthMm: "800",
    heightMm: "600",
    massKg: "100",
    canSupportCargo: true,
  });
  await addCargo(page, "テスト積荷B", {
    lengthMm: "1000",
    widthMm: "800",
    heightMm: "600",
    massKg: "100",
  });
  await addContainer(page, "テスト荷室", {
    lengthMm: "4000",
    widthMm: "2400",
    heightMm: "2400",
    openingWidthMm: "2200",
    openingHeightMm: "2200",
    payloadKg: "1000",
  });
  await placeCargo(page, "テスト積荷A", {
    xMm: "200",
    yMm: "100",
    zMm: "-1",
    orientation: "WLH",
  });
  await placeCargo(page, "テスト積荷B", {
    xMm: "200",
    yMm: "100",
    zMm: "600",
    orientation: "WLH",
  });

  const validation = page.locator(".physical-validation");
  await expect(
    validation.getByRole("heading", { name: "不適合理由（1件）" }),
  ).toBeVisible();
  await expect(validation).toContainText(
    "積荷が床より下へ貫通しています。Z座標を0以上に修正してください。",
  );
  await expect(validation).not.toContainText("100%覆われていません");
  await expect(validation).not.toContainText(
    "幾何学的な支持は成立していますが、構造強度と安定性は未確認です。",
  );
  await expect(
    validation.getByRole("heading", { name: "未確認理由（2件）" }),
  ).toBeVisible();
});
