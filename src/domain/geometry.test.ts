import { describe, expect, it } from "vitest";

import { orientedDimensions } from "./geometry";
import type { Cargo, Orientation, OrientedDimensionsMm } from "./model";

const cargo: Cargo = {
  id: "cargo-1",
  name: "匿名試験積荷",
  dimensionsMm: {
    lengthMm: 100,
    widthMm: 200,
    heightMm: 300,
  },
  massGrams: 1_000,
  canSupportCargo: false,
  allowedOrientations: ["LWH", "WLH"],
};

const mappings: ReadonlyArray<readonly [Orientation, OrientedDimensionsMm]> = [
  ["LWH", { xMm: 100, yMm: 200, zMm: 300 }],
  ["WLH", { xMm: 200, yMm: 100, zMm: 300 }],
  ["LHW", { xMm: 100, yMm: 300, zMm: 200 }],
  ["HLW", { xMm: 300, yMm: 100, zMm: 200 }],
  ["WHL", { xMm: 200, yMm: 300, zMm: 100 }],
  ["HWL", { xMm: 300, yMm: 200, zMm: 100 }],
];

describe("orientedDimensions", () => {
  it.each(mappings)("maps %s to world axes", (orientation, expected) => {
    expect(orientedDimensions(cargo, orientation)).toEqual(expected);
  });

  it("does not mutate its cargo input", () => {
    const original = structuredClone(cargo);

    orientedDimensions(cargo, "HWL");

    expect(cargo).toEqual(original);
  });
});
