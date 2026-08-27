import { describe, expect, it } from "vitest";

import type { Project } from "./model";
import { PROJECT_SCHEMA_VERSION } from "./model";
import {
  evaluatePayloadCapacity,
  safeIntegerSum,
  validateProjectReferences,
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
