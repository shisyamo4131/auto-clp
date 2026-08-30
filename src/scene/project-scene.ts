import {
  assessGeometricSupport,
  hasPositiveAreaOverlap,
  hasPositiveVolumeOverlap,
  orientedDimensions,
  placementBounds,
  type IdentifiedGeometricSupportCandidateMm,
} from "../domain/geometry";
import type {
  Cargo,
  Container,
  Orientation,
  OrientedDimensionsMm,
  Placement,
  PositionMm,
  Project,
} from "../domain/model";

export const MM_TO_SCENE_UNIT = 0.001;
export const STAGING_GAP_MM = 100;

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

const X_AXIS_QUARTER_TURN_ORIENTATION = {
  LWH: "LHW",
  LHW: "LWH",
  WLH: "WHL",
  WHL: "WLH",
  HLW: "HWL",
  HWL: "HLW",
} as const satisfies Record<Orientation, Orientation>;

/** Returns the dimensionally distinct partner after a 90-degree X-axis turn. */
export function xAxisQuarterTurnOrientation(
  orientation: Orientation,
): Orientation {
  return X_AXIS_QUARTER_TURN_ORIENTATION[orientation];
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

interface SceneCargoProjectionBase {
  readonly cargoId: string;
  readonly name: string;
  readonly center: SceneVector3;
  readonly dimensions: SceneVector3;
  readonly orientation: Orientation;
  readonly positionMm: PositionMm;
}

export interface ScenePlacedCargoProjection extends SceneCargoProjectionBase {
  readonly kind: "placed";
}

export interface SceneStagedCargoProjection extends SceneCargoProjectionBase {
  readonly kind: "staged";
}

export interface SceneStagingOverride {
  readonly orientation: Orientation;
  readonly positionMm: PositionMm;
}

export function stagedCargoOverlapsContainerFloor(
  cargo: Cargo,
  positionMm: PositionMm,
  orientation: Orientation,
  container: Container,
): boolean {
  const dimensions = orientedDimensions(cargo, orientation);
  return hasPositiveAreaOverlap(
    {
      min: positionMm,
      max: {
        xMm: positionMm.xMm + dimensions.xMm,
        yMm: positionMm.yMm + dimensions.yMm,
      },
    },
    {
      min: { xMm: 0, yMm: 0 },
      max: {
        xMm: container.internalDimensionsMm.lengthMm,
        yMm: container.internalDimensionsMm.widthMm,
      },
    },
  );
}

export type SceneCargoProjection =
  | ScenePlacedCargoProjection
  | SceneStagedCargoProjection;

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

export function domainPositionDeltaToScene(
  start: PositionMm,
  end: PositionMm,
): SceneVector3 {
  return {
    x: (end.xMm - start.xMm) * MM_TO_SCENE_UNIT,
    y: (end.zMm - start.zMm) * MM_TO_SCENE_UNIT,
    z: -(end.yMm - start.yMm) * MM_TO_SCENE_UNIT,
  };
}

export type SupportSnapDisposition =
  | "outside"
  | "floor"
  | "single-support"
  | "support-conditions-unverified"
  | "invalid-overlap";

export interface SupportSnapResult {
  readonly disposition: SupportSnapDisposition;
  readonly positionMm: PositionMm;
  readonly supporterIds: readonly string[];
}

function positiveOverlapAreaMm2(
  first: ReturnType<typeof placementBounds>,
  second: ReturnType<typeof placementBounds>,
): number {
  const overlapX = Math.max(
    0,
    Math.min(first.max.xMm, second.max.xMm) -
      Math.max(first.min.xMm, second.min.xMm),
  );
  const overlapY = Math.max(
    0,
    Math.min(first.max.yMm, second.max.yMm) -
      Math.max(first.min.yMm, second.min.yMm),
  );
  return overlapX * overlapY;
}

/**
 * Resolves one quantized fine-pointer drag against the floor and eligible cargo
 * top faces. A containing single support clamps X/Y to its usable range. A
 * smaller or multi-surface support only snaps Z and remains freely repairable.
 */
export function resolveSupportSnapPosition(
  project: Project,
  containerId: string,
  cargoId: string,
  orientation: Orientation,
  rawPositionMm: PositionMm,
): SupportSnapResult | undefined {
  const cargo = project.cargoes.find((candidate) => candidate.id === cargoId);
  const container = project.containers.find(
    (candidate) => candidate.id === containerId,
  );
  if (cargo === undefined || container === undefined) return undefined;

  const rawBounds = placementBounds(cargo, {
    orientation,
    positionMm: rawPositionMm,
  });
  if (
    !hasPositiveAreaOverlap(
      {
        min: { xMm: rawBounds.min.xMm, yMm: rawBounds.min.yMm },
        max: { xMm: rawBounds.max.xMm, yMm: rawBounds.max.yMm },
      },
      {
        min: { xMm: 0, yMm: 0 },
        max: {
          xMm: container.internalDimensionsMm.lengthMm,
          yMm: container.internalDimensionsMm.widthMm,
        },
      },
    )
  ) {
    return { disposition: "outside", positionMm: rawPositionMm, supporterIds: [] };
  }

  const placedCandidates = project.placements
    .filter(
      (placement) =>
        placement.containerId === containerId && placement.cargoId !== cargoId,
    )
    .flatMap((placement) => {
      const candidateCargo = project.cargoes.find(
        (candidate) => candidate.id === placement.cargoId,
      );
      return candidateCargo === undefined
        ? []
        : [
            {
              cargo: candidateCargo,
              bounds: placementBounds(candidateCargo, placement),
            },
          ];
    });
  const overlappingEligible = placedCandidates.filter(
    (candidate) =>
      candidate.cargo.canSupportCargo &&
      candidate.bounds.min.zMm >= 0 &&
      positiveOverlapAreaMm2(candidate.bounds, rawBounds) > 0,
  );

  let snappedPositionMm: PositionMm;
  if (overlappingEligible.length === 0) {
    snappedPositionMm = { ...rawPositionMm, zMm: 0 };
  } else {
    const highestTop = Math.max(
      ...overlappingEligible.map((candidate) => candidate.bounds.max.zMm),
    );
    const highestCandidates = overlappingEligible.filter(
      (candidate) => candidate.bounds.max.zMm === highestTop,
    );
    const dimensions = orientedDimensions(cargo, orientation);
    const containingCandidates = highestCandidates
      .filter(
        (candidate) =>
          candidate.bounds.max.xMm - candidate.bounds.min.xMm >= dimensions.xMm &&
          candidate.bounds.max.yMm - candidate.bounds.min.yMm >= dimensions.yMm,
      )
      .sort((first, second) => {
        const overlapDifference =
          positiveOverlapAreaMm2(second.bounds, rawBounds) -
          positiveOverlapAreaMm2(first.bounds, rawBounds);
        if (overlapDifference !== 0) return overlapDifference;
        return first.cargo.id < second.cargo.id
          ? -1
          : first.cargo.id > second.cargo.id
            ? 1
            : 0;
      });
    const containing = containingCandidates[0];
    snappedPositionMm =
      containing === undefined
        ? { ...rawPositionMm, zMm: highestTop }
        : {
            xMm: Math.min(
              Math.max(rawPositionMm.xMm, containing.bounds.min.xMm),
              containing.bounds.max.xMm - dimensions.xMm,
            ),
            yMm: Math.min(
              Math.max(rawPositionMm.yMm, containing.bounds.min.yMm),
              containing.bounds.max.yMm - dimensions.yMm,
            ),
            zMm: highestTop,
          };
  }

  const snappedBounds = placementBounds(cargo, {
    orientation,
    positionMm: snappedPositionMm,
  });
  if (
    placedCandidates.some((candidate) =>
      hasPositiveVolumeOverlap(snappedBounds, candidate.bounds),
    )
  ) {
    return {
      disposition: "invalid-overlap",
      positionMm: snappedPositionMm,
      supporterIds: [],
    };
  }
  if (snappedPositionMm.zMm === 0) {
    return { disposition: "floor", positionMm: snappedPositionMm, supporterIds: [] };
  }

  const assessment = assessGeometricSupport(
    snappedBounds,
    placedCandidates.map<IdentifiedGeometricSupportCandidateMm>((candidate) => ({
      id: candidate.cargo.id,
      bounds: candidate.bounds,
      canSupportCargo: candidate.cargo.canSupportCargo,
    })),
  );
  return {
    disposition:
      assessment.kind === "single"
        ? "single-support"
        : assessment.kind === "conditional"
          ? "support-conditions-unverified"
          : "invalid-overlap",
    positionMm: snappedPositionMm,
    supporterIds: assessment.contactIds,
  };
}

export type PlacedFloorDragDisposition = "no-op" | "update" | "delete";
export type FloorFootprintDisposition = "outside" | "partial" | "xy-contained";

/**
 * Classifies an oriented cargo footprint against the raw container floor.
 * Z is intentionally excluded: vertical invalidity remains a physical-validation concern.
 */
export function classifyFloorFootprint(
  cargo: Pick<Cargo, "dimensionsMm">,
  container: Pick<Container, "internalDimensionsMm">,
  orientation: Orientation,
  positionMm: PositionMm,
): FloorFootprintDisposition {
  const bounds = placementBounds(cargo, { orientation, positionMm });
  const contained =
    bounds.min.xMm >= 0 &&
    bounds.max.xMm <= container.internalDimensionsMm.lengthMm &&
    bounds.min.yMm >= 0 &&
    bounds.max.yMm <= container.internalDimensionsMm.widthMm;
  if (contained) return "xy-contained";

  return hasPositiveAreaOverlap(
    {
      min: { xMm: bounds.min.xMm, yMm: bounds.min.yMm },
      max: { xMm: bounds.max.xMm, yMm: bounds.max.yMm },
    },
    {
      min: { xMm: 0, yMm: 0 },
      max: {
        xMm: container.internalDimensionsMm.lengthMm,
        yMm: container.internalDimensionsMm.widthMm,
      },
    },
  )
    ? "partial"
    : "outside";
}

/**
 * Classifies a quantized placed-cargo floor drag without changing Project state.
 * Only X/Y participate in the interaction boundary; Z is deliberately ignored.
 */
export function placedFloorDragDisposition(
  cargo: Pick<Cargo, "dimensionsMm">,
  container: Pick<Container, "internalDimensionsMm">,
  placement: Pick<Placement, "orientation" | "positionMm">,
  nextPositionMm: PositionMm,
): PlacedFloorDragDisposition {
  if (
    nextPositionMm.xMm === placement.positionMm.xMm &&
    nextPositionMm.yMm === placement.positionMm.yMm &&
    nextPositionMm.zMm === placement.positionMm.zMm
  ) {
    return "no-op";
  }

  return classifyFloorFootprint(
    cargo,
    container,
    placement.orientation,
    nextPositionMm,
  ) === "outside"
    ? "delete"
    : "update";
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

function stagedCargoesToScene(
  project: Project,
  container: Container,
  overrides: Readonly<Record<string, SceneStagingOverride>>,
): SceneStagedCargoProjection[] {
  const placedCargoIds = new Set(
    project.placements.map((placement) => placement.cargoId),
  );
  const staged = project.cargoes
    .filter((cargo) => !placedCargoIds.has(cargo.id))
    .map((cargo) => {
      const orientation = cargo.allowedOrientations[0]!;
      const override = overrides[cargo.id];
      const effectiveOrientation =
        override !== undefined && cargo.allowedOrientations.includes(override.orientation)
          ? override.orientation
          : orientation;
      return {
        cargo,
        dimensions: orientedDimensions(cargo, effectiveOrientation),
        orientation: effectiveOrientation,
        override,
      };
    });
  if (staged.length === 0) {
    return [];
  }

  const columnCount = Math.ceil(Math.sqrt(staged.length));
  const maxFootprintX = Math.max(
    ...staged.map(({ dimensions }) => dimensions.xMm),
  );
  const maxFootprintY = Math.max(
    ...staged.map(({ dimensions }) => dimensions.yMm),
  );
  const gridWidthY =
    columnCount * maxFootprintY + (columnCount - 1) * STAGING_GAP_MM;
  const gridStartY = Math.floor(
    (container.internalDimensionsMm.widthMm - gridWidthY) / 2,
  );

  return staged.map(({ cargo, dimensions, orientation, override }, index) => {
    const column = index % columnCount;
    const row = Math.floor(index / columnCount);
    const defaultPositionMm = {
      xMm:
        -STAGING_GAP_MM -
        (row + 1) * maxFootprintX -
        row * STAGING_GAP_MM,
      yMm:
        gridStartY + column * (maxFootprintY + STAGING_GAP_MM),
      zMm: 0,
    };
    const positionMm =
      override !== undefined &&
      !stagedCargoOverlapsContainerFloor(
        cargo,
        override.positionMm,
        orientation,
        container,
      )
        ? override.positionMm
        : defaultPositionMm;
    return {
      kind: "staged",
      cargoId: cargo.id,
      name: cargo.name,
      orientation,
      positionMm,
      center: centerFromBounds(positionMm, dimensions),
      dimensions: domainDimensionsToScene(dimensions),
    };
  });
}

export function projectContainerToScene(
  project: Project,
  containerId: string,
  stagingOverrides: Readonly<Record<string, SceneStagingOverride>> = {},
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
      kind: "placed",
      cargoId: cargo.id,
      name: cargo.name,
      orientation: placement.orientation,
      positionMm: placement.positionMm,
      center: centerFromBounds(bounds.min, bounds.dimensions),
      dimensions: domainDimensionsToScene(bounds.dimensions),
    });
  }

  cargoes.push(
    ...stagedCargoesToScene(
      project,
      container,
      stagingOverrides,
    ),
  );

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
