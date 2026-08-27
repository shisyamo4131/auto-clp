import {
  PROJECT_SCHEMA_VERSION,
  type Cargo,
  type Container,
  type Placement,
  type Project,
} from "../domain/model";
import { validateProjectReferences, type ValidationIssue } from "../domain/validation";
import { validateProjectJsonSchema } from "./project-json-schema";

export const MAX_PROJECT_FILE_BYTES = 5_242_880;
const textEncoder = new TextEncoder();

export type ProjectJsonFailureStage =
  | "size"
  | "read"
  | "syntax"
  | "version"
  | "schema"
  | "semantic";

export interface ProjectJsonSource {
  readonly sizeBytes: number;
  readonly readText: () => Promise<string>;
}

export type ProjectJsonResult =
  | { readonly ok: true; readonly project: Project }
  | {
      readonly ok: false;
      readonly stage: ProjectJsonFailureStage;
      readonly issues: readonly ValidationIssue[];
    };

export type ProjectJsonSerializationResult =
  | { readonly ok: true; readonly json: string }
  | {
      readonly ok: false;
      readonly stage: "serialize" | "version" | "schema" | "semantic";
      readonly issues: readonly ValidationIssue[];
    };

function failure(
  stage: ProjectJsonFailureStage,
  code: string,
  path = "/",
): ProjectJsonResult {
  return { ok: false, stage, issues: [{ code, path }] };
}

function isRecord(value: unknown): value is Readonly<Record<string, unknown>> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

export async function readProjectJson(source: ProjectJsonSource): Promise<ProjectJsonResult> {
  if (!Number.isSafeInteger(source.sizeBytes) || source.sizeBytes < 0) {
    return failure("size", "size.invalid");
  }
  if (source.sizeBytes > MAX_PROJECT_FILE_BYTES) {
    return failure("size", "size.exceeded");
  }

  let text: string;
  try {
    text = await source.readText();
  } catch {
    return failure("read", "read.failed");
  }
  if (textEncoder.encode(text).byteLength > MAX_PROJECT_FILE_BYTES) {
    return failure("size", "size.exceeded");
  }

  let value: unknown;
  try {
    value = JSON.parse(text) as unknown;
  } catch {
    return failure("syntax", "syntax.invalid");
  }

  if (!isRecord(value) || value.schemaVersion !== PROJECT_SCHEMA_VERSION) {
    return failure("version", "version.unsupported", "/schemaVersion");
  }

  const schemaResult = validateProjectJsonSchema(value);
  if (!schemaResult.valid) {
    return { ok: false, stage: "schema", issues: schemaResult.issues };
  }

  const semanticIssues = validateProjectReferences(schemaResult.project);
  if (semanticIssues.length > 0) {
    return { ok: false, stage: "semantic", issues: semanticIssues };
  }

  return { ok: true, project: schemaResult.project };
}

function projectCargo(cargo: Cargo): Cargo {
  return {
    id: cargo.id,
    name: cargo.name,
    dimensionsMm: {
      lengthMm: cargo.dimensionsMm.lengthMm,
      widthMm: cargo.dimensionsMm.widthMm,
      heightMm: cargo.dimensionsMm.heightMm,
    },
    massGrams: cargo.massGrams,
    canSupportCargo: cargo.canSupportCargo,
    allowedOrientations: [...cargo.allowedOrientations],
  };
}

function projectContainer(container: Container): Container {
  return {
    id: container.id,
    name: container.name,
    internalDimensionsMm: {
      lengthMm: container.internalDimensionsMm.lengthMm,
      widthMm: container.internalDimensionsMm.widthMm,
      heightMm: container.internalDimensionsMm.heightMm,
    },
    openingMm: {
      widthMm: container.openingMm.widthMm,
      heightMm: container.openingMm.heightMm,
    },
    payloadCapacityGrams: container.payloadCapacityGrams,
  };
}

function projectPlacement(placement: Placement): Placement {
  return {
    cargoId: placement.cargoId,
    containerId: placement.containerId,
    positionMm: {
      xMm: placement.positionMm.xMm,
      yMm: placement.positionMm.yMm,
      zMm: placement.positionMm.zMm,
    },
    orientation: placement.orientation,
  };
}

function persistedProject(project: Project): Project {
  return {
    schemaVersion: project.schemaVersion,
    projectId: project.projectId,
    name: project.name,
    clearancesMm: {
      xMm: project.clearancesMm.xMm,
      yMm: project.clearancesMm.yMm,
      zMm: project.clearancesMm.zMm,
    },
    cargoes: project.cargoes.map(projectCargo),
    containers: project.containers.map(projectContainer),
    placements: project.placements.map(projectPlacement),
  };
}

export function serializeProjectJson(project: Project): ProjectJsonSerializationResult {
  let persisted: Project;
  try {
    persisted = persistedProject(project);
  } catch {
    return {
      ok: false,
      stage: "serialize",
      issues: [{ code: "serialize.failed", path: "/" }],
    };
  }

  if (persisted.schemaVersion !== PROJECT_SCHEMA_VERSION) {
    return {
      ok: false,
      stage: "version",
      issues: [{ code: "version.unsupported", path: "/schemaVersion" }],
    };
  }

  const schemaResult = validateProjectJsonSchema(persisted);
  if (!schemaResult.valid) {
    return { ok: false, stage: "schema", issues: schemaResult.issues };
  }

  const semanticIssues = validateProjectReferences(schemaResult.project);
  if (semanticIssues.length > 0) {
    return { ok: false, stage: "semantic", issues: semanticIssues };
  }

  try {
    return { ok: true, json: JSON.stringify(schemaResult.project) };
  } catch {
    return {
      ok: false,
      stage: "serialize",
      issues: [{ code: "serialize.failed", path: "/" }],
    };
  }
}
