import { ORIENTATIONS, type Project } from "./model";
import {
  fittingOpeningOrientations,
  hasFullGeometricSupport,
  hasPositiveVolumeOverlap,
  hasRequiredAxisClearance,
  isPlacementWithinContainer,
  isPlacementWithinContainerWithClearance,
  orientedDimensions,
  placementBounds,
  type GeometricSupportCandidateMm,
  type PlacementBoundsMm,
} from "./geometry";

export interface ValidationIssue {
  readonly code: string;
  readonly path: string;
}

export type PhysicalValidationStatus = "valid" | "invalid" | "unverified";

export type InvalidPhysicalReasonCode =
  | "floor-penetration"
  | "outside-container"
  | "container-clearance-not-met"
  | "positive-volume-overlap"
  | "axis-clearance-not-met"
  | "opening-no-fitting-orientation"
  | "support-not-full"
  | "payload-capacity-exceeded";

export type UnverifiedPhysicalReasonCode =
  | "opening-path-unverified"
  | "structure-stability-unverified";

export type PhysicalTarget =
  | { readonly kind: "container"; readonly id: string }
  | { readonly kind: "cargo"; readonly id: string };

export type PhysicalValidationReason =
  | {
      readonly status: "invalid";
      readonly code: InvalidPhysicalReasonCode;
      readonly target: PhysicalTarget;
      readonly relatedCargoIds: readonly string[];
    }
  | {
      readonly status: "unverified";
      readonly code: UnverifiedPhysicalReasonCode;
      readonly target: PhysicalTarget;
      readonly relatedCargoIds: readonly string[];
    };

export type PlacementSetUnavailableReason =
  | {
      readonly code: "physical.semantic-input-invalid";
      readonly issues: readonly ValidationIssue[];
    }
  | {
      readonly code: "physical.container-not-found";
      readonly target: { readonly kind: "container"; readonly id: string };
    }
  | {
      readonly code: "physical.payload-calculation-unavailable";
      readonly target: { readonly kind: "container"; readonly id: string };
    }
  | {
      readonly code: "physical.geometry-calculation-unavailable";
      readonly target: { readonly kind: "container"; readonly id: string };
    };

export type PlacementSetValidationResult =
  | {
      readonly kind: "unavailable";
      readonly containerId: string;
      readonly reason: PlacementSetUnavailableReason;
    }
  | {
      readonly kind: "evaluated";
      readonly containerId: string;
      readonly status: PhysicalValidationStatus;
      readonly reasons: readonly PhysicalValidationReason[];
    };

export type SafeIntegerSumResult =
  | { readonly valid: true; readonly sum: number }
  | { readonly valid: false };

export function safeIntegerSum(values: readonly number[]): SafeIntegerSumResult {
  let sum = 0;

  for (const value of values) {
    if (!Number.isSafeInteger(value)) {
      return { valid: false };
    }
    const next = sum + value;
    if (!Number.isSafeInteger(next)) {
      return { valid: false };
    }
    sum = next;
  }

  return { valid: true, sum };
}

export type PayloadCapacityEvaluation =
  | {
      calculable: true;
      totalMassGrams: number;
      withinCapacity: boolean;
    }
  | { calculable: false };

export function evaluatePayloadCapacity(
  massesGrams: readonly number[],
  payloadCapacityGrams: number,
): PayloadCapacityEvaluation {
  if (
    !Number.isSafeInteger(payloadCapacityGrams) ||
    payloadCapacityGrams < 0
  ) {
    return { calculable: false };
  }

  for (const massGrams of massesGrams) {
    if (!Number.isSafeInteger(massGrams) || massGrams < 0) {
      return { calculable: false };
    }
  }

  const total = safeIntegerSum(massesGrams);
  if (!total.valid) {
    return { calculable: false };
  }

  return {
    calculable: true,
    totalMassGrams: total.sum,
    withinCapacity: total.sum <= payloadCapacityGrams,
  };
}

export function validateProjectReferences(project: Project): readonly ValidationIssue[] {
  const issues: ValidationIssue[] = [];
  const cargoesById = new Map<string, Project["cargoes"][number]>();
  const containersById = new Map<string, Project["containers"][number]>();
  const duplicateCargoIds = new Set<string>();
  const duplicateContainerIds = new Set<string>();

  project.cargoes.forEach((cargo, index) => {
    if (cargoesById.has(cargo.id)) {
      issues.push({ code: "semantic.duplicate-cargo-id", path: `/cargoes/${index}/id` });
      duplicateCargoIds.add(cargo.id);
      return;
    }
    cargoesById.set(cargo.id, cargo);
  });

  project.containers.forEach((container, index) => {
    if (containersById.has(container.id)) {
      issues.push({ code: "semantic.duplicate-container-id", path: `/containers/${index}/id` });
      duplicateContainerIds.add(container.id);
    } else {
      containersById.set(container.id, container);
    }

    if (container.openingMm.widthMm > container.internalDimensionsMm.widthMm) {
      issues.push({
        code: "semantic.opening-width-exceeds-internal",
        path: `/containers/${index}/openingMm/widthMm`,
      });
    }
    if (container.openingMm.heightMm > container.internalDimensionsMm.heightMm) {
      issues.push({
        code: "semantic.opening-height-exceeds-internal",
        path: `/containers/${index}/openingMm/heightMm`,
      });
    }
  });

  const placedCargoIds = new Set<string>();
  project.placements.forEach((placement, index) => {
    const cargo = cargoesById.get(placement.cargoId);
    const cargoIsAmbiguous = duplicateCargoIds.has(placement.cargoId);
    if (cargo === undefined && !cargoIsAmbiguous) {
      issues.push({
        code: "semantic.unknown-cargo-reference",
        path: `/placements/${index}/cargoId`,
      });
    } else if (
      cargo !== undefined &&
      !cargoIsAmbiguous &&
      !cargo.allowedOrientations.includes(placement.orientation)
    ) {
      issues.push({
        code: "semantic.disallowed-orientation",
        path: `/placements/${index}/orientation`,
      });
    }

    if (
      !containersById.has(placement.containerId) &&
      !duplicateContainerIds.has(placement.containerId)
    ) {
      issues.push({
        code: "semantic.unknown-container-reference",
        path: `/placements/${index}/containerId`,
      });
    }

    if (cargo !== undefined && !cargoIsAmbiguous) {
      if (placedCargoIds.has(placement.cargoId)) {
        issues.push({
          code: "semantic.duplicate-cargo-placement",
          path: `/placements/${index}/cargoId`,
        });
      } else {
        placedCargoIds.add(placement.cargoId);
      }
    }
  });

  if (!safeIntegerSum(project.cargoes.map((cargo) => cargo.massGrams)).valid) {
    issues.push({ code: "semantic.mass-sum-unsafe", path: "/cargoes" });
  }

  return issues;
}

interface SelectedPlacementEvaluation {
  readonly cargo: Project["cargoes"][number];
  readonly bounds: PlacementBoundsMm;
  readonly rawInside: boolean;
}

interface SelectedPlacementInput {
  readonly cargo: Project["cargoes"][number];
  readonly placement: Project["placements"][number];
}

interface SupportAssessment {
  readonly full: boolean;
  readonly contributorIds: readonly string[];
}

function isPositiveSafeInteger(value: number): boolean {
  return Number.isSafeInteger(value) && value > 0;
}

function isNonnegativeSafeInteger(value: number): boolean {
  return Number.isSafeInteger(value) && value >= 0;
}

function hasCalculableGeometryInputs(
  container: Project["containers"][number],
  clearancesMm: Project["clearancesMm"],
  selectedInputs: readonly SelectedPlacementInput[],
): boolean {
  const { internalDimensionsMm, openingMm } = container;
  if (
    !isPositiveSafeInteger(internalDimensionsMm.lengthMm) ||
    !isPositiveSafeInteger(internalDimensionsMm.widthMm) ||
    !isPositiveSafeInteger(internalDimensionsMm.heightMm) ||
    !isPositiveSafeInteger(openingMm.widthMm) ||
    !isPositiveSafeInteger(openingMm.heightMm) ||
    !isNonnegativeSafeInteger(clearancesMm.xMm) ||
    !isNonnegativeSafeInteger(clearancesMm.yMm) ||
    !isNonnegativeSafeInteger(clearancesMm.zMm)
  ) {
    return false;
  }

  const doubledYClearance = clearancesMm.yMm * 2;
  if (
    !Number.isSafeInteger(doubledYClearance) ||
    !Number.isSafeInteger(
      internalDimensionsMm.lengthMm - clearancesMm.xMm,
    ) ||
    !Number.isSafeInteger(
      internalDimensionsMm.widthMm - clearancesMm.yMm,
    ) ||
    !Number.isSafeInteger(
      internalDimensionsMm.heightMm - clearancesMm.zMm,
    )
  ) {
    return false;
  }

  for (const { cargo, placement } of selectedInputs) {
    if (
      !isPositiveSafeInteger(cargo.dimensionsMm.lengthMm) ||
      !isPositiveSafeInteger(cargo.dimensionsMm.widthMm) ||
      !isPositiveSafeInteger(cargo.dimensionsMm.heightMm) ||
      cargo.allowedOrientations.length === 0 ||
      !cargo.allowedOrientations.every((orientation) =>
        ORIENTATIONS.includes(orientation),
      ) ||
      !ORIENTATIONS.includes(placement.orientation) ||
      !Number.isSafeInteger(placement.positionMm.xMm) ||
      !Number.isSafeInteger(placement.positionMm.yMm) ||
      !Number.isSafeInteger(placement.positionMm.zMm)
    ) {
      return false;
    }

    const placedDimensions = orientedDimensions(cargo, placement.orientation);
    if (
      !Number.isSafeInteger(
        placement.positionMm.xMm + placedDimensions.xMm,
      ) ||
      !Number.isSafeInteger(
        placement.positionMm.yMm + placedDimensions.yMm,
      ) ||
      !Number.isSafeInteger(
        placement.positionMm.zMm + placedDimensions.zMm,
      )
    ) {
      return false;
    }

    for (const orientation of cargo.allowedOrientations) {
      const dimensions = orientedDimensions(cargo, orientation);
      if (
        !Number.isSafeInteger(dimensions.yMm + doubledYClearance) ||
        !Number.isSafeInteger(dimensions.zMm + clearancesMm.zMm)
      ) {
        return false;
      }
    }
  }

  return true;
}

function compareIds(first: string, second: string): number {
  return first < second ? -1 : first > second ? 1 : 0;
}

function sortedUniqueCargoIds(ids: readonly string[]): readonly string[] {
  return [...new Set(ids)].sort(compareIds);
}

function hasPositiveXyProjectionOverlap(
  first: PlacementBoundsMm,
  second: PlacementBoundsMm,
): boolean {
  return (
    first.min.xMm < second.max.xMm &&
    second.min.xMm < first.max.xMm &&
    first.min.yMm < second.max.yMm &&
    second.min.yMm < first.max.yMm
  );
}

function computeSupportAssessments(
  selectedPlacements: readonly SelectedPlacementEvaluation[],
  normalizeFloorPenetratingCandidates = false,
): ReadonlyMap<string, SupportAssessment> {
  const assessments = new Map<string, SupportAssessment>();

  for (const target of selectedPlacements) {
    if (target.bounds.min.zMm <= 0) {
      continue;
    }

    const candidates = selectedPlacements.filter(
      (candidate) => candidate.cargo.id !== target.cargo.id,
    );
    const diagnosticCandidates = candidates.map((candidate) => ({
      ...candidate,
      bounds:
        normalizeFloorPenetratingCandidates && candidate.bounds.min.zMm < 0
          ? {
              ...candidate.bounds,
              min: { ...candidate.bounds.min, zMm: 0 },
              max: {
                ...candidate.bounds.max,
                zMm: candidate.bounds.max.zMm - candidate.bounds.min.zMm,
              },
            }
          : candidate.bounds,
    }));
    const contributorIds = sortedUniqueCargoIds(
      diagnosticCandidates
        .filter(
          (candidate) =>
            candidate.cargo.canSupportCargo &&
            candidate.bounds.max.zMm === target.bounds.min.zMm &&
            hasPositiveXyProjectionOverlap(candidate.bounds, target.bounds),
        )
        .map((candidate) => candidate.cargo.id),
    );
    const geometryCandidates = diagnosticCandidates.map<GeometricSupportCandidateMm>(
      (candidate) => ({
        bounds: candidate.bounds,
        canSupportCargo: candidate.cargo.canSupportCargo,
      }),
    );

    assessments.set(target.cargo.id, {
      full: hasFullGeometricSupport(target.bounds, geometryCandidates),
      contributorIds,
    });
  }

  return assessments;
}

function isFullSupportContributor(
  lower: SelectedPlacementEvaluation,
  upper: SelectedPlacementEvaluation,
  supportAssessments: ReadonlyMap<string, SupportAssessment>,
): boolean {
  const assessment = supportAssessments.get(upper.cargo.id);
  return (
    assessment?.full === true &&
    assessment.contributorIds.includes(lower.cargo.id)
  );
}

function physicalReasonKey(reason: PhysicalValidationReason): string {
  return JSON.stringify([
    reason.status,
    reason.code,
    reason.target.kind,
    reason.target.id,
    reason.relatedCargoIds,
  ]);
}

function appendPhysicalReason(
  reasons: PhysicalValidationReason[],
  reasonKeys: Set<string>,
  reason: PhysicalValidationReason,
): void {
  const key = physicalReasonKey(reason);
  if (!reasonKeys.has(key)) {
    reasonKeys.add(key);
    reasons.push(reason);
  }
}

export function validatePlacementSet(
  project: Project,
  containerId: string,
): PlacementSetValidationResult {
  const semanticIssues = validateProjectReferences(project).filter(
    (issue) => issue.code !== "semantic.mass-sum-unsafe",
  );
  if (semanticIssues.length > 0) {
    return {
      kind: "unavailable",
      containerId,
      reason: {
        code: "physical.semantic-input-invalid",
        issues: semanticIssues,
      },
    };
  }

  const container = project.containers.find(
    (candidate) => candidate.id === containerId,
  );
  if (container === undefined) {
    return {
      kind: "unavailable",
      containerId,
      reason: {
        code: "physical.container-not-found",
        target: { kind: "container", id: containerId },
      },
    };
  }

  const cargoesById = new Map(project.cargoes.map((cargo) => [cargo.id, cargo]));
  const selectedInputs = project.placements
    .filter((placement) => placement.containerId === containerId)
    .map(
      (placement) =>
        ({
          cargo: cargoesById.get(placement.cargoId)!,
          placement,
        }) satisfies SelectedPlacementInput,
    )
    .sort((first, second) => compareIds(first.cargo.id, second.cargo.id));

  if (!hasCalculableGeometryInputs(container, project.clearancesMm, selectedInputs)) {
    return {
      kind: "unavailable",
      containerId,
      reason: {
        code: "physical.geometry-calculation-unavailable",
        target: { kind: "container", id: containerId },
      },
    };
  }

  const payload = evaluatePayloadCapacity(
    selectedInputs.map(({ cargo }) => cargo.massGrams),
    container.payloadCapacityGrams,
  );
  if (!payload.calculable) {
    return {
      kind: "unavailable",
      containerId,
      reason: {
        code: "physical.payload-calculation-unavailable",
        target: { kind: "container", id: containerId },
      },
    };
  }

  if (selectedInputs.length === 0) {
    return {
      kind: "evaluated",
      containerId,
      status: "valid",
      reasons: [],
    };
  }

  const selectedPlacements = selectedInputs.map(({ cargo, placement }) => {
    const bounds = placementBounds(cargo, placement);
    return {
      cargo,
      bounds,
      rawInside: isPlacementWithinContainer(
        bounds,
        container.internalDimensionsMm,
      ),
    } satisfies SelectedPlacementEvaluation;
  });
  const supportAssessments = computeSupportAssessments(selectedPlacements);
  const floorNormalizedSupportAssessments = selectedPlacements.some(
    (selected) => selected.bounds.min.zMm < 0,
  )
    ? computeSupportAssessments(selectedPlacements, true)
    : supportAssessments;

  const reasons: PhysicalValidationReason[] = [];
  const reasonKeys = new Set<string>();
  const appendReason = (reason: PhysicalValidationReason): void =>
    appendPhysicalReason(reasons, reasonKeys, reason);

  for (const selected of selectedPlacements) {
    const target: PhysicalTarget = { kind: "cargo", id: selected.cargo.id };
    if (selected.bounds.min.zMm < 0) {
      appendReason({
        status: "invalid",
        code: "floor-penetration",
        target,
        relatedCargoIds: [],
      });
    } else if (!selected.rawInside) {
      appendReason({
        status: "invalid",
        code: "outside-container",
        target,
        relatedCargoIds: [],
      });
    } else if (
      !isPlacementWithinContainerWithClearance(
        selected.bounds,
        container.internalDimensionsMm,
        project.clearancesMm,
      )
    ) {
      appendReason({
        status: "invalid",
        code: "container-clearance-not-met",
        target,
        relatedCargoIds: [],
      });
    }
  }

  for (let firstIndex = 0; firstIndex < selectedPlacements.length; firstIndex += 1) {
    const first = selectedPlacements[firstIndex]!;
    for (
      let secondIndex = firstIndex + 1;
      secondIndex < selectedPlacements.length;
      secondIndex += 1
    ) {
      const second = selectedPlacements[secondIndex]!;
      if (!first.rawInside || !second.rawInside) {
        continue;
      }

      const target: PhysicalTarget = { kind: "cargo", id: first.cargo.id };
      const relatedCargoIds = [second.cargo.id];
      if (hasPositiveVolumeOverlap(first.bounds, second.bounds)) {
        appendReason({
          status: "invalid",
          code: "positive-volume-overlap",
          target,
          relatedCargoIds,
        });
      } else if (
        !isFullSupportContributor(first, second, supportAssessments) &&
        !isFullSupportContributor(
          first,
          second,
          floorNormalizedSupportAssessments,
        ) &&
        !isFullSupportContributor(second, first, supportAssessments) &&
        !isFullSupportContributor(
          second,
          first,
          floorNormalizedSupportAssessments,
        ) &&
        !hasRequiredAxisClearance(
          first.bounds,
          second.bounds,
          project.clearancesMm,
        )
      ) {
        appendReason({
          status: "invalid",
          code: "axis-clearance-not-met",
          target,
          relatedCargoIds,
        });
      }
    }
  }

  for (const selected of selectedPlacements) {
    const target: PhysicalTarget = { kind: "cargo", id: selected.cargo.id };
    const fittingOrientations = fittingOpeningOrientations(
      selected.cargo,
      container.openingMm,
      project.clearancesMm,
    );
    if (fittingOrientations.length === 0) {
      appendReason({
        status: "invalid",
        code: "opening-no-fitting-orientation",
        target,
        relatedCargoIds: [],
      });
    } else {
      appendReason({
        status: "unverified",
        code: "opening-path-unverified",
        target,
        relatedCargoIds: [],
      });
    }
  }

  for (const selected of selectedPlacements) {
    if (selected.bounds.min.zMm <= 0) {
      continue;
    }

    const assessment = supportAssessments.get(selected.cargo.id)!;
    const floorNormalizedAssessment = floorNormalizedSupportAssessments.get(
      selected.cargo.id,
    )!;
    const target: PhysicalTarget = { kind: "cargo", id: selected.cargo.id };

    if (assessment.full) {
      appendReason({
        status: "unverified",
        code: "structure-stability-unverified",
        target,
        relatedCargoIds: assessment.contributorIds,
      });
    } else if (!floorNormalizedAssessment.full && selected.rawInside) {
      appendReason({
        status: "invalid",
        code: "support-not-full",
        target,
        relatedCargoIds: assessment.contributorIds,
      });
    }
  }

  const selectedCargoIds = sortedUniqueCargoIds(
    selectedPlacements.map((selected) => selected.cargo.id),
  );
  if (!payload.withinCapacity) {
    appendReason({
      status: "invalid",
      code: "payload-capacity-exceeded",
      target: { kind: "container", id: containerId },
      relatedCargoIds: selectedCargoIds,
    });
  }

  const status: PhysicalValidationStatus = reasons.some(
    (reason) => reason.status === "invalid",
  )
    ? "invalid"
    : reasons.some((reason) => reason.status === "unverified")
      ? "unverified"
      : "valid";

  return {
    kind: "evaluated",
    containerId,
    status,
    reasons,
  };
}
