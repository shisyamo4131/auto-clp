import { describe, expect, it, vi } from "vitest";

import { PROJECT_SCHEMA_VERSION, type Project } from "../domain/model";
import { MAX_PROJECT_FILE_BYTES, type ProjectJsonSource } from "../persistence/project-json";
import {
  prepareProjectImport,
  serializeProjectForPersistence,
} from "./project-persistence";

const encoder = new TextEncoder();

function project(id: string): Project {
  return {
    schemaVersion: PROJECT_SCHEMA_VERSION,
    projectId: id,
    name: `匿名案件${id}`,
    clearancesMm: { xMm: 0, yMm: 0, zMm: 0 },
    cargoes: [],
    containers: [],
    placements: [],
  };
}

function sourceFor(value: unknown): ProjectJsonSource {
  const text = typeof value === "string" ? value : JSON.stringify(value);
  return {
    sizeBytes: encoder.encode(text).byteLength,
    readText: async () => text,
  };
}

describe("project persistence application boundary", () => {
  it("serializes only the validated Project contract without mutating input", () => {
    const current = project("serialize");
    const original = structuredClone(current);

    const result = serializeProjectForPersistence(current);

    expect(result.ok).toBe(true);
    if (result.ok) {
      expect(JSON.parse(result.json)).toEqual(current);
      expect(encoder.encode(result.json).byteLength).toBeLessThanOrEqual(
        MAX_PROJECT_FILE_BYTES,
      );
    }
    expect(current).toEqual(original);
  });

  it("rejects a semantically invalid Project without reflecting its values", () => {
    const current = {
      ...project("invalid"),
      cargoes: [
        {
          id: "cargo-1",
          name: "匿名積荷A",
          dimensionsMm: { lengthMm: 1, widthMm: 1, heightMm: 1 },
          massGrams: 1,
          canSupportCargo: false,
          allowedOrientations: ["LWH"],
        },
        {
          id: "cargo-1",
          name: "匿名積荷B",
          dimensionsMm: { lengthMm: 1, widthMm: 1, heightMm: 1 },
          massGrams: 1,
          canSupportCargo: false,
          allowedOrientations: ["LWH"],
        },
      ],
    } satisfies Project;

    expect(serializeProjectForPersistence(current)).toEqual({
      ok: false,
      code: "persistence.serialize-invalid",
    });
  });

  it("returns the validated imported Project only after preflight accepts it", async () => {
    const current = project("current");
    const incoming = project("incoming");
    const preflight = vi.fn(async () => ({ ok: true as const }));

    const result = await prepareProjectImport(current, sourceFor(incoming), preflight);

    expect(result).toEqual({ ok: true, project: incoming });
    expect(preflight).toHaveBeenCalledOnce();
    expect(preflight).toHaveBeenCalledWith(incoming);
    expect(current.projectId).toBe("current");
  });

  it.each([
    [
      "invalid declared size",
      { sizeBytes: -1, readText: async () => "" },
      "persistence.import-size-invalid",
    ],
    [
      "declared size over 5 MiB",
      { sizeBytes: MAX_PROJECT_FILE_BYTES + 1, readText: async () => "" },
      "persistence.import-size-exceeded",
    ],
    [
      "read failure",
      {
        sizeBytes: 1,
        readText: async () => {
          throw new Error("synthetic read failure");
        },
      },
      "persistence.import-read-failed",
    ],
    ["syntax", sourceFor("{"), "persistence.import-syntax-invalid"],
    [
      "version",
      sourceFor({ ...project("incoming"), schemaVersion: "9.9.9" }),
      "persistence.import-version-unsupported",
    ],
    [
      "schema",
      sourceFor({ ...project("incoming"), unknown: true }),
      "persistence.import-schema-invalid",
    ],
    [
      "semantic",
      sourceFor({
        ...project("incoming"),
        cargoes: [
          {
            id: "cargo-1",
            name: "匿名積荷A",
            dimensionsMm: { lengthMm: 1, widthMm: 1, heightMm: 1 },
            massGrams: 1,
            canSupportCargo: false,
            allowedOrientations: ["LWH"],
          },
          {
            id: "cargo-1",
            name: "匿名積荷B",
            dimensionsMm: { lengthMm: 1, widthMm: 1, heightMm: 1 },
            massGrams: 1,
            canSupportCargo: false,
            allowedOrientations: ["LWH"],
          },
        ],
      }),
      "persistence.import-semantic-invalid",
    ],
  ] satisfies ReadonlyArray<readonly [string, ProjectJsonSource, string]>)(
    "maps %s without preflight or current-state mutation",
    async (_label, source, code) => {
    const current = project("current");
    const original = structuredClone(current);
    const preflight = vi.fn(async () => ({ ok: true as const }));

    const result = await prepareProjectImport(current, source, preflight);

    expect(result).toEqual({ ok: false, code });
    expect(preflight).not.toHaveBeenCalled();
    expect(current).toEqual(original);
    },
  );

  it("maps every rejected or failed preflight to a fixed derive-stage failure", async () => {
    const current = project("current");
    const incoming = project("incoming");

    await expect(
      prepareProjectImport(current, sourceFor(incoming), async () => ({
        ok: false,
        code: "preflight.physical-validation-unavailable",
      })),
    ).resolves.toEqual({
      ok: false,
      code: "persistence.import-preflight-failed",
    });
    await expect(
      prepareProjectImport(current, sourceFor(incoming), async () => {
        throw new Error("synthetic transport failure");
      }),
    ).resolves.toEqual({
      ok: false,
      code: "persistence.import-preflight-failed",
    });
  });
});
