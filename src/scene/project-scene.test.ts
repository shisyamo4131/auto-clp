import { describe, expect, it } from "vitest";

import { PROJECT_SCHEMA_VERSION, type Project } from "../domain/model";
import {
  domainDimensionsToScene,
  domainPointToScene,
  MM_TO_SCENE_UNIT,
  projectContainerToScene,
  sceneProjectionBounds,
  type ProjectSceneProjection,
  type SceneVector3,
} from "./project-scene";

function expectVectorClose(actual: SceneVector3, expected: SceneVector3): void {
  expect(actual.x).toBeCloseTo(expected.x, 12);
  expect(actual.y).toBeCloseTo(expected.y, 12);
  expect(actual.z).toBeCloseTo(expected.z, 12);
}

function projectFixture(): Project {
  return {
    schemaVersion: PROJECT_SCHEMA_VERSION,
    projectId: "project-scene-1",
    name: "匿名scene試験案件",
    clearancesMm: { xMm: 0, yMm: 0, zMm: 0 },
    cargoes: [
      {
        id: "cargo-1",
        name: "匿名奇数積荷",
        dimensionsMm: { lengthMm: 101, widthMm: 203, heightMm: 305 },
        massGrams: 1_000,
        canSupportCargo: false,
        allowedOrientations: ["LWH"],
      },
      {
        id: "cargo-2",
        name: "匿名別候補積荷",
        dimensionsMm: { lengthMm: 400, widthMm: 300, heightMm: 200 },
        massGrams: 2_000,
        canSupportCargo: false,
        allowedOrientations: ["LWH"],
      },
    ],
    containers: [
      {
        id: "container-1",
        name: "匿名奇数候補",
        internalDimensionsMm: { lengthMm: 1_001, widthMm: 1_000, heightMm: 1_003 },
        openingMm: { widthMm: 999, heightMm: 1_001 },
        payloadCapacityGrams: 10_000,
      },
      {
        id: "container-2",
        name: "匿名別候補",
        internalDimensionsMm: { lengthMm: 2_000, widthMm: 1_500, heightMm: 1_200 },
        openingMm: { widthMm: 1_400, heightMm: 1_100 },
        payloadCapacityGrams: 20_000,
      },
    ],
    placements: [
      {
        cargoId: "cargo-1",
        containerId: "container-1",
        positionMm: { xMm: -7, yMm: -11, zMm: -13 },
        orientation: "LWH",
      },
      {
        cargoId: "cargo-2",
        containerId: "container-2",
        positionMm: { xMm: 10, yMm: 20, zMm: 30 },
        orientation: "LWH",
      },
    ],
  };
}

function expectBoxWithinProjectionBounds(
  box: { readonly center: SceneVector3; readonly dimensions: SceneVector3 },
  bounds: ReturnType<typeof sceneProjectionBounds>,
): void {
  for (const axis of ["x", "y", "z"] as const) {
    const halfSize = box.dimensions[axis] / 2;
    expect(box.center[axis] - halfSize).toBeGreaterThanOrEqual(bounds.min[axis] - 1e-12);
    expect(box.center[axis] + halfSize).toBeLessThanOrEqual(bounds.max[axis] + 1e-12);
  }
}

describe("project scene coordinate adapter", () => {
  it("uses the approved scale and maps domain axes to Three.js axes", () => {
    expect(MM_TO_SCENE_UNIT).toBe(0.001);
    expect(domainPointToScene({ xMm: 1_000, yMm: 2_000, zMm: 3_000 })).toEqual({
      x: 1,
      y: 3,
      z: -2,
    });
    expect(domainDimensionsToScene({ xMm: 1_000, yMm: 2_000, zMm: 3_000 })).toEqual({
      x: 1,
      y: 3,
      z: 2,
    });
  });

  it("projects only the selected container and preserves odd half-millimetre centers", () => {
    const project = projectFixture();
    const original = structuredClone(project);

    const result = projectContainerToScene(project, "container-1");

    expect(result.ok).toBe(true);
    if (result.ok) {
      expect(result.projection.container.id).toBe("container-1");
      expect(result.projection.container.name).toBe("匿名奇数候補");
      expectVectorClose(result.projection.container.center, {
        x: 0.5005,
        y: 0.5015,
        z: -0.5,
      });
      expectVectorClose(result.projection.container.dimensions, {
        x: 1.001,
        y: 1.003,
        z: 1,
      });
      expectVectorClose(result.projection.container.opening.center, {
        x: 0,
        y: 0.5005,
        z: -0.5,
      });
      expect(result.projection.container.opening.width).toBeCloseTo(0.999, 12);
      expect(result.projection.container.opening.height).toBeCloseTo(1.001, 12);
      expect(result.projection.cargoes).toHaveLength(1);
      expect(result.projection.cargoes[0]).toMatchObject({
        cargoId: "cargo-1",
        name: "匿名奇数積荷",
      });
      expectVectorClose(result.projection.cargoes[0]!.center, {
        x: 0.0435,
        y: 0.1395,
        z: -0.0905,
      });
      expectVectorClose(result.projection.cargoes[0]!.dimensions, {
        x: 0.101,
        y: 0.305,
        z: 0.203,
      });
    }
    expect(project).toEqual(original);
    expect(project).not.toHaveProperty("scene");
    expect(project).not.toHaveProperty("camera");
    expect(project).not.toHaveProperty("selection");
  });

  it("returns an empty cargo projection when the selected container has no placements", () => {
    const project = projectFixture();
    const withoutPlacements: Project = { ...project, placements: [] };

    const result = projectContainerToScene(withoutPlacements, "container-1");

    expect(result.ok).toBe(true);
    if (result.ok) {
      expect(result.projection.cargoes).toEqual([]);
    }
  });

  it("returns a stable error when the selected container is missing", () => {
    const project = projectFixture();
    const original = structuredClone(project);

    expect(projectContainerToScene(project, "missing-container")).toEqual({
      ok: false,
      error: {
        code: "scene.container-not-found",
        containerId: "missing-container",
      },
    });
    expect(project).toEqual(original);
  });

  it("returns a stable error instead of skipping a missing cargo reference", () => {
    const project = projectFixture();
    const missingCargo: Project = {
      ...project,
      cargoes: project.cargoes.filter((cargo) => cargo.id !== "cargo-1"),
    };
    const original = structuredClone(missingCargo);

    expect(projectContainerToScene(missingCargo, "container-1")).toEqual({
      ok: false,
      error: {
        code: "scene.cargo-not-found",
        containerId: "container-1",
        cargoId: "cargo-1",
      },
    });
    expect(missingCargo).toEqual(original);
  });
});

describe("sceneProjectionBounds", () => {
  it("returns the selected container bounds when there are no projected cargoes", () => {
    const result = projectContainerToScene(
      { ...projectFixture(), placements: [] },
      "container-1",
    );
    expect(result.ok).toBe(true);
    if (!result.ok) {
      return;
    }
    const projection: ProjectSceneProjection = {
      ...result.projection,
      cargoes: [],
    };
    const original = structuredClone(projection);

    const bounds = sceneProjectionBounds(projection);

    expectVectorClose(bounds.min, { x: 0, y: 0, z: -1 });
    expectVectorClose(bounds.max, { x: 1.001, y: 1.003, z: 0 });
    expectVectorClose(bounds.center, { x: 0.5005, y: 0.5015, z: -0.5 });
    expect(bounds.radius).toBeCloseTo(Math.hypot(1.001, 1.003, 1) / 2, 12);
    expectBoxWithinProjectionBounds(projection.container, bounds);
    expect(projection).toEqual(original);
  });

  it("unions cargoes beyond every domain face at the schema coordinate extremes", () => {
    const placements = [
      ["negative-x", { xMm: -1_000_000, yMm: 0, zMm: 0 }],
      ["positive-x", { xMm: 1_000_000, yMm: 0, zMm: 0 }],
      ["negative-y", { xMm: 0, yMm: -1_000_000, zMm: 0 }],
      ["positive-y", { xMm: 0, yMm: 1_000_000, zMm: 0 }],
      ["negative-z", { xMm: 0, yMm: 0, zMm: -1_000_000 }],
      ["positive-z", { xMm: 0, yMm: 0, zMm: 1_000_000 }],
    ] as const;
    const base = projectFixture();
    const project: Project = {
      ...base,
      cargoes: placements.map(([id]) => ({
        id,
        name: `匿名極端座標積荷-${id}`,
        dimensionsMm: { lengthMm: 1, widthMm: 1, heightMm: 1 },
        massGrams: 1,
        canSupportCargo: false,
        allowedOrientations: ["LWH"],
      })),
      containers: [base.containers[0]!],
      placements: placements.map(([cargoId, positionMm]) => ({
        cargoId,
        containerId: "container-1",
        positionMm,
        orientation: "LWH",
      })),
    };
    const result = projectContainerToScene(project, "container-1");
    expect(result.ok).toBe(true);
    if (!result.ok) {
      return;
    }
    const original = structuredClone(result.projection);

    const bounds = sceneProjectionBounds(result.projection);

    expectVectorClose(bounds.min, { x: -1_000, y: -1_000, z: -1_000.001 });
    expectVectorClose(bounds.max, { x: 1_000.001, y: 1_000.001, z: 1_000 });
    expectVectorClose(bounds.center, { x: 0.0005, y: 0.0005, z: -0.0005 });
    expect(bounds.radius).toBeCloseTo(Math.hypot(2_000.001, 2_000.001, 2_000.001) / 2, 9);
    for (const box of [result.projection.container, ...result.projection.cargoes]) {
      expectBoxWithinProjectionBounds(box, bounds);
    }
    expect(result.projection).toEqual(original);
  });
});
