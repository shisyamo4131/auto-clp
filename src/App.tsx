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
  PROJECT_DEVICE_RESCUE_FILENAME,
  PROJECT_EXPORT_FILENAME,
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
import {
  CargoEditorDialog,
  type CargoEditorIntent,
  type CargoEditorRequest,
} from "./ui/CargoEditorDialog";
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

type RescueResult =
  | { readonly ok: true; readonly message: string }
  | { readonly ok: false; readonly message: string };

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
    detail: "3D表示の初回描画を確認しました。案件入力、配置、判定、保存、自動提案を利用できます。",
  },
  unsupported: {
    title: "Auto CLPを利用できません",
    detail: "WebGL 2を利用できないため、作業データの編集・配置・判定・自動提案・保存操作を停止しました。対応ブラウザとGPU設定を確認して再読み込みしてください。",
  },
  "renderer-error": {
    title: "Auto CLPの操作を停止しました",
    detail: "3D表示の初期化・描画、またはWebGLコンテキストで障害が発生しました。作業を再開せず、ブラウザのGPU設定を確認して再読み込みしてください。",
  },
};

export function App({ capabilityCheck, forceInitialRenderError = false }: AppProps) {
  const [state, setState] = useState<AppState>("checking");
  const stateRef = useRef<AppState>("checking");
  const operationalRef = useRef(false);
  const [history, setHistory] = useState(() =>
    createProjectHistory(createInitialProject()),
  );
  const historyRef = useRef(history);
  const [historyRevision, setHistoryRevision] = useState(0);
  const [historyCommitRevision, setHistoryCommitRevision] = useState(0);
  const [projectBarrierRevision, setProjectBarrierRevision] = useState(0);
  const [busySources, setBusySources] = useState({
    cargoDialog: false,
    project: false,
    scene: false,
  });
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
  const cargoEditorSequence = useRef(0);
  const [cargoEditorRequest, setCargoEditorRequest] =
    useState<CargoEditorRequest>();
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
      operationalRef.current = false;
      const nextState =
        capability.status === "supported" ? "renderer-checking" : "unsupported";
      stateRef.current = nextState;
      setState(nextState);
    });

    return () => {
      cancelled = true;
    };
  }, [capabilityCheck]);

  const handleRendererReady = useCallback(() => {
    if (stateRef.current !== "renderer-checking") return;
    operationalRef.current = true;
    stateRef.current = "supported";
    setState("supported");
  }, []);

  const handleRendererError = useCallback(() => {
    if (stateRef.current === "unsupported") return;
    operationalRef.current = false;
    stateRef.current = "renderer-error";
    setState("renderer-error");
  }, []);

  const handleBusyChange = useCallback(
    (source: "cargoDialog" | "project" | "scene", busy: boolean) => {
      const current = busySourcesRef.current;
      if (current[source] === busy) {
        return;
      }
      const next = { ...current, [source]: busy };
      busySourcesRef.current = next;
      bumpProjectInteractionGeneration();
      busyRef.current =
        next.cargoDialog ||
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
  const handleOpenCargoEditor = useCallback(
    (intent: CargoEditorIntent) => {
      if (busyRef.current) return;
      handleBusyChange("cargoDialog", true);
      cargoEditorSequence.current += 1;
      setCargoEditorRequest({
        ...intent,
        key: cargoEditorSequence.current,
        returnScrollPosition: { left: window.scrollX, top: window.scrollY },
      });
    },
    [handleBusyChange],
  );
  const handleCloseCargoEditor = useCallback(() => {
    setCargoEditorRequest(undefined);
    handleBusyChange("cargoDialog", false);
  }, [handleBusyChange]);
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
        busySourcesRef.current.cargoDialog ||
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
      if (!operationalRef.current || persistenceOperationRef.current) {
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
      if (!operationalRef.current || busyRef.current) {
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
      if (
        !operationalRef.current ||
        sources.cargoDialog ||
        sources.project ||
        sources.scene ||
        persistenceOperationRef.current
      ) {
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
            !operationalRef.current ||
            historyRef.current.present !== baseProject ||
            currentSources.cargoDialog ||
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
          busySourcesRef.current.cargoDialog ||
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
        !operationalRef.current ||
        busySourcesRef.current.cargoDialog ||
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
        !operationalRef.current ||
        currentSources.cargoDialog ||
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

  const handleRescueCurrent = useCallback(async (): Promise<RescueResult> => {
    const serialized = serializeProjectForPersistence(historyRef.current.present);
    if (!serialized.ok) {
      return {
        ok: false,
        message: "現在の作業データをファイルへ変換できなかったため、ダウンロードを開始しませんでした。",
      };
    }
    const downloaded = downloadProjectJson(serialized.json);
    return downloaded.ok
      ? {
          ok: true,
          message: `ダウンロードを開始しました。ファイル名: ${PROJECT_EXPORT_FILENAME}。ブラウザのダウンロード一覧またはダウンロードフォルダーを確認してください。`,
        }
      : {
          ok: false,
          message: "このブラウザでは現在の作業データをダウンロードできませんでした。",
        };
  }, []);

  const handleRescueDevice = useCallback(async (): Promise<RescueResult> => {
    const stored = await loadProjectJsonFromDevice();
    if (!stored.ok) {
      const message =
        stored.code === "project-store.not-found"
          ? "端末に保存済みのデータはありません。ダウンロードは開始していません。"
          : "端末に保存済みのデータを読み取れなかったため、ダウンロードを開始しませんでした。";
      return { ok: false, message };
    }
    const downloaded = downloadProjectJson(
      stored.value,
      PROJECT_DEVICE_RESCUE_FILENAME,
    );
    return downloaded.ok
      ? {
          ok: true,
          message: `ダウンロードを開始しました。ファイル名: ${PROJECT_DEVICE_RESCUE_FILENAME}。ブラウザのダウンロード一覧またはダウンロードフォルダーを確認してください。`,
        }
      : {
          ok: false,
          message: "このブラウザでは端末に保存済みのデータをダウンロードできませんでした。",
        };
  }, []);

  const copy = stateCopy[state];
  const rendererMounted = state === "renderer-checking" || state === "supported";
  const externalPersistenceBusy =
    busySources.cargoDialog ||
    busySources.project ||
    busySources.scene ||
    persistenceOperationActive;
  const historyBusy = externalPersistenceBusy || persistenceInteractionActive;

  const sceneWorkspace = (
    <SceneWorkspace
      key={`scene-${projectBarrierRevision}`}
      externalInteractionActive={
        state !== "supported" ||
        busySources.cargoDialog ||
        busySources.project ||
        persistenceInteractionActive ||
        persistenceOperationActive
      }
      forceInitialRenderError={forceInitialRenderError}
      historyControls={{
        busy: state !== "supported" || historyBusy,
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
      onOpenCargoEditor={handleOpenCargoEditor}
      onProjectCommit={handleProjectCommit}
      project={project}
      rendererMounted={rendererMounted}
    />
  );

  if (state !== "supported") {
    const rescueAvailable = state === "unsupported" || state === "renderer-error";
    return (
      <main className="app-shell app-shell--blocked">
        <header className="hero">
          <p className="eyebrow">LOCAL 3D LOADING WORKSPACE</p>
          <h1>Auto CLP</h1>
        </header>
        <section className={`capability capability--${state} capability--blocking`}>
          <div
            className="capability__copy"
            role={rescueAvailable ? "alert" : "status"}
            aria-live={rescueAvailable ? "assertive" : "polite"}
            aria-labelledby="capability-title"
            data-capability-state={state}
          >
            <span className="status-dot" aria-hidden="true" />
            <div>
              <h2 id="capability-title">{copy.title}</h2>
              <p>{copy.detail}</p>
            </div>
          </div>
          {rescueAvailable ? (
            <WebGLRescuePanel
              onRescueCurrent={handleRescueCurrent}
              onRescueDevice={handleRescueDevice}
            />
          ) : null}
        </section>
        {state === "renderer-checking" ? (
          <div className="renderer-probe" aria-hidden="true" inert>
            {sceneWorkspace}
          </div>
        ) : null}
      </main>
    );
  }

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
        {sceneWorkspace}
      </section>

      <aside className="safety-note" aria-label="現在の制限">
        <strong>現在の段階</strong>
        <span>
          実装済みの物理判定に適合しても、完全な搬入経路、構造・安定性、重心、軸重、床面強度、荷崩れ、固縛、動荷重、法令適合性や実積載の安全性は未確認です。
        </span>
      </aside>

      <ProjectWorkspace
        externalInteractionActive={
          busySources.cargoDialog ||
          busySources.scene ||
          persistenceInteractionActive ||
          persistenceOperationActive
        }
        key={`project-${projectBarrierRevision}`}
        historyRevision={historyRevision}
        onBusyChange={handleProjectBusyChange}
        onOpenCargoEditor={handleOpenCargoEditor}
        onProjectCommit={handleProjectCommit}
        project={project}
      />
      {cargoEditorRequest === undefined ? null : (
        <CargoEditorDialog
          key={cargoEditorRequest.key}
          onClose={handleCloseCargoEditor}
          onProjectCommit={handleProjectCommit}
          project={project}
          request={cargoEditorRequest}
        />
      )}
    </main>
  );
}

interface WebGLRescuePanelProps {
  readonly onRescueCurrent: () => Promise<RescueResult>;
  readonly onRescueDevice: () => Promise<RescueResult>;
}

function WebGLRescuePanel({
  onRescueCurrent,
  onRescueDevice,
}: WebGLRescuePanelProps) {
  const [busy, setBusy] = useState(false);
  const [progressMessage, setProgressMessage] = useState<string>();
  const [feedback, setFeedback] = useState<RescueResult>();

  const run = async (action: () => Promise<RescueResult>, pendingMessage: string) => {
    if (busy) return;
    setBusy(true);
    setFeedback(undefined);
    setProgressMessage(pendingMessage);
    try {
      const result = await action();
      setFeedback(result);
    } finally {
      setProgressMessage(undefined);
      setBusy(false);
    }
  };

  return (
    <div className="webgl-rescue" aria-labelledby="webgl-rescue-title">
      <h3 id="webgl-rescue-title">作業データをファイルへ退避</h3>
      <p>
        退避したファイルは、3D表示の復旧後にAuto CLPのJSON読込で戻せます。この画面で作業データを変更したり、端末保存を上書きしたりすることはありません。
      </p>
      <div className="webgl-rescue__options">
        <section className="webgl-rescue__option" aria-labelledby="current-data-title">
          <h4 id="current-data-title">現在の作業データ</h4>
          <p>
            この画面が現在保持している作業内容です。作業中に3D表示が停止した場合は、障害直前の内容を含みます。
          </p>
          <p className="webgl-rescue__filename">
            <span>保存されるファイル</span>
            <code>{PROJECT_EXPORT_FILENAME}</code>
          </p>
          <button
            type="button"
            disabled={busy}
            onClick={() =>
              void run(onRescueCurrent, "現在の作業データを準備しています…")
            }
          >
            現在の作業データをダウンロード
          </button>
        </section>
        <section className="webgl-rescue__option" aria-labelledby="device-data-title">
          <h4 id="device-data-title">端末に保存済みのデータ</h4>
          <p>
            以前「端末へ保存」を実行した時点の内容です。その後の未保存の作業は含みません。
          </p>
          <p className="webgl-rescue__filename">
            <span>保存されるファイル</span>
            <code>{PROJECT_DEVICE_RESCUE_FILENAME}</code>
          </p>
          <button
            type="button"
            disabled={busy}
            onClick={() =>
              void run(onRescueDevice, "端末に保存済みのデータを準備しています…")
            }
          >
            端末保存済みデータをダウンロード
          </button>
        </section>
      </div>
      {progressMessage === undefined ? null : (
        <p
          className="webgl-rescue__feedback webgl-rescue__feedback--pending"
          role="status"
          aria-live="polite"
          data-rescue-outcome="pending"
        >
          {progressMessage}
        </p>
      )}
      {feedback === undefined ? null : (
        <p
          className={`webgl-rescue__feedback webgl-rescue__feedback--${feedback.ok ? "success" : "error"}`}
          role={feedback.ok ? "status" : "alert"}
          aria-live={feedback.ok ? "polite" : "assertive"}
          data-rescue-outcome={feedback.ok ? "success" : "error"}
        >
          {feedback.message}
        </p>
      )}
      <div className="webgl-rescue__recovery">
        <h4>ダウンロード後の手順</h4>
        <ol>
          <li>必要な作業データをダウンロードします。</li>
          <li>ブラウザまたはGPU設定を確認します。</li>
          <li>3D表示を再確認してページを再読み込みします。</li>
          <li>必要な場合は、退避したファイルをJSON読込で戻します。</li>
        </ol>
        <button type="button" disabled={busy} onClick={() => window.location.reload()}>
          3D表示を再確認して再読み込み
        </button>
      </div>
    </div>
  );
}
