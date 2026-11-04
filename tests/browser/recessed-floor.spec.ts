import { fileURLToPath } from "node:url";
import type { Page, Locator } from "./fixtures";
import { expect, test } from "./fixtures";
import { addCargoFromDrawer, openContainerAddEditor, openPersistenceDrawer, openProjectSettings } from "./ui-helpers";

test("recessed floor input, tall cargo, atomic rejection, and device/JSON round trip", async ({ page }) => {
  await page.goto("/");
  await openProjectSettings(page);
  for (const axis of ["X", "Y", "Z"]) await page.getByLabel(`${axis}方向の隙間`).fill("0");
  await page.getByRole("button", { name: "CLPを保存" }).click();
  await openContainerAddEditor(page);
  for (const [label, value] of [["コンテナ名", "段落ち合成荷室"], ["内部長さ", "6000"], ["内部幅", "2400"], ["内部高さ", "2400"], ["開口幅", "2400"], ["開口高さ", "2400"], ["総耐荷重", "1000"]]) await page.getByLabel(label!, { exact: true }).fill(value!);
  await page.getByLabel("床の一部を低くする").check();
  for (const [label, value] of [["入口からの位置", "2000"], ["右壁からの位置", "400"], ["段落ちの長さ", "2000"], ["段落ちの幅", "1600"], ["段落ちの深さ", "300"]]) await page.getByLabel(label!, { exact: true }).fill(value!);
  await page.getByRole("button", { name: "コンテナを保存", exact: true }).click();
  await addCargoFromDrawer(page, "背高合成荷", { lengthMm: "1000", widthMm: "1000", heightMm: "2600", uprightOnly: true, canSupportCargo: false });
  await page.getByLabel("操作する積荷").selectOption("cargo-1");
  const actions = page.locator(".viewport-context-actions");
  await actions.getByRole("button", { name: "座標を入力して配置" }).click();
  await page.locator("#placement-xMm").fill("2500");
  await page.locator("#placement-yMm").fill("700");
  await page.locator("#placement-zMm").fill("-300");
  await page.getByRole("button", { name: "配置を保存", exact: true }).click();
  await expect(actions).toContainText("Z -300 mm");
  await expect(page.locator("#physical-validation-lamp")).toHaveAttribute("data-status", "valid");
  await actions.getByRole("button", { name: "座標を微調整" }).click();
  await page.locator("#placement-xMm").fill("1999");
  await page.getByRole("button", { name: "配置を保存", exact: true }).click();
  await expect(page.getByRole("dialog")).toContainText("段差をまたいでいます");
  await page.getByRole("button", { name: "キャンセル", exact: true }).click();
  const discard = page.getByRole("button", { name: "入力を破棄して閉じる" });
  if (await discard.isVisible()) await discard.click();
  await expect(actions).toContainText("X 2500 / Y 700 / Z -300 mm");
  await openPersistenceDrawer(page);
  await page.getByRole("button", { name: "端末へ保存", exact: true }).click();
  await expect(page.locator(".project-persistence__status")).toHaveText("現在のCLPをこの端末へ保存しました。");
  const downloadPromise = page.waitForEvent("download");
  await page.getByRole("button", { name: "JSONへ保存", exact: true }).click();
  const stream = await (await downloadPromise).createReadStream();
  const chunks: Buffer[] = [];
  for await (const chunk of stream) chunks.push(Buffer.from(chunk));
  const exported = JSON.parse(Buffer.concat(chunks).toString("utf8"));
  expect(exported.schemaVersion).toBe("0.2.0");
  expect(exported.containers[0].recessedFloorMm.depthMm).toBe(300);
  expect(exported.cargoes[0].cargoNo).toBe(1);
  await page.reload();
  await openPersistenceDrawer(page);
  await page.getByRole("button", { name: "端末から読込", exact: true }).click();
  await expect(page.getByLabel("操作する積荷")).toBeVisible();
  await page.keyboard.press("Escape");
  await page.getByLabel("操作する積荷").selectOption("cargo-1");
  await expect(actions).toContainText("X 2500 / Y 700 / Z -300 mm");
  await page.screenshot({ path: fileURLToPath(new URL("../../output/recessed-floor-g1.png", import.meta.url)), fullPage: true });
  const canvas = page.locator("canvas");
  const { point } = await locateStagedCargoOnCanvas(page, canvas);
  await page.mouse.move(point.x, point.y);
  await page.mouse.down();
  const status = page.locator("#scene-workspace-action-status");
  let crossed = false;
  for (let offset = 5; offset <= 200; offset += 5) {
    await page.mouse.move(point.x + offset, point.y, { steps: 2 });
    if ((await status.textContent())?.includes("段差をまたいでいます")) { crossed = true; break; }
  }
  expect(crossed).toBe(true);
  await page.mouse.up();
  await expect(actions).toContainText("X 2500 / Y 700 / Z -300 mm");

});

async function locateStagedCargoOnCanvas(page: Page, canvas: Locator) {
  await canvas.scrollIntoViewIfNeeded();
  const bounds = await canvas.boundingBox();
  if (bounds === null) throw new Error("3D canvas has no bounding box");
  const selector = page.getByLabel("操作する積荷");
  let expectedCargoId = await selector.inputValue();
  if (expectedCargoId === "") {
    const firstCargoId = await selector.locator("option").nth(1).getAttribute("value");
    if (firstCargoId === null) throw new Error("Staged cargo selector has no cargo option");
    expectedCargoId = firstCargoId;
  }
  await selector.selectOption(expectedCargoId);
  const witnesses = page.locator(".viewport__dimension-witness");
  await expect(witnesses).toHaveCount(6);
  const projectedCorners = await witnesses.evaluateAll((lines) => {
    const unique = new Map<string, readonly [number, number]>();
    for (const line of lines) {
      const x = Number(line.getAttribute("x1"));
      const y = Number(line.getAttribute("y1"));
      if (!Number.isFinite(x) || !Number.isFinite(y)) continue;
      unique.set(`${x}:${y}`, [x, y] as const);
    }
    return [...unique.values()];
  });
  expect(projectedCorners.length).toBeGreaterThanOrEqual(4);
  const pointSets = [
    projectedCorners,
    ...projectedCorners.slice(1).map((_, omittedIndex) =>
      projectedCorners.filter((__, index) => index !== omittedIndex + 1),
    ),
  ];
  const projectedCenter = projectedCorners.reduce(
    (total, [x, y]) => ({ x: total.x + x, y: total.y + y }),
    { x: 0, y: 0 },
  );
  projectedCenter.x /= projectedCorners.length;
  projectedCenter.y /= projectedCorners.length;
  const projectedCandidates = [
    ...pointSets.map((points) => {
      const sum = points.reduce(
        (total, [x, y]) => ({ x: total.x + x, y: total.y + y }),
        { x: 0, y: 0 },
      );
      return { x: sum.x / points.length, y: sum.y / points.length };
    }),
    ...projectedCorners.flatMap(([x, y]) => [0.25, 0.5, 0.75].map((ratio) => ({
      x: x + (projectedCenter.x - x) * ratio,
      y: y + (projectedCenter.y - y) * ratio,
    }))),
  ].map((point) => ({
    x: bounds.x + point.x,
    y: bounds.y + point.y,
  }));
  const diagnostics: string[] = [];
  for (const point of projectedCandidates) {
    const hitElement = await page.evaluate(({ x, y }) => {
      const browserGlobal = globalThis as unknown as {
        document: {
          elementFromPoint(clientX: number, clientY: number): {
            readonly className?: unknown;
            readonly tagName: string;
          } | null;
        };
      };
      const element = browserGlobal.document.elementFromPoint(x, y);
      return element === null
        ? "none"
        : `${element.tagName.toLowerCase()}.${typeof element.className === "string" ? element.className.trim().replaceAll(" ", ".") : ""}`;
    }, point);
    diagnostics.push(`${Math.round(point.x)},${Math.round(point.y)}=${hitElement}`);
    if (hitElement !== "canvas.") continue;
    await selector.selectOption("");
    await page.mouse.click(point.x, point.y);
    if ((await selector.inputValue()) === expectedCargoId) return { bounds, point };
  }
  throw new Error(
    `Selected cargo did not accept a pointer hit inside its projected annotation: ${diagnostics.join("; ")}`,
  );
}
