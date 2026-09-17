import { describe, expect, it } from "vitest";
import {
  LOADING_SEQUENCE_ALGORITHM_VERSION,
  orderLoadingSequenceGraph,
  proposeLoadingSequence,
} from "./loading-sequence";
import type { Cargo, Container, Placement, Project } from "./model";

function cargo(
  id: string,
  overrides: Partial<Cargo> = {},
): Cargo {
  return {
    id,
    name: id,
    dimensionsMm: { lengthMm: 100, widthMm: 100, heightMm: 100 },
    massGrams: 1_000,
    canSupportCargo: true,
    allowedOrientations: ["LWH", "WLH", "LHW", "HLW", "WHL", "HWL"],
    ...overrides,
  };
}

function container(id = "container-1"): Container {
  return {
    id,
    name: id,
    internalDimensionsMm: {
      lengthMm: 10_000,
      widthMm: 10_000,
      heightMm: 10_000,
    },
    openingMm: { widthMm: 10_000, heightMm: 10_000 },
    payloadCapacityGrams: 1_000_000,
  };
}

function placement(
  cargoId: string,
  xMm: number,
  yMm: number,
  zMm = 0,
  containerId = "container-1",
): Placement {
  return {
    cargoId,
    containerId,
    positionMm: { xMm, yMm, zMm },
    orientation: "LWH",
  };
}

function project(
  cargoes: readonly Cargo[],
  placements: readonly Placement[],
  containers: readonly Container[] = [container()],
): Project {
  return {
    schemaVersion: "0.1.0",
    projectId: "project-1",
    name: "匿名テスト",
    clearancesMm: { xMm: 0, yMm: 0, zMm: 0 },
    cargoes,
    containers,
    placements,
  };
}

function availableSequence(result: ReturnType<typeof proposeLoadingSequence>) {
  expect(result.status).toBe("available");
  if (result.status !== "available") {
    throw new Error(`Expected available result, received ${result.status}`);
  }
  return result;
}

function unavailableReason(result: ReturnType<typeof proposeLoadingSequence>) {
  expect(result.status).toBe("unavailable");
  if (result.status !== "unavailable") {
    throw new Error(`Expected unavailable result, received ${result.status}`);
  }
  return result.reason;
}

describe("proposeLoadingSequence", () => {
  it("returns an explicit empty state for a container without placements", () => {
    expect(proposeLoadingSequence(project([], []), "container-1")).toEqual({
      status: "empty",
      algorithmVersion: LOADING_SEQUENCE_ALGORITHM_VERSION,
      containerId: "container-1",
    });
  });

  it("rejects a missing or ambiguous container reference", () => {
    expect(
      unavailableReason(proposeLoadingSequence(project([], []), "missing")),
    ).toEqual({
      code: "loading-sequence.container-reference-invalid",
      relatedCargoIds: [],
    });
    expect(
      unavailableReason(
        proposeLoadingSequence(
          project([], [], [container(), container()]),
          "container-1",
        ),
      ),
    ).toEqual({
      code: "loading-sequence.container-reference-invalid",
      relatedCargoIds: [],
    });
  });

  it("rejects missing, ambiguous, and duplicate placed cargo references", () => {
    expect(
      unavailableReason(
        proposeLoadingSequence(
          project([cargo("cargo-a")], [placement("missing", 0, 0)]),
          "container-1",
        ),
      ),
    ).toEqual({
      code: "loading-sequence.cargo-reference-invalid",
      relatedCargoIds: ["missing"],
    });

    expect(
      unavailableReason(
        proposeLoadingSequence(
          project(
            [cargo("cargo-a"), cargo("cargo-a")],
            [placement("cargo-a", 0, 0)],
          ),
          "container-1",
        ),
      ),
    ).toEqual({
      code: "loading-sequence.cargo-reference-invalid",
      relatedCargoIds: ["cargo-a"],
    });

    expect(
      unavailableReason(
        proposeLoadingSequence(
          project(
            [cargo("cargo-a")],
            [placement("cargo-a", 0, 0), placement("cargo-a", 200, 0)],
          ),
          "container-1",
        ),
      ),
    ).toEqual({
      code: "loading-sequence.cargo-reference-invalid",
      relatedCargoIds: ["cargo-a"],
    });
  });

  it("rejects disallowed orientations and unsafe oriented bounds", () => {
    const uprightOnly = cargo("cargo-a", { allowedOrientations: ["WLH"] });
    expect(
      unavailableReason(
        proposeLoadingSequence(
          project([uprightOnly], [placement("cargo-a", 0, 0)]),
          "container-1",
        ),
      ),
    ).toEqual({
      code: "loading-sequence.geometry-calculation-unavailable",
      relatedCargoIds: ["cargo-a"],
    });

    expect(
      unavailableReason(
        proposeLoadingSequence(
          project(
            [cargo("cargo-a")],
            [placement("cargo-a", Number.MAX_SAFE_INTEGER, 0)],
          ),
          "container-1",
        ),
      ),
    ).toEqual({
      code: "loading-sequence.geometry-calculation-unavailable",
      relatedCargoIds: ["cargo-a"],
    });
  });

  it("rejects positive-volume overlap but allows face contact", () => {
    const cargoes = [cargo("cargo-a"), cargo("cargo-b")];
    expect(
      unavailableReason(
        proposeLoadingSequence(
          project(cargoes, [
            placement("cargo-a", 0, 0),
            placement("cargo-b", 99, 0),
          ]),
          "container-1",
        ),
      ),
    ).toEqual({
      code: "loading-sequence.positive-volume-overlap",
      relatedCargoIds: ["cargo-a", "cargo-b"],
    });

    expect(
      availableSequence(
        proposeLoadingSequence(
          project(cargoes, [
            placement("cargo-a", 0, 0),
            placement("cargo-b", 100, 0),
          ]),
          "container-1",
        ),
      ).sequence.map((step) => step.cargoId),
    ).toEqual(["cargo-b", "cargo-a"]);
  });

  it("reports every overlapping cargo deterministically", () => {
    const cargoes = [cargo("cargo-c"), cargo("cargo-a"), cargo("cargo-b")];
    const placements = [
      placement("cargo-c", 50, 0),
      placement("cargo-a", 0, 0),
      placement("cargo-b", 25, 0),
    ];
    const first = unavailableReason(
      proposeLoadingSequence(project(cargoes, placements), "container-1"),
    );
    const second = unavailableReason(
      proposeLoadingSequence(
        project([...cargoes].reverse(), [...placements].reverse()),
        "container-1",
      ),
    );
    expect(first).toEqual({
      code: "loading-sequence.positive-volume-overlap",
      relatedCargoIds: ["cargo-a", "cargo-b", "cargo-c"],
    });
    expect(second).toEqual(first);
  });

  it("loads a deeper cargo before a front blocker in the same Y/Z corridor", () => {
    const result = availableSequence(
      proposeLoadingSequence(
        project(
          [cargo("front"), cargo("back")],
          [placement("front", 100, 0), placement("back", 300, 0)],
        ),
        "container-1",
      ),
    );

    expect(result.sequence).toEqual([
      { sequenceNumber: 1, cargoId: "back", predecessorCargoIds: [] },
      {
        sequenceNumber: 2,
        cargoId: "front",
        predecessorCargoIds: ["back"],
      },
    ]);
    expect(result.precedences).toEqual([
      {
        beforeCargoId: "back",
        afterCargoId: "front",
        reasons: ["access"],
      },
    ]);
  });

  it("does not create access precedence for separated Y/Z intervals or boundary contact", () => {
    const result = availableSequence(
      proposeLoadingSequence(
        project(
          [cargo("cargo-a"), cargo("cargo-b"), cargo("cargo-c")],
          [
            placement("cargo-a", 300, 0),
            placement("cargo-b", 100, 100),
            placement("cargo-c", 0, 200),
          ],
        ),
        "container-1",
      ),
    );
    expect(result.precedences).toEqual([]);
    expect(result.sequence.map((step) => step.cargoId)).toEqual([
      "cargo-a",
      "cargo-b",
      "cargo-c",
    ]);
  });

  it("loads an exact single supporter before the upper cargo", () => {
    const result = availableSequence(
      proposeLoadingSequence(
        project(
          [cargo("lower"), cargo("upper")],
          [placement("upper", 300, 0, 100), placement("lower", 300, 0)],
        ),
        "container-1",
      ),
    );
    expect(result.sequence.map((step) => step.cargoId)).toEqual([
      "lower",
      "upper",
    ]);
    expect(result.precedences).toEqual([
      {
        beforeCargoId: "lower",
        afterCargoId: "upper",
        reasons: ["support"],
      },
    ]);
    expect(result.warnings).toEqual([]);
  });

  it("loads all multiple supports first and marks the support conditions unverified", () => {
    const left = cargo("left", {
      dimensionsMm: { lengthMm: 50, widthMm: 100, heightMm: 100 },
    });
    const right = cargo("right", {
      dimensionsMm: { lengthMm: 50, widthMm: 100, heightMm: 100 },
    });
    const upper = cargo("upper");
    const result = availableSequence(
      proposeLoadingSequence(
        project(
          [upper, right, left],
          [
            placement("upper", 300, 0, 100),
            placement("right", 350, 0),
            placement("left", 300, 0),
          ],
        ),
        "container-1",
      ),
    );

    expect(result.sequence.map((step) => step.cargoId)).toEqual([
      "right",
      "left",
      "upper",
    ]);
    expect(result.warnings).toEqual([
      {
        code: "loading-sequence.support-conditions-unverified",
        targetCargoId: "upper",
        relatedCargoIds: ["left", "right"],
      },
    ]);
  });

  it("marks one eligible partial contact unverified while preserving order", () => {
    const supporter = cargo("support", {
      dimensionsMm: { lengthMm: 50, widthMm: 100, heightMm: 100 },
    });
    const result = availableSequence(
      proposeLoadingSequence(
        project(
          [supporter, cargo("upper")],
          [placement("support", 300, 0), placement("upper", 300, 0, 100)],
        ),
        "container-1",
      ),
    );
    expect(result.sequence.map((step) => step.cargoId)).toEqual([
      "support",
      "upper",
    ]);
    expect(result.warnings).toEqual([
      {
        code: "loading-sequence.support-conditions-unverified",
        targetCargoId: "upper",
        relatedCargoIds: ["support"],
      },
    ]);
  });

  it("keeps support-prohibited contact as precedence without duplicating physical status", () => {
    const result = availableSequence(
      proposeLoadingSequence(
        project(
          [cargo("support", { canSupportCargo: false }), cargo("upper")],
          [placement("support", 300, 0), placement("upper", 300, 0, 100)],
        ),
        "container-1",
      ),
    );
    expect(result.sequence.map((step) => step.cargoId)).toEqual([
      "support",
      "upper",
    ]);
    expect(result.warnings).toEqual([]);
  });

  it("rejects elevated cargo without positive-area support contact", () => {
    expect(
      unavailableReason(
        proposeLoadingSequence(
          project([cargo("upper")], [placement("upper", 300, 0, 100)]),
          "container-1",
        ),
      ),
    ).toEqual({
      code: "loading-sequence.support-contact-missing",
      relatedCargoIds: ["upper"],
    });
  });

  it("reports all unsupported elevated cargoes in deterministic order", () => {
    const cargoes = [cargo("upper-b"), cargo("upper-a")];
    const placements = [
      placement("upper-b", 300, 0, 100),
      placement("upper-a", 0, 200, 100),
    ];
    expect(
      unavailableReason(
        proposeLoadingSequence(
          project([...cargoes].reverse(), [...placements].reverse()),
          "container-1",
        ),
      ),
    ).toEqual({
      code: "loading-sequence.support-contact-missing",
      relatedCargoIds: ["upper-a", "upper-b"],
    });
  });

  it("ignores placements belonging to another container", () => {
    const result = availableSequence(
      proposeLoadingSequence(
        project(
          [cargo("selected"), cargo("other")],
          [
            placement("selected", 0, 0),
            placement("other", 0, 0, 500, "container-2"),
          ],
          [container(), container("container-2")],
        ),
        "container-1",
      ),
    );
    expect(result.sequence.map((step) => step.cargoId)).toEqual(["selected"]);
  });

  it("returns the same proposal for permuted input arrays", () => {
    const cargoes = [cargo("front"), cargo("back"), cargo("side")];
    const placements = [
      placement("front", 100, 0),
      placement("back", 300, 0),
      placement("side", 200, 200),
    ];
    const first = proposeLoadingSequence(
      project(cargoes, placements),
      "container-1",
    );
    const second = proposeLoadingSequence(
      project([...cargoes].reverse(), [...placements].reverse()),
      "container-1",
    );
    expect(second).toEqual(first);
  });

  it("orders a deterministic 30-cargo synthetic case", () => {
    const cargoes = Array.from({ length: 30 }, (_, index) =>
      cargo(`cargo-${String(index + 1).padStart(2, "0")}`),
    );
    const placements = cargoes.map((item, index) =>
      placement(item.id, (index % 5) * 200, Math.floor(index / 5) * 200),
    );
    const first = availableSequence(
      proposeLoadingSequence(project(cargoes, placements), "container-1"),
    );
    const second = availableSequence(
      proposeLoadingSequence(
        project([...cargoes].reverse(), [...placements].reverse()),
        "container-1",
      ),
    );
    expect(first.sequence).toHaveLength(30);
    expect(second).toEqual(first);
  });
});

describe("orderLoadingSequenceGraph", () => {
  const candidates = [
    { cargoId: "cargo-a", minXmm: 300, minYmm: 100, minZmm: 0 },
    { cargoId: "cargo-b", minXmm: 300, minYmm: 0, minZmm: 0 },
    { cargoId: "cargo-c", minXmm: 300, minYmm: 0, minZmm: 100 },
    { cargoId: "cargo-d", minXmm: 100, minYmm: 0, minZmm: 0 },
  ] as const;

  it("uses X descending, Z ascending, Y ascending, then cargo ID", () => {
    expect(orderLoadingSequenceGraph(candidates, [])).toEqual({
      orderedCargoIds: ["cargo-b", "cargo-a", "cargo-c", "cargo-d"],
    });
  });

  it("honors precedences before applying the deterministic tie-break", () => {
    expect(
      orderLoadingSequenceGraph(candidates, [
        { beforeCargoId: "cargo-d", afterCargoId: "cargo-b" },
      ]),
    ).toEqual({
      orderedCargoIds: ["cargo-a", "cargo-c", "cargo-d", "cargo-b"],
    });
  });

  it("returns the deterministic cargo set participating in a cycle", () => {
    expect(
      orderLoadingSequenceGraph(candidates, [
        { beforeCargoId: "cargo-a", afterCargoId: "cargo-b" },
        { beforeCargoId: "cargo-b", afterCargoId: "cargo-c" },
        { beforeCargoId: "cargo-c", afterCargoId: "cargo-a" },
      ]),
    ).toEqual({ cycleCargoIds: ["cargo-a", "cargo-b", "cargo-c"] });
  });
});
