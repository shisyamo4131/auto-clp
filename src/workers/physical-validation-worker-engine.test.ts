import { describe, expect, it } from "vitest";

import { PROJECT_SCHEMA_VERSION, type Project } from "../domain/model";
import { validatePlacementSet } from "../domain/validation";
import { PhysicalValidationWorkerEngine } from "./physical-validation-worker-engine";
import { PHYSICAL_VALIDATION_REASON_PAGE_SIZE } from "./physical-validation-worker-protocol";

function projectFixture(count = 1): Project {
  return {
    schemaVersion: PROJECT_SCHEMA_VERSION,
    projectId: "worker-engine-test",
    name: "匿名worker試験",
    clearancesMm: { xMm: 0, yMm: 0, zMm: 0 },
    cargoes: Array.from({ length: count }, (_, index) => ({
      id: `cargo-${index + 1}`,
      name: `匿名積荷${index + 1}`,
      dimensionsMm: { lengthMm: 100, widthMm: 100, heightMm: 100 },
      massGrams: 1,
      canSupportCargo: false,
      allowedOrientations: ["LWH"] as const,
    })),
    containers: [
      {
        id: "container-1",
        name: "匿名候補",
        internalDimensionsMm: { lengthMm: 10_000, widthMm: 10_000, heightMm: 1_000 },
        openingMm: { widthMm: 10_000, heightMm: 1_000 },
        payloadCapacityGrams: 1_000_000,
      },
    ],
    placements: Array.from({ length: count }, (_, index) => ({
      cargoId: `cargo-${index + 1}`,
      containerId: "container-1",
      positionMm: { xMm: 0, yMm: 0, zMm: 0 },
      orientation: "LWH" as const,
    })),
  };
}

function evaluate(engine: PhysicalValidationWorkerEngine, project: Project, generation = 1) {
  return engine.handle({
    type: "evaluate",
    generation,
    project,
    containerId: "container-1",
  });
}

function page(
  engine: PhysicalValidationWorkerEngine,
  status: "invalid" | "unverified",
  offset: number,
  requestId = offset + 1,
  generation = 1,
) {
  return engine.handle({
    type: "reason-page",
    generation,
    requestId,
    status,
    offset,
    limit: PHYSICAL_VALIDATION_REASON_PAGE_SIZE,
  });
}

describe("PhysicalValidationWorkerEngine", () => {
  it("returns only a compact evaluated summary with exact counts", () => {
    const engine = new PhysicalValidationWorkerEngine();
    const project = projectFixture(3);
    const response = evaluate(engine, project);

    expect(response).toEqual({
      type: "evaluation-ready",
      generation: 1,
      summary: {
        kind: "evaluated",
        status: "invalid",
        invalidCount: 3,
        unverifiedCount: 3,
        placementCount: 3,
      },
    });
    expect(response).not.toHaveProperty("reasons");
    expect(response).not.toHaveProperty("project");
    expect(response).not.toHaveProperty("summary.reasons");
  });

  it.each([
    {
      label: "semantic input",
      mutate: (project: Project): Project => ({
        ...project,
        cargoes: [...project.cargoes, project.cargoes[0]!],
      }),
      expected: {
        code: "physical.semantic-input-invalid",
        issueCount: 1,
      },
    },
    {
      label: "missing container",
      mutate: (project: Project): Project => project,
      containerId: "missing-container",
      expected: {
        code: "physical.container-not-found",
        issueCount: 0,
        target: { kind: "container", id: "missing-container" },
      },
    },
    {
      label: "payload arithmetic",
      mutate: (project: Project): Project => ({
        ...project,
        cargoes: project.cargoes.map((cargo) => ({ ...cargo, massGrams: -1 })),
      }),
      expected: {
        code: "physical.payload-calculation-unavailable",
        issueCount: 0,
        target: { kind: "container", id: "container-1" },
      },
    },
    {
      label: "geometry arithmetic",
      mutate: (project: Project): Project => ({
        ...project,
        placements: project.placements.map((placement) => ({
          ...placement,
          positionMm: { ...placement.positionMm, xMm: 0.5 },
        })),
      }),
      expected: {
        code: "physical.geometry-calculation-unavailable",
        issueCount: 0,
        target: { kind: "container", id: "container-1" },
      },
    },
  ] as const)("compresses $label unavailable details", ({ containerId, expected, mutate }) => {
    const engine = new PhysicalValidationWorkerEngine();
    const project = mutate(projectFixture());
    const response = engine.handle({
      type: "evaluate",
      generation: 4,
      project,
      containerId: containerId ?? "container-1",
    });

    expect(response).toMatchObject({
      type: "evaluation-ready",
      generation: 4,
      summary: {
        kind: "unavailable",
        ...expected,
        placementCount: containerId === "missing-container" ? 0 : 1,
      },
    });
    expect(response).not.toHaveProperty("summary.issues");
    expect(response).not.toHaveProperty("summary.reasons");
  });

  it("serves ordered maximum-size first, middle, and last pages for both statuses", () => {
    const engine = new PhysicalValidationWorkerEngine();
    const project = projectFixture(51);
    const domain = validatePlacementSet(project, "container-1");
    if (domain.kind !== "evaluated") {
      throw new Error("Fixture must be evaluable");
    }
    const expectedInvalid = domain.reasons.filter((reason) => reason.status === "invalid");
    const expectedUnverified = domain.reasons.filter(
      (reason) => reason.status === "unverified",
    );

    expect(evaluate(engine, project)).toMatchObject({
      summary: {
        invalidCount: 1_275,
        unverifiedCount: 51,
        placementCount: 51,
      },
    });

    for (const [status, reasons, offsets] of [
      ["invalid", expectedInvalid, [0, 625, 1_250]],
      ["unverified", expectedUnverified, [0, 25, 50]],
    ] as const) {
      for (const offset of offsets) {
        const response = page(engine, status, offset);
        expect(response).toEqual({
          type: "reason-page-ready",
          generation: 1,
          requestId: offset + 1,
          status,
          offset,
          total: reasons.length,
          reasons: reasons.slice(offset, offset + PHYSICAL_VALIDATION_REASON_PAGE_SIZE),
        });
        if (offset < 50 || status === "invalid") {
          expect(response).toHaveProperty(
            "reasons.length",
            PHYSICAL_VALIDATION_REASON_PAGE_SIZE,
          );
        } else {
          expect(response).toHaveProperty("reasons.length", 1);
        }
      }
    }
  });

  it.each([
    null,
    {},
    { type: "unknown", generation: 2 },
    { type: "evaluate", generation: -1, project: {}, containerId: "container-1" },
    { type: "evaluate", generation: 1, project: null, containerId: "container-1" },
    { type: "evaluate", generation: 1, project: {}, containerId: 1 },
    {
      type: "reason-page",
      generation: 1,
      requestId: -1,
      status: "invalid",
      offset: 0,
      limit: 25,
    },
    {
      type: "reason-page",
      generation: 1,
      requestId: 1,
      status: "other",
      offset: 0,
      limit: 25,
    },
    {
      type: "reason-page",
      generation: 1,
      requestId: 1,
      status: "invalid",
      offset: 1,
      limit: 25,
    },
    {
      type: "reason-page",
      generation: 1,
      requestId: 1,
      status: "invalid",
      offset: 0,
      limit: 24,
    },
  ])("rejects malformed request %# without retaining input", (request) => {
    expect(new PhysicalValidationWorkerEngine().handle(request)).toMatchObject({
      type: "worker-failed",
      code: "invalid-request",
    });
  });

  it("distinguishes not-ready and generation-mismatch page requests", () => {
    const engine = new PhysicalValidationWorkerEngine();
    expect(page(engine, "invalid", 0)).toEqual({
      type: "worker-failed",
      generation: 1,
      code: "evaluation-not-ready",
    });

    evaluate(engine, projectFixture(), 7);
    expect(page(engine, "invalid", 0, 1, 6)).toEqual({
      type: "worker-failed",
      generation: 6,
      code: "generation-mismatch",
    });
  });

  it("exposes only cloned-safe summaries and reason pages after evaluation", () => {
    const engine = new PhysicalValidationWorkerEngine();
    const project = projectFixture(2);
    const before = structuredClone(project);

    const summary = evaluate(engine, project);
    const reasonPage = page(engine, "invalid", 0);

    expect(summary).not.toHaveProperty("project");
    expect(reasonPage).not.toHaveProperty("project");
    expect(project).toEqual(before);
  });
});
