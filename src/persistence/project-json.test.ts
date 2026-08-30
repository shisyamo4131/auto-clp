import { describe, expect, it, vi } from "vitest";

import { PROJECT_SCHEMA_VERSION, type Project } from "../domain/model";
import {
  MAX_PROJECT_FILE_BYTES,
  readProjectJson,
  serializeProjectJson,
  type ProjectJsonSource,
} from "./project-json";

const encoder = new TextEncoder();

function minimalProject(): Project {
  return {
    schemaVersion: PROJECT_SCHEMA_VERSION,
    projectId: "project-1",
    name: "匿名試験CLP",
    clearancesMm: { xMm: 0, yMm: 0, zMm: 0 },
    cargoes: [],
    containers: [],
    placements: [],
  };
}

function richProject(): Project {
  return {
    ...minimalProject(),
    cargoes: [
      {
        id: "cargo-1",
        name: "匿名積荷",
        dimensionsMm: { lengthMm: 100, widthMm: 80, heightMm: 60 },
        massGrams: 1_000,
        canSupportCargo: false,
        allowedOrientations: ["LWH", "WLH"],
      },
    ],
    containers: [
      {
        id: "container-1",
        name: "匿名コンテナ",
        internalDimensionsMm: { lengthMm: 1_000, widthMm: 500, heightMm: 500 },
        openingMm: { widthMm: 400, heightMm: 400 },
        payloadCapacityGrams: 10_000,
      },
    ],
    placements: [
      {
        cargoId: "cargo-1",
        containerId: "container-1",
        positionMm: { xMm: 0, yMm: 0, zMm: 0 },
        orientation: "LWH",
      },
    ],
  };
}

function sourceForText(text: string, sizeBytes = encoder.encode(text).byteLength): ProjectJsonSource {
  return { sizeBytes, readText: async () => text };
}

function sourceForProject(project: Project): ProjectJsonSource {
  return sourceForText(JSON.stringify(project));
}

describe("readProjectJson", () => {
  it.each([
    ["minimal", minimalProject],
    ["rich", richProject],
  ])("reads a %s valid project", async (_name, createProject) => {
    const project = createProject();

    await expect(readProjectJson(sourceForProject(project))).resolves.toEqual({
      ok: true,
      project,
    });
  });

  it("accepts an exact 5 MiB UTF-8 source", async () => {
    const json = JSON.stringify(minimalProject());
    const jsonBytes = encoder.encode(json).byteLength;
    const exactText = `${json}${" ".repeat(MAX_PROJECT_FILE_BYTES - jsonBytes)}`;

    const result = await readProjectJson(sourceForText(exactText));

    expect(result.ok).toBe(true);
  });

  it("rejects one byte above the size limit before calling the reader", async () => {
    const readText = vi.fn(async () => JSON.stringify(minimalProject()));

    const result = await readProjectJson({
      sizeBytes: MAX_PROJECT_FILE_BYTES + 1,
      readText,
    });

    expect(result).toEqual({
      ok: false,
      stage: "size",
      issues: [{ code: "size.exceeded", path: "/" }],
    });
    expect(readText).not.toHaveBeenCalled();
  });

  it("rejects dishonest declared size when actual UTF-8 text exceeds the limit", async () => {
    const json = JSON.stringify(minimalProject());
    const oversizedText = `${json}${" ".repeat(
      MAX_PROJECT_FILE_BYTES - encoder.encode(json).byteLength + 1,
    )}`;
    const readText = vi.fn(async () => oversizedText);

    const result = await readProjectJson({ sizeBytes: 1, readText });

    expect(result).toEqual({
      ok: false,
      stage: "size",
      issues: [{ code: "size.exceeded", path: "/" }],
    });
    expect(readText).toHaveBeenCalledOnce();
  });

  it("reports read, syntax, version, schema, and semantic stages without input values", async () => {
    const readFailure = await readProjectJson({
      sizeBytes: 1,
      readText: async () => {
        throw new Error("synthetic secret should not escape");
      },
    });
    const syntaxFailure = await readProjectJson(sourceForText("not-json"));
    const versionFailure = await readProjectJson(
      sourceForText(JSON.stringify({ ...minimalProject(), schemaVersion: "9.9.9" })),
    );
    const schemaFailure = await readProjectJson(
      sourceForText(JSON.stringify({ ...minimalProject(), extra: "not-persisted" })),
    );
    const semanticFailure = await readProjectJson(
      sourceForText(
        JSON.stringify({
          ...richProject(),
          cargoes: [...richProject().cargoes, { ...richProject().cargoes[0] }],
        }),
      ),
    );

    expect(readFailure).toEqual({
      ok: false,
      stage: "read",
      issues: [{ code: "read.failed", path: "/" }],
    });
    expect(syntaxFailure).toEqual({
      ok: false,
      stage: "syntax",
      issues: [{ code: "syntax.invalid", path: "/" }],
    });
    expect(versionFailure).toEqual({
      ok: false,
      stage: "version",
      issues: [{ code: "version.unsupported", path: "/schemaVersion" }],
    });
    expect(schemaFailure).toEqual({
      ok: false,
      stage: "schema",
      issues: [{ code: "schema.additionalProperties", path: "/" }],
    });
    expect(semanticFailure).toEqual({
      ok: false,
      stage: "semantic",
      issues: [{ code: "semantic.duplicate-cargo-id", path: "/cargoes/1/id" }],
    });
    expect(JSON.stringify(readFailure)).not.toContain("secret");
  });

  it("uses version stage for a missing version", async () => {
    const withoutVersion: Record<string, unknown> = { ...minimalProject() };
    Reflect.deleteProperty(withoutVersion, "schemaVersion");

    await expect(readProjectJson(sourceForText(JSON.stringify(withoutVersion)))).resolves.toEqual({
      ok: false,
      stage: "version",
      issues: [{ code: "version.unsupported", path: "/schemaVersion" }],
    });
  });

  it("stops at version before combined schema and semantic failures", async () => {
    const invalid = {
      ...richProject(),
      schemaVersion: "9.9.9",
      extra: true,
      cargoes: [...richProject().cargoes, { ...richProject().cargoes[0] }],
    };

    await expect(readProjectJson(sourceForText(JSON.stringify(invalid)))).resolves.toEqual({
      ok: false,
      stage: "version",
      issues: [{ code: "version.unsupported", path: "/schemaVersion" }],
    });
  });

  it("stops at schema before a combined semantic failure", async () => {
    const invalid = {
      ...richProject(),
      extra: true,
      cargoes: [...richProject().cargoes, { ...richProject().cargoes[0] }],
    };

    await expect(readProjectJson(sourceForText(JSON.stringify(invalid)))).resolves.toEqual({
      ok: false,
      stage: "schema",
      issues: [{ code: "schema.additionalProperties", path: "/" }],
    });
  });

  it("accepts the maximum legal collection sizes", async () => {
    const cargoes = Array.from({ length: 1_000 }, (_, index) => ({
      id: `cargo-${index}`,
      name: `匿名積荷${index}`,
      dimensionsMm: { lengthMm: 1, widthMm: 1, heightMm: 1 },
      massGrams: 100_000_000,
      canSupportCargo: true,
      allowedOrientations: ["LWH"] as const,
    }));
    const containers = Array.from({ length: 100 }, (_, index) => ({
      id: `container-${index}`,
      name: `匿名コンテナ${index}`,
      internalDimensionsMm: { lengthMm: 1, widthMm: 1, heightMm: 1 },
      openingMm: { widthMm: 1, heightMm: 1 },
      payloadCapacityGrams: 100_000_000,
    }));
    const project: Project = {
      ...minimalProject(),
      cargoes,
      containers,
      placements: cargoes.map((cargo, index) => ({
        cargoId: cargo.id,
        containerId: containers[index % containers.length]!.id,
        positionMm: { xMm: 0, yMm: 0, zMm: 0 },
        orientation: "LWH",
      })),
    };

    const result = await readProjectJson(sourceForProject(project));

    expect(result.ok).toBe(true);
    if (result.ok) {
      expect(result.project.cargoes).toHaveLength(1_000);
      expect(result.project.containers).toHaveLength(100);
      expect(result.project.placements).toHaveLength(1_000);
    }
  });

  it("does not reject physical placement invalidity during import", async () => {
    const firstCargo = richProject().cargoes[0]!;
    const project: Project = {
      ...richProject(),
      cargoes: [firstCargo, { ...firstCargo, id: "cargo-2" }],
      containers: [
        {
          ...richProject().containers[0]!,
          openingMm: { widthMm: 1, heightMm: 1 },
          payloadCapacityGrams: 1,
        },
      ],
      placements: [
        {
          cargoId: "cargo-1",
          containerId: "container-1",
          positionMm: { xMm: 1_000_000, yMm: 0, zMm: 1 },
          orientation: "LWH",
        },
        {
          cargoId: "cargo-2",
          containerId: "container-1",
          positionMm: { xMm: 1_000_000, yMm: 0, zMm: 1 },
          orientation: "LWH",
        },
      ],
    };

    await expect(readProjectJson(sourceForProject(project))).resolves.toEqual({
      ok: true,
      project,
    });
  });
});

describe("serializeProjectJson", () => {
  it("round-trips persisted state and excludes root, nested, and derived extras", async () => {
    const project = richProject();
    const withExtras = {
      ...project,
      derived: { status: "invalid" },
      cargoes: [{ ...project.cargoes[0]!, mesh: "not-persisted" }],
      containers: [{ ...project.containers[0]!, warning: "not-persisted" }],
      placements: [{ ...project.placements[0]!, selected: true }],
    } as unknown as Project;

    const result = serializeProjectJson(withExtras);

    expect(result.ok).toBe(true);
    if (result.ok) {
      expect(JSON.parse(result.json)).toEqual(project);
      await expect(readProjectJson(sourceForText(result.json))).resolves.toEqual({
        ok: true,
        project,
      });
    }
  });

  it("round-trips negative placement coordinates without persisting scene state", async () => {
    const project: Project = {
      ...richProject(),
      placements: [
        {
          ...richProject().placements[0]!,
          positionMm: { xMm: -1_000_000, yMm: -1, zMm: -999_999 },
        },
      ],
    };
    const withDerivedState = {
      ...project,
      scene: { scale: 0.001 },
      camera: { position: [1, 2, 3] },
      selection: { cargoId: "cargo-1" },
    } as unknown as Project;
    const original = structuredClone(withDerivedState);

    const result = serializeProjectJson(withDerivedState);

    expect(withDerivedState).toEqual(original);
    expect(result.ok).toBe(true);
    if (result.ok) {
      expect(JSON.parse(result.json)).toEqual(project);
      await expect(readProjectJson(sourceForText(result.json))).resolves.toEqual({
        ok: true,
        project,
      });
      expect(withDerivedState).toEqual(original);
    }
  });

  it.each([
    ["NaN", Number.NaN, "schema", "schema.type"],
    ["Infinity", Number.POSITIVE_INFINITY, "schema", "schema.type"],
    ["out of range", 100_000_001, "schema", "schema.maximum"],
    ["unsafe", Number.MAX_SAFE_INTEGER + 1, "schema", "schema.maximum"],
  ])("refuses to serialize %s numeric data", (_name, massGrams, stage, code) => {
    const invalid = {
      ...richProject(),
      cargoes: [{ ...richProject().cargoes[0]!, massGrams }],
    };

    expect(serializeProjectJson(invalid)).toEqual({
      ok: false,
      stage,
      issues: [{ code, path: "/cargoes/0/massGrams" }],
    });
  });

  it("refuses to serialize an unsupported version before schema validation", () => {
    const invalid = { ...richProject(), schemaVersion: "9.9.9" } as unknown as Project;

    expect(serializeProjectJson(invalid)).toEqual({
      ok: false,
      stage: "version",
      issues: [{ code: "version.unsupported", path: "/schemaVersion" }],
    });
  });

  it("refuses to serialize semantically invalid references", () => {
    const invalid: Project = {
      ...richProject(),
      placements: [{ ...richProject().placements[0]!, cargoId: "missing-cargo" }],
    };

    expect(serializeProjectJson(invalid)).toEqual({
      ok: false,
      stage: "semantic",
      issues: [{ code: "semantic.unknown-cargo-reference", path: "/placements/0/cargoId" }],
    });
  });

  it("returns a fixed failure when deep projection throws", () => {
    const project = new Proxy(richProject(), {
      get(target, property, receiver) {
        if (property === "cargoes") {
          throw new Error("synthetic secret should not escape");
        }
        return Reflect.get(target, property, receiver);
      },
    });

    const result = serializeProjectJson(project);

    expect(result).toEqual({
      ok: false,
      stage: "serialize",
      issues: [{ code: "serialize.failed", path: "/" }],
    });
    expect(JSON.stringify(result)).not.toContain("secret");
  });

  it("serializes physically invalid but structurally and semantically valid placement data", () => {
    const cargo = richProject().cargoes[0]!;
    const project: Project = {
      ...richProject(),
      cargoes: [cargo, { ...cargo, id: "cargo-2" }],
      containers: [
        {
          ...richProject().containers[0]!,
          openingMm: { widthMm: 1, heightMm: 1 },
          payloadCapacityGrams: 1,
        },
      ],
      placements: [
        {
          cargoId: "cargo-1",
          containerId: "container-1",
          positionMm: { xMm: 1_000_000, yMm: 0, zMm: 1 },
          orientation: "LWH",
        },
        {
          cargoId: "cargo-2",
          containerId: "container-1",
          positionMm: { xMm: 1_000_000, yMm: 0, zMm: 1 },
          orientation: "LWH",
        },
      ],
    };

    expect(serializeProjectJson(project).ok).toBe(true);
  });
});
