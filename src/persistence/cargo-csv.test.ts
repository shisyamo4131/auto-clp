import { describe, expect, it } from "vitest";

import { CARGO_CREATION_LIMIT } from "../domain/input";
import { ORIENTATIONS } from "../domain/model";
import {
  CARGO_CSV_HEADER,
  CARGO_CSV_MAX_ISSUES,
  createCargoCsvTemplateBytes,
  parseCargoCsv,
} from "./cargo-csv";

const header = CARGO_CSV_HEADER.join(",");

describe("cargo CSV parser", () => {
  it("creates the fixed Excel-oriented BOM and CRLF template bytes", () => {
    const bytes = createCargoCsvTemplateBytes();
    expect([...bytes.slice(0, 3)]).toEqual([0xef, 0xbb, 0xbf]);
    expect(new TextDecoder().decode(bytes.slice(3))).toBe(`${header}\r\n`);
  });

  it.each(["\n", "\r\n"])("accepts %s records and deterministic defaults", (lineEnding) => {
    const result = parseCargoCsv(
      [
        header,
        " 匿名荷A ,1,100000,3,0.001",
        '"同名, ""引用""",4,5,6,100000.000',
        '"同名, ""引用""",7,8,9,1.234',
      ].join(lineEnding),
    );
    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.cargoes.map((cargo) => cargo.id)).toEqual([
      "cargo-1",
      "cargo-2",
      "cargo-3",
    ]);
    expect(result.cargoes.map((cargo) => cargo.name)).toEqual([
      "匿名荷A",
      '同名, "引用"',
      '同名, "引用"',
    ]);
    expect(result.cargoes[0]).toMatchObject({
      dimensionsMm: { lengthMm: 1, widthMm: 100000, heightMm: 3 },
      massGrams: 1,
      canSupportCargo: true,
      allowedOrientations: ORIENTATIONS,
    });
    expect(result.cargoes[1]?.massGrams).toBe(100_000_000);
  });

  it("accepts a CRLF quoted newline inside an ignored all-whitespace record", () => {
    const result = parseCargoCsv(
      `${header}\r\n" \r\n ", , , , \r\n匿名荷,1,2,3,1\r\n`,
    );
    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.cargoes).toHaveLength(1);
    expect(result.cargoes[0]?.id).toBe("cargo-1");
  });

  it("ignores only all-whitespace records and uses nonblank logical ordinals", () => {
    const result = parseCargoCsv(
      `${header}\n , , , , \n"line one\nline two",1,2,3,1\n\t, , , ,\n匿名荷,4,5,6,bad`,
    );
    expect(result).toEqual({
      ok: false,
      issues: [
        { code: "cargo-csv.name-control", path: "/rows/1/name" },
        { code: "input.kg-format", path: "/rows/2/weight_kg" },
      ],
    });
  });

  it.each([
    ["missing", "name,length_mm,width_mm,height_mm"],
    ["extra", `${header},other`],
    ["reordered", "length_mm,name,width_mm,height_mm,weight_kg"],
    ["case", "Name,length_mm,width_mm,height_mm,weight_kg"],
    ["duplicate", "name,length_mm,width_mm,height_mm,name"],
  ])("rejects a %s header without reflecting it", (_label, invalidHeader) => {
    expect(parseCargoCsv(`${invalidHeader}\n匿名荷,1,2,3,1`)).toEqual({
      ok: false,
      issues: [{ code: "cargo-csv.header", path: "/header" }],
    });
  });

  it.each([
    `${header}\n"unterminated,1,2,3,1`,
    `${header}\npre"quote,1,2,3,1`,
    `${header}\n"closed"suffix,1,2,3,1`,
    `${header}\rbroken,1,2,3,1`,
  ])("rejects invalid CSV quoting or line endings", (text) => {
    expect(parseCargoCsv(text)).toEqual({
      ok: false,
      issues: [{ code: "cargo-csv.syntax", path: "/file" }],
    });
  });

  it("rejects header-only, 31 rows, and column mismatches", () => {
    expect(parseCargoCsv(`${header}\r\n`)).toEqual({
      ok: false,
      issues: [{ code: "cargo-csv.record-count", path: "/rows" }],
    });
    const rows = Array.from({ length: 31 }, (_, index) =>
      `匿名荷${index + 1},1,2,3,1`,
    );
    expect(parseCargoCsv([header, ...rows].join("\n"))).toMatchObject({
      ok: false,
      issues: [{ code: "cargo-csv.record-count", path: "/rows" }],
    });
    expect(parseCargoCsv(`${header}\n匿名荷,1,2,3`)).toEqual({
      ok: false,
      issues: [{ code: "cargo-csv.column-count", path: "/rows/1" }],
    });
  });

  it("accepts exactly the shared 30-record creation limit", () => {
    const rows = Array.from({ length: CARGO_CREATION_LIMIT }, (_, index) =>
      `匿名荷${index + 1},1,2,3,1`,
    );
    const result = parseCargoCsv([header, ...rows].join("\n"));
    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.cargoes).toHaveLength(CARGO_CREATION_LIMIT);
    expect(result.cargoes.at(-1)?.id).toBe(`cargo-${CARGO_CREATION_LIMIT}`);
  });

  it("uses exact name, mm, and kg boundary codes and paths", () => {
    const longName = "あ".repeat(121);
    const result = parseCargoCsv(
      [
        header,
        ",0,100001,1.5,0",
        `${longName},1,2,3,100000.001`,
        "制御\t名,１,1e3,1,1.0001",
      ].join("\n"),
    );
    expect(result).toEqual({
      ok: false,
      issues: [
        { code: "cargo-csv.name-required", path: "/rows/1/name" },
        { code: "input.mm-range", path: "/rows/1/length_mm" },
        { code: "input.mm-format", path: "/rows/1/height_mm" },
        { code: "input.kg-range", path: "/rows/1/weight_kg" },
        { code: "input.mm-range", path: "/rows/1/width_mm" },
        { code: "cargo-csv.name-length", path: "/rows/2/name" },
        { code: "input.kg-range", path: "/rows/2/weight_kg" },
        { code: "input.mm-format", path: "/rows/3/length_mm" },
        { code: "cargo-csv.name-control", path: "/rows/3/name" },
        { code: "input.mm-format", path: "/rows/3/width_mm" },
        { code: "input.kg-format", path: "/rows/3/weight_kg" },
      ].sort((a, b) => a.path.localeCompare(b.path) || a.code.localeCompare(b.code)),
    });
  });

  it("sorts, deduplicates, and caps issues at 50", () => {
    const rows = Array.from({ length: 30 }, () => ",bad,bad,bad,bad");
    const result = parseCargoCsv([header, ...rows].join("\n"));
    expect(result.ok).toBe(false);
    if (result.ok) return;
    expect(result.issues).toHaveLength(CARGO_CSV_MAX_ISSUES);
    expect(new Set(result.issues.map((issue) => `${issue.path}:${issue.code}`)).size).toBe(50);
    expect(result.issues).toEqual(
      [...result.issues].sort((a, b) =>
        a.path === b.path
          ? a.code < b.code ? -1 : a.code > b.code ? 1 : 0
          : a.path < b.path ? -1 : 1,
      ),
    );
  });
});
