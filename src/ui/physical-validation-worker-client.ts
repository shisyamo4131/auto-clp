import {
  isPhysicalValidationWorkerResponse,
  type PhysicalValidationWorkerRequest,
  type PhysicalValidationWorkerResponse,
} from "../workers/physical-validation-worker-protocol";

export type PhysicalValidationTransportErrorCode =
  | "worker-unsupported"
  | "worker-construction-failed"
  | "worker-post-message-failed"
  | "worker-runtime-error"
  | "worker-message-error"
  | "worker-response-invalid";

export interface PhysicalValidationWorkerClientHandlers {
  readonly onResponse: (response: PhysicalValidationWorkerResponse) => void;
  readonly onTransportError: (code: PhysicalValidationTransportErrorCode) => void;
}

export interface PhysicalValidationWorkerClient {
  post(request: PhysicalValidationWorkerRequest): boolean;
  terminate(): void;
}

export type PhysicalValidationWorkerClientCreation =
  | { readonly ok: true; readonly client: PhysicalValidationWorkerClient }
  | {
      readonly ok: false;
      readonly code: "worker-unsupported" | "worker-construction-failed";
    };

class BrowserPhysicalValidationWorkerClient
  implements PhysicalValidationWorkerClient
{
  private failed = false;
  private terminated = false;

  constructor(
    private readonly worker: Worker,
    private readonly handlers: PhysicalValidationWorkerClientHandlers,
  ) {
    worker.onmessage = (event: MessageEvent<unknown>) => {
      if (this.terminated || this.failed) {
        return;
      }
      if (!isPhysicalValidationWorkerResponse(event.data)) {
        this.fail("worker-response-invalid");
        return;
      }
      handlers.onResponse(event.data);
    };
    worker.onerror = () => {
      this.fail("worker-runtime-error");
    };
    worker.onmessageerror = () => {
      this.fail("worker-message-error");
    };
  }

  post(request: PhysicalValidationWorkerRequest): boolean {
    if (this.terminated || this.failed) {
      return false;
    }
    try {
      this.worker.postMessage(request);
      return true;
    } catch {
      this.fail("worker-post-message-failed");
      return false;
    }
  }

  terminate(): void {
    if (this.terminated) {
      return;
    }
    this.terminated = true;
    this.worker.terminate();
  }

  private fail(code: PhysicalValidationTransportErrorCode): void {
    if (this.failed || this.terminated) {
      return;
    }
    this.failed = true;
    this.worker.terminate();
    this.handlers.onTransportError(code);
  }
}

export function createPhysicalValidationWorkerClient(
  handlers: PhysicalValidationWorkerClientHandlers,
): PhysicalValidationWorkerClientCreation {
  if (typeof Worker === "undefined") {
    return { ok: false, code: "worker-unsupported" };
  }

  try {
    const worker = new Worker(
      new URL("../workers/physical-validation.worker.ts", import.meta.url),
      { type: "module" },
    );
    return {
      ok: true,
      client: new BrowserPhysicalValidationWorkerClient(worker, handlers),
    };
  } catch {
    return { ok: false, code: "worker-construction-failed" };
  }
}
