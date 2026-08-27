import { useCallback, useEffect, useRef, useState } from "react";

import type { Project } from "../domain/model";
import {
  PHYSICAL_VALIDATION_REASON_PAGE_SIZE,
  type PhysicalValidationEvaluationSummary,
  type PhysicalValidationReasonPageReadyResponse,
  type PhysicalValidationReasonStatus,
  type PhysicalValidationWorkerResponse,
} from "../workers/physical-validation-worker-protocol";
import {
  createPhysicalValidationWorkerClient,
  type PhysicalValidationTransportErrorCode,
  type PhysicalValidationWorkerClient,
} from "./physical-validation-worker-client";

export interface PhysicalValidationReasonPageSnapshot {
  readonly loading: boolean;
  readonly response?: PhysicalValidationReasonPageReadyResponse;
}

export type PhysicalValidationWorkerSnapshot =
  | { readonly phase: "none" }
  | { readonly phase: "loading" }
  | {
      readonly phase: "ready";
      readonly generation: number;
      readonly summary: PhysicalValidationEvaluationSummary;
      readonly invalidPage?: PhysicalValidationReasonPageSnapshot;
      readonly unverifiedPage?: PhysicalValidationReasonPageSnapshot;
    }
  | {
      readonly phase: "transport-error";
      readonly code: PhysicalValidationTransportErrorCode | "worker-engine-failed";
    };

interface SourcedSnapshot {
  readonly inputToken: number;
  readonly containerId?: string;
  readonly snapshot: PhysicalValidationWorkerSnapshot;
}

interface ActiveWorker {
  readonly identity: object;
  readonly generation: number;
  readonly inputToken: number;
  readonly containerId: string;
  readonly client: PhysicalValidationWorkerClient;
  readonly latestPageRequestIds: Record<PhysicalValidationReasonStatus, number>;
}

export interface PhysicalValidationWorkerController {
  readonly snapshot: PhysicalValidationWorkerSnapshot;
  readonly requestReasonPage: (
    status: PhysicalValidationReasonStatus,
    offset: number,
  ) => void;
  readonly retry: () => void;
}

const projectInputTokens = new WeakMap<Project, number>();
let nextProjectInputToken = 1;

function projectInputToken(project: Project): number {
  const existing = projectInputTokens.get(project);
  if (existing !== undefined) {
    return existing;
  }
  const token = nextProjectInputToken;
  nextProjectInputToken += 1;
  projectInputTokens.set(project, token);
  return token;
}

export function usePhysicalValidationWorker(
  project: Project,
  containerId?: string,
): PhysicalValidationWorkerController {
  const inputToken = projectInputToken(project);
  const generationRef = useRef(0);
  const requestIdRef = useRef(0);
  const activeWorkerRef = useRef<ActiveWorker | undefined>(undefined);
  const [retrySequence, setRetrySequence] = useState(0);
  const [sourcedSnapshot, setSourcedSnapshot] = useState<SourcedSnapshot>({
    inputToken,
    containerId,
    snapshot: containerId === undefined ? { phase: "none" } : { phase: "loading" },
  });

  useEffect(() => {
    if (containerId === undefined) {
      activeWorkerRef.current?.client.terminate();
      activeWorkerRef.current = undefined;
      return;
    }

    const generation = generationRef.current + 1;
    generationRef.current = generation;
    const identity = {};
    let active = true;

    const isCurrentWorker = (): boolean =>
      active && activeWorkerRef.current?.identity === identity;

    const updateTransportError = (
      code: PhysicalValidationTransportErrorCode | "worker-engine-failed",
    ) => {
      if (!isCurrentWorker()) {
        return;
      }
      activeWorkerRef.current?.client.terminate();
      activeWorkerRef.current = undefined;
      setSourcedSnapshot({
        inputToken,
        containerId,
        snapshot: { phase: "transport-error", code },
      });
    };

    const handleResponse = (response: PhysicalValidationWorkerResponse) => {
      if (!isCurrentWorker() || response.generation !== generation) {
        return;
      }
      if (response.type === "worker-failed") {
        updateTransportError("worker-engine-failed");
        return;
      }
      if (response.type === "evaluation-ready") {
        setSourcedSnapshot({
          inputToken,
          containerId,
          snapshot: {
            phase: "ready",
            generation,
            summary: response.summary,
          },
        });
        return;
      }

      const activeWorker = activeWorkerRef.current;
      if (
        activeWorker === undefined ||
        response.requestId !== activeWorker.latestPageRequestIds[response.status]
      ) {
        return;
      }
      setSourcedSnapshot((current) => {
        if (
          current.inputToken !== inputToken ||
          current.containerId !== containerId ||
          current.snapshot.phase !== "ready" ||
          current.snapshot.generation !== generation
        ) {
          return current;
        }
        const page = { loading: false, response } as const;
        return {
          ...current,
          snapshot: {
            ...current.snapshot,
            ...(response.status === "invalid"
              ? { invalidPage: page }
              : { unverifiedPage: page }),
          },
        };
      });
    };

    const creation = createPhysicalValidationWorkerClient({
      onResponse: handleResponse,
      onTransportError: updateTransportError,
    });
    if (!creation.ok) {
      queueMicrotask(() => {
        if (active) {
          setSourcedSnapshot({
            inputToken,
            containerId,
            snapshot: { phase: "transport-error", code: creation.code },
          });
        }
      });
      return () => {
        active = false;
      };
    }

    const worker: ActiveWorker = {
      identity,
      generation,
      inputToken,
      containerId,
      client: creation.client,
      latestPageRequestIds: { invalid: -1, unverified: -1 },
    };
    activeWorkerRef.current = worker;

    queueMicrotask(() => {
      if (!isCurrentWorker()) {
        return;
      }
      setSourcedSnapshot((current) =>
        current.inputToken === inputToken &&
        current.containerId === containerId &&
        current.snapshot.phase === "ready" &&
        current.snapshot.generation === generation
          ? current
          : {
              inputToken,
              containerId,
              snapshot: { phase: "loading" },
            },
      );
    });

    creation.client.post({
      type: "evaluate",
      generation,
      project,
      containerId,
    });

    return () => {
      active = false;
      creation.client.terminate();
      if (activeWorkerRef.current?.identity === identity) {
        activeWorkerRef.current = undefined;
      }
    };
  }, [containerId, inputToken, project, retrySequence]);

  const requestReasonPage = useCallback(
    (status: PhysicalValidationReasonStatus, offset: number) => {
      const worker = activeWorkerRef.current;
      if (
        worker === undefined ||
        worker.inputToken !== inputToken ||
        worker.containerId !== containerId ||
        !Number.isSafeInteger(offset) ||
        offset < 0 ||
        offset % PHYSICAL_VALIDATION_REASON_PAGE_SIZE !== 0
      ) {
        return;
      }

      const requestId = requestIdRef.current + 1;
      requestIdRef.current = requestId;
      worker.latestPageRequestIds[status] = requestId;
      setSourcedSnapshot((current) => {
        if (
          current.inputToken !== inputToken ||
          current.containerId !== containerId ||
          current.snapshot.phase !== "ready" ||
          current.snapshot.generation !== worker.generation
        ) {
          return current;
        }
        const existingPage =
          status === "invalid"
            ? current.snapshot.invalidPage
            : current.snapshot.unverifiedPage;
        const page = { ...existingPage, loading: true };
        return {
          ...current,
          snapshot: {
            ...current.snapshot,
            ...(status === "invalid"
              ? { invalidPage: page }
              : { unverifiedPage: page }),
          },
        };
      });
      worker.client.post({
        type: "reason-page",
        generation: worker.generation,
        requestId,
        status,
        offset,
        limit: PHYSICAL_VALIDATION_REASON_PAGE_SIZE,
      });
    },
    [containerId, inputToken],
  );

  const retry = useCallback(() => {
    activeWorkerRef.current?.client.terminate();
    activeWorkerRef.current = undefined;
    setSourcedSnapshot({
      inputToken,
      containerId,
      snapshot: containerId === undefined ? { phase: "none" } : { phase: "loading" },
    });
    setRetrySequence((current) => current + 1);
  }, [containerId, inputToken]);

  let snapshot: PhysicalValidationWorkerSnapshot;
  if (containerId === undefined) {
    snapshot = { phase: "none" };
  } else if (
    sourcedSnapshot.inputToken !== inputToken ||
    sourcedSnapshot.containerId !== containerId
  ) {
    snapshot = { phase: "loading" };
  } else {
    snapshot = sourcedSnapshot.snapshot;
  }

  return { snapshot, requestReasonPage, retry };
}
