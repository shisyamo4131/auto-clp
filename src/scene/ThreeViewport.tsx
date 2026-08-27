import { useEffect, useRef } from "react";
import * as THREE from "three";

import {
  sceneProjectionBounds,
  type ProjectSceneProjection,
  type SceneVector3,
} from "./project-scene";

interface ThreeViewportProps {
  readonly forceInitialRenderError?: boolean;
  readonly onRendererError: () => void;
  readonly onRendererReady: () => void;
  readonly projection: ProjectSceneProjection | null;
  readonly statusDescriptionId: string;
}

function setVector(target: THREE.Vector3, source: SceneVector3): void {
  target.set(source.x, source.y, source.z);
}

function configureCamera(
  camera: THREE.PerspectiveCamera,
  projection: ProjectSceneProjection | null,
): void {
  if (projection === null) {
    camera.near = 0.01;
    camera.far = 10;
    camera.position.set(1.6, 1.2, 1.8);
    camera.lookAt(0, 0, 0);
    camera.updateProjectionMatrix();
    return;
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
}

function addProjection(
  scene: THREE.Scene,
  projection: ProjectSceneProjection,
  geometries: THREE.BufferGeometry[],
  materials: THREE.Material[],
): void {
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
    setVector(cargoMesh.position, cargo.center);
    scene.add(cargoMesh);
    geometries.push(cargoGeometry);
    materials.push(cargoMaterial);
  }
}

export function ThreeViewport({
  forceInitialRenderError = false,
  onRendererError,
  onRendererReady,
  projection,
  statusDescriptionId,
}: ThreeViewportProps) {
  const containerRef = useRef<HTMLDivElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);

  useEffect(() => {
    const container = containerRef.current;
    const canvas = canvasRef.current;
    if (container === null || canvas === null) {
      return;
    }

    let renderer: THREE.WebGLRenderer | undefined;
    const geometries: THREE.BufferGeometry[] = [];
    const materials: THREE.Material[] = [];
    let resizeObserver: ResizeObserver | undefined;
    let disposed = false;
    let readyReported = false;

    const dispose = () => {
      if (disposed) {
        return;
      }
      disposed = true;
      canvas.removeEventListener("webglcontextlost", handleContextLost);
      resizeObserver?.disconnect();
      for (const geometry of geometries) {
        geometry.dispose();
      }
      for (const material of materials) {
        material.dispose();
      }
      renderer?.dispose();
    };

    const reportRendererError = () => {
      if (disposed) {
        return;
      }
      dispose();
      onRendererError();
    };

    function handleContextLost(event: Event) {
      event.preventDefault();
      reportRendererError();
    }

    canvas.addEventListener("webglcontextlost", handleContextLost);

    try {
      renderer = new THREE.WebGLRenderer({ canvas, antialias: true, alpha: false });
      renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, 2));
      renderer.setClearColor(0x07111f, 1);

      const scene = new THREE.Scene();
      const camera = new THREE.PerspectiveCamera(45, 1, 0.1, 100);
      if (projection !== null) {
        addProjection(scene, projection, geometries, materials);
      }
      scene.add(new THREE.HemisphereLight(0xc8f8ff, 0x1d2b44, 2.2));

      const render = () => {
        if (disposed || renderer === undefined) {
          return;
        }
        try {
          const width = Math.max(container.clientWidth, 1);
          const height = Math.max(container.clientHeight, 1);
          renderer.setSize(width, height, false);
          camera.aspect = width / height;
          configureCamera(camera, projection);
          if (forceInitialRenderError && !readyReported) {
            throw new Error("Forced initial renderer failure");
          }
          renderer.render(scene, camera);
          if (!readyReported) {
            readyReported = true;
            onRendererReady();
          }
        } catch {
          reportRendererError();
        }
      };

      resizeObserver = new ResizeObserver(render);
      resizeObserver.observe(container);
      render();
    } catch {
      reportRendererError();
    }

    return dispose;
  }, [forceInitialRenderError, onRendererError, onRendererReady, projection]);

  return (
    <div className="viewport" ref={containerRef}>
      <canvas
        ref={canvasRef}
        role="img"
        aria-label="操作・判定結果ではない確認用直方体の3Dプレビュー"
        aria-describedby={statusDescriptionId}
      />
    </div>
  );
}
