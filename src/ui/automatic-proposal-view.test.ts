import { describe, expect, it } from "vitest";

import {
  AUTOMATIC_PROPOSAL_ALGORITHM_VERSION,
  AUTOMATIC_PROPOSAL_CANDIDATE_ATTEMPT_LIMIT,
  AUTOMATIC_PROPOSAL_CANDIDATE_POINT_LIMIT,
  AUTOMATIC_PROPOSAL_REQUEST_ATTEMPT_LIMIT,
  type AutomaticProposalResult,
} from "../domain/automatic-proposal";
import { PROJECT_SCHEMA_VERSION, type Cargo, type Container, type Project } from "../domain/model";
import type { AutomaticProposalSessionSnapshot } from "./automatic-proposal-session";
import {
  AUTOMATIC_PROPOSAL_VIEW_PAGE_SIZE,
  automaticProposalView,
} from "./automatic-proposal-view";

const SAFETY_NOTICE =
  "提案は検討用です。完全な搬入経路、構造・安定性、実積載の安全性を保証しません。";

function cargo(id: string, name = `anonymous-${id}`): Cargo {
  return {
    id,
    name,
    dimensionsMm: { lengthMm: 10, widthMm: 10, heightMm: 10 },
    massGrams: 1_000,
    canSupportCargo: true,
    allowedOrientations: ["LWH"],
  };
}

function container(id: string, name = `anonymous-${id}`): Container {
  return {
    id,
    name,
    internalDimensionsMm: { lengthMm: 100, widthMm: 100, heightMm: 100 },
    openingMm: { widthMm: 100, heightMm: 100 },
    payloadCapacityGrams: 100_000,
  };
}

function projectFixture(overrides: Partial<Project> = {}): Project {
  return {
    schemaVersion: PROJECT_SCHEMA_VERSION,
    projectId: "view-project",
    name: "anonymous-view-project",
    clearancesMm: { xMm: 0, yMm: 0, zMm: 0 },
    cargoes: [cargo("cargo-a"), cargo("cargo-b")],
    containers: [container("container-a"), container("container-b")],
    placements: [
      {
        cargoId: "cargo-a",
        containerId: "container-a",
        orientation: "LWH",
        positionMm: { xMm: 5, yMm: 0, zMm: 0 },
      },
    ],
    ...overrides,
  };
}

function resultBase() {
  return {
    algorithmVersion: AUTOMATIC_PROPOSAL_ALGORITHM_VERSION,
    effectiveLimits: {
      candidateAttemptLimit: AUTOMATIC_PROPOSAL_CANDIDATE_ATTEMPT_LIMIT,
      requestAttemptLimit: AUTOMATIC_PROPOSAL_REQUEST_ATTEMPT_LIMIT,
      candidatePointLimit: AUTOMATIC_PROPOSAL_CANDIDATE_POINT_LIMIT,
    },
  } as const;
}

function completeResult(
  status: "complete" | "complete-with-cutoff" = "complete",
): AutomaticProposalResult {
  const complete = {
    ...resultBase(),
    attempts: {
      requestAttemptCount: status === "complete" ? 2 : 10_002,
      candidates:
        status === "complete"
          ? [
              {
                containerId: "container-b",
                attemptCount: 2,
                outcome: "complete" as const,
              },
            ]
          : [
              {
                containerId: "container-a",
                attemptCount: 10_000,
                outcome: "cutoff" as const,
                cutoffSource: "candidate" as const,
              },
              {
                containerId: "container-b",
                attemptCount: 2,
                outcome: "complete" as const,
              },
            ],
    },
    plan: {
      containerId: "container-b",
      placements: [
        {
          cargoId: "cargo-a",
          containerId: "container-b",
          orientation: "LWH" as const,
          positionMm: { xMm: 0, yMm: 0, zMm: 0 },
        },
        {
          cargoId: "cargo-b",
          containerId: "container-b",
          orientation: "LWH" as const,
          positionMm: { xMm: 10, yMm: 0, zMm: 0 },
        },
      ],
      invalidReasonCount: 0 as const,
      unverifiedReasons: [
        {
          status: "unverified" as const,
          code: "structure-stability-unverified" as const,
          target: { kind: "cargo" as const, id: "cargo-b" },
          relatedCargoIds: ["cargo-a"],
        },
      ],
    },
  };
  return status === "complete"
    ? { ...complete, status }
    : { ...complete, status, cutoffSource: "candidate" };
}

function readySnapshot(
  project: Project,
  result: AutomaticProposalResult,
): AutomaticProposalSessionSnapshot {
  return {
    phase: "ready",
    sourceProject: project,
    interactionGeneration: 1,
    identity: 1,
    result,
  };
}

function deepFreeze<T>(value: T): T {
  if (value !== null && typeof value === "object") {
    Object.freeze(value);
    for (const child of Object.values(value)) {
      deepFreeze(child);
    }
  }
  return value;
}

describe("automaticProposalView phases", () => {
  it.each([
    [
      "idle",
      { phase: "idle" },
      ["未実行", "自動提案はまだ実行していません。", "neutral", true, false, false],
    ],
    [
      "running",
      {
        phase: "running",
        interactionGeneration: 1,
        identity: 1,
      },
      ["探索中", "現在の案件から完全案を探索しています。案件は変更していません。", "progress", false, true, false],
    ],
    [
      "failed",
      { phase: "failed", code: "automatic-proposal.engine-failure" },
      ["計算不能", "自動提案を計算できませんでした。案件は変更していません。", "error", false, false, true],
    ],
    [
      "cancelled",
      { phase: "cancelled" },
      ["取消済み", "探索を中止しました。案件は変更していません。", "neutral", true, false, true],
    ],
    [
      "stale",
      { phase: "stale" },
      ["結果破棄", "案件または入力状態が変わったため、探索結果を破棄しました。", "warning", true, false, true],
    ],
  ] as const)("maps %s to fixed copy and controls", (_label, partial, expected) => {
    const project = projectFixture();
    const snapshot =
      partial.phase === "running"
        ? { ...partial, sourceProject: project }
        : partial;

    const view = automaticProposalView(
      snapshot as AutomaticProposalSessionSnapshot,
      project,
    );

    expect([
      view.badge,
      view.summary,
      view.tone,
      view.canStart,
      view.canCancel,
      view.canRetry,
    ]).toEqual(expected);
    expect(view.heading).toBe("自動配置提案");
    expect(view.safetyNotice).toBe(SAFETY_NOTICE);
    expect(view.isApplicablePreview).toBe(false);
  });

  it("masks a running result immediately when the Project reference changes", () => {
    const source = projectFixture();
    const current = { ...source };
    const view = automaticProposalView(
      {
        phase: "running",
        sourceProject: source,
        interactionGeneration: 1,
        identity: 1,
      },
      current,
    );

    expect(view).toMatchObject({
      phase: "stale",
      badge: "結果破棄",
      summary: "案件が変わったため探索結果を使用しません。",
      canStart: true,
      canCancel: false,
      canRetry: true,
    });
  });
});

describe("automaticProposalView ready statuses", () => {
  it.each([
    [
      "no-cargo",
      "対象なし",
      "提案する積荷がありません。案件は変更していません。",
      "積荷を登録してから探索してください。",
    ],
    [
      "no-candidates",
      "候補なし",
      "提案先の候補コンテナがありません。案件は変更していません。",
      "候補コンテナを登録してから探索してください。",
    ],
    [
      "no-complete-plan",
      "完全案なし",
      "登録済み候補と今回の探索モデルでは、全積荷を配置できる案がありませんでした。",
      "これは実積載不能の証明ではありません。案件は変更していません。",
    ],
    [
      "cutoff",
      "探索打切り",
      "探索上限に達したため、完全案を確定できませんでした。",
      "配置できる案が存在しないという意味ではありません。案件は変更していません。",
    ],
  ] as const)("maps ready %s to fixed badge and copy", (status, badge, summary, detail) => {
    const project =
      status === "no-cargo"
        ? projectFixture({ cargoes: [], placements: [] })
        : status === "no-candidates"
          ? projectFixture({ containers: [], placements: [] })
          : projectFixture();
    const attempts =
      status === "no-cargo" || status === "no-candidates"
        ? { requestAttemptCount: 0, candidates: [] }
        : status === "no-complete-plan"
          ? {
              requestAttemptCount: 2,
              candidates: project.containers.map(({ id }) => ({
                containerId: id,
                attemptCount: 1,
                outcome: "exhausted" as const,
              })),
            }
          : {
              requestAttemptCount: 10_000,
              candidates: [
                {
                  containerId: "container-a",
                  attemptCount: 10_000,
                  outcome: "cutoff" as const,
                  cutoffSource: "candidate" as const,
                },
              ],
            };
    const result = {
      ...resultBase(),
      attempts,
      status,
      ...(status === "cutoff" ? { cutoffSource: "candidate" as const } : {}),
    } as AutomaticProposalResult;

    const view = automaticProposalView(readySnapshot(project, result), project);

    expect(view).toMatchObject({
      phase: "ready",
      status,
      badge,
      summary,
      detail,
      isApplicablePreview: false,
      safetyNotice: SAFETY_NOTICE,
    });
  });

  it.each([
    [
      "complete",
      "案あり・未適用",
      "現行の計算規則を満たす検討案が見つかりました。まだ案件へ適用していません。",
      "success",
    ],
    [
      "complete-with-cutoff",
      "案あり・最良未確認・未適用",
      "完全案は見つかりましたが、より優先される候補の探索が上限に達したため、目的関数上の最良とは確認できません。",
      "warning",
    ],
  ] as const)("maps %s preview counts, attempts, algorithm and safety", (status, badge, summary, tone) => {
    const project = projectFixture();
    const result = completeResult(status);

    const view = automaticProposalView(readySnapshot(project, result), project);

    expect(view).toMatchObject({
      phase: "ready",
      status,
      tone,
      badge,
      summary,
      detail: expect.stringContaining("現在の配置1件に対し、提案2件です。"),
      safetyNotice: SAFETY_NOTICE,
      isApplicablePreview: true,
      selectedContainerLabel: "anonymous-container-b (container-b)",
      metrics: {
        currentPlacementCount: 1,
        proposalPlacementCount: 2,
        requestAttemptCount: result.attempts.requestAttemptCount,
        candidateCount: result.attempts.candidates.length,
        unverifiedCount: 1,
        algorithmVersion: AUTOMATIC_PROPOSAL_ALGORITHM_VERSION,
        effectiveLimits: result.effectiveLimits,
      },
    });
  });

  it("maps a structure reason to target and related names", () => {
    const project = projectFixture({
      cargoes: [cargo("cargo-a", "Alpha"), cargo("cargo-b", "Beta")],
    });
    const view = automaticProposalView(
      readySnapshot(project, completeResult()),
      project,
    );

    expect(view.unverifiedReasons.rows).toEqual([
      {
        code: "structure-stability-unverified",
        message: "支持後の構造・安定性は未確認です。",
        targetCargoId: "cargo-b",
        targetCargoName: "Beta",
        relatedCargoLabels: ["Alpha (cargo-a)"],
        relatedCargoTotal: 1,
      },
    ]);
  });
});

describe("automaticProposalView source correlation", () => {
  it.each([
    ["unknown candidate summary", (result: Record<string, unknown>) => {
      const attempts = result.attempts as { candidates: Array<Record<string, unknown>> };
      attempts.candidates[0]!.containerId = "marker-unknown-container";
    }],
    ["unknown selected container", (result: Record<string, unknown>) => {
      (result.plan as Record<string, unknown>).containerId = "marker-unknown-container";
    }],
    ["missing cargo placement", (result: Record<string, unknown>) => {
      const plan = result.plan as { placements: unknown[] };
      plan.placements.pop();
    }],
    ["duplicate cargo placement", (result: Record<string, unknown>) => {
      const placements = (result.plan as { placements: Array<Record<string, unknown>> }).placements;
      placements[1]!.cargoId = "cargo-a";
    }],
    ["unknown cargo placement", (result: Record<string, unknown>) => {
      const placements = (result.plan as { placements: Array<Record<string, unknown>> }).placements;
      placements[1]!.cargoId = "marker-unknown-cargo";
    }],
    ["mixed placement containers", (result: Record<string, unknown>) => {
      const placements = (result.plan as { placements: Array<Record<string, unknown>> }).placements;
      placements[1]!.containerId = "container-a";
    }],
    ["disallowed orientation", (result: Record<string, unknown>) => {
      const placements = (result.plan as { placements: Array<Record<string, unknown>> }).placements;
      placements[1]!.orientation = "WLH";
    }],
    ["unknown unverified target", (result: Record<string, unknown>) => {
      const reasons = (result.plan as { unverifiedReasons: Array<{ target: { id: string } }> }).unverifiedReasons;
      reasons[0]!.target.id = "marker-unknown-target";
    }],
    ["unknown related cargo", (result: Record<string, unknown>) => {
      const reasons = (result.plan as { unverifiedReasons: Array<{ relatedCargoIds: string[] }> }).unverifiedReasons;
      reasons[0]!.relatedCargoIds = ["marker-unknown-related"];
    }],
  ] as const)("turns %s into generic failure without reflection", (_label, mutate) => {
    const project = projectFixture();
    const result = structuredClone(completeResult()) as unknown as Record<string, unknown>;
    mutate(result);

    const view = automaticProposalView(
      readySnapshot(project, result as unknown as AutomaticProposalResult),
      project,
    );

    expect(view).toMatchObject({
      phase: "failed",
      badge: "計算不能",
      summary: "自動提案を計算できませんでした。案件は変更していません。",
      isApplicablePreview: false,
    });
    expect(JSON.stringify(view)).not.toContain("marker-");
  });

  it.each([
    ["no-cargo with cargo", "no-cargo"],
    ["no-candidates with candidates", "no-candidates"],
    ["no-complete-plan with empty summary", "no-complete-plan"],
  ] as const)("turns empty/status contradiction %s into generic failure", (_label, status) => {
    const project = projectFixture();
    const result = {
      ...resultBase(),
      attempts: { requestAttemptCount: 0, candidates: [] },
      status,
    } as AutomaticProposalResult;

    expect(automaticProposalView(readySnapshot(project, result), project)).toMatchObject({
      phase: "failed",
      badge: "計算不能",
      isApplicablePreview: false,
    });
  });

  it("maps valid cargo/container permutations by stable IDs rather than array or name order", () => {
    const project = projectFixture({
      cargoes: [cargo("cargo-b", "Name A"), cargo("cargo-a", "Name Z")],
      containers: [
        container("container-b", "Container A"),
        container("container-a", "Container Z"),
      ],
    });
    const result = completeResult();

    const view = automaticProposalView(readySnapshot(project, result), project);

    expect(view.selectedContainerLabel).toBe("Container A (container-b)");
    expect(view.placements.rows.map(({ cargoId, cargoName }) => [cargoId, cargoName])).toEqual([
      ["cargo-a", "Name Z"],
      ["cargo-b", "Name A"],
    ]);
    expect(view.candidates.rows[0]).toMatchObject({
      containerId: "container-b",
      containerName: "Container A",
    });
  });
});

function largeFixture() {
  const cargoes = Array.from({ length: 1_000 }, (_, index) =>
    cargo(`cargo-${index.toString().padStart(4, "0")}`),
  );
  const containers = Array.from({ length: 100 }, (_, index) =>
    container(`container-${index.toString().padStart(3, "0")}`),
  );
  const project = projectFixture({ cargoes, containers, placements: [] });
  const placements = cargoes.map(({ id }, index) => ({
    cargoId: id,
    containerId: "container-099",
    orientation: "LWH" as const,
    positionMm: { xMm: index, yMm: 0, zMm: 0 },
  }));
  const reasons = cargoes.map(({ id }) => ({
    status: "unverified" as const,
    code: "structure-stability-unverified" as const,
    target: { kind: "cargo" as const, id },
    relatedCargoIds: [id],
  }));
  const candidates = containers.map(({ id }, index) => ({
    containerId: id,
    attemptCount: index === 99 ? 1_000 : 1,
    outcome: index === 99 ? ("complete" as const) : ("exhausted" as const),
  }));
  const result: AutomaticProposalResult = {
    ...resultBase(),
    attempts: { requestAttemptCount: 1_099, candidates },
    status: "complete",
    plan: {
      containerId: "container-099",
      placements,
      invalidReasonCount: 0,
      unverifiedReasons: reasons,
    },
  };
  return { project, result };
}

describe("automaticProposalView pagination and purity", () => {
  it.each([0, 24, 25, 26, 1_000])("bounds all pages to 25 rows at offset %i", (offset) => {
    const { project, result } = largeFixture();

    const view = automaticProposalView(readySnapshot(project, result), project, {
      candidateOffset: offset,
      placementOffset: offset,
      unverifiedOffset: offset,
    });

    expect(view.candidates.rows.length).toBeLessThanOrEqual(
      AUTOMATIC_PROPOSAL_VIEW_PAGE_SIZE,
    );
    expect(view.placements.rows.length).toBeLessThanOrEqual(
      AUTOMATIC_PROPOSAL_VIEW_PAGE_SIZE,
    );
    expect(view.unverifiedReasons.rows.length).toBeLessThanOrEqual(
      AUTOMATIC_PROPOSAL_VIEW_PAGE_SIZE,
    );
    expect(view.candidates.offset).toBe(Math.min(offset, 100));
    expect(view.placements.offset).toBe(Math.min(offset, 1_000));
    expect(view.unverifiedReasons.offset).toBe(Math.min(offset, 1_000));
    expect(view.placements.total).toBe(1_000);
    expect(view.unverifiedReasons.total).toBe(1_000);
  });

  it.each([-1, 1.5, Number.NaN, Number.MAX_SAFE_INTEGER + 1])(
    "normalizes invalid page offset %s to zero",
    (offset) => {
      const { project, result } = largeFixture();

      const view = automaticProposalView(readySnapshot(project, result), project, {
        candidateOffset: offset,
        placementOffset: offset,
        unverifiedOffset: offset,
      });

      expect(view.candidates).toMatchObject({ offset: 0, total: 100, hasPrevious: false, hasNext: true });
      expect(view.placements).toMatchObject({ offset: 0, total: 1_000, hasPrevious: false, hasNext: true });
      expect(view.unverifiedReasons).toMatchObject({ offset: 0, total: 1_000, hasPrevious: false, hasNext: true });
      expect(view.candidates.rows).toHaveLength(25);
      expect(view.placements.rows).toHaveLength(25);
      expect(view.unverifiedReasons.rows).toHaveLength(25);
    },
  );

  it("retains long anonymous labels as data for wrapping without truncation", () => {
    const longName = "長".repeat(500);
    const project = projectFixture({
      cargoes: [cargo("cargo-a", longName), cargo("cargo-b", longName)],
      containers: [container("container-a"), container("container-b", longName)],
    });

    const view = automaticProposalView(
      readySnapshot(project, completeResult()),
      project,
    );

    expect(view.selectedContainerLabel).toBe(`${longName} (container-b)`);
    expect(view.placements.rows[0]!.cargoName).toBe(longName);
    expect(view.unverifiedReasons.rows[0]!.targetCargoName).toBe(longName);
  });

  it("does not mutate a frozen Project, snapshot, result, or page request", () => {
    const project = deepFreeze(projectFixture());
    const result = deepFreeze(completeResult());
    const snapshot = deepFreeze(readySnapshot(project, result));
    const pages = deepFreeze({ candidateOffset: 0, placementOffset: 0, unverifiedOffset: 0 });
    const projectBefore = structuredClone(project);
    const snapshotBefore = structuredClone(snapshot);

    automaticProposalView(snapshot, project, pages);

    expect(project).toEqual(projectBefore);
    expect(snapshot).toEqual(snapshotBefore);
    expect(pages).toEqual({ candidateOffset: 0, placementOffset: 0, unverifiedOffset: 0 });
  });
});

describe("automaticProposalView apply phases", () => {
  const summary = {
    containerId: "container-b",
    placementCount: 2,
    replacedPlacementCount: 1,
    unverifiedReasonCount: 3,
  } as const;

  it.each([
    [
      "applying",
      {
        phase: "applying",
        sourceProject: projectFixture(),
        interactionGeneration: 1,
        identity: 1,
      },
      ["適用中", "提案を現在の案件へ一括適用しています。", "progress"],
    ],
    [
      "apply-failed",
      { phase: "apply-failed" },
      [
        "適用せず",
        "提案を再検証できなかったため適用しませんでした。案件は変更していません。",
        "error",
      ],
    ],
    [
      "blocked",
      { phase: "blocked" },
      [
        "適用保留",
        "入力または別の操作中だったため、提案を適用しませんでした。",
        "warning",
      ],
    ],
  ] as const)("maps %s to fixed non-reflective copy", (_label, snapshot, expected) => {
    const project = projectFixture({ name: "marker-sensitive-name" });

    const view = automaticProposalView(
      snapshot as AutomaticProposalSessionSnapshot,
      project,
    );

    expect([view.badge, view.summary, view.tone]).toEqual(expected);
    expect(JSON.stringify(view)).not.toContain("marker-sensitive-name");
  });

  it.each([
    [
      "applied",
      "適用済み",
      "候補anonymous-container-b (container-b)へ2件適用、1回の取り消しで元へ戻せます。",
      "success",
    ],
    [
      "unchanged",
      "変更なし",
      "提案は現在の配置と同じため、案件と操作履歴は変更していません。",
      "neutral",
    ],
  ] as const)("maps terminal %s with confirmation-relevant summary only", (phase, badge, copy, tone) => {
    const project = projectFixture();
    const snapshot = {
      phase,
      currentProject: project,
      interactionGeneration: 2,
      identity: 7,
      summary,
    } as AutomaticProposalSessionSnapshot;

    const view = automaticProposalView(snapshot, project);

    expect(view).toMatchObject({
      phase,
      badge,
      summary: copy,
      tone,
      detail: "未確認事項3件を保持しています。安全上の制限を再確認してください。",
      selectedContainerLabel: "anonymous-container-b (container-b)",
      metrics: {
        currentPlacementCount: project.placements.length,
        proposalPlacementCount: 2,
        unverifiedCount: 3,
      },
      isApplicablePreview: false,
    });
    expect(JSON.stringify(view)).not.toContain("algorithmVersion");
  });

  it("falls back to fixed apply failure when the applied container disappeared", () => {
    const project = projectFixture({ containers: [container("container-a")] });

    const view = automaticProposalView(
      {
        phase: "applied",
        currentProject: project,
        interactionGeneration: 1,
        identity: 1,
        summary,
      },
      project,
    );

    expect(view).toMatchObject({
      phase: "apply-failed",
      badge: "適用せず",
      isApplicablePreview: false,
    });
  });
});
