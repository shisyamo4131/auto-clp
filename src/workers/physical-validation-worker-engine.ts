import { validatePlacementSet } from "../domain/validation";
import type { PhysicalValidationReason } from "../domain/validation";
import {
  PHYSICAL_VALIDATION_REASON_PAGE_SIZE,
  type PhysicalValidationEvaluationSummary,
  type PhysicalValidationReasonPageRequest,
  type PhysicalValidationWorkerRequest,
  type PhysicalValidationWorkerResponse,
} from "./physical-validation-worker-protocol";

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null;
}

function requestGeneration(value: unknown): number {
  if (
    isRecord(value) &&
    typeof value.generation === "number" &&
    Number.isSafeInteger(value.generation) &&
    value.generation >= 0
  ) {
    return value.generation;
  }
  return 0;
}

function validReasonPageRequest(
  request: PhysicalValidationReasonPageRequest,
): boolean {
  return (
    Number.isSafeInteger(request.generation) &&
    request.generation >= 0 &&
    Number.isSafeInteger(request.requestId) &&
    request.requestId >= 0 &&
    (request.status === "invalid" || request.status === "unverified") &&
    Number.isSafeInteger(request.offset) &&
    request.offset >= 0 &&
    request.offset % PHYSICAL_VALIDATION_REASON_PAGE_SIZE === 0 &&
    request.limit === PHYSICAL_VALIDATION_REASON_PAGE_SIZE
  );
}

function evaluationSummary(
  request: Extract<PhysicalValidationWorkerRequest, { type: "evaluate" }>,
  invalidReasons: readonly PhysicalValidationReason[],
  unverifiedReasons: readonly PhysicalValidationReason[],
  result: ReturnType<typeof validatePlacementSet>,
): PhysicalValidationEvaluationSummary {
  const placementCount = request.project.placements.filter(
    (placement) => placement.containerId === request.containerId,
  ).length;

  if (result.kind === "evaluated") {
    return {
      kind: result.kind,
      status: result.status,
      invalidCount: invalidReasons.length,
      unverifiedCount: unverifiedReasons.length,
      placementCount,
    };
  }

  return {
    kind: result.kind,
    code: result.reason.code,
    ...(result.reason.code === "physical.semantic-input-invalid"
      ? { issueCount: result.reason.issues.length }
      : { issueCount: 0, target: result.reason.target }),
    placementCount,
  };
}

export class PhysicalValidationWorkerEngine {
  private generation?: number;
  private result?: ReturnType<typeof validatePlacementSet>;
  private invalidReasons: readonly PhysicalValidationReason[] = [];
  private unverifiedReasons: readonly PhysicalValidationReason[] = [];

  handle(requestValue: unknown): PhysicalValidationWorkerResponse {
    const generation = requestGeneration(requestValue);
    try {
      if (!isRecord(requestValue) || typeof requestValue.type !== "string") {
        return { type: "worker-failed", generation, code: "invalid-request" };
      }

      if (requestValue.type === "evaluate") {
        const request = requestValue as unknown as Extract<
          PhysicalValidationWorkerRequest,
          { type: "evaluate" }
        >;
        if (
          !Number.isSafeInteger(request.generation) ||
          request.generation < 0 ||
          typeof request.containerId !== "string" ||
          !isRecord(request.project)
        ) {
          return { type: "worker-failed", generation, code: "invalid-request" };
        }

        const result = validatePlacementSet(request.project, request.containerId);
        const reasons = result.kind === "evaluated" ? result.reasons : [];
        const invalidReasons = reasons.filter((reason) => reason.status === "invalid");
        const unverifiedReasons = reasons.filter(
          (reason) => reason.status === "unverified",
        );

        this.generation = request.generation;
        this.result = result;
        this.invalidReasons = invalidReasons;
        this.unverifiedReasons = unverifiedReasons;

        return {
          type: "evaluation-ready",
          generation: request.generation,
          summary: evaluationSummary(
            request,
            invalidReasons,
            unverifiedReasons,
            result,
          ),
        };
      }

      if (requestValue.type !== "reason-page") {
        return { type: "worker-failed", generation, code: "invalid-request" };
      }

      const request = requestValue as unknown as PhysicalValidationReasonPageRequest;
      if (!validReasonPageRequest(request)) {
        return { type: "worker-failed", generation, code: "invalid-request" };
      }
      if (this.generation === undefined || this.result === undefined) {
        return { type: "worker-failed", generation, code: "evaluation-not-ready" };
      }
      if (request.generation !== this.generation) {
        return { type: "worker-failed", generation, code: "generation-mismatch" };
      }

      const reasons =
        request.status === "invalid" ? this.invalidReasons : this.unverifiedReasons;
      return {
        type: "reason-page-ready",
        generation: request.generation,
        requestId: request.requestId,
        status: request.status,
        offset: request.offset,
        total: reasons.length,
        reasons: reasons.slice(request.offset, request.offset + request.limit),
      };
    } catch {
      return { type: "worker-failed", generation, code: "engine-failure" };
    }
  }
}
