import { orientedDimensions } from "../domain/geometry";
import {
  proposeLoadingSequence,
  type LoadingSequencePrecedenceReason,
  type LoadingSequenceUnavailableReason,
} from "../domain/loading-sequence";
import type { OrientedDimensionsMm, Project } from "../domain/model";
import {
  validatePlacementSet,
  type PlacementSetValidationResult,
} from "../domain/validation";

export interface LoadingReportDependencySnapshot {
  readonly cargoId: string;
  readonly reasons: readonly LoadingSequencePrecedenceReason[];
}

export interface LoadingReportCargoSnapshot {
  readonly cargoId: string;
  readonly dependencies: readonly LoadingReportDependencySnapshot[];
  readonly massGrams: number;
  readonly name: string;
  readonly orientedDimensionsMm: OrientedDimensionsMm;
  readonly sequenceNumber: number;
}

export interface LoadingReportWarningSnapshot {
  readonly relatedCargoIds: readonly string[];
  readonly targetCargoId: string;
}

interface LoadingReportSnapshotBase {
  readonly containerId: string;
  readonly containerName?: string;
  readonly physicalValidation: PlacementSetValidationResult;
  readonly projectName: string;
}

export type LoadingReportSnapshot =
  | (LoadingReportSnapshotBase & { readonly status: "empty" })
  | (LoadingReportSnapshotBase & {
      readonly reason: LoadingSequenceUnavailableReason;
      readonly status: "unavailable";
    })
  | (LoadingReportSnapshotBase & {
      readonly cargoes: readonly LoadingReportCargoSnapshot[];
      readonly status: "available";
      readonly warnings: readonly LoadingReportWarningSnapshot[];
    });

/**
 * Captures the deterministic, report-facing values derived from the current
 * Project. The snapshot does not mutate or become part of Project/history.
 */
export function createLoadingReportSnapshot(
  project: Project,
  containerId: string,
): LoadingReportSnapshot {
  const container = project.containers.find(
    (candidate) => candidate.id === containerId,
  );
  const base: LoadingReportSnapshotBase = {
    containerId,
    containerName: container?.name,
    physicalValidation: validatePlacementSet(project, containerId),
    projectName: project.name,
  };
  const sequence = proposeLoadingSequence(project, containerId);

  if (sequence.status === "empty") {
    return { ...base, status: "empty" };
  }
  if (sequence.status === "unavailable") {
    return { ...base, reason: sequence.reason, status: "unavailable" };
  }

  const cargoesById = new Map(project.cargoes.map((cargo) => [cargo.id, cargo]));
  const placementsByCargoId = new Map(
    project.placements
      .filter((placement) => placement.containerId === containerId)
      .map((placement) => [placement.cargoId, placement]),
  );
  const dependenciesByCargoId = new Map<
    string,
    LoadingReportDependencySnapshot[]
  >();
  for (const precedence of sequence.precedences) {
    const dependencies = dependenciesByCargoId.get(precedence.afterCargoId) ?? [];
    dependencies.push({
      cargoId: precedence.beforeCargoId,
      reasons: [...precedence.reasons],
    });
    dependenciesByCargoId.set(precedence.afterCargoId, dependencies);
  }

  const cargoes = sequence.sequence.map<LoadingReportCargoSnapshot>((step) => {
    const cargo = cargoesById.get(step.cargoId)!;
    const placement = placementsByCargoId.get(step.cargoId)!;
    return {
      cargoId: step.cargoId,
      dependencies: [...(dependenciesByCargoId.get(step.cargoId) ?? [])]
        .sort((first, second) =>
          first.cargoId < second.cargoId
            ? -1
            : first.cargoId > second.cargoId
              ? 1
              : 0,
        )
        .map((dependency) => ({
          cargoId: dependency.cargoId,
          reasons: [...dependency.reasons],
        })),
      massGrams: cargo.massGrams,
      name: cargo.name,
      orientedDimensionsMm: orientedDimensions(cargo, placement.orientation),
      sequenceNumber: step.sequenceNumber,
    };
  });

  return {
    ...base,
    cargoes,
    status: "available",
    warnings: sequence.warnings.map((warning) => ({
      relatedCargoIds: [...warning.relatedCargoIds],
      targetCargoId: warning.targetCargoId,
    })),
  };
}
