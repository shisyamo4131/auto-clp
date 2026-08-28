import { placementBounds } from "../domain/geometry";
import type {
  Orientation,
  OrientedDimensionsMm,
  PositionMm,
  Project,
} from "../domain/model";

export const MM_TO_SCENE_UNIT = 0.001;

const FLOOR_QUARTER_TURN_ORIENTATION = {
  LWH: "WLH",
  WLH: "LWH",
  LHW: "HLW",
  HLW: "LHW",
  WHL: "HWL",
  HWL: "WHL",
} as const satisfies Record<Orientation, Orientation>;

/** Returns the one 90-degree floor-plane partner for a canonical orientation. */
export function floorQuarterTurnOrientation(
  orientation: Orientation,
): Orientation {
  return FLOOR_QUARTER_TURN_ORIENTATION[orientation];
}

export interface SceneVector3 {
  readonly x: number;
  readonly y: number;
  readonly z: number;
}

export interface SceneOpeningFrame {
  readonly center: SceneVector3;
  readonly width: number;
  readonly height: number;
}

export interface SceneContainerProjection {
  readonly id: string;
  readonly name: string;
  readonly center: SceneVector3;
  readonly dimensions: SceneVector3;
  readonly opening: SceneOpeningFrame;
}

export interface SceneCargoProjection {
  readonly cargoId: string;
  readonly name: string;
  readonly center: SceneVector3;
  readonly dimensions: SceneVector3;
}

export interface ProjectSceneProjection {
  readonly container: SceneContainerProjection;
  readonly cargoes: readonly SceneCargoProjection[];
}

export interface SceneProjectionBounds {
  readonly min: SceneVector3;
  readonly max: SceneVector3;
  readonly center: SceneVector3;
  readonly radius: number;
}

export function sceneBoundsReachRadius(
  origin: SceneVector3,
  bounds: SceneProjectionBounds,
): number {
  return (
    Math.hypot(
      bounds.center.x - origin.x,
      bounds.center.y - origin.y,
      bounds.center.z - origin.z,
    ) + bounds.radius
  );
}

export type ProjectSceneProjectionError =
  | {
      readonly code: "scene.container-not-found";
      readonly containerId: string;
    }
  | {
      readonly code: "scene.cargo-not-found";
      readonly containerId: string;
      readonly cargoId: string;
    };

export type ProjectSceneProjectionResult =
  | { readonly ok: true; readonly projection: ProjectSceneProjection }
  | { readonly ok: false; readonly error: ProjectSceneProjectionError };

function sceneBoxBounds(
  boxes: readonly {
    readonly center: SceneVector3;
    readonly dimensions: SceneVector3;
  }[],
): SceneProjectionBounds {
  let minX = Number.POSITIVE_INFINITY;
  let minY = Number.POSITIVE_INFINITY;
  let minZ = Number.POSITIVE_INFINITY;
  let maxX = Number.NEGATIVE_INFINITY;
  let maxY = Number.NEGATIVE_INFINITY;
  let maxZ = Number.NEGATIVE_INFINITY;

  for (const box of boxes) {
    const halfX = box.dimensions.x / 2;
    const halfY = box.dimensions.y / 2;
    const halfZ = box.dimensions.z / 2;
    minX = Math.min(minX, box.center.x - halfX);
    minY = Math.min(minY, box.center.y - halfY);
    minZ = Math.min(minZ, box.center.z - halfZ);
    maxX = Math.max(maxX, box.center.x + halfX);
    maxY = Math.max(maxY, box.center.y + halfY);
    maxZ = Math.max(maxZ, box.center.z + halfZ);
  }

  const center = {
    x: (minX + maxX) / 2,
    y: (minY + maxY) / 2,
    z: (minZ + maxZ) / 2,
  };

  return {
    min: { x: minX, y: minY, z: minZ },
    max: { x: maxX, y: maxY, z: maxZ },
    center,
    radius: Math.hypot(maxX - minX, maxY - minY, maxZ - minZ) / 2,
  };
}

/**
 * Returns bounds for restoring a useful container-centred camera view. Cargoes
 * are intentionally excluded because correction-in-progress placements can be
 * at the canonical coordinate extremes.
 */
export function sceneContainerBounds(
  projection: ProjectSceneProjection,
): SceneProjectionBounds {
  return sceneBoxBounds([projection.container]);
}

/** Returns the union used by callers that need every projected object. */
export function sceneProjectionBounds(
  projection: ProjectSceneProjection,
): SceneProjectionBounds {
  return sceneBoxBounds([projection.container, ...projection.cargoes]);
}

export function domainPointToScene(point: PositionMm): SceneVector3 {
  return {
    x: point.xMm * MM_TO_SCENE_UNIT,
    y: point.zMm * MM_TO_SCENE_UNIT,
    z: -point.yMm * MM_TO_SCENE_UNIT,
  };
}

export function domainDimensionsToScene(
  dimensions: OrientedDimensionsMm,
): SceneVector3 {
  return {
    x: dimensions.xMm * MM_TO_SCENE_UNIT,
    y: dimensions.zMm * MM_TO_SCENE_UNIT,
    z: dimensions.yMm * MM_TO_SCENE_UNIT,
  };
}

function roundHalfAwayFromZero(value: number): number {
  const rounded = value < 0 ? Math.ceil(value - 0.5) : Math.floor(value + 0.5);
  return Object.is(rounded, -0) ? 0 : rounded;
}

/**
 * Converts a floor-parallel scene preview delta back to a canonical placement.
 * The caller remains responsible for passing the returned value through the
 * application command boundary before changing Project state.
 */
export function sceneFloorDragPositionMm(
  start: PositionMm,
  deltaScene: Pick<SceneVector3, "x" | "z">,
): PositionMm {
  const normalizedStartZ = Object.is(start.zMm, -0) ? 0 : start.zMm;
  return {
    xMm: roundHalfAwayFromZero(
      start.xMm + deltaScene.x / MM_TO_SCENE_UNIT,
    ),
    yMm: roundHalfAwayFromZero(
      start.yMm - deltaScene.z / MM_TO_SCENE_UNIT,
    ),
    zMm: normalizedStartZ,
  };
}

function centerFromBounds(
  min: PositionMm,
  dimensions: OrientedDimensionsMm,
): SceneVector3 {
  return domainPointToScene({
    xMm: min.xMm + dimensions.xMm / 2,
    yMm: min.yMm + dimensions.yMm / 2,
    zMm: min.zMm + dimensions.zMm / 2,
  });
}

export function projectContainerToScene(
  project: Project,
  containerId: string,
): ProjectSceneProjectionResult {
  const container = project.containers.find((candidate) => candidate.id === containerId);
  if (container === undefined) {
    return {
      ok: false,
      error: { code: "scene.container-not-found", containerId },
    };
  }

  const containerDimensions: OrientedDimensionsMm = {
    xMm: container.internalDimensionsMm.lengthMm,
    yMm: container.internalDimensionsMm.widthMm,
    zMm: container.internalDimensionsMm.heightMm,
  };
  const cargoes: SceneCargoProjection[] = [];

  for (const placement of project.placements) {
    if (placement.containerId !== containerId) {
      continue;
    }

    const cargo = project.cargoes.find((candidate) => candidate.id === placement.cargoId);
    if (cargo === undefined) {
      return {
        ok: false,
        error: {
          code: "scene.cargo-not-found",
          containerId,
          cargoId: placement.cargoId,
        },
      };
    }

    const bounds = placementBounds(cargo, placement);
    cargoes.push({
      cargoId: cargo.id,
      name: cargo.name,
      center: centerFromBounds(bounds.min, bounds.dimensions),
      dimensions: domainDimensionsToScene(bounds.dimensions),
    });
  }

  return {
    ok: true,
    projection: {
      container: {
        id: container.id,
        name: container.name,
        center: centerFromBounds(
          { xMm: 0, yMm: 0, zMm: 0 },
          containerDimensions,
        ),
        dimensions: domainDimensionsToScene(containerDimensions),
        opening: {
          center: domainPointToScene({
            xMm: 0,
            yMm: container.internalDimensionsMm.widthMm / 2,
            zMm: container.openingMm.heightMm / 2,
          }),
          width: container.openingMm.widthMm * MM_TO_SCENE_UNIT,
          height: container.openingMm.heightMm * MM_TO_SCENE_UNIT,
        },
      },
      cargoes,
    },
  };
}
