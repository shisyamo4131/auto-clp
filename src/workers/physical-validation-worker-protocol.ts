import type { Project } from "../domain/model";
import type {
  PhysicalTarget,
  PhysicalValidationReason,
  PhysicalValidationStatus,
  PlacementSetUnavailableReason,
} from "../domain/validation";

export const PHYSICAL_VALIDATION_REASON_PAGE_SIZE = 25 as const;

export type PhysicalValidationReasonStatus = "invalid" | "unverified";

export interface PhysicalValidationEvaluateRequest {
  readonly type: "evaluate";
  readonly generation: number;
  readonly project: Project;
  readonly containerId: string;
}

export interface PhysicalValidationReasonPageRequest {
  readonly type: "reason-page";
  readonly generation: number;
  readonly requestId: number;
  readonly status: PhysicalValidationReasonStatus;
  readonly offset: number;
  readonly limit: typeof PHYSICAL_VALIDATION_REASON_PAGE_SIZE;
}

export type PhysicalValidationWorkerRequest =
  | PhysicalValidationEvaluateRequest
  | PhysicalValidationReasonPageRequest;

export interface EvaluatedPhysicalValidationSummary {
  readonly kind: "evaluated";
  readonly status: PhysicalValidationStatus;
  readonly invalidCount: number;
  readonly unverifiedCount: number;
  readonly placementCount: number;
}

export interface UnavailablePhysicalValidationSummary {
  readonly kind: "unavailable";
  readonly code: PlacementSetUnavailableReason["code"];
  readonly target?: PhysicalTarget;
  readonly issueCount: number;
  readonly placementCount: number;
}

export type PhysicalValidationEvaluationSummary =
  | EvaluatedPhysicalValidationSummary
  | UnavailablePhysicalValidationSummary;

export interface PhysicalValidationEvaluationReadyResponse {
  readonly type: "evaluation-ready";
  readonly generation: number;
  readonly summary: PhysicalValidationEvaluationSummary;
}

export interface PhysicalValidationReasonPageReadyResponse {
  readonly type: "reason-page-ready";
  readonly generation: number;
  readonly requestId: number;
  readonly status: PhysicalValidationReasonStatus;
  readonly offset: number;
  readonly total: number;
  readonly reasons: readonly PhysicalValidationReason[];
}

export type PhysicalValidationWorkerFailureCode =
  | "invalid-request"
  | "generation-mismatch"
  | "evaluation-not-ready"
  | "engine-failure";

export interface PhysicalValidationWorkerFailedResponse {
  readonly type: "worker-failed";
  readonly generation: number;
  readonly code: PhysicalValidationWorkerFailureCode;
}

export type PhysicalValidationWorkerResponse =
  | PhysicalValidationEvaluationReadyResponse
  | PhysicalValidationReasonPageReadyResponse
  | PhysicalValidationWorkerFailedResponse;

const INVALID_REASON_CODES = new Set([
  "floor-penetration",
  "outside-container",
  "container-clearance-not-met",
  "positive-volume-overlap",
  "axis-clearance-not-met",
  "opening-no-fitting-orientation",
  "support-permission-denied",
  "support-contact-invalid",
  "payload-capacity-exceeded",
]);

const UNVERIFIED_REASON_CODES = new Set([
  "support-conditions-unverified",
]);

const UNAVAILABLE_CODES = new Set([
  "physical.semantic-input-invalid",
  "physical.container-not-found",
  "physical.payload-calculation-unavailable",
  "physical.geometry-calculation-unavailable",
]);

const WORKER_FAILURE_CODES = new Set<PhysicalValidationWorkerFailureCode>([
  "invalid-request",
  "generation-mismatch",
  "evaluation-not-ready",
  "engine-failure",
]);

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null;
}

function isNonnegativeSafeInteger(value: unknown): value is number {
  return Number.isSafeInteger(value) && (value as number) >= 0;
}

function isPhysicalTarget(value: unknown): value is PhysicalTarget {
  return (
    isRecord(value) &&
    (value.kind === "cargo" || value.kind === "container") &&
    typeof value.id === "string"
  );
}

function isPhysicalValidationReason(value: unknown): value is PhysicalValidationReason {
  if (
    !isRecord(value) ||
    !isPhysicalTarget(value.target) ||
    !Array.isArray(value.relatedCargoIds) ||
    !value.relatedCargoIds.every((id) => typeof id === "string")
  ) {
    return false;
  }

  return (
    (value.status === "invalid" &&
      typeof value.code === "string" &&
      INVALID_REASON_CODES.has(value.code)) ||
    (value.status === "unverified" &&
      typeof value.code === "string" &&
      UNVERIFIED_REASON_CODES.has(value.code))
  );
}

function isEvaluationSummary(value: unknown): value is PhysicalValidationEvaluationSummary {
  if (!isRecord(value) || !isNonnegativeSafeInteger(value.placementCount)) {
    return false;
  }

  if (value.kind === "evaluated") {
    return (
      (value.status === "valid" ||
        value.status === "invalid" ||
        value.status === "unverified") &&
      isNonnegativeSafeInteger(value.invalidCount) &&
      isNonnegativeSafeInteger(value.unverifiedCount)
    );
  }

  return (
    value.kind === "unavailable" &&
    typeof value.code === "string" &&
    UNAVAILABLE_CODES.has(value.code) &&
    isNonnegativeSafeInteger(value.issueCount) &&
    (value.target === undefined || isPhysicalTarget(value.target))
  );
}

export function isPhysicalValidationWorkerResponse(
  value: unknown,
): value is PhysicalValidationWorkerResponse {
  if (!isRecord(value) || !isNonnegativeSafeInteger(value.generation)) {
    return false;
  }

  if (value.type === "evaluation-ready") {
    return !("reasons" in value) && isEvaluationSummary(value.summary);
  }

  if (value.type === "reason-page-ready") {
    const expectedReasonCount =
      typeof value.offset === "number" && typeof value.total === "number"
        ? Math.min(
            PHYSICAL_VALIDATION_REASON_PAGE_SIZE,
            Math.max(0, value.total - value.offset),
          )
        : -1;
    return (
      isNonnegativeSafeInteger(value.requestId) &&
      (value.status === "invalid" || value.status === "unverified") &&
      isNonnegativeSafeInteger(value.offset) &&
      value.offset % PHYSICAL_VALIDATION_REASON_PAGE_SIZE === 0 &&
      isNonnegativeSafeInteger(value.total) &&
      Array.isArray(value.reasons) &&
      value.reasons.length === expectedReasonCount &&
      value.reasons.every(
        (reason) =>
          isPhysicalValidationReason(reason) && reason.status === value.status,
      )
    );
  }

  return (
    value.type === "worker-failed" &&
    typeof value.code === "string" &&
    WORKER_FAILURE_CODES.has(value.code as PhysicalValidationWorkerFailureCode)
  );
}
