import { measureClearances } from "../domain/measured-clearance";
import { describe, expect, it } from "vitest";
import demoJson from "../../docs/demos/2026-10-28/05-local-recessed-floor.json";
import type { Project } from "../domain/model";
import { canEditInTopView, layoutTopGapLabels, mergeCargoClearances } from "./top-view";
import { resolveSupportSnapPosition } from "./project-scene";

const project = demoJson as Project;
describe("top view floor editing", () => {
  it("permits ordinary/recessed floor and staging, but not elevated cargo or its base", () => {
    expect(canEditInTopView(project, "container-A", "cargo-01")).toBe(true);
    expect(canEditInTopView(project, "container-A", "cargo-03")).toBe(true);
    const stacked = { ...project, placements: project.placements.map(p => p.cargoId === "cargo-03" ? { ...p, positionMm: { xMm: 4100, yMm: 150, zMm: 1600 } } : p) };
    expect(canEditInTopView(stacked, "container-A", "cargo-03")).toBe(false);
    expect(canEditInTopView(stacked, "container-A", "cargo-01")).toBe(false);
    expect(canEditInTopView({ ...project, placements: [] }, "container-A", "cargo-03")).toBe(true);
  });
  it("settles on the destination floor, rejects step crossing and never climbs cargo", () => {
    const p = { ...project, placements: project.placements.filter(p => p.cargoId === "cargo-03") };
    const resolve = (xMm: number) => resolveSupportSnapPosition(p, "container-A", "cargo-03", "LWH", { xMm, yMm: 150, zMm: -400 }, ["cargo-03"], false, { surfaceTarget: { kind: "floor" } });
    expect(resolve(2200)?.positionMm.zMm).toBe(-400);
    expect(resolve(4100)?.positionMm.zMm).toBe(0);
    expect(resolve(1900)?.disposition).toBe("invalid-floor");
    const overlapping = resolveSupportSnapPosition(project, "container-A", "cargo-03", "LWH", { xMm: 4100, yMm: 150, zMm: -400 }, ["cargo-03"], false, { surfaceTarget: { kind: "floor" } });
    expect(overlapping?.positionMm.zMm).toBe(0);
    expect(overlapping?.disposition).toBe("invalid-overlap");
  });
  it("offsets contact labels without changing measured endpoints and separates labels", () => {
    const lines = ["x-", "x+", "y-", "y+"].map(direction => ({ x1: 200, x2: 200, y1: 200, y2: 200, label: "0", direction }));
    const labels = layoutTopGapLabels(lines, 600, 500);
    for (const label of labels) {
      expect(label.x1).toBe(200); expect(label.y1).toBe(200);
      expect(label.labelX !== 200 || label.labelY !== 200).toBe(true);
    }
    for (const [i, a] of labels.entries()) for (const b of labels.slice(i + 1)) {
      expect(Math.abs(a.labelX - b.labelX) >= a.halfWidth + b.halfWidth || Math.abs(a.labelY - b.labelY) >= 24).toBe(true);
    }
  });
});


describe("all cargo clearance segments", () => {
  it("preserves all four directions per cargo while merging reciprocal segments", () => {
    const measurements = project.placements.filter(p => p.containerId === "container-A").map(p => ({ cargoId: p.cargoId, measurement: measureClearances(project, "container-A", p.cargoId) }));
    const merged = mergeCargoClearances(measurements);
    expect(merged.length).toBeLessThan(20);
    for (const item of measurements) {
      for (const direction of ["x-", "x+", "y-", "y+"]) {
        expect(merged.filter(g => g.sources.includes(`${item.cargoId}:${direction}`))).toHaveLength(1);
      }
    }
    const shared = merged.find(g => g.sources.includes("cargo-03:y+"));
    expect(shared?.sources).toContain("cargo-04:y-");
    expect(shared?.gap.distanceMm).toBe(200);
  });
});
