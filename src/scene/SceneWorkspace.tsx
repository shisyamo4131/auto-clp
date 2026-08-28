import { useCallback, useEffect, useMemo, useState } from "react";

import { addPlacement, updatePlacement } from "../application/project-command";
import type { ProjectHistoryCommitHandler } from "../application/project-history";
import {
  isPlacementWithinContainer,
  placementBounds,
} from "../domain/geometry";
import type { Project } from "../domain/model";
import { PhysicalValidationPanel } from "../ui/PhysicalValidationPanel";
import { PlacementPanel } from "../ui/PlacementPanel";
import {
  floorQuarterTurnOrientation,
  projectContainerToScene,
  sceneFloorDragPositionMm,
  type SceneVector3,
} from "./project-scene";
import { ThreeViewport, type CargoDragCommitResult } from "./ThreeViewport";

interface SceneWorkspaceProps {
  readonly forceInitialRenderError?: boolean;
  readonly historyRevision: number;
  readonly onBusyChange: (busy: boolean) => void;
  readonly onProjectCommit: ProjectHistoryCommitHandler;
  readonly onRendererError: () => void;
  readonly onRendererReady: () => void;
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
  historyRevision,
  onBusyChange,
  onProjectCommit,
  onRendererError,
  onRendererReady,
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
  const stagedCount =
    projection?.cargoes.filter((cargo) => cargo.kind === "staged").length ?? 0;
  const selectedPlacement = project.placements.find(
    (placement) =>
      placement.cargoId === selectedCargoId &&
      placement.containerId === effectiveContainerId,
  );
  const nextFloorOrientation =
    selectedPlacement === undefined
      ? undefined
      : floorQuarterTurnOrientation(selectedPlacement.orientation);
  const floorRotationAllowed =
    nextFloorOrientation !== undefined &&
    selectedCargo?.allowedOrientations.includes(nextFloorOrientation) === true;
  const interactionActive = placementInteractionActive || canvasDragActive;

  useEffect(() => {
    onBusyChange(interactionActive);
    return () => onBusyChange(false);
  }, [interactionActive, onBusyChange]);

  useEffect(() => {
    let cancelled = false;
    queueMicrotask(() => {
      if (!cancelled) {
        setCanvasStatus("");
      }
    });
    return () => {
      cancelled = true;
    };
  }, [historyRevision]);

  useEffect(() => {
    const selectionStillVisible =
      selectedCargoId === undefined ||
      projection?.cargoes.some((cargo) => cargo.cargoId === selectedCargoId) === true;
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
  }, [projection, selectedCargoId]);

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
      const projectedCargo = projection?.cargoes.find(
        (candidate) => candidate.cargoId === cargoId,
      );
      if (projectedCargo?.kind === "staged") {
        if (effectiveContainerId === undefined) {
          return {
            ok: false,
            message: "配置先の候補が見つからないため、積荷を仮置き場へ戻しました。",
          };
        }
        if (project.placements.some((placement) => placement.cargoId === cargoId)) {
          return {
            ok: false,
            message:
              "対象の積荷は既に配置されているため、重複配置せず仮置き場へ戻しました。",
          };
        }
        const cargo = project.cargoes.find((candidate) => candidate.id === cargoId);
        const container = project.containers.find(
          (candidate) => candidate.id === effectiveContainerId,
        );
        if (cargo === undefined || container === undefined) {
          return {
            ok: false,
            message:
              "対象の積荷または候補が最新の案件に見つからないため、仮置き場へ戻しました。",
          };
        }
        const nextPosition = sceneFloorDragPositionMm(
          projectedCargo.positionMm,
          deltaScene,
        );
        if (
          nextPosition.xMm === projectedCargo.positionMm.xMm &&
          nextPosition.yMm === projectedCargo.positionMm.yMm
        ) {
          return {
            ok: false,
            message:
              "積荷は移動していないため配置せず、仮置き場に残しました。荷室内までドラッグしてください。",
          };
        }
        const placement = {
          cargoId,
          containerId: effectiveContainerId,
          positionMm: nextPosition,
          orientation: projectedCargo.orientation,
        } as const;
        const bounds = placementBounds(cargo, placement);
        if (
          !isPlacementWithinContainer(
            bounds,
            container.internalDimensionsMm,
          )
        ) {
          return {
            ok: false,
            message:
              "積荷全体が荷室内に入っていないため配置せず、仮置き場へ戻しました。",
          };
        }
        const result = addPlacement(project, cargoId, effectiveContainerId, {
          xMm: String(nextPosition.xMm),
          yMm: String(nextPosition.yMm),
          zMm: "0",
          orientation: projectedCargo.orientation,
        });
        if (!result.ok) {
          return {
            ok: false,
            message:
              "配置座標が保存可能な範囲にないか対象が変わったため、仮置き場へ戻しました。",
          };
        }
        const transition = onProjectCommit({
          baseProject: project,
          nextProject: result.project,
          action: "placement.add",
        });
        if (!transition.ok) {
          return {
            ok: false,
            message:
              "案件が更新されたため配置を保存できませんでした。積荷を仮置き場へ戻しました。",
          };
        }
        if (!transition.changed) {
          return {
            ok: false,
            message: "配置は変更されなかったため、積荷を仮置き場へ戻しました。",
          };
        }
        setCanvasStatus(
          `${cargo.name}を荷室内のX ${nextPosition.xMm}・Y ${nextPosition.yMm}・Z 0 mmへ配置しました。物理判定の再計算を開始しました。`,
        );
        return { ok: true, message: "" };
      }
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
      const transition = onProjectCommit({
        baseProject: project,
        nextProject: result.project,
        action: "placement.drag-xy",
      });
      if (!transition.ok) {
        return {
          ok: false,
          message:
            "案件が更新されたため移動を保存できませんでした。配置を確認してやり直してください。",
        };
      }
      if (!transition.changed) {
        setCanvasStatus("配置位置は変わりませんでした。");
        return { ok: true, message: "" };
      }
      setCanvasStatus(
        `配置をX ${nextPosition.xMm}・Y ${nextPosition.yMm}・Z ${nextPosition.zMm} mmへ移動しました。物理判定の再計算を開始しました。`,
      );
      return { ok: true, message: "" };
    },
    [effectiveContainerId, onProjectCommit, project, projection],
  );

  const handleCargoFloorRotation = useCallback(() => {
    if (
      selectedCargoId === undefined ||
      effectiveContainerId === undefined
    ) {
      setCanvasStatus("回転する積荷が選択されていません。");
      return;
    }
    const cargo = project.cargoes.find(
      (candidate) => candidate.id === selectedCargoId,
    );
    const placement = project.placements.find(
      (candidate) =>
        candidate.cargoId === selectedCargoId &&
        candidate.containerId === effectiveContainerId,
    );
    if (cargo === undefined || placement === undefined) {
      setCanvasStatus(
        "対象の配置が最新の案件に見つからないため、回転を保存しませんでした。",
      );
      return;
    }
    const nextOrientation = floorQuarterTurnOrientation(placement.orientation);
    if (!cargo.allowedOrientations.includes(nextOrientation)) {
      setCanvasStatus(
        "この積荷では床面90°回転後の向きが許可されていません。積荷設定を確認してください。",
      );
      return;
    }
    const result = updatePlacement(project, selectedCargoId, effectiveContainerId, {
      xMm: String(placement.positionMm.xMm),
      yMm: String(placement.positionMm.yMm),
      zMm: String(placement.positionMm.zMm),
      orientation: nextOrientation,
    });
    if (!result.ok) {
      setCanvasStatus(
        "回転後の向きを保存できないか対象が変わったため、配置は変更しませんでした。",
      );
      return;
    }
    const transition = onProjectCommit({
      baseProject: project,
      nextProject: result.project,
      action: "placement.update",
    });
    if (!transition.ok) {
      setCanvasStatus(
        "案件が更新されたため回転を保存できませんでした。配置を確認してやり直してください。",
      );
      return;
    }
    if (!transition.changed) {
      setCanvasStatus("積荷の向きは変わりませんでした。");
      return;
    }
    setCanvasStatus(
      `${cargo.name}を床面で90°回転しました。最小角X ${placement.positionMm.xMm}・Y ${placement.positionMm.yMm}・Z ${placement.positionMm.zMm} mmは保持しています。物理判定の再計算を開始しました。`,
    );
  }, [effectiveContainerId, onProjectCommit, project, selectedCargoId]);

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
            : `選択中の候補: ${project.containers.find((container) => container.id === effectiveContainerId)?.name ?? "不明な候補"}。配置${placementCount}件。仮置き場${stagedCount}件。${selectedCargo === undefined ? "積荷は未選択です。" : `選択中の積荷: ${selectedCargo.name}。`}物理判定は保存済み配置だけから自動更新されます。${canvasStatus === "" ? "" : ` ${canvasStatus}`}`}
        </p>

        <p id="scene-workspace-interaction-help" className="scene-workspace__status">
          {rendererMounted
            ? "3Dでは積荷をクリックまたはタップして選択できます。仮置き場の積荷は、細かいポインターで荷室内へ全体をドラッグすると初めて配置されます。配置済み積荷のドラッグは床面方向へ移動し、空白の左ドラッグで回転、右ドラッグで平行移動、ホイールで拡大・縮小します。正確な座標と向きは下のフォームで編集できます。"
            : "3D表示を利用できない場合も、下のフォームで座標と向きを編集できます。"}
        </p>

        <PlacementPanel
          externalInteractionActive={canvasDragActive}
          historyRevision={historyRevision}
          onInteractionChange={setPlacementInteractionActive}
          onProjectCommit={onProjectCommit}
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
          onCargoFloorRotation={handleCargoFloorRotation}
          onCargoSelectionChange={handleCargoSelectionChange}
          onRendererError={onRendererError}
          onRendererReady={onRendererReady}
          projection={projection}
          rotationDisabled={interactionActive || !floorRotationAllowed}
          rotationExplanation={
            canvasDragActive
              ? "積荷の移動を完了すると回転できます。"
              : placementInteractionActive
              ? "配置の編集または削除確認を完了すると回転できます。"
              : floorRotationAllowed
                ? "選択した積荷の最小角と高さを保ったまま、床面上で90°回転します。"
                : "この積荷では床面90°回転後の向きが許可されていません。"
          }
          selectedCargoId={selectedCargoId}
          statusDescriptionId="scene-workspace-status scene-workspace-interaction-help"
        />
      ) : null}
    </section>
  );
}
