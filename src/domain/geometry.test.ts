import { describe, expect, it } from "vitest";

import {
  hasPositiveVolumeOverlap,
  isPlacementWithinContainer,
  orientedDimensions,
  placementBounds,
} from "./geometry";
import type { PlacementBoundsMm } from "./geometry";
import type {
  Cargo,
  DimensionsMm,
  Orientation,
  OrientedDimensionsMm,
  Placement,
  PositionMm,
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

type AxisKey = keyof PositionMm;

interface AxisFixture {
  readonly label: "X" | "Y" | "Z";
  readonly key: AxisKey;
  readonly containerLimit: number;
}

const axes: readonly AxisFixture[] = [
  { label: "X", key: "xMm", containerLimit: 10 },
  { label: "Y", key: "yMm", containerLimit: 20 },
  { label: "Z", key: "zMm", containerLimit: 30 },
];

const containerDimensions: DimensionsMm = {
  lengthMm: 10,
  widthMm: 20,
  heightMm: 30,
};

function bounds(min: PositionMm, max: PositionMm): PlacementBoundsMm {
  return {
    min,
    dimensions: {
      xMm: max.xMm - min.xMm,
      yMm: max.yMm - min.yMm,
      zMm: max.zMm - min.zMm,
    },
    max,
  };
}

function replaceCoordinate(
  value: PositionMm,
  key: AxisKey,
  coordinate: number,
): PositionMm {
  return { ...value, [key]: coordinate };
}

function boundsAlongAxis(
  axis: AxisKey,
  axisMin: number,
  axisMax: number,
  otherMin = 2,
  otherMax = 8,
): PlacementBoundsMm {
  const min: PositionMm = { xMm: otherMin, yMm: otherMin, zMm: otherMin };
  const max: PositionMm = { xMm: otherMax, yMm: otherMax, zMm: otherMax };

  return bounds(
    replaceCoordinate(min, axis, axisMin),
    replaceCoordinate(max, axis, axisMax),
  );
}

describe("isPlacementWithinContainer", () => {
  const strictMin: PositionMm = { xMm: 1, yMm: 1, zMm: 1 };
  const strictMax: PositionMm = { xMm: 9, yMm: 19, zMm: 29 };
  const boundaryCases = axes.flatMap(({ label, key, containerLimit }) => [
    {
      label: `${label} lower boundary exact`,
      candidate: bounds(replaceCoordinate(strictMin, key, 0), strictMax),
      expected: true,
    },
    {
      label: `${label} lower boundary +1 mm`,
      candidate: bounds(replaceCoordinate(strictMin, key, 1), strictMax),
      expected: true,
    },
    {
      label: `${label} lower boundary -1 mm`,
      candidate: bounds(replaceCoordinate(strictMin, key, -1), strictMax),
      expected: false,
    },
    {
      label: `${label} upper boundary exact`,
      candidate: bounds(strictMin, replaceCoordinate(strictMax, key, containerLimit)),
      expected: true,
    },
    {
      label: `${label} upper boundary -1 mm`,
      candidate: bounds(strictMin, replaceCoordinate(strictMax, key, containerLimit - 1)),
      expected: true,
    },
    {
      label: `${label} upper boundary +1 mm`,
      candidate: bounds(strictMin, replaceCoordinate(strictMax, key, containerLimit + 1)),
      expected: false,
    },
  ]);
  const invalidCases = axes.flatMap(({ label, key }) => [
    {
      label: `${label} zero extent`,
      candidate: boundsAlongAxis(key, 5, 5),
    },
    {
      label: `${label} inverted extent`,
      candidate: boundsAlongAxis(key, 6, 5),
    },
  ]);

  it("accepts a positive-volume box equal to the complete container", () => {
    expect(
      isPlacementWithinContainer(
        bounds(
          { xMm: 0, yMm: 0, zMm: 0 },
          { xMm: 10, yMm: 20, zMm: 30 },
        ),
        containerDimensions,
      ),
    ).toBe(true);
  });

  it("accepts a strictly interior positive-volume box", () => {
    expect(
      isPlacementWithinContainer(bounds(strictMin, strictMax), containerDimensions),
    ).toBe(true);
  });

  it.each(boundaryCases)("checks $label", ({ candidate, expected }) => {
    expect(isPlacementWithinContainer(candidate, containerDimensions)).toBe(expected);
  });

  it.each(invalidCases)("rejects $label", ({ candidate }) => {
    expect(isPlacementWithinContainer(candidate, containerDimensions)).toBe(false);
  });

  it("does not mutate its bounds or container dimensions", () => {
    const candidate = bounds(strictMin, strictMax);
    const originalCandidate = structuredClone(candidate);
    const originalContainer = structuredClone(containerDimensions);

    isPlacementWithinContainer(candidate, containerDimensions);

    expect(candidate).toEqual(originalCandidate);
    expect(containerDimensions).toEqual(originalContainer);
  });
});

describe("hasPositiveVolumeOverlap", () => {
  const reference = bounds(
    { xMm: 0, yMm: 0, zMm: 0 },
    { xMm: 10, yMm: 10, zMm: 10 },
  );
  const overlapCases: ReadonlyArray<{
    readonly label: string;
    readonly candidate: PlacementBoundsMm;
    readonly expected: boolean;
  }> = [
    { label: "equal boxes", candidate: reference, expected: true },
    {
      label: "candidate nested in reference",
      candidate: bounds({ xMm: 2, yMm: 2, zMm: 2 }, { xMm: 8, yMm: 8, zMm: 8 }),
      expected: true,
    },
    {
      label: "candidate containing reference",
      candidate: bounds(
        { xMm: -2, yMm: -2, zMm: -2 },
        { xMm: 12, yMm: 12, zMm: 12 },
      ),
      expected: true,
    },
    ...axes.map(({ label, key }) => ({
      label: `${label} exactly 1 mm intersection`,
      candidate: boundsAlongAxis(key, 9, 19),
      expected: true,
    })),
    ...axes.map(({ label, key }) => ({
      label: `${label} negative-side exactly 1 mm intersection`,
      candidate: boundsAlongAxis(key, -9, 1),
      expected: true,
    })),
    {
      label: "exactly 1 mm intersection on all axes",
      candidate: bounds({ xMm: 9, yMm: 9, zMm: 9 }, { xMm: 19, yMm: 19, zMm: 19 }),
      expected: true,
    },
    ...axes.map(({ label, key }) => ({
      label: `${label} face contact`,
      candidate: boundsAlongAxis(key, 10, 20),
      expected: false,
    })),
    ...axes.map(({ label, key }) => ({
      label: `${label} negative-side face contact`,
      candidate: boundsAlongAxis(key, -10, 0),
      expected: false,
    })),
    {
      label: "XY edge contact",
      candidate: bounds({ xMm: 10, yMm: 10, zMm: 2 }, { xMm: 20, yMm: 20, zMm: 8 }),
      expected: false,
    },
    {
      label: "XZ edge contact",
      candidate: bounds({ xMm: 10, yMm: 2, zMm: 10 }, { xMm: 20, yMm: 8, zMm: 20 }),
      expected: false,
    },
    {
      label: "YZ edge contact",
      candidate: bounds({ xMm: 2, yMm: 10, zMm: 10 }, { xMm: 8, yMm: 20, zMm: 20 }),
      expected: false,
    },
    {
      label: "corner contact",
      candidate: bounds(
        { xMm: 10, yMm: 10, zMm: 10 },
        { xMm: 20, yMm: 20, zMm: 20 },
      ),
      expected: false,
    },
    ...axes.map(({ label, key }) => ({
      label: `${label} 1 mm gap`,
      candidate: boundsAlongAxis(key, 11, 21),
      expected: false,
    })),
    ...axes.map(({ label, key }) => ({
      label: `${label} negative-side 1 mm gap`,
      candidate: boundsAlongAxis(key, -11, -1),
      expected: false,
    })),
    ...axes.map(({ label, key }) => ({
      label: `${label} zero extent`,
      candidate: boundsAlongAxis(key, 5, 5),
      expected: false,
    })),
    ...axes.map(({ label, key }) => ({
      label: `${label} inverted extent`,
      candidate: boundsAlongAxis(key, 6, 5),
      expected: false,
    })),
  ];

  it.each(overlapCases)(
    "$label returns $expected in both operand orders",
    ({ candidate, expected }) => {
      expect(hasPositiveVolumeOverlap(reference, candidate)).toBe(expected);
      expect(hasPositiveVolumeOverlap(candidate, reference)).toBe(expected);
    },
  );

  it("does not mutate either operand", () => {
    const candidate = bounds(
      { xMm: 9, yMm: 2, zMm: 2 },
      { xMm: 19, yMm: 8, zMm: 8 },
    );
    const originalReference = structuredClone(reference);
    const originalCandidate = structuredClone(candidate);

    hasPositiveVolumeOverlap(reference, candidate);

    expect(reference).toEqual(originalReference);
    expect(candidate).toEqual(originalCandidate);
  });
});
