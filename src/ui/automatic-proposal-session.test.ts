import { describe, expect, it, vi } from "vitest";

import {
  AUTOMATIC_PROPOSAL_ALGORITHM_VERSION,
  AUTOMATIC_PROPOSAL_CANDIDATE_ATTEMPT_LIMIT,
  AUTOMATIC_PROPOSAL_CANDIDATE_POINT_LIMIT,
  AUTOMATIC_PROPOSAL_REQUEST_ATTEMPT_LIMIT,
  type AutomaticProposalResult,
} from "../domain/automatic-proposal";
import { PROJECT_SCHEMA_VERSION, type Project } from "../domain/model";
import type {
  AutomaticProposalWorkerClientResult,
  AutomaticProposalWorkerHandle,
} from "./automatic-proposal-worker-client";
import { createAutomaticProposalSession } from "./automatic-proposal-session";

function projectFixture(id = "project-1"): Project {
  return {
    schemaVersion: PROJECT_SCHEMA_VERSION,
    projectId: id,
    name: `anonymous-${id}`,
    clearancesMm: { xMm: 0, yMm: 0, zMm: 0 },
    cargoes: [],
    containers: [],
    placements: [],
  };
}

function noCargoResult(): AutomaticProposalResult {
  return {
    algorithmVersion: AUTOMATIC_PROPOSAL_ALGORITHM_VERSION,
    effectiveLimits: {
      candidateAttemptLimit: AUTOMATIC_PROPOSAL_CANDIDATE_ATTEMPT_LIMIT,
      requestAttemptLimit: AUTOMATIC_PROPOSAL_REQUEST_ATTEMPT_LIMIT,
      candidatePointLimit: AUTOMATIC_PROPOSAL_CANDIDATE_POINT_LIMIT,
    },
    attempts: { requestAttemptCount: 0, candidates: [] },
    status: "no-cargo",
  };
}

function completeResult(): AutomaticProposalResult {
  return {
    algorithmVersion: AUTOMATIC_PROPOSAL_ALGORITHM_VERSION,
    effectiveLimits: {
      candidateAttemptLimit: AUTOMATIC_PROPOSAL_CANDIDATE_ATTEMPT_LIMIT,
      requestAttemptLimit: AUTOMATIC_PROPOSAL_REQUEST_ATTEMPT_LIMIT,
      candidatePointLimit: AUTOMATIC_PROPOSAL_CANDIDATE_POINT_LIMIT,
    },
    attempts: {
      requestAttemptCount: 1,
      candidates: [
        { containerId: "container-1", attemptCount: 1, outcome: "complete" },
      ],
    },
    status: "complete",
    plan: {
      containerId: "container-1",
      placements: [
        {
          cargoId: "cargo-1",
          containerId: "container-1",
          orientation: "LWH",
          positionMm: { xMm: 0, yMm: 0, zMm: 0 },
        },
      ],
      invalidReasonCount: 0,
      unverifiedReasons: [],
    },
  };
}

interface ControlledHandle extends AutomaticProposalWorkerHandle {
  readonly resolve: (result: AutomaticProposalWorkerClientResult) => void;
  readonly reject: (reason?: unknown) => void;
  readonly cancelSpy: ReturnType<typeof vi.fn>;
  readonly terminateSpy: ReturnType<typeof vi.fn>;
}

function controlledHandle(options: { cancelThrows?: boolean } = {}): ControlledHandle {
  let resolve!: (result: AutomaticProposalWorkerClientResult) => void;
  let reject!: (reason?: unknown) => void;
  const result = new Promise<AutomaticProposalWorkerClientResult>((accept, fail) => {
    resolve = accept;
    reject = fail;
  });
  const cancelSpy = vi.fn(() => {
    if (options.cancelThrows) {
      throw new Error("cancel failed");
    }
  });
  const terminateSpy = vi.fn();
  return {
    result,
    cancel: cancelSpy,
    terminate: terminateSpy,
    resolve,
    reject,
    cancelSpy,
    terminateSpy,
  };
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

describe("createAutomaticProposalSession", () => {
  it("keeps blocked start idle without constructing a Worker", () => {
    const startWorker = vi.fn();
    const session = createAutomaticProposalSession({
      readContext: () => ({
        project: projectFixture(),
        interactionGeneration: 1,
        startBlocked: true,
      }),
      startWorker,
    });

    expect(session.start()).toBe(false);
    expect(session.getSnapshot()).toEqual({ phase: "idle" });
    expect(startWorker).not.toHaveBeenCalled();
  });

  it("starts with the exact Project reference and interaction generation without mutation", () => {
    const project = deepFreeze(projectFixture());
    const before = structuredClone(project);
    const handle = controlledHandle();
    const startWorker = vi.fn(() => handle);
    const session = createAutomaticProposalSession({
      readContext: () => ({ project, interactionGeneration: 7, startBlocked: false }),
      startWorker,
    });

    expect(session.start()).toBe(true);

    expect(startWorker).toHaveBeenCalledOnce();
    expect(startWorker).toHaveBeenCalledWith(project);
    expect(session.getSnapshot()).toEqual({
      phase: "running",
      sourceProject: project,
      interactionGeneration: 7,
      identity: 1,
    });
    expect(project).toEqual(before);
  });

  it.each([
    ["ready", { kind: "ready", result: noCargoResult() }],
    [
      "failed",
      {
        kind: "failed",
        code: "automatic-proposal.engine-failure",
      },
    ],
    ["cancelled", { kind: "cancelled" }],
  ] as const)("settles Worker %s", async (_label, completion) => {
    const project = projectFixture();
    const handle = controlledHandle();
    const session = createAutomaticProposalSession({
      readContext: () => ({ project, interactionGeneration: 1, startBlocked: false }),
      startWorker: () => handle,
    });
    session.start();

    handle.resolve(completion);
    await Promise.resolve();

    if (completion.kind === "ready") {
      expect(session.getSnapshot()).toEqual({
        phase: "ready",
        sourceProject: project,
        interactionGeneration: 1,
        identity: 1,
        result: completion.result,
      });
    } else if (completion.kind === "failed") {
      expect(session.getSnapshot()).toEqual({
        phase: "failed",
        code: completion.code,
      });
    } else {
      expect(session.getSnapshot()).toEqual({ phase: "cancelled" });
    }
  });

  it.each(["project", "generation"] as const)(
    "marks completion stale after a %s race",
    async (change) => {
      const firstProject = projectFixture("first");
      const secondProject = projectFixture("second");
      let project = firstProject;
      let generation = 1;
      const handle = controlledHandle();
      const session = createAutomaticProposalSession({
        readContext: () => ({ project, interactionGeneration: generation, startBlocked: false }),
        startWorker: () => handle,
      });
      session.start();
      if (change === "project") {
        project = secondProject;
      } else {
        generation = 2;
      }

      handle.resolve({ kind: "ready", result: noCargoResult() });
      await Promise.resolve();

      expect(session.getSnapshot()).toEqual({ phase: "stale" });
    },
  );

  it.each([
    ["running", "project"],
    ["running", "generation"],
    ["ready", "project"],
    ["ready", "generation"],
  ] as const)("sync marks %s stale after %s-only change", async (phase, change) => {
    const firstProject = projectFixture("first");
    const secondProject = projectFixture("second");
    let project = firstProject;
    let generation = 1;
    const handle = controlledHandle();
    const session = createAutomaticProposalSession({
      readContext: () => ({ project, interactionGeneration: generation, startBlocked: false }),
      startWorker: () => handle,
    });
    session.start();
    if (phase === "ready") {
      handle.resolve({ kind: "ready", result: noCargoResult() });
      await Promise.resolve();
    }
    if (change === "project") {
      project = secondProject;
    } else {
      generation = 2;
    }

    session.sync();

    expect(session.getSnapshot()).toEqual({ phase: "stale" });
    expect(handle.cancelSpy).toHaveBeenCalledTimes(phase === "running" ? 1 : 0);
  });

  it.each(["running", "ready"] as const)(
    "sync is a no-op for an unchanged %s context",
    async (phase) => {
      const project = projectFixture();
      const handle = controlledHandle();
      const session = createAutomaticProposalSession({
        readContext: () => ({ project, interactionGeneration: 1, startBlocked: false }),
        startWorker: () => handle,
      });
      session.start();
      if (phase === "ready") {
        handle.resolve({ kind: "ready", result: noCargoResult() });
        await Promise.resolve();
      }
      const before = session.getSnapshot();

      session.sync();

      expect(session.getSnapshot()).toBe(before);
      expect(handle.cancelSpy).not.toHaveBeenCalled();
    },
  );

  it("cancels idempotently and calls the active handle once", () => {
    const project = projectFixture();
    const handle = controlledHandle();
    const session = createAutomaticProposalSession({
      readContext: () => ({ project, interactionGeneration: 1, startBlocked: false }),
      startWorker: () => handle,
    });
    session.start();

    session.cancel();
    session.cancel();

    expect(session.getSnapshot()).toEqual({ phase: "cancelled" });
    expect(handle.cancelSpy).toHaveBeenCalledTimes(1);
    expect(handle.terminateSpy).not.toHaveBeenCalled();
  });

  it("falls back to terminate once when cancel throws", () => {
    const project = projectFixture();
    const handle = controlledHandle({ cancelThrows: true });
    const session = createAutomaticProposalSession({
      readContext: () => ({ project, interactionGeneration: 1, startBlocked: false }),
      startWorker: () => handle,
    });
    session.start();

    session.cancel();

    expect(session.getSnapshot()).toEqual({ phase: "cancelled" });
    expect(handle.cancelSpy).toHaveBeenCalledOnce();
    expect(handle.terminateSpy).toHaveBeenCalledOnce();
  });

  it.each(["stale", "cancelled"] as const)(
    "listener can retry immediately after old handle stops on %s",
    (transition) => {
      const firstProject = projectFixture("first");
      const secondProject = projectFixture("second");
      let project = firstProject;
      const first = controlledHandle();
      const second = controlledHandle();
      const events: string[] = [];
      first.cancelSpy.mockImplementation(() => events.push("old-stopped"));
      const startWorker = vi
        .fn()
        .mockImplementationOnce(() => {
          events.push("old-started");
          return first;
        })
        .mockImplementationOnce(() => {
          events.push("new-started");
          return second;
        });
      const session = createAutomaticProposalSession({
        readContext: () => ({ project, interactionGeneration: 1, startBlocked: false }),
        startWorker,
      });
      session.subscribe(() => {
        if (session.getSnapshot().phase === transition) {
          expect(session.retry()).toBe(true);
        }
      });
      session.start();
      if (transition === "stale") {
        project = secondProject;
        session.sync();
      } else {
        session.cancel();
      }

      expect(events).toEqual(["old-started", "old-stopped", "new-started"]);
      expect(session.getSnapshot()).toMatchObject({
        phase: "running",
        sourceProject: project,
        identity: 2,
      });
    },
  );

  it("registers completion before a running listener throws and settles later safely", async () => {
    const project = projectFixture();
    const handle = controlledHandle();
    const session = createAutomaticProposalSession({
      readContext: () => ({ project, interactionGeneration: 1, startBlocked: false }),
      startWorker: () => handle,
    });
    session.subscribe(() => {
      if (session.getSnapshot().phase === "running") {
        throw new Error("listener failed");
      }
    });

    expect(() => session.start()).toThrow("listener failed");
    expect(session.getSnapshot().phase).toBe("running");

    handle.resolve({ kind: "ready", result: noCargoResult() });
    await Promise.resolve();
    expect(session.getSnapshot().phase).toBe("ready");
  });

  it("ignores an obsolete completion after retry", async () => {
    const firstProject = projectFixture("first");
    const secondProject = projectFixture("second");
    let project = firstProject;
    const first = controlledHandle();
    const second = controlledHandle();
    const startWorker = vi.fn().mockReturnValueOnce(first).mockReturnValueOnce(second);
    const session = createAutomaticProposalSession({
      readContext: () => ({ project, interactionGeneration: 1, startBlocked: false }),
      startWorker,
    });
    session.start();
    project = secondProject;
    session.sync();
    session.retry();

    first.resolve({ kind: "ready", result: noCargoResult() });
    await Promise.resolve();
    expect(session.getSnapshot()).toMatchObject({ phase: "running", identity: 2 });

    second.resolve({ kind: "ready", result: noCargoResult() });
    await Promise.resolve();
    expect(session.getSnapshot()).toMatchObject({
      phase: "ready",
      sourceProject: secondProject,
      identity: 2,
    });
  });

  it("dispose terminates once, clears listeners, and ignores late completion", async () => {
    const project = projectFixture();
    const handle = controlledHandle();
    const listener = vi.fn();
    const session = createAutomaticProposalSession({
      readContext: () => ({ project, interactionGeneration: 1, startBlocked: false }),
      startWorker: () => handle,
    });
    session.subscribe(listener);
    session.start();
    listener.mockClear();

    session.dispose();
    session.dispose();
    handle.resolve({ kind: "ready", result: noCargoResult() });
    await Promise.resolve();

    expect(handle.terminateSpy).toHaveBeenCalledOnce();
    expect(listener).not.toHaveBeenCalled();
    expect(session.start()).toBe(false);
  });

  it("supports subscribe and unsubscribe without duplicate notification", () => {
    const project = projectFixture();
    const handle = controlledHandle();
    const first = vi.fn();
    const second = vi.fn();
    const session = createAutomaticProposalSession({
      readContext: () => ({ project, interactionGeneration: 1, startBlocked: false }),
      startWorker: () => handle,
    });
    const unsubscribe = session.subscribe(first);
    session.subscribe(second);
    unsubscribe();

    session.start();

    expect(first).not.toHaveBeenCalled();
    expect(second).toHaveBeenCalledOnce();
  });

  it.each([
    ["reader throws", () => { throw new Error("reader failed"); }],
    ["fractional generation", () => ({ project: projectFixture(), interactionGeneration: 1.5, startBlocked: false })],
    ["negative generation", () => ({ project: projectFixture(), interactionGeneration: -1, startBlocked: false })],
    ["invalid project", () => ({ project: null, interactionGeneration: 1, startBlocked: false })],
    ["invalid blocked flag", () => ({ project: projectFixture(), interactionGeneration: 1, startBlocked: "no" })],
  ])("rejects invalid context: %s", (_label, readContext) => {
    const startWorker = vi.fn();
    const session = createAutomaticProposalSession({
      readContext: readContext as never,
      startWorker,
    });

    expect(session.start()).toBe(false);
    expect(session.getSnapshot()).toEqual({
      phase: "failed",
      code: "automatic-proposal.session-start-failed",
    });
    expect(startWorker).not.toHaveBeenCalled();
  });

  it("normalizes a synchronous starter throw", () => {
    const project = projectFixture();
    const session = createAutomaticProposalSession({
      readContext: () => ({ project, interactionGeneration: 1, startBlocked: false }),
      startWorker: () => {
        throw new Error("starter failed");
      },
    });

    expect(session.start()).toBe(false);
    expect(session.getSnapshot()).toEqual({
      phase: "failed",
      code: "automatic-proposal.session-start-failed",
    });
  });

  it("claims one ready identity exactly once and drops the full result after changed apply", async () => {
    const source = projectFixture();
    const applied = { ...source, name: "applied" };
    let project = source;
    let generation = 3;
    const handle = controlledHandle();
    const summary = {
      containerId: "container-1",
      placementCount: 1,
      replacedPlacementCount: 0,
      unverifiedReasonCount: 0,
    };
    const applyProposal = vi.fn(() => {
      project = applied;
      generation = 4;
      return {
        kind: "changed" as const,
        project: applied,
        interactionGeneration: 4,
        summary,
      };
    });
    const phases: string[] = [];
    const session = createAutomaticProposalSession({
      readContext: () => ({ project, interactionGeneration: generation, startBlocked: false }),
      startWorker: () => handle,
      applyProposal,
    });
    session.subscribe(() => phases.push(session.getSnapshot().phase));
    session.start();
    const result = completeResult();
    handle.resolve({ kind: "ready", result });
    await Promise.resolve();

    expect(session.apply(0)).toBe(false);
    expect(applyProposal).not.toHaveBeenCalled();
    expect(session.apply(1)).toBe(true);
    expect(session.apply(1)).toBe(false);
    expect(applyProposal).toHaveBeenCalledOnce();
    expect(applyProposal).toHaveBeenCalledWith({
      sourceProject: source,
      interactionGeneration: 3,
      identity: 1,
      result,
    });
    expect(phases).toContain("applying");
    expect(session.getSnapshot()).toEqual({
      phase: "applied",
      currentProject: applied,
      interactionGeneration: 4,
      identity: 1,
      summary,
    });
    expect(JSON.stringify(session.getSnapshot())).not.toContain("algorithmVersion");
  });

  it("reports an unchanged apply without replacing the exact Project reference", async () => {
    const project = projectFixture();
    const handle = controlledHandle();
    const summary = {
      containerId: "container-1",
      placementCount: 1,
      replacedPlacementCount: 1,
      unverifiedReasonCount: 0,
    };
    const session = createAutomaticProposalSession({
      readContext: () => ({ project, interactionGeneration: 1, startBlocked: false }),
      startWorker: () => handle,
      applyProposal: () => ({
        kind: "unchanged",
        project,
        interactionGeneration: 1,
        summary,
      }),
    });
    session.start();
    handle.resolve({ kind: "ready", result: completeResult() });
    await Promise.resolve();

    expect(session.apply(1)).toBe(true);
    expect(session.getSnapshot()).toEqual({
      phase: "unchanged",
      currentProject: project,
      interactionGeneration: 1,
      identity: 1,
      summary,
    });
  });

  it.each(["blocked", "stale"] as const)(
    "does not invoke apply callback when ready becomes %s",
    async (transition) => {
      const source = projectFixture("source");
      let project = source;
      let startBlocked = false;
      const handle = controlledHandle();
      const applyProposal = vi.fn();
      const session = createAutomaticProposalSession({
        readContext: () => ({ project, interactionGeneration: 1, startBlocked }),
        startWorker: () => handle,
        applyProposal,
      });
      session.start();
      handle.resolve({ kind: "ready", result: completeResult() });
      await Promise.resolve();
      if (transition === "blocked") {
        startBlocked = true;
      } else {
        project = projectFixture("changed");
      }

      expect(session.apply(1)).toBe(false);
      expect(session.getSnapshot()).toEqual({ phase: transition });
      expect(applyProposal).not.toHaveBeenCalled();
    },
  );

  it.each(["throws", "failed"] as const)(
    "claims ready and maps an apply callback that %s to fixed failure",
    async (outcome) => {
      const project = projectFixture();
      const handle = controlledHandle();
      const applyProposal = vi.fn(() => {
        if (outcome === "throws") {
          throw new Error("marker-sensitive-input");
        }
        return { kind: "failed" as const };
      });
      const session = createAutomaticProposalSession({
        readContext: () => ({ project, interactionGeneration: 1, startBlocked: false }),
        startWorker: () => handle,
        applyProposal,
      });
      session.start();
      handle.resolve({ kind: "ready", result: completeResult() });
      await Promise.resolve();

      expect(session.apply(1)).toBe(false);
      expect(session.getSnapshot()).toEqual({ phase: "apply-failed" });
      expect(session.apply(1)).toBe(false);
      expect(applyProposal).toHaveBeenCalledOnce();
    },
  );

  it.each(["project", "generation"] as const)(
    "returns applied state to idle after a later %s change",
    async (change) => {
      const source = projectFixture("source");
      let project = source;
      let generation = 1;
      const handle = controlledHandle();
      const summary = {
        containerId: "container-1",
        placementCount: 1,
        replacedPlacementCount: 0,
        unverifiedReasonCount: 0,
      };
      const session = createAutomaticProposalSession({
        readContext: () => ({ project, interactionGeneration: generation, startBlocked: false }),
        startWorker: () => handle,
        applyProposal: () => ({
          kind: "changed",
          project,
          interactionGeneration: generation,
          summary,
        }),
      });
      session.start();
      handle.resolve({ kind: "ready", result: completeResult() });
      await Promise.resolve();
      session.apply(1);
      if (change === "project") {
        project = projectFixture("later");
      } else {
        generation = 2;
      }

      session.sync();

      expect(session.getSnapshot()).toEqual({ phase: "idle" });
    },
  );
});
