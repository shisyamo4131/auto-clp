import { describe, expect, it, vi } from "vitest";

import { PROJECT_SCHEMA_VERSION, type Project } from "../domain/model";
import { MAX_PROJECT_FILE_BYTES, type ProjectJsonSource } from "../persistence/project-json";
import { importProject, type ProjectState } from "./project-import";

const encoder = new TextEncoder();

function project(id: string): Project {
  return {
    schemaVersion: PROJECT_SCHEMA_VERSION,
    projectId: id,
    name: `匿名CLP${id}`,
    clearancesMm: { xMm: 0, yMm: 0, zMm: 0 },
    cargoes: [],
    containers: [],
    placements: [],
  };
}

function sourceForText(text: string): ProjectJsonSource {
  return { sizeBytes: encoder.encode(text).byteLength, readText: async () => text };
}

function sourceForValue(value: unknown): ProjectJsonSource {
  return sourceForText(JSON.stringify(value));
}

describe("importProject", () => {
  it("returns a new state only after derivation succeeds", async () => {
    const currentState: ProjectState<{ readonly label: string }> = {
      project: project("current"),
      derived: { label: "current-derived" },
    };
    const incoming = project("incoming");
    const derive = vi.fn((nextProject: Project) => ({ label: `derived-${nextProject.projectId}` }));

    const result = await importProject(currentState, sourceForValue(incoming), derive);

    expect(derive).toHaveBeenCalledOnce();
    expect(result).toEqual({
      ok: true,
      nextState: {
        project: incoming,
        derived: { label: "derived-incoming" },
      },
    });
    if (result.ok) {
      expect(result.nextState).not.toBe(currentState);
    }
  });

  it.each([
    [
      "size",
      {
        sizeBytes: MAX_PROJECT_FILE_BYTES + 1,
        readText: async () => JSON.stringify(project("incoming")),
      },
    ],
    [
      "read",
      {
        sizeBytes: 1,
        readText: async () => {
          throw new Error("synthetic read failure");
        },
      },
    ],
    ["syntax", sourceForText("not-json")],
    ["version", sourceForValue({ ...project("incoming"), schemaVersion: "9.9.9" })],
    ["schema", sourceForValue({ ...project("incoming"), extra: true })],
    [
      "semantic",
      sourceForValue({
        ...project("incoming"),
        cargoes: [
          {
            id: "cargo-1",
            name: "匿名積荷",
            dimensionsMm: { lengthMm: 1, widthMm: 1, heightMm: 1 },
            massGrams: 1,
            canSupportCargo: false,
            allowedOrientations: ["LWH"],
          },
          {
            id: "cargo-1",
            name: "匿名積荷2",
            dimensionsMm: { lengthMm: 1, widthMm: 1, heightMm: 1 },
            massGrams: 1,
            canSupportCargo: false,
            allowedOrientations: ["LWH"],
          },
        ],
      }),
    ],
  ] satisfies ReadonlyArray<readonly [string, ProjectJsonSource]>) (
    "preserves current state identity on %s failure and does not derive",
    async (stage, source) => {
      const currentState: ProjectState<{ readonly valid: boolean }> = {
        project: project("current"),
        derived: { valid: true },
      };
      const derive = vi.fn(() => ({ valid: false }));

      const result = await importProject(currentState, source, derive);

      expect(result.ok).toBe(false);
      if (!result.ok) {
        expect(result.stage).toBe(stage);
        expect(result.nextState).toBe(currentState);
      }
      expect(derive).not.toHaveBeenCalled();
    },
  );

  it("preserves current state identity when derivation fails", async () => {
    const currentState: ProjectState<{ readonly valid: boolean }> = {
      project: project("current"),
      derived: { valid: true },
    };
    const derive = vi.fn(() => {
      throw new Error("synthetic derive failure");
    });

    const result = await importProject(currentState, sourceForValue(project("incoming")), derive);

    expect(result).toEqual({
      ok: false,
      stage: "derive",
      issues: [{ code: "derive.failed", path: "/" }],
      nextState: currentState,
    });
    expect(result.nextState).toBe(currentState);
    expect(derive).toHaveBeenCalledOnce();
  });

  it("does not call the reader for an oversized source", async () => {
    const currentState: ProjectState<null> = { project: project("current"), derived: null };
    const readText = vi.fn(async () => JSON.stringify(project("incoming")));

    await importProject(
      currentState,
      { sizeBytes: MAX_PROJECT_FILE_BYTES + 1, readText },
      () => null,
    );

    expect(readText).not.toHaveBeenCalled();
  });
});
