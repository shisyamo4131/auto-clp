import { describe, expect, it } from "vitest";

import type { Cargo, Project } from "./model";
import {
  isUprightOnlyOrientationPolicy,
  normalizeProjectOrientationPolicies,
  orientationsForUprightPolicy,
} from "./orientation-policy";

function cargo(allowedOrientations: Cargo["allowedOrientations"]): Cargo {
  return {
    id: "cargo-1",
    name: "合成積荷",
    dimensionsMm: { lengthMm: 100, widthMm: 80, heightMm: 60 },
    massGrams: 1000,
    canSupportCargo: false,
    allowedOrientations,
  };
}

function project(allowedOrientations: Cargo["allowedOrientations"]): Project {
  return {
    schemaVersion: "0.1.0",
    projectId: "orientation-policy",
    name: "向き方針試験",
    clearancesMm: { xMm: 0, yMm: 0, zMm: 0 },
    cargoes: [cargo(allowedOrientations)],
    containers: [],
    placements: [],
  };
}

describe("orientation policy", () => {
  it("maps 天地無用 to both upright floor orientations", () => {
    expect(isUprightOnlyOrientationPolicy(["LWH"])).toBe(true);
    expect(isUprightOnlyOrientationPolicy(["WLH", "LWH"])).toBe(true);
    expect(orientationsForUprightPolicy(true)).toEqual(["LWH", "WLH"]);
  });

  it("maps any legacy sideways allowance to all six orientations", () => {
    expect(isUprightOnlyOrientationPolicy(["LHW"])).toBe(false);
    expect(orientationsForUprightPolicy(false)).toEqual([
      "LWH", "WLH", "LHW", "HLW", "WHL", "HWL",
    ]);
  });

  it("normalizes legacy projects without mutating the source", () => {
    const source = project(["LWH"]);
    const normalized = normalizeProjectOrientationPolicies(source);

    expect(normalized).not.toBe(source);
    expect(normalized.cargoes[0]?.allowedOrientations).toEqual(["LWH", "WLH"]);
    expect(source.cargoes[0]?.allowedOrientations).toEqual(["LWH"]);
  });
});
