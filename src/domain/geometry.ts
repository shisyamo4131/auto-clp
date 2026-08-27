import type {
  Cargo,
  ClearancesMm,
  DimensionsMm,
  Orientation,
  OrientedDimensionsMm,
  Placement,
  PositionMm,
} from "./model";

export interface PlacementBoundsMm {
  readonly min: PositionMm;
  readonly dimensions: OrientedDimensionsMm;
  readonly max: PositionMm;
}

function hasPositiveAxisLengths(bounds: PlacementBoundsMm): boolean {
  return (
    bounds.min.xMm < bounds.max.xMm &&
    bounds.min.yMm < bounds.max.yMm &&
    bounds.min.zMm < bounds.max.zMm
  );
}

export function isPlacementWithinContainer(
  bounds: PlacementBoundsMm,
  internalDimensionsMm: DimensionsMm,
): boolean {
  return (
    hasPositiveAxisLengths(bounds) &&
    bounds.min.xMm >= 0 &&
    bounds.min.yMm >= 0 &&
    bounds.min.zMm >= 0 &&
    bounds.max.xMm <= internalDimensionsMm.lengthMm &&
    bounds.max.yMm <= internalDimensionsMm.widthMm &&
    bounds.max.zMm <= internalDimensionsMm.heightMm
  );
}

export function hasPositiveVolumeOverlap(
  first: PlacementBoundsMm,
  second: PlacementBoundsMm,
): boolean {
  return (
    hasPositiveAxisLengths(first) &&
    hasPositiveAxisLengths(second) &&
    first.min.xMm < second.max.xMm &&
    second.min.xMm < first.max.xMm &&
    first.min.yMm < second.max.yMm &&
    second.min.yMm < first.max.yMm &&
    first.min.zMm < second.max.zMm &&
    second.min.zMm < first.max.zMm
  );
}

export function isPlacementWithinContainerWithClearance(
  bounds: PlacementBoundsMm,
  internalDimensionsMm: DimensionsMm,
  clearancesMm: ClearancesMm,
): boolean {
  return (
    isPlacementWithinContainer(bounds, internalDimensionsMm) &&
    bounds.min.xMm >= clearancesMm.xMm &&
    bounds.max.xMm <= internalDimensionsMm.lengthMm - clearancesMm.xMm &&
    bounds.min.yMm >= clearancesMm.yMm &&
    bounds.max.yMm <= internalDimensionsMm.widthMm - clearancesMm.yMm &&
    bounds.min.zMm >= 0 &&
    bounds.max.zMm <= internalDimensionsMm.heightMm - clearancesMm.zMm
  );
}

function separationGapMm(
  firstMinMm: number,
  firstMaxMm: number,
  secondMinMm: number,
  secondMaxMm: number,
): number | undefined {
  if (firstMaxMm <= secondMinMm) {
    return secondMinMm - firstMaxMm;
  }

  if (secondMaxMm <= firstMinMm) {
    return firstMinMm - secondMaxMm;
  }

  return undefined;
}

export function hasRequiredAxisClearance(
  first: PlacementBoundsMm,
  second: PlacementBoundsMm,
  clearancesMm: ClearancesMm,
): boolean {
  if (
    !hasPositiveAxisLengths(first) ||
    !hasPositiveAxisLengths(second) ||
    hasPositiveVolumeOverlap(first, second)
  ) {
    return false;
  }

  const xGapMm = separationGapMm(
    first.min.xMm,
    first.max.xMm,
    second.min.xMm,
    second.max.xMm,
  );
  const yGapMm = separationGapMm(
    first.min.yMm,
    first.max.yMm,
    second.min.yMm,
    second.max.yMm,
  );
  const zGapMm = separationGapMm(
    first.min.zMm,
    first.max.zMm,
    second.min.zMm,
    second.max.zMm,
  );

  return (
    (xGapMm !== undefined && xGapMm >= clearancesMm.xMm) ||
    (yGapMm !== undefined && yGapMm >= clearancesMm.yMm) ||
    (zGapMm !== undefined && zGapMm >= clearancesMm.zMm)
  );
}

export function orientedDimensions(
  cargo: Pick<Cargo, "dimensionsMm">,
  orientation: Orientation,
): OrientedDimensionsMm {
  const { lengthMm, widthMm, heightMm } = cargo.dimensionsMm;

  switch (orientation) {
    case "LWH":
      return { xMm: lengthMm, yMm: widthMm, zMm: heightMm };
    case "WLH":
      return { xMm: widthMm, yMm: lengthMm, zMm: heightMm };
    case "LHW":
      return { xMm: lengthMm, yMm: heightMm, zMm: widthMm };
    case "HLW":
      return { xMm: heightMm, yMm: lengthMm, zMm: widthMm };
    case "WHL":
      return { xMm: widthMm, yMm: heightMm, zMm: lengthMm };
    case "HWL":
      return { xMm: heightMm, yMm: widthMm, zMm: lengthMm };
  }
}

export function placementBounds(
  cargo: Pick<Cargo, "dimensionsMm">,
  placement: Pick<Placement, "orientation" | "positionMm">,
): PlacementBoundsMm {
  const dimensions = orientedDimensions(cargo, placement.orientation);
  const min = { ...placement.positionMm };

  return {
    min,
    dimensions,
    max: {
      xMm: min.xMm + dimensions.xMm,
      yMm: min.yMm + dimensions.yMm,
      zMm: min.zMm + dimensions.zMm,
    },
  };
}
