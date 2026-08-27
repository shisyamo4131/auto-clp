import { useCallback, useEffect, useRef, useState } from "react";

import { createInitialProject } from "./application/project-factory";
import {
  commitProjectHistory,
  createProjectHistory,
  redoProjectHistory,
  undoProjectHistory,
  type ProjectHistoryCommit,
  type ProjectHistoryTransition,
} from "./application/project-history";
import type { WebGL2CapabilityCheck } from "./platform/webgl2";
import { SceneWorkspace } from "./scene/SceneWorkspace";
import { ProjectHistoryControls } from "./ui/ProjectHistoryControls";
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
  const [busySources, setBusySources] = useState({ project: false, scene: false });
  const busySourcesRef = useRef(busySources);
  const busyRef = useRef(false);
  const project = history.present;

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
      busyRef.current = next.project || next.scene;
      setBusySources(next);
    },
    [],
  );
  const handleSceneBusyChange = useCallback(
    (busy: boolean) => handleBusyChange("scene", busy),
    [handleBusyChange],
  );
  const handleProjectBusyChange = useCallback(
    (busy: boolean) => handleBusyChange("project", busy),
    [handleBusyChange],
  );

  const handleProjectCommit = useCallback(
    (commit: ProjectHistoryCommit): ProjectHistoryTransition => {
      const transition = commitProjectHistory(historyRef.current, commit);
      if (transition.ok && transition.changed) {
        historyRef.current = transition.state;
        setHistory(transition.state);
        setHistoryCommitRevision((current) => current + 1);
      }
      return transition;
    },
    [],
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
      setHistory(transition.state);
      setHistoryRevision((current) => current + 1);
      return true;
    },
    [],
  );
  const handleUndo = useCallback(() => navigateHistory("undo"), [navigateHistory]);
  const handleRedo = useCallback(() => navigateHistory("redo"), [navigateHistory]);

  const copy = stateCopy[state];
  const rendererMounted = state === "renderer-checking" || state === "supported";
  const historyBusy = busySources.project || busySources.scene;

  return (
    <main className="app-shell">
      <header className="hero">
        <p className="eyebrow">LOCAL 3D LOADING WORKSPACE</p>
        <h1>Auto CLP</h1>
        <p className="lede">精密機器輸送の積載案を、端末内で安全側に検討するための試作環境です。</p>
      </header>

      <ProjectHistoryControls
        busy={historyBusy}
        canRedo={history.future.length > 0}
        canUndo={history.past.length > 0}
        commitRevision={historyCommitRevision}
        redoAction={history.future.at(-1)?.action}
        undoAction={history.past.at(-1)?.action}
        onRedo={handleRedo}
        onUndo={handleUndo}
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
          forceInitialRenderError={forceInitialRenderError}
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
        historyRevision={historyRevision}
        onBusyChange={handleProjectBusyChange}
        onProjectCommit={handleProjectCommit}
        project={project}
      />
    </main>
  );
}
