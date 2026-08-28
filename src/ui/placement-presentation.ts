import { orientedDimensions } from "../domain/geometry";
import type { Cargo, Orientation, PositionMm } from "../domain/model";

const ORIGINAL_AXIS_COPY = {
  L: "長さ",
  W: "幅",
  H: "高さ",
} as const;

export interface OrientedPlacementPresentation {
  readonly depthMm: number;
  readonly heightMm: number;
  readonly sizeCopy: string;
  readonly upAxisCopy: string;
  readonly widthMm: number;
}

export function presentOrientedPlacement(
  cargo: Pick<Cargo, "dimensionsMm">,
  orientation: Orientation,
): OrientedPlacementPresentation {
  const dimensions = orientedDimensions(cargo, orientation);
  const upAxis = orientation[2] as keyof typeof ORIGINAL_AXIS_COPY;
  const upAxisCopy = `元の${ORIGINAL_AXIS_COPY[upAxis]}が上`;
  return {
    depthMm: dimensions.xMm,
    widthMm: dimensions.yMm,
    heightMm: dimensions.zMm,
    sizeCopy: `奥行方向 ${dimensions.xMm} × 横幅方向 ${dimensions.yMm} × 高さ方向 ${dimensions.zMm} mm`,
    upAxisCopy,
  };
}

export function placementOrientationOptionCopy(
  cargo: Pick<Cargo, "dimensionsMm">,
  orientation: Orientation,
): string {
  const presentation = presentOrientedPlacement(cargo, orientation);
  return `${presentation.sizeCopy}（${presentation.upAxisCopy}）— 保存上の向きコード ${orientation}`;
}

export function placementPositionCopy(positionMm: PositionMm): string {
  return [
    `入口から手前面まで ${positionMm.xMm} mm`,
    `入口から見て右壁から右側面まで ${positionMm.yMm} mm`,
    `床から下面まで ${positionMm.zMm} mm`,
  ].join(" / ");
}
