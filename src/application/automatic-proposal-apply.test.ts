import { describe, expect, it, vi } from "vitest";

import {
  AUTOMATIC_PROPOSAL_ALGORITHM_VERSION,
  AUTOMATIC_PROPOSAL_CANDIDATE_ATTEMPT_LIMIT,
  AUTOMATIC_PROPOSAL_CANDIDATE_POINT_LIMIT,
  AUTOMATIC_PROPOSAL_REQUEST_ATTEMPT_LIMIT,
  type AutomaticProposalResult,
} from "../domain/automatic-proposal";
import { PROJECT_SCHEMA_VERSION, type Placement, type Project } from "../domain/model";
import type * as ValidationModule from "../domain/validation";
import { prepareAutomaticProposalApply } from "./automatic-proposal-apply";

const validationControl = vi.hoisted(() => ({ unavailable: false }));

vi.mock("../domain/validation", async (importOriginal) => {
  const actual = await importOriginal<typeof ValidationModule>();
  return {
    ...actual,
    validatePlacementSet: (...argumentsList: Parameters<typeof actual.validatePlacementSet>) =>
      validationControl.unavailable
        ? {
            kind: "unavailable" as const,
            containerId: argumentsList[1],
            reason: {
              code: "physical.geometry-calculation-unavailable" as const,
              target: { kind: "container" as const, id: argumentsList[1] },
            },
          }
        : actual.validatePlacementSet(...argumentsList),
  };
});

function cargo(id: string, options: { massGrams?: number; canSupportCargo?: boolean } = {}) {
  return {
    id,
    name: `匿名-${id}`,
    dimensionsMm: { lengthMm: 100, widthMm: 100, heightMm: 100 },
    massGrams: options.massGrams ?? 1_000,
    canSupportCargo: options.canSupportCargo ?? false,
    allowedOrientations: ["LWH"] as const,
  };
}

function ap02Project(overrides: Partial<Project> = {}): Project {
  return {
    schemaVersion: PROJECT_SCHEMA_VERSION,
    projectId: "proposal-apply",
    name: "匿名適用案件",
    clearancesMm: { xMm: 0, yMm: 0, zMm: 0 },
    cargoes: [cargo("cargo-a"), cargo("cargo-b")],
    containers: [
      {
        id: "container-a",
        name: "匿名候補",
        internalDimensionsMm: { lengthMm: 200, widthMm: 100, heightMm: 100 },
        openingMm: { widthMm: 100, heightMm: 100 },
        payloadCapacityGrams: 2_000,
      },
    ],
    placements: [],
    ...overrides,
  };
}

function ap02Placements(): readonly Placement[] {
  return [
    {
      cargoId: "cargo-a",
      containerId: "container-a",
      orientation: "LWH",
      positionMm: { xMm: 0, yMm: 0, zMm: 0 },
    },
    {
      cargoId: "cargo-b",
      containerId: "container-a",
      orientation: "LWH",
      positionMm: { xMm: 100, yMm: 0, zMm: 0 },
    },
  ];
}

type CompleteResult = Extract<
  AutomaticProposalResult,
  { readonly status: "complete" | "complete-with-cutoff" }
>;

function resultFor(
  placements: readonly Placement[] = ap02Placements(),
  status: "complete" | "complete-with-cutoff" = "complete",
): CompleteResult {
  const candidates =
    status === "complete"
      ? [
          {
            containerId: "container-a",
            attemptCount: placements.length,
            outcome: "complete" as const,
          },
        ]
      : [
          {
            containerId: "container-prior",
            attemptCount: 10_000,
            outcome: "cutoff" as const,
            cutoffSource: "candidate" as const,
          },
          {
            containerId: "container-a",
            attemptCount: placements.length,
            outcome: "complete" as const,
          },
        ];
  const base = {
    algorithmVersion: AUTOMATIC_PROPOSAL_ALGORITHM_VERSION,
    effectiveLimits: {
      candidateAttemptLimit: AUTOMATIC_PROPOSAL_CANDIDATE_ATTEMPT_LIMIT,
      requestAttemptLimit: AUTOMATIC_PROPOSAL_REQUEST_ATTEMPT_LIMIT,
      candidatePointLimit: AUTOMATIC_PROPOSAL_CANDIDATE_POINT_LIMIT,
    },
    attempts: {
      requestAttemptCount: candidates.reduce(
        (total, candidate) => total + candidate.attemptCount,
        0,
      ),
      candidates,
    },
    plan: {
      containerId: "container-a",
      placements,
      invalidReasonCount: 0 as const,
      unverifiedReasons: [],
    },
  };
  return status === "complete"
    ? { ...base, status }
    : { ...base, status, cutoffSource: "candidate" };
}

function ap03Fixture() {
  const project = ap02Project({
    cargoes: [
      cargo("support", { massGrams: 1_001, canSupportCargo: true }),
      cargo("upper"),
    ],
    containers: [
      {
        id: "container-a",
        name: "匿名段積み候補",
        internalDimensionsMm: { lengthMm: 100, widthMm: 100, heightMm: 200 },
        openingMm: { widthMm: 100, heightMm: 200 },
        payloadCapacityGrams: 2_001,
      },
    ],
  });
  const placements: readonly Placement[] = [
    {
      cargoId: "support",
      containerId: "container-a",
      orientation: "LWH",
      positionMm: { xMm: 0, yMm: 0, zMm: 0 },
    },
    {
      cargoId: "upper",
      containerId: "container-a",
      orientation: "LWH",
      positionMm: { xMm: 0, yMm: 0, zMm: 100 },
    },
  ];
  const reasons = [
    {
      status: "unverified" as const,
      code: "structure-stability-unverified" as const,
      target: { kind: "cargo" as const, id: "upper" },
      relatedCargoIds: ["support"],
    },
  ];
  const result = resultFor(placements);
  return {
    project,
    result: {
      ...result,
      plan: { ...result.plan, placements, unverifiedReasons: reasons },
    } as AutomaticProposalResult,
    reasons,
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

function expectFailurePreserves({
  code,
  currentProject,
  result,
  sourceProject = currentProject,
}: {
  readonly code:
    | "automatic-proposal.apply-stale"
    | "automatic-proposal.apply-not-complete"
    | "automatic-proposal.apply-plan-invalid"
    | "automatic-proposal.apply-schema-invalid"
    | "automatic-proposal.apply-semantic-invalid"
    | "automatic-proposal.apply-validation-unavailable"
    | "automatic-proposal.apply-physical-invalid"
    | "automatic-proposal.apply-unverified-mismatch";
  readonly currentProject: Project;
  readonly sourceProject?: Project;
  readonly result: AutomaticProposalResult;
}) {
  const frozenCurrent = deepFreeze(currentProject);
  const frozenSource =
    sourceProject === currentProject ? frozenCurrent : deepFreeze(sourceProject);
  const frozenResult = deepFreeze(result);
  const currentBefore = structuredClone(frozenCurrent);
  const sourceBefore = structuredClone(frozenSource);
  const resultBefore = structuredClone(frozenResult);

  const prepared = prepareAutomaticProposalApply(
    frozenCurrent,
    frozenSource,
    frozenResult,
  );

  expect(prepared).toMatchObject({ ok: false, code });
  expect(prepared.project).toBe(frozenCurrent);
  expect(frozenCurrent).toEqual(currentBefore);
  expect(frozenSource).toEqual(sourceBefore);
  expect(frozenResult).toEqual(resultBefore);
}

describe("prepareAutomaticProposalApply", () => {
  it.each(["complete", "complete-with-cutoff"] as const)(
    "prepares an AP-02 %s plan by changing placements only",
    (status) => {
      const priorPlacement: Placement = {
        cargoId: "cargo-a",
        containerId: "container-a",
        orientation: "LWH",
        positionMm: { xMm: 50, yMm: 0, zMm: 0 },
      };
      const project = deepFreeze(ap02Project({ placements: [priorPlacement] }));
      const result = deepFreeze(resultFor(ap02Placements(), status));
      const projectBefore = structuredClone(project);
      const resultBefore = structuredClone(result);

      const prepared = prepareAutomaticProposalApply(project, project, result);

      expect(prepared).toMatchObject({
        ok: true,
        changed: true,
        summary: {
          containerId: "container-a",
          placementCount: 2,
          replacedPlacementCount: 1,
          unverifiedReasonCount: 0,
        },
        unverifiedReasons: [],
      });
      if (!prepared.ok || !prepared.changed) {
        throw new Error("Expected a changed AP-02 plan");
      }
      expect(prepared.project).not.toBe(project);
      expect(prepared.project.cargoes).toBe(project.cargoes);
      expect(prepared.project.containers).toBe(project.containers);
      expect(prepared.project.clearancesMm).toBe(project.clearancesMm);
      expect(prepared.project.placements).toEqual(ap02Placements());
      expect(prepared.project.placements).not.toBe(result.plan.placements);
      expect(prepared.project.placements[0]).not.toBe(result.plan.placements[0]);
      expect(prepared.project.placements[0]?.positionMm).not.toBe(
        result.plan.placements[0]?.positionMm,
      );
      expect(project).toEqual(projectBefore);
      expect(result).toEqual(resultBefore);
    },
  );

  it("preserves the authoritative AP-03 structure warning exactly", () => {
    const { project, reasons, result } = ap03Fixture();

    const prepared = prepareAutomaticProposalApply(project, project, result);

    expect(prepared).toMatchObject({
      ok: true,
      changed: true,
      summary: {
        containerId: "container-a",
        placementCount: 2,
        replacedPlacementCount: 0,
        unverifiedReasonCount: 1,
      },
      unverifiedReasons: reasons,
    });
  });

  it("returns the exact current Project for the same placement set in a different order", () => {
    const placements = ap02Placements();
    const project = ap02Project({ placements: [...placements].reverse() });

    const prepared = prepareAutomaticProposalApply(
      project,
      project,
      resultFor(placements),
    );

    expect(prepared).toMatchObject({ ok: true, changed: false });
    if (!prepared.ok) {
      throw new Error("Expected no-op plan");
    }
    expect(prepared.project).toBe(project);
  });

  it("rejects a stale Project reference before inspecting the result", () => {
    const source = ap02Project();
    const current = { ...source };

    expectFailurePreserves({
      code: "automatic-proposal.apply-stale",
      currentProject: current,
      sourceProject: source,
      result: resultFor(),
    });
  });

  it("rejects every non-complete result without mutation", () => {
    const project = ap02Project();
    const result: AutomaticProposalResult = {
      algorithmVersion: AUTOMATIC_PROPOSAL_ALGORITHM_VERSION,
      effectiveLimits: {
        candidateAttemptLimit: AUTOMATIC_PROPOSAL_CANDIDATE_ATTEMPT_LIMIT,
        requestAttemptLimit: AUTOMATIC_PROPOSAL_REQUEST_ATTEMPT_LIMIT,
        candidatePointLimit: AUTOMATIC_PROPOSAL_CANDIDATE_POINT_LIMIT,
      },
      attempts: { requestAttemptCount: 0, candidates: [] },
      status: "no-cargo",
    };

    expectFailurePreserves({
      code: "automatic-proposal.apply-not-complete",
      currentProject: project,
      result,
    });
  });

  it.each([
    ["empty", () => []],
    ["missing", () => ap02Placements().slice(0, 1)],
    ["duplicate", () => [ap02Placements()[0]!, ap02Placements()[0]!]],
    [
      "unknown cargo",
      () => [
        ap02Placements()[0]!,
        { ...ap02Placements()[1]!, cargoId: "cargo-unknown" },
      ],
    ],
    [
      "mixed container",
      () => [
        ap02Placements()[0]!,
        { ...ap02Placements()[1]!, containerId: "container-other" },
      ],
    ],
  ] as const)("rejects a %s placement plan", (_label, placements) => {
    const project = ap02Project();
    const result = resultFor(placements());

    expectFailurePreserves({
      code: "automatic-proposal.apply-plan-invalid",
      currentProject: project,
      result,
    });
  });

  it.each([
    ["unknown selected container", { containerId: "container-unknown" }],
    ["nonzero invalid count", { invalidReasonCount: 1 }],
  ] as const)("rejects %s at the plan boundary", (_label, planOverride) => {
    const project = ap02Project();
    const result = resultFor();
    const malformed = {
      ...result,
      plan: { ...result.plan, ...planOverride },
    } as AutomaticProposalResult;

    expectFailurePreserves({
      code: "automatic-proposal.apply-plan-invalid",
      currentProject: project,
      result: malformed,
    });
  });

  it.each([
    ["fractional coordinate", { xMm: 0.5, yMm: 0, zMm: 0 }],
    ["out-of-range coordinate", { xMm: 1_000_001, yMm: 0, zMm: 0 }],
  ] as const)("rejects a %s as schema invalid", (_label, positionMm) => {
    const project = ap02Project();
    const placements = [
      { ...ap02Placements()[0]!, positionMm },
      ap02Placements()[1]!,
    ];

    expectFailurePreserves({
      code: "automatic-proposal.apply-schema-invalid",
      currentProject: project,
      result: resultFor(placements),
    });
  });

  it("rejects a schema-valid but disallowed cargo orientation as semantic invalid", () => {
    const project = ap02Project();
    const placements = [
      { ...ap02Placements()[0]!, orientation: "WLH" as const },
      ap02Placements()[1]!,
    ];

    expectFailurePreserves({
      code: "automatic-proposal.apply-semantic-invalid",
      currentProject: project,
      result: resultFor(placements),
    });
  });

  it("rejects the AP-02 199 mm derived case as physically invalid", () => {
    const project = ap02Project({
      containers: [
        {
          ...ap02Project().containers[0]!,
          internalDimensionsMm: { lengthMm: 199, widthMm: 100, heightMm: 100 },
        },
      ],
    });

    expectFailurePreserves({
      code: "automatic-proposal.apply-physical-invalid",
      currentProject: project,
      result: resultFor(),
    });
  });

  it("rejects a conditionally supported plan at the apply boundary", () => {
    const project = ap02Project({
      cargoes: [
        {
          ...cargo("support-a", { canSupportCargo: true }),
          dimensionsMm: { lengthMm: 50, widthMm: 100, heightMm: 100 },
        },
        {
          ...cargo("support-b", { canSupportCargo: true }),
          dimensionsMm: { lengthMm: 50, widthMm: 100, heightMm: 100 },
        },
        cargo("upper"),
      ],
      containers: [
        {
          ...ap02Project().containers[0]!,
          internalDimensionsMm: { lengthMm: 100, widthMm: 100, heightMm: 200 },
          openingMm: { widthMm: 100, heightMm: 200 },
          payloadCapacityGrams: 3_000,
        },
      ],
    });
    const placements: readonly Placement[] = [
      {
        cargoId: "support-a",
        containerId: "container-a",
        orientation: "LWH",
        positionMm: { xMm: 0, yMm: 0, zMm: 0 },
      },
      {
        cargoId: "support-b",
        containerId: "container-a",
        orientation: "LWH",
        positionMm: { xMm: 50, yMm: 0, zMm: 0 },
      },
      {
        cargoId: "upper",
        containerId: "container-a",
        orientation: "LWH",
        positionMm: { xMm: 0, yMm: 0, zMm: 100 },
      },
    ];
    const baseResult = resultFor(placements);
    const result = {
      ...baseResult,
      plan: {
        ...baseResult.plan,
        unverifiedReasons: [
          {
            status: "unverified" as const,
            code: "support-conditions-unverified" as const,
            target: { kind: "cargo" as const, id: "upper" },
            relatedCargoIds: ["support-a", "support-b"],
          },
        ],
      },
    } as AutomaticProposalResult;

    expectFailurePreserves({
      code: "automatic-proposal.apply-physical-invalid",
      currentProject: project,
      result,
    });
  });

  it("maps an authoritative validator unavailable result without changing the Project", () => {
    const project = ap02Project();
    validationControl.unavailable = true;
    try {
      expectFailurePreserves({
        code: "automatic-proposal.apply-validation-unavailable",
        currentProject: project,
        result: resultFor(),
      });
    } finally {
      validationControl.unavailable = false;
    }
  });

  it.each([
    ["missing", (reasons: readonly unknown[]) => reasons.slice(0, 0)],
    ["duplicate", (reasons: readonly unknown[]) => [reasons[0]!, reasons[0]!]],
    [
      "changed relation",
      (reasons: readonly unknown[]) => [
        {
          ...(reasons[0] as Record<string, unknown>),
          relatedCargoIds: ["upper"],
        },
      ],
    ],
  ] as const)("rejects %s unverified reasons", (_label, unverifiedReasons) => {
    const { project, reasons, result } = ap03Fixture();
    if (result.status !== "complete" && result.status !== "complete-with-cutoff") {
      throw new Error("Expected a complete AP-03 result");
    }
    const mismatch = {
      ...result,
      plan: { ...result.plan, unverifiedReasons: unverifiedReasons(reasons) },
    } as AutomaticProposalResult;

    expectFailurePreserves({
      code: "automatic-proposal.apply-unverified-mismatch",
      currentProject: project,
      result: mismatch,
    });
  });
});
