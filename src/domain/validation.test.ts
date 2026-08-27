import { describe, expect, it } from "vitest";

import type { Project } from "./model";
import { PROJECT_SCHEMA_VERSION } from "./model";
import {
  evaluatePayloadCapacity,
  safeIntegerSum,
  validatePlacementSet,
  validateProjectReferences,
} from "./validation";
import type {
  InvalidPhysicalReasonCode,
  PhysicalValidationReason,
  UnverifiedPhysicalReasonCode,
} from "./validation";

function richProject(): Project {
  return {
    schemaVersion: PROJECT_SCHEMA_VERSION,
    projectId: "project-1",
    name: "匿名試験案件",
    clearancesMm: { xMm: 0, yMm: 0, zMm: 0 },
    cargoes: [
      {
        id: "cargo-1",
        name: "匿名積荷",
        dimensionsMm: { lengthMm: 100, widthMm: 80, heightMm: 60 },
        massGrams: 1_000,
        canSupportCargo: false,
        allowedOrientations: ["LWH", "WLH"],
      },
    ],
    containers: [
      {
        id: "container-1",
        name: "匿名コンテナ",
        internalDimensionsMm: { lengthMm: 1_000, widthMm: 500, heightMm: 500 },
        openingMm: { widthMm: 400, heightMm: 400 },
        payloadCapacityGrams: 10_000,
      },
    ],
    placements: [
      {
        cargoId: "cargo-1",
        containerId: "container-1",
        positionMm: { xMm: 0, yMm: 0, zMm: 0 },
        orientation: "LWH",
      },
    ],
  };
}

describe("safeIntegerSum", () => {
  it("accepts the maximum safe integer boundary", () => {
    expect(safeIntegerSum([Number.MAX_SAFE_INTEGER - 1, 1])).toEqual({
      valid: true,
      sum: Number.MAX_SAFE_INTEGER,
    });
  });

  it("rejects a sum above the maximum safe integer", () => {
    expect(safeIntegerSum([Number.MAX_SAFE_INTEGER, 1])).toEqual({ valid: false });
  });

  it("rejects an unsafe input value", () => {
    expect(safeIntegerSum([Number.MAX_SAFE_INTEGER + 1])).toEqual({ valid: false });
  });
});

describe("evaluatePayloadCapacity", () => {
  it.each([
    { label: "zero capacity", capacity: 0 },
    { label: "positive capacity", capacity: 10_000 },
  ])("treats an empty mass list as total zero within $label", ({ capacity }) => {
    expect(evaluatePayloadCapacity([], capacity)).toEqual({
      calculable: true,
      totalMassGrams: 0,
      withinCapacity: true,
    });
  });

  it.each([
    { label: "single mass below capacity", masses: [999], capacity: 1_000, total: 999 },
    {
      label: "multiple masses below capacity",
      masses: [100, 200, 300],
      capacity: 1_000,
      total: 600,
    },
    {
      label: "mass zero mathematical boundary",
      masses: [0, 100],
      capacity: 100,
      total: 100,
    },
  ])("calculates $label", ({ masses, capacity, total }) => {
    expect(evaluatePayloadCapacity(masses, capacity)).toEqual({
      calculable: true,
      totalMassGrams: total,
      withinCapacity: true,
    });
  });

  it("accepts exact payload equality", () => {
    expect(evaluatePayloadCapacity([400, 600], 1_000)).toEqual({
      calculable: true,
      totalMassGrams: 1_000,
      withinCapacity: true,
    });
  });

  it("reports exactly 1 gram over capacity without losing the total", () => {
    expect(evaluatePayloadCapacity([400, 601], 1_000)).toEqual({
      calculable: true,
      totalMassGrams: 1_001,
      withinCapacity: false,
    });
  });

  it("is independent of input mass order", () => {
    const ascending = evaluatePayloadCapacity([100, 200, 300], 1_000);
    const shuffled = evaluatePayloadCapacity([300, 100, 200], 1_000);

    expect(shuffled).toEqual(ascending);
  });

  it("accepts the maximum safe integer as both mass and capacity", () => {
    expect(
      evaluatePayloadCapacity([Number.MAX_SAFE_INTEGER], Number.MAX_SAFE_INTEGER),
    ).toEqual({
      calculable: true,
      totalMassGrams: Number.MAX_SAFE_INTEGER,
      withinCapacity: true,
    });
  });

  it.each([
    { label: "negative mass", masses: [-1] },
    { label: "noninteger mass", masses: [0.5] },
    { label: "NaN mass", masses: [Number.NaN] },
    { label: "positive infinity mass", masses: [Number.POSITIVE_INFINITY] },
    { label: "negative infinity mass", masses: [Number.NEGATIVE_INFINITY] },
    { label: "unsafe mass", masses: [Number.MAX_SAFE_INTEGER + 1] },
    { label: "overflowing sum", masses: [Number.MAX_SAFE_INTEGER, 1] },
  ])("rejects $label as uncalculable", ({ masses }) => {
    expect(evaluatePayloadCapacity(masses, Number.MAX_SAFE_INTEGER)).toEqual({
      calculable: false,
    });
  });

  it.each([
    { label: "negative capacity", capacity: -1 },
    { label: "noninteger capacity", capacity: 0.5 },
    { label: "NaN capacity", capacity: Number.NaN },
    { label: "positive infinity capacity", capacity: Number.POSITIVE_INFINITY },
    { label: "negative infinity capacity", capacity: Number.NEGATIVE_INFINITY },
    { label: "unsafe capacity", capacity: Number.MAX_SAFE_INTEGER + 1 },
  ])("rejects $label as uncalculable", ({ capacity }) => {
    expect(evaluatePayloadCapacity([0], capacity)).toEqual({ calculable: false });
  });

  it("does not mutate the mass list", () => {
    const masses = [300, 100, 200] as const;
    const original = structuredClone(masses);

    evaluatePayloadCapacity(masses, 1_000);

    expect(masses).toEqual(original);
  });
});

describe("validateProjectReferences", () => {
  it("accepts a valid rich project without mutating it", () => {
    const project = richProject();
    const original = structuredClone(project);

    expect(validateProjectReferences(project)).toEqual([]);
    expect(project).toEqual(original);
  });

  it("reports duplicate cargo and container ids in deterministic order", () => {
    const project = richProject();
    const invalid: Project = {
      ...project,
      cargoes: [...project.cargoes, { ...project.cargoes[0]! }],
      containers: [...project.containers, { ...project.containers[0]! }],
    };

    expect(validateProjectReferences(invalid)).toEqual([
      { code: "semantic.duplicate-cargo-id", path: "/cargoes/1/id" },
      { code: "semantic.duplicate-container-id", path: "/containers/1/id" },
    ]);
  });

  it("reports opening width and height exceeding internal dimensions", () => {
    const project = richProject();
    const invalid: Project = {
      ...project,
      containers: [
        {
          ...project.containers[0]!,
          openingMm: { widthMm: 501, heightMm: 501 },
        },
      ],
    };

    expect(validateProjectReferences(invalid)).toEqual([
      {
        code: "semantic.opening-width-exceeds-internal",
        path: "/containers/0/openingMm/widthMm",
      },
      {
        code: "semantic.opening-height-exceeds-internal",
        path: "/containers/0/openingMm/heightMm",
      },
    ]);
  });

  it("reports broken references, duplicate placement, and a disallowed orientation", () => {
    const project = richProject();
    const invalid: Project = {
      ...project,
      placements: [
        { ...project.placements[0]!, orientation: "LHW" },
        { ...project.placements[0]! },
        {
          ...project.placements[0]!,
          cargoId: "missing-cargo",
          containerId: "missing-container",
        },
      ],
    };

    expect(validateProjectReferences(invalid)).toEqual([
      { code: "semantic.disallowed-orientation", path: "/placements/0/orientation" },
      { code: "semantic.duplicate-cargo-placement", path: "/placements/1/cargoId" },
      { code: "semantic.unknown-cargo-reference", path: "/placements/2/cargoId" },
      { code: "semantic.unknown-container-reference", path: "/placements/2/containerId" },
    ]);
  });

  it("suppresses issues derived from duplicate definitions and unknown placement identity", () => {
    const project = richProject();
    const invalid: Project = {
      ...project,
      cargoes: [
        project.cargoes[0]!,
        {
          ...project.cargoes[0]!,
          allowedOrientations: ["WLH"],
        },
      ],
      containers: [project.containers[0]!, { ...project.containers[0]! }],
      placements: [
        {
          ...project.placements[0]!,
          orientation: "LHW",
        },
        {
          ...project.placements[0]!,
          cargoId: "missing-cargo",
          containerId: "missing-container",
        },
        {
          ...project.placements[0]!,
          cargoId: "missing-cargo",
          containerId: "missing-container",
        },
      ],
    };

    expect(validateProjectReferences(invalid)).toEqual([
      { code: "semantic.duplicate-cargo-id", path: "/cargoes/1/id" },
      { code: "semantic.duplicate-container-id", path: "/containers/1/id" },
      { code: "semantic.unknown-cargo-reference", path: "/placements/1/cargoId" },
      { code: "semantic.unknown-container-reference", path: "/placements/1/containerId" },
      { code: "semantic.unknown-cargo-reference", path: "/placements/2/cargoId" },
      { code: "semantic.unknown-container-reference", path: "/placements/2/containerId" },
    ]);
  });
});

type CargoFixture = Project["cargoes"][number];
type ContainerFixture = Project["containers"][number];
type PlacementFixture = Project["placements"][number];

function physicalCargo(
  id: string,
  overrides: Partial<CargoFixture> = {},
): CargoFixture {
  return {
    id,
    name: `匿名積荷-${id}`,
    dimensionsMm: { lengthMm: 10, widthMm: 10, heightMm: 10 },
    massGrams: 100,
    canSupportCargo: true,
    allowedOrientations: ["LWH"],
    ...overrides,
  };
}

function physicalContainer(
  id = "container-1",
  overrides: Partial<ContainerFixture> = {},
): ContainerFixture {
  return {
    id,
    name: `匿名コンテナ-${id}`,
    internalDimensionsMm: { lengthMm: 100, widthMm: 100, heightMm: 100 },
    openingMm: { widthMm: 100, heightMm: 100 },
    payloadCapacityGrams: 1_000,
    ...overrides,
  };
}

function physicalPlacement(
  cargoId: string,
  overrides: Partial<PlacementFixture> = {},
): PlacementFixture {
  return {
    cargoId,
    containerId: "container-1",
    positionMm: { xMm: 0, yMm: 0, zMm: 0 },
    orientation: "LWH",
    ...overrides,
  };
}

function physicalProject(
  options: {
    readonly clearancesMm?: Project["clearancesMm"];
    readonly cargoes?: Project["cargoes"];
    readonly containers?: Project["containers"];
    readonly placements?: Project["placements"];
  } = {},
): Project {
  return {
    schemaVersion: PROJECT_SCHEMA_VERSION,
    projectId: "physical-project",
    name: "匿名物理判定案件",
    clearancesMm: options.clearancesMm ?? { xMm: 0, yMm: 0, zMm: 0 },
    cargoes: options.cargoes ?? [],
    containers: options.containers ?? [physicalContainer()],
    placements: options.placements ?? [],
  };
}

function invalidCargoReason(
  code: InvalidPhysicalReasonCode,
  id: string,
  relatedCargoIds: readonly string[] = [],
): PhysicalValidationReason {
  return {
    status: "invalid",
    code,
    target: { kind: "cargo", id },
    relatedCargoIds,
  };
}

function unverifiedCargoReason(
  code: UnverifiedPhysicalReasonCode,
  id: string,
  relatedCargoIds: readonly string[] = [],
): PhysicalValidationReason {
  return {
    status: "unverified",
    code,
    target: { kind: "cargo", id },
    relatedCargoIds,
  };
}

function payloadExceededReason(
  containerId: string,
  relatedCargoIds: readonly string[],
): PhysicalValidationReason {
  return {
    status: "invalid",
    code: "payload-capacity-exceeded",
    target: { kind: "container", id: containerId },
    relatedCargoIds,
  };
}

describe("validatePlacementSet", () => {
  const pathReason = (id: string): PhysicalValidationReason =>
    unverifiedCargoReason("opening-path-unverified", id);

  it("returns valid for an empty selected container", () => {
    expect(validatePlacementSet(physicalProject(), "container-1")).toEqual({
      kind: "evaluated",
      containerId: "container-1",
      status: "valid",
      reasons: [],
    });
  });

  it("returns unavailable when the selected container does not exist", () => {
    expect(validatePlacementSet(physicalProject(), "missing-container")).toEqual({
      kind: "unavailable",
      containerId: "missing-container",
      reason: {
        code: "physical.container-not-found",
        target: { kind: "container", id: "missing-container" },
      },
    });
  });

  it("returns unavailable with exact semantic issues before physical evaluation", () => {
    const project = physicalProject({
      placements: [physicalPlacement("missing-cargo")],
    });

    expect(validatePlacementSet(project, "container-1")).toEqual({
      kind: "unavailable",
      containerId: "container-1",
      reason: {
        code: "physical.semantic-input-invalid",
        issues: [
          {
            code: "semantic.unknown-cargo-reference",
            path: "/placements/0/cargoId",
          },
        ],
      },
    });
  });

  it("isolates placements, pairs, and payload to the selected container", () => {
    const cargoA = physicalCargo("cargo-a", { massGrams: 100 });
    const cargoB = physicalCargo("cargo-b", { massGrams: 50_000 });
    const project = physicalProject({
      cargoes: [cargoA, cargoB],
      containers: [
        physicalContainer("container-1", { payloadCapacityGrams: 100 }),
        physicalContainer("container-2", { payloadCapacityGrams: 100_000 }),
      ],
      placements: [
        physicalPlacement("cargo-a"),
        physicalPlacement("cargo-b", {
          containerId: "container-2",
          positionMm: { xMm: -1, yMm: -1, zMm: -1 },
        }),
      ],
    });

    expect(validatePlacementSet(project, "container-1")).toEqual({
      kind: "evaluated",
      containerId: "container-1",
      status: "unverified",
      reasons: [pathReason("cargo-a")],
    });
  });

  it.each([
    {
      label: "raw outside",
      xMm: -1,
      expectedCode: "outside-container" as const,
    },
    {
      label: "raw inside but below clearance",
      xMm: 4,
      expectedCode: "container-clearance-not-met" as const,
    },
  ])("distinguishes $label boundary failure", ({ xMm, expectedCode }) => {
    const project = physicalProject({
      clearancesMm: { xMm: 5, yMm: 5, zMm: 5 },
      cargoes: [physicalCargo("cargo-a")],
      placements: [
        physicalPlacement("cargo-a", {
          positionMm: { xMm, yMm: 5, zMm: 0 },
        }),
      ],
    });

    expect(validatePlacementSet(project, "container-1")).toEqual({
      kind: "evaluated",
      containerId: "container-1",
      status: "invalid",
      reasons: [
        invalidCargoReason(expectedCode, "cargo-a"),
        pathReason("cargo-a"),
      ],
    });
  });

  it("suppresses pair overlap diagnostics involving a raw-outside placement", () => {
    const project = physicalProject({
      cargoes: [physicalCargo("cargo-a"), physicalCargo("cargo-b")],
      placements: [
        physicalPlacement("cargo-a", {
          positionMm: { xMm: -1, yMm: 0, zMm: 0 },
        }),
        physicalPlacement("cargo-b"),
      ],
    });

    expect(validatePlacementSet(project, "container-1")).toEqual({
      kind: "evaluated",
      containerId: "container-1",
      status: "invalid",
      reasons: [
        invalidCargoReason("outside-container", "cargo-a"),
        pathReason("cargo-a"),
        pathReason("cargo-b"),
      ],
    });
  });

  it("uses only floor penetration for simultaneous negative X and Z while suppressing coordinate cascades", () => {
    const project = physicalProject({
      cargoes: [physicalCargo("cargo-a"), physicalCargo("cargo-b")],
      placements: [
        physicalPlacement("cargo-a", {
          positionMm: { xMm: -1, yMm: 0, zMm: -1 },
        }),
        physicalPlacement("cargo-b"),
      ],
    });

    expect(validatePlacementSet(project, "container-1")).toEqual({
      kind: "evaluated",
      containerId: "container-1",
      status: "invalid",
      reasons: [
        invalidCargoReason("floor-penetration", "cargo-a"),
        pathReason("cargo-a"),
        pathReason("cargo-b"),
      ],
    });
  });

  it("treats zMin 0 as the exact valid floor boundary", () => {
    const project = physicalProject({
      cargoes: [physicalCargo("cargo-a")],
      placements: [
        physicalPlacement("cargo-a", {
          positionMm: { xMm: 0, yMm: 0, zMm: 0 },
        }),
      ],
    });

    expect(validatePlacementSet(project, "container-1")).toEqual({
      kind: "evaluated",
      containerId: "container-1",
      status: "unverified",
      reasons: [pathReason("cargo-a")],
    });
  });

  it.each([
    {
      label: "1 mm positive overlap",
      secondXmm: 14,
      expectedStatus: "invalid",
      pairReason: invalidCargoReason(
        "positive-volume-overlap",
        "cargo-a",
        ["cargo-b"],
      ),
    },
    {
      label: "exact X clearance",
      secondXmm: 20,
      expectedStatus: "unverified",
      pairReason: undefined,
    },
    {
      label: "clearance short by 1 mm",
      secondXmm: 19,
      expectedStatus: "invalid",
      pairReason: invalidCargoReason(
        "axis-clearance-not-met",
        "cargo-a",
        ["cargo-b"],
      ),
    },
  ] as const)("evaluates pairwise $label", ({ secondXmm, expectedStatus, pairReason }) => {
    const project = physicalProject({
      clearancesMm: { xMm: 5, yMm: 5, zMm: 5 },
      cargoes: [physicalCargo("cargo-a"), physicalCargo("cargo-b")],
      placements: [
        physicalPlacement("cargo-a", {
          positionMm: { xMm: 5, yMm: 5, zMm: 0 },
        }),
        physicalPlacement("cargo-b", {
          positionMm: { xMm: secondXmm, yMm: 5, zMm: 0 },
        }),
      ],
    });
    const reasons = [
      ...(pairReason === undefined ? [] : [pairReason]),
      pathReason("cargo-a"),
      pathReason("cargo-b"),
    ];

    expect(validatePlacementSet(project, "container-1")).toEqual({
      kind: "evaluated",
      containerId: "container-1",
      status: expectedStatus,
      reasons,
    });
  });

  it("recognizes exact support contact as a clearance exception", () => {
    const project = physicalProject({
      clearancesMm: { xMm: 5, yMm: 5, zMm: 5 },
      cargoes: [physicalCargo("cargo-a"), physicalCargo("cargo-b")],
      placements: [
        physicalPlacement("cargo-a", {
          positionMm: { xMm: 5, yMm: 5, zMm: 0 },
        }),
        physicalPlacement("cargo-b", {
          positionMm: { xMm: 5, yMm: 5, zMm: 10 },
        }),
      ],
    });

    expect(validatePlacementSet(project, "container-1")).toEqual({
      kind: "evaluated",
      containerId: "container-1",
      status: "unverified",
      reasons: [
        pathReason("cargo-a"),
        pathReason("cargo-b"),
        unverifiedCargoReason(
          "structure-stability-unverified",
          "cargo-b",
          ["cargo-a"],
        ),
      ],
    });
  });

  it("reports unsupported elevated cargo without candidates", () => {
    const project = physicalProject({
      clearancesMm: { xMm: 5, yMm: 5, zMm: 5 },
      cargoes: [physicalCargo("cargo-b")],
      placements: [
        physicalPlacement("cargo-b", {
          positionMm: { xMm: 5, yMm: 5, zMm: 10 },
        }),
      ],
    });

    expect(validatePlacementSet(project, "container-1")).toEqual({
      kind: "evaluated",
      containerId: "container-1",
      status: "invalid",
      reasons: [
        pathReason("cargo-b"),
        invalidCargoReason("support-not-full", "cargo-b"),
      ],
    });
  });

  it("keeps pair clearance and support failures for a permission-false contact", () => {
    const project = physicalProject({
      clearancesMm: { xMm: 5, yMm: 5, zMm: 5 },
      cargoes: [
        physicalCargo("cargo-a", { canSupportCargo: false }),
        physicalCargo("cargo-b"),
      ],
      placements: [
        physicalPlacement("cargo-a", {
          positionMm: { xMm: 5, yMm: 5, zMm: 0 },
        }),
        physicalPlacement("cargo-b", {
          positionMm: { xMm: 5, yMm: 5, zMm: 10 },
        }),
      ],
    });

    expect(validatePlacementSet(project, "container-1")).toEqual({
      kind: "evaluated",
      containerId: "container-1",
      status: "invalid",
      reasons: [
        invalidCargoReason("axis-clearance-not-met", "cargo-a", ["cargo-b"]),
        pathReason("cargo-a"),
        pathReason("cargo-b"),
        invalidCargoReason("support-not-full", "cargo-b"),
      ],
    });
  });

  it("reports pair clearance and incomplete support for one permitted partial support", () => {
    const cargoUpper = physicalCargo("cargo-u", {
      dimensionsMm: { lengthMm: 20, widthMm: 10, heightMm: 10 },
    });
    const project = physicalProject({
      clearancesMm: { xMm: 0, yMm: 0, zMm: 5 },
      cargoes: [physicalCargo("cargo-a"), cargoUpper],
      placements: [
        physicalPlacement("cargo-a"),
        physicalPlacement("cargo-u", {
          positionMm: { xMm: 0, yMm: 0, zMm: 10 },
        }),
      ],
    });

    expect(validatePlacementSet(project, "container-1")).toEqual({
      kind: "evaluated",
      containerId: "container-1",
      status: "invalid",
      reasons: [
        invalidCargoReason("axis-clearance-not-met", "cargo-a", ["cargo-u"]),
        pathReason("cargo-a"),
        pathReason("cargo-u"),
        invalidCargoReason("support-not-full", "cargo-u", ["cargo-a"]),
      ],
    });
  });

  it("grants pair clearance exceptions only when two halves fully support the target", () => {
    const cargoUpper = physicalCargo("cargo-u", {
      dimensionsMm: { lengthMm: 20, widthMm: 10, heightMm: 10 },
    });
    const project = physicalProject({
      clearancesMm: { xMm: 0, yMm: 0, zMm: 5 },
      cargoes: [physicalCargo("cargo-a"), physicalCargo("cargo-b"), cargoUpper],
      placements: [
        physicalPlacement("cargo-a"),
        physicalPlacement("cargo-b", {
          positionMm: { xMm: 10, yMm: 0, zMm: 0 },
        }),
        physicalPlacement("cargo-u", {
          positionMm: { xMm: 0, yMm: 0, zMm: 10 },
        }),
      ],
    });

    expect(validatePlacementSet(project, "container-1")).toEqual({
      kind: "evaluated",
      containerId: "container-1",
      status: "unverified",
      reasons: [
        pathReason("cargo-a"),
        pathReason("cargo-b"),
        pathReason("cargo-u"),
        unverifiedCargoReason(
          "structure-stability-unverified",
          "cargo-u",
          ["cargo-a", "cargo-b"],
        ),
      ],
    });
  });

  it("keeps pair clearance and support failures for a representative 1 mm union hole", () => {
    const cargoUpper = physicalCargo("cargo-u", {
      dimensionsMm: { lengthMm: 21, widthMm: 10, heightMm: 10 },
    });
    const project = physicalProject({
      clearancesMm: { xMm: 0, yMm: 0, zMm: 5 },
      cargoes: [physicalCargo("cargo-a"), physicalCargo("cargo-b"), cargoUpper],
      placements: [
        physicalPlacement("cargo-a"),
        physicalPlacement("cargo-b", {
          positionMm: { xMm: 11, yMm: 0, zMm: 0 },
        }),
        physicalPlacement("cargo-u", {
          positionMm: { xMm: 0, yMm: 0, zMm: 10 },
        }),
      ],
    });

    expect(validatePlacementSet(project, "container-1")).toEqual({
      kind: "evaluated",
      containerId: "container-1",
      status: "invalid",
      reasons: [
        invalidCargoReason("axis-clearance-not-met", "cargo-a", ["cargo-u"]),
        invalidCargoReason("axis-clearance-not-met", "cargo-b", ["cargo-u"]),
        pathReason("cargo-a"),
        pathReason("cargo-b"),
        pathReason("cargo-u"),
        invalidCargoReason("support-not-full", "cargo-u", [
          "cargo-a",
          "cargo-b",
        ]),
      ],
    });
  });

  it("uses a 1 mm below-floor cargo as exact geometric support without cascades", () => {
    const project = physicalProject({
      cargoes: [physicalCargo("cargo-a"), physicalCargo("cargo-b")],
      placements: [
        physicalPlacement("cargo-a", {
          positionMm: { xMm: 0, yMm: 0, zMm: -1 },
        }),
        physicalPlacement("cargo-b", {
          positionMm: { xMm: 0, yMm: 0, zMm: 9 },
        }),
      ],
    });

    expect(validatePlacementSet(project, "container-1")).toEqual({
      kind: "evaluated",
      containerId: "container-1",
      status: "invalid",
      reasons: [
        invalidCargoReason("floor-penetration", "cargo-a"),
        pathReason("cargo-a"),
        pathReason("cargo-b"),
        unverifiedCargoReason(
          "structure-stability-unverified",
          "cargo-b",
          ["cargo-a"],
        ),
      ],
    });
  });

  it("retains structure warning for a raw-outside elevated target that is fully supported", () => {
    const cargoUpper = physicalCargo("cargo-u", {
      dimensionsMm: { lengthMm: 10, widthMm: 10, heightMm: 91 },
    });
    const project = physicalProject({
      cargoes: [physicalCargo("cargo-a"), cargoUpper],
      placements: [
        physicalPlacement("cargo-a"),
        physicalPlacement("cargo-u", {
          positionMm: { xMm: 0, yMm: 0, zMm: 10 },
        }),
      ],
    });

    expect(validatePlacementSet(project, "container-1")).toEqual({
      kind: "evaluated",
      containerId: "container-1",
      status: "invalid",
      reasons: [
        invalidCargoReason("outside-container", "cargo-u"),
        pathReason("cargo-a"),
        pathReason("cargo-u"),
        unverifiedCargoReason(
          "structure-stability-unverified",
          "cargo-u",
          ["cargo-a"],
        ),
      ],
    });
  });

  it("suppresses support failure for a raw-outside elevated target without support", () => {
    const cargoUpper = physicalCargo("cargo-u", {
      dimensionsMm: { lengthMm: 10, widthMm: 10, heightMm: 91 },
    });
    const project = physicalProject({
      cargoes: [cargoUpper],
      placements: [
        physicalPlacement("cargo-u", {
          positionMm: { xMm: 0, yMm: 0, zMm: 10 },
        }),
      ],
    });

    expect(validatePlacementSet(project, "container-1")).toEqual({
      kind: "evaluated",
      containerId: "container-1",
      status: "invalid",
      reasons: [
        invalidCargoReason("outside-container", "cargo-u"),
        pathReason("cargo-u"),
      ],
    });
  });

  it("uses any allowed orientation for opening fit, not only the placement orientation", () => {
    const cargo = physicalCargo("cargo-a", {
      dimensionsMm: { lengthMm: 20, widthMm: 35, heightMm: 10 },
      allowedOrientations: ["LWH", "WLH"],
    });
    const project = physicalProject({
      cargoes: [cargo],
      containers: [
        physicalContainer("container-1", {
          openingMm: { widthMm: 25, heightMm: 100 },
        }),
      ],
      placements: [physicalPlacement("cargo-a", { orientation: "LWH" })],
    });

    expect(validatePlacementSet(project, "container-1")).toEqual({
      kind: "evaluated",
      containerId: "container-1",
      status: "unverified",
      reasons: [pathReason("cargo-a")],
    });
  });

  it("returns opening invalid without a path warning when no allowed orientation fits", () => {
    const cargo = physicalCargo("cargo-a", {
      dimensionsMm: { lengthMm: 20, widthMm: 35, heightMm: 10 },
      allowedOrientations: ["LWH", "WLH"],
    });
    const project = physicalProject({
      cargoes: [cargo],
      containers: [
        physicalContainer("container-1", {
          openingMm: { widthMm: 19, heightMm: 100 },
        }),
      ],
      placements: [physicalPlacement("cargo-a")],
    });

    expect(validatePlacementSet(project, "container-1")).toEqual({
      kind: "evaluated",
      containerId: "container-1",
      status: "invalid",
      reasons: [invalidCargoReason("opening-no-fitting-orientation", "cargo-a")],
    });
  });

  it("accepts payload equality using only selected-container placements", () => {
    const cargoes = [
      physicalCargo("cargo-a", { massGrams: 100 }),
      physicalCargo("cargo-b", { massGrams: 100 }),
      physicalCargo("cargo-c", { massGrams: 50_000 }),
    ];
    const project = physicalProject({
      cargoes,
      containers: [
        physicalContainer("container-1", { payloadCapacityGrams: 200 }),
        physicalContainer("container-2", { payloadCapacityGrams: 100_000 }),
      ],
      placements: [
        physicalPlacement("cargo-a"),
        physicalPlacement("cargo-b", {
          positionMm: { xMm: 20, yMm: 0, zMm: 0 },
        }),
        physicalPlacement("cargo-c", { containerId: "container-2" }),
      ],
    });

    expect(validatePlacementSet(project, "container-1")).toEqual({
      kind: "evaluated",
      containerId: "container-1",
      status: "unverified",
      reasons: [pathReason("cargo-a"), pathReason("cargo-b")],
    });
  });

  it("reports payload over capacity after per-cargo reasons", () => {
    const project = physicalProject({
      cargoes: [
        physicalCargo("cargo-a", { massGrams: 100 }),
        physicalCargo("cargo-b", { massGrams: 100 }),
      ],
      containers: [
        physicalContainer("container-1", { payloadCapacityGrams: 199 }),
      ],
      placements: [
        physicalPlacement("cargo-a"),
        physicalPlacement("cargo-b", {
          positionMm: { xMm: 20, yMm: 0, zMm: 0 },
        }),
      ],
    });

    expect(validatePlacementSet(project, "container-1")).toEqual({
      kind: "evaluated",
      containerId: "container-1",
      status: "invalid",
      reasons: [
        pathReason("cargo-a"),
        pathReason("cargo-b"),
        payloadExceededReason("container-1", ["cargo-a", "cargo-b"]),
      ],
    });
  });

  it("prioritizes 1 mm floor penetration while retaining independent opening, payload, and exact support diagnostics", () => {
    const project = physicalProject({
      cargoes: [
        physicalCargo("cargo-a", {
          dimensionsMm: { lengthMm: 20, widthMm: 20, heightMm: 10 },
          massGrams: 100,
        }),
        physicalCargo("cargo-b", {
          dimensionsMm: { lengthMm: 10, widthMm: 10, heightMm: 10 },
          massGrams: 100,
        }),
      ],
      containers: [
        physicalContainer("container-1", {
          openingMm: { widthMm: 15, heightMm: 100 },
          payloadCapacityGrams: 199,
        }),
      ],
      placements: [
        physicalPlacement("cargo-a", {
          positionMm: { xMm: 5, yMm: 5, zMm: -1 },
        }),
        physicalPlacement("cargo-b", {
          positionMm: { xMm: 5, yMm: 5, zMm: 9 },
        }),
      ],
    });
    const original = structuredClone(project);

    expect(validatePlacementSet(project, "container-1")).toEqual({
      kind: "evaluated",
      containerId: "container-1",
      status: "invalid",
      reasons: [
        invalidCargoReason("floor-penetration", "cargo-a"),
        invalidCargoReason("opening-no-fitting-orientation", "cargo-a"),
        pathReason("cargo-b"),
        unverifiedCargoReason(
          "structure-stability-unverified",
          "cargo-b",
          ["cargo-a"],
        ),
        payloadExceededReason("container-1", ["cargo-a", "cargo-b"]),
      ],
    });
    expect(project).toEqual(original);
  });

  it("returns deterministic deduplicated ordering without mutating input", () => {
    const project = physicalProject({
      cargoes: [physicalCargo("cargo-b"), physicalCargo("cargo-a")],
      placements: [
        physicalPlacement("cargo-b", {
          positionMm: { xMm: 9, yMm: 0, zMm: 0 },
        }),
        physicalPlacement("cargo-a"),
      ],
    });
    const original = structuredClone(project);
    const expected = {
      kind: "evaluated",
      containerId: "container-1",
      status: "invalid",
      reasons: [
        invalidCargoReason("positive-volume-overlap", "cargo-a", ["cargo-b"]),
        pathReason("cargo-a"),
        pathReason("cargo-b"),
      ],
    };

    expect(validatePlacementSet(project, "container-1")).toEqual(expected);
    expect(validatePlacementSet(project, "container-1")).toEqual(expected);
    expect(project).toEqual(original);
  });

  it.each([
    {
      label: "a fractional position",
      project: physicalProject({
        cargoes: [physicalCargo("cargo-a")],
        placements: [
          physicalPlacement("cargo-a", {
            positionMm: { xMm: 0.5, yMm: 0, zMm: 0 },
          }),
        ],
      }),
    },
    {
      label: "an unsafe position",
      project: physicalProject({
        cargoes: [physicalCargo("cargo-a")],
        placements: [
          physicalPlacement("cargo-a", {
            positionMm: {
              xMm: Number.MAX_SAFE_INTEGER + 1,
              yMm: 0,
              zMm: 0,
            },
          }),
        ],
      }),
    },
    {
      label: "an unsafe derived maximum",
      project: physicalProject({
        cargoes: [physicalCargo("cargo-a")],
        placements: [
          physicalPlacement("cargo-a", {
            positionMm: {
              xMm: Number.MAX_SAFE_INTEGER - 5,
              yMm: 0,
              zMm: 0,
            },
          }),
        ],
      }),
    },
    {
      label: "a nonpositive cargo dimension",
      project: physicalProject({
        cargoes: [
          physicalCargo("cargo-a", {
            dimensionsMm: { lengthMm: 0, widthMm: 10, heightMm: 10 },
          }),
        ],
        placements: [physicalPlacement("cargo-a")],
      }),
    },
    {
      label: "overflowing clearance arithmetic",
      project: physicalProject({
        clearancesMm: {
          xMm: 0,
          yMm: Number.MAX_SAFE_INTEGER,
          zMm: 0,
        },
        cargoes: [physicalCargo("cargo-a")],
        placements: [physicalPlacement("cargo-a")],
      }),
    },
    {
      label: "an invalid opening dimension",
      project: physicalProject({
        cargoes: [physicalCargo("cargo-a")],
        containers: [
          physicalContainer("container-1", {
            openingMm: { widthMm: 0, heightMm: 100 },
          }),
        ],
        placements: [physicalPlacement("cargo-a")],
      }),
    },
  ])("returns geometry unavailable for $label without mutation", ({ project }) => {
    const original = structuredClone(project);

    expect(validatePlacementSet(project, "container-1")).toEqual({
      kind: "unavailable",
      containerId: "container-1",
      reason: {
        code: "physical.geometry-calculation-unavailable",
        target: { kind: "container", id: "container-1" },
      },
    });
    expect(project).toEqual(original);
  });

  it.each([
    {
      label: "negative capacity",
      project: physicalProject({
        cargoes: [physicalCargo("cargo-a")],
        containers: [
          physicalContainer("container-1", { payloadCapacityGrams: -1 }),
        ],
        placements: [physicalPlacement("cargo-a")],
      }),
    },
    {
      label: "negative selected mass",
      project: physicalProject({
        cargoes: [physicalCargo("cargo-a", { massGrams: -1 })],
        placements: [physicalPlacement("cargo-a")],
      }),
    },
    {
      label: "selected mass sum overflow",
      project: physicalProject({
        cargoes: [
          physicalCargo("cargo-a", { massGrams: Number.MAX_SAFE_INTEGER }),
          physicalCargo("cargo-b", { massGrams: 1 }),
        ],
        placements: [
          physicalPlacement("cargo-a"),
          physicalPlacement("cargo-b", {
            positionMm: { xMm: 20, yMm: 0, zMm: 0 },
          }),
        ],
      }),
    },
  ])("returns payload unavailable for $label", ({ project }) => {
    expect(validatePlacementSet(project, "container-1")).toEqual({
      kind: "unavailable",
      containerId: "container-1",
      reason: {
        code: "physical.payload-calculation-unavailable",
        target: { kind: "container", id: "container-1" },
      },
    });
  });
});
