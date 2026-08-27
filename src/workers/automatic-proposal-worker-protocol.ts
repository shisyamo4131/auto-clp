import {
  AUTOMATIC_PROPOSAL_ALGORITHM_VERSION,
  AUTOMATIC_PROPOSAL_CANDIDATE_ATTEMPT_LIMIT,
  AUTOMATIC_PROPOSAL_CANDIDATE_POINT_LIMIT,
  AUTOMATIC_PROPOSAL_REQUEST_ATTEMPT_LIMIT,
  type AutomaticProposalCandidateAttemptSummary,
  type AutomaticProposalCutoffSource,
  type AutomaticProposalPlan,
  type AutomaticProposalResult,
  type AutomaticProposalUnverifiedReason,
} from "../domain/automatic-proposal";
import { ORIENTATIONS, type Orientation, type Placement, type Project } from "../domain/model";

const MAX_CANDIDATES = 100;
const MAX_PLACEMENTS = 1_000;
const MIN_COORDINATE_MM = -1_000_000;
const MAX_COORDINATE_MM = 1_000_000;
const ID_PATTERN = /^[A-Za-z0-9][A-Za-z0-9._-]{0,63}$/;

export interface AutomaticProposalWorkerRequest {
  readonly type: "automatic-proposal.generate";
  readonly requestId: number;
  readonly project: Project;
}

export type AutomaticProposalWorkerFailureCode =
  | "invalid-request"
  | "input-invalid"
  | "engine-failure";

export type AutomaticProposalWorkerResponse =
  | {
      readonly type: "automatic-proposal.ready";
      readonly requestId: number;
      readonly result: AutomaticProposalResult;
    }
  | {
      readonly type: "automatic-proposal.failed";
      readonly requestId: number;
      readonly code: AutomaticProposalWorkerFailureCode;
    };

const FAILURE_CODES = new Set<AutomaticProposalWorkerFailureCode>([
  "invalid-request",
  "input-invalid",
  "engine-failure",
]);
const CUTOFF_SOURCES = new Set<AutomaticProposalCutoffSource>([
  "candidate",
  "request",
  "both",
]);
const ORIENTATION_SET = new Set<Orientation>(ORIENTATIONS);
const UNVERIFIED_REASON_CODES = new Set([
  "opening-path-unverified",
  "structure-stability-unverified",
]);

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function hasExactKeys(
  value: Record<string, unknown>,
  keys: readonly string[],
): boolean {
  const actualKeys = Object.keys(value);
  return (
    actualKeys.length === keys.length &&
    keys.every((key) => Object.prototype.hasOwnProperty.call(value, key))
  );
}

function isNonnegativeSafeInteger(value: unknown, maximum: number): value is number {
  return (
    Number.isSafeInteger(value) &&
    (value as number) >= 0 &&
    (value as number) <= maximum
  );
}

function isId(value: unknown): value is string {
  return typeof value === "string" && ID_PATTERN.test(value);
}

function isCutoffSource(value: unknown): value is AutomaticProposalCutoffSource {
  return (
    typeof value === "string" &&
    CUTOFF_SOURCES.has(value as AutomaticProposalCutoffSource)
  );
}

function isPosition(value: unknown): boolean {
  if (!isRecord(value) || !hasExactKeys(value, ["xMm", "yMm", "zMm"])) {
    return false;
  }
  return [value.xMm, value.yMm, value.zMm].every(
    (coordinate) =>
      Number.isSafeInteger(coordinate) &&
      (coordinate as number) >= MIN_COORDINATE_MM &&
      (coordinate as number) <= MAX_COORDINATE_MM,
  );
}

function isPlacement(value: unknown): value is Placement {
  return (
    isRecord(value) &&
    hasExactKeys(value, ["cargoId", "containerId", "orientation", "positionMm"]) &&
    isId(value.cargoId) &&
    isId(value.containerId) &&
    typeof value.orientation === "string" &&
    ORIENTATION_SET.has(value.orientation as Orientation) &&
    isPosition(value.positionMm)
  );
}

function isSortedUniqueIds(value: unknown, maximumLength: number): value is string[] {
  if (!Array.isArray(value) || value.length > maximumLength) {
    return false;
  }
  return value.every(
    (id, index) =>
      isId(id) && (index === 0 || (value[index - 1] as string) < id),
  );
}

function isUnverifiedReason(
  value: unknown,
  cargoIds: ReadonlySet<string>,
): value is AutomaticProposalUnverifiedReason {
  if (
    !isRecord(value) ||
    !hasExactKeys(value, ["status", "code", "target", "relatedCargoIds"]) ||
    value.status !== "unverified" ||
    typeof value.code !== "string" ||
    !UNVERIFIED_REASON_CODES.has(value.code) ||
    !isRecord(value.target) ||
    !hasExactKeys(value.target, ["kind", "id"]) ||
    value.target.kind !== "cargo" ||
    !isId(value.target.id) ||
    !cargoIds.has(value.target.id) ||
    !isSortedUniqueIds(value.relatedCargoIds, MAX_PLACEMENTS)
  ) {
    return false;
  }

  const targetId = value.target.id;
  if (
    !value.relatedCargoIds.every(
      (id) => cargoIds.has(id) && id !== targetId,
    )
  ) {
    return false;
  }

  return value.code === "opening-path-unverified"
    ? value.relatedCargoIds.length === 0
    : value.relatedCargoIds.length > 0;
}

function isPlan(value: unknown): value is AutomaticProposalPlan {
  if (
    !isRecord(value) ||
    !hasExactKeys(value, [
      "containerId",
      "placements",
      "invalidReasonCount",
      "unverifiedReasons",
    ]) ||
    !isId(value.containerId) ||
    value.invalidReasonCount !== 0 ||
    !Array.isArray(value.placements) ||
    value.placements.length === 0 ||
    value.placements.length > MAX_PLACEMENTS ||
    !value.placements.every(isPlacement)
  ) {
    return false;
  }

  const placements = value.placements as readonly Placement[];
  const cargoIds = new Set(placements.map(({ cargoId }) => cargoId));
  if (
    cargoIds.size !== placements.length ||
    placements.some(({ containerId }) => containerId !== value.containerId) ||
    !Array.isArray(value.unverifiedReasons) ||
    value.unverifiedReasons.length > placements.length * 2 ||
    !value.unverifiedReasons.every((reason) =>
      isUnverifiedReason(reason, cargoIds),
    )
  ) {
    return false;
  }

  const reasonKeys = new Set<string>();
  for (const reason of value.unverifiedReasons) {
    const key = `${reason.code}:${reason.target.id}:${reason.relatedCargoIds.join(",")}`;
    if (reasonKeys.has(key)) {
      return false;
    }
    reasonKeys.add(key);
  }
  return true;
}

function isCandidateSummary(
  value: unknown,
): value is AutomaticProposalCandidateAttemptSummary {
  if (
    !isRecord(value) ||
    !isId(value.containerId) ||
    !isNonnegativeSafeInteger(
      value.attemptCount,
      AUTOMATIC_PROPOSAL_CANDIDATE_ATTEMPT_LIMIT,
    )
  ) {
    return false;
  }

  if (value.outcome === "cutoff") {
    return (
      hasExactKeys(value, [
        "containerId",
        "attemptCount",
        "outcome",
        "cutoffSource",
      ]) && isCutoffSource(value.cutoffSource)
    );
  }
  return (
    (value.outcome === "complete" || value.outcome === "exhausted") &&
    hasExactKeys(value, ["containerId", "attemptCount", "outcome"])
  );
}

function isAttemptSummary(value: unknown): boolean {
  if (
    !isRecord(value) ||
    !hasExactKeys(value, ["requestAttemptCount", "candidates"]) ||
    !isNonnegativeSafeInteger(
      value.requestAttemptCount,
      AUTOMATIC_PROPOSAL_REQUEST_ATTEMPT_LIMIT,
    ) ||
    !Array.isArray(value.candidates) ||
    value.candidates.length > MAX_CANDIDATES ||
    !value.candidates.every(isCandidateSummary)
  ) {
    return false;
  }

  const candidates = value.candidates as readonly AutomaticProposalCandidateAttemptSummary[];
  const ids = new Set(candidates.map(({ containerId }) => containerId));
  if (ids.size !== candidates.length) {
    return false;
  }

  let prefixRequestAttemptCount = 0;
  let requestCutoffReached = false;
  for (const candidate of candidates) {
    if (requestCutoffReached) {
      return false;
    }
    prefixRequestAttemptCount += candidate.attemptCount;
    if (prefixRequestAttemptCount > AUTOMATIC_PROPOSAL_REQUEST_ATTEMPT_LIMIT) {
      return false;
    }
    if (candidate.outcome !== "cutoff") {
      continue;
    }
    const candidateBlocked =
      candidate.attemptCount === AUTOMATIC_PROPOSAL_CANDIDATE_ATTEMPT_LIMIT;
    const requestBlocked =
      prefixRequestAttemptCount === AUTOMATIC_PROPOSAL_REQUEST_ATTEMPT_LIMIT;
    const validSource = candidate.cutoffSource === "both"
      ? candidateBlocked && requestBlocked
      : candidate.cutoffSource === "candidate"
        ? candidateBlocked && !requestBlocked
        : requestBlocked && !candidateBlocked;
    if (!validSource) {
      return false;
    }
    requestCutoffReached = requestBlocked;
  }

  return prefixRequestAttemptCount === value.requestAttemptCount;
}

function mergedCutoffSource(
  candidates: readonly AutomaticProposalCandidateAttemptSummary[],
): AutomaticProposalCutoffSource | undefined {
  let source: AutomaticProposalCutoffSource | undefined;
  for (const candidate of candidates) {
    if (candidate.outcome !== "cutoff") {
      continue;
    }
    if (source === undefined) {
      source = candidate.cutoffSource;
    } else if (source !== candidate.cutoffSource) {
      source = "both";
    }
  }
  return source;
}

function hasValidBase(value: Record<string, unknown>): boolean {
  return (
    value.algorithmVersion === AUTOMATIC_PROPOSAL_ALGORITHM_VERSION &&
    isRecord(value.effectiveLimits) &&
    hasExactKeys(value.effectiveLimits, [
      "candidateAttemptLimit",
      "requestAttemptLimit",
      "candidatePointLimit",
    ]) &&
    value.effectiveLimits.candidateAttemptLimit ===
      AUTOMATIC_PROPOSAL_CANDIDATE_ATTEMPT_LIMIT &&
    value.effectiveLimits.requestAttemptLimit ===
      AUTOMATIC_PROPOSAL_REQUEST_ATTEMPT_LIMIT &&
    value.effectiveLimits.candidatePointLimit ===
      AUTOMATIC_PROPOSAL_CANDIDATE_POINT_LIMIT &&
    isAttemptSummary(value.attempts)
  );
}

function isAutomaticProposalResult(value: unknown): value is AutomaticProposalResult {
  if (!isRecord(value) || !hasValidBase(value)) {
    return false;
  }
  const attempts = value.attempts as {
    readonly requestAttemptCount: number;
    readonly candidates: readonly AutomaticProposalCandidateAttemptSummary[];
  };
  const candidates = attempts.candidates;
  const lastCandidate = candidates.at(-1);
  const cutoffSource = mergedCutoffSource(candidates);

  if (value.status === "no-cargo" || value.status === "no-candidates") {
    return (
      hasExactKeys(value, ["algorithmVersion", "effectiveLimits", "attempts", "status"]) &&
      attempts.requestAttemptCount === 0 &&
      candidates.length === 0
    );
  }
  if (value.status === "no-complete-plan") {
    return (
      hasExactKeys(value, ["algorithmVersion", "effectiveLimits", "attempts", "status"]) &&
      candidates.length > 0 &&
      candidates.every(({ outcome }) => outcome === "exhausted")
    );
  }
  if (value.status === "cutoff") {
    return (
      hasExactKeys(value, [
        "algorithmVersion",
        "effectiveLimits",
        "attempts",
        "status",
        "cutoffSource",
      ]) &&
      isCutoffSource(value.cutoffSource) &&
      cutoffSource === value.cutoffSource &&
      candidates.every(({ outcome }) => outcome !== "complete")
    );
  }
  if (value.status === "complete") {
    return (
      hasExactKeys(value, [
        "algorithmVersion",
        "effectiveLimits",
        "attempts",
        "status",
        "plan",
      ]) &&
      cutoffSource === undefined &&
      lastCandidate?.outcome === "complete" &&
      candidates.slice(0, -1).every(({ outcome }) => outcome !== "complete") &&
      isPlan(value.plan) &&
      value.plan.containerId === lastCandidate.containerId &&
      lastCandidate.attemptCount >= value.plan.placements.length
    );
  }
  if (value.status === "complete-with-cutoff") {
    return (
      hasExactKeys(value, [
        "algorithmVersion",
        "effectiveLimits",
        "attempts",
        "status",
        "cutoffSource",
        "plan",
      ]) &&
      isCutoffSource(value.cutoffSource) &&
      cutoffSource === value.cutoffSource &&
      lastCandidate?.outcome === "complete" &&
      candidates.slice(0, -1).every(({ outcome }) => outcome !== "complete") &&
      isPlan(value.plan) &&
      value.plan.containerId === lastCandidate.containerId &&
      lastCandidate.attemptCount >= value.plan.placements.length
    );
  }
  return false;
}

export function isAutomaticProposalWorkerResponse(
  value: unknown,
): value is AutomaticProposalWorkerResponse {
  if (
    !isRecord(value) ||
    !isNonnegativeSafeInteger(value.requestId, Number.MAX_SAFE_INTEGER)
  ) {
    return false;
  }
  if (value.type === "automatic-proposal.ready") {
    return (
      hasExactKeys(value, ["type", "requestId", "result"]) &&
      isAutomaticProposalResult(value.result)
    );
  }
  return (
    value.type === "automatic-proposal.failed" &&
    hasExactKeys(value, ["type", "requestId", "code"]) &&
    typeof value.code === "string" &&
    FAILURE_CODES.has(value.code as AutomaticProposalWorkerFailureCode)
  );
}
