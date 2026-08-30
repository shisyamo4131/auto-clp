import { afterEach, describe, expect, it } from "vitest";

import { PROJECT_SCHEMA_VERSION, type Project } from "../domain/model";
import { preflightImportedProject } from "./project-import-preflight-client";

const originalWorker = Object.getOwnPropertyDescriptor(globalThis, "Worker");

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
      throw new DOMException("synthetic clone failure", "DataCloneError");
    }
    this.posts.push(structuredClone(value));
  }

  terminate() {
    this.terminateCount += 1;
  }

  emit(value: unknown) {
    this.onmessage?.({ data: structuredClone(value) } as MessageEvent<unknown>);
  }
}

function installWorker(value: unknown = FakeWorker) {
  Object.defineProperty(globalThis, "Worker", {
    configurable: true,
    writable: true,
    value,
  });
}

function project(): Project {
  return {
    schemaVersion: PROJECT_SCHEMA_VERSION,
    projectId: "preflight-client",
    name: "匿名preflightCLP",
    clearancesMm: { xMm: 0, yMm: 0, zMm: 0 },
    cargoes: [],
    containers: [],
    placements: [],
  };
}

afterEach(() => {
  FakeWorker.instances = [];
  if (originalWorker === undefined) {
    Reflect.deleteProperty(globalThis, "Worker");
  } else {
    Object.defineProperty(globalThis, "Worker", originalWorker);
  }
});

describe("project import preflight client", () => {
  it("posts one cloned module-Worker request and terminates after ready", async () => {
    installWorker();
    const input = project();
    const pending = preflightImportedProject(input);
    const worker = FakeWorker.instances[0]!;

    expect(worker.url.toString()).toContain("project-import-preflight.worker.ts");
    expect(worker.options).toEqual({ type: "module" });
    expect(worker.posts).toEqual([
      {
        type: "project-import-preflight",
        requestId: 1,
        project: input,
      },
    ]);
    (input as { name: string }).name = "呼出後変更";
    expect(worker.posts).not.toEqual([
      expect.objectContaining({ project: expect.objectContaining({ name: "呼出後変更" }) }),
    ]);

    worker.emit({ type: "project-import-preflight-ready", requestId: 1 });
    await expect(pending).resolves.toEqual({ ok: true });
    expect(worker.terminateCount).toBe(1);
  });

  it.each([
    [
      "physical unavailable",
      {
        type: "project-import-preflight-failed",
        requestId: 1,
        code: "physical-validation-unavailable",
      },
      "preflight.physical-validation-unavailable",
    ],
    [
      "engine failure",
      {
        type: "project-import-preflight-failed",
        requestId: 1,
        code: "engine-failure",
      },
      "preflight.engine-failed",
    ],
    [
      "stale request id",
      { type: "project-import-preflight-ready", requestId: 2 },
      "preflight.worker-response-invalid",
    ],
    [
      "malformed response",
      { type: "project-import-preflight-ready", requestId: 1, extra: true },
      "preflight.worker-response-invalid",
    ],
  ] as const)("maps %s and terminates exactly once", async (_label, response, code) => {
    installWorker();
    const pending = preflightImportedProject(project());
    const worker = FakeWorker.instances[0]!;

    worker.emit(response);
    worker.emit({ type: "project-import-preflight-ready", requestId: 1 });

    await expect(pending).resolves.toEqual({ ok: false, code });
    expect(worker.terminateCount).toBe(1);
  });

  it("maps runtime, message, and post failures and terminates", async () => {
    installWorker();
    const runtime = preflightImportedProject(project());
    let worker = FakeWorker.instances.at(-1)!;
    worker.onerror?.(new Event("error"));
    await expect(runtime).resolves.toEqual({
      ok: false,
      code: "preflight.worker-runtime-failed",
    });
    expect(worker.terminateCount).toBe(1);

    const message = preflightImportedProject(project());
    worker = FakeWorker.instances.at(-1)!;
    worker.onmessageerror?.({ data: undefined } as MessageEvent<unknown>);
    await expect(message).resolves.toEqual({
      ok: false,
      code: "preflight.worker-message-failed",
    });
    expect(worker.terminateCount).toBe(1);

    const posted = preflightImportedProject(project());
    worker = FakeWorker.instances.at(-1)!;
    worker.throwOnPost = true;
    // The constructor posts synchronously, so use a dedicated throwing Worker below.
    worker.emit({ type: "project-import-preflight-ready", requestId: 1 });
    await expect(posted).resolves.toEqual({ ok: true });

    installWorker(
      class PostThrowingWorker extends FakeWorker {
        override postMessage() {
          throw new DOMException("synthetic", "DataCloneError");
        }
      },
    );
    await expect(preflightImportedProject(project())).resolves.toEqual({
      ok: false,
      code: "preflight.worker-post-failed",
    });
    expect(FakeWorker.instances.at(-1)?.terminateCount).toBe(1);
  });

  it("reports unsupported and constructor failure without synchronous fallback", async () => {
    Reflect.deleteProperty(globalThis, "Worker");
    await expect(preflightImportedProject(project())).resolves.toEqual({
      ok: false,
      code: "preflight.worker-unsupported",
    });

    installWorker(
      class ThrowingWorker {
        constructor() {
          throw new Error("synthetic construction failure");
        }
      },
    );
    await expect(preflightImportedProject(project())).resolves.toEqual({
      ok: false,
      code: "preflight.worker-construction-failed",
    });
  });
});
