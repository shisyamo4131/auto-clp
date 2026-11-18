import type { ClearanceMeasurement, MeasuredGap } from "../domain/measured-clearance";
import type { Project } from "../domain/model";
import { placementBounds, singleSupportDescendantCargoIds } from "../domain/geometry";
import { floorHeightMm } from "../domain/recessed-floor";

/** Top view edits floor cargo only; existing elevated/group placements stay in 3D. */
export function canEditInTopView(project: Project, containerId: string, cargoId: string): boolean {
  const placement = project.placements.find(p => p.cargoId === cargoId);
  if (placement === undefined) return true;
  const container = project.containers.find(c => c.id === containerId);
  const cargo = project.cargoes.find(c => c.id === cargoId);
  if (!container || !cargo || placement.containerId !== containerId) return false;
  const bounds = placementBounds(cargo, placement);
  return placement.positionMm.zMm === floorHeightMm(container, bounds) &&
    singleSupportDescendantCargoIds(project, containerId, cargoId).length === 0 &&
    !project.placements.filter(p => p.containerId === containerId).flatMap(p => {
      const c = project.cargoes.find(c => c.id === p.cargoId);
      return c ? [{ cargo: c, bounds: placementBounds(c, p) }] : [];
    }).some(other => other.cargo.id !== cargoId &&
      other.bounds.min.zMm === bounds.max.zMm &&
      other.bounds.min.xMm < bounds.max.xMm && other.bounds.max.xMm > bounds.min.xMm &&
      other.bounds.min.yMm < bounds.max.yMm && other.bounds.max.yMm > bounds.min.yMm);
}

export interface TopGapLine {
  readonly key?: string;
  readonly sources?: readonly string[];
  readonly x1: number; readonly y1: number; readonly x2: number; readonly y2: number;
  readonly label: string;
  readonly direction: string;
}

/** Keep narrow-gap labels separated while retaining a leader to the measured segment. */
export function layoutTopGapLabels(lines: readonly TopGapLine[], width: number, height: number) {
  const occupied: { x: number; y: number; half: number }[] = [];
  return lines.map(line => {
    const half = Math.max(18, line.label.length * 4 + 7);
    const mx = (line.x1 + line.x2) / 2, my = (line.y1 + line.y2) / 2;
    const horizontal = line.direction.startsWith("x");
    const narrow = Math.hypot(line.x2 - line.x1, line.y2 - line.y1) < (horizontal ? half * 2 + 12 : 32);
    let x = mx + (narrow && !horizontal ? 34 : 0);
    let y = my + (narrow && horizontal ? -24 : 0);
    x = Math.max(half + 8, Math.min(width - half - 8, x));
    y = Math.max(70, Math.min(height - 100, y));
    for (let attempt = 0; attempt < 12 && occupied.some(p => Math.abs(p.x - x) < p.half + half + 4 && Math.abs(p.y - y) < 24); attempt++) {
      y += 26;
      if (y > height - 100) { y = 70; x = Math.min(width - half - 8, x + half * 2 + 8); }
    }
    occupied.push({ x, y, half });
    return { ...line, labelX: x, labelY: y, halfWidth: half };
  });
}


export interface CargoClearance {
  readonly cargoId: string;
  readonly measurement: ClearanceMeasurement;
}

/** Merge the two directions of the same physical cargo-to-cargo segment only. */
export function mergeCargoClearances(measurements: readonly CargoClearance[]) {
  const merged = new Map<string, { key: string; gap: MeasuredGap; sources: string[] }>();
  for (const { cargoId, measurement } of measurements) {
    for (const gap of measurement.representatives) {
      const source = `${encodeURIComponent(cargoId)}:${gap.direction}`;
      const endpoints = [gap.start, gap.end].map(p => [p.xMm, p.yMm, p.zMm].join(",")).sort();
      const key = gap.targetKind === "cargo"
        ? JSON.stringify([[cargoId, gap.targetId].sort(), endpoints]) : source;
      const existing = merged.get(key);
      if (existing) existing.sources.push(source);
      else merged.set(key, { key, gap, sources: [source] });
    }
  }
  return [...merged.values()];
}
