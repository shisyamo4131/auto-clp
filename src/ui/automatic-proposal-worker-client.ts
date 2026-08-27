import type { AutomaticProposalResult } from "../domain/automatic-proposal";
import type { Project } from "../domain/model";
import {
  isAutomaticProposalWorkerResponse,
  type AutomaticProposalWorkerFailureCode,
  type AutomaticProposalWorkerRequest,
} from "../workers/automatic-proposal-worker-protocol";

const REQUEST_ID = 1;

export type AutomaticProposalWorkerClientFailureCode =
  | "automatic-proposal.worker-unsupported"
  | "automatic-proposal.worker-construction-failed"
  | "automatic-proposal.worker-post-failed"
  | "automatic-proposal.worker-runtime-failed"
  | "automatic-proposal.worker-message-failed"
  | "automatic-proposal.worker-response-invalid"
  | "automatic-proposal.invalid-request"
  | "automatic-proposal.input-invalid"
  | "automatic-proposal.engine-failure";

export type AutomaticProposalWorkerClientResult =
  | {
      readonly kind: "ready";
      readonly result: AutomaticProposalResult;
    }
  | {
      readonly kind: "failed";
      readonly code: AutomaticProposalWorkerClientFailureCode;
    }
  | { readonly kind: "cancelled" };

export interface AutomaticProposalWorkerHandle {
  readonly result: Promise<AutomaticProposalWorkerClientResult>;
  cancel(): void;
  terminate(): void;
}

function mappedWorkerFailure(
  code: AutomaticProposalWorkerFailureCode,
): AutomaticProposalWorkerClientFailureCode {
  return `automatic-proposal.${code}`;
}

function settledHandle(
  result: AutomaticProposalWorkerClientResult,
): AutomaticProposalWorkerHandle {
  return {
    result: Promise.resolve(result),
    cancel() {},
    terminate() {},
  };
}

export function startAutomaticProposalWorker(
  project: Project,
): AutomaticProposalWorkerHandle {
  if (typeof Worker === "undefined") {
    return settledHandle({
      kind: "failed",
      code: "automatic-proposal.worker-unsupported",
    });
  }

  let worker: Worker;
  try {
    worker = new Worker(
      new URL("../workers/automatic-proposal.worker.ts", import.meta.url),
      { type: "module" },
    );
  } catch {
    return settledHandle({
      kind: "failed",
      code: "automatic-proposal.worker-construction-failed",
    });
  }

  let active = true;
  let resolveResult!: (result: AutomaticProposalWorkerClientResult) => void;
  const result = new Promise<AutomaticProposalWorkerClientResult>((resolve) => {
    resolveResult = resolve;
  });

  const finish = (settledResult: AutomaticProposalWorkerClientResult) => {
    if (!active) {
      return;
    }
    active = false;
    worker.onmessage = null;
    worker.onerror = null;
    worker.onmessageerror = null;
    try {
      worker.terminate();
    } catch {
      // The local result is already fixed; termination is best-effort cleanup.
    }
    resolveResult(settledResult);
  };

  worker.onmessage = (event: MessageEvent<unknown>) => {
    if (!active) {
      return;
    }
    if (
      !isAutomaticProposalWorkerResponse(event.data) ||
      event.data.requestId !== REQUEST_ID
    ) {
      finish({
        kind: "failed",
        code: "automatic-proposal.worker-response-invalid",
      });
      return;
    }
    if (event.data.type === "automatic-proposal.ready") {
      finish({ kind: "ready", result: event.data.result });
      return;
    }
    finish({ kind: "failed", code: mappedWorkerFailure(event.data.code) });
  };
  worker.onerror = () => {
    finish({
      kind: "failed",
      code: "automatic-proposal.worker-runtime-failed",
    });
  };
  worker.onmessageerror = () => {
    finish({
      kind: "failed",
      code: "automatic-proposal.worker-message-failed",
    });
  };

  const request: AutomaticProposalWorkerRequest = {
    type: "automatic-proposal.generate",
    requestId: REQUEST_ID,
    project,
  };
  try {
    worker.postMessage(request);
  } catch {
    finish({
      kind: "failed",
      code: "automatic-proposal.worker-post-failed",
    });
  }

  const cancel = () => {
    finish({ kind: "cancelled" });
  };
  return {
    result,
    cancel,
    terminate: cancel,
  };
}
