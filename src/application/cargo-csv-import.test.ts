import { describe, expect, it } from "vitest";

import { ORIENTATIONS, type Cargo, type Project } from "../domain/model";
import { createInitialProject } from "./project-factory";
import {
  prepareCargoCsvImport,
  prepareCargoCsvReplacement,
} from "./cargo-csv-import";
import {
  commitProjectHistory,
  createProjectHistory,
  redoProjectHistory,
  undoProjectHistory,
} from "./project-history";

function cargo(id: string, name = id): Cargo {
  return {
    id,
    name,
    dimensionsMm: { lengthMm: 10, widthMm: 20, heightMm: 30 },
    massGrams: 1_000,
    canSupportCargo: true,
    allowedOrientations: [...ORIENTATIONS],
  };
}

function existingProject(count = 2): Project {
  const cargoes = Array.from({ length: count }, (_, index) => cargo(`old-${index + 1}`));
  return {
    ...createInitialProject("synthetic-project"),
    name: "匿名CLP",
    clearancesMm: { xMm: 11, yMm: 12, zMm: 13 },
    cargoes,
    containers: [
      {
        id: "container-1",
        name: "匿名コンテナ",
        internalDimensionsMm: { lengthMm: 1000, widthMm: 1000, heightMm: 1000 },
        openingMm: { widthMm: 1000, heightMm: 1000 },
        payloadCapacityGrams: 100_000,
      },
    ],
    placements: cargoes.slice(0, 2).map((item, index) => ({
      cargoId: item.id,
      containerId: "container-1",
      positionMm: { xMm: index * 10, yMm: 0, zMm: 0 },
      orientation: "LWH" as const,
    })),
  };
}

describe("cargo CSV replacement application boundary", () => {
  it("replaces only cargoes and placements and reports confirmation counts", () => {
    const current = existingProject();
    const nextCargoes = [cargo("cargo-1", "新規A"), cargo("cargo-2", "新規A")];
    const result = prepareCargoCsvReplacement(current, nextCargoes);
    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.changed).toBe(true);
    expect(result.summary).toEqual({
      newCargoCount: 2,
      removedCargoCount: 2,
      clearedPlacementCount: 2,
    });
    expect(result.project).toMatchObject({
      schemaVersion: current.schemaVersion,
      projectId: current.projectId,
      name: current.name,
      clearancesMm: current.clearancesMm,
      containers: current.containers,
      cargoes: nextCargoes,
      placements: [],
    });
    expect(current.placements).toHaveLength(2);
  });

  it("returns an identical Project for no-op and does not bypass defensive validation", () => {
    const current: Project = { ...existingProject(), cargoes: [cargo("cargo-1")], placements: [] };
    const noOp = prepareCargoCsvReplacement(current, [cargo("cargo-1")]);
    expect(noOp).toMatchObject({ ok: true, changed: false, project: current });
    if (noOp.ok) {
      expect(noOp.project).toBe(current);
      expect(noOp.summary).toEqual({
        newCargoCount: 1,
        removedCargoCount: 1,
        clearedPlacementCount: 0,
      });
    }

    const corrupt = {
      ...current,
      containers: [{ ...current.containers[0]!, openingMm: { widthMm: 1001, heightMm: 1000 } }],
    };
    expect(prepareCargoCsvReplacement(corrupt, corrupt.cargoes)).toEqual({
      ok: false,
      project: corrupt,
      issues: [{ code: "cargo-csv.candidate-invalid", path: "/" }],
    });
  });

  it("supports one history action with complete undo and redo, including legacy cargo counts", () => {
    const current = existingProject(31);
    const prepared = prepareCargoCsvReplacement(current, [cargo("cargo-1", "新規")]);
    expect(prepared.ok).toBe(true);
    if (!prepared.ok) return;
    const committed = commitProjectHistory(createProjectHistory(current), {
      baseProject: current,
      nextProject: prepared.project,
      action: "cargo.csv-replace",
    });
    expect(committed.ok && committed.changed).toBe(true);
    if (!committed.ok) return;
    expect(committed.state.past).toHaveLength(1);
    const undone = undoProjectHistory(committed.state);
    expect(undone.ok && undone.state.present.cargoes).toHaveLength(31);
    expect(undone.ok && undone.state.present.placements).toHaveLength(2);
    if (!undone.ok) return;
    const redone = redoProjectHistory(undone.state);
    expect(redone.ok && redone.state.present.cargoes).toHaveLength(1);
    expect(redone.ok && redone.state.present.placements).toHaveLength(0);
  });

  it("rejects a stale CSV-labeled history commit without changing history", () => {
    const current = existingProject();
    const newer = { ...current, name: "別の確定変更" };
    const state = createProjectHistory(newer);
    const prepared = prepareCargoCsvReplacement(current, [cargo("cargo-1")]);
    expect(prepared.ok).toBe(true);
    if (!prepared.ok) return;
    const stale = commitProjectHistory(state, {
      baseProject: current,
      nextProject: prepared.project,
      action: "cargo.csv-replace",
    });
    expect(stale).toEqual({
      ok: false,
      code: "history.stale-base",
      state,
    });
    expect(stale.state).toBe(state);
  });

  it("keeps the current Project on parse failure", async () => {
    const current = existingProject();
    const result = await prepareCargoCsvImport(current, {
      sizeBytes: 4,
      readBytes: async () => new Uint8Array([0xc3, 0x28]),
    });
    expect(result).toEqual({
      ok: false,
      project: current,
      issues: [{ code: "cargo-csv.utf8", path: "/file" }],
    });
  });
});
