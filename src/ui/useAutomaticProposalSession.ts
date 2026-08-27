import { useEffect, useRef, useState, useSyncExternalStore } from "react";

import type { Project } from "../domain/model";
import {
  createAutomaticProposalSession,
  type AutomaticProposalSessionContextReader,
  type AutomaticProposalSessionController,
  type AutomaticProposalSessionSnapshot,
} from "./automatic-proposal-session";

export interface UseAutomaticProposalSessionInput {
  readonly project: Project;
  readonly interactionGeneration: number;
  readonly startBlocked: boolean;
  readonly readContext: AutomaticProposalSessionContextReader;
}

export interface AutomaticProposalSessionBinding {
  readonly snapshot: AutomaticProposalSessionSnapshot;
  readonly start: () => boolean;
  readonly retry: () => boolean;
  readonly cancel: () => void;
}

export function useAutomaticProposalSession({
  project,
  interactionGeneration,
  startBlocked,
  readContext,
}: UseAutomaticProposalSessionInput): AutomaticProposalSessionBinding {
  const [session] = useState<AutomaticProposalSessionController>(() =>
    createAutomaticProposalSession({ readContext }),
  );
  const snapshot = useSyncExternalStore(
    session.subscribe,
    session.getSnapshot,
    session.getSnapshot,
  );
  const visibleSnapshot =
    (snapshot.phase === "running" || snapshot.phase === "ready") &&
    (snapshot.sourceProject !== project ||
      snapshot.interactionGeneration !== interactionGeneration)
      ? ({ phase: "stale" } as const)
      : snapshot;
  const lifecycleRef = useRef(0);

  useEffect(() => {
    session.sync();
  }, [interactionGeneration, project, session, startBlocked]);

  useEffect(() => {
    lifecycleRef.current += 1;
    return () => {
      const cleanupIdentity = lifecycleRef.current + 1;
      lifecycleRef.current = cleanupIdentity;
      queueMicrotask(() => {
        if (lifecycleRef.current === cleanupIdentity) {
          session.dispose();
        }
      });
    };
  }, [session]);

  return {
    snapshot: visibleSnapshot,
    start: session.start,
    retry: session.retry,
    cancel: session.cancel,
  };
}
