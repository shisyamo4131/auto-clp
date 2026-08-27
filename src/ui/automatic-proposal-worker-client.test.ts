import { afterEach, describe, expect, it, vi } from "vitest";

import {
  AUTOMATIC_PROPOSAL_ALGORITHM_VERSION,
  AUTOMATIC_PROPOSAL_CANDIDATE_ATTEMPT_LIMIT,
  AUTOMATIC_PROPOSAL_CANDIDATE_POINT_LIMIT,
  AUTOMATIC_PROPOSAL_REQUEST_ATTEMPT_LIMIT,
} from "../domain/automatic-proposal";
import { PROJECT_SCHEMA_VERSION, type Project } from "../domain/model";
import { startAutomaticProposalWorker } from "./automatic-proposal-worker-client";

const originalWorkerDescriptor = Object.getOwnPropertyDescriptor(globalThis, "Worker");

class FakeWorker {
  static instances: FakeWorker[] = [];

  onmessage: ((event: MessageEvent<unknown>) => void) | null = null;
  onerror: ((event: Event) => void) | null = null;
  onmessageerror: ((event: MessageEvent<unknown>) => void) | null = null;
  readonly posts: unknown[] = [];
  terminateCount = 0;
  throwOnTerminate = false;

  constructor(
    readonly url: URL,
    readonly options?: WorkerOptions,
  ) {
    FakeWorker.instances.push(this);
  }

  postMessage(value: unknown) {
    this.posts.push(structuredClone(value));
  }

  terminate() {
    this.terminateCount += 1;
    if (this.throwOnTerminate) {
      throw new Error("terminate failed");
    }
  }

  emit(value: unknown) {
    this.onmessage?.({ data: structuredClone(value) } as MessageEvent<unknown>);
  }

  emitError() {
    this.onerror?.(new Event("error"));
  }

  emitMessageError() {
    this.onmessageerror?.({ data: undefined } as MessageEvent<unknown>);
  }
}

class PostThrowingWorker extends FakeWorker {
  override postMessage(): void {
    throw new DOMException("clone failed", "DataCloneError");
  }
}

function installWorker(worker: unknown = FakeWorker) {
  Object.defineProperty(globalThis, "Worker", {
    configurable: true,
    writable: true,
    value: worker,
  });
}

function projectFixture(): Project {
  return {
    schemaVersion: PROJECT_SCHEMA_VERSION,
    projectId: "worker-client-project",
    name: "anonymous-client-project",
    clearancesMm: { xMm: 0, yMm: 0, zMm: 0 },
    cargoes: [],
    containers: [],
    placements: [],
  };
}

function noCargoReady(requestId = 1) {
  return {
    type: "automatic-proposal.ready",
    requestId,
    result: {
      algorithmVersion: AUTOMATIC_PROPOSAL_ALGORITHM_VERSION,
      effectiveLimits: {
        candidateAttemptLimit: AUTOMATIC_PROPOSAL_CANDIDATE_ATTEMPT_LIMIT,
        requestAttemptLimit: AUTOMATIC_PROPOSAL_REQUEST_ATTEMPT_LIMIT,
        candidatePointLimit: AUTOMATIC_PROPOSAL_CANDIDATE_POINT_LIMIT,
      },
      attempts: { requestAttemptCount: 0, candidates: [] },
      status: "no-cargo",
    },
  } as const;
}

function startHarness(project = projectFixture()) {
  const handle = startAutomaticProposalWorker(project);
  const worker = FakeWorker.instances.at(-1);
  if (worker === undefined) {
    throw new Error("expected fake automatic proposal Worker");
  }
  return { handle, worker };
}

afterEach(() => {
  FakeWorker.instances = [];
  vi.restoreAllMocks();
  if (originalWorkerDescriptor === undefined) {
    Reflect.deleteProperty(globalThis, "Worker");
  } else {
    Object.defineProperty(globalThis, "Worker", originalWorkerDescriptor);
  }
});

describe("startAutomaticProposalWorker", () => {
  it("constructs one module Worker and posts exactly one structured clone", async () => {
    installWorker();
    const project = projectFixture();
    const { handle, worker } = startHarness(project);
    const settled = vi.fn();
    void handle.result.then(settled);

    (project as { name: string }).name = "changed-after-post";
    await Promise.resolve();

    expect(worker.url.toString()).toContain("automatic-proposal.worker.ts");
    expect(worker.options).toEqual({ type: "module" });
    expect(worker.posts).toEqual([
      {
        type: "automatic-proposal.generate",
        requestId: 1,
        project: expect.objectContaining({ name: "anonymous-client-project" }),
      },
    ]);
    expect(settled).not.toHaveBeenCalled();
    expect(worker.terminateCount).toBe(0);

    handle.cancel();
    await expect(handle.result).resolves.toEqual({ kind: "cancelled" });
  });

  it("returns ready, masks handlers, and terminates exactly once", async () => {
    installWorker();
    const { handle, worker } = startHarness();
    const oldMessage = worker.onmessage;

    worker.emit(noCargoReady());

    await expect(handle.result).resolves.toEqual({
      kind: "ready",
      result: noCargoReady().result,
    });
    expect(worker.onmessage).toBeNull();
    expect(worker.onerror).toBeNull();
    expect(worker.onmessageerror).toBeNull();
    expect(worker.terminateCount).toBe(1);

    oldMessage?.({ data: { type: "unknown" } } as MessageEvent<unknown>);
    handle.cancel();
    handle.terminate();
    expect(worker.terminateCount).toBe(1);
    await expect(handle.result).resolves.toEqual({
      kind: "ready",
      result: noCargoReady().result,
    });
  });

  it.each([
    ["invalid-request", "automatic-proposal.invalid-request"],
    ["input-invalid", "automatic-proposal.input-invalid"],
    ["engine-failure", "automatic-proposal.engine-failure"],
  ] as const)("maps Worker failure %s", async (workerCode, clientCode) => {
    installWorker();
    const { handle, worker } = startHarness();

    worker.emit({
      type: "automatic-proposal.failed",
      requestId: 1,
      code: workerCode,
    });

    await expect(handle.result).resolves.toEqual({
      kind: "failed",
      code: clientCode,
    });
    expect(worker.terminateCount).toBe(1);
  });

  it.each([
    [
      "runtime error",
      "automatic-proposal.worker-runtime-failed",
      (worker: FakeWorker) => worker.emitError(),
    ],
    [
      "message error",
      "automatic-proposal.worker-message-failed",
      (worker: FakeWorker) => worker.emitMessageError(),
    ],
    [
      "malformed response",
      "automatic-proposal.worker-response-invalid",
      (worker: FakeWorker) => worker.emit({ type: "unknown", requestId: 1 }),
    ],
    [
      "wrong request ID",
      "automatic-proposal.worker-response-invalid",
      (worker: FakeWorker) => worker.emit(noCargoReady(2)),
    ],
  ] as const)("settles one terminal failure for %s", async (_label, code, trigger) => {
    installWorker();
    const { handle, worker } = startHarness();
    const oldError = worker.onerror;
    const oldMessage = worker.onmessage;

    trigger(worker);
    oldError?.(new Event("error"));
    oldMessage?.({ data: noCargoReady() } as MessageEvent<unknown>);

    await expect(handle.result).resolves.toEqual({ kind: "failed", code });
    expect(worker.terminateCount).toBe(1);
    expect(worker.onmessage).toBeNull();
    expect(worker.onerror).toBeNull();
    expect(worker.onmessageerror).toBeNull();
  });

  it("maps a synchronous postMessage clone failure and terminates", async () => {
    installWorker(PostThrowingWorker);

    const { handle, worker } = startHarness();

    await expect(handle.result).resolves.toEqual({
      kind: "failed",
      code: "automatic-proposal.worker-post-failed",
    });
    expect(worker.posts).toEqual([]);
    expect(worker.terminateCount).toBe(1);
  });

  it("settles cancel immediately and idempotently, ignoring late responses", async () => {
    installWorker();
    const { handle, worker } = startHarness();
    const oldMessage = worker.onmessage;
    const settled = vi.fn();
    void handle.result.then(settled);

    handle.cancel();
    handle.cancel();
    oldMessage?.({ data: noCargoReady() } as MessageEvent<unknown>);
    await Promise.resolve();

    expect(settled).toHaveBeenCalledWith({ kind: "cancelled" });
    await expect(handle.result).resolves.toEqual({ kind: "cancelled" });
    expect(worker.terminateCount).toBe(1);
    expect(worker.onmessage).toBeNull();
  });

  it("uses terminate as the idempotent cancellation alias", async () => {
    installWorker();
    const { handle, worker } = startHarness();

    handle.terminate();
    handle.cancel();

    await expect(handle.result).resolves.toEqual({ kind: "cancelled" });
    expect(worker.terminateCount).toBe(1);
  });

  it("keeps the fixed result even if best-effort Worker termination throws", async () => {
    installWorker();
    const { handle, worker } = startHarness();
    worker.throwOnTerminate = true;

    worker.emit(noCargoReady());

    await expect(handle.result).resolves.toEqual({
      kind: "ready",
      result: noCargoReady().result,
    });
    expect(worker.terminateCount).toBe(1);
  });

  it("reports unsupported without constructing a Worker or synchronous fallback", async () => {
    Reflect.deleteProperty(globalThis, "Worker");

    const handle = startAutomaticProposalWorker(projectFixture());
    handle.cancel();
    handle.terminate();

    await expect(handle.result).resolves.toEqual({
      kind: "failed",
      code: "automatic-proposal.worker-unsupported",
    });
    expect(FakeWorker.instances).toEqual([]);
  });

  it("reports constructor failure without posting or synchronous fallback", async () => {
    installWorker(
      class ThrowingWorker {
        constructor() {
          throw new Error("construction failed");
        }
      },
    );

    const handle = startAutomaticProposalWorker(projectFixture());

    await expect(handle.result).resolves.toEqual({
      kind: "failed",
      code: "automatic-proposal.worker-construction-failed",
    });
    expect(FakeWorker.instances).toEqual([]);
  });
});
