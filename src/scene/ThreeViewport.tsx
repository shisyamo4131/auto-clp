import { useEffect, useRef } from "react";
import * as THREE from "three";
import { OrbitControls } from "three/addons/controls/OrbitControls.js";

import {
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
  readonly onCargoSelectionChange: (cargoId?: string) => void;
  readonly onRendererError: () => void;
  readonly onRendererReady: () => void;
  readonly projection: ProjectSceneProjection | null;
  readonly selectedCargoId?: string;
  readonly statusDescriptionId: string;
}

interface CargoVisual {
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

  const bounds = sceneProjectionBounds(projection);
  const radius = Math.max(bounds.radius, 0.001);
  const verticalHalfFov = THREE.MathUtils.degToRad(camera.fov / 2);
  const horizontalHalfFov = Math.atan(
    Math.tan(verticalHalfFov) * Math.max(camera.aspect, 0.01),
  );
  const limitingHalfFov = Math.min(verticalHalfFov, horizontalHalfFov);
  const distance = Math.max(radius / Math.sin(limitingHalfFov) * 1.08, 0.01);
  const viewDirection = new THREE.Vector3(-1, 0.72, 0.9).normalize();
  const target = new THREE.Vector3(bounds.center.x, bounds.center.y, bounds.center.z);

  camera.near = Math.max(distance - radius * 1.1, radius / 10_000, 0.0001);
  camera.far = Math.max(distance + radius * 1.1, 1);
  camera.position.copy(target).addScaledVector(viewDirection, distance);
  camera.lookAt(target);
  camera.updateProjectionMatrix();
  return target;
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
    const cargoGeometry = new THREE.BoxGeometry(
      cargo.dimensions.x,
      cargo.dimensions.y,
      cargo.dimensions.z,
    );
    const cargoMaterial = new THREE.MeshStandardMaterial({
      color: 0x40d4c4,
      opacity: 0.8,
      roughness: 0.55,
      transparent: true,
    });
    const cargoMesh = new THREE.Mesh(cargoGeometry, cargoMaterial);
    cargoMesh.name = cargo.name;
    cargoMesh.userData.cargoId = cargo.cargoId;
    setVector(cargoMesh.position, cargo.center);
    scene.add(cargoMesh);

    const outlineGeometry = new THREE.EdgesGeometry(cargoGeometry);
    const outlineMaterial = new THREE.LineBasicMaterial({ color: 0xffe69a });
    const outline = new THREE.LineSegments(outlineGeometry, outlineMaterial);
    outline.visible = false;
    outline.renderOrder = 1;
    cargoMesh.add(outline);

    geometries.push(cargoGeometry, outlineGeometry);
    materials.push(cargoMaterial, outlineMaterial);
    cargoVisuals.set(cargo.cargoId, { mesh: cargoMesh, outline });
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
  onCargoSelectionChange,
  onRendererError,
  onRendererReady,
  projection,
  selectedCargoId,
  statusDescriptionId,
}: ThreeViewportProps) {
  const containerRef = useRef<HTMLDivElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const interactionDisabledRef = useRef(interactionDisabled);
  const resetViewRef = useRef<() => void>(() => undefined);
  const selectedCargoIdRef = useRef(selectedCargoId);
  const updateSelectionRef = useRef<(cargoId?: string) => void>(() => undefined);

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
        return true;
      } catch {
        reportRendererError();
        return false;
      }
    };

    const updateSelection = (cargoId?: string): boolean => {
      for (const [candidateId, visual] of cargoVisuals) {
        const selected = candidateId === cargoId;
        visual.mesh.material.color.setHex(selected ? 0x72eadc : 0x40d4c4);
        visual.mesh.material.opacity = selected ? 0.96 : 0.8;
        visual.mesh.material.emissive.setHex(selected ? 0x123c3a : 0x000000);
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
      controls.mouseButtons.LEFT = THREE.MOUSE.ROTATE;
      controls.mouseButtons.MIDDLE = THREE.MOUSE.DOLLY;
      controls.mouseButtons.RIGHT = THREE.MOUSE.PAN;
      controls.screenSpacePanning = true;
      controls.update();
      controls.addEventListener("change", renderScene);
      canvas.style.touchAction = "pan-y";

      const resetView = () => {
        if (disposed || controls === undefined) return;
        const target = fitCamera(camera, projection);
        controls.target.copy(target);
        controls.update();
        renderScene();
      };
      resetViewRef.current = resetView;
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
      dispose();
    };
  }, [forceInitialRenderError, onCargoDragCancel, onCargoDragCommit, onCargoDragStateChange, onCargoSelectionChange, onRendererError, onRendererReady, projection]);

  return (
    <div className="viewport" ref={containerRef}>
      <button className="viewport__reset" type="button" onClick={() => resetViewRef.current()}>
        視点を初期位置へ戻す
      </button>
      <canvas
        ref={canvasRef}
        role="img"
        aria-label="積荷を選択・床面移動できる3Dプレビュー"
        aria-describedby={statusDescriptionId}
      />
    </div>
  );
}
