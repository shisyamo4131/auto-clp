import type {
  Cargo,
  Orientation,
  OrientedDimensionsMm,
  Placement,
  PositionMm,
} from "./model";

export interface PlacementBoundsMm {
  readonly min: PositionMm;
  readonly dimensions: OrientedDimensionsMm;
  readonly max: PositionMm;
}

export function orientedDimensions(
  cargo: Pick<Cargo, "dimensionsMm">,
  orientation: Orientation,
): OrientedDimensionsMm {
  const { lengthMm, widthMm, heightMm } = cargo.dimensionsMm;

  switch (orientation) {
    case "LWH":
      return { xMm: lengthMm, yMm: widthMm, zMm: heightMm };
    case "WLH":
      return { xMm: widthMm, yMm: lengthMm, zMm: heightMm };
    case "LHW":
      return { xMm: lengthMm, yMm: heightMm, zMm: widthMm };
    case "HLW":
      return { xMm: heightMm, yMm: lengthMm, zMm: widthMm };
    case "WHL":
      return { xMm: widthMm, yMm: heightMm, zMm: lengthMm };
    case "HWL":
      return { xMm: heightMm, yMm: widthMm, zMm: lengthMm };
  }
}

export function placementBounds(
  cargo: Pick<Cargo, "dimensionsMm">,
  placement: Pick<Placement, "orientation" | "positionMm">,
): PlacementBoundsMm {
  const dimensions = orientedDimensions(cargo, placement.orientation);
  const min = { ...placement.positionMm };

  return {
    min,
    dimensions,
    max: {
      xMm: min.xMm + dimensions.xMm,
      yMm: min.yMm + dimensions.yMm,
      zMm: min.zMm + dimensions.zMm,
    },
  };
}
