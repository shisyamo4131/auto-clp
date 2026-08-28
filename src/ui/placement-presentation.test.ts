import { describe, expect, it } from "vitest";

import type { Orientation } from "../domain/model";
import {
  placementOrientationOptionCopy,
  placementPositionCopy,
  presentOrientedPlacement,
} from "./placement-presentation";

const cargo = {
  dimensionsMm: { lengthMm: 101, widthMm: 203, heightMm: 307 },
};

describe("placement presentation", () => {
  it.each([
    ["LWH", 101, 203, 307, "元の高さが上"],
    ["WLH", 203, 101, 307, "元の高さが上"],
    ["LHW", 101, 307, 203, "元の幅が上"],
    ["HLW", 307, 101, 203, "元の幅が上"],
    ["WHL", 203, 307, 101, "元の長さが上"],
    ["HWL", 307, 203, 101, "元の長さが上"],
  ] as const)(
    "presents %s as result dimensions with its original upward axis",
    (orientation, depthMm, widthMm, heightMm, upAxisCopy) => {
      expect(presentOrientedPlacement(cargo, orientation)).toEqual({
        depthMm,
        widthMm,
        heightMm,
        sizeCopy: `奥行方向 ${depthMm} × 横幅方向 ${widthMm} × 高さ方向 ${heightMm} mm`,
        upAxisCopy,
      });
    },
  );

  it.each(["LWH", "WLH", "LHW", "HLW", "WHL", "HWL"] as const)(
    "keeps %s only as trailing storage detail in the option copy",
    (orientation: Orientation) => {
      const copy = placementOrientationOptionCopy(cargo, orientation);
      expect(copy).toContain("奥行方向");
      expect(copy).toContain("横幅方向");
      expect(copy).toContain("高さ方向");
      expect(copy.endsWith(`保存上の向きコード ${orientation}`)).toBe(true);
    },
  );

  it("describes the canonical minimum corner as distances from physical surfaces", () => {
    expect(placementPositionCopy({ xMm: 120, yMm: -3, zMm: 45 })).toBe(
      "入口から手前面まで 120 mm / 入口から見て右壁から右側面まで -3 mm / 床から下面まで 45 mm",
    );
  });
});
