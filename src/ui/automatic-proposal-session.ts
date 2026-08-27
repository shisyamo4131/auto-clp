import type { AutomaticProposalResult } from "../domain/automatic-proposal";
import type { Project } from "../domain/model";
import type { AutomaticProposalApplySummary } from "../application/automatic-proposal-apply";
import {
  startAutomaticProposalWorker,
  type AutomaticProposalWorkerClientFailureCode,
  type AutomaticProposalWorkerClientResult,
  type AutomaticProposalWorkerHandle,
} from "./automatic-proposal-worker-client";

export interface AutomaticProposalSessionContext {
  readonly project: Project;
  readonly interactionGeneration: number;
  readonly startBlocked: boolean;
}

export type AutomaticProposalSessionContextReader =
  () => AutomaticProposalSessionContext;

export type AutomaticProposalWorkerStarter = (
  project: Project,
) => AutomaticProposalWorkerHandle;

interface AutomaticProposalSessionSource {
  readonly sourceProject: Project;
  readonly interactionGeneration: number;
  readonly identity: number;
}

export interface AutomaticProposalApplyRequest
  extends AutomaticProposalSessionSource {
  readonly result: AutomaticProposalResult;
}

export type AutomaticProposalApplyOutcome =
  | {
      readonly kind: "changed";
      readonly project: Project;
      readonly interactionGeneration: number;
      readonly summary: AutomaticProposalApplySummary;
    }
  | {
      readonly kind: "unchanged";
      readonly project: Project;
      readonly interactionGeneration: number;
      readonly summary: AutomaticProposalApplySummary;
    }
  | { readonly kind: "stale" }
  | { readonly kind: "blocked" }
  | { readonly kind: "failed" };

export type AutomaticProposalApplyHandler = (
  request: AutomaticProposalApplyRequest,
) => AutomaticProposalApplyOutcome;

interface AutomaticProposalAppliedSource {
  readonly currentProject: Project;
  readonly interactionGeneration: number;
  readonly identity: number;
  readonly summary: AutomaticProposalApplySummary;
}

export type AutomaticProposalSessionFailureCode =
  | AutomaticProposalWorkerClientFailureCode
  | "automatic-proposal.session-start-failed";

export type AutomaticProposalSessionSnapshot =
  | { readonly phase: "idle" }
  | (AutomaticProposalSessionSource & { readonly phase: "running" })
  | (AutomaticProposalSessionSource & {
      readonly phase: "ready";
      readonly result: AutomaticProposalResult;
    })
  | (AutomaticProposalSessionSource & { readonly phase: "applying" })
  | (AutomaticProposalAppliedSource & { readonly phase: "applied" })
  | (AutomaticProposalAppliedSource & { readonly phase: "unchanged" })
  | {
      readonly phase: "failed";
      readonly code: AutomaticProposalSessionFailureCode;
    }
  | { readonly phase: "apply-failed" }
  | { readonly phase: "blocked" }
  | { readonly phase: "cancelled" }
  | { readonly phase: "stale" };

export interface AutomaticProposalSessionController {
  getSnapshot(): AutomaticProposalSessionSnapshot;
  subscribe(listener: () => void): () => void;
  start(): boolean;
  retry(): boolean;
  cancel(): void;
  apply(identity: number): boolean;
  sync(): void;
  dispose(): void;
}

export interface AutomaticProposalSessionOptions {
  readonly readContext: AutomaticProposalSessionContextReader;
  readonly startWorker?: AutomaticProposalWorkerStarter;
  readonly applyProposal?: AutomaticProposalApplyHandler;
}

interface ActiveAutomaticProposalRequest extends AutomaticProposalSessionSource {
  readonly handle: AutomaticProposalWorkerHandle;
}

type AutomaticProposalSessionCompletion =
  | Exclude<AutomaticProposalWorkerClientResult, { readonly kind: "failed" }>
  | {
      readonly kind: "failed";
      readonly code: AutomaticProposalSessionFailureCode;
    };

function validContext(context: AutomaticProposalSessionContext): boolean {
  return (
    typeof context.project === "object" &&
    context.project !== null &&
    Number.isSafeInteger(context.interactionGeneration) &&
    context.interactionGeneration >= 0 &&
    typeof context.startBlocked === "boolean"
  );
}

export function createAutomaticProposalSession(
  options: AutomaticProposalSessionOptions,
): AutomaticProposalSessionController {
  const startWorker = options.startWorker ?? startAutomaticProposalWorker;
  const listeners = new Set<() => void>();
  let snapshot: AutomaticProposalSessionSnapshot = { phase: "idle" };
  let active: ActiveAutomaticProposalRequest | undefined;
  let nextIdentity = 1;
  let disposed = false;

  const emit = (next: AutomaticProposalSessionSnapshot) => {
    if (disposed) {
      return;
    }
    snapshot = next;
    for (const listener of [...listeners]) {
      listener();
    }
  };

  const currentContext = (): AutomaticProposalSessionContext | undefined => {
    try {
      const context = options.readContext();
      return validContext(context) ? context : undefined;
    } catch {
      return undefined;
    }
  };

  const matchesContext = (
    request: AutomaticProposalSessionSource,
    context: AutomaticProposalSessionContext,
  ): boolean =>
    request.sourceProject === context.project &&
    request.interactionGeneration === context.interactionGeneration;

  const settle = (
    identity: number,
    result: AutomaticProposalSessionCompletion,
  ) => {
    if (disposed || active?.identity !== identity) {
      return;
    }
    const request = active;
    active = undefined;
    const context = currentContext();
    if (context === undefined || !matchesContext(request, context)) {
      emit({ phase: "stale" });
      return;
    }
    if (result.kind === "ready") {
      emit({
        phase: "ready",
        sourceProject: request.sourceProject,
        interactionGeneration: request.interactionGeneration,
        identity: request.identity,
        result: result.result,
      });
      return;
    }
    if (result.kind === "cancelled") {
      emit({ phase: "cancelled" });
      return;
    }
    emit({ phase: "failed", code: result.code });
  };

  const stopBeforeEmit = (
    handle: AutomaticProposalWorkerHandle | undefined,
    next: AutomaticProposalSessionSnapshot,
  ) => {
    if (handle === undefined) {
      emit(next);
      return;
    }
    try {
      handle.cancel();
    } catch {
      try {
        handle.terminate();
      } catch {
        // Cancellation already owns the state transition; cleanup is best-effort.
      }
    } finally {
      emit(next);
    }
  };

  const start = (): boolean => {
    if (disposed || snapshot.phase === "running") {
      return false;
    }
    const context = currentContext();
    if (context === undefined) {
      emit({
        phase: "failed",
        code: "automatic-proposal.session-start-failed",
      });
      return false;
    }
    if (context.startBlocked) {
      return false;
    }

    const identity = nextIdentity;
    nextIdentity += 1;
    let handle: AutomaticProposalWorkerHandle;
    try {
      handle = startWorker(context.project);
    } catch {
      emit({
        phase: "failed",
        code: "automatic-proposal.session-start-failed",
      });
      return false;
    }
    active = {
      sourceProject: context.project,
      interactionGeneration: context.interactionGeneration,
      identity,
      handle,
    };
    try {
      void handle.result.then(
        (result) => settle(identity, result),
        () =>
          settle(identity, {
            kind: "failed",
            code: "automatic-proposal.session-start-failed",
          }),
      );
    } catch {
      active = undefined;
      try {
        handle.terminate();
      } finally {
        emit({
          phase: "failed",
          code: "automatic-proposal.session-start-failed",
        });
      }
      return false;
    }
    emit({
      phase: "running",
      sourceProject: context.project,
      interactionGeneration: context.interactionGeneration,
      identity,
    });
    return true;
  };

  const cancel = () => {
    if (disposed || active === undefined || snapshot.phase !== "running") {
      return;
    }
    const handle = active.handle;
    active = undefined;
    stopBeforeEmit(handle, { phase: "cancelled" });
  };

  const apply = (identity: number): boolean => {
    if (
      disposed ||
      snapshot.phase !== "ready" ||
      snapshot.identity !== identity
    ) {
      return false;
    }
    const ready = snapshot;
    const context = currentContext();
    if (context === undefined) {
      emit({ phase: "apply-failed" });
      return false;
    }
    if (context.startBlocked) {
      emit({ phase: "blocked" });
      return false;
    }
    if (!matchesContext(ready, context)) {
      emit({ phase: "stale" });
      return false;
    }

    try {
      emit({
        phase: "applying",
        sourceProject: ready.sourceProject,
        interactionGeneration: ready.interactionGeneration,
        identity: ready.identity,
      });
    } catch {
      // The ready identity is already claimed; subscriber failures cannot retry it.
    }

    let outcome: AutomaticProposalApplyOutcome;
    try {
      outcome =
        options.applyProposal?.({
          sourceProject: ready.sourceProject,
          interactionGeneration: ready.interactionGeneration,
          identity: ready.identity,
          result: ready.result,
        }) ?? { kind: "failed" };
    } catch {
      outcome = { kind: "failed" };
    }
    if (outcome.kind === "stale") {
      emit({ phase: "stale" });
      return false;
    }
    if (outcome.kind === "blocked") {
      emit({ phase: "blocked" });
      return false;
    }
    if (outcome.kind === "failed") {
      emit({ phase: "apply-failed" });
      return false;
    }
    emit({
      phase: outcome.kind === "changed" ? "applied" : "unchanged",
      currentProject: outcome.project,
      interactionGeneration: outcome.interactionGeneration,
      identity: ready.identity,
      summary: { ...outcome.summary },
    });
    return true;
  };

  const sync = () => {
    if (disposed) {
      return;
    }
    if (snapshot.phase === "applied" || snapshot.phase === "unchanged") {
      const context = currentContext();
      if (
        context === undefined ||
        snapshot.currentProject !== context.project ||
        snapshot.interactionGeneration !== context.interactionGeneration
      ) {
        emit({ phase: "idle" });
      }
      return;
    }
    if (snapshot.phase !== "running" && snapshot.phase !== "ready") {
      return;
    }
    const context = currentContext();
    if (context !== undefined && matchesContext(snapshot, context)) {
      return;
    }

    const handle = active?.handle;
    active = undefined;
    stopBeforeEmit(handle, { phase: "stale" });
  };

  return {
    getSnapshot: () => snapshot,
    subscribe(listener) {
      if (disposed) {
        return () => {};
      }
      listeners.add(listener);
      return () => {
        listeners.delete(listener);
      };
    },
    start,
    retry: start,
    cancel,
    apply,
    sync,
    dispose() {
      if (disposed) {
        return;
      }
      disposed = true;
      const handle = active?.handle;
      active = undefined;
      listeners.clear();
      handle?.terminate();
    },
  };
}
