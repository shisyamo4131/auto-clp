import type { Project } from "../domain/model";
import {
  isProjectImportPreflightResponse,
  type ProjectImportPreflightRequest,
} from "../workers/project-import-preflight-protocol";

export type ProjectImportPreflightClientFailureCode =
  | "preflight.worker-unsupported"
  | "preflight.worker-construction-failed"
  | "preflight.worker-post-failed"
  | "preflight.worker-runtime-failed"
  | "preflight.worker-message-failed"
  | "preflight.worker-response-invalid"
  | "preflight.physical-validation-unavailable"
  | "preflight.engine-failed";

export type ProjectImportPreflightClientResult =
  | { readonly ok: true }
  | {
      readonly ok: false;
      readonly code: ProjectImportPreflightClientFailureCode;
    };

export function preflightImportedProject(
  project: Project,
): Promise<ProjectImportPreflightClientResult> {
  if (typeof Worker === "undefined") {
    return Promise.resolve({ ok: false, code: "preflight.worker-unsupported" });
  }

  return new Promise((resolve) => {
    let worker: Worker;
    try {
      worker = new Worker(
        new URL("../workers/project-import-preflight.worker.ts", import.meta.url),
        { type: "module" },
      );
    } catch {
      resolve({ ok: false, code: "preflight.worker-construction-failed" });
      return;
    }

    const requestId = 1;
    let settled = false;
    const finish = (result: ProjectImportPreflightClientResult) => {
      if (settled) {
        return;
      }
      settled = true;
      try {
        worker.terminate();
      } catch {
        // The one-shot request is already settled; termination remains best-effort.
      }
      resolve(result);
    };

    worker.onmessage = (event: MessageEvent<unknown>) => {
      if (
        !isProjectImportPreflightResponse(event.data) ||
        event.data.requestId !== requestId
      ) {
        finish({ ok: false, code: "preflight.worker-response-invalid" });
        return;
      }
      if (event.data.type === "project-import-preflight-ready") {
        finish({ ok: true });
        return;
      }
      finish({
        ok: false,
        code:
          event.data.code === "physical-validation-unavailable"
            ? "preflight.physical-validation-unavailable"
            : "preflight.engine-failed",
      });
    };
    worker.onerror = () => {
      finish({ ok: false, code: "preflight.worker-runtime-failed" });
    };
    worker.onmessageerror = () => {
      finish({ ok: false, code: "preflight.worker-message-failed" });
    };

    const request: ProjectImportPreflightRequest = {
      type: "project-import-preflight",
      requestId,
      project,
    };
    try {
      worker.postMessage(request);
    } catch {
      finish({ ok: false, code: "preflight.worker-post-failed" });
    }
  });
}
