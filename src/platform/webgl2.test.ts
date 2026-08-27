import { describe, expect, it } from "vitest";

import { checkWebGL2Capability } from "./webgl2";

describe("checkWebGL2Capability", () => {
  it("reports supported when a WebGL 2 context is returned", () => {
    expect(checkWebGL2Capability(() => ({ getContext: () => ({}) }))).toEqual({
      status: "supported",
    });
  });

  it("reports unavailable when the WebGL 2 context is null", () => {
    expect(checkWebGL2Capability(() => ({ getContext: () => null }))).toEqual({
      status: "unsupported",
      reason: "context-unavailable",
    });
  });

  it("reports a failed check when context creation throws", () => {
    expect(
      checkWebGL2Capability(() => ({
        getContext: () => {
          throw new Error("synthetic WebGL failure");
        },
      })),
    ).toEqual({ status: "unsupported", reason: "check-failed" });
  });
});
