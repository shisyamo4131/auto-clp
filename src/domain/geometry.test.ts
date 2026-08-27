import { describe, expect, it } from "vitest";

import {
  fittingOpeningOrientations,
  fitsRectangularOpening,
  hasFullGeometricSupport,
  hasPositiveVolumeOverlap,
  hasRequiredAxisClearance,
  isRectangleFullyCoveredByUnion,
  isPlacementWithinContainer,
  isPlacementWithinContainerWithClearance,
  orientedDimensions,
  placementBounds,
} from "./geometry";
import type {
  GeometricSupportCandidateMm,
  PlacementBoundsMm,
  RectangleBoundsMm,
} from "./geometry";
import type {
  Cargo,
  ClearancesMm,
  DimensionsMm,
  Orientation,
  OpeningMm,
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

function clearanceForAxis(clearances: ClearancesMm, axis: AxisKey): number {
  switch (axis) {
    case "xMm":
      return clearances.xMm;
    case "yMm":
      return clearances.yMm;
    case "zMm":
      return clearances.zMm;
  }
}

function separatedBounds(
  axis: AxisKey,
  direction: "negative" | "positive",
  gap: number,
): PlacementBoundsMm {
  return direction === "positive"
    ? boundsAlongAxis(axis, 10 + gap, 20 + gap)
    : boundsAlongAxis(axis, -10 - gap, -gap);
}

describe("isPlacementWithinContainerWithClearance", () => {
  const clearances: ClearancesMm = { xMm: 2, yMm: 3, zMm: 4 };
  const zeroClearances: ClearancesMm = { xMm: 0, yMm: 0, zMm: 0 };
  const usableMin: PositionMm = { xMm: 2, yMm: 3, zMm: 0 };
  const usableMax: PositionMm = { xMm: 8, yMm: 17, zMm: 26 };
  const clearanceFaces = [
    { label: "negative X opening face", key: "xMm", side: "lower", clearance: 2 },
    { label: "positive X rear wall", key: "xMm", side: "upper", clearance: 2 },
    { label: "minimum Y wall", key: "yMm", side: "lower", clearance: 3 },
    { label: "maximum Y wall", key: "yMm", side: "upper", clearance: 3 },
    { label: "ceiling", key: "zMm", side: "upper", clearance: 4 },
  ] as const;
  const faceCases = clearanceFaces.flatMap(({ label, key, side, clearance }) =>
    ([-1, 0, 1] as const).map((delta) => {
      const gap = clearance + delta;
      const min =
        side === "lower" ? replaceCoordinate(usableMin, key, gap) : usableMin;
      const max =
        side === "upper"
          ? replaceCoordinate(usableMax, key, containerLimitForAxis(key) - gap)
          : usableMax;

      return {
        label: `${label} gap c${delta === 0 ? "" : delta > 0 ? "+1" : "-1"}`,
        candidate: bounds(min, max),
        expected: delta >= 0,
      };
    }),
  );
  const invalidCases = axes.flatMap(({ label, key }) => [
    { label: `${label} zero extent`, candidate: boundsAlongAxis(key, 5, 5) },
    { label: `${label} inverted extent`, candidate: boundsAlongAxis(key, 6, 5) },
  ]);

  function containerLimitForAxis(axis: AxisKey): number {
    switch (axis) {
      case "xMm":
        return containerDimensions.lengthMm;
      case "yMm":
        return containerDimensions.widthMm;
      case "zMm":
        return containerDimensions.heightMm;
    }
  }

  it.each(faceCases)("checks $label", ({ candidate, expected }) => {
    expect(
      isPlacementWithinContainerWithClearance(
        candidate,
        containerDimensions,
        clearances,
      ),
    ).toBe(expected);
  });

  it("allows exact floor contact without consuming Z clearance", () => {
    expect(
      isPlacementWithinContainerWithClearance(
        bounds(usableMin, usableMax),
        containerDimensions,
        clearances,
      ),
    ).toBe(true);
  });

  it("keeps raw containment mandatory below the floor", () => {
    expect(
      isPlacementWithinContainerWithClearance(
        bounds({ ...usableMin, zMm: -1 }, usableMax),
        containerDimensions,
        clearances,
      ),
    ).toBe(false);
  });

  it("does not impose Z clearance above the floor", () => {
    expect(
      isPlacementWithinContainerWithClearance(
        bounds({ ...usableMin, zMm: 1 }, usableMax),
        containerDimensions,
        clearances,
      ),
    ).toBe(true);
  });

  it("reduces to raw closed-container containment when every clearance is zero", () => {
    expect(
      isPlacementWithinContainerWithClearance(
        bounds(
          { xMm: 0, yMm: 0, zMm: 0 },
          { xMm: 10, yMm: 20, zMm: 30 },
        ),
        containerDimensions,
        zeroClearances,
      ),
    ).toBe(true);
  });

  it.each(
    axes.flatMap(({ label, key, containerLimit }) => [
      {
        label: `${label} raw lower outside by 1 mm`,
        candidate: bounds(
          replaceCoordinate({ xMm: 0, yMm: 0, zMm: 0 }, key, -1),
          { xMm: 10, yMm: 20, zMm: 30 },
        ),
      },
      {
        label: `${label} raw upper outside by 1 mm`,
        candidate: bounds(
          { xMm: 0, yMm: 0, zMm: 0 },
          replaceCoordinate({ xMm: 10, yMm: 20, zMm: 30 }, key, containerLimit + 1),
        ),
      },
    ]),
  )("rejects $label even with zero clearance", ({ candidate }) => {
    expect(
      isPlacementWithinContainerWithClearance(
        candidate,
        containerDimensions,
        zeroClearances,
      ),
    ).toBe(false);
  });

  it.each([
    {
      label: "X usable span exact",
      exact: bounds(usableMin, usableMax),
      tooLarge: bounds(usableMin, { ...usableMax, xMm: usableMax.xMm + 1 }),
    },
    {
      label: "Y usable span exact",
      exact: bounds(usableMin, usableMax),
      tooLarge: bounds(usableMin, { ...usableMax, yMm: usableMax.yMm + 1 }),
    },
    {
      label: "Z usable span exact",
      exact: bounds(usableMin, usableMax),
      tooLarge: bounds(usableMin, { ...usableMax, zMm: usableMax.zMm + 1 }),
    },
  ])("accepts $label and rejects 1 mm too large", ({ exact, tooLarge }) => {
    expect(
      isPlacementWithinContainerWithClearance(
        exact,
        containerDimensions,
        clearances,
      ),
    ).toBe(true);
    expect(
      isPlacementWithinContainerWithClearance(
        tooLarge,
        containerDimensions,
        clearances,
      ),
    ).toBe(false);
  });

  it.each(invalidCases)("rejects $label", ({ candidate }) => {
    expect(
      isPlacementWithinContainerWithClearance(
        candidate,
        containerDimensions,
        zeroClearances,
      ),
    ).toBe(false);
  });

  it("does not mutate bounds, container dimensions, or clearances", () => {
    const candidate = bounds(usableMin, usableMax);
    const originalCandidate = structuredClone(candidate);
    const originalContainer = structuredClone(containerDimensions);
    const originalClearances = structuredClone(clearances);

    isPlacementWithinContainerWithClearance(
      candidate,
      containerDimensions,
      clearances,
    );

    expect(candidate).toEqual(originalCandidate);
    expect(containerDimensions).toEqual(originalContainer);
    expect(clearances).toEqual(originalClearances);
  });
});

describe("hasRequiredAxisClearance", () => {
  const reference = bounds(
    { xMm: 0, yMm: 0, zMm: 0 },
    { xMm: 10, yMm: 10, zMm: 10 },
  );
  const clearances: ClearancesMm = { xMm: 3, yMm: 4, zMm: 5 };
  const zeroClearances: ClearancesMm = { xMm: 0, yMm: 0, zMm: 0 };
  const axisGapCases = axes.flatMap(({ label, key }) => {
    const clearance = clearanceForAxis(clearances, key);

    return (["negative", "positive"] as const).flatMap((direction) =>
      ([-1, 0, 1] as const).map((delta) => ({
        label: `${label} ${direction} gap c${delta === 0 ? "" : delta > 0 ? "+1" : "-1"}`,
        candidate: separatedBounds(key, direction, clearance + delta),
        expected: delta >= 0,
      })),
    );
  });
  const zeroContactCases = [
    ...axes.map(({ label, key }) => ({
      label: `${label} face contact at c=0`,
      candidate: separatedBounds(key, "positive", 0),
    })),
    {
      label: "XY edge contact at c=0",
      candidate: bounds(
        { xMm: 10, yMm: 10, zMm: 2 },
        { xMm: 20, yMm: 20, zMm: 8 },
      ),
    },
    {
      label: "XZ edge contact at c=0",
      candidate: bounds(
        { xMm: 10, yMm: 2, zMm: 10 },
        { xMm: 20, yMm: 8, zMm: 20 },
      ),
    },
    {
      label: "YZ edge contact at c=0",
      candidate: bounds(
        { xMm: 2, yMm: 10, zMm: 10 },
        { xMm: 8, yMm: 20, zMm: 20 },
      ),
    },
    {
      label: "corner contact at c=0",
      candidate: bounds(
        { xMm: 10, yMm: 10, zMm: 10 },
        { xMm: 20, yMm: 20, zMm: 20 },
      ),
    },
  ];
  const invalidCases = axes.flatMap(({ label, key }) => [
    { label: `${label} zero extent`, candidate: boundsAlongAxis(key, 5, 5) },
    { label: `${label} inverted extent`, candidate: boundsAlongAxis(key, 6, 5) },
  ]);

  it.each(axisGapCases)(
    "$label returns $expected in both operand orders",
    ({ candidate, expected }) => {
      expect(hasRequiredAxisClearance(reference, candidate, clearances)).toBe(expected);
      expect(hasRequiredAxisClearance(candidate, reference, clearances)).toBe(expected);
    },
  );

  it("uses one shared surface gap c, not one halo per cargo totaling 2c", () => {
    const gapC = separatedBounds("xMm", "positive", clearances.xMm);
    const gapTwoC = separatedBounds("xMm", "positive", clearances.xMm * 2);

    expect(hasRequiredAxisClearance(reference, gapC, clearances)).toBe(true);
    expect(hasRequiredAxisClearance(reference, gapTwoC, clearances)).toBe(true);
  });

  it.each(zeroContactCases)("accepts $label in both operand orders", ({ candidate }) => {
    expect(hasRequiredAxisClearance(reference, candidate, zeroClearances)).toBe(true);
    expect(hasRequiredAxisClearance(candidate, reference, zeroClearances)).toBe(true);
  });

  it("rejects positive-volume overlap regardless of zero clearance", () => {
    const candidate = bounds(
      { xMm: 9, yMm: 9, zMm: 9 },
      { xMm: 19, yMm: 19, zMm: 19 },
    );

    expect(hasRequiredAxisClearance(reference, candidate, zeroClearances)).toBe(false);
    expect(hasRequiredAxisClearance(candidate, reference, zeroClearances)).toBe(false);
  });

  it("accepts multiple-axis separation when one axis alone meets its clearance", () => {
    const candidate = bounds(
      { xMm: 13, yMm: 13, zMm: 2 },
      { xMm: 23, yMm: 23, zMm: 8 },
    );

    expect(hasRequiredAxisClearance(reference, candidate, clearances)).toBe(true);
    expect(hasRequiredAxisClearance(candidate, reference, clearances)).toBe(true);
  });

  it("rejects multiple-axis separation when no separated axis meets its clearance", () => {
    const candidate = bounds(
      { xMm: 12, yMm: 13, zMm: 14 },
      { xMm: 22, yMm: 23, zMm: 24 },
    );

    expect(hasRequiredAxisClearance(reference, candidate, clearances)).toBe(false);
    expect(hasRequiredAxisClearance(candidate, reference, clearances)).toBe(false);
  });

  it.each(invalidCases)("rejects $label in both operand orders", ({ candidate }) => {
    expect(hasRequiredAxisClearance(reference, candidate, clearances)).toBe(false);
    expect(hasRequiredAxisClearance(candidate, reference, clearances)).toBe(false);
  });

  it("does not mutate either bounds or clearances", () => {
    const candidate = separatedBounds("yMm", "negative", clearances.yMm);
    const originalReference = structuredClone(reference);
    const originalCandidate = structuredClone(candidate);
    const originalClearances = structuredClone(clearances);

    hasRequiredAxisClearance(reference, candidate, clearances);

    expect(reference).toEqual(originalReference);
    expect(candidate).toEqual(originalCandidate);
    expect(clearances).toEqual(originalClearances);
  });
});

describe("fitsRectangularOpening", () => {
  const dimensions: OrientedDimensionsMm = { xMm: 900, yMm: 100, zMm: 200 };
  const clearances: ClearancesMm = { xMm: 30, yMm: 10, zMm: 20 };
  const exactOpening: OpeningMm = { widthMm: 120, heightMm: 220 };

  it.each([
    { label: "width exact", opening: exactOpening, expected: true },
    {
      label: "width 1 mm too small",
      opening: { ...exactOpening, widthMm: exactOpening.widthMm - 1 },
      expected: false,
    },
    {
      label: "width 1 mm larger",
      opening: { ...exactOpening, widthMm: exactOpening.widthMm + 1 },
      expected: true,
    },
    { label: "height exact", opening: exactOpening, expected: true },
    {
      label: "height 1 mm too small",
      opening: { ...exactOpening, heightMm: exactOpening.heightMm - 1 },
      expected: false,
    },
    {
      label: "height 1 mm larger",
      opening: { ...exactOpening, heightMm: exactOpening.heightMm + 1 },
      expected: true,
    },
  ])("checks $label", ({ opening, expected }) => {
    expect(fitsRectangularOpening(dimensions, opening, clearances)).toBe(expected);
  });

  it.each([
    {
      label: "width only",
      opening: { widthMm: exactOpening.widthMm - 1, heightMm: exactOpening.heightMm },
    },
    {
      label: "height only",
      opening: { widthMm: exactOpening.widthMm, heightMm: exactOpening.heightMm - 1 },
    },
    {
      label: "both width and height",
      opening: {
        widthMm: exactOpening.widthMm - 1,
        heightMm: exactOpening.heightMm - 1,
      },
    },
  ])("rejects when $label fails", ({ opening }) => {
    expect(fitsRectangularOpening(dimensions, opening, clearances)).toBe(false);
  });

  it("accepts exact width and height equality when clearances are zero", () => {
    expect(
      fitsRectangularOpening(
        dimensions,
        { widthMm: dimensions.yMm, heightMm: dimensions.zMm },
        { xMm: 0, yMm: 0, zMm: 0 },
      ),
    ).toBe(true);
  });

  it("ignores X clearance and oriented X dimension", () => {
    expect(
      fitsRectangularOpening(
        { ...dimensions, xMm: 1 },
        exactOpening,
        { ...clearances, xMm: 0 },
      ),
    ).toBe(true);
    expect(
      fitsRectangularOpening(
        { ...dimensions, xMm: 100_000 },
        exactOpening,
        { ...clearances, xMm: 10_000 },
      ),
    ).toBe(true);
  });

  it("requires Y clearance on both sides rather than only once", () => {
    expect(
      fitsRectangularOpening(
        dimensions,
        { ...exactOpening, widthMm: dimensions.yMm + clearances.yMm },
        clearances,
      ),
    ).toBe(false);
    expect(fitsRectangularOpening(dimensions, exactOpening, clearances)).toBe(true);
  });

  it("requires Z clearance only once because the cargo stays on the opening floor", () => {
    expect(
      fitsRectangularOpening(
        dimensions,
        {
          widthMm: exactOpening.widthMm,
          heightMm: dimensions.zMm + clearances.zMm,
        },
        clearances,
      ),
    ).toBe(true);
  });

  it("does not mutate dimensions, opening, or clearances", () => {
    const originalDimensions = structuredClone(dimensions);
    const originalOpening = structuredClone(exactOpening);
    const originalClearances = structuredClone(clearances);

    fitsRectangularOpening(dimensions, exactOpening, clearances);

    expect(dimensions).toEqual(originalDimensions);
    expect(exactOpening).toEqual(originalOpening);
    expect(clearances).toEqual(originalClearances);
  });
});

describe("fittingOpeningOrientations", () => {
  const allOrientations: readonly Orientation[] = [
    "LWH",
    "WLH",
    "LHW",
    "HLW",
    "WHL",
    "HWL",
  ];
  const openingCargo: Cargo = {
    ...cargo,
    allowedOrientations: allOrientations,
  };
  const exactClearances: ClearancesMm = { xMm: 999, yMm: 2, zMm: 3 };

  it.each(mappings)(
    "uses the %s oriented Y/Z dimensions",
    (orientation, oriented) => {
      const singleAllowedCargo: Cargo = {
        ...openingCargo,
        allowedOrientations: [orientation],
      };
      const opening: OpeningMm = {
        widthMm: oriented.yMm + exactClearances.yMm * 2,
        heightMm: oriented.zMm + exactClearances.zMm,
      };

      expect(
        fittingOpeningOrientations(singleAllowedCargo, opening, exactClearances),
      ).toEqual([orientation]);
    },
  );

  it("returns exactly one fitting allowed orientation", () => {
    expect(
      fittingOpeningOrientations(
        openingCargo,
        { widthMm: 100, heightMm: 200 },
        { xMm: 0, yMm: 0, zMm: 0 },
      ),
    ).toEqual(["HLW"]);
  });

  it("returns multiple fitting orientations in the allowed-list order", () => {
    const customOrderCargo: Cargo = {
      ...openingCargo,
      allowedOrientations: ["HWL", "LWH", "HLW", "WLH", "WHL", "LHW"],
    };

    expect(
      fittingOpeningOrientations(
        customOrderCargo,
        { widthMm: 200, heightMm: 300 },
        { xMm: 0, yMm: 0, zMm: 0 },
      ),
    ).toEqual(["HWL", "LWH", "HLW", "WLH"]);
  });

  it("returns none when every allowed orientation fails", () => {
    expect(
      fittingOpeningOrientations(
        openingCargo,
        { widthMm: 99, heightMm: 99 },
        { xMm: 0, yMm: 0, zMm: 0 },
      ),
    ).toEqual([]);
  });

  it("excludes fitting orientations that are not allowed", () => {
    const subsetCargo: Cargo = {
      ...openingCargo,
      allowedOrientations: ["WHL", "LWH"],
    };

    expect(
      fittingOpeningOrientations(
        subsetCargo,
        { widthMm: 1_000, heightMm: 1_000 },
        { xMm: 0, yMm: 0, zMm: 0 },
      ),
    ).toEqual(["WHL", "LWH"]);
  });

  it("returns a new array and does not mutate cargo, opening, or clearances", () => {
    const opening: OpeningMm = { widthMm: 1_000, heightMm: 1_000 };
    const clearances: ClearancesMm = { xMm: 8, yMm: 9, zMm: 10 };
    const originalCargo = structuredClone(openingCargo);
    const originalOpening = structuredClone(opening);
    const originalClearances = structuredClone(clearances);

    const first = fittingOpeningOrientations(openingCargo, opening, clearances);
    const second = fittingOpeningOrientations(openingCargo, opening, clearances);

    expect(first).toEqual(allOrientations);
    expect(first).not.toBe(openingCargo.allowedOrientations);
    expect(first).not.toBe(second);
    expect(openingCargo).toEqual(originalCargo);
    expect(opening).toEqual(originalOpening);
    expect(clearances).toEqual(originalClearances);
  });
});

describe("isRectangleFullyCoveredByUnion", () => {
  const rectangle = (
    minX: number,
    minY: number,
    maxX: number,
    maxY: number,
  ): RectangleBoundsMm => ({
    min: { xMm: minX, yMm: minY },
    max: { xMm: maxX, yMm: maxY },
  });
  const target = rectangle(0, 0, 10, 10);

  it("returns false for no covering rectangles", () => {
    expect(isRectangleFullyCoveredByUnion(target, [])).toBe(false);
  });

  it.each([
    ["an exact rectangle", rectangle(0, 0, 10, 10), true],
    ["a superset", rectangle(-1, -1, 11, 11), true],
    ["a missing 1 mm right strip", rectangle(0, 0, 9, 10), false],
    ["a strict interior rectangle", rectangle(1, 1, 9, 9), false],
  ] as const)("handles %s", (_label, covering, expected) => {
    expect(isRectangleFullyCoveredByUnion(target, [covering])).toBe(expected);
  });

  it.each([
    [
      "two vertical halves",
      [rectangle(0, 0, 5, 10), rectangle(5, 0, 10, 10)],
    ],
    [
      "two horizontal halves",
      [rectangle(0, 0, 10, 5), rectangle(0, 5, 10, 10)],
    ],
    [
      "four edge-joined quadrants",
      [
        rectangle(0, 0, 5, 5),
        rectangle(5, 0, 10, 5),
        rectangle(0, 5, 5, 10),
        rectangle(5, 5, 10, 10),
      ],
    ],
    [
      "three unequal edge-joined columns",
      [
        rectangle(0, 0, 2, 10),
        rectangle(2, 0, 7, 10),
        rectangle(7, 0, 10, 10),
      ],
    ],
  ] as const)("accepts full coverage bridged by %s", (_label, coverings) => {
    expect(isRectangleFullyCoveredByUnion(target, coverings)).toBe(true);
  });

  it.each([
    [
      "a 1 mm vertical strip",
      [rectangle(0, 0, 4, 10), rectangle(5, 0, 10, 10)],
    ],
    [
      "a 1 mm horizontal strip",
      [rectangle(0, 0, 10, 6), rectangle(0, 7, 10, 10)],
    ],
    [
      "an interior 1 mm square",
      [
        rectangle(0, 0, 10, 4),
        rectangle(0, 5, 10, 10),
        rectangle(0, 4, 4, 5),
        rectangle(5, 4, 10, 5),
      ],
    ],
  ] as const)("rejects coverage with %s uncovered", (_label, coverings) => {
    expect(isRectangleFullyCoveredByUnion(target, coverings)).toBe(false);
  });

  it("accepts the former interior hole when a final 1 mm square closes it", () => {
    const coverings = [
      rectangle(0, 0, 10, 4),
      rectangle(0, 5, 10, 10),
      rectangle(0, 4, 4, 5),
      rectangle(5, 4, 10, 5),
      rectangle(4, 4, 5, 5),
    ];

    expect(isRectangleFullyCoveredByUnion(target, coverings)).toBe(true);
  });

  it("accepts overlapping rectangles whose union covers the target", () => {
    expect(
      isRectangleFullyCoveredByUnion(target, [
        rectangle(0, 0, 6, 10),
        rectangle(4, 0, 10, 10),
      ]),
    ).toBe(true);
  });

  it("rejects duplicate partial rectangles despite their summed area", () => {
    expect(
      isRectangleFullyCoveredByUnion(target, [
        rectangle(0, 0, 6, 10),
        rectangle(0, 0, 6, 10),
      ]),
    ).toBe(false);
  });

  it("clips supports to the target before combining their coverage", () => {
    expect(
      isRectangleFullyCoveredByUnion(target, [
        rectangle(-10, -10, 5, 20),
        rectangle(5, -10, 20, 20),
      ]),
    ).toBe(true);
  });

  it.each([
    ["outside", rectangle(11, 0, 20, 10)],
    ["touching only an edge", rectangle(-10, 0, 0, 10)],
    ["touching only a corner", rectangle(-10, -10, 0, 0)],
  ] as const)("does not count a rectangle %s as target coverage", (_label, outside) => {
    expect(isRectangleFullyCoveredByUnion(target, [outside])).toBe(false);
  });

  it("is independent of covering order and duplicate entries", () => {
    const left = rectangle(0, 0, 5, 10);
    const right = rectangle(5, 0, 10, 10);

    expect(isRectangleFullyCoveredByUnion(target, [left, right])).toBe(true);
    expect(isRectangleFullyCoveredByUnion(target, [right, left])).toBe(true);
    expect(isRectangleFullyCoveredByUnion(target, [right, left, right])).toBe(
      true,
    );
  });

  it("supports negative target coordinates and detects a 1 mm gap", () => {
    const negativeTarget = rectangle(-10, -10, 0, 0);

    expect(
      isRectangleFullyCoveredByUnion(negativeTarget, [
        rectangle(-10, -10, -5, 0),
        rectangle(-5, -10, 0, 0),
      ]),
    ).toBe(true);
    expect(
      isRectangleFullyCoveredByUnion(negativeTarget, [
        rectangle(-10, -10, -6, 0),
        rectangle(-5, -10, 0, 0),
      ]),
    ).toBe(false);
  });

  it("handles translated rectangles at the validated position and dimension limits", () => {
    const minimumTarget = rectangle(-1_000_000, -1_000_000, -900_000, -900_000);
    const maximumTarget = rectangle(1_000_000, 1_000_000, 1_100_000, 1_100_000);

    expect(
      isRectangleFullyCoveredByUnion(minimumTarget, [
        rectangle(-1_000_000, -1_000_000, -950_000, -900_000),
        rectangle(-950_000, -1_000_000, -900_000, -900_000),
      ]),
    ).toBe(true);
    expect(
      isRectangleFullyCoveredByUnion(maximumTarget, [
        rectangle(1_000_000, 1_000_000, 1_049_999, 1_100_000),
        rectangle(1_050_000, 1_000_000, 1_100_000, 1_100_000),
      ]),
    ).toBe(false);
  });

  it.each([
    ["zero width", rectangle(0, 0, 0, 10)],
    ["zero height", rectangle(0, 0, 10, 0)],
    ["inverted X", rectangle(10, 0, 0, 10)],
    ["inverted Y", rectangle(0, 10, 10, 0)],
    ["a fractional coordinate", rectangle(0, 0, 9.5, 10)],
    ["a non-finite coordinate", rectangle(0, 0, 10, Number.POSITIVE_INFINITY)],
  ] as const)("rejects an invalid target with %s", (_label, invalidTarget) => {
    expect(
      isRectangleFullyCoveredByUnion(invalidTarget, [rectangle(0, 0, 10, 10)]),
    ).toBe(false);
  });

  it.each([
    ["first", [rectangle(0, 0, 0, 10), target]],
    ["middle", [target, rectangle(5, 5, 4, 6), target]],
    ["last", [target, rectangle(0, 0, 10, 0)]],
    ["fractional", [rectangle(0, 0, 10, 9.5), target]],
    ["unsafe-integer", [target, rectangle(0, 0, Number.MAX_SAFE_INTEGER + 1, 10)]],
    ["non-finite", [target, rectangle(0, 0, 10, Number.NaN)]],
  ] as const)("rejects an invalid support in the %s position", (_label, coverings) => {
    expect(isRectangleFullyCoveredByUnion(target, coverings)).toBe(false);
  });

  it("does not mutate the target or covering rectangles", () => {
    const mutableTarget = rectangle(0, 0, 10, 10);
    const coverings = [rectangle(-1, -1, 5, 11), rectangle(5, -1, 11, 11)];
    const originalTarget = structuredClone(mutableTarget);
    const originalCoverings = structuredClone(coverings);

    isRectangleFullyCoveredByUnion(mutableTarget, coverings);

    expect(mutableTarget).toEqual(originalTarget);
    expect(coverings).toEqual(originalCoverings);
  });
});

describe("hasFullGeometricSupport", () => {
  const supportTarget = bounds(
    { xMm: 0, yMm: 0, zMm: 10 },
    { xMm: 10, yMm: 10, zMm: 20 },
  );
  const floorTarget = bounds(
    { xMm: 0, yMm: 0, zMm: 0 },
    { xMm: 10, yMm: 10, zMm: 10 },
  );
  const candidate = (
    candidateBounds: PlacementBoundsMm,
    canSupportCargo = true,
  ): GeometricSupportCandidateMm => ({
    bounds: candidateBounds,
    canSupportCargo,
  });
  const exactSupport = candidate(
    bounds(
      { xMm: 0, yMm: 0, zMm: 0 },
      { xMm: 10, yMm: 10, zMm: 10 },
    ),
  );
  const leftSupport = candidate(
    bounds(
      { xMm: 0, yMm: 0, zMm: 0 },
      { xMm: 5, yMm: 10, zMm: 10 },
    ),
  );
  const rightSupport = candidate(
    bounds(
      { xMm: 5, yMm: 0, zMm: 0 },
      { xMm: 10, yMm: 10, zMm: 10 },
    ),
  );

  it.each([
    [
      "zero X extent on the floor",
      bounds(
        { xMm: 0, yMm: 0, zMm: 0 },
        { xMm: 0, yMm: 10, zMm: 10 },
      ),
    ],
    [
      "inverted X extent on the floor",
      bounds(
        { xMm: 10, yMm: 0, zMm: 0 },
        { xMm: 0, yMm: 10, zMm: 10 },
      ),
    ],
    [
      "zero Y extent",
      bounds(
        { xMm: 0, yMm: 5, zMm: 10 },
        { xMm: 10, yMm: 5, zMm: 20 },
      ),
    ],
    [
      "inverted Y extent",
      bounds(
        { xMm: 0, yMm: 10, zMm: 10 },
        { xMm: 10, yMm: 0, zMm: 20 },
      ),
    ],
    [
      "zero Z extent on the floor",
      bounds(
        { xMm: 0, yMm: 0, zMm: 0 },
        { xMm: 10, yMm: 10, zMm: 0 },
      ),
    ],
    [
      "inverted Z extent",
      bounds(
        { xMm: 0, yMm: 0, zMm: 20 },
        { xMm: 10, yMm: 10, zMm: 10 },
      ),
    ],
    [
      "fractional coordinate",
      bounds(
        { xMm: 0.5, yMm: 0, zMm: 10 },
        { xMm: 10, yMm: 10, zMm: 20 },
      ),
    ],
    [
      "unsafe coordinate",
      bounds(
        { xMm: 0, yMm: 0, zMm: 10 },
        { xMm: Number.MAX_SAFE_INTEGER + 1, yMm: 10, zMm: 20 },
      ),
    ],
    [
      "non-finite coordinate",
      bounds(
        { xMm: 0, yMm: 0, zMm: 10 },
        { xMm: 10, yMm: Number.POSITIVE_INFINITY, zMm: 20 },
      ),
    ],
  ] as const)("rejects a target with %s", (_label, invalidTarget) => {
    expect(hasFullGeometricSupport(invalidTarget, [exactSupport])).toBe(false);
  });

  it("accepts a valid floor target without candidates", () => {
    expect(hasFullGeometricSupport(floorTarget, [])).toBe(true);
  });

  it("accepts a valid floor target before inspecting malformed candidates", () => {
    const malformed = candidate(
      bounds(
        { xMm: 0, yMm: 0, zMm: 0 },
        { xMm: 0, yMm: 10, zMm: 10 },
      ),
    );

    expect(hasFullGeometricSupport(floorTarget, [malformed])).toBe(true);
  });

  it("rejects a positive-volume target whose minimum Z is below the floor", () => {
    const belowFloorTarget = bounds(
      { xMm: 0, yMm: 0, zMm: -1 },
      { xMm: 10, yMm: 10, zMm: 9 },
    );
    const touchingCandidate = candidate(
      bounds(
        { xMm: 0, yMm: 0, zMm: -11 },
        { xMm: 10, yMm: 10, zMm: -1 },
      ),
    );

    expect(hasFullGeometricSupport(belowFloorTarget, [touchingCandidate])).toBe(
      false,
    );
  });

  it("rejects an elevated target without candidates", () => {
    expect(hasFullGeometricSupport(supportTarget, [])).toBe(false);
  });

  it("accepts one exact full support", () => {
    expect(hasFullGeometricSupport(supportTarget, [exactSupport])).toBe(true);
  });

  it("accepts two edge-joined supports bridged along X", () => {
    expect(
      hasFullGeometricSupport(supportTarget, [leftSupport, rightSupport]),
    ).toBe(true);
  });

  it.each([
    [
      "1 mm below",
      candidate(
        bounds(
          { xMm: 0, yMm: 0, zMm: 0 },
          { xMm: 10, yMm: 10, zMm: 9 },
        ),
      ),
    ],
    [
      "1 mm above",
      candidate(
        bounds(
          { xMm: 0, yMm: 0, zMm: 0 },
          { xMm: 10, yMm: 10, zMm: 11 },
        ),
      ),
    ],
  ] as const)("rejects a full-XY candidate ending %s the target base", (_label, support) => {
    expect(hasFullGeometricSupport(supportTarget, [support])).toBe(false);
  });

  it("uses only the exact-height members of mixed-height candidates", () => {
    const lowerRight = candidate(
      bounds(
        { xMm: 5, yMm: 0, zMm: 0 },
        { xMm: 10, yMm: 10, zMm: 9 },
      ),
    );
    const upperRight = candidate(
      bounds(
        { xMm: 5, yMm: 0, zMm: 0 },
        { xMm: 10, yMm: 10, zMm: 11 },
      ),
    );

    expect(
      hasFullGeometricSupport(supportTarget, [
        leftSupport,
        lowerRight,
        upperRight,
      ]),
    ).toBe(false);
    expect(
      hasFullGeometricSupport(supportTarget, [
        leftSupport,
        lowerRight,
        rightSupport,
        upperRight,
      ]),
    ).toBe(true);
  });

  it("does not count candidates whose cargo cannot support stacking", () => {
    const disallowedFull = { ...exactSupport, canSupportCargo: false };
    const disallowedRight = { ...rightSupport, canSupportCargo: false };

    expect(hasFullGeometricSupport(supportTarget, [disallowedFull])).toBe(false);
    expect(
      hasFullGeometricSupport(supportTarget, [leftSupport, disallowedRight]),
    ).toBe(false);
  });

  it.each([
    [
      "far away",
      candidate(
        bounds(
          { xMm: 20, yMm: 20, zMm: 0 },
          { xMm: 30, yMm: 30, zMm: 10 },
        ),
      ),
    ],
    [
      "overlapping the target volume",
      candidate(
        bounds(
          { xMm: 0, yMm: 0, zMm: 9 },
          { xMm: 10, yMm: 10, zMm: 11 },
        ),
      ),
    ],
    [
      "at the wrong height",
      candidate(
        bounds(
          { xMm: 0, yMm: 0, zMm: 0 },
          { xMm: 10, yMm: 10, zMm: 9 },
        ),
      ),
    ],
  ] as const)("ignores a valid candidate %s", (_label, irrelevant) => {
    expect(hasFullGeometricSupport(supportTarget, [irrelevant])).toBe(false);
    expect(
      hasFullGeometricSupport(supportTarget, [irrelevant, exactSupport]),
    ).toBe(true);
  });

  it("keeps an eligible support when mixed with a permission-false candidate", () => {
    expect(
      hasFullGeometricSupport(supportTarget, [
        { ...exactSupport, canSupportCargo: false },
        exactSupport,
      ]),
    ).toBe(true);
  });

  it.each([
    [
      "first",
      [
        candidate(
          bounds(
            { xMm: 0, yMm: 0, zMm: 0 },
            { xMm: 0, yMm: 10, zMm: 10 },
          ),
        ),
        exactSupport,
      ],
    ],
    [
      "middle even when permission-false",
      [
        exactSupport,
        candidate(
          bounds(
            { xMm: 0, yMm: 0, zMm: 0 },
            { xMm: 10, yMm: 10, zMm: 9.5 },
          ),
          false,
        ),
        exactSupport,
      ],
    ],
    [
      "last",
      [
        exactSupport,
        candidate(
          bounds(
            { xMm: 10, yMm: 0, zMm: 0 },
            { xMm: 0, yMm: 10, zMm: 10 },
          ),
        ),
      ],
    ],
  ] as const)("rejects an invalid above-floor candidate in the %s position", (_label, candidates) => {
    expect(hasFullGeometricSupport(supportTarget, candidates)).toBe(false);
  });

  it("allows a valid below-floor candidate whose top exactly supports the target", () => {
    const belowFloorSupport = candidate(
      bounds(
        { xMm: 0, yMm: 0, zMm: -1 },
        { xMm: 10, yMm: 10, zMm: 10 },
      ),
    );

    expect(hasFullGeometricSupport(supportTarget, [belowFloorSupport])).toBe(
      true,
    );
  });

  it("does not mutate the target or candidate list", () => {
    const mutableTarget = structuredClone(supportTarget);
    const candidates = [structuredClone(leftSupport), structuredClone(rightSupport)];
    const originalTarget = structuredClone(mutableTarget);
    const originalCandidates = structuredClone(candidates);

    hasFullGeometricSupport(mutableTarget, candidates);

    expect(mutableTarget).toEqual(originalTarget);
    expect(candidates).toEqual(originalCandidates);
  });
});
