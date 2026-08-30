import type {
  AutomaticProposalResult,
  AutomaticProposalUnverifiedReason,
} from "../domain/automatic-proposal";
import type { Placement, Project } from "../domain/model";
import {
  validatePlacementSet,
  validateProjectReferences,
} from "../domain/validation";
import { validateProjectJsonSchema } from "../persistence/project-json-schema";

export type AutomaticProposalApplyFailureCode =
  | "automatic-proposal.apply-stale"
  | "automatic-proposal.apply-not-complete"
  | "automatic-proposal.apply-plan-invalid"
  | "automatic-proposal.apply-schema-invalid"
  | "automatic-proposal.apply-semantic-invalid"
  | "automatic-proposal.apply-validation-unavailable"
  | "automatic-proposal.apply-physical-invalid"
  | "automatic-proposal.apply-unverified-mismatch";

export interface AutomaticProposalApplySummary {
  readonly containerId: string;
  readonly placementCount: number;
  readonly replacedPlacementCount: number;
  readonly unverifiedReasonCount: number;
}

export type PreparedAutomaticProposalApply =
  | {
      readonly ok: true;
      readonly changed: boolean;
      readonly project: Project;
      readonly summary: AutomaticProposalApplySummary;
      readonly unverifiedReasons: readonly AutomaticProposalUnverifiedReason[];
    }
  | {
      readonly ok: false;
      readonly code: AutomaticProposalApplyFailureCode;
      readonly project: Project;
    };

function failure(
  project: Project,
  code: AutomaticProposalApplyFailureCode,
): PreparedAutomaticProposalApply {
  return { ok: false, code, project };
}

function clonePlacement(placement: Placement): Placement {
  return {
    cargoId: placement.cargoId,
    containerId: placement.containerId,
    orientation: placement.orientation,
    positionMm: {
      xMm: placement.positionMm.xMm,
      yMm: placement.positionMm.yMm,
      zMm: placement.positionMm.zMm,
    },
  };
}

function samePlacement(first: Placement, second: Placement): boolean {
  return (
    first.cargoId === second.cargoId &&
    first.containerId === second.containerId &&
    first.orientation === second.orientation &&
    first.positionMm.xMm === second.positionMm.xMm &&
    first.positionMm.yMm === second.positionMm.yMm &&
    first.positionMm.zMm === second.positionMm.zMm
  );
}

function samePlacementSet(
  first: readonly Placement[],
  second: readonly Placement[],
): boolean {
  if (first.length !== second.length) {
    return false;
  }
  const firstCargoIds = new Set(first.map(({ cargoId }) => cargoId));
  const secondByCargoId = new Map(
    second.map((placement) => [placement.cargoId, placement]),
  );
  return (
    firstCargoIds.size === first.length &&
    secondByCargoId.size === second.length &&
    first.every((placement) => {
      const counterpart = secondByCargoId.get(placement.cargoId);
      return counterpart !== undefined && samePlacement(placement, counterpart);
    })
  );
}

function sameUnverifiedReason(
  first: AutomaticProposalUnverifiedReason,
  second: AutomaticProposalUnverifiedReason,
): boolean {
  return (
    first.status === second.status &&
    first.code === second.code &&
    first.target.kind === second.target.kind &&
    first.target.id === second.target.id &&
    first.relatedCargoIds.length === second.relatedCargoIds.length &&
    first.relatedCargoIds.every(
      (cargoId, index) => cargoId === second.relatedCargoIds[index],
    )
  );
}

function sameUnverifiedReasons(
  first: readonly AutomaticProposalUnverifiedReason[],
  second: readonly AutomaticProposalUnverifiedReason[],
): boolean {
  return (
    first.length === second.length &&
    first.every((reason, index) => {
      const counterpart = second[index];
      return counterpart !== undefined && sameUnverifiedReason(reason, counterpart);
    })
  );
}

export function prepareAutomaticProposalApply(
  currentProject: Project,
  sourceProject: Project,
  result: AutomaticProposalResult,
): PreparedAutomaticProposalApply {
  if (currentProject !== sourceProject) {
    return failure(currentProject, "automatic-proposal.apply-stale");
  }
  if (result.status !== "complete" && result.status !== "complete-with-cutoff") {
    return failure(currentProject, "automatic-proposal.apply-not-complete");
  }

  const plan = result.plan;
  const cargoIds = new Set(sourceProject.cargoes.map(({ id }) => id));
  const placementCargoIds = new Set(plan.placements.map(({ cargoId }) => cargoId));
  const containerExists = sourceProject.containers.some(
    ({ id }) => id === plan.containerId,
  );
  if (
    plan.invalidReasonCount !== 0 ||
    plan.placements.length === 0 ||
    plan.placements.length !== sourceProject.cargoes.length ||
    placementCargoIds.size !== plan.placements.length ||
    placementCargoIds.size !== cargoIds.size ||
    !containerExists ||
    sourceProject.cargoes.some(({ id }) => !placementCargoIds.has(id)) ||
    plan.placements.some(
      ({ cargoId, containerId }) =>
        !cargoIds.has(cargoId) || containerId !== plan.containerId,
    )
  ) {
    return failure(currentProject, "automatic-proposal.apply-plan-invalid");
  }

  const placements = plan.placements.map(clonePlacement);
  const candidate: Project = { ...sourceProject, placements };
  const schema = validateProjectJsonSchema(candidate);
  if (!schema.valid) {
    return failure(currentProject, "automatic-proposal.apply-schema-invalid");
  }
  if (validateProjectReferences(schema.project).length > 0) {
    return failure(currentProject, "automatic-proposal.apply-semantic-invalid");
  }

  const validation = validatePlacementSet(schema.project, plan.containerId);
  if (validation.kind !== "evaluated") {
    return failure(
      currentProject,
      "automatic-proposal.apply-validation-unavailable",
    );
  }
  if (
    validation.status === "invalid" ||
    validation.reasons.some(
      ({ code, status }) =>
        status === "invalid" || code === "support-conditions-unverified",
    )
  ) {
    return failure(currentProject, "automatic-proposal.apply-physical-invalid");
  }
  const unverifiedReasons = validation.reasons.filter(
    (reason): reason is AutomaticProposalUnverifiedReason =>
      reason.status === "unverified",
  );
  if (!sameUnverifiedReasons(unverifiedReasons, plan.unverifiedReasons)) {
    return failure(
      currentProject,
      "automatic-proposal.apply-unverified-mismatch",
    );
  }

  const summary: AutomaticProposalApplySummary = {
    containerId: plan.containerId,
    placementCount: placements.length,
    replacedPlacementCount: currentProject.placements.length,
    unverifiedReasonCount: unverifiedReasons.length,
  };
  if (samePlacementSet(currentProject.placements, placements)) {
    return {
      ok: true,
      changed: false,
      project: currentProject,
      summary,
      unverifiedReasons,
    };
  }
  return {
    ok: true,
    changed: true,
    project: schema.project,
    summary,
    unverifiedReasons,
  };
}
