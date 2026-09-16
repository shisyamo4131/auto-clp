import type { Cargo, Project } from "../domain/model";
import type { ValidationIssue } from "../domain/validation";
import { validateProjectReferences } from "../domain/validation";
import {
  readCargoCsv,
  type CargoCsvByteSource,
} from "../persistence/cargo-csv-file";
import { validateProjectJsonSchema } from "../persistence/project-json-schema";

export interface CargoCsvReplacementSummary {
  readonly newCargoCount: number;
  readonly removedCargoCount: number;
  readonly clearedPlacementCount: number;
}

export type CargoCsvReplacementResult =
  | {
      readonly ok: true;
      readonly changed: boolean;
      readonly project: Project;
      readonly summary: CargoCsvReplacementSummary;
    }
  | {
      readonly ok: false;
      readonly project: Project;
      readonly issues: readonly ValidationIssue[];
    };

function sameCargo(first: Cargo, second: Cargo): boolean {
  return (
    first.id === second.id &&
    first.name === second.name &&
    first.dimensionsMm.lengthMm === second.dimensionsMm.lengthMm &&
    first.dimensionsMm.widthMm === second.dimensionsMm.widthMm &&
    first.dimensionsMm.heightMm === second.dimensionsMm.heightMm &&
    first.massGrams === second.massGrams &&
    first.canSupportCargo === second.canSupportCargo &&
    first.allowedOrientations.length === second.allowedOrientations.length &&
    first.allowedOrientations.every(
      (orientation, index) => second.allowedOrientations[index] === orientation,
    )
  );
}

export function prepareCargoCsvReplacement(
  current: Project,
  cargoes: readonly Cargo[],
): CargoCsvReplacementResult {
  const summary: CargoCsvReplacementSummary = {
    newCargoCount: cargoes.length,
    removedCargoCount: current.cargoes.length,
    clearedPlacementCount: current.placements.length,
  };
  const unchanged =
    current.placements.length === 0 &&
    current.cargoes.length === cargoes.length &&
    current.cargoes.every((cargo, index) =>
      cargoes[index] === undefined ? false : sameCargo(cargo, cargoes[index]),
    );
  if (unchanged) {
    const schema = validateProjectJsonSchema(current);
    if (
      !schema.valid ||
      validateProjectReferences(schema.project).length > 0
    ) {
      return {
        ok: false,
        project: current,
        issues: [{ code: "cargo-csv.candidate-invalid", path: "/" }],
      };
    }
    return { ok: true, changed: false, project: current, summary };
  }

  const candidate: Project = {
    ...current,
    cargoes: cargoes.map((cargo) => ({
      ...cargo,
      dimensionsMm: { ...cargo.dimensionsMm },
      allowedOrientations: [...cargo.allowedOrientations],
    })),
    placements: [],
  };
  const schema = validateProjectJsonSchema(candidate);
  if (!schema.valid || validateProjectReferences(schema.project).length > 0) {
    return {
      ok: false,
      project: current,
      issues: [{ code: "cargo-csv.candidate-invalid", path: "/" }],
    };
  }
  return { ok: true, changed: true, project: schema.project, summary };
}

export async function prepareCargoCsvImport(
  current: Project,
  source: CargoCsvByteSource,
): Promise<CargoCsvReplacementResult> {
  const parsed = await readCargoCsv(source);
  if (!parsed.ok) {
    return { ok: false, project: current, issues: parsed.issues };
  }
  return prepareCargoCsvReplacement(current, parsed.cargoes);
}
