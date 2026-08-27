import type { Project } from "../domain/model";

export interface ProjectImportPreflightRequest {
  readonly type: "project-import-preflight";
  readonly requestId: number;
  readonly project: Project;
}

export type ProjectImportPreflightFailureCode =
  | "invalid-request"
  | "physical-validation-unavailable"
  | "engine-failure";

export type ProjectImportPreflightResponse =
  | {
      readonly type: "project-import-preflight-ready";
      readonly requestId: number;
    }
  | {
      readonly type: "project-import-preflight-failed";
      readonly requestId: number;
      readonly code: ProjectImportPreflightFailureCode;
    };

const FAILURE_CODES = new Set<ProjectImportPreflightFailureCode>([
  "invalid-request",
  "physical-validation-unavailable",
  "engine-failure",
]);

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null;
}

export function isProjectImportPreflightResponse(
  value: unknown,
): value is ProjectImportPreflightResponse {
  if (
    !isRecord(value) ||
    !Number.isSafeInteger(value.requestId) ||
    (value.requestId as number) < 0
  ) {
    return false;
  }
  if (value.type === "project-import-preflight-ready") {
    return Object.keys(value).every((key) =>
      key === "type" || key === "requestId",
    );
  }
  return (
    value.type === "project-import-preflight-failed" &&
    typeof value.code === "string" &&
    FAILURE_CODES.has(value.code as ProjectImportPreflightFailureCode) &&
    Object.keys(value).every(
      (key) => key === "type" || key === "requestId" || key === "code",
    )
  );
}
