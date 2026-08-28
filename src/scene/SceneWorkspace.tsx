import { useCallback, useEffect, useMemo, useRef, useState } from "react";

import {
  addPlacement,
  deletePlacement,
  updatePlacement,
} from "../application/project-command";
import type { ProjectHistoryCommitHandler } from "../application/project-history";
import {
  hasPositiveAreaOverlap,
  isPlacementWithinContainer,
  placementBounds,
} from "../domain/geometry";
import type { Project } from "../domain/model";
import { PhysicalValidationPanel } from "../ui/PhysicalValidationPanel";
import {
  PlacementPanel,
  type PlacementPanelHandle,
} from "../ui/PlacementPanel";
import {
  ProjectHistoryControls,
  type ProjectHistoryControlsProps,
} from "../ui/ProjectHistoryControls";
import {
  placementPositionCopy,
  presentOrientedPlacement,
} from "../ui/placement-presentation";
import {
  floorQuarterTurnOrientation,
  placedFloorDragDisposition,
  projectContainerToScene,
  sceneFloorDragPositionMm,
  stagedCargoOverlapsContainerFloor,
  xAxisQuarterTurnOrientation,
  type SceneStagingOverride,
  type SceneVector3,
} from "./project-scene";
import { ThreeViewport, type CargoDragCommitResult } from "./ThreeViewport";

interface SceneWorkspaceProps {
  readonly externalInteractionActive: boolean;
  readonly forceInitialRenderError?: boolean;
  readonly historyControls: ProjectHistoryControlsProps;
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
  externalInteractionActive,
  forceInitialRenderError = false,
  historyControls,
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
  const [stagingOverrides, setStagingOverrides] = useState<
    Record<string, SceneStagingOverride>
  >({});
  const placementPanelRef = useRef<PlacementPanelHandle>(null);
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

  useEffect(() => {
    const cargoIds = new Set(project.cargoes.map((cargo) => cargo.id));
    let cancelled = false;
    queueMicrotask(() => {
      if (cancelled) return;
      setStagingOverrides((current) => {
        const next = Object.fromEntries(
          Object.entries(current).filter(([cargoId]) => cargoIds.has(cargoId)),
        );
        return Object.keys(next).length === Object.keys(current).length
          ? current
          : next;
      });
    });
    return () => {
      cancelled = true;
    };
  }, [project.cargoes]);

  const projectionResult = useMemo(
    () =>
      effectiveContainerId === undefined
        ? undefined
        : projectContainerToScene(project, effectiveContainerId, stagingOverrides),
    [effectiveContainerId, project, stagingOverrides],
  );
  const projection = projectionResult?.ok === true ? projectionResult.projection : null;
  const placementCount =
    effectiveContainerId === undefined
      ? 0
      : project.placements.filter(
          (placement) => placement.containerId === effectiveContainerId,
        ).length;
  const selectedCargo = project.cargoes.find((cargo) => cargo.id === selectedCargoId);
  const selectedProjection = projection?.cargoes.find(
    (cargo) => cargo.cargoId === selectedCargoId,
  );
  const stagedCount =
    projection?.cargoes.filter((cargo) => cargo.kind === "staged").length ?? 0;
  const selectedPlacement = project.placements.find(
    (placement) =>
      placement.cargoId === selectedCargoId &&
      placement.containerId === effectiveContainerId,
  );
  const selectedOrientation = selectedProjection?.orientation;
  const nextZOrientation =
    selectedOrientation === undefined
      ? undefined
      : floorQuarterTurnOrientation(selectedOrientation);
  const nextXOrientation =
    selectedOrientation === undefined
      ? undefined
      : xAxisQuarterTurnOrientation(selectedOrientation);
  const zRotationAllowed =
    nextZOrientation !== undefined &&
    selectedCargo?.allowedOrientations.includes(nextZOrientation) === true;
  const xRotationAllowed =
    nextXOrientation !== undefined &&
    selectedCargo?.allowedOrientations.includes(nextXOrientation) === true;
  const interactionActive = placementInteractionActive || canvasDragActive;
  const coordinateActionDisabled =
    externalInteractionActive || interactionActive || effectiveContainerId === undefined;
  const coordinateActionReason = canvasDragActive
    ? "3D移動を完了すると座標入力を開けます。"
    : placementInteractionActive
      ? "開いている配置操作を完了すると座標入力を開けます。"
      : externalInteractionActive
        ? "別の案件操作または保存処理を完了すると座標入力を開けます。"
        : undefined;
  const selectedPresentation =
    selectedCargo === undefined || selectedProjection === undefined
      ? undefined
      : presentOrientedPlacement(selectedCargo, selectedProjection.orientation);

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
            message: "配置先の候補が見つからないため、積荷を荷室外の作業スペースへ戻しました。",
          };
        }
        if (project.placements.some((placement) => placement.cargoId === cargoId)) {
          return {
            ok: false,
            message:
              "対象の積荷は既に配置されているため、重複配置せず荷室外の作業スペースへ戻しました。",
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
              "対象の積荷または候補が最新の案件に見つからないため、荷室外の作業スペースへ戻しました。",
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
          setCanvasStatus("荷室外の作業スペースで位置は変わりませんでした。");
          return { ok: true, message: "" };
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
          const partiallyOverlapsFloor = hasPositiveAreaOverlap(
            {
              min: { xMm: bounds.min.xMm, yMm: bounds.min.yMm },
              max: { xMm: bounds.max.xMm, yMm: bounds.max.yMm },
            },
            {
              min: { xMm: 0, yMm: 0 },
              max: {
                xMm: container.internalDimensionsMm.lengthMm,
                yMm: container.internalDimensionsMm.widthMm,
              },
            },
          );
          if (partiallyOverlapsFloor) {
            return {
              ok: false,
              message:
                "積荷を配置する場合は全体を荷室内へ、退避する場合は全体を荷室外へ移動してください。直前の作業位置を保持しました。",
            };
          }
          setStagingOverrides((current) => ({
            ...current,
            [cargoId]: {
              orientation: projectedCargo.orientation,
              positionMm: nextPosition,
            },
          }));
          setCanvasStatus(
            `${cargo.name}を荷室外の作業スペースへ移動しました。この位置は現在の作業中だけ保持されます。`,
          );
          return { ok: true, message: "" };
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
              "配置座標が保存可能な範囲にないか対象が変わったため、荷室外の作業スペースへ戻しました。",
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
              "案件が更新されたため配置を保存できませんでした。積荷を荷室外の作業スペースへ戻しました。",
          };
        }
        if (!transition.changed) {
          return {
            ok: false,
            message: "配置は変更されなかったため、積荷を荷室外の作業スペースへ戻しました。",
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
      const cargo = project.cargoes.find((candidate) => candidate.id === cargoId);
      const container = project.containers.find(
        (candidate) => candidate.id === effectiveContainerId,
      );
      if (cargo === undefined || container === undefined) {
        return {
          ok: false,
          message:
            "対象の積荷または候補が最新の案件に見つからないため、移動を保存せず元に戻しました。",
        };
      }
      const dragDisposition = placedFloorDragDisposition(
        cargo,
        container,
        placement,
        nextPosition,
      );
      if (dragDisposition === "no-op") {
        setCanvasStatus("配置位置は変わりませんでした。");
        return { ok: true, message: "" };
      }
      if (dragDisposition === "delete") {
        const result = deletePlacement(project, cargoId, effectiveContainerId);
        if (!result.ok) {
          return {
            ok: false,
            message:
              "対象の配置が最新の案件に見つからないため、荷室外の作業スペースへ戻せず元の配置を保持しました。",
          };
        }
        const transition = onProjectCommit({
          baseProject: project,
          nextProject: result.project,
          action: "placement.delete",
        });
        if (!transition.ok || !transition.changed) {
          return {
            ok: false,
            message:
              "案件が更新されたため配置を削除できませんでした。元の配置を確認してやり直してください。",
          };
        }
        setStagingOverrides((current) => ({
          ...current,
          [cargoId]: {
            orientation: placement.orientation,
            positionMm: nextPosition,
          },
        }));
        setCanvasStatus(
          `${cargo.name}を荷室の床面から完全に外へ移動したため、配置を削除して荷室外の作業スペースへ移しました。`,
        );
        return { ok: true, message: "" };
      }
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

  const handleCargoRotation = useCallback((axis: "X" | "Z") => {
    const rotationProjection = projection?.cargoes.find(
      (candidate) => candidate.cargoId === selectedCargoId,
    );
    if (
      selectedCargoId === undefined ||
      effectiveContainerId === undefined ||
      rotationProjection === undefined
    ) {
      setCanvasStatus("回転する積荷が選択されていません。");
      return;
    }
    const cargo = project.cargoes.find(
      (candidate) => candidate.id === selectedCargoId,
    );
    if (cargo === undefined) {
      setCanvasStatus(
        "対象の積荷が最新の案件に見つからないため、回転しませんでした。",
      );
      return;
    }
    const nextOrientation =
      axis === "X"
        ? xAxisQuarterTurnOrientation(rotationProjection.orientation)
        : floorQuarterTurnOrientation(rotationProjection.orientation);
    if (!cargo.allowedOrientations.includes(nextOrientation)) {
      setCanvasStatus(
        axis === "X"
          ? "この積荷ではX軸回転後の向きが許可されていません。天地無用または許可する向きを確認してください。"
          : "この積荷ではZ軸回転後の向きが許可されていません。許可する向きを確認してください。",
      );
      return;
    }
    if (rotationProjection.kind === "staged") {
      const container = project.containers.find(
        (candidate) => candidate.id === effectiveContainerId,
      );
      if (container === undefined) {
        setCanvasStatus(
          "対象の候補が最新の案件に見つからないため、回転しませんでした。",
        );
        return;
      }
      if (
        stagedCargoOverlapsContainerFloor(
          cargo,
          rotationProjection.positionMm,
          nextOrientation,
          container,
        )
      ) {
        setCanvasStatus(
          `${cargo.name}はこの位置で${axis}軸回転すると荷室と一部重なるため、回転しませんでした。荷室から離して再度操作してください。`,
        );
        return;
      }
      setStagingOverrides((current) => ({
        ...current,
        [selectedCargoId]: {
          orientation: nextOrientation,
          positionMm: rotationProjection.positionMm,
        },
      }));
      setCanvasStatus(
        `${cargo.name}を荷室外の作業スペースで${axis}軸中心に90°回転しました。この向きは現在の作業中だけ保持されます。`,
      );
      return;
    }
    const placement = project.placements.find(
      (candidate) =>
        candidate.cargoId === selectedCargoId &&
        candidate.containerId === effectiveContainerId,
    );
    if (placement === undefined) {
      setCanvasStatus(
        "対象の配置が最新の案件に見つからないため、回転を保存しませんでした。",
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
      `${cargo.name}を${axis}軸中心に90°回転しました。最小角X ${placement.positionMm.xMm}・Y ${placement.positionMm.yMm}・Z ${placement.positionMm.zMm} mmは保持しています。物理判定の再計算を開始しました。`,
    );
  }, [effectiveContainerId, onProjectCommit, project, projection, selectedCargoId]);

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

        {projection === null || projection.cargoes.length === 0 ? null : (
          <div className="scene-workspace__field">
            <label htmlFor="scene-cargo-select">操作する積荷</label>
            <select
              id="scene-cargo-select"
              value={selectedCargoId ?? ""}
              disabled={interactionActive}
              onChange={(event) => {
                handleCargoSelectionChange(event.target.value || undefined);
              }}
            >
              <option value="">3D表示から選択</option>
              {projection.cargoes.map((cargo) => (
                <option key={cargo.cargoId} value={cargo.cargoId}>
                  {cargo.name}（{cargo.kind === "placed" ? "配置済み" : "荷室外"}）
                </option>
              ))}
            </select>
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
            : `選択中の候補: ${project.containers.find((container) => container.id === effectiveContainerId)?.name ?? "不明な候補"}。配置${placementCount}件。荷室外${stagedCount}件。${selectedCargo === undefined ? "積荷は未選択です。" : `選択中の積荷: ${selectedCargo.name}。`}物理判定は保存済み配置だけから自動更新されます。${canvasStatus === "" ? "" : ` ${canvasStatus}`}`}
        </p>

        <p id="scene-workspace-interaction-help" className="scene-workspace__status">
          {rendererMounted
            ? "3Dでは積荷を直接選ぶか、上の一覧から選択できます。荷室外の積荷は作業スペース内で自由に退避でき、全体を荷室内へ入れると配置されます。配置済み積荷を床面から完全に外へ出すと、そのdrop位置で未配置になります。空白の左ドラッグで視点回転、右ドラッグで平行移動し、＋と－で拡大・縮小します。ホイールはページをスクロールします。正確な座標と向きは3D下のフォームで編集できます。"
            : "3D表示を利用できない場合も、下のフォームで座標と向きを編集できます。"}
        </p>

        {rendererMounted ? null : (
          <div className="scene-workspace__fallback-history">
            <ProjectHistoryControls {...historyControls} compact />
          </div>
        )}

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
          historyControls={<ProjectHistoryControls {...historyControls} compact />}
          interactionDisabled={placementInteractionActive}
          onCargoDragCancel={handleCargoDragCancel}
          onCargoDragCommit={handleCargoDragCommit}
          onCargoDragStateChange={handleCargoDragStateChange}
          onCargoXAxisRotation={() => handleCargoRotation("X")}
          onCargoZAxisRotation={() => handleCargoRotation("Z")}
          onCargoSelectionChange={handleCargoSelectionChange}
          onRendererError={onRendererError}
          onRendererReady={onRendererReady}
          projection={projection}
          xRotationDisabled={interactionActive || !xRotationAllowed}
          xRotationExplanation={
            canvasDragActive
              ? "積荷の移動を完了するとX軸回転できます。"
              : placementInteractionActive
              ? "配置の編集または削除確認を完了するとX軸回転できます。"
              : xRotationAllowed
                ? "X軸を中心に90°回転します。"
                : "天地無用または許可する向きにより、X軸回転は利用できません。"
          }
          zRotationDisabled={interactionActive || !zRotationAllowed}
          zRotationExplanation={
            canvasDragActive
              ? "積荷の移動を完了するとZ軸回転できます。"
              : placementInteractionActive
              ? "配置の編集または削除確認を完了するとZ軸回転できます。"
              : zRotationAllowed
                ? "Z軸を中心に床面上で90°回転します。"
                : "許可する向きにより、Z軸回転は利用できません。"
          }
          selectedCargoId={selectedCargoId}
          statusDescriptionId="scene-workspace-status scene-workspace-interaction-help"
        />
      ) : null}

      <section
        className="scene-selection-card"
        aria-label={selectedCargo?.name ?? "積荷情報"}
      >
          {selectedCargo === undefined || selectedProjection === undefined ? (
            <p className="scene-selection-card__empty">
              3D表示で積荷を選ぶと、大きさと位置、正確な座標入力への入口を表示します。
            </p>
          ) : (
            <div className="scene-selection-card__content">
              <div className="scene-selection-card__heading">
                <h4 className="scene-selection-card__cargo-name">
                  {selectedCargo.name}
                </h4>
                <p className="scene-selection-card__state">
                  {selectedProjection.kind === "staged"
                    ? "荷室外（未配置）"
                    : "荷室内に配置済み"}
                </p>
              </div>
              <div className="scene-selection-card__facts">
                {selectedPresentation === undefined ? null : (
                  <p className="scene-selection-card__size">
                    {selectedPresentation.sizeCopy}
                  </p>
                )}
                {selectedProjection.kind === "placed" && selectedPlacement !== undefined ? (
                  <dl className="scene-selection-card__position">
                    <div>
                      <dt>X</dt>
                      <dd>{selectedPlacement.positionMm.xMm} mm</dd>
                    </div>
                    <div>
                      <dt>Y</dt>
                      <dd>{selectedPlacement.positionMm.yMm} mm</dd>
                    </div>
                    <div>
                      <dt>Z</dt>
                      <dd>{selectedPlacement.positionMm.zMm} mm</dd>
                    </div>
                  </dl>
                ) : (
                  <p className="scene-selection-card__position-note">
                    位置と向きは現在の作業中だけ保持されます。
                  </p>
                )}
              </div>
              {selectedProjection.kind === "placed" && selectedPlacement !== undefined ? (
                <>
                  <details className="scene-selection-card__details">
                    <summary>保存上の詳細</summary>
                    <p>保存上の向きコード: {selectedPlacement.orientation}</p>
                    <p>保存位置: {placementPositionCopy(selectedPlacement.positionMm)}</p>
                  </details>
                </>
              ) : null}
              <button
                className="scene-selection-card__action"
                type="button"
                disabled={coordinateActionDisabled}
                aria-describedby={
                  coordinateActionReason === undefined
                    ? undefined
                    : "scene-selection-coordinate-lock"
                }
                onClick={() => {
                  if (selectedCargoId !== undefined && !coordinateActionDisabled) {
                    placementPanelRef.current?.openCoordinatesForCargo(selectedCargoId);
                  }
                }}
              >
                {selectedProjection.kind === "staged"
                  ? "座標を入力して配置"
                  : "座標を微調整"}
              </button>
              {coordinateActionReason === undefined ? null : (
                <p id="scene-selection-coordinate-lock" className="scene-selection-card__reason">
                  {coordinateActionReason}
                </p>
              )}
            </div>
          )}
      </section>

      <div className="scene-workspace__secondary">
        <PlacementPanel
          ref={placementPanelRef}
          externalInteractionActive={externalInteractionActive || canvasDragActive}
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
      </div>
    </section>
  );
}
