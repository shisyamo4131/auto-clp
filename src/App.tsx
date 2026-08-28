import { useCallback, useEffect, useRef, useState } from "react";

import { createInitialProject } from "./application/project-factory";
import { prepareAutomaticProposalApply } from "./application/automatic-proposal-apply";
import {
  commitProjectHistory,
  createProjectHistory,
  redoProjectHistory,
  undoProjectHistory,
  type ProjectHistoryCommit,
  type ProjectHistoryTransition,
} from "./application/project-history";
import {
  prepareProjectImport,
  serializeProjectForPersistence,
  type ProjectPersistenceActionResult,
  type ProjectPersistenceFailureCode,
} from "./application/project-persistence";
import type { Project } from "./domain/model";
import {
  downloadProjectJson,
  projectJsonSourceFromFile,
} from "./persistence/project-file";
import { preflightImportedProject } from "./persistence/project-import-preflight-client";
import type { ProjectJsonSource } from "./persistence/project-json";
import {
  deleteProjectJsonFromDevice,
  loadProjectJsonFromDevice,
  saveProjectJsonToDevice,
  type ProjectStoreFailureCode,
} from "./persistence/project-store";
import type { WebGL2CapabilityCheck } from "./platform/webgl2";
import { SceneWorkspace } from "./scene/SceneWorkspace";
import { AutomaticProposalPanel } from "./ui/AutomaticProposalPanel";
import type { AutomaticProposalApplyHandler } from "./ui/automatic-proposal-session";
import { ProjectPersistencePanel } from "./ui/ProjectPersistencePanel";
import { ProjectWorkspace } from "./ui/ProjectWorkspace";

type AppState =
  | "checking"
  | "renderer-checking"
  | "supported"
  | "unsupported"
  | "renderer-error";

interface AppProps {
  readonly capabilityCheck: WebGL2CapabilityCheck;
  readonly forceInitialRenderError?: boolean;
}

type PersistenceOperationOutcome =
  | { readonly ok: true; readonly replacement?: Project }
  | { readonly ok: false; readonly code: ProjectPersistenceFailureCode };

const persistenceTextEncoder = new TextEncoder();

function storeFailure(code: ProjectStoreFailureCode): ProjectPersistenceActionResult {
  const mapped = {
    "project-store.unavailable": "persistence.device-unavailable",
    "project-store.open-failed": "persistence.device-open-failed",
    "project-store.read-failed": "persistence.device-read-failed",
    "project-store.write-failed": "persistence.device-write-failed",
    "project-store.delete-failed": "persistence.device-delete-failed",
    "project-store.not-found": "persistence.device-not-found",
    "project-store.data-invalid": "persistence.device-data-invalid",
  } as const satisfies Record<ProjectStoreFailureCode, ProjectPersistenceFailureCode>;
  return { ok: false, code: mapped[code] };
}

function sourceFromStoredJson(json: string): ProjectJsonSource {
  return {
    sizeBytes: persistenceTextEncoder.encode(json).byteLength,
    readText: async () => json,
  };
}

const stateCopy: Record<AppState, { readonly title: string; readonly detail: string }> = {
  checking: {
    title: "3D表示環境を確認中",
    detail: "このブラウザでWebGL 2を利用できるか確認しています。",
  },
  "renderer-checking": {
    title: "3D描画を確認中",
    detail: "WebGL 2の対応を確認しました。初回描画が完了するまで利用可能とは表示しません。",
  },
  supported: {
    title: "3D表示を利用できます",
    detail: "選択した候補と登録済み配置を表示します。案件入力は3D表示とは独立して利用できます。",
  },
  unsupported: {
    title: "3D表示を利用できません",
    detail: "WebGL 2対応の現行デスクトップブラウザとGPU設定を確認してください。3D表示を利用できない場合も、保存済み配置の物理判定は利用できます。",
  },
  "renderer-error": {
    title: "3D表示で問題が発生しました",
    detail: "初期化または描画の障害を成功扱いせず停止しました。ブラウザのGPU設定を確認してから再読み込みしてください。",
  },
};

export function App({ capabilityCheck, forceInitialRenderError = false }: AppProps) {
  const [state, setState] = useState<AppState>("checking");
  const [history, setHistory] = useState(() =>
    createProjectHistory(createInitialProject()),
  );
  const historyRef = useRef(history);
  const [historyRevision, setHistoryRevision] = useState(0);
  const [historyCommitRevision, setHistoryCommitRevision] = useState(0);
  const [projectBarrierRevision, setProjectBarrierRevision] = useState(0);
  const [busySources, setBusySources] = useState({ project: false, scene: false });
  const busySourcesRef = useRef(busySources);
  const [persistenceInteractionActive, setPersistenceInteractionActive] =
    useState(false);
  const persistenceInteractionRef = useRef(false);
  const [persistenceOperationActive, setPersistenceOperationActive] = useState(false);
  const persistenceOperationRef = useRef(false);
  const [projectInteractionGeneration, setProjectInteractionGeneration] =
    useState(0);
  const projectInteractionGenerationRef = useRef(0);
  const busyRef = useRef(false);
  const project = history.present;

  const bumpProjectInteractionGeneration = useCallback(() => {
    const next = projectInteractionGenerationRef.current + 1;
    projectInteractionGenerationRef.current = next;
    setProjectInteractionGeneration(next);
    return next;
  }, []);

  useEffect(() => {
    let cancelled = false;
    queueMicrotask(() => {
      if (cancelled) {
        return;
      }
      const capability = capabilityCheck();
      setState(capability.status === "supported" ? "renderer-checking" : "unsupported");
    });

    return () => {
      cancelled = true;
    };
  }, [capabilityCheck]);

  const handleRendererReady = useCallback(() => {
    setState((current) => (current === "renderer-checking" ? "supported" : current));
  }, []);

  const handleRendererError = useCallback(() => {
    setState((current) => (current === "unsupported" ? current : "renderer-error"));
  }, []);

  const handleBusyChange = useCallback(
    (source: "project" | "scene", busy: boolean) => {
      const current = busySourcesRef.current;
      if (current[source] === busy) {
        return;
      }
      const next = { ...current, [source]: busy };
      busySourcesRef.current = next;
      bumpProjectInteractionGeneration();
      busyRef.current =
        next.project ||
        next.scene ||
        persistenceInteractionRef.current ||
        persistenceOperationRef.current;
      setBusySources(next);
    },
    [bumpProjectInteractionGeneration],
  );
  const handleSceneBusyChange = useCallback(
    (busy: boolean) => handleBusyChange("scene", busy),
    [handleBusyChange],
  );
  const handleProjectBusyChange = useCallback(
    (busy: boolean) => handleBusyChange("project", busy),
    [handleBusyChange],
  );
  const handlePersistenceInteractionChange = useCallback(
    (active: boolean) => {
      if (persistenceInteractionRef.current === active) {
        return;
      }
      persistenceInteractionRef.current = active;
      if (!persistenceOperationRef.current) {
        bumpProjectInteractionGeneration();
      }
      busyRef.current =
        busySourcesRef.current.project ||
        busySourcesRef.current.scene ||
        active ||
        persistenceOperationRef.current;
      setPersistenceInteractionActive(active);
    },
    [bumpProjectInteractionGeneration],
  );

  const handleProjectCommit = useCallback(
    (commit: ProjectHistoryCommit): ProjectHistoryTransition => {
      if (persistenceOperationRef.current) {
        bumpProjectInteractionGeneration();
        return {
          ok: false,
          code: "history.stale-base",
          state: historyRef.current,
        };
      }
      const transition = commitProjectHistory(historyRef.current, commit);
      if (transition.ok && transition.changed) {
        historyRef.current = transition.state;
        bumpProjectInteractionGeneration();
        setHistory(transition.state);
        setHistoryCommitRevision((current) => current + 1);
      }
      return transition;
    },
    [bumpProjectInteractionGeneration],
  );

  const navigateHistory = useCallback(
    (direction: "undo" | "redo"): boolean => {
      if (busyRef.current) {
        return false;
      }
      const transition =
        direction === "undo"
          ? undoProjectHistory(historyRef.current)
          : redoProjectHistory(historyRef.current);
      if (!transition.ok || !transition.changed) {
        return false;
      }
      historyRef.current = transition.state;
      bumpProjectInteractionGeneration();
      setHistory(transition.state);
      setHistoryRevision((current) => current + 1);
      return true;
    },
    [bumpProjectInteractionGeneration],
  );
  const handleUndo = useCallback(() => navigateHistory("undo"), [navigateHistory]);
  const handleRedo = useCallback(() => navigateHistory("redo"), [navigateHistory]);

  const runPersistenceOperation = useCallback(
    async (
      baseProject: Project,
      operation: () => Promise<PersistenceOperationOutcome>,
    ): Promise<ProjectPersistenceActionResult> => {
      const sources = busySourcesRef.current;
      if (sources.project || sources.scene || persistenceOperationRef.current) {
        return { ok: false, code: "persistence.operation-busy" };
      }
      if (historyRef.current.present !== baseProject) {
        return { ok: false, code: "persistence.stale-base" };
      }

      persistenceOperationRef.current = true;
      busyRef.current = true;
      const interactionGeneration = bumpProjectInteractionGeneration();
      setPersistenceOperationActive(true);
      try {
        const outcome = await operation();
        if (!outcome.ok) {
          return outcome;
        }
        if (outcome.replacement !== undefined) {
          const currentSources = busySourcesRef.current;
          if (
            historyRef.current.present !== baseProject ||
            currentSources.project ||
            currentSources.scene ||
            projectInteractionGenerationRef.current !== interactionGeneration
          ) {
            return { ok: false, code: "persistence.stale-base" };
          }
          const nextHistory = createProjectHistory(outcome.replacement);
          historyRef.current = nextHistory;
          bumpProjectInteractionGeneration();
          setHistory(nextHistory);
          setHistoryRevision((current) => current + 1);
          setHistoryCommitRevision((current) => current + 1);
          setProjectBarrierRevision((current) => current + 1);
        }
        return { ok: true };
      } catch {
        return { ok: false, code: "persistence.unexpected-failure" };
      } finally {
        persistenceOperationRef.current = false;
        busyRef.current =
          busySourcesRef.current.project ||
          busySourcesRef.current.scene ||
          persistenceInteractionRef.current;
        setPersistenceOperationActive(false);
      }
    },
    [bumpProjectInteractionGeneration],
  );

  const readAutomaticProposalContext = useCallback(
    () => ({
      project: historyRef.current.present,
      interactionGeneration: projectInteractionGenerationRef.current,
      startBlocked:
        busySourcesRef.current.project ||
        busySourcesRef.current.scene ||
        persistenceInteractionRef.current ||
        persistenceOperationRef.current,
    }),
    [],
  );

  const handleAutomaticProposalApply = useCallback<AutomaticProposalApplyHandler>(
    (request) => {
      const currentSources = busySourcesRef.current;
      if (
        currentSources.project ||
        currentSources.scene ||
        persistenceInteractionRef.current ||
        persistenceOperationRef.current
      ) {
        return { kind: "blocked" };
      }
      const currentProject = historyRef.current.present;
      if (
        currentProject !== request.sourceProject ||
        projectInteractionGenerationRef.current !==
          request.interactionGeneration
      ) {
        return { kind: "stale" };
      }

      const prepared = prepareAutomaticProposalApply(
        currentProject,
        request.sourceProject,
        request.result,
      );
      if (!prepared.ok) {
        return prepared.code === "automatic-proposal.apply-stale"
          ? { kind: "stale" }
          : { kind: "failed" };
      }
      if (!prepared.changed) {
        return {
          kind: "unchanged",
          project: currentProject,
          interactionGeneration: projectInteractionGenerationRef.current,
          summary: prepared.summary,
        };
      }

      const transition = handleProjectCommit({
        baseProject: request.sourceProject,
        nextProject: prepared.project,
        action: "automatic-proposal.apply",
      });
      if (!transition.ok) {
        return { kind: "stale" };
      }
      if (!transition.changed) {
        return { kind: "failed" };
      }
      return {
        kind: "changed",
        project: historyRef.current.present,
        interactionGeneration: projectInteractionGenerationRef.current,
        summary: prepared.summary,
      };
    },
    [handleProjectCommit],
  );

  const handleSaveDevice = useCallback(
    (baseProject: Project) =>
      runPersistenceOperation(baseProject, async () => {
        const serialized = serializeProjectForPersistence(baseProject);
        if (!serialized.ok) {
          return serialized;
        }
        const saved = await saveProjectJsonToDevice(serialized.json);
        return saved.ok ? { ok: true } : storeFailure(saved.code);
      }),
    [runPersistenceOperation],
  );

  const handleLoadDevice = useCallback(
    (baseProject: Project) =>
      runPersistenceOperation(baseProject, async () => {
        const stored = await loadProjectJsonFromDevice();
        if (!stored.ok) {
          return storeFailure(stored.code);
        }
        const prepared = await prepareProjectImport(
          baseProject,
          sourceFromStoredJson(stored.value),
          preflightImportedProject,
        );
        return prepared.ok
          ? { ok: true, replacement: prepared.project }
          : prepared;
      }),
    [runPersistenceOperation],
  );

  const handleDeleteDevice = useCallback(
    (baseProject: Project) =>
      runPersistenceOperation(baseProject, async () => {
        const deleted = await deleteProjectJsonFromDevice();
        return deleted.ok ? { ok: true } : storeFailure(deleted.code);
      }),
    [runPersistenceOperation],
  );

  const handleExportFile = useCallback(
    (baseProject: Project) =>
      runPersistenceOperation(baseProject, async () => {
        const serialized = serializeProjectForPersistence(baseProject);
        if (!serialized.ok) {
          return serialized;
        }
        const downloaded = downloadProjectJson(serialized.json);
        if (downloaded.ok) {
          return { ok: true };
        }
        return {
          ok: false,
          code:
            downloaded.code === "project-file.export-unavailable"
              ? "persistence.file-export-unavailable"
              : "persistence.file-download-failed",
        };
      }),
    [runPersistenceOperation],
  );

  const handleImportFile = useCallback(
    (baseProject: Project, file: File) =>
      runPersistenceOperation(baseProject, async () => {
        const source = projectJsonSourceFromFile(file);
        if (source === undefined) {
          return { ok: false, code: "persistence.file-import-unavailable" };
        }
        const prepared = await prepareProjectImport(
          baseProject,
          source,
          preflightImportedProject,
        );
        return prepared.ok
          ? { ok: true, replacement: prepared.project }
          : prepared;
      }),
    [runPersistenceOperation],
  );

  const copy = stateCopy[state];
  const rendererMounted = state === "renderer-checking" || state === "supported";
  const externalPersistenceBusy =
    busySources.project || busySources.scene || persistenceOperationActive;
  const historyBusy = externalPersistenceBusy || persistenceInteractionActive;

  return (
    <main className="app-shell">
      <header className="hero">
        <p className="eyebrow">LOCAL 3D LOADING WORKSPACE</p>
        <h1>Auto CLP</h1>
        <p className="lede">精密機器輸送の積載案を、端末内で安全側に検討するための試作環境です。</p>
      </header>

      <ProjectPersistencePanel
        busy={externalPersistenceBusy}
        onDeleteDevice={handleDeleteDevice}
        onExportFile={handleExportFile}
        onImportFile={handleImportFile}
        onInteractionChange={handlePersistenceInteractionChange}
        onLoadDevice={handleLoadDevice}
        onSaveDevice={handleSaveDevice}
        project={project}
      />

      <AutomaticProposalPanel
        applyProposal={handleAutomaticProposalApply}
        interactionGeneration={projectInteractionGeneration}
        project={project}
        readContext={readAutomaticProposalContext}
        startBlocked={historyBusy}
      />

      <section
        className={`capability capability--${state}`}
      >
        <div
          className="capability__copy"
          role="status"
          aria-live="polite"
          aria-labelledby="capability-title"
          data-capability-state={state}
        >
          <span className="status-dot" aria-hidden="true" />
          <div>
            <h2 id="capability-title">{copy.title}</h2>
            <p>{copy.detail}</p>
          </div>
        </div>
        <SceneWorkspace
          key={`scene-${projectBarrierRevision}`}
          externalInteractionActive={
            busySources.project ||
            persistenceInteractionActive ||
            persistenceOperationActive
          }
          forceInitialRenderError={forceInitialRenderError}
          historyControls={{
            busy: historyBusy,
            canRedo: history.future.length > 0,
            canUndo: history.past.length > 0,
            commitRevision: historyCommitRevision,
            redoAction: history.future.at(-1)?.action,
            undoAction: history.past.at(-1)?.action,
            onRedo: handleRedo,
            onUndo: handleUndo,
          }}
          onRendererError={handleRendererError}
          onRendererReady={handleRendererReady}
          historyRevision={historyRevision}
          onBusyChange={handleSceneBusyChange}
          onProjectCommit={handleProjectCommit}
          project={project}
          rendererMounted={rendererMounted}
        />
      </section>

      <aside className="safety-note" aria-label="現在の制限">
        <strong>現在の段階</strong>
        <span>
          実装済みの物理判定に適合しても、完全な搬入経路、構造・安定性、重心、軸重、床面強度、荷崩れ、固縛、動荷重、法令適合性や実積載の安全性は未確認です。
        </span>
      </aside>

      <ProjectWorkspace
        key={`project-${projectBarrierRevision}`}
        historyRevision={historyRevision}
        onBusyChange={handleProjectBusyChange}
        onProjectCommit={handleProjectCommit}
        project={project}
      />
    </main>
  );
}
