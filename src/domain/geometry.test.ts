import { describe, expect, it } from "vitest";

import { orientedDimensions, placementBounds } from "./geometry";
import type {
  Cargo,
  Orientation,
  OrientedDimensionsMm,
  Placement,
} from "./model";

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
  it.each(mappings)("maps %s to container-local axes", (orientation, expected) => {
    expect(orientedDimensions(cargo, orientation)).toEqual(expected);
  });

  it("does not mutate its cargo input", () => {
    const original = structuredClone(cargo);

    orientedDimensions(cargo, "HWL");

    expect(cargo).toEqual(original);
  });
});

describe("placementBounds", () => {
  const oddCargo: Cargo = {
    ...cargo,
    dimensionsMm: { lengthMm: 101, widthMm: 203, heightMm: 305 },
    allowedOrientations: ["LWH", "WLH", "LHW", "HLW", "WHL", "HWL"],
  };
  const oddMappings: ReadonlyArray<readonly [Orientation, OrientedDimensionsMm]> = [
    ["LWH", { xMm: 101, yMm: 203, zMm: 305 }],
    ["WLH", { xMm: 203, yMm: 101, zMm: 305 }],
    ["LHW", { xMm: 101, yMm: 305, zMm: 203 }],
    ["HLW", { xMm: 305, yMm: 101, zMm: 203 }],
    ["WHL", { xMm: 203, yMm: 305, zMm: 101 }],
    ["HWL", { xMm: 305, yMm: 203, zMm: 101 }],
  ];

  it.each(oddMappings)(
    "keeps the negative minimum corner and adds oriented dimensions for %s",
    (orientation, dimensions) => {
      const placement: Placement = {
        cargoId: oddCargo.id,
        containerId: "container-1",
        positionMm: { xMm: -7, yMm: -11, zMm: -13 },
        orientation,
      };

      expect(placementBounds(oddCargo, placement)).toEqual({
        min: { xMm: -7, yMm: -11, zMm: -13 },
        dimensions,
        max: {
          xMm: -7 + dimensions.xMm,
          yMm: -11 + dimensions.yMm,
          zMm: -13 + dimensions.zMm,
        },
      });
    },
  );

  it("uses z=0 as the floor minimum and does not mutate its inputs", () => {
    const placement: Placement = {
      cargoId: oddCargo.id,
      containerId: "container-1",
      positionMm: { xMm: 7, yMm: 11, zMm: 0 },
      orientation: "LHW",
    };
    const originalCargo = structuredClone(oddCargo);
    const originalPlacement = structuredClone(placement);

    expect(placementBounds(oddCargo, placement)).toEqual({
      min: { xMm: 7, yMm: 11, zMm: 0 },
      dimensions: { xMm: 101, yMm: 305, zMm: 203 },
      max: { xMm: 108, yMm: 316, zMm: 203 },
    });
    expect(oddCargo).toEqual(originalCargo);
    expect(placement).toEqual(originalPlacement);
  });
});
