import { afterEach, describe, expect, it, vi } from "vitest";

import {
  PROJECT_EXPORT_FILENAME,
  downloadProjectJson,
  isProjectFileExportAvailable,
  isProjectFileImportAvailable,
  projectJsonSourceFromFile,
} from "./project-file";

const originalDescriptors = new Map(
  ["File", "Blob", "URL", "document"].map((key) => [
    key,
    Object.getOwnPropertyDescriptor(globalThis, key),
  ]),
);

function setGlobal(key: string, value: unknown) {
  Object.defineProperty(globalThis, key, {
    configurable: true,
    writable: true,
    value,
  });
}

afterEach(() => {
  vi.restoreAllMocks();
  for (const [key, descriptor] of originalDescriptors) {
    if (descriptor === undefined) {
      Reflect.deleteProperty(globalThis, key);
    } else {
      Object.defineProperty(globalThis, key, descriptor);
    }
  }
});

describe("project file boundary", () => {
  it("uses the File size and deferred text reader without mutation", async () => {
    const text = '{"name":"匿名合成値"}';
    const readText = vi.fn(async () => text);
    function FakeFile() {}
    FakeFile.prototype.text = () => "";
    setGlobal("File", FakeFile);
    const file = { size: 17, text: readText } as unknown as File;

    const source = projectJsonSourceFromFile(file);

    expect(isProjectFileImportAvailable()).toBe(true);
    expect(source?.sizeBytes).toBe(17);
    expect(readText).not.toHaveBeenCalled();
    await expect(source?.readText()).resolves.toBe(text);
    expect(readText).toHaveBeenCalledOnce();
  });

  it("reports import unavailable without throwing when File support is absent", () => {
    Reflect.deleteProperty(globalThis, "File");

    expect(isProjectFileImportAvailable()).toBe(false);
    expect(
      projectJsonSourceFromFile({ size: 1, text: async () => "{}" } as File),
    ).toBeUndefined();
  });

  it("downloads through one fixed non-sensitive filename and revokes the object URL", () => {
    const json = '{"name":"値をファイル名へ反射しない"}';
    const blobParts: unknown[][] = [];
    const createObjectURL = vi.fn(() => "blob:synthetic-fixed");
    const revokeObjectURL = vi.fn();
    const click = vi.fn();
    const remove = vi.fn();
    const anchor = {
      click,
      download: "",
      hidden: false,
      href: "",
      remove,
    };
    class FakeBlob {
      constructor(parts: unknown[], options: unknown) {
        blobParts.push(parts, [options]);
      }
    }
    setGlobal("Blob", FakeBlob);
    setGlobal("URL", { createObjectURL, revokeObjectURL });
    setGlobal("document", {
      body: { append: vi.fn() },
      createElement: vi.fn(() => anchor),
    });

    expect(isProjectFileExportAvailable()).toBe(true);
    expect(downloadProjectJson(json)).toEqual({ ok: true });
    expect(anchor.download).toBe(PROJECT_EXPORT_FILENAME);
    expect(anchor.download).not.toContain("値をファイル名へ反射しない");
    expect(anchor.href).toBe("blob:synthetic-fixed");
    expect(blobParts[0]).toEqual([json]);
    expect(blobParts[1]).toEqual([
      { type: "application/json;charset=utf-8" },
    ]);
    expect(click).toHaveBeenCalledOnce();
    expect(remove).toHaveBeenCalledOnce();
    expect(revokeObjectURL).toHaveBeenCalledWith("blob:synthetic-fixed");
  });

  it("returns fixed failure codes and cleans up after a download exception", () => {
    const remove = vi.fn();
    const revokeObjectURL = vi.fn();
    setGlobal("Blob", class FakeBlob {});
    setGlobal("URL", {
      createObjectURL: () => "blob:synthetic",
      revokeObjectURL,
    });
    setGlobal("document", {
      body: { append: vi.fn() },
      createElement: () => ({
        download: "",
        hidden: false,
        href: "",
        remove,
        click: () => {
          throw new Error("synthetic click failure with private-looking-value");
        },
      }),
    });

    expect(downloadProjectJson("private-looking-value")).toEqual({
      ok: false,
      code: "project-file.download-failed",
    });
    expect(remove).toHaveBeenCalledOnce();
    expect(revokeObjectURL).toHaveBeenCalledWith("blob:synthetic");
  });

  it("reports export unavailable when required browser primitives are absent", () => {
    Reflect.deleteProperty(globalThis, "document");

    expect(isProjectFileExportAvailable()).toBe(false);
    expect(downloadProjectJson("{}")).toEqual({
      ok: false,
      code: "project-file.export-unavailable",
    });
  });
});
