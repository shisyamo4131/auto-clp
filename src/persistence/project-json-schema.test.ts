import { describe, expect, it } from "vitest";

import { ORIENTATIONS, PROJECT_SCHEMA_VERSION } from "../domain/model";
import { compareCodeUnits, validateProjectJsonSchema } from "./project-json-schema";

function minimalProject(): unknown {
  return {
    schemaVersion: PROJECT_SCHEMA_VERSION,
    projectId: "project-1",
    name: "匿名試験案件",
    clearancesMm: { xMm: 0, yMm: 0, zMm: 0 },
    cargoes: [],
    containers: [],
    placements: [],
  };
}

function richProject(): unknown {
  return {
    schemaVersion: PROJECT_SCHEMA_VERSION,
    projectId: "project-1",
    name: "匿名試験案件",
    clearancesMm: { xMm: 10, yMm: 20, zMm: 30 },
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

describe("validateProjectJsonSchema", () => {
  it.each([
    ["minimal", minimalProject],
    ["rich", richProject],
  ])("accepts a %s valid project without mutation", (_name, createProject) => {
    const project = createProject();
    const original = structuredClone(project);

    const result = validateProjectJsonSchema(project);

    expect(result.valid).toBe(true);
    expect(project).toEqual(original);
  });

  it("rejects root and nested additional properties with stable paths", () => {
    const project = richProject() as Record<string, unknown>;
    project.derived = { valid: true };
    const cargoes = project.cargoes as Array<Record<string, unknown>>;
    cargoes[0]!.mesh = "not-persisted";

    const result = validateProjectJsonSchema(project);

    expect(result).toEqual({
      valid: false,
      issues: [
        { code: "schema.additionalProperties", path: "/" },
        { code: "schema.additionalProperties", path: "/cargoes/0" },
      ],
    });
  });

  it("never reflects additional property names in issues", () => {
    const secretKey = "SECRET-token\u0001/値";
    const project = minimalProject() as Record<string, unknown>;
    project[secretKey] = true;

    const result = validateProjectJsonSchema(project);

    expect(result).toEqual({
      valid: false,
      issues: [{ code: "schema.additionalProperties", path: "/" }],
    });
    expect(JSON.stringify(result)).not.toContain("SECRET");
    expect(JSON.stringify(result)).not.toContain("token");
    expect(JSON.stringify(result)).not.toContain("値");
  });

  it.each([
    ["range", 0, "schema.minimum"],
    ["integer", 1.5, "schema.type"],
  ])("rejects a representative %s violation", (_name, lengthMm, code) => {
    const project = richProject() as {
      cargoes: Array<{ dimensionsMm: { lengthMm: number } }>;
    };
    project.cargoes[0]!.dimensionsMm.lengthMm = lengthMm;

    const result = validateProjectJsonSchema(project);

    expect(result).toEqual({
      valid: false,
      issues: [{ code, path: "/cargoes/0/dimensionsMm/lengthMm" }],
    });
  });

  it("limits and deterministically orders schema issues", () => {
    const project = {
      ...(minimalProject() as Record<string, unknown>),
      cargoes: Array.from({ length: 10 }, () => ({})),
    };

    const first = validateProjectJsonSchema(project);
    const second = validateProjectJsonSchema(project);

    expect(first).toEqual(second);
    expect(first.valid).toBe(false);
    if (!first.valid) {
      expect(first.issues).toHaveLength(50);
      expect(first.issues[0]).toEqual({
        code: "schema.required",
        path: "/cargoes/0/allowedOrientations",
      });
    }
  });

  it("sorts strings by explicit code units across symbols, case, and Unicode", () => {
    const values = ["あ", "é", "a", "_", "Z", "A", "/"];

    expect([...values].sort(compareCodeUnits)).toEqual(["/", "A", "Z", "_", "a", "é", "あ"]);
  });

  it.each([
    ["dimension minimum", 1],
    ["dimension maximum", 100_000],
  ])("accepts %s", (_name, value) => {
    const project = richProject() as {
      cargoes: Array<{ dimensionsMm: { lengthMm: number } }>;
    };
    project.cargoes[0]!.dimensionsMm.lengthMm = value;

    expect(validateProjectJsonSchema(project).valid).toBe(true);
  });

  it.each([
    ["dimension below minimum", 0, "schema.minimum"],
    ["dimension above maximum", 100_001, "schema.maximum"],
  ])("rejects %s", (_name, value, code) => {
    const project = richProject() as {
      cargoes: Array<{ dimensionsMm: { lengthMm: number } }>;
    };
    project.cargoes[0]!.dimensionsMm.lengthMm = value;

    expect(validateProjectJsonSchema(project)).toEqual({
      valid: false,
      issues: [{ code, path: "/cargoes/0/dimensionsMm/lengthMm" }],
    });
  });

  it.each([
    ["clearance minimum", 0],
    ["clearance maximum", 10_000],
  ])("accepts %s", (_name, value) => {
    const project = richProject() as { clearancesMm: { xMm: number } };
    project.clearancesMm.xMm = value;

    expect(validateProjectJsonSchema(project).valid).toBe(true);
  });

  it.each([
    ["clearance below minimum", -1, "schema.minimum"],
    ["clearance above maximum", 10_001, "schema.maximum"],
  ])("rejects %s", (_name, value, code) => {
    const project = richProject() as { clearancesMm: { xMm: number } };
    project.clearancesMm.xMm = value;

    expect(validateProjectJsonSchema(project)).toEqual({
      valid: false,
      issues: [{ code, path: "/clearancesMm/xMm" }],
    });
  });

  it.each([
    ["cargo mass minimum", "cargo", 1],
    ["cargo mass maximum", "cargo", 100_000_000],
    ["payload minimum", "payload", 1],
    ["payload maximum", "payload", 100_000_000],
  ])("accepts %s", (_name, target, value) => {
    const project = richProject() as {
      cargoes: Array<{ massGrams: number }>;
      containers: Array<{ payloadCapacityGrams: number }>;
    };
    if (target === "cargo") {
      project.cargoes[0]!.massGrams = value;
    } else {
      project.containers[0]!.payloadCapacityGrams = value;
    }

    expect(validateProjectJsonSchema(project).valid).toBe(true);
  });

  it.each([
    ["cargo mass below minimum", "cargo", 0, "schema.minimum", "/cargoes/0/massGrams"],
    [
      "cargo mass above maximum",
      "cargo",
      100_000_001,
      "schema.maximum",
      "/cargoes/0/massGrams",
    ],
    [
      "payload below minimum",
      "payload",
      0,
      "schema.minimum",
      "/containers/0/payloadCapacityGrams",
    ],
    [
      "payload above maximum",
      "payload",
      100_000_001,
      "schema.maximum",
      "/containers/0/payloadCapacityGrams",
    ],
  ])("rejects %s", (_name, target, value, code, path) => {
    const project = richProject() as {
      cargoes: Array<{ massGrams: number }>;
      containers: Array<{ payloadCapacityGrams: number }>;
    };
    if (target === "cargo") {
      project.cargoes[0]!.massGrams = value;
    } else {
      project.containers[0]!.payloadCapacityGrams = value;
    }

    expect(validateProjectJsonSchema(project)).toEqual({
      valid: false,
      issues: [{ code, path }],
    });
  });

  it.each([
    ["coordinate minimum", -1_000_000],
    ["coordinate maximum", 1_000_000],
  ])("accepts %s", (_name, value) => {
    const project = richProject() as {
      placements: Array<{ positionMm: { xMm: number } }>;
    };
    project.placements[0]!.positionMm.xMm = value;

    expect(validateProjectJsonSchema(project).valid).toBe(true);
  });

  it.each([
    ["coordinate below minimum", -1_000_001, "schema.minimum"],
    ["coordinate above maximum", 1_000_001, "schema.maximum"],
  ])("rejects %s", (_name, value, code) => {
    const project = richProject() as {
      placements: Array<{ positionMm: { xMm: number } }>;
    };
    project.placements[0]!.positionMm.xMm = value;

    expect(validateProjectJsonSchema(project)).toEqual({
      valid: false,
      issues: [{ code, path: "/placements/0/positionMm/xMm" }],
    });
  });

  it.each([
    ["cargo", "cargoes", 1_001, "/cargoes"],
    ["container", "containers", 101, "/containers"],
    ["placement", "placements", 1_001, "/placements"],
  ])("rejects %s count above maximum", (_name, field, count, path) => {
    const project = richProject() as Record<string, unknown>;
    const item = (project[field] as readonly unknown[])[0];
    project[field] = Array.from({ length: count }, () => structuredClone(item));

    const result = validateProjectJsonSchema(project);
    expect(result.valid).toBe(false);
    if (!result.valid) {
      expect(result.issues).toContainEqual({ code: "schema.maxItems", path });
    }
  });

  it.each([
    ["empty", [], "schema.minItems", "/cargoes/0/allowedOrientations"],
    ["duplicate", ["LWH", "LWH"], "schema.uniqueItems", "/cargoes/0/allowedOrientations"],
    ["unknown", ["UNKNOWN"], "schema.enum", "/cargoes/0/allowedOrientations/0"],
  ])("rejects %s allowed orientations", (_name, orientations, code, path) => {
    const project = richProject() as {
      cargoes: Array<{ allowedOrientations: string[] }>;
    };
    project.cargoes[0]!.allowedOrientations = orientations;

    const result = validateProjectJsonSchema(project);
    expect(result.valid).toBe(false);
    if (!result.valid) {
      expect(result.issues).toContainEqual({
        code,
        path,
      });
    }
  });

  it("accepts all six legal orientations", () => {
    const project = richProject() as {
      cargoes: Array<{ allowedOrientations: string[] }>;
    };
    project.cargoes[0]!.allowedOrientations = [...ORIENTATIONS];

    expect(validateProjectJsonSchema(project).valid).toBe(true);
  });

  it("rejects seven orientations by count", () => {
    const project = richProject() as {
      cargoes: Array<{ allowedOrientations: string[] }>;
    };
    project.cargoes[0]!.allowedOrientations = [...ORIENTATIONS, "LWH"];

    const result = validateProjectJsonSchema(project);
    expect(result.valid).toBe(false);
    if (!result.valid) {
      expect(result.issues).toContainEqual({
        code: "schema.maxItems",
        path: "/cargoes/0/allowedOrientations",
      });
    }
  });

  it.each([
    ["minimum length", "a"],
    ["maximum length", "a".repeat(64)],
  ])("accepts an id at %s", (_name, id) => {
    const project = richProject() as { projectId: string };
    project.projectId = id;

    expect(validateProjectJsonSchema(project).valid).toBe(true);
  });

  it.each([
    ["empty", "", "schema.minLength"],
    ["65 characters", "a".repeat(65), "schema.maxLength"],
    ["bad leading character", "_bad", "schema.pattern"],
  ])("rejects %s id", (_name, id, code) => {
    const project = richProject() as { projectId: string };
    project.projectId = id;

    const result = validateProjectJsonSchema(project);
    expect(result.valid).toBe(false);
    if (!result.valid) {
      expect(result.issues).toContainEqual({ code, path: "/projectId" });
    }
  });
});
