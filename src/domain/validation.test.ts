import { describe, expect, it } from "vitest";

import type { Project } from "./model";
import { PROJECT_SCHEMA_VERSION } from "./model";
import { safeIntegerSum, validateProjectReferences } from "./validation";

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
