import type { ValidationIssue } from "../domain/validation";
import {
  CARGO_CSV_MAX_BYTES,
  CARGO_CSV_TEMPLATE_FILENAME,
  createCargoCsvTemplateBytes,
  parseCargoCsv,
  type CargoCsvParseResult,
} from "./cargo-csv";

export interface CargoCsvByteSource {
  readonly sizeBytes: number;
  readonly readBytes: () => Promise<Uint8Array>;
}

export type CargoCsvFileResult =
  | CargoCsvParseResult
  | { readonly ok: false; readonly issues: readonly ValidationIssue[] };

export type CargoCsvDownloadResult =
  | { readonly ok: true }
  | {
      readonly ok: false;
      readonly issue: ValidationIssue;
    };

function fileIssue(code: string): CargoCsvFileResult {
  return { ok: false, issues: [{ code, path: "/file" }] };
}

export function isCargoCsvFileImportAvailable(): boolean {
  try {
    return (
      typeof File !== "undefined" &&
      typeof File.prototype.arrayBuffer === "function" &&
      typeof TextDecoder !== "undefined"
    );
  } catch {
    return false;
  }
}

export function cargoCsvSourceFromFile(file: File): CargoCsvByteSource | undefined {
  if (!isCargoCsvFileImportAvailable()) return undefined;
  try {
    if (typeof file.arrayBuffer !== "function") return undefined;
    return {
      sizeBytes: file.size,
      readBytes: async () => new Uint8Array(await file.arrayBuffer()),
    };
  } catch {
    return undefined;
  }
}

export async function readCargoCsv(
  source: CargoCsvByteSource,
): Promise<CargoCsvFileResult> {
  if (
    !Number.isSafeInteger(source.sizeBytes) ||
    source.sizeBytes < 0 ||
    source.sizeBytes > CARGO_CSV_MAX_BYTES
  ) {
    return fileIssue("cargo-csv.file-size");
  }

  let bytes: Uint8Array;
  try {
    bytes = await source.readBytes();
  } catch {
    return fileIssue("cargo-csv.read");
  }
  if (!(bytes instanceof Uint8Array)) {
    return fileIssue("cargo-csv.read");
  }
  if (bytes.byteLength > CARGO_CSV_MAX_BYTES) {
    return fileIssue("cargo-csv.file-size");
  }

  const body =
    bytes.length >= 3 &&
    bytes[0] === 0xef &&
    bytes[1] === 0xbb &&
    bytes[2] === 0xbf
      ? bytes.subarray(3)
      : bytes;
  let text: string;
  try {
    text = new TextDecoder("utf-8", { fatal: true }).decode(body);
  } catch {
    return fileIssue("cargo-csv.utf8");
  }
  return parseCargoCsv(text);
}

export function isCargoCsvTemplateDownloadAvailable(): boolean {
  try {
    return (
      typeof Blob !== "undefined" &&
      typeof URL !== "undefined" &&
      typeof URL.createObjectURL === "function" &&
      typeof URL.revokeObjectURL === "function" &&
      typeof document !== "undefined"
    );
  } catch {
    return false;
  }
}

export function downloadCargoCsvTemplate(): CargoCsvDownloadResult {
  if (!isCargoCsvTemplateDownloadAvailable()) {
    return {
      ok: false,
      issue: { code: "cargo-csv.download-unavailable", path: "/template" },
    };
  }
  let objectUrl: string | undefined;
  let anchor: HTMLAnchorElement | undefined;
  try {
    const template = createCargoCsvTemplateBytes();
    const templateBuffer = template.buffer.slice(
      template.byteOffset,
      template.byteOffset + template.byteLength,
    ) as ArrayBuffer;
    objectUrl = URL.createObjectURL(
      new Blob([templateBuffer], {
        type: "text/csv;charset=utf-8",
      }),
    );
    anchor = document.createElement("a");
    anchor.href = objectUrl;
    anchor.download = CARGO_CSV_TEMPLATE_FILENAME;
    anchor.hidden = true;
    document.body.append(anchor);
    anchor.click();
    anchor.remove();
    URL.revokeObjectURL(objectUrl);
    return { ok: true };
  } catch {
    anchor?.remove();
    if (objectUrl !== undefined) {
      try {
        URL.revokeObjectURL(objectUrl);
      } catch {
        // Revocation is best-effort after a failed download request.
      }
    }
    return {
      ok: false,
      issue: { code: "cargo-csv.download-failed", path: "/template" },
    };
  }
}
