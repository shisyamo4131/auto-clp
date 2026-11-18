import { createClearancePlan } from "../application/clearance-plan";
import type { Project } from "../domain/model";
import type { LoadingReportImage, LoadingReportImageCaptureResult } from "./loading-report-images";

export function appendClearancePlan(result: LoadingReportImageCaptureResult, project: Project, containerId: string): LoadingReportImageCaptureResult {
  if (!result.ok || project.schemaVersion !== "0.3.0") return result;
  try {
    const plan = createClearancePlan(project, containerId);
    // Never silently crop dimensions or replace the requested image with a detail page.
    if (plan.crowded) return { ok: false, code: "report-image.layout-crowded" };
    const canvas = document.createElement("canvas");
    canvas.width = Math.ceil(plan.width * 3); canvas.height = Math.ceil(plan.height * 3);
    const ctx = canvas.getContext("2d");
    if (!ctx) throw new Error("Canvas unavailable");
    ctx.scale(3, 3); ctx.fillStyle = "white"; ctx.fillRect(0, 0, plan.width, plan.height);
    const y = (value: number) => plan.height - value;
    for (const r of plan.rects) {
      ctx.fillStyle = "#e0f2f0"; ctx.strokeStyle = "#216060"; ctx.lineWidth = 0.7;
      ctx.fillRect(r.x, y(r.y + r.height), r.width, r.height); ctx.strokeRect(r.x, y(r.y + r.height), r.width, r.height);
    }
    for (const l of plan.lines) {
      ctx.strokeStyle = l.dimension ? "#315c96" : l.dashed ? "#aa6917" : "#31434d";
      ctx.lineWidth = l.dimension ? 0.7 : 0.45; ctx.setLineDash(l.dashed ? [3, 2] : []);
      ctx.beginPath(); ctx.moveTo(l.x1, y(l.y1)); ctx.lineTo(l.x2, y(l.y2)); ctx.stroke();
    }
    ctx.setLineDash([]);
    for (const t of plan.texts) {
      ctx.save(); ctx.translate(t.x, y(t.y)); if (t.rotate) ctx.rotate(-Math.PI / 2);
      ctx.font = `${t.size}px sans-serif`; ctx.textAlign = "center"; ctx.textBaseline = "bottom";
      const width = ctx.measureText(t.text).width;
      ctx.fillStyle = "white"; ctx.fillRect(-width / 2 - 1, -t.size - 1, width + 2, t.size + 2);
      ctx.fillStyle = "#18343f"; ctx.fillText(t.text, 0, 0); ctx.restore();
    }
    const image: LoadingReportImage = { kind: "top", title: "上面図・配置イメージ", width: canvas.width, height: canvas.height, labelCount: plan.rects.length, dataUrl: canvas.toDataURL("image/png") };
    return { ok: true, images: [image, ...result.images] };
  } catch { return { ok: false, code: "report-image.capture-failed" }; }
}
