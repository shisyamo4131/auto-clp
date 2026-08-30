import { afterEach, describe, expect, it, vi } from "vitest";

import { PROJECT_SCHEMA_VERSION, type Project } from "../domain/model";
import { serializeProjectForPersistence } from "../application/project-persistence";
import {
  PROJECT_STORE_KEY,
  deleteProjectJsonFromDevice,
  isProjectStoreAvailable,
  loadProjectJsonFromDevice,
  saveProjectJsonToDevice,
} from "./project-store";

const originalIndexedDb = Object.getOwnPropertyDescriptor(globalThis, "indexedDB");

type OpenOutcome = "success" | "error" | "blocked" | "throw";
type TransactionOutcome = "complete" | "error" | "abort" | "throw" | "manual";

interface FakeStoreControl {
  readonly close: ReturnType<typeof vi.fn>;
  readonly createObjectStore: ReturnType<typeof vi.fn>;
  complete(): void;
  getStored(): unknown;
  setStored(value: unknown): void;
}

function installFakeIndexedDb({
  open = "success",
  transaction = "complete",
  initialValue,
  upgrade = true,
}: {
  readonly open?: OpenOutcome;
  readonly transaction?: TransactionOutcome;
  readonly initialValue?: unknown;
  readonly upgrade?: boolean;
} = {}): FakeStoreControl {
  let stored = initialValue;
  let pendingTransaction: {
    onabort: (() => void) | null;
    oncomplete: (() => void) | null;
    onerror: (() => void) | null;
  } | undefined;
  const close = vi.fn();
  const createObjectStore = vi.fn();

  const finishTransaction = (
    current: NonNullable<typeof pendingTransaction>,
  ) => {
    if (transaction === "complete") current.oncomplete?.();
    if (transaction === "error") current.onerror?.();
    if (transaction === "abort") current.onabort?.();
  };

  const database = {
    close,
    createObjectStore,
    objectStoreNames: { contains: () => !upgrade },
    onversionchange: null as (() => void) | null,
    transaction: () => {
      if (transaction === "throw") {
        throw new Error("synthetic transaction failure");
      }
      const current = {
        onabort: null as (() => void) | null,
        oncomplete: null as (() => void) | null,
        onerror: null as (() => void) | null,
        objectStore: () => ({
          put: (value: unknown, key: string) => {
            expect(key).toBe(PROJECT_STORE_KEY);
            stored = value;
            queueMicrotask(() => finishTransaction(current));
          },
          get: (key: string) => {
            expect(key).toBe(PROJECT_STORE_KEY);
            const request = {
              result: undefined as unknown,
              onsuccess: null as (() => void) | null,
            };
            queueMicrotask(() => {
              request.result = stored;
              request.onsuccess?.();
              finishTransaction(current);
            });
            return request;
          },
          delete: (key: string) => {
            expect(key).toBe(PROJECT_STORE_KEY);
            stored = undefined;
            queueMicrotask(() => finishTransaction(current));
          },
        }),
      };
      pendingTransaction = current;
      return current;
    },
  };

  const factory = {
    open: () => {
      if (open === "throw") {
        throw new Error("synthetic open failure");
      }
      const request = {
        onblocked: null as (() => void) | null,
        onerror: null as (() => void) | null,
        onsuccess: null as (() => void) | null,
        onupgradeneeded: null as (() => void) | null,
        result: database,
      };
      queueMicrotask(() => {
        if (open === "error") {
          request.onerror?.();
          return;
        }
        if (open === "blocked") {
          request.onblocked?.();
          queueMicrotask(() => request.onsuccess?.());
          return;
        }
        if (upgrade) request.onupgradeneeded?.();
        request.onsuccess?.();
      });
      return request;
    },
  };
  Object.defineProperty(globalThis, "indexedDB", {
    configurable: true,
    value: factory,
  });
  return {
    close,
    createObjectStore,
    complete: () => pendingTransaction?.oncomplete?.(),
    getStored: () => stored,
    setStored: (value) => {
      stored = value;
    },
  };
}

function project(): Project {
  return {
    schemaVersion: PROJECT_SCHEMA_VERSION,
    projectId: "store-roundtrip",
    name: "匿名端末保存CLP",
    clearancesMm: { xMm: 1, yMm: 2, zMm: 3 },
    cargoes: [],
    containers: [],
    placements: [],
  };
}

afterEach(() => {
  vi.restoreAllMocks();
  if (originalIndexedDb === undefined) {
    Reflect.deleteProperty(globalThis, "indexedDB");
  } else {
    Object.defineProperty(globalThis, "indexedDB", originalIndexedDb);
  }
});

describe("project IndexedDB store", () => {
  it("reports unavailable without opening a fallback", async () => {
    Reflect.deleteProperty(globalThis, "indexedDB");

    expect(isProjectStoreAvailable()).toBe(false);
    await expect(saveProjectJsonToDevice("{}")).resolves.toEqual({
      ok: false,
      code: "project-store.unavailable",
    });
  });

  it.each(["throw", "error", "blocked"] as const)(
    "maps %s open failure and closes a late blocked success",
    async (open) => {
      const control = installFakeIndexedDb({ open });

      await expect(loadProjectJsonFromDevice()).resolves.toEqual({
        ok: false,
        code: "project-store.open-failed",
      });
      await Promise.resolve();
      expect(control.close).toHaveBeenCalledTimes(open === "blocked" ? 1 : 0);
    },
  );

  it("creates the object store on upgrade and resolves a put only on completion", async () => {
    const control = installFakeIndexedDb({ transaction: "manual", upgrade: true });
    let settled = false;
    const pending = saveProjectJsonToDevice("synthetic-json").then((result) => {
      settled = true;
      return result;
    });

    await Promise.resolve();
    await Promise.resolve();
    expect(settled).toBe(false);
    expect(control.createObjectStore).toHaveBeenCalledWith("projects");
    expect(control.getStored()).toBe("synthetic-json");
    control.complete();
    await expect(pending).resolves.toEqual({ ok: true, value: undefined });
    expect(control.close).toHaveBeenCalledOnce();
  });

  it.each(["error", "abort"] as const)(
    "maps write transaction %s, including quota-style abort",
    async (transaction) => {
      const control = installFakeIndexedDb({ transaction });

      await expect(saveProjectJsonToDevice("{}")).resolves.toEqual({
        ok: false,
        code: "project-store.write-failed",
      });
      expect(control.close).toHaveBeenCalledOnce();
    },
  );

  it("maps synchronous transaction errors per operation", async () => {
    installFakeIndexedDb({ transaction: "throw" });
    await expect(saveProjectJsonToDevice("{}")).resolves.toMatchObject({
      ok: false,
      code: "project-store.write-failed",
    });
    installFakeIndexedDb({ transaction: "throw" });
    await expect(loadProjectJsonFromDevice()).resolves.toMatchObject({
      ok: false,
      code: "project-store.read-failed",
    });
    installFakeIndexedDb({ transaction: "throw" });
    await expect(deleteProjectJsonFromDevice()).resolves.toMatchObject({
      ok: false,
      code: "project-store.delete-failed",
    });
  });

  it("distinguishes not-found and corrupt records", async () => {
    installFakeIndexedDb({ initialValue: undefined });
    await expect(loadProjectJsonFromDevice()).resolves.toEqual({
      ok: false,
      code: "project-store.not-found",
    });

    installFakeIndexedDb({ initialValue: { privateLookingValue: "not reflected" } });
    await expect(loadProjectJsonFromDevice()).resolves.toEqual({
      ok: false,
      code: "project-store.data-invalid",
    });
  });

  it.each(["error", "abort"] as const)(
    "maps read transaction %s",
    async (transaction) => {
      installFakeIndexedDb({ transaction, initialValue: "{}" });
      await expect(loadProjectJsonFromDevice()).resolves.toEqual({
        ok: false,
        code: "project-store.read-failed",
      });
    },
  );

  it.each(["error", "abort"] as const)(
    "maps delete transaction %s",
    async (transaction) => {
      installFakeIndexedDb({ transaction, initialValue: "{}" });
      await expect(deleteProjectJsonFromDevice()).resolves.toEqual({
        ok: false,
        code: "project-store.delete-failed",
      });
    },
  );

  it("round-trips serialized Project JSON and deletes the single slot", async () => {
    const control = installFakeIndexedDb();
    const serialized = serializeProjectForPersistence(project());
    if (!serialized.ok) throw new Error("fixture serialization failed");

    await expect(saveProjectJsonToDevice(serialized.json)).resolves.toEqual({
      ok: true,
      value: undefined,
    });
    await expect(loadProjectJsonFromDevice()).resolves.toEqual({
      ok: true,
      value: serialized.json,
    });
    await expect(deleteProjectJsonFromDevice()).resolves.toEqual({
      ok: true,
      value: undefined,
    });
    expect(control.getStored()).toBeUndefined();
  });
});
