import { useCallback, useState } from "react";
import { createRoot } from "react-dom/client";

import {
  commitProjectHistory,
  createProjectHistory,
  redoProjectHistory,
  undoProjectHistory,
  type ProjectHistoryCommitHandler,
} from "../../../src/application/project-history";
import { ORIENTATIONS, PROJECT_SCHEMA_VERSION, type Project } from "../../../src/domain/model";
import { SceneWorkspace } from "../../../src/scene/SceneWorkspace";
import "../../../src/styles.css";

const corruptProject: Project = {
  schemaVersion: PROJECT_SCHEMA_VERSION,
  projectId: "weight-balance-unavailable-harness",
  name: "匿名計算不能確認CLP",
  clearancesMm: { xMm: 0, yMm: 0, zMm: 0 },
  cargoes: [{
    id: "cargo-resolved",
    name: "参照可能な匿名積荷",
    dimensionsMm: { lengthMm: 1_000, widthMm: 800, heightMm: 600 },
    massGrams: 1_000_000,
    canSupportCargo: false,
    allowedOrientations: ORIENTATIONS,
  }],
  containers: [{
    id: "container-valid",
    name: "有効な匿名コンテナ",
    internalDimensionsMm: { lengthMm: 4_000, widthMm: 2_000, heightMm: 2_000 },
    openingMm: { widthMm: 2_000, heightMm: 2_000 },
    payloadCapacityGrams: 10_000_000,
  }],
  placements: [
    {
      cargoId: "cargo-missing",
      containerId: "container-valid",
      positionMm: { xMm: 2_000, yMm: 500, zMm: 0 },
      orientation: "LWH",
    },
    {
      cargoId: "cargo-resolved",
      containerId: "container-valid",
      positionMm: { xMm: 100, yMm: 500, zMm: 0 },
      orientation: "LWH",
    },
  ],
};

function UnavailableSceneHarness() {
  const [history, setHistory] = useState(() => createProjectHistory(corruptProject));
  const [busy, setBusy] = useState(false);
  const [commitAttempts, setCommitAttempts] = useState(0);
  const [historyRevision, setHistoryRevision] = useState(0);
  const [rendererState, setRendererState] = useState<"pending" | "ready" | "error">(
    "pending",
  );

  const onProjectCommit: ProjectHistoryCommitHandler = useCallback((commit) => {
    const transition = commitProjectHistory(history, commit);
    setCommitAttempts((current) => current + 1);
    if (transition.ok && transition.changed) {
      setHistory(transition.state);
      setHistoryRevision((current) => current + 1);
    }
    return transition;
  }, [history]);

  const onUndo = useCallback(() => {
    const transition = undoProjectHistory(history);
    if (!transition.ok || !transition.changed) return false;
    setHistory(transition.state);
    setHistoryRevision((current) => current + 1);
    return true;
  }, [history]);

  const onRedo = useCallback(() => {
    const transition = redoProjectHistory(history);
    if (!transition.ok || !transition.changed) return false;
    setHistory(transition.state);
    setHistoryRevision((current) => current + 1);
    return true;
  }, [history]);

  return (
    <main
      className="app-shell"
      data-testid="unavailable-scene-harness"
      data-busy={busy ? "true" : "false"}
      data-commit-attempts={commitAttempts}
      data-history-past={history.past.length}
      data-history-future={history.future.length}
      data-project-original={history.present === corruptProject ? "true" : "false"}
      data-renderer-state={rendererState}
    >
      <SceneWorkspace
        externalInteractionActive={false}
        historyControls={{
          busy,
          canRedo: history.future.length > 0,
          canUndo: history.past.length > 0,
          commitRevision: historyRevision,
          onRedo,
          onUndo,
          redoAction: history.future.at(-1)?.action,
          undoAction: history.past.at(-1)?.action,
        }}
        historyRevision={historyRevision}
        onBusyChange={setBusy}
        onOpenCargoEditor={() => undefined}
        onOpenUsageRequirements={() => undefined}
        onProjectCommit={onProjectCommit}
        onSelectedContainerChange={() => undefined}
        onRendererError={() => setRendererState("error")}
        onRendererReady={() => setRendererState("ready")}
        project={history.present}
        rendererMounted
      />
    </main>
  );
}

const root = document.getElementById("root");
if (root === null) throw new Error("Unavailable scene harness root is missing");
createRoot(root).render(<UnavailableSceneHarness />);
