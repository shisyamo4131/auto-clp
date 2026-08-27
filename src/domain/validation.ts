import type { Project } from "./model";

export interface ValidationIssue {
  readonly code: string;
  readonly path: string;
}

export type SafeIntegerSumResult =
  | { readonly valid: true; readonly sum: number }
  | { readonly valid: false };

export function safeIntegerSum(values: readonly number[]): SafeIntegerSumResult {
  let sum = 0;

  for (const value of values) {
    if (!Number.isSafeInteger(value)) {
      return { valid: false };
    }
    const next = sum + value;
    if (!Number.isSafeInteger(next)) {
      return { valid: false };
    }
    sum = next;
  }

  return { valid: true, sum };
}

export function validateProjectReferences(project: Project): readonly ValidationIssue[] {
  const issues: ValidationIssue[] = [];
  const cargoesById = new Map<string, Project["cargoes"][number]>();
  const containersById = new Map<string, Project["containers"][number]>();
  const duplicateCargoIds = new Set<string>();
  const duplicateContainerIds = new Set<string>();

  project.cargoes.forEach((cargo, index) => {
    if (cargoesById.has(cargo.id)) {
      issues.push({ code: "semantic.duplicate-cargo-id", path: `/cargoes/${index}/id` });
      duplicateCargoIds.add(cargo.id);
      return;
    }
    cargoesById.set(cargo.id, cargo);
  });

  project.containers.forEach((container, index) => {
    if (containersById.has(container.id)) {
      issues.push({ code: "semantic.duplicate-container-id", path: `/containers/${index}/id` });
      duplicateContainerIds.add(container.id);
    } else {
      containersById.set(container.id, container);
    }

    if (container.openingMm.widthMm > container.internalDimensionsMm.widthMm) {
      issues.push({
        code: "semantic.opening-width-exceeds-internal",
        path: `/containers/${index}/openingMm/widthMm`,
      });
    }
    if (container.openingMm.heightMm > container.internalDimensionsMm.heightMm) {
      issues.push({
        code: "semantic.opening-height-exceeds-internal",
        path: `/containers/${index}/openingMm/heightMm`,
      });
    }
  });

  const placedCargoIds = new Set<string>();
  project.placements.forEach((placement, index) => {
    const cargo = cargoesById.get(placement.cargoId);
    const cargoIsAmbiguous = duplicateCargoIds.has(placement.cargoId);
    if (cargo === undefined && !cargoIsAmbiguous) {
      issues.push({
        code: "semantic.unknown-cargo-reference",
        path: `/placements/${index}/cargoId`,
      });
    } else if (
      cargo !== undefined &&
      !cargoIsAmbiguous &&
      !cargo.allowedOrientations.includes(placement.orientation)
    ) {
      issues.push({
        code: "semantic.disallowed-orientation",
        path: `/placements/${index}/orientation`,
      });
    }

    if (
      !containersById.has(placement.containerId) &&
      !duplicateContainerIds.has(placement.containerId)
    ) {
      issues.push({
        code: "semantic.unknown-container-reference",
        path: `/placements/${index}/containerId`,
      });
    }

    if (cargo !== undefined && !cargoIsAmbiguous) {
      if (placedCargoIds.has(placement.cargoId)) {
        issues.push({
          code: "semantic.duplicate-cargo-placement",
          path: `/placements/${index}/cargoId`,
        });
      } else {
        placedCargoIds.add(placement.cargoId);
      }
    }
  });

  if (!safeIntegerSum(project.cargoes.map((cargo) => cargo.massGrams)).valid) {
    issues.push({ code: "semantic.mass-sum-unsafe", path: "/cargoes" });
  }

  return issues;
}
