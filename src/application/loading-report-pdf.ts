import fontkit from "@pdf-lib/fontkit";
import {
  PDFDocument,
  type PDFFont,
  type PDFPage,
  rgb,
} from "pdf-lib";

import type { LoadingReportSnapshot } from "./loading-report";
import type { LoadingSequencePrecedenceReason } from "../domain/loading-sequence";
import {
  loadLoadingReportFontShard,
  loadingReportFontShardForCodePoint,
} from "../platform/loading-report-font";
import type {
  LoadingReportImage,
  LoadingReportViewKind,
} from "../scene/loading-report-images";

const PORTRAIT_SIZE: [number, number] = [595.28, 841.89];
const LANDSCAPE_SIZE: [number, number] = [841.89, 595.28];
const PAGE_MARGIN = 38;
const FOOTER_HEIGHT = 22;

const EXPECTED_IMAGE_KINDS: readonly LoadingReportViewKind[] = [
  "current",
  "front",
  "rear",
  "left",
  "right",
];

const PRECEDENCE_REASON_COPY = {
  access: "直線搬入帯",
  support: "上段支持",
} satisfies Record<LoadingSequencePrecedenceReason, string>;

const LIMITATION_COPY =
  "本帳票は現在配置を基にした限定モデルによる一提案です。搬送機器、作業空間、扉厚、斜路、旋回、吊り上げ、固縛、荷崩れ、荷下ろし順、目的地順、法令適合性、実作業の安全性は評価・保証しません。";

type AvailableLoadingReportSnapshot = Extract<
  LoadingReportSnapshot,
  { readonly status: "available" }
>;

export interface LoadingReportPdfPhysicalSummary {
  readonly reasons: readonly string[];
  readonly statusLabel: string;
  readonly summary: string;
}

export interface LoadingReportPdfInput {
  readonly generatedAtIso: string;
  readonly images: readonly LoadingReportImage[];
  readonly physical: LoadingReportPdfPhysicalSummary;
  readonly snapshot: AvailableLoadingReportSnapshot;
}

export type LoadingReportPdfFailureCode =
  | "report-pdf.input-invalid"
  | "report-pdf.font-load-failed"
  | "report-pdf.unsupported-character"
  | "report-pdf.image-invalid"
  | "report-pdf.generation-failed";

export type LoadingReportPdfResult =
  | {
      readonly bytes: Uint8Array;
      readonly ok: true;
      readonly pageCount: number;
    }
  | {
      readonly code: LoadingReportPdfFailureCode;
      readonly ok: false;
    };

interface PdfGlyph {
  readonly character: string;
  readonly font: PDFFont;
  readonly width: number;
}

interface TextStyle {
  readonly color?: ReturnType<typeof rgb>;
  readonly lineHeight: number;
  readonly size: number;
}

class PdfGenerationError extends Error {
  constructor(readonly code: LoadingReportPdfFailureCode) {
    super(code);
  }
}

function gramsToKilograms(grams: number): string {
  const whole = Math.floor(grams / 1000);
  const fraction = String(grams % 1000).padStart(3, "0").replace(/0+$/, "");
  return fraction.length === 0 ? String(whole) : `${whole}.${fraction}`;
}

function imageMap(
  images: readonly LoadingReportImage[],
  expectedLabels: number,
): ReadonlyMap<LoadingReportViewKind, LoadingReportImage> | undefined {
  if (images.length !== EXPECTED_IMAGE_KINDS.length) return undefined;
  const byKind = new Map(images.map((image) => [image.kind, image]));
  if (
    byKind.size !== EXPECTED_IMAGE_KINDS.length ||
    EXPECTED_IMAGE_KINDS.some((kind) => {
      const image = byKind.get(kind);
      return (
        image === undefined ||
        image.labelCount !== expectedLabels ||
        image.width !== 1200 ||
        image.height !== 800 ||
        !image.dataUrl.startsWith("data:image/png;base64,")
      );
    })
  ) {
    return undefined;
  }
  return byKind;
}

function sequenceReferences(snapshot: AvailableLoadingReportSnapshot) {
  return new Map(
    snapshot.cargoes.map((cargo) => [cargo.cargoId, cargo.sequenceNumber]),
  );
}

function dependencyText(
  snapshot: AvailableLoadingReportSnapshot,
  cargoId: string,
): string {
  const cargo = snapshot.cargoes.find((candidate) => candidate.cargoId === cargoId)!;
  if (cargo.dependencies.length === 0) return "先行条件: なし";
  const sequenceByCargoId = sequenceReferences(snapshot);
  return `先行条件: ${cargo.dependencies
    .map((dependency) => {
      const number = sequenceByCargoId.get(dependency.cargoId);
      const reasons = dependency.reasons
        .map((reason) => PRECEDENCE_REASON_COPY[reason])
        .join("・");
      return `No.${number ?? "?"}（${reasons}）`;
    })
    .join("、")}`;
}

function warningText(
  snapshot: AvailableLoadingReportSnapshot,
  warning: AvailableLoadingReportSnapshot["warnings"][number],
): string {
  const sequenceByCargoId = sequenceReferences(snapshot);
  const target = sequenceByCargoId.get(warning.targetCargoId) ?? "?";
  const supports = warning.relatedCargoIds
    .map((cargoId) => `No.${sequenceByCargoId.get(cargoId) ?? "?"}`)
    .join("、");
  return `No.${target}は複数の接触支持物（${supports}）を使います。支持位置、剛性、張り出し、許容支持間隔を確認してください。`;
}

function allReportText(input: LoadingReportPdfInput): readonly string[] {
  const { snapshot } = input;
  return [
    "Container Loading Plan - 積込順帳票",
    "CLP",
    snapshot.projectName,
    "コンテナ",
    snapshot.containerName ?? "不明なコンテナ",
    "生成日時（UTC）",
    input.generatedAtIso,
    "積込順一覧",
    "現在配置の物理判定",
    input.physical.statusLabel,
    input.physical.summary,
    ...input.physical.reasons,
    "積込順の未確認事項",
    ...snapshot.warnings.map((warning) => warningText(snapshot, warning)),
    LIMITATION_COPY,
    ...snapshot.cargoes.flatMap((cargo) => [
      `No.${cargo.sequenceNumber} ${cargo.name}`,
      `ID: ${cargo.cargoId}`,
      `現在向き寸法: ${cargo.orientedDimensionsMm.xMm} × ${cargo.orientedDimensionsMm.yMm} × ${cargo.orientedDimensionsMm.zMm} mm   重量: ${gramsToKilograms(cargo.massGrams)} kg`,
      dependencyText(snapshot, cargo.cargoId),
    ]),
    "現在視点",
    "正面（開口側）",
    "背面",
    "左面",
    "右面",
    "ページ",
    "/",
  ];
}

async function embedRequiredFonts(
  document: PDFDocument,
  texts: readonly string[],
): Promise<ReadonlyMap<string, PDFFont>> {
  const shardIds = new Set<string>();
  for (const text of texts) {
    for (const character of text) {
      if (character === "\n" || character === "\r") continue;
      const shardId = loadingReportFontShardForCodePoint(character.codePointAt(0)!);
      if (shardId === undefined) {
        throw new PdfGenerationError("report-pdf.unsupported-character");
      }
      shardIds.add(shardId);
    }
  }

  const fonts = new Map<string, PDFFont>();
  for (const shardId of [...shardIds].sort((a, b) => Number(a) - Number(b))) {
    let bytes: Uint8Array;
    try {
      bytes = await loadLoadingReportFontShard(shardId);
    } catch {
      throw new PdfGenerationError("report-pdf.font-load-failed");
    }
    try {
      fonts.set(shardId, await document.embedFont(bytes, { subset: true }));
    } catch {
      throw new PdfGenerationError("report-pdf.font-load-failed");
    }
  }
  return fonts;
}

function glyphForCharacter(
  character: string,
  fonts: ReadonlyMap<string, PDFFont>,
  size: number,
): PdfGlyph {
  const shardId = loadingReportFontShardForCodePoint(character.codePointAt(0)!);
  const font = shardId === undefined ? undefined : fonts.get(shardId);
  if (font === undefined) {
    throw new PdfGenerationError("report-pdf.unsupported-character");
  }
  return {
    character,
    font,
    width: font.widthOfTextAtSize(character, size),
  };
}

function layoutText(
  text: string,
  fonts: ReadonlyMap<string, PDFFont>,
  maxWidth: number,
  size: number,
): readonly (readonly PdfGlyph[])[] {
  const lines: PdfGlyph[][] = [[]];
  let width = 0;
  for (const character of text) {
    if (character === "\r") continue;
    if (character === "\n") {
      lines.push([]);
      width = 0;
      continue;
    }
    const glyph = glyphForCharacter(character, fonts, size);
    const current = lines[lines.length - 1]!;
    if (current.length > 0 && width + glyph.width > maxWidth) {
      lines.push([glyph]);
      width = glyph.width;
    } else {
      current.push(glyph);
      width += glyph.width;
    }
  }
  return lines;
}

function drawGlyphLine(
  page: PDFPage,
  line: readonly PdfGlyph[],
  x: number,
  y: number,
  style: TextStyle,
): void {
  let cursor = x;
  for (const glyph of line) {
    page.drawText(glyph.character, {
      color: style.color ?? rgb(0.1, 0.16, 0.22),
      font: glyph.font,
      size: style.size,
      x: cursor,
      y,
    });
    cursor += glyph.width;
  }
}

class PortraitFlow {
  readonly pages: PDFPage[] = [];
  private page!: PDFPage;
  private y = 0;

  constructor(
    private readonly document: PDFDocument,
    private readonly fonts: ReadonlyMap<string, PDFFont>,
  ) {
    this.addPage();
  }

  private addPage(): void {
    this.page = this.document.addPage(PORTRAIT_SIZE);
    this.pages.push(this.page);
    this.y = PORTRAIT_SIZE[1] - PAGE_MARGIN;
    if (this.pages.length > 1) {
      this.write("Container Loading Plan - 積込順帳票", {
        color: rgb(0.08, 0.36, 0.4),
        lineHeight: 15,
        size: 10,
      });
      this.y -= 5;
    }
  }

  ensure(height: number): void {
    if (this.y - height < PAGE_MARGIN + FOOTER_HEIGHT) this.addPage();
  }

  gap(points: number): void {
    this.y -= points;
  }

  heading(text: string): void {
    this.ensure(28);
    this.write(text, {
      color: rgb(0.04, 0.32, 0.36),
      lineHeight: 18,
      size: 13,
    });
    this.y -= 5;
  }

  write(text: string, style: TextStyle, indent = 0): void {
    const maxWidth = PORTRAIT_SIZE[0] - PAGE_MARGIN * 2 - indent;
    for (const line of layoutText(text, this.fonts, maxWidth, style.size)) {
      this.ensure(style.lineHeight);
      drawGlyphLine(
        this.page,
        line,
        PAGE_MARGIN + indent,
        this.y - style.size,
        style,
      );
      this.y -= style.lineHeight;
    }
  }

  cargoCard(lines: readonly string[]): void {
    const styles: readonly TextStyle[] = [
      { color: rgb(0.04, 0.28, 0.32), lineHeight: 15, size: 11 },
      { lineHeight: 12, size: 8 },
      { lineHeight: 12, size: 8 },
      { lineHeight: 12, size: 8 },
    ];
    const laidOut = lines.map((line, index) => ({
      lines: layoutText(
        line,
        this.fonts,
        PORTRAIT_SIZE[0] - PAGE_MARGIN * 2 - 20,
        styles[index]!.size,
      ),
      style: styles[index]!,
    }));
    const height =
      14 +
      laidOut.reduce(
        (total, block) => total + block.lines.length * block.style.lineHeight,
        0,
      );
    this.ensure(height + 8);
    const top = this.y;
    this.page.drawRectangle({
      borderColor: rgb(0.72, 0.82, 0.84),
      borderWidth: 0.7,
      color: rgb(0.97, 0.985, 0.986),
      height,
      width: PORTRAIT_SIZE[0] - PAGE_MARGIN * 2,
      x: PAGE_MARGIN,
      y: top - height,
    });
    let cursorY = top - 9;
    for (const block of laidOut) {
      for (const line of block.lines) {
        drawGlyphLine(
          this.page,
          line,
          PAGE_MARGIN + 10,
          cursorY - block.style.size,
          block.style,
        );
        cursorY -= block.style.lineHeight;
      }
    }
    this.y = top - height - 8;
  }
}

function pngBytes(dataUrl: string): Uint8Array {
  const prefix = "data:image/png;base64,";
  if (!dataUrl.startsWith(prefix)) {
    throw new PdfGenerationError("report-pdf.image-invalid");
  }
  try {
    const binary = atob(dataUrl.slice(prefix.length));
    return Uint8Array.from(binary, (character) => character.charCodeAt(0));
  } catch {
    throw new PdfGenerationError("report-pdf.image-invalid");
  }
}

function drawCenteredText(
  page: PDFPage,
  text: string,
  fonts: ReadonlyMap<string, PDFFont>,
  centerX: number,
  y: number,
  style: TextStyle,
): void {
  const [line] = layoutText(text, fonts, Number.POSITIVE_INFINITY, style.size);
  if (line === undefined) return;
  const width = line.reduce((total, glyph) => total + glyph.width, 0);
  drawGlyphLine(page, line, centerX - width / 2, y, style);
}

async function addImagePages(
  document: PDFDocument,
  fonts: ReadonlyMap<string, PDFFont>,
  images: ReadonlyMap<LoadingReportViewKind, LoadingReportImage>,
): Promise<readonly PDFPage[]> {
  const pages: PDFPage[] = [];
  const embedded = new Map<LoadingReportViewKind, Awaited<ReturnType<PDFDocument["embedPng"]>>>();
  try {
    for (const kind of EXPECTED_IMAGE_KINDS) {
      embedded.set(kind, await document.embedPng(pngBytes(images.get(kind)!.dataUrl)));
    }
  } catch (error) {
    if (error instanceof PdfGenerationError) throw error;
    throw new PdfGenerationError("report-pdf.image-invalid");
  }

  const currentPage = document.addPage(LANDSCAPE_SIZE);
  pages.push(currentPage);
  drawCenteredText(
    currentPage,
    images.get("current")!.title,
    fonts,
    LANDSCAPE_SIZE[0] / 2,
    LANDSCAPE_SIZE[1] - 38,
    { color: rgb(0.04, 0.32, 0.36), lineHeight: 18, size: 14 },
  );
  currentPage.drawImage(embedded.get("current")!, {
    height: 500,
    width: 750,
    x: (LANDSCAPE_SIZE[0] - 750) / 2,
    y: 42,
  });

  const fixedPage = document.addPage(LANDSCAPE_SIZE);
  pages.push(fixedPage);
  const fixedKinds = EXPECTED_IMAGE_KINDS.slice(1);
  const cellWidth = 350;
  const imageHeight = 220;
  const left = (LANDSCAPE_SIZE[0] - cellWidth * 2 - 24) / 2;
  const topImageY = 314;
  const bottomImageY = 54;
  fixedKinds.forEach((kind, index) => {
    const column = index % 2;
    const row = Math.floor(index / 2);
    const x = left + column * (cellWidth + 24);
    const y = row === 0 ? topImageY : bottomImageY;
    drawCenteredText(
      fixedPage,
      images.get(kind)!.title,
      fonts,
      x + cellWidth / 2,
      y + imageHeight + 12,
      { color: rgb(0.04, 0.32, 0.36), lineHeight: 15, size: 11 },
    );
    fixedPage.drawImage(embedded.get(kind)!, {
      height: imageHeight,
      width: cellWidth,
      x,
      y,
    });
  });
  return pages;
}

function addFooters(
  pages: readonly PDFPage[],
  fonts: ReadonlyMap<string, PDFFont>,
): void {
  pages.forEach((page, index) => {
    const width = page.getWidth();
    page.drawLine({
      color: rgb(0.78, 0.84, 0.86),
      end: { x: width - PAGE_MARGIN, y: 28 },
      start: { x: PAGE_MARGIN, y: 28 },
      thickness: 0.5,
    });
    drawCenteredText(
      page,
      `ページ ${index + 1} / ${pages.length}`,
      fonts,
      width / 2,
      14,
      { color: rgb(0.38, 0.45, 0.5), lineHeight: 10, size: 7 },
    );
  });
}

export async function createLoadingReportPdf(
  input: LoadingReportPdfInput,
): Promise<LoadingReportPdfResult> {
  const images = imageMap(input.images, input.snapshot.cargoes.length);
  const generatedAt = new Date(input.generatedAtIso);
  if (
    input.snapshot.status !== "available" ||
    input.snapshot.cargoes.length === 0 ||
    images === undefined ||
    !Number.isFinite(generatedAt.getTime())
  ) {
    return { code: "report-pdf.input-invalid", ok: false };
  }

  try {
    const document = await PDFDocument.create();
    document.registerFontkit(fontkit);
    const fonts = await embedRequiredFonts(document, allReportText(input));
    document.setTitle("Container Loading Plan - 積込順帳票");
    document.setSubject("限定モデルによる積込順提案");
    document.setCreator("Auto CLP");
    document.setProducer("Auto CLP / pdf-lib");
    document.setCreationDate(generatedAt);
    document.setModificationDate(generatedAt);

    const flow = new PortraitFlow(document, fonts);
    flow.write("Container Loading Plan - 積込順帳票", {
      color: rgb(0.03, 0.3, 0.34),
      lineHeight: 27,
      size: 20,
    });
    flow.gap(8);
    flow.write(`CLP: ${input.snapshot.projectName}`, { lineHeight: 15, size: 10 });
    flow.write(
      `コンテナ: ${input.snapshot.containerName ?? "不明なコンテナ"}`,
      { lineHeight: 15, size: 10 },
    );
    flow.write(`生成日時（UTC）: ${input.generatedAtIso}`, {
      lineHeight: 15,
      size: 10,
    });
    flow.gap(12);
    flow.heading("現在配置の物理判定");
    flow.write(`${input.physical.statusLabel} - ${input.physical.summary}`, {
      lineHeight: 14,
      size: 9,
    });
    for (const reason of input.physical.reasons) {
      flow.write(`・${reason}`, { lineHeight: 13, size: 8 }, 8);
    }
    flow.gap(8);
    flow.heading("利用上の注意");
    flow.write(LIMITATION_COPY, { lineHeight: 14, size: 9 });
    flow.gap(12);
    flow.heading("積込順一覧");

    for (const cargo of input.snapshot.cargoes) {
      flow.cargoCard([
        `No.${cargo.sequenceNumber} ${cargo.name}`,
        `ID: ${cargo.cargoId}`,
        `現在向き寸法: ${cargo.orientedDimensionsMm.xMm} × ${cargo.orientedDimensionsMm.yMm} × ${cargo.orientedDimensionsMm.zMm} mm   重量: ${gramsToKilograms(cargo.massGrams)} kg`,
        dependencyText(input.snapshot, cargo.cargoId),
      ]);
    }

    if (input.snapshot.warnings.length > 0) {
      flow.heading("積込順の未確認事項");
      for (const warning of input.snapshot.warnings) {
        flow.write(`・${warningText(input.snapshot, warning)}`, {
          lineHeight: 13,
          size: 8,
        });
      }
    }

    const imagePages = await addImagePages(document, fonts, images);
    const pages = [...flow.pages, ...imagePages];
    addFooters(pages, fonts);
    const bytes = await document.save();
    return { bytes, ok: true, pageCount: pages.length };
  } catch (error) {
    return {
      code:
        error instanceof PdfGenerationError
          ? error.code
          : "report-pdf.generation-failed",
      ok: false,
    };
  }
}
