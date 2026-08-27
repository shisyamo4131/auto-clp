import { describe, expect, it } from "vitest";

import {
  AUTOMATIC_PROPOSAL_ALGORITHM_VERSION,
  AUTOMATIC_PROPOSAL_CANDIDATE_ATTEMPT_LIMIT,
  AUTOMATIC_PROPOSAL_CANDIDATE_POINT_LIMIT,
  AUTOMATIC_PROPOSAL_REQUEST_ATTEMPT_LIMIT,
} from "../domain/automatic-proposal";
import { isAutomaticProposalWorkerResponse } from "./automatic-proposal-worker-protocol";

function effectiveLimits() {
  return {
    candidateAttemptLimit: AUTOMATIC_PROPOSAL_CANDIDATE_ATTEMPT_LIMIT,
    requestAttemptLimit: AUTOMATIC_PROPOSAL_REQUEST_ATTEMPT_LIMIT,
    candidatePointLimit: AUTOMATIC_PROPOSAL_CANDIDATE_POINT_LIMIT,
  };
}

function plan(containerId = "container-1") {
  return {
    containerId,
    placements: [
      {
        cargoId: "cargo-support",
        containerId,
        orientation: "LWH",
        positionMm: { xMm: 0, yMm: 0, zMm: 0 },
      },
      {
        cargoId: "cargo-upper",
        containerId,
        orientation: "WLH",
        positionMm: { xMm: -1, yMm: 1_000_000, zMm: 100 },
      },
    ],
    invalidReasonCount: 0,
    unverifiedReasons: [
      {
        status: "unverified",
        code: "opening-path-unverified",
        target: { kind: "cargo", id: "cargo-support" },
        relatedCargoIds: [],
      },
      {
        status: "unverified",
        code: "structure-stability-unverified",
        target: { kind: "cargo", id: "cargo-upper" },
        relatedCargoIds: ["cargo-support"],
      },
    ],
  } as const;
}

function completeResponse() {
  return {
    type: "automatic-proposal.ready",
    requestId: 7,
    result: {
      algorithmVersion: AUTOMATIC_PROPOSAL_ALGORITHM_VERSION,
      effectiveLimits: effectiveLimits(),
      attempts: {
        requestAttemptCount: 3,
        candidates: [
          {
            containerId: "container-1",
            attemptCount: 3,
            outcome: "complete",
          },
        ],
      },
      status: "complete",
      plan: plan(),
    },
  } as const;
}

function record(value: unknown): Record<string, unknown> {
  if (typeof value !== "object" || value === null || Array.isArray(value)) {
    throw new Error("expected test record");
  }
  return value as Record<string, unknown>;
}

function nested(value: unknown, key: string): Record<string, unknown> {
  return record(record(value)[key]);
}

function mutatedComplete(
  mutate: (response: Record<string, unknown>) => void,
): unknown {
  const value = structuredClone(completeResponse()) as unknown;
  const response = record(value);
  mutate(response);
  return value;
}

describe("isAutomaticProposalWorkerResponse", () => {
  it.each([
    {
      type: "automatic-proposal.failed",
      requestId: 1,
      code: "invalid-request",
    },
    {
      type: "automatic-proposal.failed",
      requestId: 2,
      code: "input-invalid",
    },
    {
      type: "automatic-proposal.failed",
      requestId: 3,
      code: "engine-failure",
    },
  ])("accepts exact failed response $code", (response) => {
    expect(isAutomaticProposalWorkerResponse(response)).toBe(true);
  });

  it.each([
    ["no-cargo", { requestAttemptCount: 0, candidates: [] }],
    ["no-candidates", { requestAttemptCount: 0, candidates: [] }],
    [
      "no-complete-plan",
      {
        requestAttemptCount: 1,
        candidates: [
          { containerId: "container-1", attemptCount: 1, outcome: "exhausted" },
        ],
      },
    ],
  ] as const)("accepts exact ready %s result", (status, attempts) => {
    expect(
      isAutomaticProposalWorkerResponse({
        type: "automatic-proposal.ready",
        requestId: 4,
        result: {
          algorithmVersion: AUTOMATIC_PROPOSAL_ALGORITHM_VERSION,
          effectiveLimits: effectiveLimits(),
          attempts,
          status,
        },
      }),
    ).toBe(true);
  });

  it("accepts complete plan fields, all orientations, coordinate boundaries, IDs, and unverified targets", () => {
    const response = completeResponse();
    const original = structuredClone(response);

    expect(isAutomaticProposalWorkerResponse(response)).toBe(true);
    expect(response).toEqual(original);

    for (const orientation of ["LWH", "WLH", "LHW", "HLW", "WHL", "HWL"]) {
      expect(
        isAutomaticProposalWorkerResponse(
          mutatedComplete((value) => {
            const placements = nested(nested(value, "result"), "plan")
              .placements as Array<Record<string, unknown>>;
            placements[0]!.orientation = orientation;
          }),
        ),
      ).toBe(true);
    }
  });

  it("accepts an exact candidate cutoff result", () => {
    expect(
      isAutomaticProposalWorkerResponse({
        type: "automatic-proposal.ready",
        requestId: 8,
        result: {
          algorithmVersion: AUTOMATIC_PROPOSAL_ALGORITHM_VERSION,
          effectiveLimits: effectiveLimits(),
          attempts: {
            requestAttemptCount: 10_000,
            candidates: [
              {
                containerId: "container-1",
                attemptCount: 10_000,
                outcome: "cutoff",
                cutoffSource: "candidate",
              },
            ],
          },
          status: "cutoff",
          cutoffSource: "candidate",
        },
      }),
    ).toBe(true);
  });

  it("requires at least one final-candidate attempt per placement for ordinary complete", () => {
    const withAttemptCount = (attemptCount: number) =>
      mutatedComplete((value) => {
        const attempts = nested(nested(value, "result"), "attempts");
        attempts.requestAttemptCount = attemptCount;
        const candidates = attempts.candidates as Array<Record<string, unknown>>;
        candidates[0]!.attemptCount = attemptCount;
      });

    expect(isAutomaticProposalWorkerResponse(withAttemptCount(1))).toBe(false);
    expect(isAutomaticProposalWorkerResponse(withAttemptCount(2))).toBe(true);
  });

  it("requires at least one final-candidate attempt per placement after an earlier cutoff", () => {
    const withFinalAttemptCount = (attemptCount: number) =>
      mutatedComplete((value) => {
        const result = nested(value, "result");
        result.status = "complete-with-cutoff";
        result.cutoffSource = "candidate";
        const attempts = nested(result, "attempts");
        attempts.requestAttemptCount = 10_000 + attemptCount;
        attempts.candidates = [
          {
            containerId: "container-0",
            attemptCount: 10_000,
            outcome: "cutoff",
            cutoffSource: "candidate",
          },
          {
            containerId: "container-1",
            attemptCount,
            outcome: "complete",
          },
        ];
      });

    expect(isAutomaticProposalWorkerResponse(withFinalAttemptCount(1))).toBe(
      false,
    );
    expect(isAutomaticProposalWorkerResponse(withFinalAttemptCount(2))).toBe(
      true,
    );
  });

  it("accepts 99 candidate cutoffs followed by a complete result at request attempt one million", () => {
    const candidates = Array.from({ length: 99 }, (_, index) => ({
      containerId: `container-${index.toString().padStart(3, "0")}`,
      attemptCount: 10_000,
      outcome: "cutoff" as const,
      cutoffSource: "candidate" as const,
    }));
    candidates.push({
      containerId: "container-099",
      attemptCount: 10_000,
      outcome: "complete" as "cutoff",
      cutoffSource: "candidate",
    });
    const final = candidates.at(-1) as unknown as Record<string, unknown>;
    final.outcome = "complete";
    Reflect.deleteProperty(final, "cutoffSource");

    expect(
      isAutomaticProposalWorkerResponse({
        type: "automatic-proposal.ready",
        requestId: 9,
        result: {
          algorithmVersion: AUTOMATIC_PROPOSAL_ALGORITHM_VERSION,
          effectiveLimits: effectiveLimits(),
          attempts: {
            requestAttemptCount: 1_000_000,
            candidates,
          },
          status: "complete-with-cutoff",
          cutoffSource: "candidate",
          plan: plan("container-099"),
        },
      }),
    ).toBe(true);
  });

  it("accepts a terminal both cutoff exactly at both production limits", () => {
    const candidates = Array.from({ length: 100 }, (_, index) => ({
      containerId: `container-${index.toString().padStart(3, "0")}`,
      attemptCount: 10_000,
      outcome: "cutoff" as const,
      cutoffSource: index === 99 ? ("both" as const) : ("candidate" as const),
    }));

    expect(
      isAutomaticProposalWorkerResponse({
        type: "automatic-proposal.ready",
        requestId: 10,
        result: {
          algorithmVersion: AUTOMATIC_PROPOSAL_ALGORITHM_VERSION,
          effectiveLimits: effectiveLimits(),
          attempts: { requestAttemptCount: 1_000_000, candidates },
          status: "cutoff",
          cutoffSource: "both",
        },
      }),
    ).toBe(true);
  });

  it.each([
    ["response extra", (value: Record<string, unknown>) => { value.extra = true; }],
    ["response missing", (value: Record<string, unknown>) => { Reflect.deleteProperty(value, "requestId"); }],
    ["result extra", (value: Record<string, unknown>) => { nested(value, "result").extra = true; }],
    ["limits missing", (value: Record<string, unknown>) => { Reflect.deleteProperty(nested(nested(value, "result"), "effectiveLimits"), "candidatePointLimit"); }],
    ["attempts extra", (value: Record<string, unknown>) => { nested(nested(value, "result"), "attempts").extra = true; }],
    ["candidate extra", (value: Record<string, unknown>) => { const candidates = nested(nested(value, "result"), "attempts").candidates as Array<Record<string, unknown>>; candidates[0]!.extra = true; }],
    ["plan extra", (value: Record<string, unknown>) => { nested(nested(value, "result"), "plan").extra = true; }],
    ["placement extra", (value: Record<string, unknown>) => { const placements = nested(nested(value, "result"), "plan").placements as Array<Record<string, unknown>>; placements[0]!.extra = true; }],
    ["position extra", (value: Record<string, unknown>) => { const placements = nested(nested(value, "result"), "plan").placements as Array<Record<string, unknown>>; nested(placements[0], "positionMm").extra = true; }],
    ["reason extra", (value: Record<string, unknown>) => { const reasons = nested(nested(value, "result"), "plan").unverifiedReasons as Array<Record<string, unknown>>; reasons[0]!.extra = true; }],
    ["target extra", (value: Record<string, unknown>) => { const reasons = nested(nested(value, "result"), "plan").unverifiedReasons as Array<Record<string, unknown>>; nested(reasons[0], "target").extra = true; }],
  ] as const)("rejects non-exact keys: %s", (_label, mutate) => {
    expect(isAutomaticProposalWorkerResponse(mutatedComplete(mutate))).toBe(false);
  });

  it.each([
    ["unknown response", { type: "unknown", requestId: 1 }],
    ["unknown failure", { type: "automatic-proposal.failed", requestId: 1, code: "unknown" }],
    ["unsafe request ID", { type: "automatic-proposal.failed", requestId: Number.MAX_SAFE_INTEGER + 1, code: "engine-failure" }],
    ["NaN request ID", { type: "automatic-proposal.failed", requestId: Number.NaN, code: "engine-failure" }],
  ])("rejects %s", (_label, value) => {
    expect(isAutomaticProposalWorkerResponse(value)).toBe(false);
  });

  it.each([
    ["wrong algorithm", (value: Record<string, unknown>) => { nested(value, "result").algorithmVersion = "other"; }],
    ["wrong candidate limit", (value: Record<string, unknown>) => { nested(nested(value, "result"), "effectiveLimits").candidateAttemptLimit = 9_999; }],
    ["wrong request limit", (value: Record<string, unknown>) => { nested(nested(value, "result"), "effectiveLimits").requestAttemptLimit = 999_999; }],
    ["wrong point limit", (value: Record<string, unknown>) => { nested(nested(value, "result"), "effectiveLimits").candidatePointLimit = 2_047; }],
    ["count sum mismatch", (value: Record<string, unknown>) => { nested(nested(value, "result"), "attempts").requestAttemptCount = 2; }],
    ["NaN attempt", (value: Record<string, unknown>) => { const candidates = nested(nested(value, "result"), "attempts").candidates as Array<Record<string, unknown>>; candidates[0]!.attemptCount = Number.NaN; }],
    ["unknown status", (value: Record<string, unknown>) => { nested(value, "result").status = "unknown"; }],
    ["unknown orientation", (value: Record<string, unknown>) => { const placements = nested(nested(value, "result"), "plan").placements as Array<Record<string, unknown>>; placements[0]!.orientation = "XYZ"; }],
    ["unsafe coordinate", (value: Record<string, unknown>) => { const placements = nested(nested(value, "result"), "plan").placements as Array<Record<string, unknown>>; nested(placements[0], "positionMm").xMm = 1_000_001; }],
    ["NaN coordinate", (value: Record<string, unknown>) => { const placements = nested(nested(value, "result"), "plan").placements as Array<Record<string, unknown>>; nested(placements[0], "positionMm").xMm = Number.NaN; }],
    ["unknown reason", (value: Record<string, unknown>) => { const reasons = nested(nested(value, "result"), "plan").unverifiedReasons as Array<Record<string, unknown>>; reasons[0]!.code = "unknown"; }],
    ["unknown reason target", (value: Record<string, unknown>) => { const reasons = nested(nested(value, "result"), "plan").unverifiedReasons as Array<Record<string, unknown>>; nested(reasons[0], "target").id = "cargo-unknown"; }],
    ["duplicate placement cargo", (value: Record<string, unknown>) => { const placements = nested(nested(value, "result"), "plan").placements as Array<Record<string, unknown>>; placements[1]!.cargoId = placements[0]!.cargoId; }],
    ["placement container mismatch", (value: Record<string, unknown>) => { const placements = nested(nested(value, "result"), "plan").placements as Array<Record<string, unknown>>; placements[1]!.containerId = "container-other"; }],
  ] as const)("rejects malformed result: %s", (_label, mutate) => {
    expect(isAutomaticProposalWorkerResponse(mutatedComplete(mutate))).toBe(false);
  });

  it("rejects unbounded candidate, placement, and reason arrays", () => {
    const tooManyCandidates = mutatedComplete((value) => {
      nested(nested(value, "result"), "attempts").candidates = Array.from(
        { length: 101 },
        (_, index) => ({
          containerId: `c-${index}`,
          attemptCount: 0,
          outcome: "exhausted",
        }),
      );
      nested(nested(value, "result"), "attempts").requestAttemptCount = 0;
      nested(value, "result").status = "no-complete-plan";
      Reflect.deleteProperty(nested(value, "result"), "plan");
    });
    const tooManyPlacements = mutatedComplete((value) => {
      nested(nested(value, "result"), "plan").placements = Array.from(
        { length: 1_001 },
        (_, index) => ({
          cargoId: `c-${index}`,
          containerId: "container-1",
          orientation: "LWH",
          positionMm: { xMm: 0, yMm: 0, zMm: 0 },
        }),
      );
    });
    const tooManyReasons = mutatedComplete((value) => {
      const proposalPlan = nested(nested(value, "result"), "plan");
      proposalPlan.unverifiedReasons = [
        ...((proposalPlan.unverifiedReasons as unknown[]) ?? []),
        {
          status: "unverified",
          code: "opening-path-unverified",
          target: { kind: "cargo", id: "cargo-upper" },
          relatedCargoIds: [],
        },
        {
          status: "unverified",
          code: "opening-path-unverified",
          target: { kind: "cargo", id: "cargo-support" },
          relatedCargoIds: [],
        },
        {
          status: "unverified",
          code: "structure-stability-unverified",
          target: { kind: "cargo", id: "cargo-support" },
          relatedCargoIds: ["cargo-upper"],
        },
      ];
    });

    expect(isAutomaticProposalWorkerResponse(tooManyCandidates)).toBe(false);
    expect(isAutomaticProposalWorkerResponse(tooManyPlacements)).toBe(false);
    expect(isAutomaticProposalWorkerResponse(tooManyReasons)).toBe(false);
  });

  it.each([
    [
      "request cutoff below request limit",
      {
        containerId: "container-1",
        attemptCount: 9_999,
        outcome: "cutoff",
        cutoffSource: "request",
      },
      9_999,
    ],
    [
      "both cutoff below request limit",
      {
        containerId: "container-1",
        attemptCount: 10_000,
        outcome: "cutoff",
        cutoffSource: "both",
      },
      10_000,
    ],
  ] as const)("rejects %s", (_label, candidate, requestAttemptCount) => {
    expect(
      isAutomaticProposalWorkerResponse({
        type: "automatic-proposal.ready",
        requestId: 11,
        result: {
          algorithmVersion: AUTOMATIC_PROPOSAL_ALGORITHM_VERSION,
          effectiveLimits: effectiveLimits(),
          attempts: { requestAttemptCount, candidates: [candidate] },
          status: "cutoff",
          cutoffSource: candidate.cutoffSource,
        },
      }),
    ).toBe(false);
  });

  it("rejects candidate summaries after a terminal request/both cutoff", () => {
    const candidates = Array.from({ length: 100 }, (_, index) => ({
      containerId: `container-${index.toString().padStart(3, "0")}`,
      attemptCount: 10_000,
      outcome: "cutoff" as const,
      cutoffSource: index === 99 ? ("both" as const) : ("candidate" as const),
    }));
    candidates.push({
      containerId: "container-after",
      attemptCount: 0,
      outcome: "cutoff",
      cutoffSource: "candidate",
    });

    expect(
      isAutomaticProposalWorkerResponse({
        type: "automatic-proposal.ready",
        requestId: 12,
        result: {
          algorithmVersion: AUTOMATIC_PROPOSAL_ALGORITHM_VERSION,
          effectiveLimits: effectiveLimits(),
          attempts: { requestAttemptCount: 1_000_000, candidates },
          status: "cutoff",
          cutoffSource: "both",
        },
      }),
    ).toBe(false);
  });

  it.each([
    ["no-cargo with attempts", { status: "no-cargo", keepPlan: false }],
    ["complete without plan", { status: "complete", keepPlan: false }],
    ["plain complete with cutoff summary", { status: "complete", keepPlan: true, cutoff: true }],
    ["complete-with-cutoff without cutoff summary", { status: "complete-with-cutoff", keepPlan: true }],
  ] as const)("rejects status/plan/cutoff contradiction: %s", (_label, change) => {
    const value = mutatedComplete((response) => {
      const result = nested(response, "result");
      result.status = change.status;
      if (!change.keepPlan) {
        Reflect.deleteProperty(result, "plan");
      }
      if ("cutoff" in change && change.cutoff) {
        const candidates = nested(result, "attempts").candidates as Array<Record<string, unknown>>;
        candidates.unshift({
          containerId: "container-0",
          attemptCount: 10_000,
          outcome: "cutoff",
          cutoffSource: "candidate",
        });
        nested(result, "attempts").requestAttemptCount = 10_003;
      }
      if (change.status === "complete-with-cutoff") {
        result.cutoffSource = "candidate";
      }
    });

    expect(isAutomaticProposalWorkerResponse(value)).toBe(false);
  });
});
