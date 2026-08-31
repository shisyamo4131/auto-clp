import { describe, expect, it } from "vitest";

import { PROJECT_SCHEMA_VERSION, type Project } from "../domain/model";
import type {
  InvalidPhysicalReasonCode,
  PhysicalValidationReason,
  PlacementSetUnavailableReason,
  PlacementSetValidationResult,
  UnverifiedPhysicalReasonCode,
} from "../domain/validation";
import { PHYSICAL_VALIDATION_REASON_PAGE_SIZE } from "../workers/physical-validation-worker-protocol";
import {
  createPhysicalValidationLabelMaps,
  physicalValidationReasonKey,
  toPhysicalValidationReasonViews,
  toPhysicalValidationSummaryView,
  toPhysicalValidationView,
} from "./physical-validation-view";

function projectFixture(placements: Project["placements"] = []): Project {
  return {
    schemaVersion: PROJECT_SCHEMA_VERSION,
    projectId: "project-view-test",
    name: "匿名表示試験",
    clearancesMm: { xMm: 0, yMm: 0, zMm: 0 },
    cargoes: [
      {
        id: "cargo-known",
        name: "既知積荷",
        dimensionsMm: { lengthMm: 100, widthMm: 80, heightMm: 60 },
        massGrams: 1_000,
        canSupportCargo: false,
        allowedOrientations: ["LWH"],
      },
      {
        id: "cargo-related-a",
        name: "関連積荷A",
        dimensionsMm: { lengthMm: 100, widthMm: 80, heightMm: 60 },
        massGrams: 1_000,
        canSupportCargo: false,
        allowedOrientations: ["LWH"],
      },
      {
        id: "cargo-related-b",
        name: "関連積荷B",
        dimensionsMm: { lengthMm: 100, widthMm: 80, heightMm: 60 },
        massGrams: 1_000,
        canSupportCargo: false,
        allowedOrientations: ["LWH"],
      },
    ],
    containers: [
      {
        id: "container-known",
        name: "既知候補",
        internalDimensionsMm: { lengthMm: 1_000, widthMm: 500, heightMm: 500 },
        openingMm: { widthMm: 400, heightMm: 400 },
        payloadCapacityGrams: 10_000,
      },
    ],
    placements,
  };
}

function evaluated(
  status: "valid" | "invalid" | "unverified",
  reasons: readonly PhysicalValidationReason[] = [],
): PlacementSetValidationResult {
  return {
    kind: "evaluated",
    containerId: "container-known",
    status,
    reasons,
  };
}

const invalidCopies = [
  [
    "floor-penetration",
    "積荷が床より下へ貫通しています。Z座標を0以上に修正してください。",
  ],
  [
    "outside-container",
    "積荷がコンテナの壁または天井の境界を越えています。座標を先に修正してください。",
  ],
  [
    "container-clearance-not-met",
    "積荷とコンテナ面の間に必要な軸別隙間がありません。座標を調整してください。",
  ],
  ["positive-volume-overlap", "積荷同士が立体的に重なっています。配置を離してください。"],
  ["axis-clearance-not-met", "積荷同士の軸別隙間が不足しています。配置を調整してください。"],
  [
    "opening-no-fitting-orientation",
    "許可されたどの向きでも矩形開口の幅と高さに収まりません。",
  ],
  [
    "support-contact-invalid",
    "床より上の積荷が、支持可能な上面と同じ高さで正面積接触していません。Z座標と支持可否を確認してください。",
  ],
  [
    "payload-capacity-exceeded",
    "配置した積荷の合計重量がコンテナの耐荷重を超えています。",
  ],
] as const satisfies readonly (readonly [InvalidPhysicalReasonCode, string])[];

const unverifiedCopies = [
  [
    "support-conditions-unverified",
    "複数支持、支持台間の隙間、張り出し、または支持不可面との混在を含みます。構造剛性、支持位置、重心、許容支持間隔を確認してください。",
  ],
] as const satisfies readonly (readonly [UnverifiedPhysicalReasonCode, string])[];

describe("toPhysicalValidationView", () => {
  it.each(invalidCopies)("maps invalid code %s to its exact copy", (code, message) => {
    const reason: PhysicalValidationReason = {
      status: "invalid",
      code,
      target: { kind: "cargo", id: "cargo-known" },
      relatedCargoIds: [],
    };

    expect(toPhysicalValidationView(projectFixture(), evaluated("invalid", [reason])))
      .toMatchObject({
        status: "invalid",
        invalidReasons: [{ statusLabel: "不適合", message }],
        unverifiedReasons: [],
      });
  });

  it("keeps floor penetration copy actionable without reflecting names, ids, or coordinates", () => {
    const reason: PhysicalValidationReason = {
      status: "invalid",
      code: "floor-penetration",
      target: { kind: "cargo", id: "cargo-known" },
      relatedCargoIds: [],
    };

    const message = toPhysicalValidationView(
      projectFixture(),
      evaluated("invalid", [reason]),
    ).invalidReasons[0]?.message;

    expect(message).toBe(
      "積荷が床より下へ貫通しています。Z座標を0以上に修正してください。",
    );
    expect(message).not.toContain("既知積荷");
    expect(message).not.toContain("cargo-known");
    expect(message).not.toContain("-1");
  });

  it.each(unverifiedCopies)("maps unverified code %s to its exact copy", (code, message) => {
    const reason: PhysicalValidationReason = {
      status: "unverified",
      code,
      target: { kind: "cargo", id: "cargo-known" },
      relatedCargoIds: [],
    };

    expect(toPhysicalValidationView(projectFixture(), evaluated("unverified", [reason])))
      .toMatchObject({
        status: "unverified",
        invalidReasons: [],
        unverifiedReasons: [{ statusLabel: "未確認", message }],
      });
  });

  it.each([
    [
      { code: "physical.semantic-input-invalid", issues: [{ code: "sample", path: "/" }] },
      "判定不能：CLPデータの参照または意味整合性に問題があるため、物理判定を実行できません。",
      undefined,
    ],
    [
      {
        code: "physical.container-not-found",
        target: { kind: "container", id: "container-known" },
      },
      "判定不能：選択した候補がCLP内に見つからないため、物理判定を実行できません。",
      "既知候補（ID: container-known）",
    ],
    [
      {
        code: "physical.payload-calculation-unavailable",
        target: { kind: "container", id: "container-known" },
      },
      "判定不能：重量または耐荷重を安全に計算できないため、物理判定を実行できません。",
      "既知候補（ID: container-known）",
    ],
    [
      {
        code: "physical.geometry-calculation-unavailable",
        target: { kind: "container", id: "container-known" },
      },
      "判定不能：寸法・座標・隙間を安全に計算できないため、物理判定を実行できません。",
      "既知候補（ID: container-known）",
    ],
  ] satisfies readonly (readonly [PlacementSetUnavailableReason, string, string | undefined])[])(
    "maps unavailable code $0.code to its exact copy",
    (reason, summary, unavailableTargetLabel) => {
      expect(
        toPhysicalValidationView(projectFixture(), {
          kind: "unavailable",
          containerId: "container-known",
          reason,
        }),
      ).toEqual({
        status: "unavailable",
        statusLabel: "判定不能",
        summary,
        unavailableTargetLabel,
        invalidReasons: [],
        unverifiedReasons: [],
      });
    },
  );

  it("provides all five status summaries and distinguishes empty from populated valid sets", () => {
    const placement: Project["placements"][number] = {
      cargoId: "cargo-known",
      containerId: "container-known",
      positionMm: { xMm: 0, yMm: 0, zMm: 0 },
      orientation: "LWH",
    };
    const invalidReason: PhysicalValidationReason = {
      status: "invalid",
      code: "outside-container",
      target: { kind: "cargo", id: "cargo-known" },
      relatedCargoIds: [],
    };
    const unverifiedReason: PhysicalValidationReason = {
      status: "unverified",
      code: "support-conditions-unverified",
      target: { kind: "cargo", id: "cargo-known" },
      relatedCargoIds: ["cargo-related-a"],
    };

    expect(toPhysicalValidationView(projectFixture())).toMatchObject({
      status: "none",
      statusLabel: "判定対象なし",
      summary: "判定対象なし：候補コンテナを追加してください。",
    });
    expect(toPhysicalValidationView(projectFixture(), evaluated("valid"))).toMatchObject({
      status: "valid",
      statusLabel: "問題なし",
      summary: "実装済み確認項目内で問題なし：この候補には配置済みの積荷がありません。",
    });
    expect(
      toPhysicalValidationView(projectFixture([placement]), evaluated("valid")),
    ).toMatchObject({
      status: "valid",
      summary: "実装済み確認項目内で問題なし：現在の保存済み配置に不適合・未確認はありません。",
    });
    expect(
      toPhysicalValidationView(
        projectFixture([placement]),
        evaluated("invalid", [invalidReason, unverifiedReason]),
      ),
    ).toMatchObject({
      status: "invalid",
      statusLabel: "不適合",
      summary: "不適合：修正が必要な理由が1件あります。未確認事項1件も保持して表示します。",
    });
    expect(
      toPhysicalValidationView(
        projectFixture([placement]),
        evaluated("unverified", [unverifiedReason]),
      ),
    ).toMatchObject({
      status: "unverified",
      statusLabel: "未確認",
      summary: "未確認：実装済み制約の不適合はありませんが、確認が必要な理由が1件あります。",
    });
  });

  it.each([
    [{ kind: "cargo", id: "cargo-known" }, "既知積荷（ID: cargo-known）"],
    [{ kind: "container", id: "container-known" }, "既知候補（ID: container-known）"],
    [{ kind: "cargo", id: "cargo-missing" }, "不明な積荷（ID: cargo-missing）"],
    [{ kind: "container", id: "container-missing" }, "不明な候補（ID: container-missing）"],
    [{ kind: "cargo", id: "" }, "不明な積荷（ID: （空文字））"],
    [{ kind: "container", id: "" }, "不明な候補（ID: （空文字））"],
  ] as const)("renders target $0.kind/$0.id without hiding its ID", (target, targetLabel) => {
    const reason: PhysicalValidationReason = {
      status: "invalid",
      code: "outside-container",
      target,
      relatedCargoIds: [],
    };

    expect(
      toPhysicalValidationView(projectFixture(), evaluated("invalid", [reason]))
        .invalidReasons[0]?.targetLabel,
    ).toBe(targetLabel);
  });

  it("preserves related cargo order and renders known, unknown, and empty IDs", () => {
    const reason: PhysicalValidationReason = {
      status: "invalid",
      code: "positive-volume-overlap",
      target: { kind: "cargo", id: "cargo-known" },
      relatedCargoIds: ["cargo-related-b", "cargo-missing", "", "cargo-related-a"],
    };

    expect(
      toPhysicalValidationView(projectFixture(), evaluated("invalid", [reason]))
        .invalidReasons[0]?.relatedCargoLabels,
    ).toEqual([
      "関連積荷B（ID: cargo-related-b）",
      "不明な積荷（ID: cargo-missing）",
      "不明な積荷（ID: （空文字））",
      "関連積荷A（ID: cargo-related-a）",
    ]);
  });

  it("keeps a maximum-length identifier visible without truncating it", () => {
    const maximumId = "x".repeat(64);
    const reason: PhysicalValidationReason = {
      status: "invalid",
      code: "outside-container",
      target: { kind: "cargo", id: maximumId },
      relatedCargoIds: [maximumId],
    };
    const reasonView = toPhysicalValidationView(
      projectFixture(),
      evaluated("invalid", [reason]),
    ).invalidReasons[0];

    expect(reasonView?.targetLabel).toBe(`不明な積荷（ID: ${maximumId}）`);
    expect(reasonView?.relatedCargoLabels).toEqual([`不明な積荷（ID: ${maximumId}）`]);
  });

  it("groups invalid reasons first while retaining both groups and their source order", () => {
    const reasons: readonly PhysicalValidationReason[] = [
      {
        status: "unverified",
        code: "support-conditions-unverified",
        target: { kind: "cargo", id: "cargo-known" },
        relatedCargoIds: ["cargo-related-a"],
      },
      {
        status: "invalid",
        code: "outside-container",
        target: { kind: "cargo", id: "cargo-related-a" },
        relatedCargoIds: [],
      },
      {
        status: "unverified",
        code: "support-conditions-unverified",
        target: { kind: "cargo", id: "cargo-related-b" },
        relatedCargoIds: ["cargo-related-a"],
      },
      {
        status: "invalid",
        code: "support-contact-invalid",
        target: { kind: "cargo", id: "cargo-related-b" },
        relatedCargoIds: [],
      },
    ];
    const view = toPhysicalValidationView(
      projectFixture(),
      evaluated("invalid", reasons),
    );

    expect(view.invalidReasons.map((reason) => reason.targetLabel)).toEqual([
      "関連積荷A（ID: cargo-related-a）",
      "関連積荷B（ID: cargo-related-b）",
    ]);
    expect(view.unverifiedReasons.map((reason) => reason.targetLabel)).toEqual([
      "既知積荷（ID: cargo-known）",
      "関連積荷B（ID: cargo-related-b）",
    ]);
  });

  it("builds stable distinct reason keys from all identity fields", () => {
    const reason: PhysicalValidationReason = {
      status: "invalid",
      code: "positive-volume-overlap",
      target: { kind: "cargo", id: "cargo-known" },
      relatedCargoIds: ["cargo-related-a", "cargo-related-b"],
    };

    expect(physicalValidationReasonKey(reason)).toBe(
      '["invalid","positive-volume-overlap","cargo","cargo-known",["cargo-related-a","cargo-related-b"]]',
    );
    expect(
      physicalValidationReasonKey({ ...reason, relatedCargoIds: [...reason.relatedCargoIds].reverse() }),
    ).not.toBe(physicalValidationReasonKey(reason));
  });

  it("does not mutate project or result inputs", () => {
    const project = projectFixture();
    const result = evaluated("invalid", [
      {
        status: "invalid",
        code: "positive-volume-overlap",
        target: { kind: "cargo", id: "cargo-known" },
        relatedCargoIds: ["cargo-related-b", "cargo-related-a"],
      },
    ]);
    const projectBefore = structuredClone(project);
    const resultBefore = structuredClone(result);

    toPhysicalValidationView(project, result);

    expect(project).toEqual(projectBefore);
    expect(result).toEqual(resultBefore);
  });
});

describe("worker physical validation view adapters", () => {
  it("creates detached cargo and container label Maps without mutating the project", () => {
    const project = projectFixture();
    const before = structuredClone(project);
    const labels = createPhysicalValidationLabelMaps(project);

    expect(labels.cargoNames).toBeInstanceOf(Map);
    expect(labels.containerNames).toBeInstanceOf(Map);
    expect([...labels.cargoNames]).toEqual([
      ["cargo-known", "既知積荷"],
      ["cargo-related-a", "関連積荷A"],
      ["cargo-related-b", "関連積荷B"],
    ]);
    expect([...labels.containerNames]).toEqual([
      ["container-known", "既知候補"],
    ]);
    expect(project).toEqual(before);
  });

  it("maps one maximum worker page in exact order with labels and no mutation", () => {
    const project = projectFixture();
    const labels = createPhysicalValidationLabelMaps(project);
    const reasons = Array.from(
      { length: PHYSICAL_VALIDATION_REASON_PAGE_SIZE },
      (_, index): PhysicalValidationReason => ({
        status: "invalid",
        code: index % 2 === 0 ? "outside-container" : "support-contact-invalid",
        target: {
          kind: "cargo",
          id: index === 0 ? "cargo-known" : `unknown-${index}`,
        },
        relatedCargoIds:
          index === PHYSICAL_VALIDATION_REASON_PAGE_SIZE - 1
            ? ["cargo-related-b", "cargo-related-a"]
            : [],
      }),
    );
    const before = structuredClone(reasons);

    const views = toPhysicalValidationReasonViews(labels, reasons);

    expect(views).toHaveLength(PHYSICAL_VALIDATION_REASON_PAGE_SIZE);
    expect(views[0]).toMatchObject({
      status: "invalid",
      targetLabel: "既知積荷（ID: cargo-known）",
    });
    expect(views.at(-1)?.targetLabel).toBe("不明な積荷（ID: unknown-24）");
    expect(views.at(-1)?.relatedCargoLabels).toEqual([
      "関連積荷B（ID: cargo-related-b）",
      "関連積荷A（ID: cargo-related-a）",
    ]);
    expect(reasons).toEqual(before);
  });

  it.each([
    [
      "physical.semantic-input-invalid",
      undefined,
      "判定不能：CLPデータの参照または意味整合性に問題があるため、物理判定を実行できません。",
      undefined,
    ],
    [
      "physical.container-not-found",
      { kind: "container", id: "container-known" },
      "判定不能：選択した候補がCLP内に見つからないため、物理判定を実行できません。",
      "既知候補（ID: container-known）",
    ],
    [
      "physical.payload-calculation-unavailable",
      { kind: "container", id: "container-missing" },
      "判定不能：重量または耐荷重を安全に計算できないため、物理判定を実行できません。",
      "不明な候補（ID: container-missing）",
    ],
    [
      "physical.geometry-calculation-unavailable",
      { kind: "container", id: "" },
      "判定不能：寸法・座標・隙間を安全に計算できないため、物理判定を実行できません。",
      "不明な候補（ID: （空文字））",
    ],
  ] as const)(
    "maps compact unavailable summary %s without domain details",
    (code, target, summary, unavailableTargetLabel) => {
      const input = {
        kind: "unavailable" as const,
        code,
        ...(target === undefined ? {} : { target }),
        issueCount: code === "physical.semantic-input-invalid" ? 2 : 0,
        placementCount: 0,
      };
      const before = structuredClone(input);

      expect(
        toPhysicalValidationSummaryView(
          createPhysicalValidationLabelMaps(projectFixture()),
          input,
        ),
      ).toEqual({
        status: "unavailable",
        statusLabel: "判定不能",
        summary,
        unavailableTargetLabel,
      });
      expect(input).toEqual(before);
    },
  );

  it.each([
    [
      { kind: "evaluated", status: "valid", invalidCount: 0, unverifiedCount: 0, placementCount: 0 },
      "実装済み確認項目内で問題なし：この候補には配置済みの積荷がありません。",
    ],
    [
      { kind: "evaluated", status: "valid", invalidCount: 0, unverifiedCount: 0, placementCount: 1 },
      "実装済み確認項目内で問題なし：現在の保存済み配置に不適合・未確認はありません。",
    ],
    [
      { kind: "evaluated", status: "invalid", invalidCount: 26, unverifiedCount: 2, placementCount: 4 },
      "不適合：修正が必要な理由が26件あります。未確認事項2件も保持して表示します。",
    ],
    [
      { kind: "evaluated", status: "unverified", invalidCount: 0, unverifiedCount: 3, placementCount: 3 },
      "未確認：実装済み制約の不適合はありませんが、確認が必要な理由が3件あります。",
    ],
  ] as const)("maps compact evaluated summary %#", (input, summary) => {
    expect(
      toPhysicalValidationSummaryView(
        createPhysicalValidationLabelMaps(projectFixture()),
        input,
      ),
    ).toMatchObject({ summary });
  });
});
