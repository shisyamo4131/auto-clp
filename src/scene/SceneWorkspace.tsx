import { useCallback, useEffect, useMemo, useRef, useState } from "react";

import {
  addPlacement,
  deletePlacement,
  updatePlacement,
} from "../application/project-command";
import type { ProjectHistoryCommitHandler } from "../application/project-history";
import type { Project } from "../domain/model";
import { PhysicalValidationPanel } from "../ui/PhysicalValidationPanel";
import type { CargoEditorIntent } from "../ui/CargoEditorDialog";
import {
  PlacementEditorDialog,
  type PlacementEditorDialogHandle,
} from "../ui/PlacementEditorDialog";
import {
  ProjectHistoryControls,
  type ProjectHistoryControlsProps,
} from "../ui/ProjectHistoryControls";
import {
  placementPositionCopy,
  presentOrientedPlacement,
} from "../ui/placement-presentation";
import {
  classifyFloorFootprint,
  domainPositionDeltaToScene,
  floorQuarterTurnOrientation,
  placedFloorDragDisposition,
  projectContainerToScene,
  resolveSupportSnapPosition,
  sceneFloorDragPositionMm,
  stagedCargoOverlapsContainerFloor,
  xAxisQuarterTurnOrientation,
  type SceneStagingOverride,
  type SceneVector3,
} from "./project-scene";
import {
  ThreeViewport,
  type CargoDragCommitResult,
  type CargoDragPreviewResult,
} from "./ThreeViewport";

interface SceneWorkspaceProps {
  readonly externalInteractionActive: boolean;
  readonly forceInitialRenderError?: boolean;
  readonly historyControls: ProjectHistoryControlsProps;
  readonly historyRevision: number;
  readonly onBusyChange: (busy: boolean) => void;
  readonly onOpenCargoEditor: (intent: CargoEditorIntent) => void;
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
  onOpenCargoEditor,
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
  const [cargoQuery, setCargoQuery] = useState("");
  const [canvasStatus, setCanvasStatus] = useState("");
  const dragPreviewStatusRef = useRef("");
  const [stagingOverrides, setStagingOverrides] = useState<
    Record<string, SceneStagingOverride>
  >({});
  const placementPanelRef = useRef<PlacementEditorDialogHandle>(null);
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
  const selectedAnyPlacement = project.placements.find(
    (placement) => placement.cargoId === selectedCargoId,
  );
  const selectedPlacement = project.placements.find(
    (placement) =>
      placement.cargoId === selectedCargoId &&
      placement.containerId === effectiveContainerId,
  );
  const selectedOtherContainer =
    selectedAnyPlacement === undefined ||
    selectedAnyPlacement.containerId === effectiveContainerId
      ? undefined
      : project.containers.find(
          (container) => container.id === selectedAnyPlacement.containerId,
        );
  const selectedOrientation =
    selectedProjection?.orientation ??
    selectedAnyPlacement?.orientation ??
    selectedCargo?.allowedOrientations[0];
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
    externalInteractionActive ||
    interactionActive ||
    effectiveContainerId === undefined ||
    selectedOtherContainer !== undefined;
  const coordinateActionReason = canvasDragActive
    ? "3D移動を完了すると座標入力を開けます。"
    : placementInteractionActive
      ? "開いている配置操作を完了すると座標入力を開けます。"
      : externalInteractionActive
        ? "別の案件操作または保存処理を完了すると座標入力を開けます。"
        : selectedOtherContainer !== undefined
          ? `${selectedOtherContainer.name}へ切り替えると配置を編集できます。`
        : undefined;
  const selectedPresentation =
    selectedCargo === undefined || selectedOrientation === undefined
      ? undefined
      : presentOrientedPlacement(selectedCargo, selectedOrientation);
  const normalizedCargoQuery = cargoQuery.trim().toLocaleLowerCase("ja-JP");
  const filteredCargoes = project.cargoes.filter((cargo) =>
    normalizedCargoQuery === "" ||
    cargo.name.toLocaleLowerCase("ja-JP").includes(normalizedCargoQuery) ||
    cargo.id.toLocaleLowerCase("ja-JP").includes(normalizedCargoQuery),
  );
  const selectableCargoes =
    selectedCargo === undefined || filteredCargoes.some((cargo) => cargo.id === selectedCargo.id)
      ? filteredCargoes
      : [selectedCargo, ...filteredCargoes];

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
    const selectionStillExists =
      selectedCargoId === undefined ||
      project.cargoes.some((cargo) => cargo.id === selectedCargoId);
    if (selectionStillExists) {
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
  }, [project.cargoes, selectedCargoId]);

  const handleCargoSelectionChange = useCallback(
    (cargoId?: string) => {
      setSelectedCargoId(cargoId);
      if (cargoId === undefined) {
        setCanvasStatus("3D表示の積荷選択を解除しました。");
        return;
      }
      const cargoName =
        project.cargoes.find((cargo) => cargo.id === cargoId)?.name ?? "不明な積荷";
      setCanvasStatus(`${cargoName}を操作対象として選択しました。`);
    },
    [project.cargoes],
  );

  const handleCargoDragStateChange = useCallback((active: boolean) => {
    setCanvasDragActive(active);
    if (active) {
      setCanvasStatus("床面に平行な配置移動をプレビュー中です。離すと1 mm単位で保存します。");
    } else {
      dragPreviewStatusRef.current = "";
    }
  }, []);

  const handleCargoDragCancel = useCallback((message: string) => {
    setCanvasDragActive(false);
    dragPreviewStatusRef.current = "";
    setCanvasStatus(message);
  }, []);

  const handleCargoDragPreview = useCallback(
    (
      cargoId: string,
      deltaScene: Pick<SceneVector3, "x" | "z">,
    ): CargoDragPreviewResult => {
      const projectedCargo = projection?.cargoes.find(
        (candidate) => candidate.cargoId === cargoId,
      );
      if (projectedCargo === undefined || effectiveContainerId === undefined) {
        const positionMm = projectedCargo?.positionMm ?? {
          xMm: 0,
          yMm: 0,
          zMm: 0,
        };
        return {
          positionMm,
          sceneDelta: { x: 0, y: 0, z: 0 },
          state: "invalid",
          supporterIds: [],
        };
      }
      const rawPositionMm = sceneFloorDragPositionMm(
        projectedCargo.positionMm,
        deltaScene,
      );
      const resolved = resolveSupportSnapPosition(
        project,
        effectiveContainerId,
        cargoId,
        projectedCargo.orientation,
        rawPositionMm,
      );
      const positionMm = resolved?.positionMm ?? rawPositionMm;
      const supporterNames = (resolved?.supporterIds ?? [])
        .map(
          (supporterId) =>
            project.cargoes.find((candidate) => candidate.id === supporterId)
              ?.name ?? supporterId,
        )
        .join("、");
      const message =
        resolved?.disposition === "single-support"
          ? `${supporterNames}の上面に単独支持としてスナップ中です。上面内で移動できます。`
          : resolved?.disposition === "support-conditions-unverified"
            ? `${supporterNames}の上面に仮スナップ中です。張り出し・複数支持等の支持条件は未確認です。`
            : resolved?.disposition === "invalid-overlap"
              ? "積荷同士が立体的に重なる位置です。Drop後は不適合として保存されます。"
              : resolved?.disposition === "floor"
                ? "荷室床面にスナップ中です。"
                : "荷室外の作業スペースを移動中です。";
      if (dragPreviewStatusRef.current !== message) {
        dragPreviewStatusRef.current = message;
        setCanvasStatus(message);
      }
      return {
        positionMm,
        sceneDelta: domainPositionDeltaToScene(
          projectedCargo.positionMm,
          positionMm,
        ),
        state:
          resolved?.disposition === "invalid-overlap"
            ? "invalid"
            : (resolved?.disposition ?? "outside"),
        supporterIds: resolved?.supporterIds ?? [],
      };
    },
    [effectiveContainerId, project, projection],
  );

  const handleCargoDragCommit = useCallback(
    (
      cargoId: string,
      preview: CargoDragPreviewResult,
    ): CargoDragCommitResult => {
      if (externalInteractionActive) {
        return {
          ok: false,
          message: "別の案件操作または保存処理中のため、積荷の移動を保存しませんでした。",
        };
      }
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
        const nextPosition = preview.positionMm;
        if (
          nextPosition.xMm === projectedCargo.positionMm.xMm &&
          nextPosition.yMm === projectedCargo.positionMm.yMm &&
          nextPosition.zMm === projectedCargo.positionMm.zMm
        ) {
          setCanvasStatus("荷室外の作業スペースで位置は変わりませんでした。");
          return { ok: true, message: "" };
        }
        const footprintDisposition = classifyFloorFootprint(
          cargo,
          container,
          projectedCargo.orientation,
          nextPosition,
        );
        if (footprintDisposition === "outside") {
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
          zMm: String(nextPosition.zMm),
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
          footprintDisposition === "partial"
            ? `${cargo.name}を境界外の修正途中配置として保存しました。物理判定を再計算しています。`
            : preview.state === "single-support"
              ? `${cargo.name}を単独支持としてX ${nextPosition.xMm}・Y ${nextPosition.yMm}・Z ${nextPosition.zMm} mmへ配置しました。構造強度と安定性は未確認です。`
              : preview.state === "support-conditions-unverified"
                ? `${cargo.name}をX ${nextPosition.xMm}・Y ${nextPosition.yMm}・Z ${nextPosition.zMm} mmへ配置しました。支持条件は未確認として保存されます。`
            : `${cargo.name}を荷室内のX ${nextPosition.xMm}・Y ${nextPosition.yMm}・Z ${nextPosition.zMm} mmへ配置しました。物理判定の再計算を開始しました。`,
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
      const nextPosition = preview.positionMm;
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
        preview.state === "single-support"
          ? `配置をX ${nextPosition.xMm}・Y ${nextPosition.yMm}・Z ${nextPosition.zMm} mmへ移動し、単独支持として保存しました。構造強度と安定性は未確認です。`
          : preview.state === "support-conditions-unverified"
            ? `配置をX ${nextPosition.xMm}・Y ${nextPosition.yMm}・Z ${nextPosition.zMm} mmへ移動しました。支持条件は未確認として保存されます。`
            : `配置をX ${nextPosition.xMm}・Y ${nextPosition.yMm}・Z ${nextPosition.zMm} mmへ移動しました。物理判定の再計算を開始しました。`,
      );
      return { ok: true, message: "" };
    },
    [effectiveContainerId, externalInteractionActive, onProjectCommit, project, projection],
  );

  const handleCargoRotation = useCallback((axis: "X" | "Z") => {
    if (externalInteractionActive) {
      setCanvasStatus("別の案件操作または保存処理の完了後に回転できます。");
      return;
    }
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
  }, [effectiveContainerId, externalInteractionActive, onProjectCommit, project, projection, selectedCargoId]);

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
              disabled={interactionActive || externalInteractionActive}
              aria-describedby="scene-container-select-lock"
              onChange={(event) => {
                if (!interactionActive) {
                  setSelectedContainerId(event.target.value);
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
            <span className="visually-hidden" id="scene-container-select-lock">
              配置の編集・削除確認・3D移動中、または別の案件操作中は候補を切り替えられません。
            </span>
          </div>
        )}

        {project.cargoes.length === 0 ? null : (
          <div className="scene-workspace__field">
            <label htmlFor="scene-cargo-search">積荷を検索</label>
            <input
              id="scene-cargo-search"
              type="search"
              value={cargoQuery}
              disabled={interactionActive || externalInteractionActive}
              placeholder="積荷名またはIDの一部"
              onChange={(event) => setCargoQuery(event.target.value)}
            />
            <label htmlFor="scene-cargo-select">操作する積荷</label>
            <select
              id="scene-cargo-select"
              value={selectedCargoId ?? ""}
              disabled={interactionActive || externalInteractionActive}
              onChange={(event) => {
                handleCargoSelectionChange(event.target.value || undefined);
              }}
            >
              <option value="">積荷を選択</option>
              {selectableCargoes.map((cargo) => {
                const placement = project.placements.find(
                  (candidate) => candidate.cargoId === cargo.id,
                );
                const placementContainer = project.containers.find(
                  (container) => container.id === placement?.containerId,
                );
                const state =
                  placement === undefined
                    ? "未配置・荷室外"
                    : placement.containerId === effectiveContainerId
                      ? "現在候補に配置済み"
                      : `${placementContainer?.name ?? "別候補"}に配置済み`;
                return (
                  <option key={cargo.id} value={cargo.id}>
                    {cargo.name} — {cargo.dimensionsMm.lengthMm}×{cargo.dimensionsMm.widthMm}×{cargo.dimensionsMm.heightMm} mm — {state}
                  </option>
                );
              })}
            </select>
            <span className="field__help" aria-live="polite">
              {filteredCargoes.length} / {project.cargoes.length}件
            </span>
          </div>
        )}

        <p
          id="scene-workspace-status"
          className="scene-workspace__status"
        >
          {effectiveContainerId === undefined
            ? `候補0件、積荷${project.cargoes.length}件。`
            : `選択候補の配置${placementCount}件、荷室外${stagedCount}件。物理判定は保存済み配置だけから更新されます。`}
        </p>

        <p
          id="scene-workspace-action-status"
          className="scene-workspace__action-status"
          aria-live="polite"
          aria-atomic="true"
        >
          {canvasStatus === "" ? "操作メッセージはありません。" : canvasStatus}
        </p>

        <p id="scene-workspace-interaction-help" className="scene-workspace__status">
          {rendererMounted
            ? "3Dでは積荷を直接選ぶか、検索と一覧から選択できます。荷室内では床または支持可能な積荷上面へsnapし、単一支持面に収まる場合は上面内で移動できます。張り出しや複数支持は未確認のまま調整でき、完全に外へ出すと未配置になります。空白の左ドラッグで視点回転、右ドラッグで平行移動し、＋と－で拡大・縮小します。ホイールはページをスクロールします。"
            : "3D表示を利用できない場合も、検索、選択カード、ダイアログで積荷と配置を編集できます。"}
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
          interactionDisabled={externalInteractionActive || placementInteractionActive}
          onCargoDragCancel={handleCargoDragCancel}
          onCargoDragCommit={handleCargoDragCommit}
          onCargoDragPreview={handleCargoDragPreview}
          onCargoDragStateChange={handleCargoDragStateChange}
          onCargoXAxisRotation={() => handleCargoRotation("X")}
          onCargoZAxisRotation={() => handleCargoRotation("Z")}
          onRotationUnavailable={setCanvasStatus}
          onCargoSelectionChange={handleCargoSelectionChange}
          onRendererError={onRendererError}
          onRendererReady={onRendererReady}
          projection={projection}
          xRotationDisabled={
            externalInteractionActive ||
            interactionActive ||
            selectedProjection === undefined ||
            !xRotationAllowed
          }
          xRotationExplanation={
            externalInteractionActive
              ? "別の案件操作または保存処理の完了後にX軸回転できます。"
              : canvasDragActive
              ? "積荷の移動を完了するとX軸回転できます。"
              : placementInteractionActive
              ? "配置の編集または削除確認を完了するとX軸回転できます。"
              : selectedProjection === undefined
              ? "積荷を選択するとX軸回転できます。"
              : xRotationAllowed
                ? "X軸を中心に90°回転します。"
                : "天地無用または許可する向きにより、X軸回転は利用できません。"
          }
          zRotationDisabled={
            externalInteractionActive ||
            interactionActive ||
            selectedProjection === undefined ||
            !zRotationAllowed
          }
          zRotationExplanation={
            externalInteractionActive
              ? "別の案件操作または保存処理の完了後にZ軸回転できます。"
              : canvasDragActive
              ? "積荷の移動を完了するとZ軸回転できます。"
              : placementInteractionActive
              ? "配置の編集または削除確認を完了するとZ軸回転できます。"
              : selectedProjection === undefined
              ? "積荷を選択するとZ軸回転できます。"
              : zRotationAllowed
                ? "Z軸を中心に床面上で90°回転します。"
                : "許可する向きにより、Z軸回転は利用できません。"
          }
          selectedCargoId={selectedProjection === undefined ? undefined : selectedCargoId}
          statusDescriptionId="scene-workspace-status scene-workspace-action-status scene-workspace-interaction-help"
        />
      ) : null}

      <section
        className="scene-selection-card"
        aria-labelledby="placement-panel-title"
        aria-current={selectedCargo === undefined ? undefined : true}
      >
          <h4 id="placement-panel-title" className="visually-hidden">配置</h4>
          {selectedCargo === undefined ? (
            <p className="scene-selection-card__empty">
              検索または3D表示から積荷を選ぶと、情報と編集操作を表示します。
            </p>
          ) : (
            <div className="scene-selection-card__content">
              <div className="scene-selection-card__heading">
                <h4 className="scene-selection-card__cargo-name">
                  {selectedCargo.name}
                </h4>
                <p className="scene-selection-card__state">
                  {selectedAnyPlacement === undefined
                    ? "荷室外（未配置）"
                    : selectedOtherContainer === undefined
                      ? "現在の候補に配置済み"
                      : `${selectedOtherContainer.name}に配置済み`}
                </p>
              </div>
              <div className="scene-selection-card__facts">
                {selectedPresentation === undefined ? null : (
                  <p className="scene-selection-card__size placement-list__size">
                    {selectedPresentation.sizeCopy}
                  </p>
                )}
                {selectedAnyPlacement !== undefined ? (
                  <dl className="scene-selection-card__position placement-list__position">
                    <div>
                      <dt>X</dt>
                      <dd>{selectedAnyPlacement.positionMm.xMm} mm</dd>
                    </div>
                    <div>
                      <dt>Y</dt>
                      <dd>{selectedAnyPlacement.positionMm.yMm} mm</dd>
                    </div>
                    <div>
                      <dt>Z</dt>
                      <dd>{selectedAnyPlacement.positionMm.zMm} mm</dd>
                    </div>
                  </dl>
                ) : (
                  <p className="scene-selection-card__position-note">
                    位置と向きは現在の作業中だけ保持されます。
                  </p>
                )}
              </div>
              {selectedAnyPlacement !== undefined ? (
                <>
                  <details className="scene-selection-card__details">
                    <summary>保存上の詳細</summary>
                    <p>保存上の向きコード: {selectedAnyPlacement.orientation}</p>
                    <p>保存位置: {placementPositionCopy(selectedAnyPlacement.positionMm)}</p>
                  </details>
                </>
              ) : null}
              <div className="scene-selection-card__actions">
                {selectedOtherContainer === undefined ? null : (
                  <button
                    id="scene-selection-remove-placement"
                    type="button"
                    aria-disabled={externalInteractionActive || interactionActive ? true : undefined}
                    onClick={() => {
                      if (externalInteractionActive || interactionActive) {
                        setCanvasStatus("別の案件操作または保存処理の完了後に候補を切り替えられます。");
                        return;
                      }
                      setSelectedContainerId(selectedOtherContainer.id);
                      setCanvasStatus(`${selectedOtherContainer.name}へ切り替えました。`);
                    }}
                  >
                    {selectedOtherContainer.name}を表示
                  </button>
                )}
                <button
                  id="scene-selection-coordinate-action"
                  className="scene-selection-card__action"
                  type="button"
                  aria-disabled={coordinateActionDisabled ? true : undefined}
                  aria-describedby={
                    coordinateActionReason === undefined
                      ? undefined
                      : "scene-selection-coordinate-lock"
                  }
                  onClick={() => {
                    if (selectedCargoId === undefined) return;
                    if (coordinateActionDisabled) {
                      setCanvasStatus(coordinateActionReason ?? "現在は配置を編集できません。");
                      return;
                    }
                    placementPanelRef.current?.openCoordinatesForCargo(selectedCargoId);
                  }}
                >
                  {selectedAnyPlacement === undefined
                    ? "座標を入力して配置"
                    : "座標を微調整"}
                </button>
                <button
                  type="button"
                  onClick={() => onOpenCargoEditor({ kind: "edit", cargoId: selectedCargo.id })}
                >
                  積荷情報を編集
                </button>
                {selectedPlacement === undefined ? null : (
                  <button
                    type="button"
                    onClick={() => placementPanelRef.current?.openDeleteForCargo(selectedCargo.id)}
                  >
                    荷室から外す
                  </button>
                )}
                <button
                  className={selectedAnyPlacement === undefined ? "danger-button" : undefined}
                  type="button"
                  aria-disabled={selectedAnyPlacement === undefined ? undefined : true}
                  aria-describedby={selectedAnyPlacement === undefined ? undefined : "scene-selection-delete-lock"}
                  onClick={() => {
                    if (selectedAnyPlacement !== undefined) {
                      setCanvasStatus("配置中の積荷です。先に荷室から外してください。");
                      return;
                    }
                    onOpenCargoEditor({ kind: "delete", cargoId: selectedCargo.id });
                  }}
                >
                  積荷自体を削除
                </button>
              </div>
              <p
                id="scene-selection-coordinate-lock"
                className="scene-selection-card__reason"
                data-active={coordinateActionReason === undefined ? "false" : "true"}
              >
                {coordinateActionReason ?? "配置操作は利用できます。"}
              </p>
              {selectedAnyPlacement === undefined ? null : (
                <p id="scene-selection-delete-lock" className="scene-selection-card__reason">
                  積荷自体を削除するには先に荷室から外してください。
                </p>
              )}
            </div>
          )}
      </section>

      <div className="scene-workspace__secondary">
        <PlacementEditorDialog
          ref={placementPanelRef}
          externalInteractionActive={externalInteractionActive || canvasDragActive}
          historyRevision={historyRevision}
          onInteractionChange={setPlacementInteractionActive}
          onProjectCommit={onProjectCommit}
          onSelectedCargoChange={setSelectedCargoId}
          onStatusChange={setCanvasStatus}
          project={project}
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
