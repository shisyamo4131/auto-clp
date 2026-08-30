import type {
  Cargo,
  ClearancesMm,
  DimensionsMm,
  OpeningMm,
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

export interface GeometricSupportCandidateMm {
  readonly bounds: PlacementBoundsMm;
  readonly canSupportCargo: boolean;
}

export interface IdentifiedGeometricSupportCandidateMm
  extends GeometricSupportCandidateMm {
  readonly id: string;
}

export type GeometricSupportAssessment =
  | {
      readonly kind: "floor";
      readonly contactIds: readonly string[];
      readonly eligibleContactIds: readonly string[];
    }
  | {
      readonly kind: "single";
      readonly contactIds: readonly string[];
      readonly eligibleContactIds: readonly string[];
    }
  | {
      readonly kind: "conditional";
      readonly contactIds: readonly string[];
      readonly eligibleContactIds: readonly string[];
    }
  | {
      readonly kind: "invalid";
      readonly contactIds: readonly string[];
      readonly eligibleContactIds: readonly string[];
    };

export interface RectangleBoundsMm {
  readonly min: Pick<PositionMm, "xMm" | "yMm">;
  readonly max: Pick<PositionMm, "xMm" | "yMm">;
}

interface ClippedRectangleMm {
  readonly minXmm: number;
  readonly maxXmm: number;
  readonly minYmm: number;
  readonly maxYmm: number;
}

interface RectangleSweepEvent {
  readonly xMm: number;
  readonly minYIndex: number;
  readonly maxYIndex: number;
  readonly delta: 1 | -1;
}

function isValidRectangle(rectangle: RectangleBoundsMm): boolean {
  return (
    Number.isSafeInteger(rectangle.min.xMm) &&
    Number.isSafeInteger(rectangle.min.yMm) &&
    Number.isSafeInteger(rectangle.max.xMm) &&
    Number.isSafeInteger(rectangle.max.yMm) &&
    rectangle.min.xMm < rectangle.max.xMm &&
    rectangle.min.yMm < rectangle.max.yMm
  );
}

export function hasPositiveAreaOverlap(
  first: RectangleBoundsMm,
  second: RectangleBoundsMm,
): boolean {
  return (
    isValidRectangle(first) &&
    isValidRectangle(second) &&
    first.min.xMm < second.max.xMm &&
    second.min.xMm < first.max.xMm &&
    first.min.yMm < second.max.yMm &&
    second.min.yMm < first.max.yMm
  );
}

function addCoverageRange(
  minimumCoverage: number[],
  pendingAddition: number[],
  nodeIndex: number,
  nodeStart: number,
  nodeEnd: number,
  rangeStart: number,
  rangeEnd: number,
  delta: 1 | -1,
): void {
  if (rangeStart <= nodeStart && nodeEnd <= rangeEnd) {
    minimumCoverage[nodeIndex] = minimumCoverage[nodeIndex]! + delta;
    pendingAddition[nodeIndex] = pendingAddition[nodeIndex]! + delta;
    return;
  }

  const nodeMiddle = Math.floor((nodeStart + nodeEnd) / 2);
  if (rangeStart <= nodeMiddle) {
    addCoverageRange(
      minimumCoverage,
      pendingAddition,
      nodeIndex * 2,
      nodeStart,
      nodeMiddle,
      rangeStart,
      rangeEnd,
      delta,
    );
  }
  if (rangeEnd > nodeMiddle) {
    addCoverageRange(
      minimumCoverage,
      pendingAddition,
      nodeIndex * 2 + 1,
      nodeMiddle + 1,
      nodeEnd,
      rangeStart,
      rangeEnd,
      delta,
    );
  }

  minimumCoverage[nodeIndex] =
    pendingAddition[nodeIndex]! +
    Math.min(
      minimumCoverage[nodeIndex * 2]!,
      minimumCoverage[nodeIndex * 2 + 1]!,
    );
}

export function isRectangleFullyCoveredByUnion(
  target: RectangleBoundsMm,
  coveringRectangles: readonly RectangleBoundsMm[],
): boolean {
  if (
    !isValidRectangle(target) ||
    coveringRectangles.length === 0 ||
    coveringRectangles.some((rectangle) => !isValidRectangle(rectangle))
  ) {
    return false;
  }

  const clippedRectangles: ClippedRectangleMm[] = [];
  const yCoordinates = [target.min.yMm, target.max.yMm];

  for (const rectangle of coveringRectangles) {
    const minXmm = Math.max(target.min.xMm, rectangle.min.xMm);
    const maxXmm = Math.min(target.max.xMm, rectangle.max.xMm);
    const minYmm = Math.max(target.min.yMm, rectangle.min.yMm);
    const maxYmm = Math.min(target.max.yMm, rectangle.max.yMm);

    if (minXmm < maxXmm && minYmm < maxYmm) {
      clippedRectangles.push({ minXmm, maxXmm, minYmm, maxYmm });
      yCoordinates.push(minYmm, maxYmm);
    }
  }

  if (clippedRectangles.length === 0) {
    return false;
  }

  yCoordinates.sort((first, second) =>
    first < second ? -1 : first > second ? 1 : 0,
  );
  const uniqueYCoordinates = yCoordinates.filter(
    (coordinate, index) =>
      index === 0 || coordinate !== yCoordinates[index - 1]!,
  );
  const yIndexByCoordinate = new Map(
    uniqueYCoordinates.map((coordinate, index) => [coordinate, index]),
  );
  const events: RectangleSweepEvent[] = [];

  for (const rectangle of clippedRectangles) {
    const minYIndex = yIndexByCoordinate.get(rectangle.minYmm);
    const maxYIndex = yIndexByCoordinate.get(rectangle.maxYmm);
    if (minYIndex === undefined || maxYIndex === undefined) {
      return false;
    }
    events.push(
      { xMm: rectangle.minXmm, minYIndex, maxYIndex, delta: 1 },
      { xMm: rectangle.maxXmm, minYIndex, maxYIndex, delta: -1 },
    );
  }

  events.sort((first, second) =>
    first.xMm < second.xMm ? -1 : first.xMm > second.xMm ? 1 : 0,
  );
  const segmentCount = uniqueYCoordinates.length - 1;
  const minimumCoverage = new Array<number>(segmentCount * 4).fill(0);
  const pendingAddition = new Array<number>(segmentCount * 4).fill(0);
  let previousXmm = target.min.xMm;
  let eventIndex = 0;

  while (eventIndex < events.length) {
    const eventXmm = events[eventIndex]!.xMm;
    if (eventXmm > previousXmm && minimumCoverage[1] === 0) {
      return false;
    }

    while (
      eventIndex < events.length &&
      events[eventIndex]!.xMm === eventXmm
    ) {
      const event = events[eventIndex]!;
      addCoverageRange(
        minimumCoverage,
        pendingAddition,
        1,
        0,
        segmentCount - 1,
        event.minYIndex,
        event.maxYIndex - 1,
        event.delta,
      );
      eventIndex += 1;
    }
    previousXmm = eventXmm;
  }

  return previousXmm >= target.max.xMm || minimumCoverage[1]! > 0;
}

function hasPositiveAxisLengths(bounds: PlacementBoundsMm): boolean {
  return (
    bounds.min.xMm < bounds.max.xMm &&
    bounds.min.yMm < bounds.max.yMm &&
    bounds.min.zMm < bounds.max.zMm
  );
}

function hasValidPlacementBounds(bounds: PlacementBoundsMm): boolean {
  return (
    Number.isSafeInteger(bounds.min.xMm) &&
    Number.isSafeInteger(bounds.min.yMm) &&
    Number.isSafeInteger(bounds.min.zMm) &&
    Number.isSafeInteger(bounds.max.xMm) &&
    Number.isSafeInteger(bounds.max.yMm) &&
    Number.isSafeInteger(bounds.max.zMm) &&
    hasPositiveAxisLengths(bounds)
  );
}

export function hasFullGeometricSupport(
  target: PlacementBoundsMm,
  candidates: readonly GeometricSupportCandidateMm[],
): boolean {
  if (!hasValidPlacementBounds(target) || target.min.zMm < 0) {
    return false;
  }
  if (target.min.zMm === 0) {
    return true;
  }
  if (candidates.some((candidate) => !hasValidPlacementBounds(candidate.bounds))) {
    return false;
  }

  const targetRectangle: RectangleBoundsMm = {
    min: { xMm: target.min.xMm, yMm: target.min.yMm },
    max: { xMm: target.max.xMm, yMm: target.max.yMm },
  };
  const supportingRectangles = candidates
    .filter(
      (candidate) =>
        candidate.canSupportCargo === true &&
        candidate.bounds.max.zMm === target.min.zMm,
    )
    .map<RectangleBoundsMm>((candidate) => ({
      min: {
        xMm: candidate.bounds.min.xMm,
        yMm: candidate.bounds.min.yMm,
      },
      max: {
        xMm: candidate.bounds.max.xMm,
        yMm: candidate.bounds.max.yMm,
      },
    }));

  return isRectangleFullyCoveredByUnion(
    targetRectangle,
    supportingRectangles,
  );
}

function rectangleContains(
  outer: PlacementBoundsMm,
  inner: PlacementBoundsMm,
): boolean {
  return (
    outer.min.xMm <= inner.min.xMm &&
    outer.max.xMm >= inner.max.xMm &&
    outer.min.yMm <= inner.min.yMm &&
    outer.max.yMm >= inner.max.yMm
  );
}

/**
 * Classifies the contact geometry for one elevated cargo. A single eligible
 * top face must contain the whole target footprint in both axes. Any positive-
 * area contact with at least one eligible face that does not meet that strict
 * rule remains a conditional manual arrangement. Edge and point contact do not
 * count as support contact.
 */
export function assessGeometricSupport(
  target: PlacementBoundsMm,
  candidates: readonly IdentifiedGeometricSupportCandidateMm[],
): GeometricSupportAssessment {
  const empty = {
    contactIds: [] as readonly string[],
    eligibleContactIds: [] as readonly string[],
  };
  if (!hasValidPlacementBounds(target) || target.min.zMm < 0) {
    return { kind: "invalid", ...empty };
  }
  if (target.min.zMm === 0) {
    return { kind: "floor", ...empty };
  }
  if (candidates.some((candidate) => !hasValidPlacementBounds(candidate.bounds))) {
    return { kind: "invalid", ...empty };
  }

  const contacts = candidates
    .filter(
      (candidate) =>
        candidate.bounds.max.zMm === target.min.zMm &&
        hasPositiveAreaOverlap(
          {
            min: {
              xMm: candidate.bounds.min.xMm,
              yMm: candidate.bounds.min.yMm,
            },
            max: {
              xMm: candidate.bounds.max.xMm,
              yMm: candidate.bounds.max.yMm,
            },
          },
          {
            min: { xMm: target.min.xMm, yMm: target.min.yMm },
            max: { xMm: target.max.xMm, yMm: target.max.yMm },
          },
        ),
    )
    .sort((first, second) =>
      first.id < second.id ? -1 : first.id > second.id ? 1 : 0,
    );
  const contactIds = contacts.map((candidate) => candidate.id);
  const eligibleContacts = contacts.filter(
    (candidate) => candidate.canSupportCargo,
  );
  const eligibleContactIds = eligibleContacts.map((candidate) => candidate.id);

  if (
    contacts.length === 1 &&
    eligibleContacts.length === 1 &&
    rectangleContains(eligibleContacts[0]!.bounds, target)
  ) {
    return { kind: "single", contactIds, eligibleContactIds };
  }
  if (eligibleContacts.length > 0) {
    return { kind: "conditional", contactIds, eligibleContactIds };
  }
  return { kind: "invalid", contactIds, eligibleContactIds };
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

export function fitsRectangularOpening(
  orientedDimensionsMm: OrientedDimensionsMm,
  openingMm: OpeningMm,
  clearancesMm: ClearancesMm,
): boolean {
  return (
    orientedDimensionsMm.yMm + 2 * clearancesMm.yMm <=
      openingMm.widthMm &&
    orientedDimensionsMm.zMm + clearancesMm.zMm <= openingMm.heightMm
  );
}

export function fittingOpeningOrientations(
  cargo: Pick<Cargo, "dimensionsMm" | "allowedOrientations">,
  openingMm: OpeningMm,
  clearancesMm: ClearancesMm,
): readonly Orientation[] {
  return cargo.allowedOrientations.filter((orientation) =>
    fitsRectangularOpening(
      orientedDimensions(cargo, orientation),
      openingMm,
      clearancesMm,
    ),
  );
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
