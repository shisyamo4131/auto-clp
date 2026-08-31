import { useEffect, useRef, useState, type ReactNode } from "react";
import * as THREE from "three";
import { OrbitControls } from "three/addons/controls/OrbitControls.js";

import type { PositionMm } from "../domain/model";
import {
  sceneBoundsReachRadius,
  sceneContainerBounds,
  sceneProjectionBounds,
  type ProjectSceneProjection,
  type SceneVector3,
} from "./project-scene";

export interface CargoDragCommitResult {
  readonly message: string;
  readonly ok: boolean;
}

export type CargoDragPreviewState =
  | "outside"
  | "floor"
  | "single-support"
  | "support-conditions-unverified"
  | "invalid";

export interface CargoDragPreviewResult {
  readonly positionMm: PositionMm;
  readonly sceneDelta: SceneVector3;
  readonly state: CargoDragPreviewState;
  readonly supporterIds: readonly string[];
}

interface ThreeViewportProps {
  readonly bottomOverlay?: ReactNode;
  readonly forceInitialRenderError?: boolean;
  readonly interactionDisabled: boolean;
  readonly onCargoDragCancel: (message: string) => void;
  readonly onCargoDragCommit: (
    cargoId: string,
    preview: CargoDragPreviewResult,
  ) => CargoDragCommitResult;
  readonly onCargoDragPreview: (
    cargoId: string,
    deltaScene: Pick<SceneVector3, "x" | "z">,
  ) => CargoDragPreviewResult;
  readonly onCargoDragStateChange: (active: boolean) => void;
  readonly onCargoXAxisRotation: () => void;
  readonly onCargoZAxisRotation: () => void;
  readonly onRotationUnavailable: (message: string) => void;
  readonly onCargoSelectionChange: (cargoId?: string) => void;
  readonly onRendererError: () => void;
  readonly onRendererReady: () => void;
  readonly projection: ProjectSceneProjection | null;
  readonly historyControls: ReactNode;
  readonly validationControl?: ReactNode;
  readonly xRotationDisabled: boolean;
  readonly xRotationExplanation: string;
  readonly zRotationDisabled: boolean;
  readonly zRotationExplanation: string;
  readonly selectedCargoId?: string;
  readonly statusDescriptionId: string;
}

interface CameraViewState {
  readonly containerId: string;
  readonly direction: readonly [number, number, number];
  readonly distanceRatio: number;
  readonly position: readonly [number, number, number];
  readonly target: readonly [number, number, number];
}

interface DimensionAnnotationLine {
  readonly axis: "X" | "Y" | "Z";
  readonly end: readonly [number, number];
  readonly label: string;
  readonly labelPosition: readonly [number, number];
  readonly start: readonly [number, number];
  readonly witnesses: readonly {
    readonly end: readonly [number, number];
    readonly start: readonly [number, number];
  }[];
}

interface CargoVisual {
  readonly kind: "placed" | "staged";
  readonly mesh: THREE.Mesh<THREE.BoxGeometry, THREE.MeshStandardMaterial>;
  readonly outline: THREE.LineSegments<THREE.EdgesGeometry, THREE.LineBasicMaterial>;
  readonly focusOutline: THREE.LineSegments<
    THREE.EdgesGeometry,
    THREE.LineDashedMaterial
  >;
}

interface CargoPointerGesture {
  readonly cargoId: string;
  readonly mesh: THREE.Mesh;
  readonly plane: THREE.Plane;
  readonly pointerId: number;
  readonly startClientX: number;
  readonly startClientY: number;
  readonly startMeshPosition: THREE.Vector3;
  readonly startPlanePoint: THREE.Vector3;
  dragActive: boolean;
  lastPreview?: CargoDragPreviewResult;
}

function setVector(target: THREE.Vector3, source: SceneVector3): void {
  target.set(source.x, source.y, source.z);
}

function fitCamera(
  camera: THREE.PerspectiveCamera,
  projection: ProjectSceneProjection | null,
): THREE.Vector3 {
  if (projection === null) {
    camera.near = 0.01;
    camera.far = 10;
    camera.position.set(1.6, 1.2, 1.8);
    camera.lookAt(0, 0, 0);
    camera.updateProjectionMatrix();
    return new THREE.Vector3(0, 0, 0);
  }

  const bounds = sceneContainerBounds(projection);
  const radius = Math.max(bounds.radius, 0.001);
  const distance = cameraFramingDistance(camera, radius);
  const viewDirection = new THREE.Vector3(-1, 0.72, 0.9).normalize();
  const target = new THREE.Vector3(bounds.center.x, bounds.center.y, bounds.center.z);

  camera.near = Math.max(radius / 1_000, 0.0001);
  camera.position.copy(target).addScaledVector(viewDirection, distance);
  const projectionBounds = sceneProjectionBounds(projection);
  const projectionCenter = new THREE.Vector3(
    projectionBounds.center.x,
    projectionBounds.center.y,
    projectionBounds.center.z,
  );
  camera.far = Math.max(
    camera.position.distanceTo(projectionCenter) + projectionBounds.radius * 1.1,
    distance + radius * 20,
    10,
  );
  camera.lookAt(target);
  camera.updateProjectionMatrix();
  return target;
}

function cameraFramingDistance(
  camera: THREE.PerspectiveCamera,
  radius: number,
): number {
  const verticalHalfFov = THREE.MathUtils.degToRad(camera.fov / 2);
  const horizontalHalfFov = Math.atan(
    Math.tan(verticalHalfFov) * Math.max(camera.aspect, 0.01),
  );
  const limitingHalfFov = Math.min(verticalHalfFov, horizontalHalfFov);
  return Math.max(radius / Math.sin(limitingHalfFov) * 1.08, 0.01);
}

function configureCameraDistanceLimits(
  controls: OrbitControls,
  camera: THREE.PerspectiveCamera,
  projection: ProjectSceneProjection | null,
): void {
  if (projection === null) {
    controls.minDistance = 0.05;
    controls.maxDistance = 50;
    return;
  }

  const containerRadius = Math.max(sceneContainerBounds(projection).radius, 0.001);
  const projectionBounds = sceneProjectionBounds(projection);
  const projectionReachRadius = sceneBoundsReachRadius(
    { x: controls.target.x, y: controls.target.y, z: controls.target.z },
    projectionBounds,
  );
  controls.minDistance = Math.max(containerRadius * 0.15, 0.001);
  controls.maxDistance = Math.max(
    containerRadius * 20,
    cameraFramingDistance(camera, projectionReachRadius) * 1.5,
    10,
  );
  camera.far = Math.max(
    camera.far,
    controls.maxDistance + projectionReachRadius * 1.1,
  );
  camera.updateProjectionMatrix();
}

function addProjection(
  scene: THREE.Scene,
  projection: ProjectSceneProjection,
  geometries: THREE.BufferGeometry[],
  materials: THREE.Material[],
): Map<string, CargoVisual> {
  const cargoVisuals = new Map<string, CargoVisual>();
  const containerBox = new THREE.BoxGeometry(
    projection.container.dimensions.x,
    projection.container.dimensions.y,
    projection.container.dimensions.z,
  );
  const containerEdges = new THREE.EdgesGeometry(containerBox);
  const containerMaterial = new THREE.LineBasicMaterial({ color: 0x72eadc });
  const containerLines = new THREE.LineSegments(containerEdges, containerMaterial);
  setVector(containerLines.position, projection.container.center);
  scene.add(containerLines);
  geometries.push(containerBox, containerEdges);
  materials.push(containerMaterial);

  const opening = projection.container.opening;
  const halfWidth = opening.width / 2;
  const halfHeight = opening.height / 2;
  const openingGeometry = new THREE.BufferGeometry();
  openingGeometry.setAttribute(
    "position",
    new THREE.Float32BufferAttribute(
      [
        0, -halfHeight, -halfWidth,
        0, halfHeight, -halfWidth,
        0, halfHeight, -halfWidth,
        0, halfHeight, halfWidth,
        0, halfHeight, halfWidth,
        0, -halfHeight, halfWidth,
        0, -halfHeight, halfWidth,
        0, -halfHeight, -halfWidth,
      ],
      3,
    ),
  );
  const openingMaterial = new THREE.LineBasicMaterial({ color: 0xedb852 });
  const openingLines = new THREE.LineSegments(openingGeometry, openingMaterial);
  setVector(openingLines.position, opening.center);
  scene.add(openingLines);
  geometries.push(openingGeometry);
  materials.push(openingMaterial);

  for (const cargo of projection.cargoes) {
    const staged = cargo.kind === "staged";
    const cargoGeometry = new THREE.BoxGeometry(
      cargo.dimensions.x,
      cargo.dimensions.y,
      cargo.dimensions.z,
    );
    const cargoMaterial = new THREE.MeshStandardMaterial({
      color: staged ? 0xf0a35b : 0x40d4c4,
      opacity: staged ? 0.58 : 0.8,
      roughness: 0.55,
      transparent: true,
    });
    const cargoMesh = new THREE.Mesh(cargoGeometry, cargoMaterial);
    cargoMesh.name = cargo.name;
    cargoMesh.userData.cargoId = cargo.cargoId;
    setVector(cargoMesh.position, cargo.center);
    scene.add(cargoMesh);

    const outlineGeometry = new THREE.EdgesGeometry(cargoGeometry);
    const outlineMaterial = new THREE.LineBasicMaterial({
      color: staged ? 0xffd19a : 0xffe69a,
    });
    const outline = new THREE.LineSegments(outlineGeometry, outlineMaterial);
    outline.visible = false;
    outline.renderOrder = 1;
    cargoMesh.add(outline);

    const focusOutlineMaterial = new THREE.LineDashedMaterial({
      color: 0xb9c1ca,
      dashSize: 0.035,
      gapSize: 0.02,
      opacity: 0.9,
      transparent: true,
    });
    const focusOutline = new THREE.LineSegments(
      outlineGeometry,
      focusOutlineMaterial,
    );
    focusOutline.computeLineDistances();
    focusOutline.visible = false;
    focusOutline.renderOrder = 2;
    cargoMesh.add(focusOutline);

    geometries.push(cargoGeometry, outlineGeometry);
    materials.push(cargoMaterial, outlineMaterial, focusOutlineMaterial);
    cargoVisuals.set(cargo.cargoId, {
      kind: cargo.kind,
      mesh: cargoMesh,
      outline,
      focusOutline,
    });
  }

  return cargoVisuals;
}

function pointerIsFine(event: PointerEvent): boolean {
  if (event.pointerType === "touch") {
    return false;
  }
  return window.matchMedia?.("(any-pointer: fine)").matches ?? event.pointerType === "mouse";
}

function AxisRotationIcon({ axis }: { readonly axis: "X" | "Z" }) {
  return (
    <svg
      aria-hidden="true"
      className={`viewport__rotation-icon viewport__rotation-icon--${axis.toLowerCase()}`}
      viewBox="0 0 24 24"
      focusable="false"
    >
      <path d="M4 12a8 5 0 0 0 13.7 3.5l-1.8-.9A6 3.5 0 0 1 6 12a6 3.5 0 0 1 9.9-2.6L13 11h8V5l-3.2 1.8A8 5 0 0 0 4 12Z" />
      <path d="M11 3h2v18h-2z" />
    </svg>
  );
}

function ResetViewIcon() {
  return (
    <svg
      aria-hidden="true"
      className="viewport__reset-view-icon"
      viewBox="0 0 24 24"
      focusable="false"
    >
      <path d="M21 16.5c0 .38-.21.73-.55.9l-8 4.5a.9.9 0 0 1-.9 0l-8-4.5A1.03 1.03 0 0 1 3 16.5v-9c0-.38.21-.73.55-.9l8-4.5a.9.9 0 0 1 .9 0l8 4.5c.34.17.55.52.55.9v9ZM12 4.15 6.04 7.5 12 10.85l5.96-3.35L12 4.15ZM5 15.91l6 3.38v-6.71L5 9.21v6.7Zm14 0v-6.7l-6 3.37v6.71l6-3.38Z" />
    </svg>
  );
}

export function ThreeViewport({
  bottomOverlay,
  forceInitialRenderError = false,
  interactionDisabled,
  onCargoDragCancel,
  onCargoDragCommit,
  onCargoDragPreview,
  onCargoDragStateChange,
  onCargoXAxisRotation,
  onCargoZAxisRotation,
  onRotationUnavailable,
  onCargoSelectionChange,
  onRendererError,
  onRendererReady,
  projection,
  historyControls,
  validationControl,
  xRotationDisabled,
  xRotationExplanation,
  zRotationDisabled,
  zRotationExplanation,
  selectedCargoId,
  statusDescriptionId,
}: ThreeViewportProps) {
  const containerRef = useRef<HTMLDivElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const bottomOverlayRef = useRef<HTMLDivElement>(null);
  const interactionDisabledRef = useRef(interactionDisabled);
  const resetViewRef = useRef<() => void>(() => undefined);
  const zoomInRef = useRef<() => void>(() => undefined);
  const zoomOutRef = useRef<() => void>(() => undefined);
  const selectedCargoIdRef = useRef(selectedCargoId);
  const updateSelectionRef = useRef<(cargoId?: string) => void>(() => undefined);
  const cameraViewRef = useRef<CameraViewState | undefined>(undefined);
  const [dimensionAnnotations, setDimensionAnnotations] = useState<
    readonly DimensionAnnotationLine[]
  >([]);

  useEffect(() => {
    interactionDisabledRef.current = interactionDisabled;
  }, [interactionDisabled]);

  useEffect(() => {
    selectedCargoIdRef.current = selectedCargoId;
    updateSelectionRef.current(selectedCargoId);
  }, [selectedCargoId]);

  const hasBottomOverlay = bottomOverlay !== undefined;
  useEffect(() => {
    const container = containerRef.current;
    const overlay = bottomOverlayRef.current;
    if (container === null || overlay === null) return;
    let animationFrame: number | undefined;
    let appliedSafeAreaPx = -1;
    const measureAndApplySafeArea = () => {
      animationFrame = undefined;
      const bottomOffsetPx = Number.parseFloat(window.getComputedStyle(overlay).bottom);
      const safeAreaPx = Math.max(
        0,
        overlay.offsetHeight +
          (Number.isFinite(bottomOffsetPx) ? Math.ceil(bottomOffsetPx) : 0) +
          8,
      );
      if (Math.abs(safeAreaPx - appliedSafeAreaPx) < 1) return;
      appliedSafeAreaPx = safeAreaPx;
      container.style.setProperty("--viewport-bottom-safe-area", `${safeAreaPx}px`);
    };
    const scheduleSafeAreaUpdate = () => {
      if (animationFrame !== undefined) return;
      animationFrame = window.requestAnimationFrame(measureAndApplySafeArea);
    };
    const resizeObserver = new ResizeObserver(scheduleSafeAreaUpdate);
    resizeObserver.observe(overlay);
    scheduleSafeAreaUpdate();
    return () => {
      resizeObserver.disconnect();
      if (animationFrame !== undefined) {
        window.cancelAnimationFrame(animationFrame);
      }
      container.style.removeProperty("--viewport-bottom-safe-area");
    };
  }, [hasBottomOverlay]);

  useEffect(() => {
    const container = containerRef.current;
    const canvas = canvasRef.current;
    if (container === null || canvas === null) {
      return;
    }

    let renderer: THREE.WebGLRenderer | undefined;
    let controls: OrbitControls | undefined;
    let gesture: CargoPointerGesture | undefined;
    const geometries: THREE.BufferGeometry[] = [];
    const materials: THREE.Material[] = [];
    let resizeObserver: ResizeObserver | undefined;
    let disposed = false;
    let readyReported = false;
    const scene = new THREE.Scene();
    const camera = new THREE.PerspectiveCamera(45, 1, 0.1, 100);
    const raycaster = new THREE.Raycaster();
    const pointerNdc = new THREE.Vector2();
    const cargoVisuals =
      projection === null
        ? new Map<string, CargoVisual>()
        : addProjection(scene, projection, geometries, materials);
    scene.add(new THREE.HemisphereLight(0xc8f8ff, 0x1d2b44, 2.2));

    let reportRendererError: () => void = () => undefined;
    const renderScene = (): boolean => {
      if (disposed || renderer === undefined) return false;
      try {
        renderer.render(scene, camera);
        const selected = projection?.cargoes.find(
          (cargo) => cargo.cargoId === selectedCargoIdRef.current,
        );
        if (selected === undefined) {
          setDimensionAnnotations((current) =>
            current.length === 0 ? current : [],
          );
        } else {
          const next = (() => {
            const canvasBounds = canvas.getBoundingClientRect();
            const containerBounds = container.getBoundingClientRect();
            if (canvasBounds.width <= 0 || canvasBounds.height <= 0) return [];
            const half = new THREE.Vector3(
              selected.dimensions.x / 2,
              selected.dimensions.y / 2,
              selected.dimensions.z / 2,
            );
            const visualCenter = cargoVisuals.get(selected.cargoId)?.mesh.position;
            const center = visualCenter?.clone() ?? new THREE.Vector3(
              selected.center.x,
              selected.center.y,
              selected.center.z,
            );
            if (
              Math.abs(camera.position.x - center.x) <= half.x &&
              Math.abs(camera.position.y - center.y) <= half.y &&
              Math.abs(camera.position.z - center.z) <= half.z
            ) {
              return [];
            }

            type CornerSign = -1 | 1;
            interface ProjectedCorner {
              readonly cameraDepth: number;
              readonly clipDepthVisible: boolean;
              readonly ndc: THREE.Vector3;
              readonly screen: readonly [number, number];
              readonly signs: readonly [CornerSign, CornerSign, CornerSign];
            }
            const signs = [-1, 1] as const;
            const corners: ProjectedCorner[] = [];
            const cornerByKey = new Map<string, ProjectedCorner>();
            const cornerKey = (
              xSign: CornerSign,
              ySign: CornerSign,
              zSign: CornerSign,
            ) => `${xSign},${ySign},${zSign}`;
            for (const xSign of signs) {
              for (const ySign of signs) {
                for (const zSign of signs) {
                  const point = new THREE.Vector3(
                    center.x + half.x * xSign,
                    center.y + half.y * ySign,
                    center.z + half.z * zSign,
                  );
                  const cameraPoint = point.clone().applyMatrix4(camera.matrixWorldInverse);
                  const cameraDepth = -cameraPoint.z;
                  const ndc = point.clone().project(camera);
                  const finite = [cameraDepth, ndc.x, ndc.y, ndc.z].every(Number.isFinite);
                  const corner: ProjectedCorner = {
                    cameraDepth,
                    clipDepthVisible:
                      finite &&
                      cameraDepth >= camera.near &&
                      cameraDepth <= camera.far &&
                      ndc.z >= -1 &&
                      ndc.z <= 1,
                    ndc,
                    screen: [
                      canvasBounds.left - containerBounds.left +
                        (ndc.x + 1) * canvasBounds.width / 2,
                      canvasBounds.top - containerBounds.top +
                        (1 - ndc.y) * canvasBounds.height / 2,
                    ],
                    signs: [xSign, ySign, zSign],
                  };
                  corners.push(corner);
                  cornerByKey.set(cornerKey(xSign, ySign, zSign), corner);
                }
              }
            }
            const clipCorners = corners.filter((corner) => corner.clipDepthVisible);
            if (clipCorners.length === 0) return [];
            const minNdcX = Math.min(...clipCorners.map((corner) => corner.ndc.x));
            const maxNdcX = Math.max(...clipCorners.map((corner) => corner.ndc.x));
            const minNdcY = Math.min(...clipCorners.map((corner) => corner.ndc.y));
            const maxNdcY = Math.max(...clipCorners.map((corner) => corner.ndc.y));
            if (maxNdcX < -1 || minNdcX > 1 || maxNdcY < -1 || minNdcY > 1) {
              return [];
            }

            const adjacentCorners = (corner: ProjectedCorner) => {
              const [xSign, ySign, zSign] = corner.signs;
              return [
                cornerByKey.get(cornerKey(xSign === 1 ? -1 : 1, ySign, zSign)),
                cornerByKey.get(cornerKey(xSign, ySign, zSign === 1 ? -1 : 1)),
                cornerByKey.get(cornerKey(xSign, ySign === 1 ? -1 : 1, zSign)),
              ] as const;
            };
            const candidates = clipCorners.filter((corner) =>
              adjacentCorners(corner).every(
                (adjacent) => adjacent?.clipDepthVisible === true,
              ),
            );
            if (candidates.length === 0) return [];
            const screenCenter: readonly [number, number] = [
              clipCorners.reduce((sum, corner) => sum + corner.screen[0], 0) /
                clipCorners.length,
              clipCorners.reduce((sum, corner) => sum + corner.screen[1], 0) /
                clipCorners.length,
            ];
            const preferredSigns: readonly [CornerSign, CornerSign, CornerSign] = [
              camera.position.x >= center.x ? 1 : -1,
              camera.position.y >= center.y ? 1 : -1,
              camera.position.z >= center.z ? 1 : -1,
            ];
            const viewportDistanceSquared = (corner: ProjectedCorner) => {
              const xDistance = corner.ndc.x < -1
                ? -1 - corner.ndc.x
                : corner.ndc.x > 1
                  ? corner.ndc.x - 1
                  : 0;
              const yDistance = corner.ndc.y < -1
                ? -1 - corner.ndc.y
                : corner.ndc.y > 1
                  ? corner.ndc.y - 1
                  : 0;
              return xDistance * xDistance + yDistance * yDistance;
            };
            const preferredMatchCount = (corner: ProjectedCorner) =>
              corner.signs.reduce(
                (count, sign, index) => count + (sign === preferredSigns[index] ? 1 : 0),
                0,
              );
            const baseCorner = [...candidates].sort((first, second) => {
              const viewportDifference =
                viewportDistanceSquared(first) - viewportDistanceSquared(second);
              if (viewportDifference !== 0) return viewportDifference;
              const preferredDifference =
                preferredMatchCount(second) - preferredMatchCount(first);
              if (preferredDifference !== 0) return preferredDifference;
              const firstRadius = Math.hypot(
                first.screen[0] - screenCenter[0],
                first.screen[1] - screenCenter[1],
              );
              const secondRadius = Math.hypot(
                second.screen[0] - screenCenter[0],
                second.screen[1] - screenCenter[1],
              );
              return secondRadius - firstRadius || first.cameraDepth - second.cameraDepth;
            })[0];
            if (baseCorner === undefined) return [];
            const adjacent = adjacentCorners(baseCorner);
            if (adjacent.some((corner) => corner === undefined)) return [];
            const definitions = [
              {
                axis: "X" as const,
                adjacent: adjacent[0]!,
                label: `${selected.dimensionsMm.xMm} mm`,
              },
              {
                axis: "Y" as const,
                adjacent: adjacent[1]!,
                label: `${selected.dimensionsMm.yMm} mm`,
              },
              {
                axis: "Z" as const,
                adjacent: adjacent[2]!,
                label: `${selected.dimensionsMm.zMm} mm`,
              },
            ];
            const lineOffset = 18;
            const labelOffset = 12;
            const canvasScreenBounds = {
              left: canvasBounds.left - containerBounds.left,
              top: canvasBounds.top - containerBounds.top,
              right: canvasBounds.right - containerBounds.left,
              bottom: canvasBounds.bottom - containerBounds.top,
            };
            const clampLabelPosition = (
              label: string,
              proposed: readonly [number, number],
            ): readonly [number, number] => {
              const estimatedGlyphWidth = Array.from(label).reduce(
                (width, character) =>
                  width + ((character.codePointAt(0) ?? 0) <= 0x7f ? 7 : 12),
                0,
              );
              const estimatedHalfWidth = (estimatedGlyphWidth + 10) / 2;
              const estimatedHalfHeight = 11;
              const inset = 6;
              const minX = canvasScreenBounds.left + estimatedHalfWidth + inset;
              const maxX = canvasScreenBounds.right - estimatedHalfWidth - inset;
              const minY = canvasScreenBounds.top + estimatedHalfHeight + inset;
              const maxY = canvasScreenBounds.bottom - estimatedHalfHeight - inset;
              const clampAxis = (value: number, minimum: number, maximum: number) =>
                minimum <= maximum
                  ? Math.min(maximum, Math.max(minimum, value))
                  : (minimum + maximum) / 2;
              return [
                clampAxis(proposed[0], minX, maxX),
                clampAxis(proposed[1], minY, maxY),
              ];
            };
            return definitions.map(({ adjacent: edgeEnd, axis, label }) => {
              const edgeStart = baseCorner.screen;
              const edgeEndScreen = edgeEnd.screen;
              const midpoint: readonly [number, number] = [
                (edgeStart[0] + edgeEndScreen[0]) / 2,
                (edgeStart[1] + edgeEndScreen[1]) / 2,
              ];
              let outwardX = midpoint[0] - screenCenter[0];
              let outwardY = midpoint[1] - screenCenter[1];
              let outwardLength = Math.hypot(outwardX, outwardY);
              if (outwardLength < 0.5) {
                const edgeX = edgeEndScreen[0] - edgeStart[0];
                const edgeY = edgeEndScreen[1] - edgeStart[1];
                outwardX = -edgeY;
                outwardY = edgeX;
                if (
                  outwardX * (edgeStart[0] - screenCenter[0]) +
                    outwardY * (edgeStart[1] - screenCenter[1]) <
                  0
                ) {
                  outwardX *= -1;
                  outwardY *= -1;
                }
                outwardLength = Math.hypot(outwardX, outwardY);
              }
              if (!Number.isFinite(outwardLength) || outwardLength === 0) {
                outwardX = 0;
                outwardY = -1;
                outwardLength = 1;
              }
              outwardX /= outwardLength;
              outwardY /= outwardLength;
              const offsetPoint = (
                point: readonly [number, number],
                distance: number,
              ): readonly [number, number] => [
                point[0] + outwardX * distance,
                point[1] + outwardY * distance,
              ];
              const proposedLabelPosition = offsetPoint(
                midpoint,
                lineOffset + labelOffset,
              );
              return {
                axis,
                start: offsetPoint(edgeStart, lineOffset),
                end: offsetPoint(edgeEndScreen, lineOffset),
                label,
                labelPosition: clampLabelPosition(label, proposedLabelPosition),
                witnesses: [
                  { start: edgeStart, end: offsetPoint(edgeStart, lineOffset - 4) },
                  { start: edgeEndScreen, end: offsetPoint(edgeEndScreen, lineOffset - 4) },
                ],
              };
            });
          })();
          setDimensionAnnotations(next);
        }
        return true;
      } catch {
        reportRendererError();
        return false;
      }
    };

    const applySelectionVisuals = (cargoId?: string): void => {
      for (const [candidateId, visual] of cargoVisuals) {
        const selected = candidateId === cargoId;
        const staged = visual.kind === "staged";
        visual.mesh.material.color.setHex(
          selected
            ? staged
              ? 0xffbe75
              : 0x72eadc
            : staged
              ? 0xf0a35b
              : 0x40d4c4,
        );
        visual.mesh.material.opacity = selected
          ? staged
            ? 0.82
            : 0.96
          : staged
            ? 0.58
            : 0.8;
        visual.mesh.material.emissive.setHex(
          selected ? (staged ? 0x4a260c : 0x123c3a) : 0x000000,
        );
        visual.mesh.material.depthWrite = true;
        visual.outline.visible = selected;
        visual.outline.material.color.setHex(staged ? 0xffd19a : 0xffe69a);
        visual.focusOutline.visible = false;
        visual.focusOutline.material.color.setHex(0xb9c1ca);
      }
    };
    const applyDragFocusVisuals = (
      draggedCargoId: string,
      supporterIds: readonly string[],
      supporterColor: number,
    ): void => {
      for (const [candidateId, visual] of cargoVisuals) {
        if (candidateId === draggedCargoId) continue;
        visual.mesh.material.color.setHex(0xb9c1ca);
        visual.mesh.material.opacity = 0.08;
        visual.mesh.material.emissive.setHex(0x000000);
        visual.mesh.material.depthWrite = false;
        visual.outline.visible = false;
        visual.focusOutline.visible = true;
        visual.focusOutline.material.color.setHex(0xb9c1ca);
      }
      for (const supporterId of supporterIds) {
        const supporter = cargoVisuals.get(supporterId);
        if (supporter === undefined || supporterId === draggedCargoId) continue;
        supporter.focusOutline.visible = true;
        supporter.focusOutline.material.color.setHex(supporterColor);
      }
    };
    const updateSelection = (cargoId?: string): boolean => {
      applySelectionVisuals(cargoId);
      return renderScene();
    };
    updateSelectionRef.current = updateSelection;

    const setPointerFromEvent = (event: PointerEvent) => {
      const bounds = canvas.getBoundingClientRect();
      pointerNdc.set(
        ((event.clientX - bounds.left) / Math.max(bounds.width, 1)) * 2 - 1,
        -((event.clientY - bounds.top) / Math.max(bounds.height, 1)) * 2 + 1,
      );
      raycaster.setFromCamera(pointerNdc, camera);
    };

    const restoreGesturePreview = () => {
      if (gesture !== undefined) {
        gesture.mesh.position.copy(gesture.startMeshPosition);
        applySelectionVisuals(selectedCargoIdRef.current);
        renderScene();
      }
    };

    const releaseGesture = () => {
      if (gesture === undefined) return;
      const pointerId = gesture.pointerId;
      const wasActive = gesture.dragActive;
      gesture = undefined;
      try {
        if (canvas.hasPointerCapture(pointerId)) canvas.releasePointerCapture(pointerId);
      } catch {
        // Pointer capture may already have been released by the browser during teardown.
      }
      if (controls !== undefined) controls.enabled = true;
      if (wasActive) onCargoDragStateChange(false);
    };

    const rollbackGesture = (message: string) => {
      if (gesture === undefined) return;
      const wasActive = gesture.dragActive;
      restoreGesturePreview();
      releaseGesture();
      if (wasActive) onCargoDragCancel(message);
    };

    const handlePointerDown = (event: PointerEvent) => {
      if (gesture !== undefined) return;
      const finePointer = pointerIsFine(event);
      if (event.button !== 0) {
        if (!finePointer) event.stopImmediatePropagation();
        return;
      }
      setPointerFromEvent(event);
      const intersections = raycaster.intersectObjects(
        [...cargoVisuals.values()].map((visual) => visual.mesh),
        false,
      );
      const hit = intersections[0];
      const cargoId = hit?.object.userData.cargoId as string | undefined;
      if (!finePointer) {
        event.stopImmediatePropagation();
        onCargoSelectionChange(cargoId);
        return;
      }
      if (cargoId === undefined || hit === undefined) {
        onCargoSelectionChange(undefined);
        return;
      }

      event.preventDefault();
      event.stopImmediatePropagation();
      onCargoSelectionChange(cargoId);
      if (interactionDisabledRef.current) return;

      const mesh = hit.object as THREE.Mesh;
      const plane = new THREE.Plane(new THREE.Vector3(0, 1, 0), -mesh.position.y);
      const startPlanePoint = new THREE.Vector3();
      if (raycaster.ray.intersectPlane(plane, startPlanePoint) === null) return;
      gesture = {
        cargoId,
        dragActive: false,
        mesh,
        plane,
        pointerId: event.pointerId,
        startClientX: event.clientX,
        startClientY: event.clientY,
        startMeshPosition: mesh.position.clone(),
        startPlanePoint,
      };
      canvas.setPointerCapture(event.pointerId);
      if (controls !== undefined) controls.enabled = false;
    };

    const handlePointerMove = (event: PointerEvent) => {
      if (gesture === undefined || gesture.pointerId !== event.pointerId) return;
      event.preventDefault();
      event.stopImmediatePropagation();
      if (!gesture.dragActive) {
        if (Math.hypot(event.clientX - gesture.startClientX, event.clientY - gesture.startClientY) < 4) return;
        gesture.dragActive = true;
        onCargoDragStateChange(true);
      }
      setPointerFromEvent(event);
      const currentPoint = new THREE.Vector3();
      if (raycaster.ray.intersectPlane(gesture.plane, currentPoint) === null) return;
      const rawDelta = currentPoint.sub(gesture.startPlanePoint);
      const preview = onCargoDragPreview(gesture.cargoId, {
        x: rawDelta.x,
        z: rawDelta.z,
      });
      gesture.lastPreview = preview;
      applySelectionVisuals(selectedCargoIdRef.current);
      applyDragFocusVisuals(
        gesture.cargoId,
        preview.supporterIds,
        preview.state === "single-support" ? 0x55d68b : 0xedb852,
      );
      gesture.mesh.position.copy(gesture.startMeshPosition);
      gesture.mesh.position.x += preview.sceneDelta.x;
      gesture.mesh.position.y += preview.sceneDelta.y;
      gesture.mesh.position.z += preview.sceneDelta.z;
      const draggedVisual = cargoVisuals.get(gesture.cargoId);
      if (draggedVisual !== undefined) {
        const stateColor =
          preview.state === "single-support"
            ? 0x55d68b
            : preview.state === "support-conditions-unverified"
              ? 0xedb852
              : preview.state === "invalid"
                ? 0xff6b6b
                : preview.state === "outside"
                  ? 0xf0a35b
                  : 0x72eadc;
        draggedVisual.mesh.material.color.setHex(stateColor);
        draggedVisual.mesh.material.emissive.setHex(
          preview.state === "invalid" ? 0x4a0f16 : 0x162c22,
        );
      }
      renderScene();
    };

    const handlePointerUp = (event: PointerEvent) => {
      if (gesture === undefined || gesture.pointerId !== event.pointerId) return;
      event.preventDefault();
      event.stopImmediatePropagation();
      const completedGesture = gesture;
      restoreGesturePreview();
      releaseGesture();
      if (completedGesture.dragActive && completedGesture.lastPreview !== undefined) {
        const result = onCargoDragCommit(
          completedGesture.cargoId,
          completedGesture.lastPreview,
        );
        if (!result.ok) onCargoDragCancel(result.message);
      }
    };

    const handlePointerCancel = (event: PointerEvent) => {
      if (gesture?.pointerId === event.pointerId) {
        event.stopImmediatePropagation();
        rollbackGesture("ポインター操作が中断されたため、配置の移動を元に戻しました。");
      }
    };
    const handleLostPointerCapture = (event: PointerEvent) => {
      if (gesture?.pointerId === event.pointerId) rollbackGesture("ポインター操作が中断されたため、配置の移動を元に戻しました。");
    };
    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape" && gesture !== undefined) {
        event.preventDefault();
        rollbackGesture("Escapeキーで配置の移動をキャンセルしました。");
      }
    };
    const handleWindowBlur = () => rollbackGesture("ウィンドウの操作が中断されたため、配置の移動を元に戻しました。");
    const handleWheel = (event: WheelEvent) => {
      event.stopImmediatePropagation();
    };

    const dispose = () => {
      if (disposed) return;
      disposed = true;
      rollbackGesture("3D表示が更新されたため、未確定の配置移動を元に戻しました。");
      canvas.removeEventListener("pointerdown", handlePointerDown, true);
      canvas.removeEventListener("pointermove", handlePointerMove, true);
      canvas.removeEventListener("pointerup", handlePointerUp, true);
      canvas.removeEventListener("pointercancel", handlePointerCancel, true);
      canvas.removeEventListener("lostpointercapture", handleLostPointerCapture, true);
      canvas.removeEventListener("webglcontextlost", handleContextLost);
      container.removeEventListener("wheel", handleWheel, true);
      window.removeEventListener("keydown", handleKeyDown);
      window.removeEventListener("blur", handleWindowBlur);
      resizeObserver?.disconnect();
      controls?.dispose();
      for (const geometry of geometries) geometry.dispose();
      for (const material of materials) material.dispose();
      renderer?.dispose();
      if (updateSelectionRef.current === updateSelection) updateSelectionRef.current = () => undefined;
    };

    reportRendererError = () => {
      if (disposed) return;
      dispose();
      onRendererError();
    };
    function handleContextLost(event: Event) {
      event.preventDefault();
      reportRendererError();
    }

    canvas.addEventListener("pointerdown", handlePointerDown, true);
    canvas.addEventListener("pointermove", handlePointerMove, true);
    canvas.addEventListener("pointerup", handlePointerUp, true);
    canvas.addEventListener("pointercancel", handlePointerCancel, true);
    canvas.addEventListener("lostpointercapture", handleLostPointerCapture, true);
    canvas.addEventListener("webglcontextlost", handleContextLost);
    container.addEventListener("wheel", handleWheel, { capture: true, passive: true });
    window.addEventListener("keydown", handleKeyDown);
    window.addEventListener("blur", handleWindowBlur);

    try {
      renderer = new THREE.WebGLRenderer({ canvas, antialias: true, alpha: false });
      renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, 2));
      renderer.setClearColor(0x07111f, 1);

      const rememberCameraView = () => {
        if (projection === null || controls === undefined) return;
        const bounds = sceneContainerBounds(projection);
        const radius = Math.max(bounds.radius, 0.001);
        const offset = camera.position.clone().sub(controls.target);
        const distance = offset.length();
        const framingDistance = cameraFramingDistance(camera, radius);
        cameraViewRef.current = {
          containerId: projection.container.id,
          direction: distance > 0
            ? [offset.x / distance, offset.y / distance, offset.z / distance]
            : [-1, 0.72, 0.9],
          distanceRatio: Number.isFinite(distance / framingDistance)
            ? distance / framingDistance
            : 1,
          position: [camera.position.x, camera.position.y, camera.position.z],
          target: [controls.target.x, controls.target.y, controls.target.z],
        };
      };

      const resizeAndRender = () => {
        if (disposed || renderer === undefined) return;
        try {
          const width = Math.max(canvas.clientWidth, 1);
          const height = Math.max(canvas.clientHeight, 1);
          renderer.setSize(width, height, false);
          camera.aspect = width / height;
          camera.updateProjectionMatrix();
          rememberCameraView();
          if (!renderScene()) return;
          if (!readyReported) {
            readyReported = true;
            onRendererReady();
          }
        } catch {
          reportRendererError();
        }
      };

      const width = Math.max(canvas.clientWidth, 1);
      const height = Math.max(canvas.clientHeight, 1);
      renderer.setSize(width, height, false);
      camera.aspect = width / height;
      const initialTarget = fitCamera(camera, projection);
      controls = new OrbitControls(camera, canvas);
      const savedView = cameraViewRef.current;
      if (
        projection !== null &&
        savedView !== undefined &&
        savedView.containerId === projection.container.id
      ) {
        camera.position.set(...savedView.position);
        controls.target.set(...savedView.target);
      } else if (projection !== null && savedView !== undefined) {
        const bounds = sceneContainerBounds(projection);
        const radius = Math.max(bounds.radius, 0.001);
        const target = new THREE.Vector3(bounds.center.x, bounds.center.y, bounds.center.z);
        const distance = cameraFramingDistance(camera, radius) * savedView.distanceRatio;
        controls.target.copy(target);
        camera.position
          .copy(target)
          .addScaledVector(new THREE.Vector3(...savedView.direction), distance);
      } else {
        controls.target.copy(initialTarget);
      }
      configureCameraDistanceLimits(controls, camera, projection);
      controls.enableZoom = false;
      controls.mouseButtons.LEFT = THREE.MOUSE.ROTATE;
      controls.mouseButtons.MIDDLE = THREE.MOUSE.DOLLY;
      controls.mouseButtons.RIGHT = THREE.MOUSE.PAN;
      controls.screenSpacePanning = true;
      controls.update();
      const renderAndRememberView = () => {
        rememberCameraView();
        renderScene();
      };
      controls.addEventListener("change", renderAndRememberView);
      renderAndRememberView();
      canvas.style.touchAction = "pan-y";

      const resetView = () => {
        if (disposed || controls === undefined) return;
        const target = fitCamera(camera, projection);
        controls.target.copy(target);
        controls.update();
        renderScene();
      };
      const zoomBy = (distanceScale: number) => {
        if (disposed || controls === undefined) return;
        const offset = camera.position.clone().sub(controls.target);
        const currentDistance = offset.length();
        if (!Number.isFinite(currentDistance) || currentDistance <= 0) {
          resetView();
          return;
        }
        const nextDistance = THREE.MathUtils.clamp(
          currentDistance * distanceScale,
          controls.minDistance,
          controls.maxDistance,
        );
        camera.position
          .copy(controls.target)
          .addScaledVector(offset.normalize(), nextDistance);
        controls.update();
        renderScene();
      };
      resetViewRef.current = resetView;
      zoomInRef.current = () => zoomBy(0.8);
      zoomOutRef.current = () => zoomBy(1.25);
      if (!updateSelection(selectedCargoIdRef.current)) return dispose;
      resizeObserver = new ResizeObserver(resizeAndRender);
      resizeObserver.observe(container);
      resizeObserver.observe(canvas);
      if (forceInitialRenderError) throw new Error("Forced initial renderer failure");
      resizeAndRender();
    } catch {
      reportRendererError();
    }

    return () => {
      resetViewRef.current = () => undefined;
      zoomInRef.current = () => undefined;
      zoomOutRef.current = () => undefined;
      dispose();
      setDimensionAnnotations([]);
    };
  }, [forceInitialRenderError, onCargoDragCancel, onCargoDragCommit, onCargoDragPreview, onCargoDragStateChange, onCargoSelectionChange, onRendererError, onRendererReady, projection]);

  return (
    <div className="viewport" ref={containerRef}>
      <div className="viewport__top-controls">
        <div
          className="viewport__camera-controls"
          role="group"
          aria-label="3D作業の操作"
        >
          {historyControls}
          {validationControl}
          <div className="viewport__rotation-controls" role="group" aria-label="選択した積荷の回転">
          <button
            type="button"
            aria-disabled={xRotationDisabled}
            aria-describedby="viewport-x-rotation-reason"
            aria-label="X軸を中心に90°回転"
            title={xRotationExplanation}
            onClick={() => xRotationDisabled
              ? onRotationUnavailable(xRotationExplanation)
              : onCargoXAxisRotation()}
          >
            <AxisRotationIcon axis="X" />
          </button>
          <button
            type="button"
            aria-disabled={zRotationDisabled}
            aria-describedby="viewport-z-rotation-reason"
            aria-label="Z軸を中心に90°回転"
            title={zRotationExplanation}
            onClick={() => zRotationDisabled
              ? onRotationUnavailable(zRotationExplanation)
              : onCargoZAxisRotation()}
          >
            <AxisRotationIcon axis="Z" />
          </button>
          <span className="visually-hidden" id="viewport-x-rotation-reason">{xRotationExplanation}</span>
          <span className="visually-hidden" id="viewport-z-rotation-reason">{zRotationExplanation}</span>
          </div>
          <button type="button" aria-label="拡大" onClick={() => zoomInRef.current()}>
            ＋
          </button>
          <button type="button" aria-label="縮小" onClick={() => zoomOutRef.current()}>
            －
          </button>
          <button
            type="button"
            aria-label="荷室全体を表示"
            title="荷室全体を表示"
            onClick={() => resetViewRef.current()}
          >
            <ResetViewIcon />
          </button>
        </div>
      </div>
      {dimensionAnnotations.length === 0 ? null : (
        <svg
          className="viewport__dimension-annotations"
          aria-hidden="true"
          focusable="false"
        >
          <defs>
            <marker id="dimension-arrow-start" markerWidth="8" markerHeight="8" refX="4" refY="4" orient="auto-start-reverse">
              <path d="M0 0 8 4 0 8Z" />
            </marker>
            <marker id="dimension-arrow-end" markerWidth="8" markerHeight="8" refX="4" refY="4" orient="auto">
              <path d="M0 0 8 4 0 8Z" />
            </marker>
          </defs>
          {dimensionAnnotations.map((annotation) => {
            return (
              <g key={annotation.axis} data-axis={annotation.axis}>
                {annotation.witnesses.map((witness, index) => (
                  <line
                    className="viewport__dimension-witness"
                    key={index}
                    x1={witness.start[0]}
                    y1={witness.start[1]}
                    x2={witness.end[0]}
                    y2={witness.end[1]}
                  />
                ))}
                <line
                  x1={annotation.start[0]}
                  y1={annotation.start[1]}
                  x2={annotation.end[0]}
                  y2={annotation.end[1]}
                  markerStart="url(#dimension-arrow-start)"
                  markerEnd="url(#dimension-arrow-end)"
                />
                <text
                  x={annotation.labelPosition[0]}
                  y={annotation.labelPosition[1]}
                  textAnchor="middle"
                  dominantBaseline="central"
                >
                  {annotation.label}
                </text>
              </g>
            );
          })}
        </svg>
      )}
      {bottomOverlay === undefined ? null : (
        <div
          ref={bottomOverlayRef}
          className="viewport__overlay viewport__overlay--bottom"
        >
          {bottomOverlay}
        </div>
      )}
      <canvas
        id="scene-viewport-canvas"
        ref={canvasRef}
        role="img"
        aria-label="積荷を選択・床面移動できる3Dプレビュー"
        aria-describedby={statusDescriptionId}
      />
    </div>
  );
}
