import { useCallback, useEffect, useMemo, useState } from "react";

import { updatePlacement } from "../application/project-command";
import type { Project } from "../domain/model";
import { PhysicalValidationPanel } from "../ui/PhysicalValidationPanel";
import { PlacementPanel } from "../ui/PlacementPanel";
import {
  projectContainerToScene,
  sceneFloorDragPositionMm,
  type SceneVector3,
} from "./project-scene";
import { ThreeViewport, type CargoDragCommitResult } from "./ThreeViewport";

interface SceneWorkspaceProps {
  readonly forceInitialRenderError?: boolean;
  readonly onRendererError: () => void;
  readonly onRendererReady: () => void;
  readonly onProjectChange: (project: Project) => void;
  readonly project: Project;
  readonly rendererMounted: boolean;
}

function projectionErrorMessage(code: "scene.container-not-found" | "scene.cargo-not-found"): string {
  if (code === "scene.container-not-found") {
    return "選択した候補が案件内に見つからないため、3D表示を更新できません。";
  }
  return "配置が参照する積荷が案件内に見つからないため、3D表示を更新できません。";
}

export function SceneWorkspace({
  forceInitialRenderError = false,
  onRendererError,
  onRendererReady,
  onProjectChange,
  project,
  rendererMounted,
}: SceneWorkspaceProps) {
  const [selectedContainerId, setSelectedContainerId] = useState<string>();
  const [placementInteractionActive, setPlacementInteractionActive] = useState(false);
  const [canvasDragActive, setCanvasDragActive] = useState(false);
  const [selectedCargoId, setSelectedCargoId] = useState<string>();
  const [canvasStatus, setCanvasStatus] = useState("");
  const selectedContainer = project.containers.find(
    (container) => container.id === selectedContainerId,
  );
  const effectiveContainerId = selectedContainer?.id ?? project.containers[0]?.id;

  useEffect(() => {
    let cancelled = false;
    queueMicrotask(() => {
      if (cancelled) {
        return;
      }
      setSelectedContainerId((current) => {
        if (project.containers.length === 0) {
          return undefined;
        }
        if (project.containers.some((container) => container.id === current)) {
          return current;
        }
        return project.containers[0]?.id;
      });
    });

    return () => {
      cancelled = true;
    };
  }, [project.containers]);

  const projectionResult = useMemo(
    () =>
      effectiveContainerId === undefined
        ? undefined
        : projectContainerToScene(project, effectiveContainerId),
    [effectiveContainerId, project],
  );
  const projection = projectionResult?.ok === true ? projectionResult.projection : null;
  const placementCount =
    effectiveContainerId === undefined
      ? 0
      : project.placements.filter(
          (placement) => placement.containerId === effectiveContainerId,
        ).length;
  const selectedCargo = project.cargoes.find((cargo) => cargo.id === selectedCargoId);
  const interactionActive = placementInteractionActive || canvasDragActive;

  useEffect(() => {
    const selectionStillVisible =
      selectedCargoId === undefined ||
      project.placements.some(
        (placement) =>
          placement.cargoId === selectedCargoId &&
          placement.containerId === effectiveContainerId,
      );
    if (selectionStillVisible) {
      return;
    }
    let cancelled = false;
    queueMicrotask(() => {
      if (!cancelled) {
        setSelectedCargoId(undefined);
        setCanvasStatus("");
      }
    });
    return () => {
      cancelled = true;
    };
  }, [effectiveContainerId, project.placements, selectedCargoId]);

  const handleCargoSelectionChange = useCallback(
    (cargoId?: string) => {
      setSelectedCargoId(cargoId);
      if (cargoId === undefined) {
        setCanvasStatus("3D表示の積荷選択を解除しました。");
        return;
      }
      const cargoName =
        project.cargoes.find((cargo) => cargo.id === cargoId)?.name ?? "不明な積荷";
      setCanvasStatus(`${cargoName}を3D表示で選択しました。`);
    },
    [project.cargoes],
  );

  const handleCargoDragStateChange = useCallback((active: boolean) => {
    setCanvasDragActive(active);
    if (active) {
      setCanvasStatus("床面に平行な配置移動をプレビュー中です。離すと1 mm単位で保存します。");
    }
  }, []);

  const handleCargoDragCancel = useCallback((message: string) => {
    setCanvasDragActive(false);
    setCanvasStatus(message);
  }, []);

  const handleCargoDragCommit = useCallback(
    (
      cargoId: string,
      deltaScene: Pick<SceneVector3, "x" | "z">,
    ): CargoDragCommitResult => {
      const placement = project.placements.find(
        (candidate) =>
          candidate.cargoId === cargoId &&
          candidate.containerId === effectiveContainerId,
      );
      if (placement === undefined || effectiveContainerId === undefined) {
        return {
          ok: false,
          message: "対象の配置が最新の案件に見つからないため、移動を保存せず元に戻しました。",
        };
      }
      const nextPosition = sceneFloorDragPositionMm(placement.positionMm, deltaScene);
      const result = updatePlacement(project, cargoId, effectiveContainerId, {
        xMm: String(nextPosition.xMm),
        yMm: String(nextPosition.yMm),
        zMm: String(nextPosition.zMm),
        orientation: placement.orientation,
      });
      if (!result.ok) {
        return {
          ok: false,
          message: "移動後の座標が保存可能な範囲にないか対象が変わったため、配置を元に戻しました。",
        };
      }
      onProjectChange(result.project);
      setCanvasStatus(
        `配置をX ${nextPosition.xMm}・Y ${nextPosition.yMm}・Z ${nextPosition.zMm} mmへ移動しました。物理判定の再計算を開始しました。`,
      );
      return { ok: true, message: "" };
    },
    [effectiveContainerId, onProjectChange, project],
  );

  return (
    <section className="scene-workspace" aria-labelledby="scene-workspace-title">
      <div className="scene-workspace__controls">
        <div>
          <p className="eyebrow">PROJECT SCENE</p>
          <h3 id="scene-workspace-title">3D確認候補</h3>
        </div>

        {project.containers.length === 0 ? (
          <p className="scene-workspace__empty">
            表示する候補がありません。案件入力でコンテナ・車両候補を追加してください。
          </p>
        ) : (
          <div className="scene-workspace__field">
            <label htmlFor="scene-container-select">表示する候補</label>
            <select
              id="scene-container-select"
              value={effectiveContainerId}
              disabled={interactionActive}
              aria-describedby={
                interactionActive ? "scene-container-select-lock" : undefined
              }
              onChange={(event) => {
                if (!interactionActive) {
                  setSelectedContainerId(event.target.value);
                  setSelectedCargoId(undefined);
                  setCanvasStatus("");
                }
              }}
            >
              {project.containers.map((container) => (
                <option key={container.id} value={container.id}>
                  {container.name}
                </option>
              ))}
            </select>
            {interactionActive ? (
              <span className="field__help" id="scene-container-select-lock">
                配置の編集・削除確認・3D移動中です。操作完了後に候補を切り替えられます。
              </span>
            ) : null}
          </div>
        )}

        <p
          id="scene-workspace-status"
          className="scene-workspace__status"
          aria-live="polite"
          aria-atomic="true"
        >
          {effectiveContainerId === undefined
            ? "候補0件、配置0件。物理判定の対象はありません。"
            : `選択中の候補: ${project.containers.find((container) => container.id === effectiveContainerId)?.name ?? "不明な候補"}。配置${placementCount}件。${selectedCargo === undefined ? "積荷は未選択です。" : `選択中の積荷: ${selectedCargo.name}。`}物理判定は保存済み配置から自動更新されます。${canvasStatus === "" ? "" : ` ${canvasStatus}`}`}
        </p>

        <p id="scene-workspace-interaction-help" className="scene-workspace__status">
          {rendererMounted
            ? "3Dでは積荷をクリックまたはタップして選択できます。細かいポインターで積荷をドラッグすると床面方向へ移動し、空白の左ドラッグで回転、右ドラッグで平行移動、ホイールで拡大・縮小します。正確な座標と向きは下のフォームで編集できます。"
            : "3D表示を利用できない場合も、下のフォームで座標と向きを編集できます。"}
        </p>

        <PlacementPanel
          externalInteractionActive={canvasDragActive}
          onInteractionChange={setPlacementInteractionActive}
          onProjectChange={onProjectChange}
          onSelectedCargoChange={setSelectedCargoId}
          project={project}
          selectedCargoId={selectedCargoId}
          selectedContainerId={effectiveContainerId}
        />

        <PhysicalValidationPanel
          containerId={effectiveContainerId}
          project={project}
        />

        {projectionResult !== undefined && !projectionResult.ok ? (
          <p className="scene-workspace__error" role="alert">
            {projectionErrorMessage(projectionResult.error.code)}
          </p>
        ) : null}

        <p className="scene-workspace__notice">
          描画は配置の見た目を確認するためのもので、積載可能性や物理的安全性を保証しません。
        </p>
      </div>

      {rendererMounted ? (
        <ThreeViewport
          forceInitialRenderError={forceInitialRenderError}
          interactionDisabled={placementInteractionActive}
          onCargoDragCancel={handleCargoDragCancel}
          onCargoDragCommit={handleCargoDragCommit}
          onCargoDragStateChange={handleCargoDragStateChange}
          onCargoSelectionChange={handleCargoSelectionChange}
          onRendererError={onRendererError}
          onRendererReady={onRendererReady}
          projection={projection}
          selectedCargoId={selectedCargoId}
          statusDescriptionId="scene-workspace-status scene-workspace-interaction-help"
        />
      ) : null}
    </section>
  );
}
