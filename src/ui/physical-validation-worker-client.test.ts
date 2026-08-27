import { afterEach, describe, expect, it, vi } from "vitest";

import { PROJECT_SCHEMA_VERSION, type Project } from "../domain/model";
import type { PhysicalValidationWorkerResponse } from "../workers/physical-validation-worker-protocol";
import {
  createPhysicalValidationWorkerClient,
  type PhysicalValidationTransportErrorCode,
} from "./physical-validation-worker-client";

const originalWorkerDescriptor = Object.getOwnPropertyDescriptor(globalThis, "Worker");

class FakeWorker {
  static instances: FakeWorker[] = [];

  onmessage: ((event: MessageEvent<unknown>) => void) | null = null;
  onerror: ((event: Event) => void) | null = null;
  onmessageerror: ((event: MessageEvent<unknown>) => void) | null = null;
  readonly posts: unknown[] = [];
  terminateCount = 0;
  throwOnPost = false;

  constructor(
    readonly url: URL,
    readonly options?: WorkerOptions,
  ) {
    FakeWorker.instances.push(this);
  }

  postMessage(value: unknown) {
    if (this.throwOnPost) {
      throw new DOMException("clone failed", "DataCloneError");
    }
    this.posts.push(structuredClone(value));
  }

  terminate() {
    this.terminateCount += 1;
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
    projectId: "client-test",
    name: "匿名client試験",
    clearancesMm: { xMm: 0, yMm: 0, zMm: 0 },
    cargoes: [],
    containers: [],
    placements: [],
  };
}

function createHarness() {
  const responses: PhysicalValidationWorkerResponse[] = [];
  const errors: PhysicalValidationTransportErrorCode[] = [];
  const creation = createPhysicalValidationWorkerClient({
    onResponse: (response) => responses.push(response),
    onTransportError: (code) => errors.push(code),
  });
  if (!creation.ok) {
    throw new Error(`Expected client, received ${creation.code}`);
  }
  return {
    client: creation.client,
    errors,
    responses,
    worker: FakeWorker.instances.at(-1)!,
  };
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

describe("createPhysicalValidationWorkerClient", () => {
  it("constructs a module Worker and posts a structured clone of the request", () => {
    installWorker();
    const { client, errors, worker } = createHarness();
    const project = projectFixture();
    const request = {
      type: "evaluate" as const,
      generation: 1,
      project,
      containerId: "container-1",
    };

    expect(client.post(request)).toBe(true);
    (project as { name: string }).name = "呼出後変更";

    expect(worker.url.toString()).toContain("physical-validation.worker.ts");
    expect(worker.options).toEqual({ type: "module" });
    expect(worker.posts).toEqual([
      expect.objectContaining({
        type: "evaluate",
        generation: 1,
        project: expect.objectContaining({ name: "匿名client試験" }),
      }),
    ]);
    expect(errors).toEqual([]);
  });

  it("accepts validated cloned responses and forwards worker-failed for controller handling", () => {
    installWorker();
    const { errors, responses, worker } = createHarness();
    worker.emit({
      type: "evaluation-ready",
      generation: 2,
      summary: {
        kind: "evaluated",
        status: "valid",
        invalidCount: 0,
        unverifiedCount: 0,
        placementCount: 0,
      },
    });
    worker.emit({
      type: "worker-failed",
      generation: 2,
      code: "engine-failure",
    });

    expect(responses).toHaveLength(2);
    expect(responses[1]).toEqual({
      type: "worker-failed",
      generation: 2,
      code: "engine-failure",
    });
    expect(errors).toEqual([]);
  });

  it.each([
    ["runtime error", "worker-runtime-error", (worker: FakeWorker) => worker.emitError()],
    [
      "message clone error",
      "worker-message-error",
      (worker: FakeWorker) => worker.emitMessageError(),
    ],
    [
      "unknown response",
      "worker-response-invalid",
      (worker: FakeWorker) => worker.emit({ type: "unknown", generation: 1 }),
    ],
    [
      "oversized reason page",
      "worker-response-invalid",
      (worker: FakeWorker) =>
        worker.emit({
          type: "reason-page-ready",
          generation: 1,
          requestId: 1,
          status: "invalid",
          offset: 0,
          total: 26,
          reasons: Array.from({ length: 26 }, (_, index) => ({
            status: "invalid",
            code: "outside-container",
            target: { kind: "cargo", id: `cargo-${index}` },
            relatedCargoIds: [],
          })),
        }),
    ],
  ] as const)("converts $0 to one terminal transport error", (_label, code, trigger) => {
    installWorker();
    const { client, errors, responses, worker } = createHarness();

    trigger(worker);
    trigger(worker);

    expect(errors).toEqual([code]);
    expect(responses).toEqual([]);
    expect(worker.terminateCount).toBe(1);
    expect(
      client.post({
        type: "reason-page",
        generation: 1,
        requestId: 1,
        status: "invalid",
        offset: 0,
        limit: 25,
      }),
    ).toBe(false);
  });

  it("converts a postMessage clone failure to a terminal transport error", () => {
    installWorker();
    const { client, errors, worker } = createHarness();
    worker.throwOnPost = true;

    expect(
      client.post({
        type: "evaluate",
        generation: 1,
        project: projectFixture(),
        containerId: "container-1",
      }),
    ).toBe(false);
    expect(errors).toEqual(["worker-post-message-failed"]);
    expect(worker.terminateCount).toBe(1);
  });

  it("terminates idempotently and ignores all later worker signals", () => {
    installWorker();
    const { client, errors, responses, worker } = createHarness();

    client.terminate();
    client.terminate();
    worker.emitError();
    worker.emit({ type: "unknown", generation: 1 });

    expect(worker.terminateCount).toBe(1);
    expect(errors).toEqual([]);
    expect(responses).toEqual([]);
    expect(
      client.post({
        type: "evaluate",
        generation: 1,
        project: projectFixture(),
        containerId: "container-1",
      }),
    ).toBe(false);
  });

  it("reports unsupported without constructing or synchronously evaluating", () => {
    Reflect.deleteProperty(globalThis, "Worker");
    const onResponse = vi.fn();
    const onTransportError = vi.fn();

    expect(
      createPhysicalValidationWorkerClient({ onResponse, onTransportError }),
    ).toEqual({ ok: false, code: "worker-unsupported" });
    expect(onResponse).not.toHaveBeenCalled();
    expect(onTransportError).not.toHaveBeenCalled();
  });

  it("reports constructor failure without a client or synchronous fallback", () => {
    installWorker(
      class ThrowingWorker {
        constructor() {
          throw new Error("construction failed");
        }
      },
    );
    const onResponse = vi.fn();

    expect(
      createPhysicalValidationWorkerClient({
        onResponse,
        onTransportError: vi.fn(),
      }),
    ).toEqual({ ok: false, code: "worker-construction-failed" });
    expect(onResponse).not.toHaveBeenCalled();
  });
});
