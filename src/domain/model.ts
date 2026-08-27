export const ORIENTATIONS = ["LWH", "WLH", "LHW", "HLW", "WHL", "HWL"] as const;

export type Orientation = (typeof ORIENTATIONS)[number];

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

export interface OrientedDimensionsMm {
  readonly xMm: number;
  readonly yMm: number;
  readonly zMm: number;
}
