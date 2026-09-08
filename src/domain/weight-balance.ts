import { ORIENTATIONS, type Container, type Project } from "./model";
import { orientedDimensions } from "./geometry";

const MAX_DIMENSION_MM = 100_000;
const MAX_MASS_GRAMS = 100_000_000;
const MAX_PLACEMENT_COORDINATE_MM = 1_000_000;
const MAX_SELECTED_PLACEMENTS = 1_000;

export interface ExactRationalMm {
  readonly numerator: bigint;
  readonly denominator: bigint;
}

export interface ExactPointMm {
  readonly xMm: ExactRationalMm;
  readonly yMm: ExactRationalMm;
  readonly zMm: ExactRationalMm;
}

export interface DoubledMomentsGramMm {
  readonly x: bigint;
  readonly y: bigint;
  readonly z: bigint;
}

export type CargoCenterOfGravityResult =
  | { readonly kind: "no-container" }
  | {
      readonly kind: "empty";
      readonly containerCenterMm: ExactPointMm;
    }
  | {
      readonly kind: "available";
      readonly containerCenterMm: ExactPointMm;
      readonly cargoCenterOfGravityMm: ExactPointMm;
      readonly totalCargoMassGrams: bigint;
      readonly doubledMomentsGramMm: DoubledMomentsGramMm;
    }
  | {
      readonly kind: "unavailable";
      readonly containerCenterMm: ExactPointMm;
    };

function greatestCommonDivisor(first: bigint, second: bigint): bigint {
  let a = first < 0n ? -first : first;
  let b = second < 0n ? -second : second;
  while (b !== 0n) {
    const remainder = a % b;
    a = b;
    b = remainder;
  }
  return a;
}

function exactRational(numerator: bigint, denominator: bigint): ExactRationalMm {
  const normalizedNumerator = denominator < 0n ? -numerator : numerator;
  const normalizedDenominator = denominator < 0n ? -denominator : denominator;
  const divisor = greatestCommonDivisor(normalizedNumerator, normalizedDenominator);
  return {
    numerator: normalizedNumerator / divisor,
    denominator: normalizedDenominator / divisor,
  };
}

function hasValidContainerDimensions(container: Container): boolean {
  const dimensions = container.internalDimensionsMm;
  return (
    Number.isSafeInteger(dimensions.lengthMm) &&
    Number.isSafeInteger(dimensions.widthMm) &&
    Number.isSafeInteger(dimensions.heightMm) &&
    dimensions.lengthMm > 0 &&
    dimensions.widthMm > 0 &&
    dimensions.heightMm > 0 &&
    dimensions.lengthMm <= MAX_DIMENSION_MM &&
    dimensions.widthMm <= MAX_DIMENSION_MM &&
    dimensions.heightMm <= MAX_DIMENSION_MM
  );
}

function containerCenter(container: Container): ExactPointMm {
  return {
    xMm: exactRational(BigInt(container.internalDimensionsMm.lengthMm), 2n),
    yMm: exactRational(BigInt(container.internalDimensionsMm.widthMm), 2n),
    zMm: exactRational(BigInt(container.internalDimensionsMm.heightMm), 2n),
  };
}

function isValidCargoDimension(value: number): boolean {
  return Number.isSafeInteger(value) && value > 0 && value <= MAX_DIMENSION_MM;
}

function isValidCargoMass(value: number): boolean {
  return Number.isSafeInteger(value) && value > 0 && value <= MAX_MASS_GRAMS;
}

function isValidPlacementCoordinate(value: number): boolean {
  return (
    Number.isSafeInteger(value) &&
    value >= -MAX_PLACEMENT_COORDINATE_MM &&
    value <= MAX_PLACEMENT_COORDINATE_MM
  );
}

/**
 * Calculates the cargo-only centre of gravity for one selected container.
 * All weighted moments remain exact BigInt integers and the returned points
 * remain exact rationals. Rendering is the first boundary allowed to convert
 * these values to floating point.
 */
export function calculateCargoCenterOfGravity(
  project: Project,
  containerId?: string,
): CargoCenterOfGravityResult {
  if (containerId === undefined) return { kind: "no-container" };
  const matchingContainers = project.containers.filter(
    (container) => container.id === containerId,
  );
  if (
    matchingContainers.length !== 1 ||
    !hasValidContainerDimensions(matchingContainers[0]!)
  ) {
    return { kind: "no-container" };
  }

  const containerCenterMm = containerCenter(matchingContainers[0]!);
  const placements = project.placements.filter(
    (placement) => placement.containerId === containerId,
  );
  if (placements.length === 0) {
    return { kind: "empty", containerCenterMm };
  }
  if (placements.length > MAX_SELECTED_PLACEMENTS) {
    return { kind: "unavailable", containerCenterMm };
  }

  const seenCargoIds = new Set<string>();
  let totalCargoMassGrams = 0n;
  let xMoment = 0n;
  let yMoment = 0n;
  let zMoment = 0n;

  for (const placement of placements) {
    if (seenCargoIds.has(placement.cargoId)) {
      return { kind: "unavailable", containerCenterMm };
    }
    seenCargoIds.add(placement.cargoId);

    const matchingCargoes = project.cargoes.filter(
      (cargo) => cargo.id === placement.cargoId,
    );
    const cargo = matchingCargoes[0];
    if (
      matchingCargoes.length !== 1 ||
      cargo === undefined ||
      !isValidCargoMass(cargo.massGrams) ||
      !isValidCargoDimension(cargo.dimensionsMm.lengthMm) ||
      !isValidCargoDimension(cargo.dimensionsMm.widthMm) ||
      !isValidCargoDimension(cargo.dimensionsMm.heightMm) ||
      !ORIENTATIONS.includes(placement.orientation) ||
      !cargo.allowedOrientations.includes(placement.orientation) ||
      !isValidPlacementCoordinate(placement.positionMm.xMm) ||
      !isValidPlacementCoordinate(placement.positionMm.yMm) ||
      !isValidPlacementCoordinate(placement.positionMm.zMm)
    ) {
      return { kind: "unavailable", containerCenterMm };
    }

    const dimensions = orientedDimensions(cargo, placement.orientation);
    const mass = BigInt(cargo.massGrams);
    const doubledX =
      2n * BigInt(placement.positionMm.xMm) + BigInt(dimensions.xMm);
    const doubledY =
      2n * BigInt(placement.positionMm.yMm) + BigInt(dimensions.yMm);
    const doubledZ =
      2n * BigInt(placement.positionMm.zMm) + BigInt(dimensions.zMm);
    totalCargoMassGrams += mass;
    xMoment += mass * doubledX;
    yMoment += mass * doubledY;
    zMoment += mass * doubledZ;
  }

  if (totalCargoMassGrams <= 0n) {
    return { kind: "unavailable", containerCenterMm };
  }
  const denominator = 2n * totalCargoMassGrams;
  const doubledMomentsGramMm = { x: xMoment, y: yMoment, z: zMoment };
  return {
    kind: "available",
    containerCenterMm,
    cargoCenterOfGravityMm: {
      xMm: exactRational(xMoment, denominator),
      yMm: exactRational(yMoment, denominator),
      zMm: exactRational(zMoment, denominator),
    },
    totalCargoMassGrams,
    doubledMomentsGramMm,
  };
}

export function exactRationalMmToNumber(value: ExactRationalMm): number | undefined {
  if (value.denominator === 0n) return undefined;
  const quotient = value.numerator / value.denominator;
  const remainder = value.numerator % value.denominator;
  const result = Number(quotient) + Number(remainder) / Number(value.denominator);
  return Number.isFinite(result) ? result : undefined;
}

export function exactRationalMmEqual(
  first: ExactRationalMm,
  second: ExactRationalMm,
): boolean {
  return first.numerator * second.denominator === second.numerator * first.denominator;
}
