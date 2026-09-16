import { describe, expect, it } from "vitest";

import { CARGO_CSV_HEADER, CARGO_CSV_MAX_BYTES } from "./cargo-csv";
import { readCargoCsv, type CargoCsvByteSource } from "./cargo-csv-file";

function source(bytes: Uint8Array, declaredSize = bytes.byteLength): CargoCsvByteSource {
  return { sizeBytes: declaredSize, readBytes: async () => bytes };
}

describe("cargo CSV byte boundary", () => {
  it.each([false, true])("accepts strict UTF-8 with BOM=%s", async (withBom) => {
    const body = new TextEncoder().encode(`${CARGO_CSV_HEADER.join(",")}\n匿名荷,1,2,3,1`);
    const bytes = withBom
      ? new Uint8Array([0xef, 0xbb, 0xbf, ...body])
      : body;
    const result = await readCargoCsv(source(bytes));
    expect(result.ok).toBe(true);
  });

  it("rejects invalid UTF-8 without replacement decoding", async () => {
    const result = await readCargoCsv(source(new Uint8Array([0xc3, 0x28])));
    expect(result).toEqual({
      ok: false,
      issues: [{ code: "cargo-csv.utf8", path: "/file" }],
    });
  });

  it("accepts declared and actual bytes at the exact 5 MiB boundary", async () => {
    const prefix = new TextEncoder().encode(
      `${CARGO_CSV_HEADER.join(",")}\n匿名荷,1,2,3,1\n`,
    );
    const bytes = new Uint8Array(CARGO_CSV_MAX_BYTES);
    bytes.fill(0x20);
    bytes.set(prefix);
    const result = await readCargoCsv(source(bytes, CARGO_CSV_MAX_BYTES));
    expect(result.ok).toBe(true);
  });

  it.each([
    [CARGO_CSV_MAX_BYTES + 1, new Uint8Array()],
    [1, new Uint8Array(CARGO_CSV_MAX_BYTES + 1)],
    [Number.NaN, new Uint8Array()],
  ])("rejects unsafe declared or actual size", async (declaredSize, bytes) => {
    expect(await readCargoCsv(source(bytes, declaredSize))).toEqual({
      ok: false,
      issues: [{ code: "cargo-csv.file-size", path: "/file" }],
    });
  });

  it("normalizes read failure without reflecting its message", async () => {
    const result = await readCargoCsv({
      sizeBytes: 1,
      readBytes: async () => {
        throw new Error("secret filename and contents");
      },
    });
    expect(result).toEqual({
      ok: false,
      issues: [{ code: "cargo-csv.read", path: "/file" }],
    });
  });
});
