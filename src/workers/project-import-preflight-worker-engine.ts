import { validatePlacementSet } from "../domain/validation";
import type {
  ProjectImportPreflightRequest,
  ProjectImportPreflightResponse,
} from "./project-import-preflight-protocol";

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null;
}

function requestId(value: unknown): number {
  return isRecord(value) &&
    typeof value.requestId === "number" &&
    Number.isSafeInteger(value.requestId) &&
    value.requestId >= 0
    ? value.requestId
    : 0;
}

export class ProjectImportPreflightWorkerEngine {
  handle(value: unknown): ProjectImportPreflightResponse {
    const id = requestId(value);
    try {
      if (
        !isRecord(value) ||
        value.type !== "project-import-preflight" ||
        typeof value.requestId !== "number" ||
        !Number.isSafeInteger(value.requestId) ||
        value.requestId < 0 ||
        !isRecord(value.project)
      ) {
        return {
          type: "project-import-preflight-failed",
          requestId: id,
          code: "invalid-request",
        };
      }

      const request = value as unknown as ProjectImportPreflightRequest;
      for (const container of request.project.containers) {
        const result = validatePlacementSet(request.project, container.id);
        if (result.kind === "unavailable") {
          return {
            type: "project-import-preflight-failed",
            requestId: request.requestId,
            code: "physical-validation-unavailable",
          };
        }
      }
      return {
        type: "project-import-preflight-ready",
        requestId: request.requestId,
      };
    } catch {
      return {
        type: "project-import-preflight-failed",
        requestId: id,
        code: "engine-failure",
      };
    }
  }
}
