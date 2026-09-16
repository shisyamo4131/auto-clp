import {
  CARGO_CREATION_LIMIT,
  parseDimensionMm,
  parseKilogramsToGrams,
} from "../domain/input";
import { ORIENTATIONS, type Cargo } from "../domain/model";
import type { ValidationIssue } from "../domain/validation";

export const CARGO_CSV_HEADER = [
  "name",
  "length_mm",
  "width_mm",
  "height_mm",
  "weight_kg",
] as const;
export const CARGO_CSV_TEMPLATE_FILENAME = "auto-clp-cargo-template.csv";
export const CARGO_CSV_MAX_BYTES = 5 * 1024 * 1024;
export const CARGO_CSV_MAX_RECORDS = CARGO_CREATION_LIMIT;
export const CARGO_CSV_MAX_ISSUES = 50;

const templateText = `${CARGO_CSV_HEADER.join(",")}\r\n`;
const templateBody = new TextEncoder().encode(templateText);
const templateBytes = new Uint8Array(templateBody.length + 3);
templateBytes.set([0xef, 0xbb, 0xbf]);
templateBytes.set(templateBody, 3);

export type CargoCsvParseResult =
  | { readonly ok: true; readonly cargoes: readonly Cargo[] }
  | { readonly ok: false; readonly issues: readonly ValidationIssue[] };

type RecordParseResult =
  | { readonly ok: true; readonly records: readonly (readonly string[])[] }
  | { readonly ok: false };

export function createCargoCsvTemplateBytes(): Uint8Array {
  return templateBytes.slice();
}

function parseRecords(text: string): RecordParseResult {
  const records: string[][] = [];
  let record: string[] = [];
  let field = "";
  let recordStarted = false;
  let state: "field" | "quoted" | "after-quote" = "field";

  const finishRecord = () => {
    record.push(field);
    records.push(record);
    record = [];
    field = "";
    recordStarted = false;
    state = "field";
  };

  for (let index = 0; index < text.length; index += 1) {
    const character = text[index]!;
    if (state === "quoted") {
      if (character === '"') {
        if (text[index + 1] === '"') {
          field += '"';
          index += 1;
        } else {
          state = "after-quote";
        }
      } else if (character === "\r") {
        if (text[index + 1] !== "\n") return { ok: false };
        field += "\r\n";
        index += 1;
      } else {
        field += character;
      }
      continue;
    }

    if (state === "after-quote") {
      if (character === ",") {
        record.push(field);
        field = "";
        state = "field";
        recordStarted = true;
        continue;
      }
      if (character === "\n") {
        finishRecord();
        continue;
      }
      if (character === "\r" && text[index + 1] === "\n") {
        finishRecord();
        index += 1;
        continue;
      }
      return { ok: false };
    }

    if (character === '"') {
      if (field.length > 0) return { ok: false };
      state = "quoted";
      recordStarted = true;
    } else if (character === ",") {
      record.push(field);
      field = "";
      recordStarted = true;
    } else if (character === "\n") {
      finishRecord();
    } else if (character === "\r") {
      if (text[index + 1] !== "\n") return { ok: false };
      finishRecord();
      index += 1;
    } else {
      field += character;
      recordStarted = true;
    }
  }

  if (state === "quoted") return { ok: false };
  if (recordStarted || record.length > 0 || field.length > 0 || text.length === 0) {
    record.push(field);
    records.push(record);
  }
  return { ok: true, records };
}

function normalizedIssues(issues: readonly ValidationIssue[]): readonly ValidationIssue[] {
  const unique = new Map<string, ValidationIssue>();
  for (const issue of issues) {
    unique.set(`${issue.path}\u0000${issue.code}`, issue);
  }
  return [...unique.values()]
    .sort((first, second) =>
      first.path === second.path
        ? first.code < second.code
          ? -1
          : first.code > second.code
            ? 1
            : 0
        : first.path < second.path
          ? -1
          : 1,
    )
    .slice(0, CARGO_CSV_MAX_ISSUES);
}

function isWhitespaceRecord(record: readonly string[]): boolean {
  return record.every((field) => field.trim() === "");
}

function hasControlCharacter(value: string): boolean {
  return Array.from(value).some((character) => {
    const code = character.codePointAt(0) ?? 0;
    return code <= 0x1f || code === 0x7f;
  });
}

function exactHeader(record: readonly string[]): boolean {
  return (
    record.length === CARGO_CSV_HEADER.length &&
    CARGO_CSV_HEADER.every((field, index) => record[index] === field)
  );
}

export function parseCargoCsv(text: string): CargoCsvParseResult {
  const parsed = parseRecords(text);
  if (!parsed.ok) {
    return {
      ok: false,
      issues: [{ code: "cargo-csv.syntax", path: "/file" }],
    };
  }
  const nonblank = parsed.records.filter((record) => !isWhitespaceRecord(record));
  const header = nonblank[0];
  if (header === undefined || !exactHeader(header)) {
    return {
      ok: false,
      issues: [{ code: "cargo-csv.header", path: "/header" }],
    };
  }

  const rows = nonblank.slice(1);
  const issues: ValidationIssue[] = [];
  if (rows.length < 1 || rows.length > CARGO_CSV_MAX_RECORDS) {
    issues.push({ code: "cargo-csv.record-count", path: "/rows" });
  }
  const cargoes: Cargo[] = [];
  rows.forEach((row, index) => {
    const ordinal = index + 1;
    const basePath = `/rows/${ordinal}`;
    if (row.length !== CARGO_CSV_HEADER.length) {
      issues.push({ code: "cargo-csv.column-count", path: basePath });
      return;
    }

    const [rawName = "", rawLength = "", rawWidth = "", rawHeight = "", rawWeight = ""] = row;
    const name = rawName.trim();
    if (name.length === 0) {
      issues.push({ code: "cargo-csv.name-required", path: `${basePath}/name` });
    } else {
      if (Array.from(name).length > 120) {
        issues.push({ code: "cargo-csv.name-length", path: `${basePath}/name` });
      }
      if (hasControlCharacter(name)) {
        issues.push({ code: "cargo-csv.name-control", path: `${basePath}/name` });
      }
    }

    const length = parseDimensionMm(rawLength, `${basePath}/length_mm`);
    const width = parseDimensionMm(rawWidth, `${basePath}/width_mm`);
    const height = parseDimensionMm(rawHeight, `${basePath}/height_mm`);
    const weight = parseKilogramsToGrams(rawWeight, `${basePath}/weight_kg`);
    for (const result of [length, width, height, weight]) {
      if (!result.ok) issues.push(result.issue);
    }
    if (
      name.length > 0 &&
      Array.from(name).length <= 120 &&
      !hasControlCharacter(name) &&
      length.ok &&
      width.ok &&
      height.ok &&
      weight.ok
    ) {
      cargoes.push({
        id: `cargo-${ordinal}`,
        name,
        dimensionsMm: {
          lengthMm: length.value,
          widthMm: width.value,
          heightMm: height.value,
        },
        massGrams: weight.value,
        canSupportCargo: true,
        allowedOrientations: [...ORIENTATIONS],
      });
    }
  });

  if (issues.length > 0) {
    return { ok: false, issues: normalizedIssues(issues) };
  }
  return { ok: true, cargoes };
}

export function normalizeCargoCsvIssues(
  issues: readonly ValidationIssue[],
): readonly ValidationIssue[] {
  return normalizedIssues(issues);
}
