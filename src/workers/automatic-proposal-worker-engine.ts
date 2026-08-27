import {
  generateAutomaticProposal,
  type ValidatedAutomaticProposalProject,
} from "../domain/automatic-proposal";
import { validateProjectReferences } from "../domain/validation";
import { validateProjectJsonSchema } from "../persistence/project-json-schema";
import type { AutomaticProposalWorkerResponse } from "./automatic-proposal-worker-protocol";

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function hasExactRequestKeys(value: Record<string, unknown>): boolean {
  const keys = Object.keys(value);
  return (
    keys.length === 3 &&
    Object.prototype.hasOwnProperty.call(value, "type") &&
    Object.prototype.hasOwnProperty.call(value, "requestId") &&
    Object.prototype.hasOwnProperty.call(value, "project")
  );
}

function responseRequestId(value: unknown): number {
  return isRecord(value) &&
    Number.isSafeInteger(value.requestId) &&
    (value.requestId as number) >= 0
    ? (value.requestId as number)
    : 0;
}

export class AutomaticProposalWorkerEngine {
  handle(value: unknown): AutomaticProposalWorkerResponse {
    const requestId = responseRequestId(value);
    try {
      if (
        !isRecord(value) ||
        !hasExactRequestKeys(value) ||
        value.type !== "automatic-proposal.generate" ||
        !Number.isSafeInteger(value.requestId) ||
        (value.requestId as number) < 0
      ) {
        return {
          type: "automatic-proposal.failed",
          requestId,
          code: "invalid-request",
        };
      }

      const schema = validateProjectJsonSchema(value.project);
      if (!schema.valid || validateProjectReferences(schema.project).length > 0) {
        return {
          type: "automatic-proposal.failed",
          requestId,
          code: "input-invalid",
        };
      }

      // This is the sole brand cast: both authoritative boundary validations
      // have succeeded immediately above, and this module exposes no factory.
      const project = schema.project as ValidatedAutomaticProposalProject;
      return {
        type: "automatic-proposal.ready",
        requestId,
        result: generateAutomaticProposal(project),
      };
    } catch {
      return {
        type: "automatic-proposal.failed",
        requestId,
        code: "engine-failure",
      };
    }
  }
}
