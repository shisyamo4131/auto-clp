import {
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
  type KeyboardEvent as ReactKeyboardEvent,
} from "react";

import {
  addPlacement,
  deletePlacement,
  updatePlacement,
} from "../application/project-command";
import type { ProjectHistoryCommitHandler } from "../application/project-history";
import type { Project } from "../domain/model";
import { singleSupportDescendantCargoIds } from "../domain/geometry";
import { isUprightOnlyOrientationPolicy } from "../domain/orientation-policy";
import { evaluatePayloadCapacity } from "../domain/validation";
import {
  PhysicalValidationLamp,
  PhysicalValidationPanel,
} from "../ui/PhysicalValidationPanel";
import { usePhysicalValidationWorker } from "../ui/usePhysicalValidationWorker";
import type { CargoEditorIntent } from "../ui/CargoEditorDialog";
import {
  PlacementEditorDialog,
  type PlacementEditorDialogHandle,
} from "../ui/PlacementEditorDialog";
import {
  ProjectHistoryControls,
  type ProjectHistoryControlsProps,
} from "../ui/ProjectHistoryControls";
import { presentOrientedPlacement } from "../ui/placement-presentation";
import {
  classifyFloorFootprint,
  compactSceneStagingOverrides,
  domainPositionDeltaToScene,
  encodeSceneStagingAnchor,
  floorQuarterTurnOrientation,
  placedFloorDragDisposition,
  projectSceneStagingAnchor,
  projectContainerToScene,
  resolveSupportSnapPosition,
  sceneFloorDragPositionMm,
  xAxisQuarterTurnOrientation,
  type ProjectSceneProjection,
  type ProjectSceneProjectionResult,
  type SceneStagingOverride,
  type SceneVector3,
} from "./project-scene";
import {
  ThreeViewport,
  type CargoDragCommitResult,
  type CargoDragPreviewResult,
} from "./ThreeViewport";

function gramsToKilograms(grams: number): string {
  const whole = Math.floor(grams / 1000);
  const fraction = String(grams % 1000).padStart(3, "0").replace(/0+$/, "");
  return fraction.length === 0 ? String(whole) : `${whole}.${fraction}`;
}

function MagnetIcon() {
  return (
    <svg aria-hidden="true" viewBox="0 0 24 24" width="22" height="22">
      <path
        fill="currentColor"
        d="M6 2h4v7a2 2 0 0 0 4 0V2h4v7a6 6 0 0 1-12 0V2Zm0 0h4v3H6V2Zm8 0h4v3h-4V2Z"
      />
    </svg>
  );
}

interface SceneWorkspaceProps {
  readonly externalInteractionActive: boolean;
  readonly forceInitialRenderError?: boolean;
  readonly historyControls: ProjectHistoryControlsProps;
  readonly historyRevision: number;
  readonly onBusyChange: (busy: boolean) => void;
  readonly onOpenCargoEditor: (intent: CargoEditorIntent) => void;
  readonly onOpenUsageRequirements: () => void;
  readonly onProjectCommit: ProjectHistoryCommitHandler;
  readonly onSelectedContainerChange: (containerId?: string) => void;
  readonly onRendererError: () => void;
  readonly onRendererReady: () => void;
  readonly project: Project;
  readonly rendererMounted: boolean;
  readonly sessionResetRevision: number;
}

function projectionErrorMessage(code: "scene.container-not-found" | "scene.cargo-not-found"): string {
  if (code === "scene.container-not-found") {
    return "選択したコンテナがCLP内に見つからないため、3D表示を更新できません。";
  }
  return "配置が参照する積荷がCLP内に見つからないため、3D表示を更新できません。";
}

/** Selects a safe read-only scene when a resolvable container has corrupt cargo references. */
export function selectWorkspaceSceneProjection(
  result: ProjectSceneProjectionResult | undefined,
): ProjectSceneProjection | null {
  if (result === undefined) return null;
  return result.ok ? result.projection : result.recoveryProjection ?? null;
}

interface CandidateTabsProps {
  readonly activeId?: string;
  readonly disabled: boolean;
  readonly onActivate: (containerId: string) => void;
  readonly project: Project;
}

function CandidateTabs({ activeId, disabled, onActivate, project }: CandidateTabsProps) {
  const rootRef = useRef<HTMLDivElement>(null);
  const scrollerRef = useRef<HTMLDivElement>(null);
  const tabRefs = useRef(new Map<string, HTMLButtonElement>());
  const [scrollState, setScrollState] = useState({
    hasOverflow: false,
    atStart: true,
    atEnd: true,
  });
  const updateScrollState = useCallback(() => {
    const root = rootRef.current;
    const scroller = scrollerRef.current;
    if (root === null || scroller === null) return;
    const hasOverflow = scroller.scrollWidth > root.clientWidth + 1;
    const maxScrollLeft = Math.max(0, scroller.scrollWidth - scroller.clientWidth);
    const next = {
      hasOverflow,
      atStart: !hasOverflow || scroller.scrollLeft <= 1,
      atEnd: !hasOverflow || scroller.scrollLeft >= maxScrollLeft - 1,
    };
    setScrollState((current) =>
      current.hasOverflow === next.hasOverflow &&
      current.atStart === next.atStart &&
      current.atEnd === next.atEnd
        ? current
        : next,
    );
  }, []);
  const revealActiveTab = useCallback(() => {
    if (activeId === undefined) return;
    const scroller = scrollerRef.current;
    const tab = tabRefs.current.get(activeId);
    if (scroller === null || tab === undefined) return;
    const scrollerBounds = scroller.getBoundingClientRect();
    const tabBounds = tab.getBoundingClientRect();
    if (tabBounds.left < scrollerBounds.left) {
      scroller.scrollTo({
        left: scroller.scrollLeft - (scrollerBounds.left - tabBounds.left),
        behavior: "auto",
      });
    } else if (tabBounds.right > scrollerBounds.right) {
      scroller.scrollTo({
        left: scroller.scrollLeft + (tabBounds.right - scrollerBounds.right),
        behavior: "auto",
      });
    }
  }, [activeId]);

  useEffect(() => {
    const scroller = scrollerRef.current;
    if (scroller === null) return;
    const syncLayout = () => {
      revealActiveTab();
      updateScrollState();
    };
    const resizeObserver = new ResizeObserver(syncLayout);
    const root = rootRef.current;
    if (root !== null) resizeObserver.observe(root);
    resizeObserver.observe(scroller);
    for (const tab of tabRefs.current.values()) {
      resizeObserver.observe(tab);
    }
    scroller.addEventListener("scroll", updateScrollState, { passive: true });
    syncLayout();
    return () => {
      resizeObserver.disconnect();
      scroller.removeEventListener("scroll", updateScrollState);
    };
  }, [project.containers, revealActiveTab, updateScrollState]);

  const moveFocus = (nextIndex: number) => {
    const normalized = Math.max(0, Math.min(project.containers.length - 1, nextIndex));
    const next = project.containers[normalized];
    if (next !== undefined) {
      onActivate(next.id);
      tabRefs.current.get(next.id)?.focus({ preventScroll: true });
    }
  };
  const handleKeyDown = (
    event: ReactKeyboardEvent<HTMLButtonElement>,
    containerId: string,
    index: number,
  ) => {
    if (disabled) return;
    if (event.key === "ArrowLeft") {
      event.preventDefault();
      moveFocus(index - 1);
    } else if (event.key === "ArrowRight") {
      event.preventDefault();
      moveFocus(index + 1);
    } else if (event.key === "Home") {
      event.preventDefault();
      moveFocus(0);
    } else if (event.key === "End") {
      event.preventDefault();
      moveFocus(project.containers.length - 1);
    } else if (event.key === "Enter" || event.key === " ") {
      event.preventDefault();
      onActivate(containerId);
    }
  };

  if (project.containers.length === 0) {
    return <span className="viewport-control__empty">表示するコンテナがありません</span>;
  }
  return (
    <div
      ref={rootRef}
      className="candidate-tabs"
      data-overflow={scrollState.hasOverflow ? "true" : "false"}
    >
      {scrollState.hasOverflow ? (
        <button
          className="candidate-tabs__scroll"
          type="button"
          aria-label="コンテナタブを左へスクロール"
          disabled={disabled || scrollState.atStart}
          onClick={() => scrollerRef.current?.scrollBy({ left: -220, behavior: "smooth" })}
        >
          ‹
        </button>
      ) : null}
      <div
        ref={scrollerRef}
        className="candidate-tabs__list"
        role="tablist"
        aria-label="表示する荷室"
      >
        {project.containers.map((container, index) => (
          <button
            key={container.id}
            ref={(element) => {
              if (element === null) tabRefs.current.delete(container.id);
              else tabRefs.current.set(container.id, element);
            }}
            id={`scene-container-tab-${index}`}
            role="tab"
            type="button"
            aria-controls="scene-viewport-canvas"
            aria-selected={container.id === activeId}
            aria-label={`${container.name}（ID: ${container.id}）`}
            title={`${container.name} — ${container.id}`}
            disabled={disabled}
            tabIndex={container.id === activeId ? 0 : -1}
            onClick={() => onActivate(container.id)}
            onKeyDown={(event) => handleKeyDown(event, container.id, index)}
          >
            {container.name}
          </button>
        ))}
      </div>
      {scrollState.hasOverflow ? (
        <button
          className="candidate-tabs__scroll"
          type="button"
          aria-label="コンテナタブを右へスクロール"
          disabled={disabled || scrollState.atEnd}
          onClick={() => scrollerRef.current?.scrollBy({ left: 220, behavior: "smooth" })}
        >
          ›
        </button>
      ) : null}
    </div>
  );
}

export function SceneWorkspace({
  externalInteractionActive,
  forceInitialRenderError = false,
  historyControls,
  historyRevision,
  onBusyChange,
  onOpenCargoEditor,
  onOpenUsageRequirements,
  onProjectCommit,
  onSelectedContainerChange,
  onRendererError,
  onRendererReady,
  project,
  rendererMounted,
  sessionResetRevision,
}: SceneWorkspaceProps) {
  const [selectedContainerId, setSelectedContainerId] = useState<string>();
  const [placementInteractionActive, setPlacementInteractionActive] = useState(false);
  const [canvasDragActive, setCanvasDragActive] = useState(false);
  const [physicalDialogOpen, setPhysicalDialogOpen] = useState(false);
  const [selectedCargoId, setSelectedCargoId] = useState<string>();
  const [cargoQuery, setCargoQuery] = useState("");
  const [canvasStatus, setCanvasStatus] = useState("");
  const [fitAllRevision, setFitAllRevision] = useState(0);
  const dragPreviewStatusRef = useRef("");
  const dragFollowerGroupRef = useRef<
    | {
        readonly cargoId: string;
        readonly containerId: string;
        readonly project: Project;
        readonly followerCargoIds: readonly string[];
      }
    | undefined
  >(undefined);
  const appliedSessionResetRevisionRef = useRef(0);
  const [stagingOverrides, setStagingOverrides] = useState<
    Record<string, SceneStagingOverride>
  >({});
  const placementPanelRef = useRef<PlacementEditorDialogHandle>(null);
  const selectedContainer = project.containers.find(
    (container) => container.id === selectedContainerId,
  );
  const effectiveContainerId = selectedContainer?.id ?? project.containers[0]?.id;
  const effectiveContainer = project.containers.find(
    (container) => container.id === effectiveContainerId,
  );
  const previousEffectiveContainerIdRef = useRef(effectiveContainerId);
  const physicalValidationController = usePhysicalValidationWorker(
    project,
    effectiveContainerId,
  );

  useEffect(() => {
    if (sessionResetRevision === 0) return;
    let cancelled = false;
    queueMicrotask(() => {
      if (cancelled) return;
      appliedSessionResetRevisionRef.current = sessionResetRevision;
      setSelectedCargoId(undefined);
      setCargoQuery("");
      setCanvasStatus("");
      setCanvasDragActive(false);
      setStagingOverrides({});
      dragPreviewStatusRef.current = "";
      dragFollowerGroupRef.current = undefined;
    });
    return () => {
      cancelled = true;
    };
  }, [sessionResetRevision]);

  useEffect(() => {
    onSelectedContainerChange(effectiveContainerId);
  }, [effectiveContainerId, onSelectedContainerChange]);

  useEffect(() => {
    if (previousEffectiveContainerIdRef.current === effectiveContainerId) return;
    previousEffectiveContainerIdRef.current = effectiveContainerId;
    let cancelled = false;
    queueMicrotask(() => {
      if (cancelled) return;
      setSelectedCargoId(undefined);
      setCanvasStatus("");
    });
    return () => {
      cancelled = true;
    };
  }, [effectiveContainerId]);

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
  const projection = selectWorkspaceSceneProjection(projectionResult);
  const projectionReadOnly =
    projectionResult?.ok === false && projectionResult.recoveryProjection !== undefined;

  useEffect(() => {
    if (projection === null || effectiveContainerId === undefined) return;
    const container = project.containers.find(
      (candidate) => candidate.id === effectiveContainerId,
    );
    if (container === undefined) return;
    const projectedStaged = projection.cargoes.filter(
      (candidate) => candidate.kind === "staged",
    );
    if (projectedStaged.length === 0) return;
    let cancelled = false;
    const sessionResetRevisionAtProjection = appliedSessionResetRevisionRef.current;
    queueMicrotask(() => {
      if (
        cancelled ||
        appliedSessionResetRevisionRef.current !== sessionResetRevisionAtProjection
      ) return;
      setStagingOverrides((current) => {
        let changed = false;
        const next = { ...current };
        for (const projected of projectedStaged) {
          const cargo = project.cargoes.find(
            (candidate) => candidate.id === projected.cargoId,
          );
          if (cargo === undefined) continue;
          const existing = current[cargo.id];
          if (
            existing !== undefined &&
            projectSceneStagingAnchor(cargo, container, existing) !== undefined
          ) {
            continue;
          }
          const anchor = encodeSceneStagingAnchor(
            cargo,
            container,
            projected.orientation,
            projected.positionMm,
            existing?.side,
          );
          if (anchor === undefined) continue;
          const previous = existing;
          if (
            previous === undefined ||
            previous.orientation !== anchor.orientation ||
            previous.side !== anchor.side ||
            previous.gapMm !== anchor.gapMm ||
            previous.tangentCenterDelta2Mm !== anchor.tangentCenterDelta2Mm ||
            previous.zMm !== anchor.zMm
          ) {
            next[cargo.id] = anchor;
            changed = true;
          }
        }
        return changed ? next : current;
      });
    });
    return () => {
      cancelled = true;
    };
  }, [effectiveContainerId, project.cargoes, project.containers, projection]);
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
  const placedCargoCount = new Set(
    project.placements.map((placement) => placement.cargoId),
  ).size;
  const selectedContainerMass = (() => {
    if (effectiveContainer === undefined) return undefined;
    const massesGrams: number[] = [];
    for (const placement of project.placements) {
      if (placement.containerId !== effectiveContainer.id) continue;
      const cargo = project.cargoes.find(
        (candidate) => candidate.id === placement.cargoId,
      );
      if (cargo === undefined) return undefined;
      massesGrams.push(cargo.massGrams);
    }
    return evaluatePayloadCapacity(
      massesGrams,
      effectiveContainer.payloadCapacityGrams,
    );
  })();
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
  const zRotationAllowed = nextZOrientation !== undefined && selectedCargo !== undefined;
  const xRotationAllowed =
    nextXOrientation !== undefined &&
    selectedCargo !== undefined &&
    !isUprightOnlyOrientationPolicy(selectedCargo.allowedOrientations);
  const interactionActive =
    placementInteractionActive || canvasDragActive || physicalDialogOpen;
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
        ? "別のCLP操作または保存処理を完了すると座標入力を開けます。"
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

  const handleCargoSelectionChange = useCallback((cargoId?: string) => {
    setSelectedCargoId(cargoId);
    setCanvasStatus("");
  }, []);

  const handleContainerActivation = useCallback((containerId: string) => {
    if (interactionActive || externalInteractionActive) {
      setCanvasStatus("開いている操作を完了するとコンテナを切り替えられます。");
      return;
    }
    if (containerId === effectiveContainerId) return;
    setSelectedContainerId(containerId);
    setCanvasStatus("");
  }, [effectiveContainerId, externalInteractionActive, interactionActive]);

  const handleCompactStaging = useCallback(() => {
    if (
      effectiveContainerId === undefined ||
      stagedCount === 0 ||
      interactionActive ||
      externalInteractionActive ||
      projectionReadOnly
    ) {
      setCanvasStatus("現在は荷室外の積荷をコンテナへ寄せられません。");
      return;
    }
    const compacted = compactSceneStagingOverrides(
      project,
      effectiveContainerId,
      stagingOverrides,
    );
    if (compacted === undefined) {
      setCanvasStatus("荷室外の積荷を安全に再配置できませんでした。");
      return;
    }
    setStagingOverrides({ ...compacted });
    setFitAllRevision((current) => current + 1);
    setCanvasStatus(
      `荷室外の積荷${stagedCount}件をコンテナの近くへ寄せました。この整理はUndoと保存の対象外です。`,
    );
  }, [effectiveContainerId, externalInteractionActive, interactionActive, project, projectionReadOnly, stagedCount, stagingOverrides]);

  const handleCargoDragStateChange = useCallback((active: boolean) => {
    setCanvasDragActive(active);
    if (active) {
      setCanvasStatus("床面に平行な配置移動をプレビュー中です。離すと1 mm単位で保存します。");
    } else {
      dragPreviewStatusRef.current = "";
      dragFollowerGroupRef.current = undefined;
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
          followerCargoIds: [],
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
      const followerCargoIds =
        projectedCargo.kind === "placed"
          ? (() => {
              const cached = dragFollowerGroupRef.current;
              if (
                cached?.project === project &&
                cached.containerId === effectiveContainerId &&
                cached.cargoId === cargoId
              ) {
                return cached.followerCargoIds;
              }
              const derived = singleSupportDescendantCargoIds(
                project,
                effectiveContainerId,
                cargoId,
              );
              dragFollowerGroupRef.current = {
                project,
                containerId: effectiveContainerId,
                cargoId,
                followerCargoIds: derived,
              };
              return derived;
            })()
          : [];
      const groupMessage =
        followerCargoIds.length === 0
          ? message
          : `${message} 上段積荷${followerCargoIds.length}件も連動します。`;
      if (dragPreviewStatusRef.current !== groupMessage) {
        dragPreviewStatusRef.current = groupMessage;
        setCanvasStatus(groupMessage);
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
        followerCargoIds,
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
          message: "別のCLP操作または保存処理中のため、積荷の移動を保存しませんでした。",
        };
      }
      const projectedCargo = projection?.cargoes.find(
        (candidate) => candidate.cargoId === cargoId,
      );
      if (projectedCargo?.kind === "staged") {
        if (effectiveContainerId === undefined) {
          return {
            ok: false,
            message: "配置先のコンテナが見つからないため、積荷を荷室外の作業スペースへ戻しました。",
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
              "対象の積荷またはコンテナが最新のCLPに見つからないため、荷室外の作業スペースへ戻しました。",
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
          setStagingOverrides((current) => {
            const anchor = encodeSceneStagingAnchor(
              cargo,
              container,
              projectedCargo.orientation,
              nextPosition,
              current[cargoId]?.side,
            );
            return anchor === undefined
              ? current
              : { ...current, [cargoId]: anchor };
          });
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
              "CLPが更新されたため配置を保存できませんでした。積荷を荷室外の作業スペースへ戻しました。",
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
              ? `${cargo.name}を単独支持としてX ${nextPosition.xMm}・Y ${nextPosition.yMm}・Z ${nextPosition.zMm} mmへ配置しました。物理判定を再計算しています。`
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
          message: "対象の配置が最新のCLPに見つからないため、移動を保存せず元に戻しました。",
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
            "対象の積荷またはコンテナが最新のCLPに見つからないため、移動を保存せず元に戻しました。",
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
        const followerCargoIds = singleSupportDescendantCargoIds(
          project,
          effectiveContainerId,
          cargoId,
        );
        if (followerCargoIds.length > 0) {
          return {
            ok: false,
            message: `上に積荷が${followerCargoIds.length}件あるため荷室外へ移動できません。先に上の積荷を外してください。`,
          };
        }
        const result = deletePlacement(project, cargoId, effectiveContainerId);
        if (!result.ok) {
          return {
            ok: false,
            message:
              result.issues.some(
                (issue) => issue.code === "command.supported-cargo-present",
              )
                ? "上に積荷があるため荷室外へ移動できません。先に上の積荷を外してください。"
                : "対象の配置が最新のCLPに見つからないため、荷室外の作業スペースへ戻せず元の配置を保持しました。",
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
              "CLPが更新されたため配置を削除できませんでした。元の配置を確認してやり直してください。",
          };
        }
        setStagingOverrides((current) => {
          const anchor = encodeSceneStagingAnchor(
            cargo,
            container,
            placement.orientation,
            nextPosition,
            current[cargoId]?.side,
          );
          return anchor === undefined
            ? current
            : { ...current, [cargoId]: anchor };
        });
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
            "CLPが更新されたため移動を保存できませんでした。配置を確認してやり直してください。",
        };
      }
      if (!transition.changed) {
        setCanvasStatus("配置位置は変わりませんでした。");
        return { ok: true, message: "" };
      }
      setCanvasStatus(
        preview.state === "single-support"
          ? `配置をX ${nextPosition.xMm}・Y ${nextPosition.yMm}・Z ${nextPosition.zMm} mmへ移動し、単独支持として保存しました。物理判定を再計算しています。`
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
      setCanvasStatus("別のCLP操作または保存処理の完了後に回転できます。");
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
        "対象の積荷が最新のCLPに見つからないため、回転しませんでした。",
      );
      return;
    }
    const nextOrientation =
      axis === "X"
        ? xAxisQuarterTurnOrientation(rotationProjection.orientation)
        : floorQuarterTurnOrientation(rotationProjection.orientation);
    if (
      axis === "X" &&
      isUprightOnlyOrientationPolicy(cargo.allowedOrientations)
    ) {
      setCanvasStatus(
        "この積荷は天地無用のため、X軸回転を利用できません。",
      );
      return;
    }
    if (rotationProjection.kind === "staged") {
      const container = project.containers.find(
        (candidate) => candidate.id === effectiveContainerId,
      );
      if (container === undefined) {
        setCanvasStatus(
          "対象のコンテナが最新のCLPに見つからないため、回転しませんでした。",
        );
        return;
      }
      setStagingOverrides((current) => {
        const currentAnchor = current[selectedCargoId] ?? encodeSceneStagingAnchor(
          cargo,
          container,
          rotationProjection.orientation,
          rotationProjection.positionMm,
        );
        if (currentAnchor === undefined) return current;
        const anchor: SceneStagingOverride = {
          ...currentAnchor,
          orientation: nextOrientation,
        };
        return projectSceneStagingAnchor(cargo, container, anchor) === undefined
          ? current
          : { ...current, [selectedCargoId]: anchor };
      });
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
        "対象の配置が最新のCLPに見つからないため、回転を保存しませんでした。",
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
        "CLPが更新されたため回転を保存できませんでした。配置を確認してやり直してください。",
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
      <h2 id="scene-workspace-title" className="visually-hidden">3D積載作業</h2>

      {rendererMounted ? (
        <>
          <div className="scene-workspace__candidate-tabs">
            <CandidateTabs
              activeId={effectiveContainerId}
              disabled={interactionActive || externalInteractionActive}
              onActivate={handleContainerActivation}
              project={project}
            />
          </div>
          <ThreeViewport
            bottomOverlay={(
              <div className="viewport-control viewport-control--cargo">
                {canvasStatus === "" && (projectionResult === undefined || projectionResult.ok) ? null : (
                  <div className="viewport-action-feedback">
                    {canvasStatus === "" ? null : (
                      <p className="scene-workspace__action-status" aria-hidden="true">
                        {canvasStatus}
                      </p>
                    )}
                    {projectionResult !== undefined && !projectionResult.ok ? (
                      <p className="scene-workspace__error" role="alert">
                        {projectionErrorMessage(projectionResult.error.code)}
                      </p>
                    ) : null}
                  </div>
                )}
              {project.cargoes.length === 0 ? (
                <span className="viewport-control__empty">積荷を登録すると、ここから操作対象を選べます</span>
              ) : (
                <>
              <label className="visually-hidden" htmlFor="scene-cargo-search">積荷を検索</label>
              <input
                id="scene-cargo-search"
                type="search"
                aria-label="積荷を検索"
                value={cargoQuery}
                disabled={interactionActive || externalInteractionActive}
                placeholder="積荷名またはID"
                onChange={(event) => setCargoQuery(event.target.value)}
              />
              <label className="visually-hidden" htmlFor="scene-cargo-select">操作する積荷</label>
              <div className="viewport-control__cargo-selector">
                <select
                  id="scene-cargo-select"
                  aria-label="操作する積荷"
                  value={selectedCargoId ?? ""}
                  disabled={interactionActive || externalInteractionActive}
                  onChange={(event) => handleCargoSelectionChange(event.target.value || undefined)}
                >
                  <option value="">操作する積荷を選択</option>
                  {selectableCargoes.map((cargo) => (
                    <option key={cargo.id} value={cargo.id}>
                      {cargo.name} — {cargo.dimensionsMm.lengthMm}×{cargo.dimensionsMm.widthMm}×{cargo.dimensionsMm.heightMm} mm／{gramsToKilograms(cargo.massGrams)} kg
                    </option>
                  ))}
                </select>
                <span
                  className="viewport-control__cargo-state"
                  data-state={
                    selectedCargo === undefined
                      ? "none"
                      : selectedAnyPlacement === undefined
                        ? "unplaced"
                        : selectedOtherContainer === undefined
                          ? "current"
                          : "other"
                  }
                  role="img"
                  aria-label={
                    selectedCargo === undefined
                      ? "積荷未選択"
                      : selectedAnyPlacement === undefined
                        ? "未配置"
                        : selectedOtherContainer === undefined
                          ? "現在のコンテナに配置済み"
                          : "別のコンテナに配置済み"
                  }
                  title={
                    selectedCargo === undefined
                      ? "積荷未選択"
                      : selectedAnyPlacement === undefined
                        ? "未配置"
                        : selectedOtherContainer === undefined
                          ? "現在のコンテナに配置済み"
                          : "別のコンテナに配置済み"
                  }
                />
              </div>
                </>
              )}
              <div className="viewport-context-actions" aria-live="polite">
                {selectedCargo === undefined ? (
                  <p className="viewport-context-actions__empty">積荷を選択すると操作を表示します。</p>
                ) : (
                  <>
                    <div className="viewport-context-actions__summary">
                      <strong>{selectedCargo.name}</strong>
                      <span>
                        {selectedAnyPlacement === undefined
                          ? "荷室外（未配置）"
                          : selectedOtherContainer === undefined
                            ? `現在の座標 — X ${selectedAnyPlacement.positionMm.xMm} / Y ${selectedAnyPlacement.positionMm.yMm} / Z ${selectedAnyPlacement.positionMm.zMm} mm`
                            : `${selectedOtherContainer.name}に配置 — X ${selectedAnyPlacement.positionMm.xMm} / Y ${selectedAnyPlacement.positionMm.yMm} / Z ${selectedAnyPlacement.positionMm.zMm} mm`}
                      </span>
                      {selectedPresentation === undefined ? null : (
                        <span className="visually-hidden">
                          X奥行 {selectedPresentation.depthMm} mm、Y横幅 {selectedPresentation.widthMm} mm、Z高さ {selectedPresentation.heightMm} mm
                        </span>
                      )}
                    </div>
                    <div className="viewport-context-actions__buttons">
                      {selectedOtherContainer !== undefined ? (
                        <button
                          id="scene-selection-show-container"
                          type="button"
                          aria-disabled={externalInteractionActive || interactionActive ? true : undefined}
                          onClick={() => handleContainerActivation(selectedOtherContainer.id)}
                        >
                          {selectedOtherContainer.name}を表示
                        </button>
                      ) : (
                        <button
                          id="scene-selection-coordinate-action"
                          type="button"
                          aria-disabled={coordinateActionDisabled ? true : undefined}
                          onClick={() => {
                            if (selectedCargoId === undefined) return;
                            if (coordinateActionDisabled) {
                              setCanvasStatus(coordinateActionReason ?? "現在は配置を編集できません。");
                              return;
                            }
                            placementPanelRef.current?.openCoordinatesForCargo(selectedCargoId);
                          }}
                        >
                          {selectedAnyPlacement === undefined ? "座標を入力して配置" : "座標を微調整"}
                        </button>
                      )}
                      <button
                        id="scene-selection-edit-cargo"
                        type="button"
                        aria-disabled={externalInteractionActive || interactionActive ? true : undefined}
                        onClick={() => {
                          if (externalInteractionActive || interactionActive) {
                            setCanvasStatus("開いている操作を完了すると積荷情報を編集できます。");
                            return;
                          }
                          onOpenCargoEditor({ kind: "edit", cargoId: selectedCargo.id });
                        }}
                      >
                        積荷情報を編集
                      </button>
                      {selectedPlacement !== undefined ? (
                        <button
                          id="scene-selection-remove-placement"
                          type="button"
                          aria-disabled={externalInteractionActive || interactionActive ? true : undefined}
                          onClick={() => {
                            if (externalInteractionActive || interactionActive) {
                              setCanvasStatus("開いている操作を完了すると荷室から外せます。");
                              return;
                            }
                            placementPanelRef.current?.openDeleteForCargo(selectedCargo.id);
                          }}
                        >
                          荷室から外す
                        </button>
                      ) : null}
                      {selectedAnyPlacement === undefined ? (
                        <button
                          id="scene-selection-delete-cargo"
                          className="danger-button"
                          type="button"
                          aria-disabled={externalInteractionActive || interactionActive ? true : undefined}
                          onClick={() => {
                            if (externalInteractionActive || interactionActive) {
                              setCanvasStatus("開いている操作を完了すると積荷を削除できます。");
                              return;
                            }
                            onOpenCargoEditor({ kind: "delete", cargoId: selectedCargo.id });
                          }}
                        >
                          積荷自体を削除
                        </button>
                      ) : null}
                    </div>
                  </>
                )}
              </div>
              </div>
            )}
            forceInitialRenderError={forceInitialRenderError}
            fitAllRevision={fitAllRevision}
            historyControls={(
              <>
                <button
                  type="button"
                  className="viewport__compact-staging"
                  aria-label="荷室外の積荷をコンテナへ寄せる"
                  title="荷室外の積荷をコンテナへ寄せる"
                  disabled={
                    effectiveContainerId === undefined ||
                    stagedCount === 0 ||
                    interactionActive ||
                    externalInteractionActive ||
                    projectionReadOnly
                  }
                  onClick={handleCompactStaging}
                >
                  <MagnetIcon />
                </button>
                <ProjectHistoryControls {...historyControls} compact />
              </>
            )}
            validationControl={(
              <PhysicalValidationLamp
                controller={physicalValidationController}
                disabled={externalInteractionActive || interactionActive}
                onOpen={() => setPhysicalDialogOpen(true)}
                project={project}
              />
            )}
            interactionDisabled={
              externalInteractionActive ||
              placementInteractionActive ||
              physicalDialogOpen ||
              projectionReadOnly
            }
            onCargoDragCancel={handleCargoDragCancel}
            onCargoDragCommit={handleCargoDragCommit}
            onCargoDragPreview={handleCargoDragPreview}
            onCargoDragStateChange={handleCargoDragStateChange}
            onCargoXAxisRotation={() => handleCargoRotation("X")}
            onCargoZAxisRotation={() => handleCargoRotation("Z")}
            onRotationUnavailable={setCanvasStatus}
            onCargoSelectionChange={
              projectionReadOnly ? () => undefined : handleCargoSelectionChange
            }
            onRendererError={onRendererError}
            onRendererReady={onRendererReady}
            projection={projection}
            loadSummary={{
              loadedCargoCount: placedCargoCount,
              totalCargoCount: project.cargoes.length,
              totalMassGrams:
                selectedContainerMass?.calculable === true
                  ? selectedContainerMass.totalMassGrams
                  : undefined,
              payloadCapacityGrams: effectiveContainer?.payloadCapacityGrams,
            }}
            xRotationDisabled={
              externalInteractionActive ||
              interactionActive ||
              projectionReadOnly ||
              selectedProjection === undefined ||
              !xRotationAllowed
            }
            xRotationExplanation={
              externalInteractionActive
                ? "別のCLP操作または保存処理の完了後にX軸回転できます。"
                : projectionReadOnly
                ? "3D表示のエラーを解消するとX軸回転できます。"
                : canvasDragActive
                ? "積荷の移動を完了するとX軸回転できます。"
                : placementInteractionActive
                ? "配置の編集または削除確認を完了するとX軸回転できます。"
                : selectedProjection === undefined
                ? "積荷を選択するとX軸回転できます。"
                : xRotationAllowed
                  ? "X軸を中心に90°回転します。"
                  : "天地無用のため、X軸回転は利用できません。"
            }
            zRotationDisabled={
              externalInteractionActive ||
              interactionActive ||
              projectionReadOnly ||
              selectedProjection === undefined ||
              !zRotationAllowed
            }
            zRotationExplanation={
              externalInteractionActive
                ? "別のCLP操作または保存処理の完了後にZ軸回転できます。"
                : projectionReadOnly
                ? "3D表示のエラーを解消するとZ軸回転できます。"
                : canvasDragActive
                ? "積荷の移動を完了するとZ軸回転できます。"
                : placementInteractionActive
                ? "配置の編集または削除確認を完了するとZ軸回転できます。"
                : selectedProjection === undefined
                ? "積荷を選択するとZ軸回転できます。"
                : zRotationAllowed
                  ? "Z軸を中心に床面上で90°回転します。"
                  : "積荷を選択するとZ軸回転できます。"
            }
            selectedCargoId={selectedProjection === undefined ? undefined : selectedCargoId}
            statusDescriptionId="scene-workspace-status scene-workspace-action-status scene-workspace-interaction-help"
          />
        </>
      ) : null}

      <p id="scene-workspace-status" className="visually-hidden">
        {effectiveContainerId === undefined
          ? `コンテナ0件、積荷${project.cargoes.length}件。`
          : `選択中のコンテナの配置${placementCount}件、荷室外${stagedCount}件。物理判定は保存済み配置だけから更新されます。`}
      </p>
      <p
        id="scene-workspace-action-status"
        className="visually-hidden"
        aria-live="polite"
        aria-atomic="true"
      >
        {canvasStatus}
      </p>
      <p id="scene-workspace-interaction-help" className="visually-hidden">
        3Dでは積荷を直接選ぶか、下部で検索・選択できます。空白の左ドラッグで視点回転、右ドラッグまたはCtrlを押しながら左ドラッグで平行移動します。ホイールで拡大・縮小できます。
      </p>

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
          controller={physicalValidationController}
          onClose={() => setPhysicalDialogOpen(false)}
          onOpenUsageRequirements={() => {
            setPhysicalDialogOpen(false);
            window.requestAnimationFrame(() => {
              window.requestAnimationFrame(onOpenUsageRequirements);
            });
          }}
          open={physicalDialogOpen}
          project={project}
        />
      </div>
    </section>
  );
}
