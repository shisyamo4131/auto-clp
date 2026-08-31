import {
  ORIENTATIONS,
  type Cargo,
  type ClearancesMm,
  type Container,
  type Orientation,
  type OrientedDimensionsMm,
  type Placement,
  type PositionMm,
  type Project,
} from "./model";
import {
  fitsRectangularOpening,
  orientedDimensions,
  placementBounds,
  type PlacementBoundsMm,
} from "./geometry";
import {
  validatePlacementSet,
  type PhysicalValidationReason,
  type PlacementSetValidationResult,
} from "./validation";

export const AUTOMATIC_PROPOSAL_ALGORITHM_VERSION =
  "automatic-proposal-v2" as const;
export const AUTOMATIC_PROPOSAL_CANDIDATE_POINT_LIMIT = 2_048 as const;
export const AUTOMATIC_PROPOSAL_CANDIDATE_ATTEMPT_LIMIT = 10_000 as const;
export const AUTOMATIC_PROPOSAL_REQUEST_ATTEMPT_LIMIT = 1_000_000 as const;

export type AutomaticProposalAlgorithmVersion =
  typeof AUTOMATIC_PROPOSAL_ALGORITHM_VERSION;
export type AutomaticProposalCutoffSource = "candidate" | "request" | "both";
export type AutomaticProposalStatus =
  | "no-cargo"
  | "no-candidates"
  | "no-complete-plan"
  | "cutoff"
  | "complete"
  | "complete-with-cutoff";

declare const validatedAutomaticProposalProjectBrand: unique symbol;

/**
 * A Project accepted only after the later Worker/application boundary has run
 * the authoritative JSON Schema and semantic validation. This module exposes
 * no brand factory because raw runtime input must never be trusted here. That
 * boundary, rather than this pure engine, reports the specified input-invalid
 * outcome when validation fails.
 */
export type ValidatedAutomaticProposalProject = Project & {
  readonly [validatedAutomaticProposalProjectBrand]: true;
};

export interface AutomaticProposalAttemptLimits {
  readonly candidate: number;
  readonly request: number;
}

export interface AutomaticProposalAttemptCounts {
  readonly candidate: number;
  readonly request: number;
}

export type AutomaticProposalAttemptAuthorization =
  | {
      readonly authorized: true;
      readonly counts: AutomaticProposalAttemptCounts;
    }
  | {
      readonly authorized: false;
      readonly counts: AutomaticProposalAttemptCounts;
      readonly cutoffSource: AutomaticProposalCutoffSource;
    };

export type AutomaticProposalCandidateOutcome =
  | "complete"
  | "exhausted"
  | "cutoff";

export interface AutomaticProposalCandidateAttemptSummary {
  readonly containerId: string;
  readonly attemptCount: number;
  readonly outcome: AutomaticProposalCandidateOutcome;
  readonly cutoffSource?: AutomaticProposalCutoffSource;
}

export interface AutomaticProposalAttemptSummary {
  readonly requestAttemptCount: number;
  readonly candidates: readonly AutomaticProposalCandidateAttemptSummary[];
}

export interface AutomaticProposalEffectiveLimits {
  readonly candidateAttemptLimit: number;
  readonly requestAttemptLimit: number;
  readonly candidatePointLimit: typeof AUTOMATIC_PROPOSAL_CANDIDATE_POINT_LIMIT;
}

export type AutomaticProposalUnverifiedReason = Extract<
  PhysicalValidationReason,
  { readonly status: "unverified" }
>;

export interface AutomaticProposalPlan {
  readonly containerId: string;
  readonly placements: readonly Placement[];
  readonly invalidReasonCount: 0;
  readonly unverifiedReasons: readonly AutomaticProposalUnverifiedReason[];
}

interface AutomaticProposalResultBase {
  readonly algorithmVersion: AutomaticProposalAlgorithmVersion;
  readonly effectiveLimits: AutomaticProposalEffectiveLimits;
  readonly attempts: AutomaticProposalAttemptSummary;
}

export type AutomaticProposalResult =
  | (AutomaticProposalResultBase & {
      readonly status: "no-cargo" | "no-candidates" | "no-complete-plan";
    })
  | (AutomaticProposalResultBase & {
      readonly status: "cutoff";
      readonly cutoffSource: AutomaticProposalCutoffSource;
    })
  | (AutomaticProposalResultBase & {
      readonly status: "complete";
      readonly plan: AutomaticProposalPlan;
    })
  | (AutomaticProposalResultBase & {
      readonly status: "complete-with-cutoff";
      readonly cutoffSource: AutomaticProposalCutoffSource;
      readonly plan: AutomaticProposalPlan;
    });

export interface AutomaticProposalTestingLimits {
  readonly candidateAttemptLimit?: number;
  readonly requestAttemptLimit?: number;
}

interface ResolvedAutomaticProposalAttemptLimits {
  readonly candidateAttemptLimit: number;
  readonly requestAttemptLimit: number;
}

interface PlacedCargo {
  readonly placement: Placement;
  readonly bounds: PlacementBoundsMm;
}

type CandidateSearchResult =
  | {
      readonly kind: "complete";
      readonly plan: AutomaticProposalPlan;
    }
  | { readonly kind: "exhausted" }
  | {
      readonly kind: "cutoff";
      readonly cutoffSource: AutomaticProposalCutoffSource;
    };

function compareIds(first: string, second: string): number {
  return first < second ? -1 : first > second ? 1 : 0;
}

function compareNumber(first: number, second: number): number {
  return first < second ? -1 : first > second ? 1 : 0;
}

function automaticProposalAttemptSummary(
  requestAttemptCount: number,
  candidates: readonly AutomaticProposalCandidateAttemptSummary[],
): AutomaticProposalAttemptSummary {
  return { requestAttemptCount, candidates: [...candidates] };
}

function baseResult(
  limits: ResolvedAutomaticProposalAttemptLimits,
  requestAttemptCount: number,
  candidates: readonly AutomaticProposalCandidateAttemptSummary[],
): AutomaticProposalResultBase {
  return {
    algorithmVersion: AUTOMATIC_PROPOSAL_ALGORITHM_VERSION,
    effectiveLimits: {
      ...limits,
      candidatePointLimit: AUTOMATIC_PROPOSAL_CANDIDATE_POINT_LIMIT,
    },
    attempts: automaticProposalAttemptSummary(
      requestAttemptCount,
      candidates,
    ),
  };
}

function reducedLimit(value: number | undefined, maximum: number): number {
  return value !== undefined && Number.isSafeInteger(value) && value >= 0
    ? Math.min(value, maximum)
    : maximum;
}

function resolveTestingLimits(
  limits: AutomaticProposalTestingLimits,
): ResolvedAutomaticProposalAttemptLimits {
  return {
    candidateAttemptLimit: reducedLimit(
      limits.candidateAttemptLimit,
      AUTOMATIC_PROPOSAL_CANDIDATE_ATTEMPT_LIMIT,
    ),
    requestAttemptLimit: reducedLimit(
      limits.requestAttemptLimit,
      AUTOMATIC_PROPOSAL_REQUEST_ATTEMPT_LIMIT,
    ),
  };
}

const PRODUCTION_ATTEMPT_LIMITS: ResolvedAutomaticProposalAttemptLimits = {
  candidateAttemptLimit: AUTOMATIC_PROPOSAL_CANDIDATE_ATTEMPT_LIMIT,
  requestAttemptLimit: AUTOMATIC_PROPOSAL_REQUEST_ATTEMPT_LIMIT,
};

export function authorizeAutomaticProposalAttempt(
  counts: AutomaticProposalAttemptCounts,
  limits: AutomaticProposalAttemptLimits = {
    candidate: AUTOMATIC_PROPOSAL_CANDIDATE_ATTEMPT_LIMIT,
    request: AUTOMATIC_PROPOSAL_REQUEST_ATTEMPT_LIMIT,
  },
): AutomaticProposalAttemptAuthorization {
  const candidateBlocked = counts.candidate >= limits.candidate;
  const requestBlocked = counts.request >= limits.request;

  if (candidateBlocked || requestBlocked) {
    return {
      authorized: false,
      counts,
      cutoffSource:
        candidateBlocked && requestBlocked
          ? "both"
          : candidateBlocked
            ? "candidate"
            : "request",
    };
  }

  return {
    authorized: true,
    counts: {
      candidate: counts.candidate + 1,
      request: counts.request + 1,
    },
  };
}

function containerVolume(container: Container): number {
  const { lengthMm, widthMm, heightMm } = container.internalDimensionsMm;
  return lengthMm * widthMm * heightMm;
}

function containerFloorArea(container: Container): number {
  const { lengthMm, widthMm } = container.internalDimensionsMm;
  return lengthMm * widthMm;
}

function compareContainers(first: Container, second: Container): number {
  return (
    compareNumber(containerVolume(first), containerVolume(second)) ||
    compareNumber(containerFloorArea(first), containerFloorArea(second)) ||
    compareNumber(
      first.internalDimensionsMm.lengthMm,
      second.internalDimensionsMm.lengthMm,
    ) ||
    compareNumber(
      first.internalDimensionsMm.widthMm,
      second.internalDimensionsMm.widthMm,
    ) ||
    compareNumber(
      first.internalDimensionsMm.heightMm,
      second.internalDimensionsMm.heightMm,
    ) ||
    compareIds(first.id, second.id)
  );
}

function cargoVolume(cargo: Cargo): number {
  const { lengthMm, widthMm, heightMm } = cargo.dimensionsMm;
  return lengthMm * widthMm * heightMm;
}

function cargoLongestEdge(cargo: Cargo): number {
  const { lengthMm, widthMm, heightMm } = cargo.dimensionsMm;
  return Math.max(lengthMm, widthMm, heightMm);
}

function compareCargoes(first: Cargo, second: Cargo): number {
  return (
    compareNumber(cargoVolume(second), cargoVolume(first)) ||
    compareNumber(cargoLongestEdge(second), cargoLongestEdge(first)) ||
    compareNumber(second.massGrams, first.massGrams) ||
    compareIds(first.id, second.id)
  );
}

interface RankedOrientation {
  readonly orientation: Orientation;
  readonly dimensions: OrientedDimensionsMm;
  readonly fixedIndex: number;
}

function compareRankedOrientations(
  first: RankedOrientation,
  second: RankedOrientation,
): number {
  return (
    compareNumber(first.dimensions.zMm, second.dimensions.zMm) ||
    compareNumber(
      first.dimensions.xMm * first.dimensions.yMm,
      second.dimensions.xMm * second.dimensions.yMm,
    ) ||
    compareNumber(first.dimensions.xMm, second.dimensions.xMm) ||
    compareNumber(first.dimensions.yMm, second.dimensions.yMm) ||
    compareNumber(first.fixedIndex, second.fixedIndex)
  );
}

export function eligibleAutomaticProposalOrientations(
  cargo: Pick<Cargo, "dimensionsMm" | "allowedOrientations">,
  container: Pick<Container, "internalDimensionsMm" | "openingMm">,
  clearancesMm: ClearancesMm,
): readonly Orientation[] {
  const { lengthMm, widthMm, heightMm } = container.internalDimensionsMm;
  const maximumX = lengthMm - clearancesMm.xMm * 2;
  const maximumY = widthMm - clearancesMm.yMm * 2;
  const maximumZ = heightMm - clearancesMm.zMm;
  const seenDimensions = new Set<string>();
  const ranked: RankedOrientation[] = [];

  ORIENTATIONS.forEach((orientation, fixedIndex) => {
    if (!cargo.allowedOrientations.includes(orientation)) {
      return;
    }
    const dimensions = orientedDimensions(cargo, orientation);
    const dimensionKey = `${dimensions.xMm}:${dimensions.yMm}:${dimensions.zMm}`;
    if (seenDimensions.has(dimensionKey)) {
      return;
    }
    seenDimensions.add(dimensionKey);

    if (
      dimensions.xMm <= maximumX &&
      dimensions.yMm <= maximumY &&
      dimensions.zMm <= maximumZ &&
      fitsRectangularOpening(
        dimensions,
        container.openingMm,
        clearancesMm,
      )
    ) {
      ranked.push({ orientation, dimensions, fixedIndex });
    }
  });

  return ranked.sort(compareRankedOrientations).map(({ orientation }) => orientation);
}

function sortedAxisValues(values: Iterable<number>, minimum: number, maximum: number) {
  return [...new Set(values)]
    .filter(
      (value) =>
        Number.isSafeInteger(value) && value >= minimum && value <= maximum,
    )
    .sort(compareNumber);
}

export function generateAutomaticProposalCandidatePoints(
  container: Pick<Container, "internalDimensionsMm">,
  dimensions: OrientedDimensionsMm,
  clearancesMm: ClearancesMm,
  placedBounds: readonly PlacementBoundsMm[],
  pointLimit: number = AUTOMATIC_PROPOSAL_CANDIDATE_POINT_LIMIT,
): readonly PositionMm[] {
  const limit = reducedLimit(
    pointLimit,
    AUTOMATIC_PROPOSAL_CANDIDATE_POINT_LIMIT,
  );
  if (limit === 0) {
    return [];
  }

  const maximumX =
    container.internalDimensionsMm.lengthMm -
    clearancesMm.xMm -
    dimensions.xMm;
  const maximumY =
    container.internalDimensionsMm.widthMm -
    clearancesMm.yMm -
    dimensions.yMm;
  const maximumZ =
    container.internalDimensionsMm.heightMm -
    clearancesMm.zMm -
    dimensions.zMm;
  const xValues = sortedAxisValues(
    [
      clearancesMm.xMm,
      maximumX,
      ...placedBounds.map((bounds) => bounds.max.xMm + clearancesMm.xMm),
    ],
    clearancesMm.xMm,
    maximumX,
  );
  const yValues = sortedAxisValues(
    [
      clearancesMm.yMm,
      maximumY,
      ...placedBounds.map((bounds) => bounds.max.yMm + clearancesMm.yMm),
    ],
    clearancesMm.yMm,
    maximumY,
  );
  const zValues = sortedAxisValues(
    [0, ...placedBounds.map((bounds) => bounds.max.zMm)],
    0,
    maximumZ,
  );
  const points: PositionMm[] = [];

  for (const zMm of zValues) {
    for (const xMm of xValues) {
      for (const yMm of yValues) {
        points.push({ xMm, yMm, zMm });
        if (points.length === limit) {
          return points;
        }
      }
    }
  }

  return points;
}

function mergedCutoffSource(
  current: AutomaticProposalCutoffSource | undefined,
  next: AutomaticProposalCutoffSource,
): AutomaticProposalCutoffSource {
  if (current === undefined || current === next) {
    return next;
  }
  return "both";
}

function includesRequestCutoff(source: AutomaticProposalCutoffSource): boolean {
  return source === "request" || source === "both";
}

function completePlan(
  project: Project,
  containerId: string,
  placements: readonly Placement[],
  validation: PlacementSetValidationResult,
): AutomaticProposalPlan | undefined {
  if (
    placements.length !== project.cargoes.length ||
    new Set(placements.map((placement) => placement.cargoId)).size !==
      project.cargoes.length ||
    placements.some((placement) => placement.containerId !== containerId) ||
    project.cargoes.some(
      (cargo) =>
        !placements.some((placement) => placement.cargoId === cargo.id),
    ) ||
    validation.kind !== "evaluated" ||
    validation.reasons.some(
      (reason) =>
        reason.status === "invalid" ||
        reason.code === "support-conditions-unverified",
    )
  ) {
    return undefined;
  }

  return {
    containerId,
    placements: placements.map((placement) => ({
      ...placement,
      positionMm: { ...placement.positionMm },
    })),
    invalidReasonCount: 0,
    unverifiedReasons: validation.reasons.filter(
      (reason): reason is AutomaticProposalUnverifiedReason =>
        reason.status === "unverified",
    ),
  };
}

function searchCandidate(
  project: Project,
  container: Container,
  cargoes: readonly Cargo[],
  attemptLimits: ResolvedAutomaticProposalAttemptLimits,
  requestAttemptCount: { value: number },
): {
  readonly result: CandidateSearchResult;
  readonly attemptCount: number;
} {
  const placed: PlacedCargo[] = [];
  let candidateAttemptCount = 0;

  const search = (depth: number): CandidateSearchResult => {
    const cargo = cargoes[depth];
    if (cargo === undefined) {
      return { kind: "exhausted" };
    }

    const orientations = eligibleAutomaticProposalOrientations(
      cargo,
      container,
      project.clearancesMm,
    );
    for (const orientation of orientations) {
      const dimensions = orientedDimensions(cargo, orientation);
      const points = generateAutomaticProposalCandidatePoints(
        container,
        dimensions,
        project.clearancesMm,
        placed.map(({ bounds }) => bounds),
        AUTOMATIC_PROPOSAL_CANDIDATE_POINT_LIMIT,
      );

      for (const positionMm of points) {
        const authorization = authorizeAutomaticProposalAttempt(
          {
            candidate: candidateAttemptCount,
            request: requestAttemptCount.value,
          },
          {
            candidate: attemptLimits.candidateAttemptLimit,
            request: attemptLimits.requestAttemptLimit,
          },
        );
        if (!authorization.authorized) {
          return {
            kind: "cutoff",
            cutoffSource: authorization.cutoffSource,
          };
        }
        candidateAttemptCount = authorization.counts.candidate;
        requestAttemptCount.value = authorization.counts.request;

        const placement: Placement = {
          cargoId: cargo.id,
          containerId: container.id,
          orientation,
          positionMm: { ...positionMm },
        };
        const partialPlacements = [
          ...placed.map(({ placement: existing }) => existing),
          placement,
        ];
        const attemptProject: Project = {
          ...project,
          placements: partialPlacements,
        };
        const validation = validatePlacementSet(attemptProject, container.id);
        if (
          validation.kind !== "evaluated" ||
          validation.reasons.some(
            (reason) =>
              reason.status === "invalid" ||
              reason.code === "support-conditions-unverified",
          )
        ) {
          continue;
        }

        if (depth === cargoes.length - 1) {
          const plan = completePlan(
            project,
            container.id,
            partialPlacements,
            validation,
          );
          if (plan !== undefined) {
            return { kind: "complete", plan };
          }
          continue;
        }

        placed.push({
          placement,
          bounds: placementBounds(cargo, placement),
        });
        const child = search(depth + 1);
        placed.pop();
        if (child.kind !== "exhausted") {
          return child;
        }
      }
    }

    return { kind: "exhausted" };
  };

  return { result: search(0), attemptCount: candidateAttemptCount };
}

function runAutomaticProposal(
  project: ValidatedAutomaticProposalProject,
  attemptLimits: ResolvedAutomaticProposalAttemptLimits,
): AutomaticProposalResult {
  if (project.cargoes.length === 0) {
    return { ...baseResult(attemptLimits, 0, []), status: "no-cargo" };
  }
  if (project.containers.length === 0) {
    return { ...baseResult(attemptLimits, 0, []), status: "no-candidates" };
  }

  const cargoes = [...project.cargoes].sort(compareCargoes);
  const containers = [...project.containers].sort(compareContainers);
  const requestAttemptCount = { value: 0 };
  const candidateSummaries: AutomaticProposalCandidateAttemptSummary[] = [];
  let priorCutoffSource: AutomaticProposalCutoffSource | undefined;

  for (const container of containers) {
    const candidateSearch = searchCandidate(
      project,
      container,
      cargoes,
      attemptLimits,
      requestAttemptCount,
    );
    if (candidateSearch.result.kind === "complete") {
      candidateSummaries.push({
        containerId: container.id,
        attemptCount: candidateSearch.attemptCount,
        outcome: "complete",
      });
      const base = baseResult(
        attemptLimits,
        requestAttemptCount.value,
        candidateSummaries,
      );
      return priorCutoffSource === undefined
        ? {
            ...base,
            status: "complete",
            plan: candidateSearch.result.plan,
          }
        : {
            ...base,
            status: "complete-with-cutoff",
            cutoffSource: priorCutoffSource,
            plan: candidateSearch.result.plan,
          };
    }

    if (candidateSearch.result.kind === "cutoff") {
      candidateSummaries.push({
        containerId: container.id,
        attemptCount: candidateSearch.attemptCount,
        outcome: "cutoff",
        cutoffSource: candidateSearch.result.cutoffSource,
      });
      priorCutoffSource = mergedCutoffSource(
        priorCutoffSource,
        candidateSearch.result.cutoffSource,
      );
      if (includesRequestCutoff(candidateSearch.result.cutoffSource)) {
        return {
          ...baseResult(
            attemptLimits,
            requestAttemptCount.value,
            candidateSummaries,
          ),
          status: "cutoff",
          cutoffSource: priorCutoffSource,
        };
      }
      continue;
    }

    candidateSummaries.push({
      containerId: container.id,
      attemptCount: candidateSearch.attemptCount,
      outcome: "exhausted",
    });
  }

  return priorCutoffSource === undefined
    ? {
        ...baseResult(
          attemptLimits,
          requestAttemptCount.value,
          candidateSummaries,
        ),
        status: "no-complete-plan",
      }
    : {
        ...baseResult(
          attemptLimits,
          requestAttemptCount.value,
          candidateSummaries,
        ),
        status: "cutoff",
        cutoffSource: priorCutoffSource,
      };
}

/**
 * Runs ADR 0004 v1 with fixed production limits. Runtime input must be checked
 * and branded by the later Worker/application boundary before this call.
 */
export function generateAutomaticProposal(
  project: ValidatedAutomaticProposalProject,
): AutomaticProposalResult {
  return runAutomaticProposal(project, PRODUCTION_ATTEMPT_LIMITS);
}

/**
 * Deterministic test seam. Overrides are ephemeral, can only reduce attempt
 * limits, and are always disclosed in the returned effectiveLimits. Candidate
 * point generation remains fixed at the ADR 0004 production limit.
 */
export function generateAutomaticProposalForTesting(
  project: ValidatedAutomaticProposalProject,
  limits: AutomaticProposalTestingLimits,
): AutomaticProposalResult {
  return runAutomaticProposal(project, resolveTestingLimits(limits));
}
