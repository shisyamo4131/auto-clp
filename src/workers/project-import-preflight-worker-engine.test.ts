import { describe, expect, it } from "vitest";

import { PROJECT_SCHEMA_VERSION, type Project } from "../domain/model";
import { ProjectImportPreflightWorkerEngine } from "./project-import-preflight-worker-engine";
import { isProjectImportPreflightResponse } from "./project-import-preflight-protocol";

function project(): Project {
  return {
    schemaVersion: PROJECT_SCHEMA_VERSION,
    projectId: "preflight-engine",
    name: "匿名preflight案件",
    clearancesMm: { xMm: 0, yMm: 0, zMm: 0 },
    cargoes: [
      {
        id: "cargo-1",
        name: "匿名積荷",
        dimensionsMm: { lengthMm: 10, widthMm: 10, heightMm: 10 },
        massGrams: 1,
        canSupportCargo: false,
        allowedOrientations: ["LWH"],
      },
    ],
    containers: [
      {
        id: "container-1",
        name: "匿名候補",
        internalDimensionsMm: { lengthMm: 100, widthMm: 100, heightMm: 100 },
        openingMm: { widthMm: 100, heightMm: 100 },
        payloadCapacityGrams: 100,
      },
    ],
    placements: [
      {
        cargoId: "cargo-1",
        containerId: "container-1",
        positionMm: { xMm: -1, yMm: 0, zMm: 0 },
        orientation: "LWH",
      },
    ],
  };
}

describe("project import preflight protocol and engine", () => {
  it("accepts invalid or unverified physical results after checking every candidate", () => {
    const engine = new ProjectImportPreflightWorkerEngine();
    const base = project();
    const input: Project = {
      ...base,
      containers: [
      ...base.containers,
      {
        ...base.containers[0]!,
        id: "container-2",
        name: "匿名候補2",
      },
      ],
    };

    expect(
      engine.handle({
        type: "project-import-preflight",
        requestId: 7,
        project: input,
      }),
    ).toEqual({ type: "project-import-preflight-ready", requestId: 7 });
  });

  it("rejects an unavailable physical evaluation", () => {
    const engine = new ProjectImportPreflightWorkerEngine();
    const base = project();
    const input: Project = {
      ...base,
      cargoes: [...base.cargoes, { ...base.cargoes[0]! }],
    };

    expect(
      engine.handle({
        type: "project-import-preflight",
        requestId: 8,
        project: input,
      }),
    ).toEqual({
      type: "project-import-preflight-failed",
      requestId: 8,
      code: "physical-validation-unavailable",
    });
  });

  it.each([
    undefined,
    null,
    {},
    { type: "wrong", requestId: 4, project: project() },
    { type: "project-import-preflight", requestId: -1, project: project() },
    { type: "project-import-preflight", requestId: 1.5, project: project() },
    { type: "project-import-preflight", requestId: 4, project: null },
  ])("returns a fixed invalid-request response for malformed request %#", (value) => {
    expect(new ProjectImportPreflightWorkerEngine().handle(value)).toEqual({
      type: "project-import-preflight-failed",
      requestId:
        typeof value === "object" &&
        value !== null &&
        "requestId" in value &&
        Number.isSafeInteger(value.requestId) &&
        (value.requestId as number) >= 0
          ? value.requestId
          : 0,
      code: "invalid-request",
    });
  });

  it("normalizes unexpected engine exceptions without reflecting input", () => {
    const malformed = {
      type: "project-import-preflight",
      requestId: 9,
      project: { containers: null },
      secretLookingValue: "do-not-reflect",
    };

    expect(new ProjectImportPreflightWorkerEngine().handle(malformed)).toEqual({
      type: "project-import-preflight-failed",
      requestId: 9,
      code: "engine-failure",
    });
  });

  it.each([
    { type: "project-import-preflight-ready", requestId: 0 },
    {
      type: "project-import-preflight-failed",
      requestId: 1,
      code: "invalid-request",
    },
    {
      type: "project-import-preflight-failed",
      requestId: 2,
      code: "physical-validation-unavailable",
    },
    {
      type: "project-import-preflight-failed",
      requestId: 3,
      code: "engine-failure",
    },
  ])("accepts exact response shape %#", (value) => {
    expect(isProjectImportPreflightResponse(value)).toBe(true);
  });

  it.each([
    null,
    { type: "project-import-preflight-ready", requestId: -1 },
    { type: "project-import-preflight-ready", requestId: 1, extra: true },
    { type: "project-import-preflight-failed", requestId: 1, code: "unknown" },
    {
      type: "project-import-preflight-failed",
      requestId: 1,
      code: "engine-failure",
      extra: true,
    },
  ])("rejects malformed response %#", (value) => {
    expect(isProjectImportPreflightResponse(value)).toBe(false);
  });
});
