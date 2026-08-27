import { describe, expect, it } from "vitest";

import {
  hasPositiveVolumeOverlap,
  hasRequiredAxisClearance,
  isPlacementWithinContainer,
  isPlacementWithinContainerWithClearance,
  orientedDimensions,
  placementBounds,
} from "./geometry";
import type { PlacementBoundsMm } from "./geometry";
import type {
  Cargo,
  ClearancesMm,
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
