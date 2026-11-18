import { hasPositiveVolumeOverlap, placementBounds } from "./geometry";
import type { Container, Placement, PositionMm, Project } from "./model";

export type ClearanceDirection = "x-" | "x+" | "y-" | "y+";
export const CLEARANCE_DIRECTIONS: readonly ClearanceDirection[] = ["x-", "x+", "y-", "y+"];
export const CLEARANCE_DIRECTION_NAMES: Record<ClearanceDirection, string> = { "x-": "背面側", "x+": "奥側", "y-": "右側", "y+": "左側" };
export interface MeasuredGap {
  readonly direction: ClearanceDirection;
  readonly targetId: string;
  readonly targetKind: "cargo" | "wall" | "step";
  readonly targetLabel: string;
  readonly distanceMm: number;
  readonly start: PositionMm;
  readonly end: PositionMm;
}
export interface ClearanceMeasurement {
  readonly status: "available" | "outside" | "overlap" | "unavailable";
  readonly gaps: readonly MeasuredGap[];
  readonly representatives: readonly MeasuredGap[];
}
type Bounds = ReturnType<typeof placementBounds>;
interface Face { direction: ClearanceDirection; coordinate: number; low: number; high: number; bottom: number; top: number; kind: MeasuredGap["targetKind"]; id: string; label: string }
function structureFaces(container: Container): Face[] {
  const { lengthMm: l, widthMm: w, heightMm: h } = container.internalDimensionsMm;
  const r = container.recessedFloorMm;
  const bottom = -(r?.depthMm ?? 0);
  const faces: Face[] = [
    { direction: "x-", coordinate: 0, low: 0, high: w, bottom, top: h, kind: "wall", id: "x-", label: "背面境界" },
    { direction: "x+", coordinate: l, low: 0, high: w, bottom, top: h, kind: "wall", id: "x+", label: "奥壁" },
    { direction: "y-", coordinate: 0, low: 0, high: l, bottom, top: h, kind: "wall", id: "y-", label: "右壁" },
    { direction: "y+", coordinate: w, low: 0, high: l, bottom, top: h, kind: "wall", id: "y+", label: "左壁" },
  ];
  if (r) {
    const step = (direction: ClearanceDirection, coordinate: number, low: number, high: number) => faces.push({ direction, coordinate, low, high, bottom: -r.depthMm, top: 0, kind: "step", id: `step-${direction}`, label: `段差面（${CLEARANCE_DIRECTION_NAMES[direction]}）` });
    if (r.xMm > 0) step("x-", r.xMm, r.yMm, r.yMm + r.widthMm);
    if (r.xMm + r.lengthMm < l) step("x+", r.xMm + r.lengthMm, r.yMm, r.yMm + r.widthMm);
    if (r.yMm > 0) step("y-", r.yMm, r.xMm, r.xMm + r.lengthMm);
    if (r.yMm + r.widthMm < w) step("y+", r.yMm + r.widthMm, r.xMm, r.xMm + r.lengthMm);
  }
  return faces;
}
function gapToFace(bounds: Bounds, face: Face): MeasuredGap | undefined {
  const x = face.direction[0] === "x";
  const axis = x ? "xMm" : "yMm";
  const cross = x ? "yMm" : "xMm";
  const low = Math.max(bounds.min[cross], face.low), high = Math.min(bounds.max[cross], face.high);
  const bottom = Math.max(bounds.min.zMm, face.bottom), top = Math.min(bounds.max.zMm, face.top);
  if (low >= high || bottom >= top) return undefined;
  const positive = face.direction[1] === "+";
  const coordinate = positive ? bounds.max[axis] : bounds.min[axis];
  const distanceMm = positive ? face.coordinate - coordinate : coordinate - face.coordinate;
  if (distanceMm < 0 || !Number.isSafeInteger(distanceMm)) return undefined;
  const start = { xMm: 0, yMm: 0, zMm: (bottom + top) / 2, [axis]: coordinate, [cross]: (low + high) / 2 };
  return { direction: face.direction, targetId: face.id, targetKind: face.kind, targetLabel: face.label, distanceMm, start, end: { ...start, [axis]: face.coordinate } };
}
/** Measures canonical integer-mm faces, never rendered mesh transforms. */
export function measureClearances(project: Project, containerId: string, cargoId: string, placements: readonly Placement[] = project.placements): ClearanceMeasurement {
  const result = (status: ClearanceMeasurement["status"]): ClearanceMeasurement => ({ status, gaps: [], representatives: [] });
  const container = project.containers.find(c => c.id === containerId);
  const definitions = new Map(project.cargoes.map((c, index) => [c.id, { cargo: c, number: c.cargoNo ?? index + 1 }]));
  const cargo = definitions.get(cargoId)?.cargo;
  const placement = placements.find(p => p.cargoId === cargoId && p.containerId === containerId);
  if (!container || !cargo || !placement) return result("unavailable");
  const bounds = placementBounds(cargo, placement);
  if (![...Object.values(bounds.min), ...Object.values(bounds.max)].every(Number.isSafeInteger)) return result("unavailable");
  if (bounds.min.xMm < 0 || bounds.min.yMm < 0 || bounds.max.xMm > container.internalDimensionsMm.lengthMm || bounds.max.yMm > container.internalDimensionsMm.widthMm) return result("outside");
  const faces = structureFaces(container);
  for (const other of placements) {
    if (other.cargoId === cargoId || other.containerId !== containerId) continue;
    const entry = definitions.get(other.cargoId);
    const definition = entry?.cargo;
    if (!definition) return result("unavailable");
    const b = placementBounds(definition, other);
    if (hasPositiveVolumeOverlap(bounds, b)) return result("overlap");
    const common = { bottom: b.min.zMm, top: b.max.zMm, kind: "cargo" as const, id: definition.id, label: `No.${entry!.number}` };
    faces.push(
      { ...common, direction: "x-", coordinate: b.max.xMm, low: b.min.yMm, high: b.max.yMm },
      { ...common, direction: "x+", coordinate: b.min.xMm, low: b.min.yMm, high: b.max.yMm },
      { ...common, direction: "y-", coordinate: b.max.yMm, low: b.min.xMm, high: b.max.xMm },
      { ...common, direction: "y+", coordinate: b.min.yMm, low: b.min.xMm, high: b.max.xMm },
    );
  }
  const gaps = faces.flatMap(f => { const gap = gapToFace(bounds, f); return gap ? [gap] : []; }).sort((a, b) => a.distanceMm - b.distanceMm || (a.targetKind + a.targetId).localeCompare(b.targetKind + b.targetId, "en"));
  return { status: "available", gaps, representatives: CLEARANCE_DIRECTIONS.flatMap(d => { const first = gaps.find(g => g.direction === d); return first ? [first] : []; }) };
}
