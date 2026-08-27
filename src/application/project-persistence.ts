import type { Project } from "../domain/model";
import type { ProjectImportPreflightClientResult } from "../persistence/project-import-preflight-client";
import {
  MAX_PROJECT_FILE_BYTES,
  serializeProjectJson,
  type ProjectJsonSource,
} from "../persistence/project-json";
import { importProject } from "./project-import";

export type ProjectPersistenceFailureCode =
  | "persistence.operation-busy"
  | "persistence.stale-base"
  | "persistence.unexpected-failure"
  | "persistence.serialize-failed"
  | "persistence.serialize-invalid"
  | "persistence.serialize-size-exceeded"
  | "persistence.import-size-invalid"
  | "persistence.import-size-exceeded"
  | "persistence.import-read-failed"
  | "persistence.import-syntax-invalid"
  | "persistence.import-version-unsupported"
  | "persistence.import-schema-invalid"
  | "persistence.import-semantic-invalid"
  | "persistence.import-preflight-failed"
  | "persistence.device-unavailable"
  | "persistence.device-open-failed"
  | "persistence.device-read-failed"
  | "persistence.device-write-failed"
  | "persistence.device-delete-failed"
  | "persistence.device-not-found"
  | "persistence.device-data-invalid"
  | "persistence.file-import-unavailable"
  | "persistence.file-export-unavailable"
  | "persistence.file-download-failed";

export type ProjectPersistenceActionResult =
  | { readonly ok: true }
  | { readonly ok: false; readonly code: ProjectPersistenceFailureCode };

export type PreparedProjectPersistenceResult =
  | { readonly ok: true; readonly project: Project }
  | { readonly ok: false; readonly code: ProjectPersistenceFailureCode };

export type SerializedProjectPersistenceResult =
  | { readonly ok: true; readonly json: string }
  | { readonly ok: false; readonly code: ProjectPersistenceFailureCode };

const textEncoder = new TextEncoder();

export function serializeProjectForPersistence(
  project: Project,
): SerializedProjectPersistenceResult {
  const result = serializeProjectJson(project);
  if (!result.ok) {
    return {
      ok: false,
      code:
        result.stage === "serialize"
          ? "persistence.serialize-failed"
          : "persistence.serialize-invalid",
    };
  }
  if (textEncoder.encode(result.json).byteLength > MAX_PROJECT_FILE_BYTES) {
    return { ok: false, code: "persistence.serialize-size-exceeded" };
  }
  return result;
}

function importFailureCode(
  stage: "size" | "read" | "syntax" | "version" | "schema" | "semantic" | "derive",
  issueCode?: string,
): ProjectPersistenceFailureCode {
  switch (stage) {
    case "size":
      return issueCode === "size.exceeded"
        ? "persistence.import-size-exceeded"
        : "persistence.import-size-invalid";
    case "read":
      return "persistence.import-read-failed";
    case "syntax":
      return "persistence.import-syntax-invalid";
    case "version":
      return "persistence.import-version-unsupported";
    case "schema":
      return "persistence.import-schema-invalid";
    case "semantic":
      return "persistence.import-semantic-invalid";
    case "derive":
      return "persistence.import-preflight-failed";
  }
}

export async function prepareProjectImport(
  currentProject: Project,
  source: ProjectJsonSource,
  preflight: (project: Project) => Promise<ProjectImportPreflightClientResult>,
): Promise<PreparedProjectPersistenceResult> {
  const result = await importProject(
    { project: currentProject, derived: undefined },
    source,
    async (project) => {
      const preflightResult = await preflight(project);
      if (!preflightResult.ok) {
        throw new Error("project import preflight failed");
      }
      return undefined;
    },
  );
  if (!result.ok) {
    return {
      ok: false,
      code: importFailureCode(result.stage, result.issues[0]?.code),
    };
  }
  return { ok: true, project: result.nextState.project };
}
