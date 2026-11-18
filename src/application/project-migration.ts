import type { Project } from "../domain/model";

/** Input must have passed its original schema and semantic validation. */
export function migrateProject(project: Project): Project {
  if (project.schemaVersion === "0.3.0") return project;
  const cargoes = project.cargoes.map((cargo, index) => ({
    ...cargo, cargoNo: project.schemaVersion === "0.1.0" ? index + 1 : cargo.cargoNo!,
  }));
  return {
    schemaVersion: "0.3.0", projectId: project.projectId, name: project.name,
    cargoes, containers: project.containers, placements: project.placements,
    nextCargoNo: project.schemaVersion === "0.1.0" ? cargoes.length + 1 : project.nextCargoNo!,
  };
}
