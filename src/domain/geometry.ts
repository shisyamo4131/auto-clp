import type { Cargo, Orientation, OrientedDimensionsMm } from "./model";

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
