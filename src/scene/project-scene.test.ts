import { describe, expect, it } from "vitest";

import { updatePlacement } from "../application/project-command";
import { orientedDimensions } from "../domain/geometry";
import {
  ORIENTATIONS,
  PROJECT_SCHEMA_VERSION,
  type Orientation,
  type Project,
} from "../domain/model";
import {
  classifyFloorFootprint,
  compactSceneStagingOverrides,
  domainDimensionsToScene,
  domainPointToScene,
  encodeSceneStagingAnchor,
  floorQuarterTurnOrientation,
  MM_TO_SCENE_UNIT,
  placedFloorDragDisposition,
  projectContainerToScene,
  projectSceneStagingAnchor,
  projectWeightBalanceToScene,
  resolveKeyboardNudgePosition,
  resolveSupportSnapPosition,
  sceneBoundsReachRadius,
  sceneContainerBounds,
  sceneFloorDragPositionMm,
  sceneProjectionBounds,
  stagedCargoOverlapsContainerFloor,
  viewRelativeArrowDeltaMm,
  xAxisQuarterTurnOrientation,
  type ProjectSceneProjection,
  type SceneStagingAnchorSide,
  type SceneStagingOverride,
  type SceneVector3,
} from "./project-scene";
import { projectedViewportPointsCoincide } from "./ThreeViewport";
import { selectWorkspaceSceneProjection } from "./SceneWorkspace";

function expectVectorClose(actual: SceneVector3, expected: SceneVector3): void {
  expect(actual.x).toBeCloseTo(expected.x, 12);
  expect(actual.y).toBeCloseTo(expected.y, 12);
  expect(actual.z).toBeCloseTo(expected.z, 12);
}

function encodeAnchor(
  project: Project,
  cargoId: string,
  containerId: string,
  orientation: Orientation,
  positionMm: { readonly xMm: number; readonly yMm: number; readonly zMm: number },
  preferredSide?: SceneStagingAnchorSide,
): SceneStagingOverride {
  const cargo = project.cargoes.find(({ id }) => id === cargoId)!;
  const container = project.containers.find(({ id }) => id === containerId)!;
  const anchor = encodeSceneStagingAnchor(
    cargo,
    container,
    orientation,
    positionMm,
    preferredSide,
  );
  expect(anchor).toBeDefined();
  return anchor!;
}

function projectFixture(): Project {
  return {
    schemaVersion: PROJECT_SCHEMA_VERSION,
    projectId: "project-scene-1",
    name: "匿名scene試験CLP",
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
  it("classifies coincidence from screen projection rather than source point identity", () => {
    expect(projectedViewportPointsCoincide(
      { inViewport: true, leftPx: 100, topPx: 200 },
      { inViewport: true, leftPx: 100.005, topPx: 199.995 },
    )).toBe(true);
    expect(projectedViewportPointsCoincide(
      { inViewport: true, leftPx: 100, topPx: 200 },
      { inViewport: true, leftPx: 100.02, topPx: 200 },
    )).toBe(false);
    expect(projectedViewportPointsCoincide(
      { inViewport: true, leftPx: 100, topPx: 200 },
      { inViewport: false, leftPx: 100, topPx: 200 },
    )).toBe(false);
  });

  it.each([
    ["LWH", "WLH"],
    ["WLH", "LWH"],
    ["LHW", "HLW"],
    ["HLW", "LHW"],
    ["WHL", "HWL"],
    ["HWL", "WHL"],
  ] as const)("maps floor quarter turn %s to %s", (orientation, expected) => {
    expect(floorQuarterTurnOrientation(orientation)).toBe(expected);
    expect(floorQuarterTurnOrientation(expected)).toBe(orientation);
  });

  it.each([
    ["LWH", "LHW"],
    ["LHW", "LWH"],
    ["WLH", "WHL"],
    ["WHL", "WLH"],
    ["HLW", "HWL"],
    ["HWL", "HLW"],
  ] as const)("maps X-axis quarter turn %s to %s", (orientation, expected) => {
    expect(xAxisQuarterTurnOrientation(orientation)).toBe(expected);
    expect(xAxisQuarterTurnOrientation(expected)).toBe(orientation);
  });

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

  it("maps exact weight-balance centers through the approved scene axes", () => {
    const base = projectFixture();
    const project: Project = {
      ...base,
      cargoes: ["a", "b"].map((id) => ({
        id,
        name: `匿名重心積荷${id}`,
        dimensionsMm: { lengthMm: 1_000, widthMm: 1_000, heightMm: 1_000 },
        massGrams: 1_000_000,
        canSupportCargo: false,
        allowedOrientations: ["LWH"],
      })),
      containers: [{
        ...base.containers[0]!,
        internalDimensionsMm: { lengthMm: 4_000, widthMm: 2_000, heightMm: 2_000 },
      }],
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

    const result = projectWeightBalanceToScene(project, "container-1");
    expect(result).toEqual({
      kind: "available",
      containerCenter: { x: 2, y: 1, z: -1 },
      cargoCenterOfGravity: { x: 2, y: 1, z: -1 },
    });
  });

  it("keeps weight-balance empty and unavailable states separate", () => {
    const project = projectFixture();
    const empty = projectWeightBalanceToScene(
      { ...project, placements: [] },
      "container-1",
    );
    expect(empty.kind).toBe("empty");
    if (empty.kind === "empty") {
      expectVectorClose(empty.containerCenter, { x: 0.5005, y: 0.5015, z: -0.5 });
    }
    const unavailable = projectWeightBalanceToScene({
      ...project,
      placements: [{
        cargoId: "missing",
        containerId: "container-1",
        positionMm: { xMm: 0, yMm: 0, zMm: 0 },
        orientation: "LWH",
      }],
    }, "container-1");
    expect(unavailable.kind).toBe("unavailable");
    if (unavailable.kind === "unavailable") {
      expectVectorClose(unavailable.containerCenter, { x: 0.5005, y: 0.5015, z: -0.5 });
    }
    expect(projectWeightBalanceToScene(project, undefined)).toEqual({
      kind: "no-container",
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

  it("returns an empty cargo projection when the project has no cargoes", () => {
    const project = projectFixture();
    const emptyProject: Project = { ...project, cargoes: [], placements: [] };

    const result = projectContainerToScene(emptyProject, "container-1");

    expect(result.ok).toBe(true);
    if (result.ok) {
      expect(result.projection.cargoes).toEqual([]);
    }
  });

  it("projects globally unplaced cargoes in project order and excludes cargo placed in another container", () => {
    const base = projectFixture();
    const project: Project = {
      ...base,
      placements: [base.placements[1]!],
    };
    const original = structuredClone(project);

    const result = projectContainerToScene(project, "container-1");

    expect(result.ok).toBe(true);
    if (result.ok) {
      expect(result.projection.cargoes).toHaveLength(1);
      expect(result.projection.cargoes[0]).toMatchObject({
        kind: "staged",
        cargoId: "cargo-1",
        orientation: "LWH",
        positionMm: { zMm: 0 },
      });
      expect(result.projection.cargoes.some((cargo) => cargo.cargoId === "cargo-2")).toBe(
        false,
      );
    }
    expect(project).toEqual(original);
  });

  it("uses the first allowed orientation for all six canonical staged orientations", () => {
    const orientations: readonly Orientation[] = [
      "LWH",
      "LHW",
      "WLH",
      "WHL",
      "HLW",
      "HWL",
    ];
    const base = projectFixture();
    const project: Project = {
      ...base,
      cargoes: orientations.map((orientation, index) => ({
        id: `orientation-${index}`,
        name: `匿名向き積荷${index}`,
        dimensionsMm: { lengthMm: 101, widthMm: 203, heightMm: 305 },
        massGrams: 1,
        canSupportCargo: false,
        allowedOrientations: [orientation],
      })),
      containers: [base.containers[0]!],
      placements: [],
    };

    const result = projectContainerToScene(project, "container-1");

    expect(result.ok).toBe(true);
    if (result.ok) {
      expect(result.projection.cargoes.map((cargo) => cargo.cargoId)).toEqual(
        orientations.map((_, index) => `orientation-${index}`),
      );
      for (const [index, cargoProjection] of result.projection.cargoes.entries()) {
        const cargo = project.cargoes[index]!;
        const orientation = orientations[index]!;
        expect(cargoProjection).toMatchObject({
          kind: "staged",
          orientation,
          positionMm: { zMm: 0 },
        });
        expect(cargoProjection.dimensions).toEqual(
          domainDimensionsToScene(orientedDimensions(cargo, orientation)),
        );
      }
    }
  });

  it("lays staged cargoes outside negative X on a deterministic non-overlapping square grid", () => {
    const base = projectFixture();
    const project: Project = {
      ...base,
      cargoes: Array.from({ length: 7 }, (_, index) => ({
        id: `grid-cargo-${index}`,
        name: `匿名grid積荷${index}`,
        dimensionsMm: {
          lengthMm: 100 + index * 11,
          widthMm: 80 + index * 7,
          heightMm: 60 + index * 3,
        },
        massGrams: 1,
        canSupportCargo: false,
        allowedOrientations: [index % 2 === 0 ? "LWH" : "WLH"] as const,
      })),
      containers: [base.containers[0]!],
      placements: [],
    };
    const original = structuredClone(project);

    const result = projectContainerToScene(project, "container-1");

    expect(result.ok).toBe(true);
    if (result.ok) {
      const staged = result.projection.cargoes;
      expect(staged.map((cargo) => cargo.cargoId)).toEqual(
        project.cargoes.map((cargo) => cargo.id),
      );
      for (const cargo of staged) {
        expect(cargo.kind).toBe("staged");
        expect(cargo.positionMm.xMm).toBeLessThan(0);
        expect(cargo.positionMm.zMm).toBe(0);
      }
      for (let firstIndex = 0; firstIndex < staged.length; firstIndex += 1) {
        for (let secondIndex = firstIndex + 1; secondIndex < staged.length; secondIndex += 1) {
          const first = staged[firstIndex]!;
          const second = staged[secondIndex]!;
          const firstX = first.dimensions.x / MM_TO_SCENE_UNIT;
          const firstY = first.dimensions.z / MM_TO_SCENE_UNIT;
          const secondX = second.dimensions.x / MM_TO_SCENE_UNIT;
          const secondY = second.dimensions.z / MM_TO_SCENE_UNIT;
          const xGap = Math.max(
            second.positionMm.xMm - (first.positionMm.xMm + firstX),
            first.positionMm.xMm - (second.positionMm.xMm + secondX),
          );
          const yGap = Math.max(
            second.positionMm.yMm - (first.positionMm.yMm + firstY),
            first.positionMm.yMm - (second.positionMm.yMm + secondY),
          );
          expect(Math.max(xGap, yGap)).toBeGreaterThanOrEqual(100);
        }
      }
    }
    expect(project).toEqual(original);
  });

  it("keeps peer staging positions fixed when one cargo rotates on the floor", () => {
    const base = projectFixture();
    const project: Project = {
      ...base,
      cargoes: [
        {
          id: "cargo-b",
          name: "操作荷B",
          dimensionsMm: { lengthMm: 200, widthMm: 180, heightMm: 150 },
          massGrams: 1,
          canSupportCargo: false,
          allowedOrientations: ["LWH", "WLH"],
        },
        {
          id: "cargo-d",
          name: "操作荷D",
          dimensionsMm: { lengthMm: 260, widthMm: 220, heightMm: 120 },
          massGrams: 1,
          canSupportCargo: false,
          allowedOrientations: ORIENTATIONS,
        },
        {
          id: "cargo-f",
          name: "操作荷F",
          dimensionsMm: { lengthMm: 300, widthMm: 220, heightMm: 100 },
          massGrams: 1,
          canSupportCargo: false,
          allowedOrientations: ["LWH", "WLH"],
        },
        {
          id: "cargo-h",
          name: "操作荷H",
          dimensionsMm: { lengthMm: 180, widthMm: 180, heightMm: 120 },
          massGrams: 1,
          canSupportCargo: false,
          allowedOrientations: ["LWH", "WLH"],
        },
      ],
      containers: [{
        ...base.containers[0]!,
        internalDimensionsMm: { lengthMm: 1_800, widthMm: 900, heightMm: 900 },
      }],
      placements: [],
    };

    const before = projectContainerToScene(project, "container-1");
    expect(before.ok).toBe(true);
    if (!before.ok) return;
    const cargoFBefore = before.projection.cargoes.find(
      (cargo) => cargo.cargoId === "cargo-f",
    )!;

    const cargoFAnchor = encodeAnchor(
      project,
      "cargo-f",
      "container-1",
      "WLH",
      cargoFBefore.positionMm,
    );
    const after = projectContainerToScene(project, "container-1", {
      "cargo-f": cargoFAnchor,
    });

    expect(after.ok).toBe(true);
    if (!after.ok) return;
    for (const cargoId of ["cargo-b", "cargo-d", "cargo-h"]) {
      expect(
        after.projection.cargoes.find((cargo) => cargo.cargoId === cargoId)?.positionMm,
      ).toEqual(
        before.projection.cargoes.find((cargo) => cargo.cargoId === cargoId)?.positionMm,
      );
    }
    expect(
      after.projection.cargoes.find((cargo) => cargo.cargoId === "cargo-h")?.positionMm,
    ).toEqual({ xMm: -800, yMm: 500, zMm: 0 });
    expect(
      after.projection.cargoes.find((cargo) => cargo.cargoId === "cargo-f"),
    ).toMatchObject({
      orientation: "WLH",
      positionMm: cargoFBefore.positionMm,
    });
    expect(
      after.projection.cargoes.find((cargo) => cargo.cargoId === "cargo-f")?.dimensions,
    ).toEqual(domainDimensionsToScene(orientedDimensions(project.cargoes[2]!, "WLH")));
    expect(
      after.projection.cargoes.find((cargo) => cargo.cargoId === "cargo-f")?.dimensions,
    ).not.toEqual(cargoFBefore.dimensions);
  });

  it("projects a session-only staged position and allowed orientation override", () => {
    const base = projectFixture();
    const cargo = {
      ...base.cargoes[0]!,
      allowedOrientations: ["LWH", "LHW"] as const,
    };
    const project: Project = {
      ...base,
      cargoes: [cargo],
      containers: [base.containers[0]!],
      placements: [],
    };
    const original = structuredClone(project);

    const override = encodeAnchor(
      project,
      cargo.id,
      "container-1",
      "LHW",
      { xMm: 250, yMm: -900, zMm: 0 },
    );
    const result = projectContainerToScene(project, "container-1", {
      [cargo.id]: override,
    });

    expect(result.ok).toBe(true);
    if (result.ok) {
      expect(result.projection.cargoes[0]).toMatchObject({
        kind: "staged",
        orientation: "LHW",
        positionMm: { xMm: 250, yMm: -900, zMm: 0 },
      });
      expect(result.projection.cargoes[0]?.dimensions).toEqual(
        domainDimensionsToScene(orientedDimensions(cargo, "LHW")),
      );
    }
    expect(project).toEqual(original);
  });

  it("compacts remote staged positions while preserving their orientations", () => {
    const base = projectFixture();
    const cargoes = base.cargoes.map((cargo) => ({
      ...cargo,
      allowedOrientations: ["LWH", "WLH"] as const,
    }));
    const project: Project = {
      ...base,
      cargoes,
      containers: [base.containers[0]!],
      placements: [],
    };
    const original = structuredClone(project);
    const overrides = {
      [cargoes[0]!.id]: encodeAnchor(
        project,
        cargoes[0]!.id,
        "container-1",
        "WLH",
        { xMm: -100_000, yMm: 0, zMm: 0 },
      ),
      [cargoes[1]!.id]: encodeAnchor(
        project,
        cargoes[1]!.id,
        "container-1",
        "LWH",
        { xMm: -200_000, yMm: 0, zMm: 0 },
      ),
    };

    const compacted = compactSceneStagingOverrides(
      project,
      "container-1",
      overrides,
    );
    expect(compacted).toBeDefined();
    const result = projectContainerToScene(project, "container-1", compacted);
    expect(result.ok).toBe(true);
    if (result.ok) {
      expect(result.projection.cargoes.map((cargo) => cargo.orientation)).toEqual([
        "WLH",
        "LWH",
      ]);
      expect(
        Math.max(...result.projection.cargoes.map((cargo) => Math.abs(cargo.positionMm.xMm))),
      ).toBeLessThan(10_000);
    }
    expect(project).toEqual(original);
  });

  it.each([
    ["x-min", { xMm: -151, yMm: 40, zMm: 7 }],
    ["x-max", { xMm: 1_051, yMm: 40, zMm: 7 }],
    ["y-min", { xMm: 40, yMm: -253, zMm: 7 }],
    ["y-max", { xMm: 40, yMm: 1_050, zMm: 7 }],
  ] as const)("round-trips a %s side-relative staging anchor", (side, positionMm) => {
    const project = projectFixture();
    const cargo = project.cargoes[0]!;
    const container = project.containers[0]!;
    const anchor = encodeSceneStagingAnchor(
      cargo,
      container,
      "LWH",
      positionMm,
      side,
    );

    expect(anchor).toMatchObject({ side, orientation: "LWH", zMm: 7 });
    expect(projectSceneStagingAnchor(cargo, container, anchor!)).toEqual(positionMm);
  });

  it("uses fixed corner tie order unless the previous eligible side is supplied", () => {
    const project = projectFixture();
    const cargo = project.cargoes[0]!;
    const container = project.containers[0]!;
    const corner = { xMm: -101, yMm: -203, zMm: 0 };

    expect(encodeSceneStagingAnchor(cargo, container, "LWH", corner)?.side).toBe(
      "x-min",
    );
    expect(
      encodeSceneStagingAnchor(cargo, container, "LWH", corner, "y-min")?.side,
    ).toBe("y-min");
  });

  it.each([
    [-796, 1],
    [-798, -1],
  ])("rounds half millimetres away from zero for tangent delta %i", (delta, expectedY) => {
    const project = projectFixture();
    const cargo = project.cargoes[0]!;
    const container = project.containers[0]!;
    expect(
      projectSceneStagingAnchor(cargo, container, {
        orientation: "LWH",
        side: "x-min",
        gapMm: 0,
        tangentCenterDelta2Mm: delta,
        zMm: 0,
      }),
    ).toEqual({ xMm: -101, yMm: expectedY, zMm: 0 });
  });

  it("rejects unsafe, disallowed, and non-outside staging anchors", () => {
    const project = projectFixture();
    const cargo = project.cargoes[0]!;
    const container = project.containers[0]!;
    expect(
      encodeSceneStagingAnchor(cargo, container, "WLH", { xMm: -101, yMm: 0, zMm: 0 }),
    ).toBeUndefined();
    expect(
      encodeSceneStagingAnchor(cargo, container, "LWH", {
        xMm: Number.MAX_SAFE_INTEGER,
        yMm: 0,
        zMm: 0,
      }),
    ).toBeUndefined();
    expect(
      projectSceneStagingAnchor(cargo, container, {
        orientation: "LWH",
        side: "x-max",
        gapMm: Number.MAX_SAFE_INTEGER,
        tangentCenterDelta2Mm: 0,
        zMm: 0,
      }),
    ).toBeUndefined();
    expect(
      projectSceneStagingAnchor(cargo, container, {
        orientation: "LWH",
        side: "x-min",
        gapMm: -1,
        tangentCenterDelta2Mm: 0,
        zMm: 0,
      }),
    ).toBeUndefined();
  });

  it("preserves side, gap, tangent relation, Z and orientation across resized A-B-A", () => {
    const project = projectFixture();
    const cargo = { ...project.cargoes[0]!, allowedOrientations: ["LWH", "WLH"] as const };
    const containerA = project.containers[0]!;
    const containerB = {
      ...project.containers[1]!,
      internalDimensionsMm: { lengthMm: 4_000, widthMm: 2_001, heightMm: 2_400 },
    };
    const positionA = { xMm: 250, yMm: -253, zMm: 19 };
    const anchor = encodeSceneStagingAnchor(
      cargo,
      containerA,
      "LWH",
      positionA,
      "y-min",
    )!;
    const positionB = projectSceneStagingAnchor(cargo, containerB, anchor)!;

    expect(anchor).toMatchObject({ side: "y-min", gapMm: 50, zMm: 19, orientation: "LWH" });
    expect(positionB.yMm).toBe(-253);
    expect(projectSceneStagingAnchor(cargo, containerA, anchor)).toEqual(positionA);
    expect(stagedCargoOverlapsContainerFloor(cargo, positionB, "LWH", containerB)).toBe(false);
  });

  it.each([
    [{ xMm: -101, yMm: 0, zMm: 0 }, false],
    [{ xMm: -100, yMm: 0, zMm: 0 }, true],
    [{ xMm: 0, yMm: -203, zMm: 0 }, false],
    [{ xMm: 0, yMm: -202, zMm: 0 }, true],
  ] as const)(
    "classifies staged floor contact at %o as positive overlap=%s",
    (positionMm, expected) => {
      const project = projectFixture();
      expect(
        stagedCargoOverlapsContainerFloor(
          project.cargoes[0]!,
          positionMm,
          "LWH",
          project.containers[0]!,
        ),
      ).toBe(expected);
    },
  );

  it("detects Z-axis and X-axis staged rotations that would enter the container floor", () => {
    const container = projectFixture().containers[0]!;
    const zRotationCargo = {
      ...projectFixture().cargoes[0]!,
      dimensionsMm: { lengthMm: 500, widthMm: 1_400, heightMm: 300 },
      allowedOrientations: ORIENTATIONS,
    };
    expect(
      stagedCargoOverlapsContainerFloor(
        zRotationCargo,
        { xMm: -600, yMm: 0, zMm: 0 },
        "LWH",
        container,
      ),
    ).toBe(false);
    expect(
      stagedCargoOverlapsContainerFloor(
        zRotationCargo,
        { xMm: -600, yMm: 0, zMm: 0 },
        "WLH",
        container,
      ),
    ).toBe(true);

    const xRotationCargo = {
      ...zRotationCargo,
      dimensionsMm: { lengthMm: 500, widthMm: 400, heightMm: 1_400 },
    };
    expect(
      stagedCargoOverlapsContainerFloor(
        xRotationCargo,
        { xMm: 100, yMm: -500, zMm: 0 },
        "LWH",
        container,
      ),
    ).toBe(false);
    expect(
      stagedCargoOverlapsContainerFloor(
        xRotationCargo,
        { xMm: 100, yMm: -500, zMm: 0 },
        "LHW",
        container,
      ),
    ).toBe(true);
  });

  it("falls back to a deterministic fully outside grid for an invalid staged anchor", () => {
    const base = projectFixture();
    const cargo = {
      ...base.cargoes[0]!,
      dimensionsMm: { lengthMm: 500, widthMm: 1_400, heightMm: 300 },
      allowedOrientations: ["LWH", "WLH"] as const,
    };
    const project: Project = {
      ...base,
      cargoes: [cargo],
      containers: [base.containers[0]!],
      placements: [],
    };

    const result = projectContainerToScene(project, "container-1", {
      [cargo.id]: {
        orientation: "WLH",
        side: "x-min",
        gapMm: -1,
        tangentCenterDelta2Mm: 0,
        zMm: 0,
      },
    });

    expect(result.ok).toBe(true);
    if (result.ok) {
      const stagedCargo = result.projection.cargoes[0]!;
      expect(stagedCargo.orientation).toBe("WLH");
      expect(stagedCargo.positionMm).toEqual({ xMm: -1_500, yMm: -200, zMm: 0 });
      expect(
        stagedCargoOverlapsContainerFloor(
          cargo,
          stagedCargo.positionMm,
          stagedCargo.orientation,
          base.containers[0]!,
        ),
      ).toBe(false);
    }
  });

  it("revalidates an older staged position after cargo dimensions expand", () => {
    const base = projectFixture();
    const cargo = {
      ...base.cargoes[0]!,
      dimensionsMm: { lengthMm: 800, widthMm: 200, heightMm: 300 },
    };
    const project: Project = {
      ...base,
      cargoes: [cargo],
      containers: [base.containers[0]!],
      placements: [],
    };

    const oldAnchor = encodeSceneStagingAnchor(
      base.cargoes[0]!,
      base.containers[0]!,
      "LWH",
      { xMm: -600, yMm: 0, zMm: 0 },
    )!;
    const result = projectContainerToScene(project, "container-1", {
      [cargo.id]: oldAnchor,
    });

    expect(result.ok).toBe(true);
    if (result.ok) {
      expect(result.projection.cargoes[0]?.positionMm).toEqual({
        xMm: -1_299,
        yMm: 2,
        zMm: 0,
      });
    }
  });

  it("falls back to the first allowed staged orientation after cargo settings change", () => {
    const base = projectFixture();
    const project: Project = {
      ...base,
      cargoes: [base.cargoes[0]!],
      containers: [base.containers[0]!],
      placements: [],
    };

    const result = projectContainerToScene(project, "container-1", {
      "cargo-1": {
        orientation: "LHW",
        side: "x-min",
        gapMm: 399,
        tangentCenterDelta2Mm: -297,
        zMm: 0,
      },
    });

    expect(result.ok).toBe(true);
    if (result.ok) {
      expect(result.projection.cargoes[0]).toMatchObject({
        orientation: "LWH",
        positionMm: { xMm: -201, yMm: 398, zMm: 0 },
      });
    }
  });

  it.each([0, 1, 1_000])(
    "keeps %i staged cargo projections finite without changing Project",
    (cargoCount) => {
      const base = projectFixture();
      const project: Project = {
        ...base,
        cargoes: Array.from({ length: cargoCount }, (_, index) => ({
          id: `finite-cargo-${index}`,
          name: `匿名finite積荷${index}`,
          dimensionsMm: { lengthMm: 100_000, widthMm: 99_999, heightMm: 99_998 },
          massGrams: 1,
          canSupportCargo: false,
          allowedOrientations: ["WLH"],
        })),
        containers: [base.containers[0]!],
        placements: [],
      };
      const original = structuredClone(project);

      const result = projectContainerToScene(project, "container-1");

      expect(result.ok).toBe(true);
      if (result.ok) {
        expect(result.projection.cargoes).toHaveLength(cargoCount);
        for (const cargo of result.projection.cargoes) {
          expect([
            cargo.center.x,
            cargo.center.y,
            cargo.center.z,
            cargo.dimensions.x,
            cargo.dimensions.y,
            cargo.dimensions.z,
            cargo.positionMm.xMm,
            cargo.positionMm.yMm,
            cargo.positionMm.zMm,
          ].every(Number.isFinite)).toBe(true);
        }
      }
      expect(project).toEqual(original);
    },
  );

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
      placements: project.placements.map((placement) =>
        placement.cargoId === "cargo-2"
          ? { ...placement, containerId: "container-1" }
          : placement,
      ),
    };
    const original = structuredClone(missingCargo);

    const result = projectContainerToScene(missingCargo, "container-1");
    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.error).toEqual({
        code: "scene.cargo-not-found",
        containerId: "container-1",
        cargoId: "cargo-1",
      });
      expect(result.recoveryProjection).toMatchObject({
        container: { id: "container-1" },
        cargoes: [{ kind: "placed", cargoId: "cargo-2" }],
        weightBalance: { kind: "unavailable" },
      });
      expect(result.recoveryProjection?.weightBalance).not.toHaveProperty(
        "cargoCenterOfGravity",
      );
      expect(selectWorkspaceSceneProjection(result)).toBe(result.recoveryProjection);
    }
    expect(missingCargo).toEqual(original);
  });
});

describe("support-surface drag snapping", () => {
  function supportProject(options: {
    readonly supportLengthMm: number;
    readonly supportWidthMm: number;
    readonly canSupportCargo?: boolean;
  }): Project {
    return {
      schemaVersion: PROJECT_SCHEMA_VERSION,
      projectId: "support-snap-project",
      name: "匿名支持スナップ試験",
      clearancesMm: { xMm: 0, yMm: 0, zMm: 0 },
      cargoes: [
        {
          id: "support",
          name: "匿名支持台",
          dimensionsMm: {
            lengthMm: options.supportLengthMm,
            widthMm: options.supportWidthMm,
            heightMm: 500,
          },
          massGrams: 1_000,
          canSupportCargo: options.canSupportCargo ?? true,
          allowedOrientations: ["LWH"],
        },
        {
          id: "upper",
          name: "匿名上段荷",
          dimensionsMm: { lengthMm: 400, widthMm: 300, heightMm: 200 },
          massGrams: 1_000,
          canSupportCargo: false,
          allowedOrientations: ["LWH"],
        },
      ],
      containers: [
        {
          id: "container",
          name: "匿名候補",
          internalDimensionsMm: {
            lengthMm: 3_000,
            widthMm: 2_000,
            heightMm: 2_000,
          },
          openingMm: { widthMm: 2_000, heightMm: 2_000 },
          payloadCapacityGrams: 10_000,
        },
      ],
      placements: [
        {
          cargoId: "support",
          containerId: "container",
          positionMm: { xMm: 100, yMm: 100, zMm: 0 },
          orientation: "LWH",
        },
      ],
    };
  }

  it("clamps an upper cargo inside a containing support surface and snaps Z", () => {
    const result = resolveSupportSnapPosition(
      supportProject({ supportLengthMm: 1_000, supportWidthMm: 800 }),
      "container",
      "upper",
      "LWH",
      { xMm: 900, yMm: 800, zMm: 0 },
    );

    expect(result).toEqual({
      disposition: "single-support",
      faceSnaps: [],
      positionMm: { xMm: 700, yMm: 600, zMm: 500 },
      supporterIds: ["support"],
    });
  });

  it("keeps X/Y free and marks a smaller support surface conditional", () => {
    const project = supportProject({ supportLengthMm: 300, supportWidthMm: 200 });
    const result = resolveSupportSnapPosition(
      project,
      "container",
      "upper",
      "LWH",
      { xMm: 200, yMm: 150, zMm: 0 },
    );

    expect(result).toEqual({
      disposition: "support-conditions-unverified",
      faceSnaps: [],
      positionMm: { xMm: 200, yMm: 150, zMm: 500 },
      supporterIds: ["support"],
    });
  });

  it("does not snap to a permission-false top face and exposes the resulting overlap", () => {
    const result = resolveSupportSnapPosition(
      supportProject({
        supportLengthMm: 1_000,
        supportWidthMm: 800,
        canSupportCargo: false,
      }),
      "container",
      "upper",
      "LWH",
      { xMm: 200, yMm: 200, zMm: 0 },
    );

    expect(result).toEqual({
      disposition: "invalid-overlap",
      faceSnaps: [],
      positionMm: { xMm: 200, yMm: 200, zMm: 0 },
      supporterIds: [],
    });
  });

  it("snaps back to the floor away from supports and preserves an outside pose", () => {
    const project = supportProject({ supportLengthMm: 1_000, supportWidthMm: 800 });
    expect(
      resolveSupportSnapPosition(
        project,
        "container",
        "upper",
        "LWH",
        { xMm: 1_500, yMm: 1_000, zMm: 900 },
      ),
    ).toEqual({
      disposition: "floor",
      faceSnaps: [],
      positionMm: { xMm: 1_500, yMm: 1_000, zMm: 0 },
      supporterIds: [],
    });
    expect(
      resolveSupportSnapPosition(
        project,
        "container",
        "upper",
        "LWH",
        { xMm: -500, yMm: 100, zMm: 900 },
      ),
    ).toEqual({
      disposition: "outside",
      faceSnaps: [],
      positionMm: { xMm: -500, yMm: 100, zMm: 0 },
      supporterIds: [],
    });
  });

  it("excludes every recursively moving cargo from support and collision candidates", () => {
    const base = supportProject({ supportLengthMm: 1_000, supportWidthMm: 800 });
    const project: Project = {
      ...base,
      cargoes: base.cargoes.map((cargo) =>
        cargo.id === "upper" ? { ...cargo, canSupportCargo: true } : cargo,
      ),
      placements: [
        ...base.placements,
        {
          cargoId: "upper",
          containerId: "container",
          positionMm: { xMm: 100, yMm: 100, zMm: 500 },
          orientation: "LWH",
        },
      ],
    };

    expect(
      resolveSupportSnapPosition(
        project,
        "container",
        "support",
        "LWH",
        { xMm: 110, yMm: 100, zMm: 0 },
        ["support", "upper"],
      ),
    ).toEqual({
      disposition: "floor",
      faceSnaps: [],
      positionMm: { xMm: 110, yMm: 100, zMm: 0 },
      supporterIds: [],
    });
  });

  it("fits a floor cargo side to a neighboring cargo within 50 mm", () => {
    const project = supportProject({ supportLengthMm: 1_000, supportWidthMm: 800 });

    expect(
      resolveSupportSnapPosition(
        project,
        "container",
        "upper",
        "LWH",
        { xMm: 1_150, yMm: 200, zMm: 900 },
      ),
    ).toEqual({
      disposition: "floor",
      faceSnaps: [{ axis: "x", kind: "cargo", cargoId: "support" }],
      positionMm: { xMm: 1_100, yMm: 200, zMm: 0 },
      supporterIds: [],
    });
  });

  it("does not fit a cargo side when the gap exceeds 50 mm", () => {
    const project = supportProject({ supportLengthMm: 1_000, supportWidthMm: 800 });

    expect(
      resolveSupportSnapPosition(
        project,
        "container",
        "upper",
        "LWH",
        { xMm: 1_151, yMm: 200, zMm: 900 },
      ),
    ).toEqual({
      disposition: "floor",
      faceSnaps: [],
      positionMm: { xMm: 1_151, yMm: 200, zMm: 0 },
      supporterIds: [],
    });
  });

  it("fits cargo sides on a shared support top without treating the support as a side", () => {
    const base = supportProject({ supportLengthMm: 1_000, supportWidthMm: 800 });
    const neighbor = {
      ...base.cargoes[1]!,
      id: "neighbor",
      name: "匿名上面隣接荷",
      dimensionsMm: { lengthMm: 200, widthMm: 300, heightMm: 200 },
    };
    const project: Project = {
      ...base,
      cargoes: [...base.cargoes, neighbor],
      placements: [
        ...base.placements,
        {
          cargoId: "neighbor",
          containerId: "container",
          positionMm: { xMm: 100, yMm: 100, zMm: 500 },
          orientation: "LWH",
        },
      ],
    };

    expect(
      resolveSupportSnapPosition(
        project,
        "container",
        "upper",
        "LWH",
        { xMm: 315, yMm: 100, zMm: 0 },
      ),
    ).toEqual({
      disposition: "single-support",
      faceSnaps: [{ axis: "x", kind: "cargo", cargoId: "neighbor" }],
      positionMm: { xMm: 300, yMm: 100, zMm: 500 },
      supporterIds: ["support"],
    });
  });

  it.each([
    [
      "x-min",
      { xMm: 50, yMm: 1_500, zMm: 900 },
      { xMm: 0, yMm: 1_500, zMm: 0 },
    ],
    [
      "x-max",
      { xMm: 2_550, yMm: 1_500, zMm: 900 },
      { xMm: 2_600, yMm: 1_500, zMm: 0 },
    ],
    [
      "y-min",
      { xMm: 1_500, yMm: 50, zMm: 900 },
      { xMm: 1_500, yMm: 0, zMm: 0 },
    ],
    [
      "y-max",
      { xMm: 1_500, yMm: 1_650, zMm: 900 },
      { xMm: 1_500, yMm: 1_700, zMm: 0 },
    ],
  ] as const)("fits to the %s container inner wall at 50 mm", (wall, raw, snapped) => {
    const project = supportProject({ supportLengthMm: 1_000, supportWidthMm: 800 });

    expect(
      resolveSupportSnapPosition(
        project,
        "container",
        "upper",
        "LWH",
        raw,
      ),
    ).toEqual({
      disposition: "floor",
      faceSnaps: [{
        axis: wall.startsWith("x") ? "x" : "y",
        kind: "container-wall",
        wall,
      }],
      positionMm: snapped,
      supporterIds: [],
    });
  });

  it("does not fit to a container wall beyond 50 mm or when face snap is disabled", () => {
    const project = supportProject({ supportLengthMm: 1_000, supportWidthMm: 800 });

    expect(
      resolveSupportSnapPosition(
        project,
        "container",
        "upper",
        "LWH",
        { xMm: 51, yMm: 1_500, zMm: 900 },
      ),
    ).toEqual({
      disposition: "floor",
      faceSnaps: [],
      positionMm: { xMm: 51, yMm: 1_500, zMm: 0 },
      supporterIds: [],
    });
    expect(
      resolveSupportSnapPosition(
        project,
        "container",
        "upper",
        "LWH",
        { xMm: 45, yMm: 1_500, zMm: 900 },
        ["upper"],
        false,
      ),
    ).toEqual({
      disposition: "floor",
      faceSnaps: [],
      positionMm: { xMm: 45, yMm: 1_500, zMm: 0 },
      supporterIds: [],
    });
  });

  it("prefers an inner wall when an equally near cargo side is also eligible", () => {
    const base = supportProject({ supportLengthMm: 1_000, supportWidthMm: 800 });
    const neighbor = {
      ...base.cargoes[1]!,
      id: "wall-tie-neighbor",
      name: "匿名内壁同距離荷",
    };
    const project: Project = {
      ...base,
      cargoes: [...base.cargoes, neighbor],
      placements: [
        ...base.placements,
        {
          cargoId: neighbor.id,
          containerId: "container",
          positionMm: { xMm: 500, yMm: 1_200, zMm: 0 },
          orientation: "LWH",
        },
      ],
    };

    expect(
      resolveSupportSnapPosition(
        project,
        "container",
        "upper",
        "LWH",
        { xMm: 50, yMm: 1_200, zMm: 900 },
      ),
    ).toEqual({
      disposition: "floor",
      faceSnaps: [{ axis: "x", kind: "container-wall", wall: "x-min" }],
      positionMm: { xMm: 0, yMm: 1_200, zMm: 0 },
      supporterIds: [],
    });
  });

  it("fits both axes to a container inner corner in one validated position", () => {
    const project = supportProject({ supportLengthMm: 1_000, supportWidthMm: 800 });

    expect(
      resolveSupportSnapPosition(
        project,
        "container",
        "upper",
        "LWH",
        { xMm: 40, yMm: 1_660, zMm: 0 },
      ),
    ).toEqual({
      disposition: "floor",
      faceSnaps: [
        { axis: "x", kind: "container-wall", wall: "x-min" },
        { axis: "y", kind: "container-wall", wall: "y-max" },
      ],
      positionMm: { xMm: 0, yMm: 1_700, zMm: 0 },
      supporterIds: [],
    });
  });

  it("fits two axes against two different cargo sides", () => {
    const project: Project = {
      schemaVersion: PROJECT_SCHEMA_VERSION,
      projectId: "two-cargo-face-snap",
      name: "匿名二面フィット試験",
      clearancesMm: { xMm: 0, yMm: 0, zMm: 0 },
      cargoes: [
        {
          id: "moving",
          name: "移動荷",
          dimensionsMm: { lengthMm: 200, widthMm: 200, heightMm: 200 },
          massGrams: 1_000,
          canSupportCargo: false,
          allowedOrientations: ["LWH"],
        },
        {
          id: "x-target",
          name: "X面対象",
          dimensionsMm: { lengthMm: 300, widthMm: 300, heightMm: 200 },
          massGrams: 1_000,
          canSupportCargo: false,
          allowedOrientations: ["LWH"],
        },
        {
          id: "y-target",
          name: "Y面対象",
          dimensionsMm: { lengthMm: 300, widthMm: 300, heightMm: 200 },
          massGrams: 1_000,
          canSupportCargo: false,
          allowedOrientations: ["LWH"],
        },
      ],
      containers: [
        {
          id: "container",
          name: "匿名候補",
          internalDimensionsMm: {
            lengthMm: 2_000,
            widthMm: 2_000,
            heightMm: 2_000,
          },
          openingMm: { widthMm: 2_000, heightMm: 2_000 },
          payloadCapacityGrams: 10_000,
        },
      ],
      placements: [
        {
          cargoId: "x-target",
          containerId: "container",
          positionMm: { xMm: 0, yMm: 300, zMm: 0 },
          orientation: "LWH",
        },
        {
          cargoId: "y-target",
          containerId: "container",
          positionMm: { xMm: 300, yMm: 0, zMm: 0 },
          orientation: "LWH",
        },
      ],
    };

    expect(
      resolveSupportSnapPosition(
        project,
        "container",
        "moving",
        "LWH",
        { xMm: 340, yMm: 340, zMm: 0 },
      ),
    ).toEqual({
      disposition: "floor",
      faceSnaps: [
        { axis: "x", kind: "cargo", cargoId: "x-target" },
        { axis: "y", kind: "cargo", cargoId: "y-target" },
      ],
      positionMm: { xMm: 300, yMm: 300, zMm: 0 },
      supporterIds: [],
    });
  });

  it("falls back to one axis when only the combined two-face position collides", () => {
    const base: Project = {
      schemaVersion: PROJECT_SCHEMA_VERSION,
      projectId: "combined-face-collision",
      name: "匿名二面衝突試験",
      clearancesMm: { xMm: 0, yMm: 0, zMm: 0 },
      cargoes: [
        {
          id: "moving",
          name: "移動荷",
          dimensionsMm: { lengthMm: 200, widthMm: 200, heightMm: 200 },
          massGrams: 1_000,
          canSupportCargo: false,
          allowedOrientations: ["LWH"],
        },
        ...["x-target", "y-target"].map((id) => ({
          id,
          name: id,
          dimensionsMm: { lengthMm: 300, widthMm: 300, heightMm: 200 },
          massGrams: 1_000,
          canSupportCargo: false,
          allowedOrientations: ["LWH" as const],
        })),
        {
          id: "corner-blocker",
          name: "組合せ位置だけを塞ぐ荷",
          dimensionsMm: { lengthMm: 20, widthMm: 20, heightMm: 200 },
          massGrams: 1_000,
          canSupportCargo: false,
          allowedOrientations: ["LWH"],
        },
      ],
      containers: [
        {
          id: "container",
          name: "匿名候補",
          internalDimensionsMm: {
            lengthMm: 2_000,
            widthMm: 2_000,
            heightMm: 2_000,
          },
          openingMm: { widthMm: 2_000, heightMm: 2_000 },
          payloadCapacityGrams: 10_000,
        },
      ],
      placements: [
        {
          cargoId: "x-target",
          containerId: "container",
          positionMm: { xMm: 0, yMm: 300, zMm: 0 },
          orientation: "LWH",
        },
        {
          cargoId: "y-target",
          containerId: "container",
          positionMm: { xMm: 300, yMm: 0, zMm: 0 },
          orientation: "LWH",
        },
        {
          cargoId: "corner-blocker",
          containerId: "container",
          positionMm: { xMm: 310, yMm: 310, zMm: 0 },
          orientation: "LWH",
        },
      ],
    };

    expect(
      resolveSupportSnapPosition(
        base,
        "container",
        "moving",
        "LWH",
        { xMm: 340, yMm: 340, zMm: 0 },
      ),
    ).toEqual({
      disposition: "floor",
      faceSnaps: [{ axis: "x", kind: "cargo", cargoId: "x-target" }],
      positionMm: { xMm: 300, yMm: 340, zMm: 0 },
      supporterIds: [],
    });
  });

  it("retains a locked face through 75 mm and releases it beyond that distance", () => {
    const project = supportProject({ supportLengthMm: 1_000, supportWidthMm: 800 });
    const lockedFaceSnaps = [
      { axis: "x", kind: "container-wall", wall: "x-min" },
    ] as const;

    expect(
      resolveSupportSnapPosition(
        project,
        "container",
        "upper",
        "LWH",
        { xMm: 75, yMm: 1_500, zMm: 0 },
        ["upper"],
        true,
        { lockedFaceSnaps },
      )?.positionMm.xMm,
    ).toBe(0);
    expect(
      resolveSupportSnapPosition(
        project,
        "container",
        "upper",
        "LWH",
        { xMm: 76, yMm: 1_500, zMm: 0 },
        ["upper"],
        true,
        { lockedFaceSnaps },
      )?.positionMm.xMm,
    ).toBe(76);
  });

  it("keeps a floor-targeted shallow overlap beside cargo instead of stacking", () => {
    const project = supportProject({ supportLengthMm: 1_000, supportWidthMm: 800 });

    const result = resolveSupportSnapPosition(
      project,
      "container",
      "upper",
      "LWH",
      { xMm: 1_050, yMm: 200, zMm: 0 },
      ["upper"],
      true,
      { surfaceTarget: { kind: "floor" } },
    );

    expect(result).toMatchObject({
      disposition: "floor",
      positionMm: { xMm: 1_100, yMm: 200, zMm: 0 },
    });
  });

  it("acquires a pointed cargo top and retains it until the footprint leaves", () => {
    const project = supportProject({ supportLengthMm: 1_000, supportWidthMm: 800 });
    const acquired = resolveSupportSnapPosition(
      project,
      "container",
      "upper",
      "LWH",
      { xMm: 200, yMm: 200, zMm: 0 },
      ["upper"],
      true,
      { surfaceTarget: { kind: "cargo-top", cargoId: "support" } },
    );
    expect(acquired).toMatchObject({
      disposition: "single-support",
      positionMm: { zMm: 500 },
      surfaceTargetCargoId: "support",
    });

    const retained = resolveSupportSnapPosition(
      project,
      "container",
      "upper",
      "LWH",
      { xMm: 1_050, yMm: 200, zMm: 0 },
      ["upper"],
      true,
      {
        retainedSupportCargoId: "support",
        surfaceTarget: { kind: "floor" },
      },
    );
    expect(retained).toMatchObject({
      disposition: "single-support",
      positionMm: { zMm: 500 },
      surfaceTargetCargoId: "support",
    });

    const released = resolveSupportSnapPosition(
      project,
      "container",
      "upper",
      "LWH",
      { xMm: 1_100, yMm: 200, zMm: 0 },
      ["upper"],
      true,
      {
        retainedSupportCargoId: "support",
        surfaceTarget: { kind: "floor" },
      },
    );
    expect(released).toMatchObject({
      disposition: "floor",
      positionMm: { xMm: 1_100, yMm: 200, zMm: 0 },
    });
  });
});

describe("keyboard placement nudging", () => {
  it("allows container and support overhang while preserving Z", () => {
    const project: Project = {
      schemaVersion: PROJECT_SCHEMA_VERSION,
      projectId: "nudge-project",
      name: "匿名矢印調整試験",
      clearancesMm: { xMm: 0, yMm: 0, zMm: 0 },
      cargoes: [
        {
          id: "base",
          name: "匿名支持台",
          dimensionsMm: { lengthMm: 100, widthMm: 100, heightMm: 100 },
          massGrams: 1_000,
          canSupportCargo: true,
          allowedOrientations: ["LWH"],
        },
        {
          id: "upper",
          name: "匿名上段荷",
          dimensionsMm: { lengthMm: 50, widthMm: 50, heightMm: 50 },
          massGrams: 1_000,
          canSupportCargo: false,
          allowedOrientations: ["LWH"],
        },
      ],
      containers: [
        {
          id: "container",
          name: "匿名コンテナ",
          internalDimensionsMm: { lengthMm: 200, widthMm: 200, heightMm: 200 },
          openingMm: { widthMm: 200, heightMm: 200 },
          payloadCapacityGrams: 10_000,
        },
      ],
      placements: [
        {
          cargoId: "base",
          containerId: "container",
          positionMm: { xMm: 0, yMm: 0, zMm: 0 },
          orientation: "LWH",
        },
        {
          cargoId: "upper",
          containerId: "container",
          positionMm: { xMm: 0, yMm: 0, zMm: 100 },
          orientation: "LWH",
        },
      ],
    };

    expect(
      resolveKeyboardNudgePosition(
        project,
        "container",
        "upper",
        { xMm: 250, yMm: 0 },
        ["upper"],
      ),
    ).toEqual({
      disposition: "update",
      positionMm: { xMm: 250, yMm: 0, zMm: 100 },
    });
  });

  it("allows face contact and blocks positive-volume overlap with fixed cargo", () => {
    const base = projectFixture();
    const fixedCargo = {
      ...base.cargoes[0]!,
      id: "fixed",
      name: "匿名固定荷",
    };
    const project: Project = {
      ...base,
      cargoes: [...base.cargoes, fixedCargo],
      placements: [
        { ...base.placements[0]!, positionMm: { xMm: 0, yMm: 0, zMm: 0 } },
        {
          cargoId: "fixed",
          containerId: base.containers[0]!.id,
          positionMm: { xMm: 102, yMm: 0, zMm: 0 },
          orientation: "LWH",
        },
      ],
    };

    expect(
      resolveKeyboardNudgePosition(
        project,
        base.containers[0]!.id,
        base.cargoes[0]!.id,
        { xMm: 1, yMm: 0 },
      )?.disposition,
    ).toBe("update");
    expect(
      resolveKeyboardNudgePosition(
        project,
        base.containers[0]!.id,
        base.cargoes[0]!.id,
        { xMm: 2, yMm: 0 },
      )?.disposition,
    ).toBe("blocked");
  });

  it("maps arrows to one-millimetre container axes using their screen projection", () => {
    const axes = {
      x: { screenX: 0.8, screenY: 0.2 },
      y: { screenX: -0.3, screenY: 0.7 },
    };

    expect(viewRelativeArrowDeltaMm("ArrowRight", axes)).toEqual({ xMm: 1, yMm: 0 });
    expect(viewRelativeArrowDeltaMm("ArrowLeft", axes)).toEqual({ xMm: -1, yMm: 0 });
    expect(viewRelativeArrowDeltaMm("ArrowUp", axes)).toEqual({ xMm: 0, yMm: 1 });
    expect(viewRelativeArrowDeltaMm("ArrowDown", axes)).toEqual({ xMm: 0, yMm: -1 });
  });
});

describe("sceneFloorDragPositionMm", () => {
  it("maps scene floor deltas to the approved domain axis signs without changing Z", () => {
    const start = { xMm: 120, yMm: -340, zMm: 56 };
    const original = structuredClone(start);

    const moved = sceneFloorDragPositionMm(start, { x: 0.125, z: -0.075 });

    expect(moved).toEqual({ xMm: 245, yMm: -265, zMm: 56 });
    expect(start).toEqual(original);
  });

  it.each([
    [{ x: 0.0005, z: 0 }, { xMm: 1, yMm: 0, zMm: 7 }],
    [{ x: -0.0005, z: 0 }, { xMm: -1, yMm: 0, zMm: 7 }],
    [{ x: 0, z: 0.0005 }, { xMm: 0, yMm: -1, zMm: 7 }],
    [{ x: 0, z: -0.0005 }, { xMm: 0, yMm: 1, zMm: 7 }],
    [{ x: 0.000499, z: -0.000499 }, { xMm: 0, yMm: 0, zMm: 7 }],
    [{ x: 0.001499, z: -0.001499 }, { xMm: 1, yMm: 1, zMm: 7 }],
    [{ x: 0.0015, z: -0.0015 }, { xMm: 2, yMm: 2, zMm: 7 }],
  ])(
    "rounds each signed scene delta to the nearest millimetre with half away from zero",
    (deltaScene, expected) => {
      expect(
        sceneFloorDragPositionMm({ xMm: 0, yMm: 0, zMm: 7 }, deltaScene),
      ).toEqual(expected);
    },
  );

  it("normalizes negative zero and leaves a no-movement input unchanged", () => {
    const result = sceneFloorDragPositionMm(
      { xMm: -0, yMm: -0, zMm: -0 },
      { x: -0, z: 0 },
    );

    expect(result).toEqual({ xMm: 0, yMm: 0, zMm: 0 });
    expect(Object.is(result.xMm, -0)).toBe(false);
    expect(Object.is(result.yMm, -0)).toBe(false);
    expect(Object.is(result.zMm, -0)).toBe(false);
  });

  it("allows negative and container-outside coordinates without clamping", () => {
    expect(
      sceneFloorDragPositionMm(
        { xMm: -999_999, yMm: 999_999, zMm: -25 },
        { x: -0.002, z: -0.002 },
      ),
    ).toEqual({ xMm: -1_000_001, yMm: 1_000_001, zMm: -25 });
  });

  it("delegates canonical range rejection to the existing placement command", () => {
    const project = projectFixture();
    const original = structuredClone(project);
    const placement = project.placements[0]!;
    const draggedPosition = sceneFloorDragPositionMm(placement.positionMm, {
      x: -1_000,
      z: 0,
    });

    const result = updatePlacement(
      project,
      placement.cargoId,
      placement.containerId,
      {
        xMm: String(draggedPosition.xMm),
        yMm: String(draggedPosition.yMm),
        zMm: String(draggedPosition.zMm),
        orientation: placement.orientation,
      },
    );

    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.project).toBe(project);
      expect(result.issues).toEqual(
        expect.arrayContaining([
          expect.objectContaining({
            code: "input.mm-range",
            path: "/placements/0/positionMm/xMm",
          }),
        ]),
      );
    }
    expect(project).toEqual(original);
    expect(project.placements[0]?.positionMm.zMm).toBe(-13);
    expect(project.placements[0]?.orientation).toBe("LWH");
  });
});

describe("placedFloorDragDisposition", () => {
  const cargo = {
    dimensionsMm: { lengthMm: 300, widthMm: 200, heightMm: 100 },
  };
  const container = {
    internalDimensionsMm: { lengthMm: 1_000, widthMm: 800, heightMm: 600 },
  };

  it.each(ORIENTATIONS)(
    "keeps a quantized no-op for an already outside %s placement",
    (orientation) => {
      const positionMm = { xMm: 1_100, yMm: 900, zMm: -50 };
      expect(
        placedFloorDragDisposition(
          cargo,
          container,
          { orientation, positionMm },
          { ...positionMm },
        ),
      ).toBe("no-op");
    },
  );

  it.each(ORIENTATIONS)(
    "ignores floor penetration and ceiling overrun for %s",
    (orientation) => {
      const placement = {
        orientation,
        positionMm: { xMm: 100, yMm: 100, zMm: 0 },
      };
      expect(
        placedFloorDragDisposition(cargo, container, placement, {
          xMm: 101,
          yMm: 100,
          zMm: -1,
        }),
      ).toBe("update");
      expect(
        placedFloorDragDisposition(cargo, container, placement, {
          xMm: 101,
          yMm: 100,
          zMm: container.internalDimensionsMm.heightMm + 1,
        }),
      ).toBe("update");
    },
  );

  it.each(ORIENTATIONS)(
    "retains one-millimetre overlap and deletes face contact for every edge in %s",
    (orientation) => {
      const dimensions = orientedDimensions(cargo, orientation);
      const placement = {
        orientation,
        positionMm: { xMm: 100, yMm: 100, zMm: 50 },
      };
      const cases = [
        {
          overlap: { xMm: -dimensions.xMm + 1, yMm: 100, zMm: -999 },
          contact: { xMm: -dimensions.xMm, yMm: 100, zMm: -999 },
        },
        {
          overlap: { xMm: 999, yMm: 100, zMm: 999 },
          contact: { xMm: 1_000, yMm: 100, zMm: 999 },
        },
        {
          overlap: { xMm: 100, yMm: -dimensions.yMm + 1, zMm: -999 },
          contact: { xMm: 100, yMm: -dimensions.yMm, zMm: -999 },
        },
        {
          overlap: { xMm: 100, yMm: 799, zMm: 999 },
          contact: { xMm: 100, yMm: 800, zMm: 999 },
        },
      ] as const;

      for (const boundary of cases) {
        expect(
          placedFloorDragDisposition(cargo, container, placement, boundary.overlap),
        ).toBe("update");
        expect(
          placedFloorDragDisposition(cargo, container, placement, boundary.contact),
        ).toBe("delete");
      }
    },
  );
});

describe("classifyFloorFootprint", () => {
  const cargo = {
    dimensionsMm: { lengthMm: 300, widthMm: 200, heightMm: 100 },
  };
  const container = {
    internalDimensionsMm: { lengthMm: 1_000, widthMm: 800, heightMm: 600 },
  };

  it.each(ORIENTATIONS)(
    "distinguishes contained, one-millimetre overlap, and contact for %s",
    (orientation) => {
      const dimensions = orientedDimensions(cargo, orientation);
      expect(
        classifyFloorFootprint(cargo, container, orientation, {
          xMm: 0,
          yMm: 0,
          zMm: -999,
        }),
      ).toBe("xy-contained");
      expect(
        classifyFloorFootprint(cargo, container, orientation, {
          xMm: -dimensions.xMm + 1,
          yMm: 100,
          zMm: 999,
        }),
      ).toBe("partial");
      expect(
        classifyFloorFootprint(cargo, container, orientation, {
          xMm: -dimensions.xMm,
          yMm: 100,
          zMm: 0,
        }),
      ).toBe("outside");
      expect(
        classifyFloorFootprint(cargo, container, orientation, {
          xMm: -dimensions.xMm + 1,
          yMm: -dimensions.yMm,
          zMm: 0,
        }),
      ).toBe("outside");
    },
  );
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

  it("keeps container reset bounds unchanged while all-object bounds include staged cargo", () => {
    const base = projectFixture();
    const project: Project = {
      ...base,
      cargoes: [base.cargoes[0]!],
      containers: [base.containers[0]!],
      placements: [],
    };
    const result = projectContainerToScene(project, "container-1");
    expect(result.ok).toBe(true);
    if (!result.ok) {
      return;
    }

    const containerBounds = sceneContainerBounds(result.projection);
    const allBounds = sceneProjectionBounds(result.projection);

    expectVectorClose(containerBounds.min, { x: 0, y: 0, z: -1 });
    expectVectorClose(containerBounds.max, { x: 1.001, y: 1.003, z: 0 });
    expect(result.projection.cargoes[0]).toMatchObject({
      kind: "staged",
      positionMm: { xMm: -201, zMm: 0 },
    });
    expect(allBounds.min.x).toBeLessThan(0);
    expectBoxWithinProjectionBounds(result.projection.container, allBounds);
    expectBoxWithinProjectionBounds(result.projection.cargoes[0]!, allBounds);
    expect(sceneBoundsReachRadius(containerBounds.center, allBounds)).toBeGreaterThan(
      containerBounds.radius,
    );
  });

  it("keeps container-only camera bounds stable when cargo is at coordinate extremes", () => {
    const base = projectFixture();
    const project: Project = {
      ...base,
      cargoes: [
        {
          id: "remote-cargo",
          name: "匿名遠方積荷",
          dimensionsMm: { lengthMm: 1, widthMm: 1, heightMm: 1 },
          massGrams: 1,
          canSupportCargo: false,
          allowedOrientations: ["LWH"],
        },
      ],
      containers: [base.containers[0]!],
      placements: [
        {
          cargoId: "remote-cargo",
          containerId: "container-1",
          positionMm: {
            xMm: 1_000_000,
            yMm: -1_000_000,
            zMm: 1_000_000,
          },
          orientation: "LWH",
        },
      ],
    };
    const result = projectContainerToScene(project, "container-1");
    expect(result.ok).toBe(true);
    if (!result.ok) {
      return;
    }
    const original = structuredClone(result.projection);

    const containerBounds = sceneContainerBounds(result.projection);
    const allBounds = sceneProjectionBounds(result.projection);

    expectVectorClose(containerBounds.min, { x: 0, y: 0, z: -1 });
    expectVectorClose(containerBounds.max, { x: 1.001, y: 1.003, z: 0 });
    expectVectorClose(containerBounds.center, { x: 0.5005, y: 0.5015, z: -0.5 });
    expect(containerBounds.radius).toBeCloseTo(
      Math.hypot(1.001, 1.003, 1) / 2,
      12,
    );
    expect(allBounds.max.x).toBeGreaterThan(1_000);
    expect(allBounds.max.y).toBeGreaterThan(1_000);
    expect(allBounds.max.z).toBeGreaterThan(999);
    expect(sceneBoundsReachRadius(containerBounds.center, allBounds)).toBeGreaterThan(
      1_000,
    );
    expect(result.projection).toEqual(original);
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
