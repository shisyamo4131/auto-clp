import { describe, expect, it } from "vitest";

import { loadingReportFontShardForCodePoint } from "./loading-report-font";

describe("loading-report font routing", () => {
  it("routes representative Japanese, Latin, punctuation, and unit characters", () => {
    for (const character of ["積", "荷", "A", "1", "。", "×", "㎏"]) {
      expect(loadingReportFontShardForCodePoint(character.codePointAt(0)!)).toBeDefined();
    }
  });

  it("rejects unsupported emoji instead of silently replacing it", () => {
    expect(loadingReportFontShardForCodePoint("😀".codePointAt(0)!)).toBeUndefined();
  });
});
