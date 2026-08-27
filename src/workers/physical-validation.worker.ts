import { PhysicalValidationWorkerEngine } from "./physical-validation-worker-engine";
import type { PhysicalValidationWorkerResponse } from "./physical-validation-worker-protocol";

interface MinimalWorkerMessageEvent {
  readonly data: unknown;
}

interface MinimalWorkerScope {
  onmessage: ((event: MinimalWorkerMessageEvent) => void) | null;
  postMessage(message: PhysicalValidationWorkerResponse): void;
}

const workerScope = globalThis as unknown as MinimalWorkerScope;
const engine = new PhysicalValidationWorkerEngine();

workerScope.onmessage = (event) => {
  workerScope.postMessage(engine.handle(event.data));
};
