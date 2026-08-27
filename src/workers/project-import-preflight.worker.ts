import { ProjectImportPreflightWorkerEngine } from "./project-import-preflight-worker-engine";
import type { ProjectImportPreflightResponse } from "./project-import-preflight-protocol";

interface MinimalWorkerMessageEvent {
  readonly data: unknown;
}

interface MinimalWorkerScope {
  onmessage: ((event: MinimalWorkerMessageEvent) => void) | null;
  postMessage(message: ProjectImportPreflightResponse): void;
}

const workerScope = globalThis as unknown as MinimalWorkerScope;
const engine = new ProjectImportPreflightWorkerEngine();

workerScope.onmessage = (event) => {
  workerScope.postMessage(engine.handle(event.data));
};
