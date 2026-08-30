import {
  ORIENTATIONS,
  type Cargo,
  type Orientation,
  type Project,
} from "./model";

export const UPRIGHT_ORIENTATIONS = ["LWH", "WLH"] as const satisfies readonly Orientation[];

export function isUprightOnlyOrientationPolicy(
  allowedOrientations: readonly Orientation[],
): boolean {
  return allowedOrientations.length > 0 && allowedOrientations.every(
    (orientation) => UPRIGHT_ORIENTATIONS.includes(
      orientation as (typeof UPRIGHT_ORIENTATIONS)[number],
    ),
  );
}

export function orientationsForUprightPolicy(
  uprightOnly: boolean,
): readonly Orientation[] {
  return uprightOnly ? [...UPRIGHT_ORIENTATIONS] : [...ORIENTATIONS];
}

export function normalizeCargoOrientationPolicy(cargo: Cargo): Cargo {
  return {
    ...cargo,
    allowedOrientations: orientationsForUprightPolicy(
      isUprightOnlyOrientationPolicy(cargo.allowedOrientations),
    ),
  };
}

export function normalizeProjectOrientationPolicies(project: Project): Project {
  return {
    ...project,
    cargoes: project.cargoes.map(normalizeCargoOrientationPolicy),
  };
}
