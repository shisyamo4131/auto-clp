import type { Project } from "../domain/model";
import type { ValidationIssue } from "../domain/validation";
import {
  readProjectJson,
  type ProjectJsonFailureStage,
  type ProjectJsonSource,
} from "../persistence/project-json";

export interface ProjectState<TDerived> {
  readonly project: Project;
  readonly derived: TDerived;
}

export type ProjectDeriver<TDerived> = (project: Project) => TDerived | Promise<TDerived>;

export type ProjectImportResult<TDerived> =
  | { readonly ok: true; readonly nextState: ProjectState<TDerived> }
  | {
      readonly ok: false;
      readonly stage: ProjectJsonFailureStage | "derive";
      readonly issues: readonly ValidationIssue[];
      readonly nextState: ProjectState<TDerived>;
    };

export async function importProject<TDerived>(
  currentState: ProjectState<TDerived>,
  source: ProjectJsonSource,
  derive: ProjectDeriver<TDerived>,
): Promise<ProjectImportResult<TDerived>> {
  const readResult = await readProjectJson(source);
  if (!readResult.ok) {
    return {
      ok: false,
      stage: readResult.stage,
      issues: readResult.issues,
      nextState: currentState,
    };
  }

  let derived: TDerived;
  try {
    derived = await derive(readResult.project);
  } catch {
    return {
      ok: false,
      stage: "derive",
      issues: [{ code: "derive.failed", path: "/" }],
      nextState: currentState,
    };
  }

  return {
    ok: true,
    nextState: { project: readResult.project, derived },
  };
}
