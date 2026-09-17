import {
  assessGeometricSupport,
  hasPositiveAreaOverlap,
  hasPositiveVolumeOverlap,
  placementBounds,
  type IdentifiedGeometricSupportCandidateMm,
  type PlacementBoundsMm,
} from "./geometry";
import { ORIENTATIONS, type Cargo, type Placement, type Project } from "./model";

export const LOADING_SEQUENCE_ALGORITHM_VERSION = "loading-sequence-v1" as const;

export type LoadingSequencePrecedenceReason = "access" | "support";

export interface LoadingSequencePrecedence {
  readonly beforeCargoId: string;
  readonly afterCargoId: string;
  readonly reasons: readonly LoadingSequencePrecedenceReason[];
}

export interface LoadingSequenceStep {
  readonly sequenceNumber: number;
  readonly cargoId: string;
  readonly predecessorCargoIds: readonly string[];
}

export interface LoadingSequenceOrderCandidate {
  readonly cargoId: string;
  readonly minXmm: number;
  readonly minYmm: number;
  readonly minZmm: number;
}

export type LoadingSequenceGraphOrderResult =
  | { readonly orderedCargoIds: readonly string[] }
  | { readonly cycleCargoIds: readonly string[] };

export interface LoadingSequenceWarning {
  readonly code: "loading-sequence.support-conditions-unverified";
  readonly targetCargoId: string;
  readonly relatedCargoIds: readonly string[];
}

export type LoadingSequenceUnavailableReason =
  | {
      readonly code: "loading-sequence.container-reference-invalid";
      readonly relatedCargoIds: readonly string[];
    }
  | {
      readonly code: "loading-sequence.cargo-reference-invalid";
      readonly relatedCargoIds: readonly string[];
    }
  | {
      readonly code: "loading-sequence.geometry-calculation-unavailable";
      readonly relatedCargoIds: readonly string[];
    }
  | {
      readonly code: "loading-sequence.positive-volume-overlap";
      readonly relatedCargoIds: readonly string[];
    }
  | {
      readonly code: "loading-sequence.support-contact-missing";
      readonly relatedCargoIds: readonly string[];
    }
  | {
      readonly code: "loading-sequence.precedence-cycle";
      readonly relatedCargoIds: readonly string[];
    };

export type LoadingSequenceResult =
  | {
      readonly status: "empty";
      readonly algorithmVersion: typeof LOADING_SEQUENCE_ALGORITHM_VERSION;
      readonly containerId: string;
    }
  | {
      readonly status: "available";
      readonly algorithmVersion: typeof LOADING_SEQUENCE_ALGORITHM_VERSION;
      readonly containerId: string;
      readonly sequence: readonly LoadingSequenceStep[];
      readonly precedences: readonly LoadingSequencePrecedence[];
      readonly warnings: readonly LoadingSequenceWarning[];
    }
  | {
      readonly status: "unavailable";
      readonly algorithmVersion: typeof LOADING_SEQUENCE_ALGORITHM_VERSION;
      readonly containerId: string;
      readonly reason: LoadingSequenceUnavailableReason;
    };

interface PlacedCargo {
  readonly cargo: Cargo;
  readonly placement: Placement;
  readonly bounds: PlacementBoundsMm;
}

interface MutablePrecedence {
  readonly beforeCargoId: string;
  readonly afterCargoId: string;
  readonly reasons: Set<LoadingSequencePrecedenceReason>;
}

function compareStrings(first: string, second: string): number {
  return first < second ? -1 : first > second ? 1 : 0;
}

function compareNumbers(first: number, second: number): number {
  return first < second ? -1 : first > second ? 1 : 0;
}

function sortedUnique(values: readonly string[]): readonly string[] {
  return [...new Set(values)].sort(compareStrings);
}

function unavailable(
  containerId: string,
  reason: LoadingSequenceUnavailableReason,
): LoadingSequenceResult {
  return {
    status: "unavailable",
    algorithmVersion: LOADING_SEQUENCE_ALGORITHM_VERSION,
    containerId,
    reason,
  };
}

function hasValidBounds(bounds: PlacementBoundsMm): boolean {
  return (
    Number.isSafeInteger(bounds.min.xMm) &&
    Number.isSafeInteger(bounds.min.yMm) &&
    Number.isSafeInteger(bounds.min.zMm) &&
    Number.isSafeInteger(bounds.max.xMm) &&
    Number.isSafeInteger(bounds.max.yMm) &&
    Number.isSafeInteger(bounds.max.zMm) &&
    bounds.min.xMm < bounds.max.xMm &&
    bounds.min.yMm < bounds.max.yMm &&
    bounds.min.zMm < bounds.max.zMm
  );
}

function createPlacedCargoes(
  project: Project,
  containerId: string,
):
  | { readonly valid: true; readonly placedCargoes: readonly PlacedCargo[] }
  | {
      readonly valid: false;
      readonly code:
        | "loading-sequence.cargo-reference-invalid"
        | "loading-sequence.geometry-calculation-unavailable";
      readonly relatedCargoIds: readonly string[];
    } {
  const selectedPlacements = project.placements.filter(
    (placement) => placement.containerId === containerId,
  );
  const referencedCargoIds = new Set(
    selectedPlacements.map((placement) => placement.cargoId),
  );
  const cargoesById = new Map<string, Cargo>();
  const ambiguousCargoIds = new Set<string>();

  for (const cargo of project.cargoes) {
    if (!referencedCargoIds.has(cargo.id)) {
      continue;
    }
    if (cargoesById.has(cargo.id)) {
      ambiguousCargoIds.add(cargo.id);
    } else {
      cargoesById.set(cargo.id, cargo);
    }
  }

  const seenPlacementCargoIds = new Set<string>();
  const invalidReferences = new Set<string>(ambiguousCargoIds);
  for (const placement of selectedPlacements) {
    if (
      !cargoesById.has(placement.cargoId) ||
      seenPlacementCargoIds.has(placement.cargoId)
    ) {
      invalidReferences.add(placement.cargoId);
    }
    seenPlacementCargoIds.add(placement.cargoId);
  }
  if (invalidReferences.size > 0) {
    return {
      valid: false,
      code: "loading-sequence.cargo-reference-invalid",
      relatedCargoIds: sortedUnique([...invalidReferences]),
    };
  }

  const geometryFailures: string[] = [];
  const placedCargoes = selectedPlacements.map((placement) => {
    const cargo = cargoesById.get(placement.cargoId)!;
    const bounds = placementBounds(cargo, placement);
    if (
      !ORIENTATIONS.includes(placement.orientation) ||
      !cargo.allowedOrientations.includes(placement.orientation) ||
      !hasValidBounds(bounds)
    ) {
      geometryFailures.push(placement.cargoId);
    }
    return { cargo, placement, bounds };
  });

  if (geometryFailures.length > 0) {
    return {
      valid: false,
      code: "loading-sequence.geometry-calculation-unavailable",
      relatedCargoIds: sortedUnique(geometryFailures),
    };
  }

  return { valid: true, placedCargoes };
}

function supportContacts(
  target: PlacedCargo,
  placedCargoes: readonly PlacedCargo[],
): readonly PlacedCargo[] {
  return placedCargoes
    .filter(
      (candidate) =>
        candidate.placement.cargoId !== target.placement.cargoId &&
        candidate.bounds.max.zMm === target.bounds.min.zMm &&
        hasPositiveAreaOverlap(
          {
            min: target.bounds.min,
            max: target.bounds.max,
          },
          {
            min: candidate.bounds.min,
            max: candidate.bounds.max,
          },
        ),
    )
    .sort((first, second) =>
      compareStrings(first.placement.cargoId, second.placement.cargoId),
    );
}

function loadingCorridor(target: PlacementBoundsMm): PlacementBoundsMm {
  const maxXmm = Math.max(0, target.max.xMm);
  return {
    min: { xMm: 0, yMm: target.min.yMm, zMm: target.min.zMm },
    max: { xMm: maxXmm, yMm: target.max.yMm, zMm: target.max.zMm },
    dimensions: {
      xMm: maxXmm,
      yMm: target.dimensions.yMm,
      zMm: target.dimensions.zMm,
    },
  };
}

function precedenceKey(beforeCargoId: string, afterCargoId: string): string {
  return `${beforeCargoId}\u0000${afterCargoId}`;
}

function addPrecedence(
  precedences: Map<string, MutablePrecedence>,
  beforeCargoId: string,
  afterCargoId: string,
  reason: LoadingSequencePrecedenceReason,
): void {
  const key = precedenceKey(beforeCargoId, afterCargoId);
  const existing = precedences.get(key);
  if (existing === undefined) {
    precedences.set(key, {
      beforeCargoId,
      afterCargoId,
      reasons: new Set([reason]),
    });
  } else {
    existing.reasons.add(reason);
  }
}

function compareReadyCandidates(
  first: LoadingSequenceOrderCandidate,
  second: LoadingSequenceOrderCandidate,
): number {
  return (
    compareNumbers(second.minXmm, first.minXmm) ||
    compareNumbers(first.minZmm, second.minZmm) ||
    compareNumbers(first.minYmm, second.minYmm) ||
    compareStrings(first.cargoId, second.cargoId)
  );
}

function findCycleCargoIds(
  cargoIds: readonly string[],
  outgoing: ReadonlyMap<string, ReadonlySet<string>>,
): readonly string[] {
  const state = new Map<string, "visiting" | "visited">();
  const path: string[] = [];
  let cycle: readonly string[] = [];

  const visit = (cargoId: string): boolean => {
    state.set(cargoId, "visiting");
    path.push(cargoId);
    const nextCargoIds = [...(outgoing.get(cargoId) ?? [])].sort(compareStrings);
    for (const nextCargoId of nextCargoIds) {
      if (state.get(nextCargoId) === "visiting") {
        const startIndex = path.lastIndexOf(nextCargoId);
        cycle = sortedUnique(path.slice(startIndex));
        return true;
      }
      if (state.get(nextCargoId) === undefined && visit(nextCargoId)) {
        return true;
      }
    }
    path.pop();
    state.set(cargoId, "visited");
    return false;
  };

  for (const cargoId of [...cargoIds].sort(compareStrings)) {
    if (state.get(cargoId) === undefined && visit(cargoId)) {
      return cycle;
    }
  }
  return cycle;
}

export function orderLoadingSequenceGraph(
  candidates: readonly LoadingSequenceOrderCandidate[],
  precedences: readonly Pick<
    LoadingSequencePrecedence,
    "beforeCargoId" | "afterCargoId"
  >[],
): LoadingSequenceGraphOrderResult {
  const candidateByCargoId = new Map(
    candidates.map((candidate) => [candidate.cargoId, candidate]),
  );
  const outgoing = new Map<string, Set<string>>();
  const incoming = new Map<string, Set<string>>();
  for (const cargoId of candidateByCargoId.keys()) {
    outgoing.set(cargoId, new Set());
    incoming.set(cargoId, new Set());
  }
  for (const precedence of precedences) {
    outgoing.get(precedence.beforeCargoId)?.add(precedence.afterCargoId);
    incoming.get(precedence.afterCargoId)?.add(precedence.beforeCargoId);
  }

  const remainingIndegree = new Map(
    [...incoming].map(([cargoId, predecessors]) => [
      cargoId,
      predecessors.size,
    ]),
  );
  const ready = candidates
    .filter((candidate) => remainingIndegree.get(candidate.cargoId) === 0)
    .sort(compareReadyCandidates);
  const orderedCargoIds: string[] = [];
  while (ready.length > 0) {
    const next = ready.shift()!;
    orderedCargoIds.push(next.cargoId);
    for (const dependentCargoId of [...outgoing.get(next.cargoId)!].sort(
      compareStrings,
    )) {
      const nextIndegree = remainingIndegree.get(dependentCargoId)! - 1;
      remainingIndegree.set(dependentCargoId, nextIndegree);
      if (nextIndegree === 0) {
        ready.push(candidateByCargoId.get(dependentCargoId)!);
        ready.sort(compareReadyCandidates);
      }
    }
  }

  if (orderedCargoIds.length !== candidates.length) {
    return {
      cycleCargoIds: findCycleCargoIds(
        [...candidateByCargoId.keys()],
        outgoing,
      ),
    };
  }
  return { orderedCargoIds };
}

/**
 * Proposes one deterministic loading order for the currently placed cargoes in
 * a container. The model assumes fixed orientation and a straight +X movement
 * at the final Y/Z. It is not a route, equipment, or safety evaluation.
 */
export function proposeLoadingSequence(
  project: Project,
  containerId: string,
): LoadingSequenceResult {
  const matchingContainers = project.containers.filter(
    (container) => container.id === containerId,
  );
  if (matchingContainers.length !== 1) {
    return unavailable(containerId, {
      code: "loading-sequence.container-reference-invalid",
      relatedCargoIds: [],
    });
  }

  const created = createPlacedCargoes(project, containerId);
  if (!created.valid) {
    return unavailable(containerId, {
      code: created.code,
      relatedCargoIds: created.relatedCargoIds,
    });
  }
  const placedCargoes = created.placedCargoes;
  if (placedCargoes.length === 0) {
    return {
      status: "empty",
      algorithmVersion: LOADING_SEQUENCE_ALGORITHM_VERSION,
      containerId,
    };
  }

  const overlappingCargoIds: string[] = [];
  for (let firstIndex = 0; firstIndex < placedCargoes.length; firstIndex += 1) {
    const first = placedCargoes[firstIndex]!;
    for (
      let secondIndex = firstIndex + 1;
      secondIndex < placedCargoes.length;
      secondIndex += 1
    ) {
      const second = placedCargoes[secondIndex]!;
      if (hasPositiveVolumeOverlap(first.bounds, second.bounds)) {
        overlappingCargoIds.push(
          first.placement.cargoId,
          second.placement.cargoId,
        );
      }
    }
  }
  if (overlappingCargoIds.length > 0) {
    return unavailable(containerId, {
      code: "loading-sequence.positive-volume-overlap",
      relatedCargoIds: sortedUnique(overlappingCargoIds),
    });
  }

  const mutablePrecedences = new Map<string, MutablePrecedence>();
  const warnings: LoadingSequenceWarning[] = [];
  const unsupportedCargoIds: string[] = [];
  for (const target of placedCargoes) {
    const targetCargoId = target.placement.cargoId;
    if (target.bounds.min.zMm > 0) {
      const contacts = supportContacts(target, placedCargoes);
      if (contacts.length === 0) {
        unsupportedCargoIds.push(targetCargoId);
        continue;
      }
      for (const contact of contacts) {
        addPrecedence(
          mutablePrecedences,
          contact.placement.cargoId,
          targetCargoId,
          "support",
        );
      }

      const supportCandidates = contacts.map<IdentifiedGeometricSupportCandidateMm>(
        (contact) => ({
          id: contact.placement.cargoId,
          bounds: contact.bounds,
          canSupportCargo: contact.cargo.canSupportCargo,
        }),
      );
      if (assessGeometricSupport(target.bounds, supportCandidates).kind === "conditional") {
        warnings.push({
          code: "loading-sequence.support-conditions-unverified",
          targetCargoId,
          relatedCargoIds: contacts.map(
            (contact) => contact.placement.cargoId,
          ),
        });
      }
    }

    const corridor = loadingCorridor(target.bounds);
    for (const blocker of placedCargoes) {
      if (
        blocker.placement.cargoId !== targetCargoId &&
        hasPositiveVolumeOverlap(corridor, blocker.bounds)
      ) {
        addPrecedence(
          mutablePrecedences,
          targetCargoId,
          blocker.placement.cargoId,
          "access",
        );
      }
    }
  }
  if (unsupportedCargoIds.length > 0) {
    return unavailable(containerId, {
      code: "loading-sequence.support-contact-missing",
      relatedCargoIds: sortedUnique(unsupportedCargoIds),
    });
  }

  const incoming = new Map<string, Set<string>>();
  for (const placed of placedCargoes) {
    const cargoId = placed.placement.cargoId;
    incoming.set(cargoId, new Set());
  }
  for (const precedence of mutablePrecedences.values()) {
    incoming.get(precedence.afterCargoId)!.add(precedence.beforeCargoId);
  }
  const graphOrder = orderLoadingSequenceGraph(
    placedCargoes.map((placed) => ({
      cargoId: placed.placement.cargoId,
      minXmm: placed.bounds.min.xMm,
      minYmm: placed.bounds.min.yMm,
      minZmm: placed.bounds.min.zMm,
    })),
    [...mutablePrecedences.values()],
  );
  if ("cycleCargoIds" in graphOrder) {
    return unavailable(containerId, {
      code: "loading-sequence.precedence-cycle",
      relatedCargoIds: graphOrder.cycleCargoIds,
    });
  }

  const precedences = [...mutablePrecedences.values()]
    .map<LoadingSequencePrecedence>((precedence) => ({
      beforeCargoId: precedence.beforeCargoId,
      afterCargoId: precedence.afterCargoId,
      reasons: [...precedence.reasons].sort(compareStrings),
    }))
    .sort(
      (first, second) =>
        compareStrings(first.beforeCargoId, second.beforeCargoId) ||
        compareStrings(first.afterCargoId, second.afterCargoId),
    );
  const sequence = graphOrder.orderedCargoIds.map<LoadingSequenceStep>(
    (cargoId, index) => ({
      sequenceNumber: index + 1,
      cargoId,
      predecessorCargoIds: [...incoming.get(cargoId)!].sort(compareStrings),
    }),
  );

  return {
    status: "available",
    algorithmVersion: LOADING_SEQUENCE_ALGORITHM_VERSION,
    containerId,
    sequence,
    precedences,
    warnings: warnings.sort((first, second) =>
      compareStrings(first.targetCargoId, second.targetCargoId),
    ),
  };
}
