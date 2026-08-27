import type {
  Cargo,
  Container,
  Orientation,
  Placement,
  Project,
} from "../domain/model";
import type { ValidationIssue } from "../domain/validation";
import { validateProjectReferences } from "../domain/validation";
import { validateProjectJsonSchema } from "../persistence/project-json-schema";
import { nextCargoId, nextContainerId } from "./project-factory";

const DIMENSION_MIN = 1n;
const DIMENSION_MAX = 100_000n;
const CLEARANCE_MIN = 0n;
const CLEARANCE_MAX = 10_000n;
const MASS_MIN_GRAMS = 1n;
const MASS_MAX_GRAMS = 100_000_000n;
const POSITION_MIN_MM = -1_000_000n;
const POSITION_MAX_MM = 1_000_000n;
const CARGO_LIMIT = 1_000;
const CONTAINER_LIMIT = 100;
const MAX_KILOGRAM_INPUT_LENGTH = 10;
const MAX_POSITION_DIGITS = POSITION_MAX_MM.toString().length;
const MAX_POSITION_INPUT_LENGTH = POSITION_MAX_MM.toString().length + 1;

export interface ProjectSettingsDraft {
  readonly name: string;
  readonly clearanceXmm: string;
  readonly clearanceYmm: string;
  readonly clearanceZmm: string;
}

export interface CargoDraft {
  readonly name: string;
  readonly lengthMm: string;
  readonly widthMm: string;
  readonly heightMm: string;
  readonly massKg: string;
  readonly canSupportCargo: boolean;
  readonly allowedOrientations: readonly Orientation[];
}

export interface ContainerDraft {
  readonly name: string;
  readonly internalLengthMm: string;
  readonly internalWidthMm: string;
  readonly internalHeightMm: string;
  readonly openingWidthMm: string;
  readonly openingHeightMm: string;
  readonly payloadCapacityKg: string;
}

export interface PlacementDraft {
  readonly xMm: string;
  readonly yMm: string;
  readonly zMm: string;
  readonly orientation: Orientation;
}

export type ParsedIntegerResult =
  | { readonly ok: true; readonly value: number }
  | { readonly ok: false; readonly issue: ValidationIssue };

export type ProjectCommandResult =
  | { readonly ok: true; readonly project: Project }
  | { readonly ok: false; readonly project: Project; readonly issues: readonly ValidationIssue[] };

type ProjectCommandFailure = Extract<ProjectCommandResult, { readonly ok: false }>;

function parseIntegerRange(
  raw: string,
  path: string,
  minimum: bigint,
  maximum: bigint,
): ParsedIntegerResult {
  const value = raw.trim();
  if (value.length > maximum.toString().length) {
    return { ok: false, issue: { code: "input.mm-length", path } };
  }
  if (!/^[0-9]+$/.test(value)) {
    return { ok: false, issue: { code: "input.mm-format", path } };
  }

  const parsed = BigInt(value);
  if (parsed < minimum || parsed > maximum) {
    return { ok: false, issue: { code: "input.mm-range", path } };
  }
  return { ok: true, value: Number(parsed) };
}

export function parseDimensionMm(raw: string, path = "/dimensionMm"): ParsedIntegerResult {
  return parseIntegerRange(raw, path, DIMENSION_MIN, DIMENSION_MAX);
}

export function parseClearanceMm(raw: string, path = "/clearanceMm"): ParsedIntegerResult {
  return parseIntegerRange(raw, path, CLEARANCE_MIN, CLEARANCE_MAX);
}

export function parsePositionMm(
  raw: string,
  path = "/positionMm",
): ParsedIntegerResult {
  if (raw.length > MAX_POSITION_INPUT_LENGTH) {
    return { ok: false, issue: { code: "input.mm-length", path } };
  }
  if (!/^-?[0-9]+$/.test(raw)) {
    return { ok: false, issue: { code: "input.mm-format", path } };
  }
  const digitLength = raw.startsWith("-") ? raw.length - 1 : raw.length;
  if (digitLength > MAX_POSITION_DIGITS) {
    return { ok: false, issue: { code: "input.mm-length", path } };
  }

  const parsed = BigInt(raw);
  if (parsed < POSITION_MIN_MM || parsed > POSITION_MAX_MM) {
    return { ok: false, issue: { code: "input.mm-range", path } };
  }
  return { ok: true, value: Number(parsed) };
}

export function parseKilogramsToGrams(
  raw: string,
  path = "/massKg",
): ParsedIntegerResult {
  const value = raw.trim();
  if (value.length > MAX_KILOGRAM_INPUT_LENGTH) {
    return { ok: false, issue: { code: "input.kg-length", path } };
  }
  const match = /^(?<whole>[0-9]+)(?:\.(?<fraction>[0-9]{1,3}))?$/.exec(value);
  if (match?.groups === undefined) {
    return { ok: false, issue: { code: "input.kg-format", path } };
  }

  const whole = match.groups.whole;
  if (whole === undefined) {
    return { ok: false, issue: { code: "input.kg-format", path } };
  }
  const fraction = (match.groups.fraction ?? "").padEnd(3, "0");
  const grams = BigInt(whole) * 1_000n + BigInt(fraction || "0");
  if (grams < MASS_MIN_GRAMS || grams > MASS_MAX_GRAMS) {
    return { ok: false, issue: { code: "input.kg-range", path } };
  }
  return { ok: true, value: Number(grams) };
}

function failure(
  current: Project,
  ...issues: readonly ValidationIssue[]
): ProjectCommandFailure {
  return { ok: false, project: current, issues };
}

function validateCandidate(current: Project, candidate: Project): ProjectCommandResult {
  const schema = validateProjectJsonSchema(candidate);
  if (!schema.valid) {
    return { ok: false, project: current, issues: schema.issues };
  }
  const semanticIssues = validateProjectReferences(schema.project);
  if (semanticIssues.length > 0) {
    return { ok: false, project: current, issues: semanticIssues };
  }
  return { ok: true, project: schema.project };
}

function parsedValues(
  current: Project,
  results: readonly ParsedIntegerResult[],
): { readonly ok: true; readonly values: readonly number[] } | ProjectCommandFailure {
  const issues = results.flatMap((result) => (result.ok ? [] : [result.issue]));
  if (issues.length > 0) {
    return failure(current, ...issues);
  }
  return { ok: true, values: results.map((result) => (result.ok ? result.value : 0)) };
}

function parsePlacementDraft(
  current: Project,
  draft: PlacementDraft,
  placementIndex: number,
):
  | {
      readonly ok: true;
      readonly placementData: Pick<Placement, "orientation" | "positionMm">;
    }
  | ProjectCommandFailure {
  const parsed = parsedValues(current, [
    parsePositionMm(draft.xMm, `/placements/${placementIndex}/positionMm/xMm`),
    parsePositionMm(draft.yMm, `/placements/${placementIndex}/positionMm/yMm`),
    parsePositionMm(draft.zMm, `/placements/${placementIndex}/positionMm/zMm`),
  ]);
  if (!parsed.ok) {
    return parsed;
  }
  const [xMm = 0, yMm = 0, zMm = 0] = parsed.values;
  return {
    ok: true,
    placementData: {
      positionMm: { xMm, yMm, zMm },
      orientation: draft.orientation,
    },
  };
}

export function updateProjectSettings(
  current: Project,
  draft: ProjectSettingsDraft,
): ProjectCommandResult {
  const parsed = parsedValues(current, [
    parseClearanceMm(draft.clearanceXmm, "/clearancesMm/xMm"),
    parseClearanceMm(draft.clearanceYmm, "/clearancesMm/yMm"),
    parseClearanceMm(draft.clearanceZmm, "/clearancesMm/zMm"),
  ]);
  if (!parsed.ok) {
    return parsed;
  }
  const [xMm = 0, yMm = 0, zMm = 0] = parsed.values;
  return validateCandidate(current, {
    ...current,
    name: draft.name.trim(),
    clearancesMm: { xMm, yMm, zMm },
  });
}

export function saveCargo(
  current: Project,
  draft: CargoDraft,
  cargoId?: string,
): ProjectCommandResult {
  const existingIndex = cargoId === undefined ? -1 : current.cargoes.findIndex((cargo) => cargo.id === cargoId);
  if (cargoId !== undefined && existingIndex < 0) {
    return failure(current, { code: "command.cargo-not-found", path: "/cargoes" });
  }
  if (cargoId === undefined && current.cargoes.length >= CARGO_LIMIT) {
    return failure(current, { code: "command.cargo-limit", path: "/cargoes" });
  }
  if (draft.allowedOrientations.length === 0) {
    return failure(current, {
      code: "input.orientation-required",
      path: "/cargoes/allowedOrientations",
    });
  }

  const parsed = parsedValues(current, [
    parseDimensionMm(draft.lengthMm, "/cargoes/dimensionsMm/lengthMm"),
    parseDimensionMm(draft.widthMm, "/cargoes/dimensionsMm/widthMm"),
    parseDimensionMm(draft.heightMm, "/cargoes/dimensionsMm/heightMm"),
    parseKilogramsToGrams(draft.massKg, "/cargoes/massGrams"),
  ]);
  if (!parsed.ok) {
    return parsed;
  }
  const [lengthMm = 0, widthMm = 0, heightMm = 0, massGrams = 0] = parsed.values;
  const id = cargoId ?? nextCargoId(current);
  const cargo: Cargo = {
    id,
    name: draft.name.trim(),
    dimensionsMm: { lengthMm, widthMm, heightMm },
    massGrams,
    canSupportCargo: draft.canSupportCargo,
    allowedOrientations: [...draft.allowedOrientations],
  };
  const cargoes =
    existingIndex < 0
      ? [...current.cargoes, cargo]
      : current.cargoes.map((existing, index) => (index === existingIndex ? cargo : existing));
  return validateCandidate(current, { ...current, cargoes });
}

export function saveContainer(
  current: Project,
  draft: ContainerDraft,
  containerId?: string,
): ProjectCommandResult {
  const existingIndex =
    containerId === undefined
      ? -1
      : current.containers.findIndex((container) => container.id === containerId);
  if (containerId !== undefined && existingIndex < 0) {
    return failure(current, { code: "command.container-not-found", path: "/containers" });
  }
  if (containerId === undefined && current.containers.length >= CONTAINER_LIMIT) {
    return failure(current, { code: "command.container-limit", path: "/containers" });
  }

  const parsed = parsedValues(current, [
    parseDimensionMm(draft.internalLengthMm, "/containers/internalDimensionsMm/lengthMm"),
    parseDimensionMm(draft.internalWidthMm, "/containers/internalDimensionsMm/widthMm"),
    parseDimensionMm(draft.internalHeightMm, "/containers/internalDimensionsMm/heightMm"),
    parseDimensionMm(draft.openingWidthMm, "/containers/openingMm/widthMm"),
    parseDimensionMm(draft.openingHeightMm, "/containers/openingMm/heightMm"),
    parseKilogramsToGrams(draft.payloadCapacityKg, "/containers/payloadCapacityGrams"),
  ]);
  if (!parsed.ok) {
    return parsed;
  }
  const [
    lengthMm = 0,
    widthMm = 0,
    heightMm = 0,
    openingWidthMm = 0,
    openingHeightMm = 0,
    payloadCapacityGrams = 0,
  ] = parsed.values;
  const id = containerId ?? nextContainerId(current);
  const container: Container = {
    id,
    name: draft.name.trim(),
    internalDimensionsMm: { lengthMm, widthMm, heightMm },
    openingMm: { widthMm: openingWidthMm, heightMm: openingHeightMm },
    payloadCapacityGrams,
  };
  const containers =
    existingIndex < 0
      ? [...current.containers, container]
      : current.containers.map((existing, index) =>
          index === existingIndex ? container : existing,
        );
  return validateCandidate(current, { ...current, containers });
}

export function addPlacement(
  current: Project,
  cargoId: string,
  containerId: string,
  draft?: PlacementDraft,
): ProjectCommandResult {
  const cargo = current.cargoes.find((candidate) => candidate.id === cargoId);
  if (cargo === undefined) {
    return failure(current, { code: "command.cargo-not-found", path: "/cargoes" });
  }
  if (!current.containers.some((candidate) => candidate.id === containerId)) {
    return failure(current, {
      code: "command.container-not-found",
      path: "/containers",
    });
  }
  if (current.placements.some((placement) => placement.cargoId === cargoId)) {
    return failure(current, {
      code: "command.cargo-already-placed",
      path: "/placements",
    });
  }

  const orientation = cargo.allowedOrientations[0];
  if (orientation === undefined) {
    return failure(current, {
      code: "input.orientation-required",
      path: "/cargoes/allowedOrientations",
    });
  }
  const parsed = parsePlacementDraft(
    current,
    draft ?? { xMm: "0", yMm: "0", zMm: "0", orientation },
    current.placements.length,
  );
  if (!parsed.ok) {
    return parsed;
  }
  const placement: Placement = {
    cargoId,
    containerId,
    ...parsed.placementData,
  };
  return validateCandidate(current, {
    ...current,
    placements: [...current.placements, placement],
  });
}

export function updatePlacement(
  current: Project,
  cargoId: string,
  expectedContainerId: string,
  draft: PlacementDraft,
): ProjectCommandResult {
  const placementIndex = current.placements.findIndex(
    (placement) =>
      placement.cargoId === cargoId &&
      placement.containerId === expectedContainerId,
  );
  const referencesExist =
    current.cargoes.some((cargo) => cargo.id === cargoId) &&
    current.containers.some((container) => container.id === expectedContainerId);
  if (placementIndex < 0 || !referencesExist) {
    return failure(current, {
      code: "command.placement-not-found",
      path: "/placements",
    });
  }

  const parsed = parsePlacementDraft(current, draft, placementIndex);
  if (!parsed.ok) {
    return parsed;
  }
  const placements = current.placements.map((placement, index) =>
    index === placementIndex
      ? {
          ...placement,
          ...parsed.placementData,
        }
      : placement,
  );
  return validateCandidate(current, { ...current, placements });
}

export function deletePlacement(
  current: Project,
  cargoId: string,
  expectedContainerId: string,
): ProjectCommandResult {
  const placementIndex = current.placements.findIndex(
    (placement) =>
      placement.cargoId === cargoId &&
      placement.containerId === expectedContainerId,
  );
  if (placementIndex < 0) {
    return failure(current, {
      code: "command.placement-not-found",
      path: "/placements",
    });
  }
  return validateCandidate(current, {
    ...current,
    placements: current.placements.filter((_, index) => index !== placementIndex),
  });
}

export function deleteCargo(current: Project, cargoId: string): ProjectCommandResult {
  const index = current.cargoes.findIndex((cargo) => cargo.id === cargoId);
  if (index < 0) {
    return failure(current, { code: "command.cargo-not-found", path: "/cargoes" });
  }
  if (current.placements.some((placement) => placement.cargoId === cargoId)) {
    return failure(current, { code: "command.cargo-referenced", path: `/cargoes/${index}/id` });
  }
  return validateCandidate(current, {
    ...current,
    cargoes: current.cargoes.filter((cargo) => cargo.id !== cargoId),
  });
}

export function deleteContainer(current: Project, containerId: string): ProjectCommandResult {
  const index = current.containers.findIndex((container) => container.id === containerId);
  if (index < 0) {
    return failure(current, { code: "command.container-not-found", path: "/containers" });
  }
  if (current.placements.some((placement) => placement.containerId === containerId)) {
    return failure(current, {
      code: "command.container-referenced",
      path: `/containers/${index}/id`,
    });
  }
  return validateCandidate(current, {
    ...current,
    containers: current.containers.filter((container) => container.id !== containerId),
  });
}
