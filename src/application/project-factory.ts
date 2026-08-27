import {
  PROJECT_SCHEMA_VERSION,
  type Project,
} from "../domain/model";

export const INITIAL_PROJECT_ID = "project-1";

export function createInitialProject(): Project {
  return {
    schemaVersion: PROJECT_SCHEMA_VERSION,
    projectId: INITIAL_PROJECT_ID,
    name: "新規案件",
    clearancesMm: { xMm: 0, yMm: 0, zMm: 0 },
    cargoes: [],
    containers: [],
    placements: [],
  };
}

export function nextAvailableEntityId(
  prefix: "cargo" | "container",
  existingIds: readonly string[],
): string {
  const used = new Set(existingIds);
  let sequence = 1;
  while (used.has(`${prefix}-${sequence}`)) {
    sequence += 1;
  }
  return `${prefix}-${sequence}`;
}

export function nextCargoId(project: Project): string {
  return nextAvailableEntityId(
    "cargo",
    project.cargoes.map((cargo) => cargo.id),
  );
}

export function nextContainerId(project: Project): string {
  return nextAvailableEntityId(
    "container",
    project.containers.map((container) => container.id),
  );
}
