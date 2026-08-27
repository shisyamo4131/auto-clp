import { describe, expect, it } from "vitest";

import type { Cargo, Container, Placement, Project } from "../domain/model";
import { createInitialProject } from "./project-factory";
import {
  deleteCargo,
  deleteContainer,
  parseClearanceMm,
  parseDimensionMm,
  parseKilogramsToGrams,
  saveCargo,
  saveContainer,
  updateProjectSettings,
  type CargoDraft,
  type ContainerDraft,
} from "./project-command";

const cargoDraft: CargoDraft = {
  name: "合成積荷A",
  lengthMm: "1200",
  widthMm: "800",
  heightMm: "900",
  massKg: "1.005",
  canSupportCargo: false,
  allowedOrientations: ["LWH", "WLH"],
};

const containerDraft: ContainerDraft = {
  name: "合成候補A",
  internalLengthMm: "6000",
  internalWidthMm: "2400",
  internalHeightMm: "2600",
  openingWidthMm: "2400",
  openingHeightMm: "2500",
  payloadCapacityKg: "100000",
};

function cargo(id = "cargo-1"): Cargo {
  return {
    id,
    name: "合成積荷A",
    dimensionsMm: { lengthMm: 1200, widthMm: 800, heightMm: 900 },
    massGrams: 1005,
    canSupportCargo: false,
    allowedOrientations: ["LWH", "WLH"],
  };
}

function container(id = "container-1"): Container {
  return {
    id,
    name: "合成候補A",
    internalDimensionsMm: { lengthMm: 6000, widthMm: 2400, heightMm: 2600 },
    openingMm: { widthMm: 2400, heightMm: 2500 },
    payloadCapacityGrams: 100_000_000,
  };
}

function placement(): Placement {
  return {
    cargoId: "cargo-1",
    containerId: "container-1",
    positionMm: { xMm: 0, yMm: 0, zMm: 0 },
    orientation: "LWH",
  };
}

function placedProject(): Project {
  return {
    ...createInitialProject(),
    cargoes: [cargo()],
    containers: [container()],
    placements: [placement()],
  };
}

function deepFreeze<T>(value: T): T {
  if (value !== null && typeof value === "object" && !Object.isFrozen(value)) {
    for (const key of Reflect.ownKeys(value)) {
      deepFreeze(Reflect.get(value, key) as unknown);
    }
    Object.freeze(value);
  }
  return value;
}

describe("input parsers", () => {
  it.each([
    ["0.001", 1],
    ["1", 1000],
    ["1.2", 1200],
    ["1.23", 1230],
    ["1.234", 1234],
    ["1.005", 1005],
    ["99999.999", 99_999_999],
    ["100000", 100_000_000],
    ["100000.000", 100_000_000],
    [" 1.005 ", 1005],
  ])("converts exact kilograms %s to grams", (raw, expected) => {
    expect(parseKilogramsToGrams(raw)).toEqual({ ok: true, value: expected });
  });

  it.each([
    "1.0001",
    "0.0001",
    "1.2345",
    "1e3",
    "",
    "   ",
    "+1",
    "-1",
    "1,000",
    ".001",
    "1.",
    "NaN",
    "Infinity",
  ])(
    "rejects non-canonical kilogram input %s",
    (raw) => {
      expect(parseKilogramsToGrams(raw)).toEqual({
        ok: false,
        issue: { code: "input.kg-format", path: "/massKg" },
      });
    },
  );

  it.each(["0", "0.000", "100000.001"])("rejects kilogram range boundary %s", (raw) => {
    expect(parseKilogramsToGrams(raw).ok).toBe(false);
    expect(parseKilogramsToGrams(raw)).toMatchObject({
      issue: { code: "input.kg-range", path: "/massKg" },
    });
  });

  it("accepts dimension and clearance boundaries", () => {
    expect(parseDimensionMm("1")).toEqual({ ok: true, value: 1 });
    expect(parseDimensionMm("100000")).toEqual({ ok: true, value: 100000 });
    expect(parseClearanceMm("0")).toEqual({ ok: true, value: 0 });
    expect(parseClearanceMm("10000")).toEqual({ ok: true, value: 10000 });
  });

  it.each([
    [parseDimensionMm, "0"],
    [parseDimensionMm, "100001"],
    [parseClearanceMm, "-1"],
    [parseClearanceMm, "10001"],
  ])("rejects mm range outside the accepted boundary", (parser, raw) => {
    expect(parser(raw).ok).toBe(false);
  });

  it.each(["", "   ", "-1", "+1", "1.0", "1e3", "1,000", "NaN", "Infinity"])(
    "rejects non-ASCII-integer mm input %s",
    (raw) => expect(parseDimensionMm(raw).ok).toBe(false),
  );

  it("rejects huge or excessive-leading-zero numeric text before BigInt conversion", () => {
    const huge = "9".repeat(10_000);
    const longZeroes = "0".repeat(10_000);

    expect(parseDimensionMm(huge)).toEqual({
      ok: false,
      issue: { code: "input.mm-length", path: "/dimensionMm" },
    });
    expect(parseClearanceMm(longZeroes)).toEqual({
      ok: false,
      issue: { code: "input.mm-length", path: "/clearanceMm" },
    });
    expect(parseKilogramsToGrams(huge)).toEqual({
      ok: false,
      issue: { code: "input.kg-length", path: "/massKg" },
    });
    expect(parseKilogramsToGrams(`${longZeroes}.001`)).toEqual({
      ok: false,
      issue: { code: "input.kg-length", path: "/massKg" },
    });
  });

  it("keeps canonical upper boundaries while rejecting their next values", () => {
    expect(parseDimensionMm("100000")).toEqual({ ok: true, value: 100000 });
    expect(parseDimensionMm("100001").ok).toBe(false);
    expect(parseClearanceMm("10000")).toEqual({ ok: true, value: 10000 });
    expect(parseClearanceMm("10001").ok).toBe(false);
    expect(parseKilogramsToGrams("100000.000")).toEqual({
      ok: true,
      value: 100_000_000,
    });
    expect(parseKilogramsToGrams("100000.001").ok).toBe(false);
  });
});

describe("project commands", () => {
  it("updates project settings immutably and preserves placements", () => {
    const current = placedProject();
    const result = updateProjectSettings(current, {
      name: "匿名案件B",
      clearanceXmm: "10",
      clearanceYmm: "20",
      clearanceZmm: "30",
    });

    expect(result.ok).toBe(true);
    if (result.ok) {
      expect(result.project).not.toBe(current);
      expect(result.project.clearancesMm).toEqual({ xMm: 10, yMm: 20, zMm: 30 });
      expect(result.project.placements).toBe(current.placements);
    }
    expect(current.name).toBe("新規案件");
  });

  it("returns the identical current project for invalid settings", () => {
    const current = createInitialProject();
    const result = updateProjectSettings(current, {
      name: "匿名案件",
      clearanceXmm: "10001",
      clearanceYmm: "0",
      clearanceZmm: "0",
    });
    expect(result.ok).toBe(false);
    expect(result.project).toBe(current);
  });

  it("returns the identical current project for huge command drafts", () => {
    const current = createInitialProject();
    const huge = "9".repeat(10_000);
    const cargoResult = saveCargo(current, { ...cargoDraft, lengthMm: huge, massKg: huge });
    const containerResult = saveContainer(current, {
      ...containerDraft,
      internalLengthMm: huge,
      payloadCapacityKg: huge,
    });

    expect(cargoResult.ok).toBe(false);
    expect(cargoResult.project).toBe(current);
    expect(containerResult.ok).toBe(false);
    expect(containerResult.project).toBe(current);
  });

  it("does not mutate a deeply frozen current project on any rejected command", () => {
    const current = deepFreeze(placedProject());
    const original = structuredClone(current);
    const results = [
      updateProjectSettings(current, {
        name: "匿名案件",
        clearanceXmm: "10001",
        clearanceYmm: "0",
        clearanceZmm: "0",
      }),
      saveCargo(current, { ...cargoDraft, allowedOrientations: ["WLH"] }, "cargo-1"),
      saveContainer(
        current,
        { ...containerDraft, openingWidthMm: "2401" },
        "container-1",
      ),
      deleteCargo(current, "cargo-1"),
      deleteContainer(current, "container-1"),
    ];

    for (const result of results) {
      expect(result.ok).toBe(false);
      expect(result.project).toBe(current);
    }
    expect(current).toEqual(original);
  });

  it("adds cargo with deterministic ID and default orientations", () => {
    const result = saveCargo(createInitialProject(), cargoDraft);
    expect(result.ok).toBe(true);
    if (result.ok) {
      expect(result.project.cargoes[0]).toMatchObject({
        id: "cargo-1",
        massGrams: 1005,
        allowedOrientations: ["LWH", "WLH"],
      });
    }
  });

  it("preserves cargo ID and placements when editing", () => {
    const current = placedProject();
    const result = saveCargo(current, { ...cargoDraft, name: "合成積荷B" }, "cargo-1");
    expect(result.ok).toBe(true);
    if (result.ok) {
      expect(result.project.cargoes[0]?.id).toBe("cargo-1");
      expect(result.project.cargoes[0]?.name).toBe("合成積荷B");
      expect(result.project.placements).toBe(current.placements);
    }
  });

  it("refuses an orientation edit that would invalidate a placement", () => {
    const current = placedProject();
    const result = saveCargo(
      current,
      { ...cargoDraft, allowedOrientations: ["WLH"] },
      "cargo-1",
    );
    expect(result.ok).toBe(false);
    expect(result.project).toBe(current);
    expect(result).toMatchObject({ issues: [{ code: "semantic.disallowed-orientation" }] });
  });

  it("rejects empty orientations without changing current", () => {
    const current = createInitialProject();
    const result = saveCargo(current, { ...cargoDraft, allowedOrientations: [] });
    expect(result.ok).toBe(false);
    expect(result.project).toBe(current);
  });

  it("enforces cargo maximum in the command layer", () => {
    const prototype = cargo();
    const current: Project = {
      ...createInitialProject(),
      cargoes: Array.from({ length: 1000 }, (_, index) => ({
        ...prototype,
        id: `cargo-${index + 1}`,
      })),
    };
    const result = saveCargo(current, cargoDraft);
    expect(result).toMatchObject({
      ok: false,
      project: current,
      issues: [{ code: "command.cargo-limit", path: "/cargoes" }],
    });
    const edited = saveCargo(current, { ...cargoDraft, name: "上限時の編集" }, "cargo-1");
    expect(edited.ok).toBe(true);
    if (edited.ok) expect(edited.project.cargoes).toHaveLength(1000);
  });

  it("adds and edits a container while preserving its ID and placements", () => {
    const added = saveContainer(createInitialProject(), containerDraft);
    expect(added.ok).toBe(true);
    if (!added.ok) return;
    expect(added.project.containers[0]?.id).toBe("container-1");

    const current: Project = {
      ...placedProject(),
      containers: added.project.containers,
    };
    const edited = saveContainer(
      current,
      { ...containerDraft, name: "合成候補B" },
      "container-1",
    );
    expect(edited.ok).toBe(true);
    if (edited.ok) {
      expect(edited.project.containers[0]?.id).toBe("container-1");
      expect(edited.project.placements).toBe(current.placements);
    }
  });

  it("accepts opening equal to internal dimensions and rejects width or height +1", () => {
    expect(saveContainer(createInitialProject(), containerDraft).ok).toBe(true);
    const current = createInitialProject();
    const invalidWidth = saveContainer(current, {
      ...containerDraft,
      openingWidthMm: "2401",
    });
    expect(invalidWidth.ok).toBe(false);
    expect(invalidWidth.project).toBe(current);
    expect(invalidWidth).toMatchObject({
      issues: [{ code: "semantic.opening-width-exceeds-internal" }],
    });
    const invalidHeight = saveContainer(current, {
      ...containerDraft,
      openingHeightMm: "2601",
    });
    expect(invalidHeight.ok).toBe(false);
    expect(invalidHeight.project).toBe(current);
    expect(invalidHeight).toMatchObject({
      issues: [{ code: "semantic.opening-height-exceeds-internal" }],
    });
  });

  it("enforces container maximum in the command layer", () => {
    const prototype = container();
    const current: Project = {
      ...createInitialProject(),
      containers: Array.from({ length: 100 }, (_, index) => ({
        ...prototype,
        id: `container-${index + 1}`,
      })),
    };
    expect(saveContainer(current, containerDraft)).toMatchObject({
      ok: false,
      project: current,
      issues: [{ code: "command.container-limit" }],
    });
    const edited = saveContainer(
      current,
      { ...containerDraft, name: "上限時の編集" },
      "container-1",
    );
    expect(edited.ok).toBe(true);
    if (edited.ok) expect(edited.project.containers).toHaveLength(100);
  });

  it("refuses referenced deletion and never cascades placements", () => {
    const current = placedProject();
    const cargoResult = deleteCargo(current, "cargo-1");
    const containerResult = deleteContainer(current, "container-1");
    expect(cargoResult.ok).toBe(false);
    expect(cargoResult.project).toBe(current);
    expect(containerResult.ok).toBe(false);
    expect(containerResult.project).toBe(current);
    expect(current.placements).toHaveLength(1);
  });

  it("deletes unreferenced entities immutably", () => {
    const current: Project = {
      ...createInitialProject(),
      cargoes: [cargo()],
      containers: [container()],
    };
    const withoutCargo = deleteCargo(current, "cargo-1");
    expect(withoutCargo.ok).toBe(true);
    if (!withoutCargo.ok) return;
    expect(withoutCargo.project.cargoes).toEqual([]);
    expect(current.cargoes).toHaveLength(1);
    const withoutContainer = deleteContainer(withoutCargo.project, "container-1");
    expect(withoutContainer.ok).toBe(true);
    if (withoutContainer.ok) expect(withoutContainer.project.containers).toEqual([]);
  });
});
