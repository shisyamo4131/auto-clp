import { useEffect, useRef } from "react";
import * as THREE from "three";
import { OrbitControls } from "three/addons/controls/OrbitControls.js";

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

interface ThreeViewportProps {
  readonly forceInitialRenderError?: boolean;
  readonly interactionDisabled: boolean;
  readonly onCargoDragCancel: (message: string) => void;
  readonly onCargoDragCommit: (
    cargoId: string,
    deltaScene: Pick<SceneVector3, "x" | "z">,
  ) => CargoDragCommitResult;
  readonly onCargoDragStateChange: (active: boolean) => void;
  readonly onCargoFloorRotation: () => void;
  readonly onCargoSelectionChange: (cargoId?: string) => void;
  readonly onRendererError: () => void;
  readonly onRendererReady: () => void;
  readonly projection: ProjectSceneProjection | null;
  readonly rotationDisabled: boolean;
  readonly rotationExplanation: string;
  readonly selectedCargoId?: string;
  readonly statusDescriptionId: string;
}

interface CargoVisual {
  readonly kind: "placed" | "staged";
  readonly mesh: THREE.Mesh<THREE.BoxGeometry, THREE.MeshStandardMaterial>;
  readonly outline: THREE.LineSegments<THREE.EdgesGeometry, THREE.LineBasicMaterial>;
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
  lastDelta: THREE.Vector3;
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

    geometries.push(cargoGeometry, outlineGeometry);
    materials.push(cargoMaterial, outlineMaterial);
    cargoVisuals.set(cargo.cargoId, {
      kind: cargo.kind,
      mesh: cargoMesh,
      outline,
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

export function ThreeViewport({
  forceInitialRenderError = false,
  interactionDisabled,
  onCargoDragCancel,
  onCargoDragCommit,
  onCargoDragStateChange,
  onCargoFloorRotation,
  onCargoSelectionChange,
  onRendererError,
  onRendererReady,
  projection,
  rotationDisabled,
  rotationExplanation,
  selectedCargoId,
  statusDescriptionId,
}: ThreeViewportProps) {
  const containerRef = useRef<HTMLDivElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const cameraControlsRef = useRef<HTMLDivElement>(null);
  const rotationControlRef = useRef<HTMLDivElement>(null);
  const interactionDisabledRef = useRef(interactionDisabled);
  const resetViewRef = useRef<() => void>(() => undefined);
  const zoomInRef = useRef<() => void>(() => undefined);
  const zoomOutRef = useRef<() => void>(() => undefined);
  const selectedCargoIdRef = useRef(selectedCargoId);
  const updateSelectionRef = useRef<(cargoId?: string) => void>(() => undefined);
  const selectedCargoKind = projection?.cargoes.find(
    (cargo) => cargo.cargoId === selectedCargoId,
  )?.kind;
  const stagedCargoCount =
    projection?.cargoes.filter((cargo) => cargo.kind === "staged").length ?? 0;

  useEffect(() => {
    interactionDisabledRef.current = interactionDisabled;
  }, [interactionDisabled]);

  useEffect(() => {
    selectedCargoIdRef.current = selectedCargoId;
    updateSelectionRef.current(selectedCargoId);
  }, [selectedCargoId]);

  useEffect(() => {
    const container = containerRef.current;
    const canvas = canvasRef.current;
    const cameraControls = cameraControlsRef.current;
    const rotationControl = rotationControlRef.current;
    if (
      container === null ||
      canvas === null ||
      cameraControls === null ||
      rotationControl === null
    ) {
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

    const hideRotationControl = () => {
      rotationControl.style.visibility = "hidden";
    };
    let updateRotationControlPosition: () => void = hideRotationControl;
    let reportRendererError: () => void = () => undefined;
    const renderScene = (): boolean => {
      if (disposed || renderer === undefined) return false;
      try {
        renderer.render(scene, camera);
        updateRotationControlPosition();
        return true;
      } catch {
        reportRendererError();
        return false;
      }
    };

    const updateSelection = (cargoId?: string): boolean => {
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
        visual.outline.visible = selected;
      }
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
        lastDelta: new THREE.Vector3(),
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
      gesture.lastDelta.copy(currentPoint).sub(gesture.startPlanePoint);
      gesture.mesh.position.copy(gesture.startMeshPosition);
      gesture.mesh.position.x += gesture.lastDelta.x;
      gesture.mesh.position.z += gesture.lastDelta.z;
      renderScene();
    };

    const handlePointerUp = (event: PointerEvent) => {
      if (gesture === undefined || gesture.pointerId !== event.pointerId) return;
      event.preventDefault();
      event.stopImmediatePropagation();
      const completedGesture = gesture;
      restoreGesturePreview();
      releaseGesture();
      if (completedGesture.dragActive) {
        const result = onCargoDragCommit(completedGesture.cargoId, {
          x: completedGesture.lastDelta.x,
          z: completedGesture.lastDelta.z,
        });
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

    const dispose = () => {
      if (disposed) return;
      disposed = true;
      hideRotationControl();
      rollbackGesture("3D表示が更新されたため、未確定の配置移動を元に戻しました。");
      canvas.removeEventListener("pointerdown", handlePointerDown, true);
      canvas.removeEventListener("pointermove", handlePointerMove, true);
      canvas.removeEventListener("pointerup", handlePointerUp, true);
      canvas.removeEventListener("pointercancel", handlePointerCancel, true);
      canvas.removeEventListener("lostpointercapture", handleLostPointerCapture, true);
      canvas.removeEventListener("webglcontextlost", handleContextLost);
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
    window.addEventListener("keydown", handleKeyDown);
    window.addEventListener("blur", handleWindowBlur);

    try {
      renderer = new THREE.WebGLRenderer({ canvas, antialias: true, alpha: false });
      renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, 2));
      renderer.setClearColor(0x07111f, 1);

      const resizeAndRender = () => {
        if (disposed || renderer === undefined) return;
        try {
          const width = Math.max(container.clientWidth, 1);
          const height = Math.max(container.clientHeight, 1);
          renderer.setSize(width, height, false);
          camera.aspect = width / height;
          camera.updateProjectionMatrix();
          if (!renderScene()) return;
          if (!readyReported) {
            readyReported = true;
            onRendererReady();
          }
        } catch {
          reportRendererError();
        }
      };

      const width = Math.max(container.clientWidth, 1);
      const height = Math.max(container.clientHeight, 1);
      renderer.setSize(width, height, false);
      camera.aspect = width / height;
      const initialTarget = fitCamera(camera, projection);
      controls = new OrbitControls(camera, canvas);
      controls.target.copy(initialTarget);
      configureCameraDistanceLimits(controls, camera, projection);
      controls.enableZoom = false;
      controls.mouseButtons.LEFT = THREE.MOUSE.ROTATE;
      controls.mouseButtons.MIDDLE = THREE.MOUSE.DOLLY;
      controls.mouseButtons.RIGHT = THREE.MOUSE.PAN;
      controls.screenSpacePanning = true;
      controls.update();
      controls.addEventListener("change", renderScene);
      canvas.style.touchAction = "pan-y";

      updateRotationControlPosition = () => {
        const cargoId = selectedCargoIdRef.current;
        const visual = cargoId === undefined ? undefined : cargoVisuals.get(cargoId);
        if (
          disposed ||
          renderer === undefined ||
          visual === undefined ||
          visual.kind === "staged"
        ) {
          hideRotationControl();
          return;
        }
        const anchor = visual.mesh.position.clone().project(camera);
        if (
          !Number.isFinite(anchor.x) ||
          !Number.isFinite(anchor.y) ||
          !Number.isFinite(anchor.z) ||
          anchor.z < -1 ||
          anchor.z > 1 ||
          anchor.x < -1 ||
          anchor.x > 1 ||
          anchor.y < -1 ||
          anchor.y > 1
        ) {
          hideRotationControl();
          return;
        }
        const viewportWidth = Math.max(container.clientWidth, 1);
        const viewportHeight = Math.max(container.clientHeight, 1);
        const controlWidth = Math.min(rotationControl.offsetWidth, viewportWidth - 16);
        const controlHeight = Math.min(rotationControl.offsetHeight, viewportHeight - 16);
        const projectedX = ((anchor.x + 1) / 2) * viewportWidth;
        const projectedY = ((1 - anchor.y) / 2) * viewportHeight;
        let left = THREE.MathUtils.clamp(
          projectedX - controlWidth / 2,
          8,
          Math.max(8, viewportWidth - controlWidth - 8),
        );
        let top = THREE.MathUtils.clamp(
          projectedY - controlHeight - 12,
          8,
          Math.max(8, viewportHeight - controlHeight - 8),
        );
        const cameraLeft = cameraControls.offsetLeft;
        const cameraTop = cameraControls.offsetTop;
        const cameraRight = cameraLeft + cameraControls.offsetWidth;
        const cameraBottom = cameraTop + cameraControls.offsetHeight;
        const overlapsCameraControls =
          left < cameraRight + 8 &&
          left + controlWidth > cameraLeft - 8 &&
          top < cameraBottom + 8 &&
          top + controlHeight > cameraTop - 8;
        if (overlapsCameraControls) {
          const belowControls = cameraBottom + 8;
          if (belowControls + controlHeight <= viewportHeight - 8) {
            top = belowControls;
          } else {
            const leftOfControls = cameraLeft - controlWidth - 8;
            if (leftOfControls < 8) {
              hideRotationControl();
              return;
            }
            left = leftOfControls;
          }
        }
        rotationControl.style.left = `${left}px`;
        rotationControl.style.top = `${top}px`;
        rotationControl.style.visibility = "visible";
      };

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
    };
  }, [forceInitialRenderError, onCargoDragCancel, onCargoDragCommit, onCargoDragStateChange, onCargoSelectionChange, onRendererError, onRendererReady, projection]);

  return (
    <div className="viewport" ref={containerRef}>
      <div
        ref={cameraControlsRef}
        className="viewport__camera-controls"
        role="group"
        aria-label="3D表示の視点操作"
      >
        <button type="button" aria-label="拡大" onClick={() => zoomInRef.current()}>
          ＋
        </button>
        <button type="button" aria-label="縮小" onClick={() => zoomOutRef.current()}>
          －
        </button>
        <button type="button" onClick={() => resetViewRef.current()}>
          荷室全体を表示
        </button>
      </div>
      <div
        ref={rotationControlRef}
        className="viewport__cargo-action"
        style={{ visibility: "hidden" }}
      >
        {selectedCargoId === undefined || selectedCargoKind !== "placed" ? null : (
          <>
          <button
            type="button"
            disabled={rotationDisabled}
            aria-describedby="viewport-floor-rotation-explanation"
            onClick={onCargoFloorRotation}
          >
            床面で90°回転
          </button>
          <span id="viewport-floor-rotation-explanation">
            {rotationExplanation}
          </span>
          </>
        )}
      </div>
      {stagedCargoCount === 0 ? null : (
        <div className="viewport__staging-label">
          仮置き場 <strong>{stagedCargoCount}件</strong>
        </div>
      )}
      <canvas
        ref={canvasRef}
        role="img"
        aria-label="積荷を選択・床面移動できる3Dプレビュー"
        aria-describedby={statusDescriptionId}
      />
    </div>
  );
}
