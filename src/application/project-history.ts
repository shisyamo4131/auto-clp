import type { Project } from "../domain/model";

export const PROJECT_HISTORY_LIMIT = 100;

export type ProjectHistoryAction =
  | "project-settings.update"
  | "cargo.add"
  | "cargo.update"
  | "cargo.delete"
  | "container.add"
  | "container.update"
  | "container.delete"
  | "placement.add"
  | "placement.update"
  | "placement.delete"
  | "placement.drag-xy";

export interface ProjectHistoryFrame {
  readonly project: Project;
  readonly action: ProjectHistoryAction;
}

export interface ProjectHistoryState {
  readonly past: readonly ProjectHistoryFrame[];
  readonly present: Project;
  readonly future: readonly ProjectHistoryFrame[];
}

export interface ProjectHistoryCommit {
  readonly baseProject: Project;
  readonly nextProject: Project;
  readonly action: ProjectHistoryAction;
}

export type ProjectHistoryTransition =
  | {
      readonly ok: true;
      readonly changed: boolean;
      readonly state: ProjectHistoryState;
      readonly action?: ProjectHistoryAction;
    }
  | {
      readonly ok: false;
      readonly code:
        | "history.stale-base"
        | "history.nothing-to-undo"
        | "history.nothing-to-redo";
      readonly state: ProjectHistoryState;
    };

export type ProjectHistoryCommitHandler = (
  commit: ProjectHistoryCommit,
) => ProjectHistoryTransition;

function appendPast(
  past: readonly ProjectHistoryFrame[],
  frame: ProjectHistoryFrame,
): readonly ProjectHistoryFrame[] {
  const appended = [...past, frame];
  return appended.length <= PROJECT_HISTORY_LIMIT
    ? appended
    : appended.slice(appended.length - PROJECT_HISTORY_LIMIT);
}

export function createProjectHistory(initial: Project): ProjectHistoryState {
  return { past: [], present: initial, future: [] };
}

export function commitProjectHistory(
  state: ProjectHistoryState,
  commit: ProjectHistoryCommit,
): ProjectHistoryTransition {
  if (state.present !== commit.baseProject) {
    return { ok: false, code: "history.stale-base", state };
  }
  if (commit.nextProject === commit.baseProject) {
    return { ok: true, changed: false, state };
  }
  return {
    ok: true,
    changed: true,
    action: commit.action,
    state: {
      past: appendPast(state.past, {
        project: state.present,
        action: commit.action,
      }),
      present: commit.nextProject,
      future: [],
    },
  };
}

export function undoProjectHistory(
  state: ProjectHistoryState,
): ProjectHistoryTransition {
  const frame = state.past.at(-1);
  if (frame === undefined) {
    return { ok: false, code: "history.nothing-to-undo", state };
  }
  return {
    ok: true,
    changed: true,
    action: frame.action,
    state: {
      past: state.past.slice(0, -1),
      present: frame.project,
      future: [
        ...state.future,
        { project: state.present, action: frame.action },
      ],
    },
  };
}

export function redoProjectHistory(
  state: ProjectHistoryState,
): ProjectHistoryTransition {
  const frame = state.future.at(-1);
  if (frame === undefined) {
    return { ok: false, code: "history.nothing-to-redo", state };
  }
  return {
    ok: true,
    changed: true,
    action: frame.action,
    state: {
      past: appendPast(state.past, {
        project: state.present,
        action: frame.action,
      }),
      present: frame.project,
      future: state.future.slice(0, -1),
    },
  };
}
