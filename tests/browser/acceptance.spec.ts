import { expect, test, type Page } from "./fixtures";
import {
  addCargoFromDrawer,
  addContainerFromDrawer,
  openPhysicalValidation,
  openProjectSettings,
  type CargoInput,
  type ContainerInput,
} from "./ui-helpers";

interface AcceptanceCargoInput extends CargoInput {
  readonly onlyLwh?: boolean;
}

async function addCargo(page: Page, name: string, input: AcceptanceCargoInput = {}) {
  await addCargoFromDrawer(page, name, {
    ...input,
    uprightOnly: input.onlyLwh,
  });
}

async function addContainer(
  page: Page,
  name: string,
  input: ContainerInput = {},
) {
  await addContainerFromDrawer(page, name, input);
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
  const select = page.getByLabel("操作する積荷");
  const cargoId = await select.locator("option").filter({ hasText: cargoName }).getAttribute("value");
  await select.selectOption(cargoId!);
  await page.getByRole("button", { name: "座標を入力して配置" }).click();
  await page.getByLabel("X最小角").fill(position.xMm ?? "0");
  await page.getByLabel("Y最小角").fill(position.yMm ?? "0");
  await page.getByLabel("Z最小角").fill(position.zMm ?? "0");
  if (position.orientation !== undefined) {
    await page.getByLabel("向き").selectOption(position.orientation);
  }
  await page.getByRole("button", { name: "配置を保存" }).click();
}

async function setClearances(page: Page, valueMm: string) {
  await openProjectSettings(page);
  await page.getByLabel("X方向の隙間").fill(valueMm);
  await page.getByLabel("Y方向の隙間").fill(valueMm);
  await page.getByLabel("Z方向の隙間").fill(valueMm);
  await page.getByRole("button", { name: "CLPを保存" }).click();
}

test("executes the AC-01 form subset for orientation, removal, and undo", async ({
  page,
}) => {
  await page.goto("/");
  await expect(page.getByRole("status")).toHaveAttribute(
    "data-capability-state",
    "supported",
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

  const card = page.locator(".viewport-context-actions");
  await page.getByLabel("操作する積荷").selectOption("cargo-2");
  await card.getByRole("button", { name: "座標を微調整" }).click();
  await page.getByLabel("向き").selectOption("WLH");
  await page.getByRole("button", { name: "配置を保存" }).click();
  await expect(card).toContainText("X 1500 / Y 100 / Z 0 mm");
  await expect(page.locator("#physical-validation-lamp")).toHaveAttribute("data-status", "valid");

  await card.getByRole("button", { name: "荷室から外す" }).click();
  await page.getByRole("dialog", { name: "荷室から外す" }).getByRole("button", { name: "荷室から外す", exact: true }).click();
  await expect(card.getByRole("button", { name: "座標を入力して配置" })).toBeVisible();
  await page.getByRole("button", { name: "元に戻す" }).click();
  await expect(card).toContainText("X 1500 / Y 100 / Z 0 mm");
  await expect(page.getByRole("img", { name: "積荷を選択・床面移動できる3Dプレビュー" })).toBeVisible();
});

test("reports a 1 mm overhang as support-conditions-unverified and undo restores exact single support", async ({
  page,
}) => {
  await page.goto("/");
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

  const card = page.locator(".viewport-context-actions");
  const lamp = page.locator("#physical-validation-lamp");
  await expect(lamp).toHaveAttribute("data-status", "valid");

  await page.getByLabel("操作する積荷").selectOption("cargo-2");
  await card.getByRole("button", { name: "座標を微調整" }).click();
  await page.getByLabel("X最小角").fill("501");
  await page.getByRole("button", { name: "配置を保存" }).click();
  await expect(lamp).toHaveAttribute("data-status", "unverified");
  await openPhysicalValidation(page);
  const validation = page.locator(".physical-validation");
  await expect(validation).toContainText(
    "複数支持、支持台間の隙間、張り出し、または支持不可面との混在を含みます。",
  );
  await expect(validation.locator(".physical-validation__summary")).toContainText("未確認");
  await expect(card).toContainText("X 501 / Y 500 / Z 500 mm");

  await page.getByRole("button", { name: "物理判定を閉じる" }).click();
  await page.getByRole("button", { name: "元に戻す" }).click();
  await expect(card).toContainText("X 500 / Y 500 / Z 500 mm");
  await expect(lamp).toHaveAttribute("data-status", "valid");
});

test("orders floor penetration before independent opening and payload failures", async ({
  page,
}) => {
  await page.goto("/");
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

  await openPhysicalValidation(page);
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
  await page.goto("/");
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

  await openPhysicalValidation(page);
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
    validation.getByRole("heading", { name: "未確認理由", exact: false }),
  ).toHaveCount(0);
});
