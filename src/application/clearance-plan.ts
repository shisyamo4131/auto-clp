import { placementBounds } from "../domain/geometry";
import { CLEARANCE_DIRECTIONS, measureClearances, type MeasuredGap } from "../domain/measured-clearance";
import type { Project } from "../domain/model";

export interface PlanLine { x1: number; y1: number; x2: number; y2: number; dashed?: boolean; dimension?: boolean }
export interface PlanText { x: number; y: number; text: string; size: number; rotate?: boolean }
export interface PlanRect { x: number; y: number; width: number; height: number; cargoNo: number }
export interface ClearancePlan { lines: PlanLine[]; texts: PlanText[]; rects: PlanRect[]; width: number; height: number; crowded: boolean }

/** Orthographic, paper-point geometry shared by canvas preview and the PDF image. */
export function createClearancePlan(project: Project, containerId: string): ClearancePlan {
  const container = project.containers.find(c => c.id === containerId);
  if (!container) throw new Error("Container missing");
  const plan: ClearancePlan = { lines: [], texts: [], rects: [], width: 841.89, height: 595.28, crowded: false };
  const l = container.internalDimensionsMm.lengthMm, w = container.internalDimensionsMm.widthMm;
  const scale = Math.min(500 / l, 180 / w);
  const ox = (plan.width - l * scale) / 2, oy = 280 - w * scale / 2;
  const px = (x: number) => ox + x * scale, py = (y: number) => oy + y * scale;
  const line = (x1: number, y1: number, x2: number, y2: number, dashed = false, dimension = false) => plan.lines.push({ x1, y1, x2, y2, dashed, dimension });
  const text = (x: number, y: number, value: string, size = 8, rotate = false) => plan.texts.push({ x, y, text: value, size, rotate });
  const outline = (x: number, y: number, width: number, height: number, dashed = false) => {
    line(px(x), py(y), px(x + width), py(y), dashed);
    line(px(x + width), py(y), px(x + width), py(y + height), dashed);
    line(px(x + width), py(y + height), px(x), py(y + height), dashed);
    line(px(x), py(y + height), px(x), py(y), dashed);
  };
  text(plan.width / 2, 560, "上面図・配置イメージ / 単位 mm", 14);
  const heading = `${project.name} / ${container.name ?? container.id}`;
  const headingLines = heading.match(/.{1,68}/gu) ?? [heading];
  if (headingLines.length > 2) plan.crowded = true;
  headingLines.forEach((part, index) => text(plan.width / 2, 543 - index * 11, part, 9));
  text(plan.width / 2, 522, `荷室内寸 ${l} × ${w} / 背面=左・奥=右・左側=上・右側=下`, 9);
  text(plan.width / 2, 48, "寸法ラベル：積荷No→相手Noまたは壁 / 実間隔。壁までの値は途中の積荷を含む。", 8);
  text(plan.width / 2, 35, "寸法は記載値を参照。対向する高さが重なる面を測定。搬入経路・安全性を保証しません。", 8);
  outline(0, 0, l, w);
  const r = container.recessedFloorMm;
  if (r) text(plan.width / 2, 505, `段落ち X=${r.xMm} Y=${r.yMm} / ${r.lengthMm} × ${r.widthMm} / 深さ ${r.depthMm}`, 9);
  const placed = project.placements.filter(p => p.containerId === containerId);
  const dimensions: { sourceNo: number; gap: MeasuredGap }[] = [];
  const seen = new Set<string>();
  for (const p of placed) {
    const cargo = project.cargoes.find(c => c.id === p.cargoId)!;
    const b = placementBounds(cargo, p), no = cargo.cargoNo ?? project.cargoes.indexOf(cargo) + 1;
    plan.rects.push({ x: px(b.min.xMm), y: py(b.min.yMm), width: b.dimensions.xMm * scale, height: b.dimensions.yMm * scale, cargoNo: no });
    text(px((b.min.xMm + b.max.xMm) / 2), py((b.min.yMm + b.max.yMm) / 2), `No.${no}`, 10);
    const m = measureClearances(project, containerId, cargo.id);
    if (m.status !== "available") text(px(b.min.xMm), py(b.min.yMm) + 10, m.status === "overlap" ? "重なり" : "測定対象外", 8);
    const selected = [...m.representatives, ...m.gaps.filter(g => g.targetKind === "wall")];
    for (const g of selected) {
      const key = g.targetKind === "cargo" ? [cargo.id, g.targetId].sort().join("/") + g.direction[0] : cargo.id + g.targetKind + g.targetId;
      if (seen.has(key)) continue;
      seen.add(key); dimensions.push({ sourceNo: no, gap: g });
    }
  }
  // Draw the recess boundary after cargo fills so it remains legible under cargo.
  if (r) outline(r.xMm, r.yMm, r.lengthMm, r.widthMm, true);
  let horizontalMin = ox, horizontalMax = ox + l * scale;
  for (const direction of CLEARANCE_DIRECTIONS) {
    const x = direction[0] === "x", positive = direction[1] === "+";
    const lanes: Array<Array<[number, number]>> = [];
    const grouped = new Map<string, { gap: MeasuredGap; gaps: MeasuredGap[]; labels: string[] }>();
    for (const { sourceNo, gap } of dimensions.filter(d => d.gap.direction === direction)) {
      const axis = x ? "xMm" : "yMm";
      const key = [gap.start[axis], gap.end[axis], gap.targetKind].join("/");
      const target = gap.targetKind === "cargo" ? gap.targetLabel.replace("No.", "") : gap.targetKind === "step" ? "段差" : "壁";
      const label = `${sourceNo}→${target}`;
      const group = grouped.get(key);
      if (group) { group.labels.push(label); group.gaps.push(gap); } else grouped.set(key, { gap, gaps: [gap], labels: [label] });
    }
    const entries = [...grouped.values()].sort((a, b) => a.gap.distanceMm - b.gap.distanceMm);
    for (const { gap: g, gaps, labels } of entries) {
      const a = x ? px(g.start.xMm) : py(g.start.yMm), b = x ? px(g.end.xMm) : py(g.end.yMm);
      const targetLabel = g.targetKind === "wall" ? "壁" : "段差";
      const label = g.targetKind === "cargo" ? `${labels.join(" / ")} ${g.distanceMm}` : `${labels.map(value => value.split("→")[0]).join(",")}→${targetLabel} ${g.distanceMm}`;
      const halfLabel = Array.from(label).reduce((width, char) => width + (char.charCodeAt(0) < 128 ? 4.5 : 8), 0) / 2;
      const center = (a + b) / 2;
      const range: [number, number] = [Math.min(a, b, center - halfLabel) - 3, Math.max(a, b, center + halfLabel) + 3];
      let lane = lanes.findIndex(items => items.every(([lo, hi]) => range[1] < lo || range[0] > hi));
      if (lane < 0) { lane = lanes.length; lanes.push([]); }
      lanes[lane]!.push(range);
      if (x) { horizontalMin = Math.min(horizontalMin, center - halfLabel); horizontalMax = Math.max(horizontalMax, center + halfLabel); }
      const baseOffset = x ? 12 : Math.max(20, positive ? horizontalMax - (ox + l * scale) + 20 : ox - horizontalMin + 20);
      const offset = baseOffset + lane * 12;
      const edge = x ? (positive ? oy + w * scale + offset : oy - offset) : (positive ? ox + l * scale + offset : ox - offset);
      if (x ? edge < 70 || edge > 485 : edge < 32 || edge > 810) plan.crowded = true;
      if (x) {
        for (const member of gaps) { line(a, py(member.start.yMm), a, edge, true); line(b, py(member.end.yMm), b, edge, true); }
        line(a, edge, b, edge, false, true); line(a, edge - 3, a, edge + 3); line(b, edge - 3, b, edge + 3);
        text(center, edge + 3, label);
      } else {
        for (const member of gaps) { line(px(member.start.xMm), a, edge, a, true); line(px(member.end.xMm), b, edge, b, true); }
        line(edge, a, edge, b, false, true); line(edge - 3, a, edge + 3, a); line(edge - 3, b, edge + 3, b);
        text(edge - 3, center, label, 8, true);
      }
    }
  }
  return plan;
}
