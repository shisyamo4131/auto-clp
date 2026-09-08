import { describe, expect, it } from "vitest";

import { ORIENTATIONS, PROJECT_SCHEMA_VERSION, type Project } from "./model";
import {
  calculateCargoCenterOfGravity,
  exactRationalMmEqual,
  exactRationalMmToNumber,
  type ExactPointMm,
} from "./weight-balance";

function baseProject(): Project {
  return {
    schemaVersion: PROJECT_SCHEMA_VERSION,
    projectId: "weight-balance-test",
    name: "匿名重心試験CLP",
    clearancesMm: { xMm: 0, yMm: 0, zMm: 0 },
    cargoes: [],
    containers: [
      {
        id: "container-1",
        name: "匿名コンテナ",
        internalDimensionsMm: { lengthMm: 4_000, widthMm: 2_000, heightMm: 2_000 },
        openingMm: { widthMm: 2_000, heightMm: 2_000 },
        payloadCapacityGrams: 100_000_000,
      },
      {
        id: "container-2",
        name: "匿名別コンテナ",
        internalDimensionsMm: { lengthMm: 2_000, widthMm: 1_000, heightMm: 1_000 },
        openingMm: { widthMm: 1_000, heightMm: 1_000 },
        payloadCapacityGrams: 100_000_000,
      },
    ],
    placements: [],
  };
}

function expectPoint(
  point: ExactPointMm,
  expected: readonly [number, number, number],
): void {
  expect(exactRationalMmToNumber(point.xMm)).toBeCloseTo(expected[0], 12);
  expect(exactRationalMmToNumber(point.yMm)).toBeCloseTo(expected[1], 12);
  expect(exactRationalMmToNumber(point.zMm)).toBeCloseTo(expected[2], 12);
}

describe("cargo-only centre of gravity", () => {
  it("returns no-container and empty without leaving a stale cargo centre", () => {
    const project = baseProject();
    expect(calculateCargoCenterOfGravity(project, undefined)).toEqual({
      kind: "no-container",
    });
    expect(calculateCargoCenterOfGravity(project, "missing")).toEqual({
      kind: "no-container",
    });

    const empty = calculateCargoCenterOfGravity(project, "container-1");
    expect(empty.kind).toBe("empty");
    if (empty.kind === "empty") {
      expectPoint(empty.containerCenterMm, [2_000, 1_000, 1_000]);
      expect(empty).not.toHaveProperty("cargoCenterOfGravityMm");
    }
  });

  it("does not resolve a selected container above the canonical dimension limit", () => {
    const project = baseProject();
    const overLimit: Project = {
      ...project,
      containers: project.containers.map((container) =>
        container.id === "container-1"
          ? {
              ...container,
              internalDimensionsMm: {
                ...container.internalDimensionsMm,
                lengthMm: 100_001,
              },
            }
          : container,
      ),
    };

    expect(calculateCargoCenterOfGravity(overLimit, "container-1")).toEqual({
      kind: "no-container",
    });
  });

  it("matches the exact AC-06 coincident fixture using cargo mass only", () => {
    const project: Project = {
      ...baseProject(),
      cargoes: ["a", "b"].map((id) => ({
        id,
        name: `匿名積荷${id}`,
        dimensionsMm: { lengthMm: 1_000, widthMm: 1_000, heightMm: 1_000 },
        massGrams: 1_000_000,
        canSupportCargo: false,
        allowedOrientations: ["LWH"],
      })),
      placements: [
        {
          cargoId: "a",
          containerId: "container-1",
          positionMm: { xMm: 0, yMm: 500, zMm: 0 },
          orientation: "LWH",
        },
        {
          cargoId: "b",
          containerId: "container-1",
          positionMm: { xMm: 3_000, yMm: 500, zMm: 1_000 },
          orientation: "LWH",
        },
      ],
    };

    const result = calculateCargoCenterOfGravity(project, "container-1");
    expect(result.kind).toBe("available");
    if (result.kind === "available") {
      expect(result.totalCargoMassGrams).toBe(2_000_000n);
      expectPoint(result.cargoCenterOfGravityMm, [2_000, 1_000, 1_000]);
      expect(exactRationalMmEqual(
        result.containerCenterMm.xMm,
        result.cargoCenterOfGravityMm.xMm,
      )).toBe(true);
      expect(exactRationalMmEqual(
        result.containerCenterMm.yMm,
        result.cargoCenterOfGravityMm.yMm,
      )).toBe(true);
      expect(exactRationalMmEqual(
        result.containerCenterMm.zMm,
        result.cargoCenterOfGravityMm.zMm,
      )).toBe(true);
    }
  });

  it("preserves the approved odd, unequal, HWL, negative and permutation fixture", () => {
    const project: Project = {
      ...baseProject(),
      cargoes: [
        {
          id: "c",
          name: "匿名積荷C",
          dimensionsMm: { lengthMm: 1_001, widthMm: 501, heightMm: 301 },
          massGrams: 3,
          canSupportCargo: false,
          allowedOrientations: ["LWH"],
        },
        {
          id: "d",
          name: "匿名積荷D",
          dimensionsMm: { lengthMm: 701, widthMm: 401, heightMm: 201 },
          massGrams: 5,
          canSupportCargo: false,
          allowedOrientations: ["HWL"],
        },
      ],
      placements: [
        {
          cargoId: "c",
          containerId: "container-1",
          positionMm: { xMm: -1, yMm: 0, zMm: 1 },
          orientation: "LWH",
        },
        {
          cargoId: "d",
          containerId: "container-1",
          positionMm: { xMm: 1_000, yMm: -2, zMm: 3 },
          orientation: "HWL",
        },
      ],
    };
    const original = structuredClone(project);
    const result = calculateCargoCenterOfGravity(project, "container-1");
    const reversed = calculateCargoCenterOfGravity(
      { ...project, cargoes: [...project.cargoes].reverse(), placements: [...project.placements].reverse() },
      "container-1",
    );

    expect(result.kind).toBe("available");
    expect(reversed).toEqual(result);
    if (result.kind === "available") {
      expect(result.doubledMomentsGramMm).toEqual({
        x: 14_002n,
        y: 3_488n,
        z: 4_444n,
      });
      expectPoint(result.cargoCenterOfGravityMm, [875.125, 218, 277.75]);
    }
    expect(project).toEqual(original);
  });

  it.each(ORIENTATIONS)("applies %s orientation to the cargo centre", (orientation) => {
    const expectedDimensions = {
      LWH: [101, 203, 305],
      WLH: [203, 101, 305],
      LHW: [101, 305, 203],
      HLW: [305, 101, 203],
      WHL: [203, 305, 101],
      HWL: [305, 203, 101],
    } as const;
    const project: Project = {
      ...baseProject(),
      cargoes: [{
        id: "oriented",
        name: "匿名向き積荷",
        dimensionsMm: { lengthMm: 101, widthMm: 203, heightMm: 305 },
        massGrams: 1,
        canSupportCargo: false,
        allowedOrientations: ORIENTATIONS,
      }],
      placements: [{
        cargoId: "oriented",
        containerId: "container-1",
        positionMm: { xMm: 10, yMm: 20, zMm: 30 },
        orientation,
      }],
    };
    const result = calculateCargoCenterOfGravity(project, "container-1");
    expect(result.kind).toBe("available");
    if (result.kind === "available") {
      const dimensions = expectedDimensions[orientation];
      expectPoint(result.cargoCenterOfGravityMm, [
        10 + dimensions[0] / 2,
        20 + dimensions[1] / 2,
        30 + dimensions[2] / 2,
      ]);
    }
  });

  it("keeps 1,000 maximum-value moments exact beyond Number safe integer", () => {
    const cargoes = Array.from({ length: 1_000 }, (_, index) => ({
      id: `cargo-${index}`,
      name: `匿名上限積荷${index}`,
      dimensionsMm: { lengthMm: 100_000, widthMm: 100_000, heightMm: 100_000 },
      massGrams: 100_000_000,
      canSupportCargo: false,
      allowedOrientations: ["LWH"] as const,
    }));
    const placements = cargoes.map((cargo) => ({
      cargoId: cargo.id,
      containerId: "container-1",
      positionMm: { xMm: 1_000_000, yMm: 1_000_000, zMm: 1_000_000 },
      orientation: "LWH" as const,
    }));
    const result = calculateCargoCenterOfGravity(
      { ...baseProject(), cargoes, placements },
      "container-1",
    );

    expect(result.kind).toBe("available");
    if (result.kind === "available") {
      expect(result.totalCargoMassGrams).toBe(100_000_000_000n);
      expect(result.doubledMomentsGramMm).toEqual({
        x: 210_000_000_000_000_000n,
        y: 210_000_000_000_000_000n,
        z: 210_000_000_000_000_000n,
      });
      expectPoint(result.cargoCenterOfGravityMm, [1_050_000, 1_050_000, 1_050_000]);
    }
  });

  it.each([
    ["length above 100,000 mm", { dimension: 100_001 }],
    ["mass above 100,000,000 g", { mass: 100_000_001 }],
    ["coordinate above +1,000,000 mm", { coordinate: 1_000_001 }],
    ["coordinate below -1,000,000 mm", { coordinate: -1_000_001 }],
  ] as const)("returns unavailable for canonical %s", (_name, override) => {
    const project: Project = {
      ...baseProject(),
      cargoes: [{
        id: "over-limit",
        name: "匿名上限外積荷",
        dimensionsMm: {
          lengthMm: "dimension" in override ? override.dimension : 100_000,
          widthMm: 100_000,
          heightMm: 100_000,
        },
        massGrams: "mass" in override ? override.mass : 100_000_000,
        canSupportCargo: false,
        allowedOrientations: ["LWH"],
      }],
      placements: [{
        cargoId: "over-limit",
        containerId: "container-1",
        positionMm: {
          xMm: "coordinate" in override ? override.coordinate : 1_000_000,
          yMm: 1_000_000,
          zMm: 1_000_000,
        },
        orientation: "LWH",
      }],
    };

    expect(calculateCargoCenterOfGravity(project, "container-1")).toEqual({
      kind: "unavailable",
      containerCenterMm: {
        xMm: { numerator: 2_000n, denominator: 1n },
        yMm: { numerator: 1_000n, denominator: 1n },
        zMm: { numerator: 1_000n, denominator: 1n },
      },
    });
  });

  it("returns unavailable for 1,001 selected placements", () => {
    const cargoes = Array.from({ length: 1_001 }, (_, index) => ({
      id: `cargo-${index}`,
      name: `匿名件数上限外積荷${index}`,
      dimensionsMm: { lengthMm: 1, widthMm: 1, heightMm: 1 },
      massGrams: 1,
      canSupportCargo: false,
      allowedOrientations: ["LWH"] as const,
    }));
    const placements = cargoes.map((cargo) => ({
      cargoId: cargo.id,
      containerId: "container-1",
      positionMm: { xMm: 0, yMm: 0, zMm: 0 },
      orientation: "LWH" as const,
    }));

    const result = calculateCargoCenterOfGravity(
      { ...baseProject(), cargoes, placements },
      "container-1",
    );
    expect(result.kind).toBe("unavailable");
    expect(result).not.toHaveProperty("cargoCenterOfGravityMm");
  });

  it("includes physically invalid saved placements but excludes other containers", () => {
    const project: Project = {
      ...baseProject(),
      cargoes: [
        {
          id: "invalid-but-saved",
          name: "匿名境界外積荷",
          dimensionsMm: { lengthMm: 100, widthMm: 100, heightMm: 100 },
          massGrams: 10,
          canSupportCargo: false,
          allowedOrientations: ["LWH"],
        },
        {
          id: "other",
          name: "匿名別コンテナ積荷",
          dimensionsMm: { lengthMm: 100, widthMm: 100, heightMm: 100 },
          massGrams: 100_000,
          canSupportCargo: false,
          allowedOrientations: ["LWH"],
        },
      ],
      placements: [
        {
          cargoId: "invalid-but-saved",
          containerId: "container-1",
          positionMm: { xMm: -500, yMm: -400, zMm: -300 },
          orientation: "LWH",
        },
        {
          cargoId: "other",
          containerId: "container-2",
          positionMm: { xMm: 900, yMm: 800, zMm: 700 },
          orientation: "LWH",
        },
      ],
    };
    const result = calculateCargoCenterOfGravity(project, "container-1");
    expect(result.kind).toBe("available");
    if (result.kind === "available") {
      expect(result.totalCargoMassGrams).toBe(10n);
      expectPoint(result.cargoCenterOfGravityMm, [-450, -350, -250]);
    }
  });

  it.each([
    ["missing cargo", (project: Project) => ({
      ...project,
      placements: [{
        cargoId: "missing",
        containerId: "container-1",
        positionMm: { xMm: 0, yMm: 0, zMm: 0 },
        orientation: "LWH" as const,
      }],
    })],
    ["non-positive mass", (project: Project) => ({
      ...project,
      cargoes: [{
        id: "cargo",
        name: "匿名積荷",
        dimensionsMm: { lengthMm: 1, widthMm: 1, heightMm: 1 },
        massGrams: 0,
        canSupportCargo: false,
        allowedOrientations: ["LWH"] as const,
      }],
      placements: [{
        cargoId: "cargo",
        containerId: "container-1",
        positionMm: { xMm: 0, yMm: 0, zMm: 0 },
        orientation: "LWH" as const,
      }],
    })],
    ["duplicate placement", (project: Project) => {
      const withCargo = {
        ...project,
        cargoes: [{
          id: "cargo",
          name: "匿名積荷",
          dimensionsMm: { lengthMm: 1, widthMm: 1, heightMm: 1 },
          massGrams: 1,
          canSupportCargo: false,
          allowedOrientations: ["LWH"] as const,
        }],
      };
      const placement = {
        cargoId: "cargo",
        containerId: "container-1",
        positionMm: { xMm: 0, yMm: 0, zMm: 0 },
        orientation: "LWH" as const,
      };
      return { ...withCargo, placements: [placement, placement] };
    }],
  ] as const)("returns unavailable for %s without a stale cargo centre", (_name, mutate) => {
    const result = calculateCargoCenterOfGravity(mutate(baseProject()), "container-1");
    expect(result.kind).toBe("unavailable");
    if (result.kind === "unavailable") {
      expectPoint(result.containerCenterMm, [2_000, 1_000, 1_000]);
      expect(result).not.toHaveProperty("cargoCenterOfGravityMm");
    }
  });
});
