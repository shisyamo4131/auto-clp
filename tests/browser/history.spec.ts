import { expect, test, type Page } from "@playwright/test";

async function addCargo(page: Page, name: string) {
  await page.getByRole("button", { name: "積荷を追加" }).click();
  await page.getByLabel("積荷名").fill(name);
  await page.getByLabel("長さ", { exact: true }).fill("100");
  await page.getByLabel("幅", { exact: true }).fill("100");
  await page.getByLabel("高さ", { exact: true }).fill("100");
  await page.getByLabel("重量").fill("1");
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

async function addPlacement(page: Page, cargoName: string) {
  const panel = page.locator(".placement-panel");
  await panel.getByRole("button", { name: `配置を追加: ${cargoName}` }).click();
  await panel.getByRole("button", { name: "配置を保存" }).click();
}

async function expectNoHorizontalOverflow(page: Page) {
  expect(
    await page.evaluate(() => {
      const browserGlobal = globalThis as unknown as {
        readonly document: {
          readonly documentElement: {
            readonly clientWidth: number;
            readonly scrollWidth: number;
          };
        };
      };
      const root = browserGlobal.document.documentElement;
      return root.scrollWidth > root.clientWidth;
    }),
  ).toBe(false);
}

async function installHistoryWorker(page: Page) {
  await page.addInitScript(() => {
    type Request = {
      readonly type: "evaluate" | "reason-page";
      readonly generation: number;
      readonly requestId?: number;
      readonly status?: "invalid" | "unverified";
      readonly offset?: number;
      readonly project?: {
        readonly placements?: readonly {
          readonly cargoId: string;
          readonly positionMm: { readonly xMm: number };
        }[];
      };
    };
    const browserGlobal = globalThis as unknown as { Worker: unknown };

    class HistoryWorker {
      onmessage: ((event: { readonly data: unknown }) => void) | null = null;
      onerror: (() => void) | null = null;
      onmessageerror: (() => void) | null = null;

      postMessage(request: Request) {
        if (request.type === "evaluate") {
          const placements = request.project?.placements ?? [];
          const invalid = placements[0]?.positionMm.xMm === -1;
          const summary = {
            kind: "evaluated",
            status: invalid ? "invalid" : "valid",
            invalidCount: invalid ? 1 : 0,
            unverifiedCount: 0,
            placementCount: placements.length,
          };
          setTimeout(
            () =>
              this.onmessage?.({
                data: {
                  type: "evaluation-ready",
                  generation: request.generation,
                  summary,
                },
              }),
            invalid ? 220 : 15,
          );
          return;
        }

        const response = {
          type: "reason-page-ready",
          generation: request.generation,
          requestId: request.requestId,
          status: request.status,
          offset: request.offset,
          total: 1,
          reasons: [
            {
              status: "invalid",
              code: "outside-container",
              target: { kind: "cargo", id: "cargo-1" },
              relatedCargoIds: [],
            },
          ],
        };
        setTimeout(() => this.onmessage?.({ data: response }), 5);
      }

      terminate() {}
    }

    browserGlobal.Worker = HistoryWorker;
  });
}

test("undoes and redoes settings, cargo, container, and placement CRUD without WebGL", async ({
  page,
}) => {
  await page.goto("/?forceWebgl2=unsupported");
  const undo = page.getByRole("button", { name: "元に戻す" });
  const redo = page.getByRole("button", { name: "やり直す" });
  const summary = page.locator(".project-history__summary");
  const canonical = page.getByTestId("canonical-project-settings");

  await expect(undo).toBeDisabled();
  await expect(redo).toBeDisabled();
  await expect(undo).toHaveAttribute("aria-keyshortcuts", "Control+Z Meta+Z");
  await expect(redo).toHaveAttribute(
    "aria-keyshortcuts",
    "Control+Shift+Z Meta+Shift+Z Control+Y",
  );
  await expect(summary).toHaveAttribute("aria-live", "polite");
  await expect(summary).toHaveAttribute("aria-atomic", "true");

  await page.getByLabel("案件名").fill("履歴案件");
  await page.getByRole("button", { name: "案件を保存" }).click();
  await expect(canonical).toContainText("履歴案件");
  await undo.click();
  await expect(canonical).toContainText("新規案件");
  await redo.click();
  await expect(canonical).toContainText("履歴案件");

  await addCargo(page, "履歴積荷");
  const cargoList = page.getByRole("list", { name: "積荷一覧", exact: true });
  await expect(cargoList).toContainText("履歴積荷");
  await undo.click();
  await expect(cargoList).not.toContainText("履歴積荷");
  await redo.click();
  await expect(cargoList).toContainText("履歴積荷");

  await page.getByRole("button", { name: "編集: 履歴積荷" }).click();
  await page.getByLabel("積荷名").fill("履歴積荷更新");
  await page.getByRole("button", { name: "積荷の変更を保存: 履歴積荷" }).click();
  await expect(cargoList).toContainText("履歴積荷更新");
  await undo.click();
  await expect(cargoList).toContainText("履歴積荷");
  await redo.click();
  await expect(cargoList).toContainText("履歴積荷更新");

  await addContainer(page, "履歴候補");
  const containerList = page.getByRole("list", { name: "候補一覧" });
  await expect(containerList).toContainText("履歴候補");
  await undo.click();
  await expect(containerList).not.toContainText("履歴候補");
  await redo.click();
  await expect(containerList).toContainText("履歴候補");

  await page.getByRole("button", { name: "編集: 履歴候補" }).click();
  await page.getByLabel("候補名").fill("履歴候補更新");
  await page.getByRole("button", { name: "候補の変更を保存: 履歴候補" }).click();
  await expect(containerList).toContainText("履歴候補更新");
  await undo.click();
  await expect(containerList).toContainText("履歴候補");
  await redo.click();
  await expect(containerList).toContainText("履歴候補更新");

  await addPlacement(page, "履歴積荷更新");
  const placementPanel = page.locator(".placement-panel");
  await expect(placementPanel).toContainText("最小角 X 0・Y 0・Z 0 mm / LWH");
  await undo.click();
  await expect(placementPanel).toContainText("この候補に配置された積荷はありません。");
  await redo.click();
  await expect(placementPanel).toContainText("最小角 X 0・Y 0・Z 0 mm / LWH");

  await placementPanel.getByRole("button", { name: "編集: 履歴積荷更新" }).click();
  await expect(undo).toBeDisabled();
  await expect(redo).toBeDisabled();
  await page.getByLabel("X最小角").fill("25");
  await placementPanel.getByRole("button", { name: "配置を保存" }).click();
  await expect(placementPanel).toContainText("最小角 X 25・Y 0・Z 0 mm / LWH");
  await undo.click();
  await expect(placementPanel).toContainText("最小角 X 0・Y 0・Z 0 mm / LWH");
  await redo.click();
  await expect(placementPanel).toContainText("最小角 X 25・Y 0・Z 0 mm / LWH");

  await placementPanel
    .getByRole("button", { name: "配置を削除: 履歴積荷更新" })
    .click();
  await expect(undo).toBeDisabled();
  await expect(redo).toBeDisabled();
  await placementPanel.getByRole("button", { name: "配置の削除を確定" }).click();
  await expect(placementPanel).toContainText("この候補に配置された積荷はありません。");
  await undo.click();
  await expect(placementPanel).toContainText("最小角 X 25・Y 0・Z 0 mm / LWH");
  await redo.click();
  await expect(placementPanel).toContainText("この候補に配置された積荷はありません。");

  await page.getByRole("button", { name: "削除: 履歴積荷更新" }).click();
  await page.getByRole("button", { name: "削除を確定: 履歴積荷更新" }).click();
  await expect(cargoList).not.toContainText("履歴積荷更新");
  await undo.click();
  await expect(cargoList).toContainText("履歴積荷更新");
  await redo.click();
  await expect(cargoList).not.toContainText("履歴積荷更新");

  await page.getByRole("button", { name: "削除: 履歴候補更新" }).click();
  await page.getByRole("button", { name: "削除を確定: 履歴候補更新" }).click();
  await expect(containerList).not.toContainText("履歴候補更新");
  await undo.click();
  await expect(containerList).toContainText("履歴候補更新");
  await redo.click();
  await expect(containerList).not.toContainText("履歴候補更新");
  await expect(summary).toContainText("次に元に戻せる操作: 候補の削除。");
});

test("preserves native editing shortcuts, blocks history while busy, and discards redo on a branch", async ({
  page,
}) => {
  await page.goto("/?forceWebgl2=unsupported");
  await addCargo(page, "ショートカット積荷A");
  await addCargo(page, "ショートカット積荷B");
  const undo = page.getByRole("button", { name: "元に戻す" });
  const redo = page.getByRole("button", { name: "やり直す" });
  const cargoList = page.getByRole("list", { name: "積荷一覧", exact: true });

  const secondEdit = page.getByRole("button", { name: "編集: ショートカット積荷B" });
  await expect(undo).toBeEnabled();
  await secondEdit.focus();
  await page.keyboard.press("Control+KeyZ");
  await expect(cargoList).not.toContainText("ショートカット積荷B");
  await expect(undo).toBeFocused();
  await expect(page.locator(".project-history__summary")).toContainText(
    "直前の操作を取り消しました。",
  );
  await page.keyboard.press("Control+Shift+KeyZ");
  await expect(cargoList).toContainText("ショートカット積荷B");
  await expect(page.locator(".project-history__summary")).toContainText(
    "取り消した操作をやり直しました。",
  );
  await expect(page.getByLabel("積荷名")).toHaveCount(0);

  const projectName = page.getByLabel("案件名");
  await projectName.fill("未保存の案件名");
  await expect(undo).toBeDisabled();
  await expect(redo).toBeDisabled();
  await expect(page.locator(".project-history__summary")).toContainText(
    "入力または3D操作を完了すると、履歴操作を利用できます。",
  );
  await page.keyboard.press("Control+z");
  await expect(cargoList).toContainText("ショートカット積荷B");
  await projectName.fill("新規案件");

  await page.evaluate(() => {
    const browserGlobal = globalThis as unknown as {
      readonly document: {
        readonly body: { append(...nodes: unknown[]): void };
        createElement(tag: string): { id: string; contentEditable: string };
      };
    };
    const textarea = browserGlobal.document.createElement("textarea");
    textarea.id = "history-native-textarea";
    const editable = browserGlobal.document.createElement("div");
    editable.id = "history-native-contenteditable";
    editable.contentEditable = "true";
    browserGlobal.document.body.append(textarea, editable);
  });
  await page.locator("#history-native-textarea").focus();
  await page.keyboard.press("Control+z");
  await page.locator("#history-native-contenteditable").focus();
  await page.keyboard.press("Control+z");
  await expect(cargoList).toContainText("ショートカット積荷B");

  await page.evaluate(() => {
    const browserGlobal = globalThis as unknown as {
      readonly KeyboardEvent: new (
        type: string,
        init: Record<string, unknown>,
      ) => { preventDefault(): void };
      readonly document: {
        readonly body: { dispatchEvent(event: unknown): boolean };
      };
    };
    const prevented = new browserGlobal.KeyboardEvent("keydown", {
      bubbles: true,
      cancelable: true,
      ctrlKey: true,
      key: "z",
    });
    prevented.preventDefault();
    browserGlobal.document.body.dispatchEvent(prevented);
    browserGlobal.document.body.dispatchEvent(
      new browserGlobal.KeyboardEvent("keydown", {
        bubbles: true,
        ctrlKey: true,
        key: "z",
        isComposing: true,
      }),
    );
  });
  await page.locator("body").click({ position: { x: 1, y: 1 } });
  await page.keyboard.press("Alt+Control+z");
  await page.keyboard.press("Control+Meta+KeyZ");
  await expect(cargoList).toContainText("ショートカット積荷B");

  await page.keyboard.press("Control+z");
  await expect(cargoList).not.toContainText("ショートカット積荷B");
  await expect(redo).toBeEnabled();
  const historySummary = page.locator(".project-history__summary");
  await expect(historySummary).toContainText("直前の操作を取り消しました。");

  await page.getByRole("button", { name: "案件を保存" }).click();
  await expect(historySummary).toContainText("直前の操作を取り消しました。");

  await page.getByLabel("X方向の隙間").fill("1.5");
  await page.getByRole("button", { name: "案件を保存" }).click();
  await expect(page.getByLabel("X方向の隙間")).toHaveValue("1.5");
  await expect(page.getByLabel("X方向の隙間")).toHaveAttribute("aria-invalid", "true");
  await expect(page.getByTestId("canonical-project-settings")).toContainText("隙間 X 0");
  await expect(historySummary).toContainText("直前の操作を取り消しました。");

  await page.getByLabel("X方向の隙間").fill("0");
  await page.getByLabel("案件名").fill("履歴分岐");
  await page.getByRole("button", { name: "案件を保存" }).click();
  await expect(redo).toBeDisabled();
  await expect(historySummary).not.toContainText("直前の操作を取り消しました。");
  await expect(historySummary).toContainText("次に元に戻せる操作: 案件設定の更新。");
  await page.keyboard.press("Control+y");
  await expect(cargoList).not.toContainText("ショートカット積荷B");

  await page.getByRole("button", { name: "編集: ショートカット積荷A" }).click();
  await expect(undo).toBeDisabled();
  await page.getByRole("button", { name: "積荷編集をキャンセル" }).click();
  await page.getByRole("button", { name: "削除: ショートカット積荷A" }).click();
  await expect(undo).toBeDisabled();
  await page.getByRole("button", { name: "削除をやめる: ショートカット積荷A" }).click();
});

test("keeps shadow-DOM and custom-widget undo local by using the composed event path", async ({
  page,
}) => {
  await page.goto("/?forceWebgl2=unsupported");
  await addCargo(page, "shadow積荷A");
  await addCargo(page, "shadow積荷B");
  const cargoList = page.getByRole("list", { name: "積荷一覧", exact: true });
  const historySummary = page.locator(".project-history__summary");
  await expect(historySummary).toContainText("次に元に戻せる操作: 積荷の追加。");
  const before = await historySummary.textContent();

  await page.evaluate(() => {
    interface SyntheticElement {
      contentEditable: string;
      id: string;
      tabIndex: number;
      addEventListener(type: string, listener: (event: { preventDefault(): void }) => void): void;
      append(...nodes: unknown[]): void;
      attachShadow(options: { mode: "open" | "closed" }): {
        append(...nodes: unknown[]): void;
      };
      focus(): void;
      setAttribute(name: string, value: string): void;
    }
    const browserGlobal = globalThis as unknown as {
      __closedHistoryInput: SyntheticElement;
      readonly document: {
        readonly body: { append(...nodes: unknown[]): void };
        createElement(tag: string): SyntheticElement;
      };
    };
    const openHost = browserGlobal.document.createElement("div");
    openHost.id = "history-open-shadow";
    const openRoot = openHost.attachShadow({ mode: "open" });
    const input = browserGlobal.document.createElement("input");
    input.id = "history-shadow-input";
    const textarea = browserGlobal.document.createElement("textarea");
    textarea.id = "history-shadow-textarea";
    const editable = browserGlobal.document.createElement("div");
    editable.id = "history-shadow-contenteditable";
    editable.contentEditable = "true";
    openRoot.append(input, textarea, editable);

    const closedHost = browserGlobal.document.createElement("div");
    closedHost.id = "history-closed-shadow";
    closedHost.setAttribute("data-project-history-shortcuts", "local");
    const closedInput = browserGlobal.document.createElement("input");
    closedHost.attachShadow({ mode: "closed" }).append(closedInput);
    browserGlobal.__closedHistoryInput = closedInput;

    const preventedWidget = browserGlobal.document.createElement("div");
    const preventedChild = browserGlobal.document.createElement("button");
    preventedChild.id = "history-prevented-child";
    preventedChild.addEventListener("keydown", (event) => event.preventDefault());
    preventedWidget.append(preventedChild);

    const customHost = browserGlobal.document.createElement("history-widget");
    customHost.id = "history-custom-widget";
    customHost.tabIndex = 0;
    browserGlobal.document.body.append(
      openHost,
      closedHost,
      preventedWidget,
      customHost,
    );
  });

  await page.locator("#history-shadow-input").focus();
  await page.keyboard.press("Control+KeyZ");
  await page.locator("#history-shadow-textarea").focus();
  await page.keyboard.press("Meta+KeyZ");
  await page.locator("#history-shadow-contenteditable").focus();
  await page.keyboard.press("Control+KeyZ");
  await page.evaluate(() => {
    (globalThis as unknown as { __closedHistoryInput: { focus(): void } })
      .__closedHistoryInput.focus();
  });
  await page.keyboard.press("Control+KeyZ");
  await page.locator("#history-prevented-child").focus();
  await page.keyboard.press("Control+KeyZ");
  await page.locator("#history-custom-widget").focus();
  await page.keyboard.press("Control+KeyZ");

  await expect(cargoList).toContainText("shadow積荷B");
  expect(await historySummary.textContent()).toBe(before);
});

test("falls back after a selected candidate disappears and does not auto-select it when restored", async ({
  page,
}) => {
  await page.goto("/?forceWebgl2=unsupported");
  await addContainer(page, "候補A");
  await addContainer(page, "候補B");
  const select = page.getByLabel("表示する候補");
  await select.selectOption({ label: "候補B" });
  await select.focus();
  await page.keyboard.press("Control+z");
  await expect(page.getByRole("list", { name: "候補一覧" })).toContainText("候補B");

  await page.getByRole("button", { name: "削除: 候補B" }).click();
  await page.getByRole("button", { name: "削除を確定: 候補B" }).click();
  await expect(select).toHaveValue("container-1");
  await expect(page.locator("#scene-workspace-status")).toContainText("候補A");

  await page.getByRole("button", { name: "元に戻す" }).click();
  await expect(page.getByRole("list", { name: "候補一覧" })).toContainText("候補B");
  await expect(select).toHaveValue("container-1");
  await expect(page.locator("#scene-workspace-status")).toContainText("候補A");
  await page.getByRole("button", { name: "やり直す" }).click();
  await expect(select).toHaveValue("container-1");
});

test("keeps history controls operable without horizontal overflow at narrow widths", async ({
  page,
}) => {
  await page.setViewportSize({ width: 305, height: 900 });
  await page.goto("/?forceWebgl2=unsupported");
  await addCargo(page, "H".repeat(120));
  await expectNoHorizontalOverflow(page);

  await page.setViewportSize({ width: 320, height: 900 });
  const undo = page.getByRole("button", { name: "元に戻す" });
  await undo.focus();
  await page.keyboard.press("Enter");
  await expect(page.getByRole("list", { name: "積荷一覧" })).not.toContainText("H".repeat(120));
  await expectNoHorizontalOverflow(page);

  await page.setViewportSize({ width: 375, height: 900 });
  await page.getByRole("button", { name: "やり直す" }).click();
  await expectNoHorizontalOverflow(page);
});

test("re-evaluates the restored Project and ignores a delayed pre-undo Worker response", async ({
  page,
}) => {
  await installHistoryWorker(page);
  await page.goto("/?forceWebgl2=unsupported");
  await addCargo(page, "Worker履歴積荷");
  await addContainer(page, "Worker履歴候補");
  await addPlacement(page, "Worker履歴積荷");
  const panel = page.locator(".physical-validation");
  const physicalSummary = panel.locator(".physical-validation__summary");
  await expect(physicalSummary).toHaveText(
    "適合：現在の保存済み配置は、実装済みの物理制約に適合しています。",
  );

  await page.evaluate(() => {
    const browserGlobal = globalThis as unknown as {
      __historySummaries: string[];
      readonly document: {
        querySelector(selector: string): { textContent: string | null } | null;
      };
      readonly MutationObserver: new (callback: () => void) => {
        observe(target: unknown, options: Record<string, boolean>): void;
      };
    };
    const summary = browserGlobal.document.querySelector(
      ".physical-validation__summary",
    );
    if (summary === null) {
      throw new Error("physical summary missing");
    }
    browserGlobal.__historySummaries = [];
    new browserGlobal.MutationObserver(() => {
      browserGlobal.__historySummaries.push(summary.textContent ?? "");
    }).observe(summary, { childList: true, characterData: true, subtree: true });
  });

  await page
    .locator(".placement-panel")
    .getByRole("button", { name: "編集: Worker履歴積荷" })
    .click();
  await page.getByLabel("X最小角").fill("-1");
  await page.getByRole("button", { name: "配置を保存" }).click();
  await expect(physicalSummary).toHaveText(
    "判定中：保存済み配置の物理判定を計算しています。",
  );
  await page.getByRole("button", { name: "元に戻す" }).click();
  await expect(physicalSummary).toHaveText(
    "適合：現在の保存済み配置は、実装済みの物理制約に適合しています。",
  );
  await page.waitForTimeout(260);
  await expect(physicalSummary).toHaveText(
    "適合：現在の保存済み配置は、実装済みの物理制約に適合しています。",
  );
  expect(
    await page.evaluate(() =>
      (globalThis as unknown as { __historySummaries: string[] }).__historySummaries.some(
        (copy) => copy.startsWith("不適合："),
      ),
    ),
  ).toBe(false);

  await page.getByRole("button", { name: "やり直す" }).click();
  await expect(physicalSummary).toHaveText(
    "不適合：修正が必要な理由が1件あります。未確認事項0件も保持して表示します。",
  );
  await expect(panel.getByText("積荷が床またはコンテナ内部の境界を越えています。")).toBeVisible();
  await page.getByRole("button", { name: "元に戻す" }).click();
  await expect(physicalSummary).toHaveText(
    "適合：現在の保存済み配置は、実装済みの物理制約に適合しています。",
  );
});
