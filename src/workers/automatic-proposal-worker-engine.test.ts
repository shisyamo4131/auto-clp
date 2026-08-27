import { describe, expect, it } from "vitest";

import {
  generateAutomaticProposal,
  type ValidatedAutomaticProposalProject,
} from "../domain/automatic-proposal";
import { PROJECT_SCHEMA_VERSION, type Project } from "../domain/model";
import { validateProjectReferences } from "../domain/validation";
import { validateProjectJsonSchema } from "../persistence/project-json-schema";
import { AutomaticProposalWorkerEngine } from "./automatic-proposal-worker-engine";
import { isAutomaticProposalWorkerResponse } from "./automatic-proposal-worker-protocol";

function projectFixture(overrides: Partial<Project> = {}): Project {
  return {
    schemaVersion: PROJECT_SCHEMA_VERSION,
    projectId: "worker-project",
    name: "anonymous-worker-project",
    clearancesMm: { xMm: 0, yMm: 0, zMm: 0 },
    cargoes: [],
    containers: [],
    placements: [],
    ...overrides,
  };
}

function completeProject(): Project {
  return projectFixture({
    cargoes: [
      {
        id: "cargo-1",
        name: "anonymous-cargo",
        dimensionsMm: { lengthMm: 10, widthMm: 10, heightMm: 10 },
        massGrams: 1_000,
        canSupportCargo: false,
        allowedOrientations: ["LWH"],
      },
    ],
    containers: [
      {
        id: "container-1",
        name: "anonymous-container",
        internalDimensionsMm: {
          lengthMm: 100,
          widthMm: 100,
          heightMm: 100,
        },
        openingMm: { widthMm: 100, heightMm: 100 },
        payloadCapacityGrams: 1_000,
      },
    ],
  });
}

function validatedFixture(value: unknown): ValidatedAutomaticProposalProject {
  const schema = validateProjectJsonSchema(value);
  if (!schema.valid || validateProjectReferences(schema.project).length !== 0) {
    throw new Error("worker engine test fixture is invalid");
  }
  return schema.project as ValidatedAutomaticProposalProject;
}

function deepFreeze<T>(value: T): T {
  if (value !== null && typeof value === "object") {
    Object.freeze(value);
    for (const child of Object.values(value)) {
      deepFreeze(child);
    }
  }
  return value;
}

describe("AutomaticProposalWorkerEngine", () => {
  it.each([
    undefined,
    null,
    {},
    { type: "wrong", requestId: 4, project: projectFixture() },
    { type: "automatic-proposal.generate", requestId: -1, project: projectFixture() },
    { type: "automatic-proposal.generate", requestId: 1.5, project: projectFixture() },
    { type: "automatic-proposal.generate", requestId: Number.NaN, project: projectFixture() },
    { type: "automatic-proposal.generate", requestId: 4, project: projectFixture(), extra: "marker-value" },
  ])("normalizes malformed envelope %# to exact invalid-request", (value) => {
    const result = new AutomaticProposalWorkerEngine().handle(value);
    const requestId =
      typeof value === "object" &&
      value !== null &&
      "requestId" in value &&
      Number.isSafeInteger(value.requestId) &&
      (value.requestId as number) >= 0
        ? (value.requestId as number)
        : 0;

    expect(result).toEqual({
      type: "automatic-proposal.failed",
      requestId,
      code: "invalid-request",
    });
    expect(JSON.stringify(result)).not.toContain("marker-value");
  });

  it.each([
    [
      "unsupported schema version",
      { ...projectFixture(), schemaVersion: "9.9.9", name: "schema-marker" },
    ],
    [
      "fractional schema number",
      {
        ...completeProject(),
        name: "fraction-marker",
        cargoes: [
          {
            ...completeProject().cargoes[0]!,
            dimensionsMm: {
              ...completeProject().cargoes[0]!.dimensionsMm,
              lengthMm: 1.5,
            },
          },
        ],
      },
    ],
  ])("returns fixed input-invalid for Schema invalid input: %s", (_label, project) => {
    const result = new AutomaticProposalWorkerEngine().handle({
      type: "automatic-proposal.generate",
      requestId: 21,
      project,
    });

    expect(result).toEqual({
      type: "automatic-proposal.failed",
      requestId: 21,
      code: "input-invalid",
    });
    expect(Object.keys(result)).toEqual(["type", "requestId", "code"]);
    expect(JSON.stringify(result)).not.toMatch(/schema-marker|fraction-marker|9\.9\.9/);
  });

  it("returns fixed input-invalid for semantic invalid input without reflecting IDs", () => {
    const base = completeProject();
    const duplicateId = "marker-duplicate-cargo";
    const invalid: Project = {
      ...base,
      cargoes: [
        { ...base.cargoes[0]!, id: duplicateId },
        { ...base.cargoes[0]!, id: duplicateId },
      ],
    };

    const result = new AutomaticProposalWorkerEngine().handle({
      type: "automatic-proposal.generate",
      requestId: 22,
      project: invalid,
    });

    expect(result).toEqual({
      type: "automatic-proposal.failed",
      requestId: 22,
      code: "input-invalid",
    });
    expect(JSON.stringify(result)).not.toContain(duplicateId);
  });

  it.each([
    ["no-cargo", projectFixture({ containers: completeProject().containers })],
    ["no-candidates", projectFixture({ cargoes: completeProject().cargoes })],
    ["complete", completeProject()],
  ] as const)("passes through the direct domain %s result", (_status, project) => {
    const engineResult = new AutomaticProposalWorkerEngine().handle({
      type: "automatic-proposal.generate",
      requestId: 30,
      project,
    });
    const direct = generateAutomaticProposal(validatedFixture(project));

    expect(engineResult).toEqual({
      type: "automatic-proposal.ready",
      requestId: 30,
      result: direct,
    });
    expect(isAutomaticProposalWorkerResponse(engineResult)).toBe(true);
  });

  it("does not mutate a deeply frozen valid Project", () => {
    const input = completeProject();
    const before = structuredClone(input);
    const frozen = deepFreeze(input);

    const result = new AutomaticProposalWorkerEngine().handle({
      type: "automatic-proposal.generate",
      requestId: 31,
      project: frozen,
    });

    expect(result.type).toBe("automatic-proposal.ready");
    expect(frozen).toEqual(before);
  });

  it("normalizes unexpected boundary exceptions to fixed engine-failure", () => {
    const marker = "marker-throwing-project";
    const throwingProject = {
      ...projectFixture(),
      get cargoes(): never {
        throw new Error(marker);
      },
    };

    const result = new AutomaticProposalWorkerEngine().handle({
      type: "automatic-proposal.generate",
      requestId: 32,
      project: throwingProject,
    });

    expect(result).toEqual({
      type: "automatic-proposal.failed",
      requestId: 32,
      code: "engine-failure",
    });
    expect(JSON.stringify(result)).not.toContain(marker);
  });
});
