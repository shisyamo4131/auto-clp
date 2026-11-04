import type { Container, Project } from "./model";
import { placementBounds, type PlacementBoundsMm } from "./geometry";

/** A footprint touching the edge is contained; only positive overlap crosses it. */
export function floorRegion(container: Container, bounds: PlacementBoundsMm): "normal" | "recessed" | "crossing" {
  const floor = container.recessedFloorMm;
  if (floor === undefined) return "normal";
  const overlaps = bounds.min.xMm < floor.xMm + floor.lengthMm &&
    bounds.max.xMm > floor.xMm && bounds.min.yMm < floor.yMm + floor.widthMm &&
    bounds.max.yMm > floor.yMm;
  if (!overlaps) return "normal";
  return bounds.min.xMm >= floor.xMm && bounds.max.xMm <= floor.xMm + floor.lengthMm &&
    bounds.min.yMm >= floor.yMm && bounds.max.yMm <= floor.yMm + floor.widthMm
    ? "recessed" : "crossing";
}

export function floorHeightMm(container: Container, bounds: PlacementBoundsMm): number {
  return floorRegion(container, bounds) === "recessed" ? -container.recessedFloorMm!.depthMm : 0;
}

export function validRecessedFloor(container: Container): boolean {
  const f = container.recessedFloorMm;
  return f === undefined || (
    [f.xMm, f.yMm, f.lengthMm, f.widthMm, f.depthMm].every(Number.isSafeInteger) &&
    f.xMm >= 0 && f.yMm >= 0 && f.lengthMm > 0 && f.widthMm > 0 &&
    f.depthMm > 0 && f.depthMm <= 100_000 &&
    f.xMm + f.lengthMm <= container.internalDimensionsMm.lengthMm &&
    f.yMm + f.widthMm <= container.internalDimensionsMm.widthMm
  );
}

/** Hard failures specific to the new floor, separate from legacy repairable diagnostics. */
export function recessedPlacementIssues(project: Project): readonly { code: string; path: string }[] {
  return project.placements.flatMap((placement, index) => {
    const container = project.containers.find((c) => c.id === placement.containerId);
    const cargo = project.cargoes.find((c) => c.id === placement.cargoId);
    if (container?.recessedFloorMm === undefined || cargo === undefined) return [];
    const bounds = placementBounds(cargo, placement);
    const region = floorRegion(container, bounds);
    const code = region === "crossing" ? "floor.crossing" :
      bounds.min.zMm < floorHeightMm(container, bounds) ? "floor.penetration" : undefined;
    return code === undefined ? [] : [{ code, path: `/placements/${index}` }];
  });
}
