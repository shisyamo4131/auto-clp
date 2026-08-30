import { describe, expect, it } from "vitest";

import type {
  Cargo,
  Container,
  DimensionsMm,
  Project,
} from "./model";
import { PROJECT_SCHEMA_VERSION } from "./model";
import type { PlacementBoundsMm } from "./geometry";
import {
  AUTOMATIC_PROPOSAL_ALGORITHM_VERSION,
  AUTOMATIC_PROPOSAL_CANDIDATE_ATTEMPT_LIMIT,
  AUTOMATIC_PROPOSAL_CANDIDATE_POINT_LIMIT,
  AUTOMATIC_PROPOSAL_REQUEST_ATTEMPT_LIMIT,
  authorizeAutomaticProposalAttempt,
  eligibleAutomaticProposalOrientations,
  generateAutomaticProposal,
  generateAutomaticProposalCandidatePoints,
  generateAutomaticProposalForTesting,
} from "./automatic-proposal";
import type {
  AutomaticProposalResult,
  ValidatedAutomaticProposalProject,
} from "./automatic-proposal";
// Test fixtures cross the production layer boundary only to earn the local brand.
// eslint-disable-next-line no-restricted-imports
import { validateProjectJsonSchema } from "../persistence/project-json-schema";
import { validateProjectReferences } from "./validation";

const ZERO_CLEARANCES = { xMm: 0, yMm: 0, zMm: 0 } as const;

function cargo(
  id: string,
  dimensionsMm: DimensionsMm,
  overrides: Partial<Cargo> = {},
): Cargo {
  return {
    id,
    name: `anonymous-${id}`,
    dimensionsMm,
    massGrams: 1_000,
    canSupportCargo: false,
    allowedOrientations: ["LWH"],
    ...overrides,
  };
}

function container(
  id: string,
  internalDimensionsMm: DimensionsMm,
  overrides: Partial<Container> = {},
): Container {
  return {
    id,
    name: `anonymous-${id}`,
    internalDimensionsMm,
    openingMm: {
      widthMm: internalDimensionsMm.widthMm,
      heightMm: internalDimensionsMm.heightMm,
    },
    payloadCapacityGrams: 100_000,
    ...overrides,
  };
}

function project(
  cargoes: readonly Cargo[],
  containers: readonly Container[],
  overrides: Partial<Project> = {},
): Project {
  return {
    schemaVersion: PROJECT_SCHEMA_VERSION,
    projectId: "anonymous-project",
    name: "anonymous-project",
    clearancesMm: ZERO_CLEARANCES,
    cargoes,
    containers,
    placements: [],
    ...overrides,
  };
}

function validatedFixture(value: unknown): ValidatedAutomaticProposalProject {
  const schemaResult = validateProjectJsonSchema(value);
  if (!schemaResult.valid) {
    throw new Error("automatic proposal test fixture is not schema-valid");
  }
  if (validateProjectReferences(schemaResult.project).length !== 0) {
    throw new Error("automatic proposal test fixture is not semantically valid");
  }
  return schemaResult.project as ValidatedAutomaticProposalProject;
}

function completeResult(
  result: AutomaticProposalResult,
): Extract<AutomaticProposalResult, { status: "complete" | "complete-with-cutoff" }> {
  expect(["complete", "complete-with-cutoff"]).toContain(result.status);
  if (result.status !== "complete" && result.status !== "complete-with-cutoff") {
    throw new Error("expected an automatic proposal plan");
  }
  return result;
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

describe("automatic proposal candidate objective", () => {
  it.each([
    {
      label: "internal volume",
      preferred: container("small", {
        lengthMm: 200,
        widthMm: 100,
        heightMm: 100,
      }),
      other: container("large", {
        lengthMm: 300,
        widthMm: 100,
        heightMm: 100,
      }),
    },
    {
      label: "floor area after equal volume",
      preferred: container("floor-small", {
        lengthMm: 100,
        widthMm: 100,
        heightMm: 200,
      }),
      other: container("floor-large", {
        lengthMm: 200,
        widthMm: 100,
        heightMm: 100,
      }),
    },
    {
      label: "length after equal volume and floor area",
      preferred: container("length-small", {
        lengthMm: 100,
        widthMm: 200,
        heightMm: 100,
      }),
      other: container("length-large", {
        lengthMm: 200,
        widthMm: 100,
        heightMm: 100,
      }),
    },
  ])("selects by $label", ({ preferred, other }) => {
    const item = cargo("cargo-1", {
      lengthMm: 50,
      widthMm: 50,
      heightMm: 50,
    });

    const result = completeResult(
      generateAutomaticProposal(validatedFixture(project([item], [other, preferred]))),
    );

    expect(result.status).toBe("complete");
    expect(result.plan.containerId).toBe(preferred.id);
    expect(result.plan.placements).toEqual([
      {
        cargoId: "cargo-1",
        containerId: preferred.id,
        orientation: "LWH",
        positionMm: { xMm: 0, yMm: 0, zMm: 0 },
      },
    ]);
    expect(result.attempts.candidates).toEqual([
      { containerId: preferred.id, attemptCount: 1, outcome: "complete" },
    ]);
  });

  it("uses container ID independently of names and input array order", () => {
    const item = cargo("cargo-1", {
      lengthMm: 50,
      widthMm: 50,
      heightMm: 50,
    });
    const dimensions = { lengthMm: 200, widthMm: 100, heightMm: 100 };
    const containerA = container("container-a", dimensions, { name: "name-z" });
    const containerB = container("container-b", dimensions, { name: "name-a" });

    const first = completeResult(
      generateAutomaticProposal(
        validatedFixture(project([item], [containerB, containerA])),
      ),
    );
    const second = completeResult(
      generateAutomaticProposal(
        validatedFixture(
          project(
            [{ ...item, name: "renamed-cargo" }],
            [
              { ...containerA, name: "first-name" },
              { ...containerB, name: "second-name" },
            ],
          ),
        ),
      ),
    );

    expect(first.plan).toEqual(second.plan);
    expect(first.plan.containerId).toBe("container-a");
  });
});

describe("automatic proposal complete plans", () => {
  it("reproduces AP-02 with every cargo exactly once in one container", () => {
    const cargoes = [
      cargo(
        "cargo-b",
        { lengthMm: 100, widthMm: 100, heightMm: 100 },
        { name: "name-a" },
      ),
      cargo(
        "cargo-a",
        { lengthMm: 100, widthMm: 100, heightMm: 100 },
        { name: "name-z" },
      ),
    ];
    const candidate = container(
      "container-1",
      { lengthMm: 200, widthMm: 100, heightMm: 100 },
      {
        openingMm: { widthMm: 100, heightMm: 100 },
        payloadCapacityGrams: 2_000,
      },
    );

    const result = completeResult(
      generateAutomaticProposal(
        validatedFixture(project(cargoes, [candidate])),
      ),
    );

    expect(result.plan).toMatchObject({
      containerId: "container-1",
      invalidReasonCount: 0,
      placements: [
        {
          cargoId: "cargo-a",
          containerId: "container-1",
          orientation: "LWH",
          positionMm: { xMm: 0, yMm: 0, zMm: 0 },
        },
        {
          cargoId: "cargo-b",
          containerId: "container-1",
          orientation: "LWH",
          positionMm: { xMm: 100, yMm: 0, zMm: 0 },
        },
      ],
    });
    expect(new Set(result.plan.placements.map(({ cargoId }) => cargoId))).toEqual(
      new Set(["cargo-a", "cargo-b"]),
    );
    expect(
      result.plan.placements.every(
        ({ containerId }) => containerId === result.plan.containerId,
      ),
    ).toBe(true);
  });

  it("does not return the AP-02 partial plan when length is 1 mm short", () => {
    const cargoes = [
      cargo("cargo-a", { lengthMm: 100, widthMm: 100, heightMm: 100 }),
      cargo("cargo-b", { lengthMm: 100, widthMm: 100, heightMm: 100 }),
    ];
    const candidate = container(
      "container-1",
      { lengthMm: 199, widthMm: 100, heightMm: 100 },
      { payloadCapacityGrams: 2_000 },
    );

    const result = generateAutomaticProposal(
      validatedFixture(project(cargoes, [candidate])),
    );

    expect(result.status).toBe("no-complete-plan");
    expect("plan" in result).toBe(false);
  });

  it("reproduces AP-03 and preserves all unverified reasons", () => {
    const support = cargo(
      "support",
      { lengthMm: 100, widthMm: 100, heightMm: 100 },
      { massGrams: 1_001, canSupportCargo: true },
    );
    const upper = cargo(
      "upper",
      { lengthMm: 100, widthMm: 100, heightMm: 100 },
      { massGrams: 1_000, canSupportCargo: false },
    );
    const candidate = container(
      "container-1",
      { lengthMm: 100, widthMm: 100, heightMm: 200 },
      {
        openingMm: { widthMm: 100, heightMm: 200 },
        payloadCapacityGrams: 2_001,
      },
    );

    const result = completeResult(
      generateAutomaticProposal(
        validatedFixture(project([upper, support], [candidate])),
      ),
    );

    expect(result.plan.placements).toEqual([
      {
        cargoId: "support",
        containerId: "container-1",
        orientation: "LWH",
        positionMm: { xMm: 0, yMm: 0, zMm: 0 },
      },
      {
        cargoId: "upper",
        containerId: "container-1",
        orientation: "LWH",
        positionMm: { xMm: 0, yMm: 0, zMm: 100 },
      },
    ]);
    expect(result.plan.unverifiedReasons).toEqual([
      {
        status: "unverified",
        code: "structure-stability-unverified",
        target: { kind: "cargo", id: "upper" },
        relatedCargoIds: ["support"],
      },
    ]);
  });

  it("does not generate a plan that requires conditional multi-support", () => {
    const leftSupport = cargo(
      "support-a",
      { lengthMm: 10, widthMm: 10, heightMm: 200 },
      { massGrams: 1, canSupportCargo: true },
    );
    const rightSupport = cargo(
      "support-b",
      { lengthMm: 10, widthMm: 10, heightMm: 200 },
      { massGrams: 1, canSupportCargo: true },
    );
    const bridge = cargo(
      "bridge",
      { lengthMm: 20, widthMm: 10, heightMm: 10 },
      { massGrams: 1, canSupportCargo: false },
    );
    const candidate = container(
      "container-1",
      { lengthMm: 20, widthMm: 10, heightMm: 210 },
      {
        openingMm: { widthMm: 10, heightMm: 210 },
        payloadCapacityGrams: 3,
      },
    );

    const result = generateAutomaticProposal(
      validatedFixture(
        project([leftSupport, rightSupport, bridge], [candidate]),
      ),
    );

    expect(result.status).toBe("no-complete-plan");
    expect("plan" in result).toBe(false);
  });

  it("backtracks from the first orientation to find the complete plan", () => {
    const first = cargo(
      "cargo-a",
      { lengthMm: 3, widthMm: 2, heightMm: 1 },
      { massGrams: 1, allowedOrientations: ["LWH", "WLH"] },
    );
    const second = cargo(
      "cargo-b",
      { lengthMm: 4, widthMm: 1, heightMm: 1 },
      { massGrams: 1 },
    );
    const candidate = container(
      "container-1",
      { lengthMm: 4, widthMm: 3, heightMm: 1 },
      {
        openingMm: { widthMm: 3, heightMm: 1 },
        payloadCapacityGrams: 2,
      },
    );

    const result = completeResult(
      generateAutomaticProposal(
        validatedFixture(project([second, first], [candidate])),
      ),
    );

    expect(result.plan.placements).toEqual([
      {
        cargoId: "cargo-a",
        containerId: "container-1",
        orientation: "LWH",
        positionMm: { xMm: 0, yMm: 0, zMm: 0 },
      },
      {
        cargoId: "cargo-b",
        containerId: "container-1",
        orientation: "LWH",
        positionMm: { xMm: 0, yMm: 2, zMm: 0 },
      },
    ]);
    expect(result.attempts).toEqual({
      requestAttemptCount: 9,
      candidates: [
        { containerId: "container-1", attemptCount: 9, outcome: "complete" },
      ],
    });
  });
});

describe("automatic proposal ordering helpers", () => {
  it("deduplicates derived dimensions before applying the fixed orientation order", () => {
    const item = cargo(
      "cargo-1",
      { lengthMm: 100, widthMm: 100, heightMm: 50 },
      {
        allowedOrientations: ["HWL", "WHL", "HLW", "LHW", "WLH", "LWH"],
      },
    );
    const candidate = container("container-1", {
      lengthMm: 200,
      widthMm: 200,
      heightMm: 200,
    });

    expect(
      eligibleAutomaticProposalOrientations(item, candidate, ZERO_CLEARANCES),
    ).toEqual(["LWH", "HLW", "LHW"]);
    expect(
      eligibleAutomaticProposalOrientations(
        { ...item, dimensionsMm: { lengthMm: 100, widthMm: 100, heightMm: 100 } },
        candidate,
        ZERO_CLEARANCES,
      ),
    ).toEqual(["LWH"]);
  });

  it("accepts exact interior and opening limits and rejects each 1 mm short limit", () => {
    const item = cargo("cargo-1", {
      lengthMm: 10,
      widthMm: 8,
      heightMm: 6,
    });
    const exact = container(
      "container-1",
      { lengthMm: 12, widthMm: 10, heightMm: 7 },
      { openingMm: { widthMm: 10, heightMm: 7 } },
    );
    const clearances = { xMm: 1, yMm: 1, zMm: 1 };

    expect(eligibleAutomaticProposalOrientations(item, exact, clearances)).toEqual([
      "LWH",
    ]);
    expect(
      eligibleAutomaticProposalOrientations(
        item,
        { ...exact, internalDimensionsMm: { ...exact.internalDimensionsMm, lengthMm: 11 } },
        clearances,
      ),
    ).toEqual([]);
    expect(
      eligibleAutomaticProposalOrientations(
        item,
        { ...exact, openingMm: { ...exact.openingMm, widthMm: 9 } },
        clearances,
      ),
    ).toEqual([]);
    expect(
      eligibleAutomaticProposalOrientations(
        item,
        { ...exact, openingMm: { ...exact.openingMm, heightMm: 6 } },
        clearances,
      ),
    ).toEqual([]);
  });

  it("enumerates only the first 2048 points in Z-X-Y order from 1000 bounds", () => {
    const placedBounds = Array.from({ length: 1_000 }, (_, index) => {
      const maximum = index + 1;
      return {
        min: { xMm: index, yMm: index, zMm: index },
        dimensions: { xMm: 1, yMm: 1, zMm: 1 },
        max: { xMm: maximum, yMm: maximum, zMm: maximum },
      } satisfies PlacementBoundsMm;
    });
    const candidate = container("container-1", {
      lengthMm: 3_000,
      widthMm: 3_000,
      heightMm: 3_000,
    });

    const points = generateAutomaticProposalCandidatePoints(
      candidate,
      { xMm: 1, yMm: 1, zMm: 1 },
      ZERO_CLEARANCES,
      placedBounds,
    );

    expect(points).toHaveLength(AUTOMATIC_PROPOSAL_CANDIDATE_POINT_LIMIT);
    expect(points[0]).toEqual({ xMm: 0, yMm: 0, zMm: 0 });
    expect(points[1_001]).toEqual({ xMm: 0, yMm: 2_999, zMm: 0 });
    expect(points[1_002]).toEqual({ xMm: 1, yMm: 0, zMm: 0 });
    expect(points[2_003]).toEqual({ xMm: 1, yMm: 2_999, zMm: 0 });
    expect(points[2_047]).toEqual({ xMm: 2, yMm: 43, zMm: 0 });
  });

  it("does not create an upper-wall Z anchor", () => {
    const candidate = container("container-1", {
      lengthMm: 3,
      widthMm: 3,
      heightMm: 3,
    });

    const points = generateAutomaticProposalCandidatePoints(
      candidate,
      { xMm: 1, yMm: 1, zMm: 1 },
      ZERO_CLEARANCES,
      [],
    );

    expect(points).toEqual([
      { xMm: 0, yMm: 0, zMm: 0 },
      { xMm: 0, yMm: 2, zMm: 0 },
      { xMm: 2, yMm: 0, zMm: 0 },
      { xMm: 2, yMm: 2, zMm: 0 },
    ]);
  });
});

describe("automatic proposal attempt boundaries", () => {
  it("authorizes candidate ordinals 9999 and 10000, then denies 10001", () => {
    const ordinal9_999 = authorizeAutomaticProposalAttempt({
      candidate: 9_998,
      request: 0,
    });
    expect(ordinal9_999).toEqual({
      authorized: true,
      counts: { candidate: 9_999, request: 1 },
    });
    if (!ordinal9_999.authorized) {
      throw new Error("expected candidate attempt 9999");
    }

    const ordinal10_000 = authorizeAutomaticProposalAttempt(ordinal9_999.counts);
    expect(ordinal10_000).toEqual({
      authorized: true,
      counts: { candidate: 10_000, request: 2 },
    });
    if (!ordinal10_000.authorized) {
      throw new Error("expected candidate attempt 10000");
    }

    expect(authorizeAutomaticProposalAttempt(ordinal10_000.counts)).toEqual({
      authorized: false,
      counts: { candidate: 10_000, request: 2 },
      cutoffSource: "candidate",
    });
  });

  it("authorizes request ordinals 999999 and 1000000, then denies 1000001", () => {
    const ordinal999_999 = authorizeAutomaticProposalAttempt({
      candidate: 0,
      request: 999_998,
    });
    expect(ordinal999_999).toEqual({
      authorized: true,
      counts: { candidate: 1, request: 999_999 },
    });
    if (!ordinal999_999.authorized) {
      throw new Error("expected request attempt 999999");
    }

    const ordinal1_000_000 = authorizeAutomaticProposalAttempt(
      ordinal999_999.counts,
    );
    expect(ordinal1_000_000).toEqual({
      authorized: true,
      counts: { candidate: 2, request: 1_000_000 },
    });
    if (!ordinal1_000_000.authorized) {
      throw new Error("expected request attempt 1000000");
    }

    expect(authorizeAutomaticProposalAttempt(ordinal1_000_000.counts)).toEqual({
      authorized: false,
      counts: { candidate: 2, request: 1_000_000 },
      cutoffSource: "request",
    });
  });

  it("reports both sources when both limits deny the next attempt", () => {
    expect(
      authorizeAutomaticProposalAttempt({
        candidate: AUTOMATIC_PROPOSAL_CANDIDATE_ATTEMPT_LIMIT,
        request: AUTOMATIC_PROPOSAL_REQUEST_ATTEMPT_LIMIT,
      }),
    ).toEqual({
      authorized: false,
      counts: {
        candidate: AUTOMATIC_PROPOSAL_CANDIDATE_ATTEMPT_LIMIT,
        request: AUTOMATIC_PROPOSAL_REQUEST_ATTEMPT_LIMIT,
      },
      cutoffSource: "both",
    });
  });

  it("distinguishes natural exhaustion at the limit from a denied next attempt", () => {
    const item = cargo("cargo-1", {
      lengthMm: 100,
      widthMm: 100,
      heightMm: 100,
    });
    const insufficient = container(
      "container-1",
      { lengthMm: 100, widthMm: 100, heightMm: 100 },
      { payloadCapacityGrams: 999 },
    );
    const fixture = validatedFixture(project([item], [insufficient]));

    const exhausted = generateAutomaticProposalForTesting(fixture, {
      candidateAttemptLimit: 1,
      requestAttemptLimit: 1,
    });
    expect(exhausted).toMatchObject({
      status: "no-complete-plan",
      effectiveLimits: {
        candidateAttemptLimit: 1,
        requestAttemptLimit: 1,
        candidatePointLimit: AUTOMATIC_PROPOSAL_CANDIDATE_POINT_LIMIT,
      },
      attempts: {
        requestAttemptCount: 1,
        candidates: [
          { containerId: "container-1", attemptCount: 1, outcome: "exhausted" },
        ],
      },
    });

    const denied = generateAutomaticProposalForTesting(fixture, {
      candidateAttemptLimit: 0,
      requestAttemptLimit: 1,
    });
    expect(denied).toMatchObject({
      status: "cutoff",
      cutoffSource: "candidate",
      effectiveLimits: {
        candidateAttemptLimit: 0,
        requestAttemptLimit: 1,
        candidatePointLimit: AUTOMATIC_PROPOSAL_CANDIDATE_POINT_LIMIT,
      },
      attempts: {
        requestAttemptCount: 0,
        candidates: [
          {
            containerId: "container-1",
            attemptCount: 0,
            outcome: "cutoff",
            cutoffSource: "candidate",
          },
        ],
      },
    });

    const requestDenied = generateAutomaticProposalForTesting(fixture, {
      candidateAttemptLimit: 1,
      requestAttemptLimit: 0,
    });
    expect(requestDenied).toMatchObject({
      status: "cutoff",
      cutoffSource: "request",
      effectiveLimits: {
        candidateAttemptLimit: 1,
        requestAttemptLimit: 0,
        candidatePointLimit: AUTOMATIC_PROPOSAL_CANDIDATE_POINT_LIMIT,
      },
      attempts: {
        requestAttemptCount: 0,
        candidates: [
          {
            containerId: "container-1",
            attemptCount: 0,
            outcome: "cutoff",
            cutoffSource: "request",
          },
        ],
      },
    });

    const bothDenied = generateAutomaticProposalForTesting(fixture, {
      candidateAttemptLimit: 0,
      requestAttemptLimit: 0,
    });
    expect(bothDenied).toMatchObject({
      status: "cutoff",
      cutoffSource: "both",
      effectiveLimits: {
        candidateAttemptLimit: 0,
        requestAttemptLimit: 0,
        candidatePointLimit: AUTOMATIC_PROPOSAL_CANDIDATE_POINT_LIMIT,
      },
    });
  });

  it("accepts a complete plan exactly at the reduced upper bound", () => {
    const item = cargo("cargo-1", {
      lengthMm: 100,
      widthMm: 100,
      heightMm: 100,
    });
    const exact = container("container-1", {
      lengthMm: 100,
      widthMm: 100,
      heightMm: 100,
    });

    const result = generateAutomaticProposalForTesting(
      validatedFixture(project([item], [exact])),
      { candidateAttemptLimit: 1, requestAttemptLimit: 1 },
    );

    expect(result).toMatchObject({
      status: "complete",
      effectiveLimits: {
        candidateAttemptLimit: 1,
        requestAttemptLimit: 1,
        candidatePointLimit: AUTOMATIC_PROPOSAL_CANDIDATE_POINT_LIMIT,
      },
      attempts: {
        requestAttemptCount: 1,
        candidates: [
          { containerId: "container-1", attemptCount: 1, outcome: "complete" },
        ],
      },
    });
  });

  it("carries a better candidate cutoff into a later complete plan", () => {
    const item = cargo("cargo-1", {
      lengthMm: 50,
      widthMm: 50,
      heightMm: 50,
    });
    const betterButInsufficient = container(
      "container-a",
      { lengthMm: 100, widthMm: 100, heightMm: 100 },
      { payloadCapacityGrams: 999 },
    );
    const laterComplete = container("container-b", {
      lengthMm: 200,
      widthMm: 100,
      heightMm: 100,
    });

    const result = completeResult(
      generateAutomaticProposalForTesting(
        validatedFixture(
          project([item], [laterComplete, betterButInsufficient]),
        ),
        { candidateAttemptLimit: 1, requestAttemptLimit: 10 },
      ),
    );

    expect(result).toMatchObject({
      status: "complete-with-cutoff",
      cutoffSource: "candidate",
      effectiveLimits: {
        candidateAttemptLimit: 1,
        requestAttemptLimit: 10,
        candidatePointLimit: AUTOMATIC_PROPOSAL_CANDIDATE_POINT_LIMIT,
      },
      plan: { containerId: "container-b" },
      attempts: {
        requestAttemptCount: 2,
        candidates: [
          {
            containerId: "container-a",
            attemptCount: 1,
            outcome: "cutoff",
            cutoffSource: "candidate",
          },
          { containerId: "container-b", attemptCount: 1, outcome: "complete" },
        ],
      },
    });
  });

  it("does not explore a lower-ranked candidate after an ordinary complete plan", () => {
    const item = cargo("cargo-1", {
      lengthMm: 50,
      widthMm: 50,
      heightMm: 50,
    });
    const preferred = container("container-a", {
      lengthMm: 100,
      widthMm: 100,
      heightMm: 100,
    });
    const lowerRanked = container(
      "container-b",
      { lengthMm: 200, widthMm: 100, heightMm: 100 },
      { payloadCapacityGrams: 999 },
    );

    const result = completeResult(
      generateAutomaticProposalForTesting(
        validatedFixture(project([item], [lowerRanked, preferred])),
        { candidateAttemptLimit: 1, requestAttemptLimit: 10 },
      ),
    );

    expect(result.status).toBe("complete");
    expect(result.effectiveLimits).toEqual({
      candidateAttemptLimit: 1,
      requestAttemptLimit: 10,
      candidatePointLimit: AUTOMATIC_PROPOSAL_CANDIDATE_POINT_LIMIT,
    });
    expect(result.attempts.candidates).toEqual([
      { containerId: "container-a", attemptCount: 1, outcome: "complete" },
    ]);
  });
});

describe("automatic proposal terminal and purity contracts", () => {
  it.each([
    {
      label: "unsupported schema version",
      change: (value: Project) => ({ ...value, schemaVersion: "9.9.9" }),
      message: "schema-valid",
    },
    {
      label: "fractional dimension",
      change: (value: Project) => ({
        ...value,
        cargoes: [
          {
            ...value.cargoes[0]!,
            dimensionsMm: {
              ...value.cargoes[0]!.dimensionsMm,
              lengthMm: 1.5,
            },
          },
        ],
      }),
      message: "schema-valid",
    },
    {
      label: "out-of-range dimension",
      change: (value: Project) => ({
        ...value,
        cargoes: [
          {
            ...value.cargoes[0]!,
            dimensionsMm: {
              ...value.cargoes[0]!.dimensionsMm,
              lengthMm: 100_001,
            },
          },
        ],
      }),
      message: "schema-valid",
    },
    {
      label: "empty ID",
      change: (value: Project) => ({
        ...value,
        cargoes: [{ ...value.cargoes[0]!, id: "" }],
      }),
      message: "schema-valid",
    },
    {
      label: "empty allowed orientations",
      change: (value: Project) => ({
        ...value,
        cargoes: [{ ...value.cargoes[0]!, allowedOrientations: [] }],
      }),
      message: "schema-valid",
    },
    {
      label: "duplicate cargo ID",
      change: (value: Project) => ({
        ...value,
        cargoes: [value.cargoes[0]!, { ...value.cargoes[0]! }],
      }),
      message: "semantically valid",
    },
  ])("rejects a $label before the engine can run", ({ change, message }) => {
    const valid = project(
      [cargo("cargo-1", { lengthMm: 1, widthMm: 1, heightMm: 1 })],
      [container("container-1", { lengthMm: 1, widthMm: 1, heightMm: 1 })],
    );

    expect(() => validatedFixture(change(valid))).toThrow(message);
  });

  it("returns AP-05 no-complete-plan with zero attempts after orientation prefilter", () => {
    const item = cargo("cargo-1", {
      lengthMm: 101,
      widthMm: 100,
      heightMm: 100,
    });
    const candidates = ["container-a", "container-b"].map((id) =>
      container(
        id,
        { lengthMm: 100, widthMm: 100, heightMm: 100 },
        {
          openingMm: { widthMm: 100, heightMm: 100 },
          payloadCapacityGrams: 1_000,
        },
      ),
    );

    const result = generateAutomaticProposal(
      validatedFixture(project([item], candidates)),
    );

    expect(result).toMatchObject({
      status: "no-complete-plan",
      attempts: {
        requestAttemptCount: 0,
        candidates: [
          { containerId: "container-a", attemptCount: 0, outcome: "exhausted" },
          { containerId: "container-b", attemptCount: 0, outcome: "exhausted" },
        ],
      },
    });
    expect("plan" in result).toBe(false);
    expect("cutoffSource" in result).toBe(false);
  });

  it.each([
    { label: "no cargo with a candidate", cargoes: [], candidates: [container("c", { lengthMm: 1, widthMm: 1, heightMm: 1 })], status: "no-cargo" },
    { label: "neither cargo nor candidates", cargoes: [], candidates: [], status: "no-cargo" },
    { label: "cargo with no candidates", cargoes: [cargo("x", { lengthMm: 1, widthMm: 1, heightMm: 1 })], candidates: [], status: "no-candidates" },
  ])("returns $status for $label without attempts", ({ cargoes, candidates, status }) => {
    const result = generateAutomaticProposal(
      validatedFixture(project(cargoes, candidates)),
    );

    expect(result).toMatchObject({
      status,
      attempts: { requestAttemptCount: 0, candidates: [] },
    });
    expect("plan" in result).toBe(false);
  });

  it("ignores manual placements and does not mutate any input", () => {
    const item = cargo("cargo-1", {
      lengthMm: 50,
      widthMm: 50,
      heightMm: 50,
    });
    const candidate = container("container-1", {
      lengthMm: 100,
      widthMm: 100,
      heightMm: 100,
    });
    const mutableFixture = project([item], [candidate], {
      placements: [
        {
          cargoId: "cargo-1",
          containerId: "container-1",
          orientation: "LWH",
          positionMm: { xMm: -1, yMm: 80, zMm: 90 },
        },
      ],
    });
    const before = structuredClone(mutableFixture);
    const frozen = deepFreeze(validatedFixture(mutableFixture));

    const result = completeResult(generateAutomaticProposal(frozen));

    expect(frozen).toEqual(before);
    expect(result.plan.placements).toEqual([
      {
        cargoId: "cargo-1",
        containerId: "container-1",
        orientation: "LWH",
        positionMm: { xMm: 0, yMm: 0, zMm: 0 },
      },
    ]);
    expect(result.plan.placements).not.toBe(frozen.placements);
    expect(result.plan.placements[0]).not.toBe(frozen.placements[0]);
  });

  it("discloses fixed production limits and clamps testing limits to them", () => {
    const fixture = validatedFixture(project([], []));
    const production = generateAutomaticProposal(fixture);
    const clamped = generateAutomaticProposalForTesting(fixture, {
      candidateAttemptLimit: AUTOMATIC_PROPOSAL_CANDIDATE_ATTEMPT_LIMIT + 1,
      requestAttemptLimit: AUTOMATIC_PROPOSAL_REQUEST_ATTEMPT_LIMIT + 1,
    });
    const invalidOverrides = generateAutomaticProposalForTesting(fixture, {
      candidateAttemptLimit: -1,
      requestAttemptLimit: Number.NaN,
    });
    const expected = {
      candidateAttemptLimit: AUTOMATIC_PROPOSAL_CANDIDATE_ATTEMPT_LIMIT,
      requestAttemptLimit: AUTOMATIC_PROPOSAL_REQUEST_ATTEMPT_LIMIT,
      candidatePointLimit: AUTOMATIC_PROPOSAL_CANDIDATE_POINT_LIMIT,
    };

    expect(production.algorithmVersion).toBe(
      AUTOMATIC_PROPOSAL_ALGORITHM_VERSION,
    );
    expect(production.effectiveLimits).toEqual(expected);
    expect(clamped.effectiveLimits).toEqual(expected);
    expect(invalidOverrides.effectiveLimits).toEqual(expected);
  });
});
