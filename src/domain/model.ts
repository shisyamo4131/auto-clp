export const ORIENTATIONS = ["LWH", "WLH", "LHW", "HLW", "WHL", "HWL"] as const;
export const PROJECT_SCHEMA_VERSION = "0.1.0" as const;

export type Orientation = (typeof ORIENTATIONS)[number];
export type ProjectSchemaVersion = typeof PROJECT_SCHEMA_VERSION;

export interface DimensionsMm {
  readonly lengthMm: number;
  readonly widthMm: number;
  readonly heightMm: number;
}

export interface Cargo {
  readonly id: string;
  readonly name: string;
  readonly dimensionsMm: DimensionsMm;
  readonly massGrams: number;
  readonly canSupportCargo: boolean;
  readonly allowedOrientations: readonly Orientation[];
}

export interface ClearancesMm {
  readonly xMm: number;
  readonly yMm: number;
  readonly zMm: number;
}

export interface OpeningMm {
  readonly widthMm: number;
  readonly heightMm: number;
}

export interface Container {
  readonly id: string;
  readonly name: string;
  readonly internalDimensionsMm: DimensionsMm;
  readonly openingMm: OpeningMm;
  readonly payloadCapacityGrams: number;
}

export interface PositionMm {
  readonly xMm: number;
  readonly yMm: number;
  readonly zMm: number;
}

export interface Placement {
  readonly cargoId: string;
  readonly containerId: string;
  readonly positionMm: PositionMm;
  readonly orientation: Orientation;
}

export interface Project {
  readonly schemaVersion: ProjectSchemaVersion;
  readonly projectId: string;
  readonly name: string;
  readonly clearancesMm: ClearancesMm;
  readonly cargoes: readonly Cargo[];
  readonly containers: readonly Container[];
  readonly placements: readonly Placement[];
}

export interface OrientedDimensionsMm {
  readonly xMm: number;
  readonly yMm: number;
  readonly zMm: number;
}
