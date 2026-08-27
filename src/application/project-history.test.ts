import { describe, expect, it } from "vitest";

import { PROJECT_SCHEMA_VERSION, type Project } from "../domain/model";
import { updatePlacement } from "./project-command";
import {
  PROJECT_HISTORY_LIMIT,
  commitProjectHistory,
  createProjectHistory,
  redoProjectHistory,
  undoProjectHistory,
  type ProjectHistoryAction,
  type ProjectHistoryState,
} from "./project-history";

function projectFixture(name = "履歴0"): Project {
  return {
    schemaVersion: PROJECT_SCHEMA_VERSION,
    projectId: "history-test",
    name,
    clearancesMm: { xMm: 0, yMm: 0, zMm: 0 },
    cargoes: [],
    containers: [],
    placements: [],
  };
}

function nextProject(project: Project, name: string): Project {
  return { ...project, name };
}

function commit(
  state: ProjectHistoryState,
  next: Project,
  action: ProjectHistoryAction = "project-settings.update",
): ProjectHistoryState {
  const transition = commitProjectHistory(state, {
    baseProject: state.present,
    nextProject: next,
    action,
  });
  if (!transition.ok || !transition.changed) {
    throw new Error("Fixture commit failed");
  }
  return transition.state;
}

describe("project history", () => {
  it("creates an empty history around the exact initial Project reference", () => {
    const initial = projectFixture();

    const state = createProjectHistory(initial);

    expect(state).toEqual({ past: [], present: initial, future: [] });
    expect(state.present).toBe(initial);
  });

  it("commits, undoes, and redoes exact Project and action references without mutation", () => {
    const initial = projectFixture();
    const next = nextProject(initial, "履歴1");
    const originalInitial = structuredClone(initial);
    const originalNext = structuredClone(next);
    const created = createProjectHistory(initial);

    const committed = commitProjectHistory(created, {
      baseProject: initial,
      nextProject: next,
      action: "cargo.add",
    });
    expect(committed).toMatchObject({ ok: true, changed: true, action: "cargo.add" });
    if (!committed.ok || !committed.changed) {
      throw new Error("Expected commit");
    }
    expect(committed.state.past[0]).toEqual({ project: initial, action: "cargo.add" });
    expect(committed.state.present).toBe(next);
    expect(committed.state.future).toEqual([]);

    const undone = undoProjectHistory(committed.state);
    expect(undone).toMatchObject({ ok: true, changed: true, action: "cargo.add" });
    if (!undone.ok || !undone.changed) {
      throw new Error("Expected undo");
    }
    expect(undone.state.present).toBe(initial);
    expect(undone.state.future[0]).toEqual({ project: next, action: "cargo.add" });

    const redone = redoProjectHistory(undone.state);
    expect(redone).toMatchObject({ ok: true, changed: true, action: "cargo.add" });
    if (!redone.ok || !redone.changed) {
      throw new Error("Expected redo");
    }
    expect(redone.state.present).toBe(next);
    expect(redone.state.past.at(-1)).toEqual({ project: initial, action: "cargo.add" });
    expect(redone.state.future).toEqual([]);
    expect(initial).toEqual(originalInitial);
    expect(next).toEqual(originalNext);
  });

  it("returns the identical state and future for stale, no-op, and empty navigation", () => {
    const initial = projectFixture();
    const next = nextProject(initial, "履歴1");
    const committed = commit(createProjectHistory(initial), next, "cargo.update");
    const undone = undoProjectHistory(committed);
    if (!undone.ok || !undone.changed) {
      throw new Error("Expected undo fixture");
    }
    const stateWithFuture = undone.state;
    const future = stateWithFuture.future;

    const stale = commitProjectHistory(stateWithFuture, {
      baseProject: next,
      nextProject: nextProject(next, "stale"),
      action: "container.update",
    });
    expect(stale).toEqual({
      ok: false,
      code: "history.stale-base",
      state: stateWithFuture,
    });
    expect(stale.state).toBe(stateWithFuture);
    expect(stale.state.future).toBe(future);

    const noOp = commitProjectHistory(stateWithFuture, {
      baseProject: initial,
      nextProject: initial,
      action: "project-settings.update",
    });
    expect(noOp).toEqual({ ok: true, changed: false, state: stateWithFuture });
    expect(noOp.state).toBe(stateWithFuture);
    expect(noOp.state.future).toBe(future);

    const nothingToUndo = undoProjectHistory(stateWithFuture);
    expect(nothingToUndo).toEqual({
      ok: false,
      code: "history.nothing-to-undo",
      state: stateWithFuture,
    });
    expect(nothingToUndo.state.future).toBe(future);

    const noFutureState = createProjectHistory(initial);
    const nothingToRedo = redoProjectHistory(noFutureState);
    expect(nothingToRedo).toEqual({
      ok: false,
      code: "history.nothing-to-redo",
      state: noFutureState,
    });
    expect(nothingToRedo.state).toBe(noFutureState);
  });

  it("discards redo only after a successful changed commit following undo", () => {
    const p0 = projectFixture("履歴0");
    const p1 = nextProject(p0, "履歴1");
    const p2 = nextProject(p1, "履歴2");
    let state = commit(createProjectHistory(p0), p1, "cargo.add");
    state = commit(state, p2, "container.add");
    const undone = undoProjectHistory(state);
    if (!undone.ok || !undone.changed) {
      throw new Error("Expected undo");
    }
    expect(undone.state.future.at(-1)?.project).toBe(p2);

    const noOp = commitProjectHistory(undone.state, {
      baseProject: p1,
      nextProject: p1,
      action: "placement.update",
    });
    expect(noOp.state.future.at(-1)?.project).toBe(p2);

    const branch = nextProject(p1, "分岐");
    const branched = commitProjectHistory(noOp.state, {
      baseProject: p1,
      nextProject: branch,
      action: "placement.add",
    });
    if (!branched.ok || !branched.changed) {
      throw new Error("Expected branch commit");
    }
    expect(branched.state.present).toBe(branch);
    expect(branched.state.future).toEqual([]);
    expect(redoProjectHistory(branched.state)).toEqual({
      ok: false,
      code: "history.nothing-to-redo",
      state: branched.state,
    });
  });

  it("keeps past and future stacks symmetric across multiple action types", () => {
    const projects = [projectFixture("0")];
    const actions: ProjectHistoryAction[] = [
      "cargo.add",
      "container.add",
      "placement.add",
      "placement.drag-xy",
    ];
    let state = createProjectHistory(projects[0]!);
    for (const [index, action] of actions.entries()) {
      const next = nextProject(state.present, String(index + 1));
      projects.push(next);
      state = commit(state, next, action);
    }

    for (let index = actions.length - 1; index >= 0; index -= 1) {
      const transition = undoProjectHistory(state);
      expect(transition).toMatchObject({ ok: true, action: actions[index] });
      if (!transition.ok || !transition.changed) {
        throw new Error("Expected undo sequence");
      }
      state = transition.state;
      expect(state.present).toBe(projects[index]);
    }
    expect(state.past).toEqual([]);
    expect(state.future.map((frame) => frame.action)).toEqual([...actions].reverse());

    for (const [index, action] of actions.entries()) {
      const transition = redoProjectHistory(state);
      expect(transition).toMatchObject({ ok: true, action });
      if (!transition.ok || !transition.changed) {
        throw new Error("Expected redo sequence");
      }
      state = transition.state;
      expect(state.present).toBe(projects[index + 1]);
    }
    expect(state.future).toEqual([]);
  });

  it("caps past at 100 and evicts exactly the oldest of 101 commits", () => {
    const projects = [projectFixture("0")];
    let state = createProjectHistory(projects[0]!);
    for (let index = 1; index <= PROJECT_HISTORY_LIMIT + 1; index += 1) {
      const next = nextProject(state.present, String(index));
      projects.push(next);
      state = commit(state, next);
    }

    expect(state.past).toHaveLength(PROJECT_HISTORY_LIMIT);
    expect(state.past[0]?.project).toBe(projects[1]);
    expect(state.past.at(-1)?.project).toBe(projects[100]);
    expect(state.present).toBe(projects[101]);

    for (let count = 0; count < PROJECT_HISTORY_LIMIT; count += 1) {
      const transition = undoProjectHistory(state);
      if (!transition.ok || !transition.changed) {
        throw new Error("Expected capped undo");
      }
      state = transition.state;
    }
    expect(state.present).toBe(projects[1]);
    expect(state.future).toHaveLength(PROJECT_HISTORY_LIMIT);
    expect(undoProjectHistory(state)).toMatchObject({
      ok: false,
      code: "history.nothing-to-undo",
    });

    for (let count = 0; count < PROJECT_HISTORY_LIMIT; count += 1) {
      const transition = redoProjectHistory(state);
      if (!transition.ok || !transition.changed) {
        throw new Error("Expected capped redo");
      }
      state = transition.state;
    }
    expect(state.present).toBe(projects[101]);
    expect(state.future).toEqual([]);
  });

  it("shares identity across 100 updates of a 1000-placement Project", () => {
    const cargoes = Array.from({ length: 1_000 }, (_, index) => ({
      id: `cargo-${index + 1}`,
      name: `匿名積荷${index + 1}`,
      dimensionsMm: { lengthMm: 10, widthMm: 10, heightMm: 10 },
      massGrams: 1,
      canSupportCargo: false,
      allowedOrientations: ["LWH"] as const,
    }));
    const initial: Project = {
      ...projectFixture("大規模履歴"),
      cargoes,
      containers: [
        {
          id: "container-1",
          name: "匿名候補",
          internalDimensionsMm: {
            lengthMm: 100_000,
            widthMm: 100_000,
            heightMm: 100_000,
          },
          openingMm: { widthMm: 100_000, heightMm: 100_000 },
          payloadCapacityGrams: 100_000_000,
        },
      ],
      placements: cargoes.map((cargo, index) => ({
        cargoId: cargo.id,
        containerId: "container-1",
        positionMm: { xMm: index * 10, yMm: 0, zMm: 0 },
        orientation: "LWH" as const,
      })),
    };
    let state = createProjectHistory(initial);

    for (let index = 0; index < 100; index += 1) {
      const current = state.present;
      const unchangedBefore = current.placements[index + 1];
      const result = updatePlacement(current, `cargo-${index + 1}`, "container-1", {
        xMm: String(index * 10 + 1),
        yMm: "0",
        zMm: "0",
        orientation: "LWH",
      });
      expect(result.ok).toBe(true);
      if (!result.ok) {
        throw new Error("Expected placement update");
      }
      expect(result.project.cargoes).toBe(current.cargoes);
      expect(result.project.containers).toBe(current.containers);
      expect(result.project.placements).not.toBe(current.placements);
      expect(result.project.placements[index + 1]).toBe(unchangedBefore);
      expect(result.project.placements[index]).not.toBe(current.placements[index]);
      state = commit(state, result.project, "placement.update");
      expect(state.past.at(-1)?.project).toBe(current);
    }

    expect(state.past).toHaveLength(PROJECT_HISTORY_LIMIT);
    expect(state.present.cargoes).toBe(initial.cargoes);
    expect(state.present.containers).toBe(initial.containers);
  });

  it("keeps deletion snapshots reference-consistent through undo and redo", () => {
    const cargo = {
      id: "cargo-1",
      name: "匿名積荷",
      dimensionsMm: { lengthMm: 10, widthMm: 10, heightMm: 10 },
      massGrams: 1,
      canSupportCargo: false,
      allowedOrientations: ["LWH"] as const,
    };
    const container = {
      id: "container-1",
      name: "匿名候補",
      internalDimensionsMm: { lengthMm: 100, widthMm: 100, heightMm: 100 },
      openingMm: { widthMm: 100, heightMm: 100 },
      payloadCapacityGrams: 100,
    };
    const before: Project = {
      ...projectFixture(),
      cargoes: [cargo],
      containers: [container],
      placements: [
        {
          cargoId: cargo.id,
          containerId: container.id,
          positionMm: { xMm: 0, yMm: 0, zMm: 0 },
          orientation: "LWH",
        },
      ],
    };
    const after: Project = {
      ...before,
      cargoes: [],
      placements: [],
    };
    const committed = commit(createProjectHistory(before), after, "cargo.delete");
    expect(committed.past[0]?.project).toBe(before);
    expect(committed.present).toBe(after);

    const undo = undoProjectHistory(committed);
    if (!undo.ok || !undo.changed) {
      throw new Error("Expected delete undo");
    }
    expect(undo.state.present).toBe(before);
    expect(undo.state.present.cargoes[0]).toBe(cargo);
    expect(undo.state.present.containers[0]).toBe(container);
    expect(undo.state.present.placements[0]?.cargoId).toBe(cargo.id);

    const redo = redoProjectHistory(undo.state);
    if (!redo.ok || !redo.changed) {
      throw new Error("Expected delete redo");
    }
    expect(redo.state.present).toBe(after);
    expect(redo.state.future).toEqual([]);
  });

  it("treats automatic proposal apply as one capped undo and redo action", () => {
    const initial = projectFixture("適用前");
    let state = createProjectHistory(initial);
    const projects = [initial];
    for (let index = 1; index <= PROJECT_HISTORY_LIMIT + 1; index += 1) {
      const next = nextProject(state.present, `適用${index}`);
      projects.push(next);
      state = commit(state, next, "automatic-proposal.apply");
    }

    expect(state.past).toHaveLength(PROJECT_HISTORY_LIMIT);
    expect(state.past[0]).toEqual({
      project: projects[1],
      action: "automatic-proposal.apply",
    });
    const undone = undoProjectHistory(state);
    expect(undone).toMatchObject({
      ok: true,
      changed: true,
      action: "automatic-proposal.apply",
    });
    if (!undone.ok || !undone.changed) {
      throw new Error("Expected automatic proposal undo");
    }
    expect(undone.state.present).toBe(projects[100]);

    const redone = redoProjectHistory(undone.state);
    expect(redone).toMatchObject({
      ok: true,
      changed: true,
      action: "automatic-proposal.apply",
    });
    if (!redone.ok || !redone.changed) {
      throw new Error("Expected automatic proposal redo");
    }
    expect(redone.state.present).toBe(projects[101]);
  });
});
