import { describe, expect, it } from "vitest";

import { isPhysicalValidationWorkerResponse } from "./physical-validation-worker-protocol";

describe("isPhysicalValidationWorkerResponse", () => {
  it("accepts and preserves a dedicated floor-penetration reason page", () => {
    const response = {
      type: "reason-page-ready",
      generation: 7,
      requestId: 11,
      status: "invalid",
      offset: 0,
      total: 1,
      reasons: [
        {
          status: "invalid",
          code: "floor-penetration",
          target: { kind: "cargo", id: "cargo-floor" },
          relatedCargoIds: [],
        },
      ],
    } as const;
    const original = structuredClone(response);

    expect(isPhysicalValidationWorkerResponse(response)).toBe(true);
    expect(response).toEqual(original);
  });
});
