import { describe, expect, it, vi } from "vitest";
import demoJson from "../../docs/demos/2026-10-28/05-local-recessed-floor.json";
import type { Project } from "../domain/model";
import { measureClearances } from "../domain/measured-clearance";
import { validatePlacementSet } from "../domain/validation";
import { readProjectJson } from "../persistence/project-json";
import { migrateProject } from "./project-migration";
import { prepareCurrentProjectImport, serializeProjectForPersistence } from "./project-persistence";
import { createCurrentProject } from "./project-factory";
import { createClearancePlan } from "./clearance-plan";
import { createLoadingReportSnapshot } from "./loading-report";

const source = (value: unknown) => { const text = JSON.stringify(value); return { sizeBytes: new TextEncoder().encode(text).length, readText: async () => text }; };
async function demo() { const p = await readProjectJson(source(demoJson)); if (!p.ok) throw new Error("invalid fixture"); return migrateProject(p.project); }
function pair(gap = 100): Project {
  return { ...createCurrentProject(), nextCargoNo: 3, cargoes: [1, 2].map(n => ({ id: `c${n}`, cargoNo: n, name: `合成${n}`, dimensionsMm: { lengthMm: 100, widthMm: 100, heightMm: 100 }, massGrams: 1000, canSupportCargo: false, allowedOrientations: ["LWH"] })), containers: [{ id: "box", name: "合成コンテナ", internalDimensionsMm: { lengthMm: 1000, widthMm: 500, heightMm: 500 }, openingMm: { widthMm: 500, heightMm: 500 }, payloadCapacityGrams: 100000 }], placements: [1, 2].map(n => ({ cargoId: `c${n}`, containerId: "box", orientation: "LWH", positionMm: { xMm: n === 1 ? 100 : 200 + gap, yMm: 100, zMm: 0 } })) };
}
describe("clearance migration and measurement", () => {
  it("preserves the recessed demo and numbering, removing only legacy threshold data", async () => {
    const p = await demo();
    expect(p.schemaVersion).toBe("0.3.0"); expect(p).not.toHaveProperty("clearancesMm");
    expect(p.cargoes).toEqual(demoJson.cargoes); expect(p.placements).toEqual(demoJson.placements); expect(p.containers).toEqual(demoJson.containers);
    expect(migrateProject(p)).toBe(p);
    const out = serializeProjectForPersistence(p); expect(out.ok).toBe(true);
    if (out.ok) expect(await readProjectJson(source(JSON.parse(out.json)))).toEqual({ ok: true, project: p });
  });
  it("preserves a high allocation watermark and gaps", async () => {
    const old = { ...demoJson, nextCargoNo: 120 } as Project;
    const p = migrateProject(old); expect(p.nextCargoNo).toBe(120); expect(old).toHaveProperty("clearancesMm");
  });
  it("assigns stable numbers to version 0.1 without moving cargo", () => {
    const p = pair(); const old: Project = { ...p, schemaVersion: "0.1.0", clearancesMm: { xMm: 100, yMm: 50, zMm: 20 }, nextCargoNo: undefined, cargoes: p.cargoes.map(c => ({ ...c, cargoNo: undefined })) };
    const next = migrateProject(old); expect(next.cargoes.map(c => c.cargoNo)).toEqual([1, 2]); expect(next.placements).toEqual(old.placements);
  });
  it("confirms only after validation and preserves current state on cancellation", async () => {
    const current = createCurrentProject(); const confirm = vi.fn(async () => false); const preflight = vi.fn(async () => ({ ok: true as const }));
    const result = await prepareCurrentProjectImport(current, source(demoJson), preflight, confirm);
    expect(result).toEqual({ ok: true, project: current }); expect(confirm).toHaveBeenCalledWith(JSON.stringify(demoJson)); expect(preflight).toHaveBeenCalled();
    confirm.mockClear();
    expect((await prepareCurrentProjectImport(current, source({ ...demoJson, clearancesMm: { xMm: -1, yMm: 0, zMm: 0 } }), preflight, confirm)).ok).toBe(false);
    expect(confirm).not.toHaveBeenCalled();
  });
  it("never asks confirmation when preflight fails", async () => {
    const confirm = vi.fn(async () => true);
    const result = await prepareCurrentProjectImport(createCurrentProject(), source(demoJson), async () => ({ ok: false, code: "preflight.worker-runtime-failed" }), confirm);
    expect(result.ok).toBe(false); expect(confirm).not.toHaveBeenCalled();
  });
  it.each([0, 1, 100])("measures surface gap %i without doubling", gap => {
    const m = measureClearances(pair(gap), "box", "c1");
    expect(m.representatives.find(g => g.direction === "x+")).toMatchObject({ distanceMm: gap, targetId: "c2" });
    expect(m.gaps.find(g => g.direction === "x+" && g.targetKind === "wall")?.distanceMm).toBe(800);
  });
  it("distinguishes overlap from contact", () => expect(measureClearances(pair(-1), "box", "c1").status).toBe("overlap"));
  it.each(["yMm", "zMm"] as const)("excludes targets with no positive overlap along %s", axis => {
    const p = pair(); const moved = { ...p, placements: p.placements.map((v, i) => i ? { ...v, positionMm: { ...v.positionMm, [axis]: 200 } } : v) };
    expect(measureClearances(moved, "box", "c1").gaps.filter(g => g.targetKind === "cargo")).toHaveLength(0);
  });
  it("excludes other containers and clears unplaced/outside values", () => {
    const p = pair(); expect(measureClearances(p, "missing", "c1").status).toBe("unavailable");
    expect(measureClearances(p, "box", "c1", []).status).toBe("unavailable");
    expect(measureClearances(p, "box", "c1", p.placements.map(v => ({ ...v, positionMm: { ...v.positionMm, xMm: -1 } }))).status).toBe("outside");
  });
  it("measures the recessed step and retains all four wall distances", async () => {
    const p = await demo(); const cargo = p.cargoes.find(c => c.cargoNo === 3)!;
    const m = measureClearances(p, "container-A", cargo.id);
    expect(m.gaps.find(g => g.targetKind === "step" && g.direction === "x-")?.distanceMm).toBe(200);
    expect(m.gaps.filter(g => g.targetKind === "wall")).toHaveLength(4);
    expect(m.gaps.some(g => g.targetKind === "step" && g.direction.startsWith("y"))).toBe(false);
  });
  it("removes only threshold failures and retains overlap diagnostics", () => {
    const p = pair(); const v = validatePlacementSet(p, "box"); expect(v.kind === "evaluated" && v.status).toBe("valid");
    const overlap = validatePlacementSet(pair(-1), "box"); expect(overlap.kind === "evaluated" && overlap.reasons.some(r => r.code === "positive-volume-overlap")).toBe(true);
  });
  it("builds sequence-independent snapshots and a same-page drawing for both demo containers", async () => {
    const p = await demo();
    for (const c of p.containers) {
      const report = createLoadingReportSnapshot(p, c.id); expect(report.status).toBe("available");
      const plan = createClearancePlan(p, c.id); expect(plan.rects).toHaveLength(5); expect(plan.crowded).toBe(false);
      expect(plan.texts.some(t => t.text.includes("天井"))).toBe(false);
      expect(plan.texts.some(t => t.text.includes("段落ち"))).toBe(true);
    }
  });
});


describe("clearance direction and scale boundaries", () => {
  it("measures both Y directions and X back faces", () => {
    const p = pair();
    const moved = { ...p, placements: p.placements.map((v, i) => i ? { ...v, positionMm: { xMm: 100, yMm: 301, zMm: 0 } } : v) };
    expect(measureClearances(moved, "box", "c1").representatives.find(g => g.direction === "y+")).toMatchObject({ targetId: "c2", distanceMm: 101 });
    expect(measureClearances(moved, "box", "c2").representatives.find(g => g.direction === "y-")).toMatchObject({ targetId: "c1", distanceMm: 101 });
    expect(measureClearances(p, "box", "c2").representatives.find(g => g.direction === "x-")).toMatchObject({ targetId: "c1", distanceMm: 100 });
  });
  it("keeps ties deterministic after placement order changes and retains all candidates", () => {
    const p = pair();
    const triple = { ...p, nextCargoNo: 4, cargoes: [...p.cargoes, { ...p.cargoes[1]!, id: "c3", cargoNo: 3 }], placements: [...p.placements, { ...p.placements[1]!, cargoId: "c3", positionMm: { xMm: 300, yMm: 150, zMm: 0 } }] };
    const a = measureClearances(triple, "box", "c1");
    expect(a.gaps.filter(g => g.targetKind === "cargo")).toHaveLength(2);
    expect(measureClearances(triple, "box", "c1", [...triple.placements].reverse())).toEqual(a);
  });
  it("records selected-cargo calculation time at 10, 30 and 1000 cargoes", () => {
    for (const count of [10, 30, 1000]) {
      const p = pair();
      const cargoes = Array.from({ length: count }, (_, index) => ({ ...p.cargoes[0]!, id: `large-${index}`, cargoNo: index + 1 }));
      const large: Project = { ...p, nextCargoNo: count + 1, cargoes, containers: [{ ...p.containers[0]!, internalDimensionsMm: { lengthMm: 10000, widthMm: 10000, heightMm: 500 } }], placements: cargoes.map((c, i) => ({ cargoId: c.id, containerId: "box", orientation: "LWH", positionMm: { xMm: (i % 40) * 200, yMm: Math.floor(i / 40) * 200, zMm: 0 } })) };
      const start = performance.now();
      for (let n = 0; n < 50; n++) expect(measureClearances(large, "box", "large-0").representatives).toHaveLength(4);
      console.info(`clearance synthetic ${count}: ${((performance.now() - start) / 50).toFixed(3)} ms/measurement (includes assertion)`);
    }
  });
});
