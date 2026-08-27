import { AutomaticProposalWorkerEngine } from "./automatic-proposal-worker-engine";
import type { AutomaticProposalWorkerResponse } from "./automatic-proposal-worker-protocol";

interface MinimalWorkerMessageEvent {
  readonly data: unknown;
}

interface MinimalWorkerScope {
  onmessage: ((event: MinimalWorkerMessageEvent) => void) | null;
  postMessage(message: AutomaticProposalWorkerResponse): void;
  close(): void;
}

const workerScope = globalThis as unknown as MinimalWorkerScope;
const engine = new AutomaticProposalWorkerEngine();
let handled = false;

workerScope.onmessage = (event) => {
  if (handled) {
    return;
  }
  handled = true;
  workerScope.onmessage = null;
  try {
    workerScope.postMessage(engine.handle(event.data));
  } finally {
    workerScope.close();
  }
};
