import { prepareCargoCsvReplacement } from "./cargo-csv-import";
import { createProjectHistory, commitProjectHistory, undoProjectHistory } from "./project-history";
import { describe, expect, it } from "vitest";
import type { Project } from "../domain/model";
import { floorHeightMm, floorRegion, validRecessedFloor } from "../domain/recessed-floor";
import { placementBounds } from "../domain/geometry";
import { validatePlacementSet } from "../domain/validation";
import { addPlacement, saveContainer, updatePlacement, type ContainerDraft } from "../application/project-command";
import { readProjectJson, serializeProjectJson } from "../persistence/project-json";
import { resolveSupportSnapPosition, projectContainerToScene, resolveKeyboardNudgePosition } from "../scene/project-scene";

function fixture(): Project {
  return {
    schemaVersion: "0.2.0", projectId: "recess-test", name: "Synthetic", nextCargoNo: 2,
    clearancesMm: { xMm: 0, yMm: 0, zMm: 0 },
    cargoes: [{ id: "c", cargoNo: 1, name: "Tall", dimensionsMm: { lengthMm: 1000, widthMm: 1000, heightMm: 2600 }, massGrams: 1000, canSupportCargo: false, allowedOrientations: ["LWH"] }],
    containers: [{ id: "box", name: "Box", internalDimensionsMm: { lengthMm: 6000, widthMm: 2400, heightMm: 2400 }, openingMm: { widthMm: 2400, heightMm: 2400 }, payloadCapacityGrams: 10000, recessedFloorMm: { xMm: 2000, yMm: 400, lengthMm: 2000, widthMm: 1600, depthMm: 300 } }],
    placements: [{ cargoId: "c", containerId: "box", positionMm: { xMm: 2500, yMm: 700, zMm: -300 }, orientation: "LWH" }],
  };
}
function bounds(xMm: number, yMm = 700) {
  const p = fixture();
  return placementBounds(p.cargoes[0]!, { orientation: "LWH", positionMm: { xMm, yMm, zMm: -300 } });
}
const draft: ContainerDraft = { name: "Box", internalLengthMm: "6000", internalWidthMm: "2400", internalHeightMm: "2400", openingWidthMm: "2400", openingHeightMm: "2400", payloadCapacityKg: "10", recessedFloor: { xMm: "2000", yMm: "400", lengthMm: "2000", widthMm: "1600", depthMm: "300" } };

describe("recessed floor acceptance", () => {
  it.each([[2000, "recessed"], [3000, "recessed"], [1999, "crossing"], [3001, "crossing"], [1000, "normal"]] as const)("classifies X=%i as %s", (x, expected) => {
    expect(floorRegion(fixture().containers[0]!, bounds(x))).toBe(expected);
  });
  it.each([400, 1000])("accepts a Y boundary at %i", (y) => expect(floorRegion(fixture().containers[0]!, bounds(2500, y))).toBe("recessed"));
  it.each([399, 1001])("rejects Y crossing at %i", (y) => expect(floorRegion(fixture().containers[0]!, bounds(2500, y))).toBe("crossing"));
  it("supports tall cargo at negative Z without moving the ceiling", () => {
    const p = fixture();
    expect(floorHeightMm(p.containers[0]!, bounds(2500))).toBe(-300);
    expect(validatePlacementSet(p, "box")).toMatchObject({ status: "valid" });
    const high = { ...p, placements: [{ ...p.placements[0]!, positionMm: { xMm: 0, yMm: 0, zMm: 0 } }] };
    expect(validatePlacementSet(high, "box")).toMatchObject({ status: "invalid" });
  });
  it.each([0, -1, 0.5, 100001])("rejects invalid depth %i", (depthMm) => {
    const c = fixture().containers[0]!;
    expect(validRecessedFloor({ ...c, recessedFloorMm: { ...c.recessedFloorMm!, depthMm } })).toBe(false);
  });
  it("rejects a crossing move atomically", () => {
    const p = fixture();
    const result = updatePlacement(p, "c", "box", { xMm: "1999", yMm: "700", zMm: "-300", orientation: "LWH" });
    expect(result.ok).toBe(false);
    expect(result.project).toBe(p);
  });
  it("rejects a depth change and removal while occupied", () => {
    const p = fixture();
    expect(saveContainer(p, { ...draft, recessedFloor: { ...draft.recessedFloor!, depthMm: "400" } }, "box").ok).toBe(false);
    expect(saveContainer(p, { ...draft, recessedFloor: undefined }, "box").ok).toBe(false);
  });
  it("promotes a flat legacy project without changing original", () => {
    const p = fixture();
    const cargo = { ...p.cargoes[0]! };
    delete cargo.cargoNo;
    const container = { ...p.containers[0]! };
    delete container.recessedFloorMm;
    const legacy: Project = { schemaVersion: "0.1.0", projectId: "old", name: "Old", clearancesMm: p.clearancesMm, cargoes: [cargo], containers: [container], placements: [] };
    const result = saveContainer(legacy, draft, "box");
    expect(result.ok).toBe(true);
    expect(result.project.schemaVersion).toBe("0.2.0");
    expect(result.project.cargoes[0]?.cargoNo).toBe(1);
    expect(legacy.schemaVersion).toBe("0.1.0");
    expect(legacy.containers[0]?.recessedFloorMm).toBeUndefined();
  });
  it("round trips new floor and fixed number, rejects corrupt crossing", async () => {
    const p = fixture();
    const encoded = serializeProjectJson(p);
    expect(encoded.ok).toBe(true);
    if (!encoded.ok) return;
    expect(await readProjectJson({ sizeBytes: encoded.json.length, readText: async () => encoded.json })).toEqual({ ok: true, project: p });
    const bad = JSON.stringify({ ...p, placements: [{ ...p.placements[0]!, positionMm: { xMm: 1999, yMm: 700, zMm: -300 } }] });
    expect((await readProjectJson({ sizeBytes: bad.length, readText: async () => bad })).ok).toBe(false);
  });
  it("snaps to low floor, previews crossing, and blocks keyboard crossing", () => {
    const p = fixture();
    expect(resolveSupportSnapPosition(p, "box", "c", "LWH", { xMm: 2500, yMm: 700, zMm: 0 })?.positionMm.zMm).toBe(-300);
    expect(resolveSupportSnapPosition(p, "box", "c", "LWH", { xMm: 1999, yMm: 700, zMm: 0 }, ["c"], false)?.disposition).toBe("invalid-floor");
    expect(resolveKeyboardNudgePosition(p, "box", "c", { xMm: -501, yMm: 0 })?.disposition).toBe("blocked");
  });
  it("accepts a new low-floor placement and projects its real negative height", () => {
    const p = fixture();
    const result = addPlacement({ ...p, placements: [] }, "c", "box", { xMm: "2500", yMm: "700", zMm: "-300", orientation: "LWH" });
    expect(result.ok).toBe(true);
    const scene = projectContainerToScene(result.project, "box");
    expect(scene.ok).toBe(true);
    if (scene.ok) expect(scene.projection.container.recessedFloor?.center.y).toBe(-0.15);
  });
});

it("keeps numbering high water when undo crosses the legacy promotion", () => {
 const p = fixture();
 const old: Project = { ...p, schemaVersion: "0.1.0", nextCargoNo: undefined, cargoes: p.cargoes.map((cargo) => ({ ...cargo, cargoNo: undefined })), containers: [], placements: [] };
 const promoted = { ...p, nextCargoNo: 8 };
 const commit = commitProjectHistory(createProjectHistory(old), { baseProject: old, nextProject: promoted, action: "container.add" });
 expect(commit.ok).toBe(true);
 const undone = undoProjectHistory(commit.state);
 expect(undone.state.present.schemaVersion).toBe("0.2.0");
 expect(undone.state.present.nextCargoNo).toBe(8);
 expect(undone.state.present.cargoes[0]?.cargoNo).toBe(1);
});

it("assigns new CSV numbers even when replacement data is identical", () => {
 const p = { ...fixture(), placements: [] };
 const result = prepareCargoCsvReplacement(p, p.cargoes);
 expect(result.ok).toBe(true);
 expect(result.project.cargoes[0]?.cargoNo).toBe(2);
 expect(result.project.nextCargoNo).toBe(3);
});
