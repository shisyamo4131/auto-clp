export const PROJECT_STORE_KEY = "current-project";

const DATABASE_NAME = "auto-clp";
const DATABASE_VERSION = 1;
const OBJECT_STORE_NAME = "projects";

export type ProjectStoreFailureCode =
  | "project-store.unavailable"
  | "project-store.open-failed"
  | "project-store.read-failed"
  | "project-store.write-failed"
  | "project-store.delete-failed"
  | "project-store.not-found"
  | "project-store.data-invalid";

export type ProjectStoreResult<T> =
  | { readonly ok: true; readonly value: T }
  | { readonly ok: false; readonly code: ProjectStoreFailureCode };

function indexedDbFactory(): IDBFactory | undefined {
  try {
    const candidate = globalThis.indexedDB;
    return candidate !== undefined && typeof candidate.open === "function"
      ? candidate
      : undefined;
  } catch {
    return undefined;
  }
}

export function isProjectStoreAvailable(): boolean {
  return indexedDbFactory() !== undefined;
}

function openDatabase(factory: IDBFactory): Promise<ProjectStoreResult<IDBDatabase>> {
  return new Promise((resolve) => {
    let settled = false;
    const finish = (result: ProjectStoreResult<IDBDatabase>) => {
      if (settled) {
        if (result.ok) {
          result.value.close();
        }
        return;
      }
      settled = true;
      resolve(result);
    };
    let request: IDBOpenDBRequest;
    try {
      request = factory.open(DATABASE_NAME, DATABASE_VERSION);
    } catch {
      finish({ ok: false, code: "project-store.open-failed" });
      return;
    }

    request.onupgradeneeded = () => {
      const database = request.result;
      if (!database.objectStoreNames.contains(OBJECT_STORE_NAME)) {
        database.createObjectStore(OBJECT_STORE_NAME);
      }
    };
    request.onerror = () => {
      finish({ ok: false, code: "project-store.open-failed" });
    };
    request.onblocked = () => {
      finish({ ok: false, code: "project-store.open-failed" });
    };
    request.onsuccess = () => {
      request.result.onversionchange = () => request.result.close();
      finish({ ok: true, value: request.result });
    };
  });
}

export async function saveProjectJsonToDevice(
  json: string,
): Promise<ProjectStoreResult<undefined>> {
  const factory = indexedDbFactory();
  if (factory === undefined) {
    return { ok: false, code: "project-store.unavailable" };
  }
  const opened = await openDatabase(factory);
  if (!opened.ok) {
    return opened;
  }

  return new Promise((resolve) => {
    const database = opened.value;
    let settled = false;
    const finish = (result: ProjectStoreResult<undefined>) => {
      if (settled) {
        return;
      }
      settled = true;
      database.close();
      resolve(result);
    };
    let transaction: IDBTransaction;
    try {
      transaction = database.transaction(OBJECT_STORE_NAME, "readwrite");
      transaction.objectStore(OBJECT_STORE_NAME).put(json, PROJECT_STORE_KEY);
    } catch {
      finish({ ok: false, code: "project-store.write-failed" });
      return;
    }

    transaction.oncomplete = () => {
      finish({ ok: true, value: undefined });
    };
    transaction.onerror = () => {
      finish({ ok: false, code: "project-store.write-failed" });
    };
    transaction.onabort = () => {
      finish({ ok: false, code: "project-store.write-failed" });
    };
  });
}

export async function loadProjectJsonFromDevice(): Promise<
  ProjectStoreResult<string>
> {
  const factory = indexedDbFactory();
  if (factory === undefined) {
    return { ok: false, code: "project-store.unavailable" };
  }
  const opened = await openDatabase(factory);
  if (!opened.ok) {
    return opened;
  }

  return new Promise((resolve) => {
    const database = opened.value;
    let settled = false;
    const finish = (result: ProjectStoreResult<string>) => {
      if (settled) {
        return;
      }
      settled = true;
      database.close();
      resolve(result);
    };
    let transaction: IDBTransaction;
    let request: IDBRequest<unknown>;
    let value: unknown;
    try {
      transaction = database.transaction(OBJECT_STORE_NAME, "readonly");
      request = transaction.objectStore(OBJECT_STORE_NAME).get(PROJECT_STORE_KEY);
    } catch {
      finish({ ok: false, code: "project-store.read-failed" });
      return;
    }

    request.onsuccess = () => {
      value = request.result;
    };
    transaction.oncomplete = () => {
      if (value === undefined) {
        finish({ ok: false, code: "project-store.not-found" });
      } else if (typeof value !== "string") {
        finish({ ok: false, code: "project-store.data-invalid" });
      } else {
        finish({ ok: true, value });
      }
    };
    transaction.onerror = () => {
      finish({ ok: false, code: "project-store.read-failed" });
    };
    transaction.onabort = () => {
      finish({ ok: false, code: "project-store.read-failed" });
    };
  });
}

export async function deleteProjectJsonFromDevice(): Promise<
  ProjectStoreResult<undefined>
> {
  const factory = indexedDbFactory();
  if (factory === undefined) {
    return { ok: false, code: "project-store.unavailable" };
  }
  const opened = await openDatabase(factory);
  if (!opened.ok) {
    return opened;
  }

  return new Promise((resolve) => {
    const database = opened.value;
    let settled = false;
    const finish = (result: ProjectStoreResult<undefined>) => {
      if (settled) {
        return;
      }
      settled = true;
      database.close();
      resolve(result);
    };
    let transaction: IDBTransaction;
    try {
      transaction = database.transaction(OBJECT_STORE_NAME, "readwrite");
      transaction.objectStore(OBJECT_STORE_NAME).delete(PROJECT_STORE_KEY);
    } catch {
      finish({ ok: false, code: "project-store.delete-failed" });
      return;
    }

    transaction.oncomplete = () => {
      finish({ ok: true, value: undefined });
    };
    transaction.onerror = () => {
      finish({ ok: false, code: "project-store.delete-failed" });
    };
    transaction.onabort = () => {
      finish({ ok: false, code: "project-store.delete-failed" });
    };
  });
}
