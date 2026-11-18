import type { MeasuredGap } from "../domain/measured-clearance";
import { domainPointToScene } from "./project-scene";
import * as THREE from "three";

import type { ProjectSceneProjection, SceneVector3 } from "./project-scene";

export const LOADING_REPORT_IMAGE_WIDTH = 1200;
export const LOADING_REPORT_IMAGE_HEIGHT = 800;

export type LoadingReportViewKind =
  | "top"
  | "current"
  | "front"
  | "rear"
  | "left"
  | "right";

export interface LoadingReportImageLabel {
  readonly cargoId: string;
  readonly sequenceNumber: number;
}

export interface LoadingReportImage {
  readonly dataUrl: string;
  readonly height: number;
  readonly kind: LoadingReportViewKind;
  readonly labelCount: number;
  readonly title: string;
  readonly width: number;
}

export type LoadingReportImageCaptureResult =
  | {
      readonly images: readonly LoadingReportImage[];
      readonly ok: true;
    }
  | {
      readonly code:
        | "report-image.renderer-unavailable"
        | "report-image.projection-unavailable"
        | "report-image.label-mismatch"
        | "report-image.layout-crowded"
        | "report-image.capture-failed";
      readonly ok: false;
    };

export interface LoadingReportCurrentCameraSnapshot {
  readonly far: number;
  readonly fov: number;
  readonly orthographic?: { readonly halfHeight: number; readonly halfWidth: number };
  readonly near: number;
  readonly position: readonly [number, number, number];
  readonly quaternion: readonly [number, number, number, number];
  readonly up: readonly [number, number, number];
}

export interface LoadingReportFixedViewDefinition {
  readonly direction: readonly [number, number, number];
  readonly kind: Exclude<LoadingReportViewKind, "current" | "top">;
  readonly title: string;
  readonly up: readonly [number, number, number];
}

export const LOADING_REPORT_FIXED_VIEWS: readonly LoadingReportFixedViewDefinition[] = [
  {
    kind: "front",
    title: "正面（開口側）",
    direction: [-1, 0, 0],
    up: [0, 1, 0],
  },
  {
    kind: "rear",
    title: "背面",
    direction: [1, 0, 0],
    up: [0, 1, 0],
  },
  {
    kind: "left",
    title: "左面",
    direction: [0, 0, -1],
    up: [0, 1, 0],
  },
  {
    kind: "right",
    title: "右面",
    direction: [0, 0, 1],
    up: [0, 1, 0],
  },
] as const;

interface ReportSceneResources {
  readonly geometries: readonly THREE.BufferGeometry[];
  readonly materials: readonly THREE.Material[];
  readonly scene: THREE.Scene;
}

interface ReportBounds {
  readonly center: THREE.Vector3;
  readonly corners: readonly THREE.Vector3[];
  readonly radius: number;
}

interface ProjectedLabel {
  readonly anchorX: number;
  readonly anchorY: number;
  readonly sequenceNumber: number;
}

function sceneVector(vector: SceneVector3): THREE.Vector3 {
  return new THREE.Vector3(vector.x, vector.y, vector.z);
}

function addEdges(
  scene: THREE.Scene,
  geometry: THREE.BoxGeometry,
  position: SceneVector3,
  color: number,
  geometries: THREE.BufferGeometry[],
  materials: THREE.Material[],
): void {
  const edges = new THREE.EdgesGeometry(geometry);
  const material = new THREE.LineBasicMaterial({ color });
  const lines = new THREE.LineSegments(edges, material);
  lines.position.copy(sceneVector(position));
  scene.add(lines);
  geometries.push(edges);
  materials.push(material);
}

function createReportScene(projection: ProjectSceneProjection): ReportSceneResources {
  const scene = new THREE.Scene();
  const geometries: THREE.BufferGeometry[] = [];
  const materials: THREE.Material[] = [];
  const containerGeometry = new THREE.BoxGeometry(
    projection.container.dimensions.x,
    projection.container.dimensions.y,
    projection.container.dimensions.z,
  );
  geometries.push(containerGeometry);
  addEdges(
    scene,
    containerGeometry,
    projection.container.center,
    0x72eadc,
    geometries,
    materials,
  );

  const recessed = projection.container.recessedFloor;
  if (recessed) {
    const geometry = new THREE.BoxGeometry(recessed.dimensions.x, recessed.dimensions.y, recessed.dimensions.z);
    geometries.push(geometry); addEdges(scene, geometry, recessed.center, 0xedb852, geometries, materials);
  }
  const opening = projection.container.opening;
  const halfWidth = opening.width / 2;
  const halfHeight = opening.height / 2;
  const openingGeometry = new THREE.BufferGeometry().setFromPoints([
    new THREE.Vector3(0, -halfHeight, -halfWidth),
    new THREE.Vector3(0, halfHeight, -halfWidth),
    new THREE.Vector3(0, halfHeight, -halfWidth),
    new THREE.Vector3(0, halfHeight, halfWidth),
    new THREE.Vector3(0, halfHeight, halfWidth),
    new THREE.Vector3(0, -halfHeight, halfWidth),
    new THREE.Vector3(0, -halfHeight, halfWidth),
    new THREE.Vector3(0, -halfHeight, -halfWidth),
  ]);
  const openingMaterial = new THREE.LineBasicMaterial({ color: 0xedb852 });
  const openingLines = new THREE.LineSegments(openingGeometry, openingMaterial);
  openingLines.position.copy(sceneVector(opening.center));
  scene.add(openingLines);
  geometries.push(openingGeometry);
  materials.push(openingMaterial);

  for (const cargo of projection.cargoes) {
    if (cargo.kind !== "placed") continue;
    const geometry = new THREE.BoxGeometry(
      cargo.dimensions.x,
      cargo.dimensions.y,
      cargo.dimensions.z,
    );
    const material = new THREE.MeshStandardMaterial({
      color: 0x40d4c4,
      opacity: 0.84,
      roughness: 0.55,
      transparent: true,
    });
    const mesh = new THREE.Mesh(geometry, material);
    mesh.position.copy(sceneVector(cargo.center));
    scene.add(mesh);
    geometries.push(geometry);
    materials.push(material);
    addEdges(scene, geometry, cargo.center, 0xe8fffc, geometries, materials);
  }

  scene.add(new THREE.HemisphereLight(0xc8f8ff, 0x1d2b44, 2.2));
  return { geometries, materials, scene };
}

function reportBounds(projection: ProjectSceneProjection): ReportBounds {
  const boxes = [
    projection.container,
    ...projection.cargoes.filter((cargo) => cargo.kind === "placed"),
  ];
  const min = new THREE.Vector3(
    Number.POSITIVE_INFINITY,
    Number.POSITIVE_INFINITY,
    Number.POSITIVE_INFINITY,
  );
  const max = new THREE.Vector3(
    Number.NEGATIVE_INFINITY,
    Number.NEGATIVE_INFINITY,
    Number.NEGATIVE_INFINITY,
  );
  for (const box of boxes) {
    const half = sceneVector(box.dimensions).multiplyScalar(0.5);
    const center = sceneVector(box.center);
    min.min(center.clone().sub(half));
    max.max(center.clone().add(half));
  }
  const center = min.clone().add(max).multiplyScalar(0.5);
  const corners: THREE.Vector3[] = [];
  for (const x of [min.x, max.x]) {
    for (const y of [min.y, max.y]) {
      for (const z of [min.z, max.z]) corners.push(new THREE.Vector3(x, y, z));
    }
  }
  return { center, corners, radius: Math.max(center.distanceTo(max), 0.001) };
}

function currentCamera(
  snapshot: LoadingReportCurrentCameraSnapshot,
): THREE.PerspectiveCamera | THREE.OrthographicCamera {
  const halfHeight = snapshot.orthographic === undefined ? 0 : Math.max(snapshot.orthographic.halfHeight, snapshot.orthographic.halfWidth / (LOADING_REPORT_IMAGE_WIDTH / LOADING_REPORT_IMAGE_HEIGHT));
  const halfWidth = halfHeight * LOADING_REPORT_IMAGE_WIDTH / LOADING_REPORT_IMAGE_HEIGHT;
  const camera = snapshot.orthographic ? new THREE.OrthographicCamera(-halfWidth, halfWidth, halfHeight, -halfHeight, snapshot.near, snapshot.far) : new THREE.PerspectiveCamera(
    snapshot.fov,
    LOADING_REPORT_IMAGE_WIDTH / LOADING_REPORT_IMAGE_HEIGHT,
    snapshot.near,
    snapshot.far,
  );
  camera.position.set(...snapshot.position);
  camera.quaternion.set(...snapshot.quaternion);
  camera.up.set(...snapshot.up);
  camera.updateProjectionMatrix();
  camera.updateMatrixWorld(true);
  return camera;
}

export function createLoadingReportFixedCamera(
  definition: LoadingReportFixedViewDefinition,
  projection: ProjectSceneProjection,
): THREE.OrthographicCamera {
  const bounds = reportBounds(projection);
  const direction = new THREE.Vector3(...definition.direction).normalize();
  const distance = Math.max(bounds.radius * 3, 1);
  const camera = new THREE.OrthographicCamera(-1, 1, 1, -1, 0.001, distance + bounds.radius * 4);
  camera.position.copy(bounds.center).addScaledVector(direction, distance);
  camera.up.set(...definition.up);
  camera.lookAt(bounds.center);
  camera.updateMatrixWorld(true);

  let minX = Number.POSITIVE_INFINITY;
  let maxX = Number.NEGATIVE_INFINITY;
  let minY = Number.POSITIVE_INFINITY;
  let maxY = Number.NEGATIVE_INFINITY;
  for (const corner of bounds.corners) {
    const local = corner.clone().applyMatrix4(camera.matrixWorldInverse);
    minX = Math.min(minX, local.x);
    maxX = Math.max(maxX, local.x);
    minY = Math.min(minY, local.y);
    maxY = Math.max(maxY, local.y);
  }
  const contentWidth = Math.max(maxX - minX, 0.001);
  const contentHeight = Math.max(maxY - minY, 0.001);
  const aspect = LOADING_REPORT_IMAGE_WIDTH / LOADING_REPORT_IMAGE_HEIGHT;
  const paddedWidth = contentWidth * 1.12;
  const paddedHeight = contentHeight * 1.12;
  const frustumWidth = Math.max(paddedWidth, paddedHeight * aspect);
  const frustumHeight = Math.max(paddedHeight, paddedWidth / aspect);
  const centerX = (minX + maxX) / 2;
  const centerY = (minY + maxY) / 2;
  camera.left = centerX - frustumWidth / 2;
  camera.right = centerX + frustumWidth / 2;
  camera.top = centerY + frustumHeight / 2;
  camera.bottom = centerY - frustumHeight / 2;
  camera.updateProjectionMatrix();
  return camera;
}

function flipPixelsVertically(
  pixels: Uint8Array,
  width: number,
  height: number,
): Uint8ClampedArray<ArrayBuffer> {
  const flipped = new Uint8ClampedArray(new ArrayBuffer(pixels.length));
  const rowLength = width * 4;
  for (let y = 0; y < height; y += 1) {
    const sourceStart = (height - y - 1) * rowLength;
    flipped.set(pixels.subarray(sourceStart, sourceStart + rowLength), y * rowLength);
  }
  return flipped;
}

function projectedLabels(
  projection: ProjectSceneProjection,
  camera: THREE.Camera,
  labels: readonly LoadingReportImageLabel[],
): readonly ProjectedLabel[] {
  const labelByCargoId = new Map(labels.map((label) => [label.cargoId, label]));
  return projection.cargoes
    .filter((cargo) => cargo.kind === "placed")
    .flatMap((cargo) => {
      const label = labelByCargoId.get(cargo.cargoId);
      if (label === undefined) return [];
      const projected = sceneVector(cargo.center).project(camera);
      const cameraPoint = sceneVector(cargo.center).applyMatrix4(camera.matrixWorldInverse);
      if (
        ![projected.x, projected.y, projected.z, cameraPoint.z].every(Number.isFinite) ||
        cameraPoint.z >= 0 ||
        projected.z < -1 ||
        projected.z > 1
      ) {
        return [];
      }
      return [{
        anchorX: ((projected.x + 1) * LOADING_REPORT_IMAGE_WIDTH) / 2,
        anchorY: ((1 - projected.y) * LOADING_REPORT_IMAGE_HEIGHT) / 2,
        sequenceNumber: label.sequenceNumber,
      }];
    })
    .sort((first, second) => first.sequenceNumber - second.sequenceNumber);
}

function drawLabels(
  context: CanvasRenderingContext2D,
  labels: readonly ProjectedLabel[],
): readonly { x: number; y: number }[] {
  const occupied: Array<{ readonly x: number; readonly y: number }> = [];
  const radius = 18;
  const margin = radius + 4;
  const offsets: Array<readonly [number, number]> = [[0, 0]];
  for (let ring = 1; ring <= 8; ring += 1) {
    const distance = ring * 32;
    offsets.push(
      [distance, 0], [-distance, 0], [0, distance], [0, -distance],
      [distance, distance], [-distance, distance], [distance, -distance], [-distance, -distance],
    );
  }

  context.save();
  context.font = "700 20px sans-serif";
  context.textAlign = "center";
  context.textBaseline = "middle";
  for (const label of labels) {
    const position = offsets
      .map(([offsetX, offsetY]) => ({
        x: Math.min(
          LOADING_REPORT_IMAGE_WIDTH - margin,
          Math.max(margin, label.anchorX + offsetX),
        ),
        y: Math.min(
          LOADING_REPORT_IMAGE_HEIGHT - margin,
          Math.max(margin, label.anchorY + offsetY),
        ),
      }))
      .find((candidate) =>
        occupied.every((existing) => Math.hypot(candidate.x - existing.x, candidate.y - existing.y) >= 40),
      ) ?? { x: label.anchorX, y: label.anchorY };
    occupied.push(position);

    context.strokeStyle = "rgba(255, 255, 255, 0.95)";
    context.lineWidth = 3;
    context.beginPath();
    context.moveTo(label.anchorX, label.anchorY);
    context.lineTo(position.x, position.y);
    context.stroke();

    context.fillStyle = "#07111f";
    context.strokeStyle = "#ffffff";
    context.lineWidth = 3;
    context.beginPath();
    context.arc(position.x, position.y, radius, 0, Math.PI * 2);
    context.fill();
    context.stroke();
    context.fillStyle = "#ffffff";
    context.fillText(String(label.sequenceNumber), position.x, position.y + 1);
  }
  context.restore();
  return occupied;
}

function renderImage(
  renderer: THREE.WebGLRenderer,
  target: THREE.WebGLRenderTarget,
  scene: THREE.Scene,
  camera: THREE.Camera,
  projection: ProjectSceneProjection,
  labels: readonly LoadingReportImageLabel[],
  kind: LoadingReportViewKind,
  title: string,
  gaps: readonly MeasuredGap[] = [],
): LoadingReportImage {
  renderer.setRenderTarget(target);
  renderer.clear(true, true, true);
  renderer.render(scene, camera);
  const pixels = new Uint8Array(
    LOADING_REPORT_IMAGE_WIDTH * LOADING_REPORT_IMAGE_HEIGHT * 4,
  );
  renderer.readRenderTargetPixels(
    target,
    0,
    0,
    LOADING_REPORT_IMAGE_WIDTH,
    LOADING_REPORT_IMAGE_HEIGHT,
    pixels,
  );
  const canvas = document.createElement("canvas");
  canvas.width = LOADING_REPORT_IMAGE_WIDTH;
  canvas.height = LOADING_REPORT_IMAGE_HEIGHT;
  const context = canvas.getContext("2d");
  if (context === null) throw new Error("2D canvas is unavailable");
  context.putImageData(
    new ImageData(
      flipPixelsVertically(
        pixels,
        LOADING_REPORT_IMAGE_WIDTH,
        LOADING_REPORT_IMAGE_HEIGHT,
      ),
      LOADING_REPORT_IMAGE_WIDTH,
      LOADING_REPORT_IMAGE_HEIGHT,
    ),
    0,
    0,
  );
  const visibleLabels = projectedLabels(projection, camera, labels);
  const occupied: Array<{ x: number; y: number }> = drawLabels(context, visibleLabels).flatMap(p => [{ x: p.x, y: p.y - 20 }, { ...p }, { x: p.x, y: p.y + 20 }]);
  context.save(); context.font = "14px sans-serif"; context.textAlign = "center";
  const renderedGaps = new Set<string>();
  for (const g of gaps) {
    const key = [JSON.stringify(g.start), JSON.stringify(g.end)].sort().join("/");
    if (renderedGaps.has(key)) continue;
    renderedGaps.add(key);
    const a = sceneVector(domainPointToScene(g.start)).project(camera), b = sceneVector(domainPointToScene(g.end)).project(camera);
    const x1 = (a.x + 1) * canvas.width / 2, y1 = (1 - a.y) * canvas.height / 2;
    const x2 = (b.x + 1) * canvas.width / 2, y2 = (1 - b.y) * canvas.height / 2;
    if (a.z < -1 || a.z > 1 || b.z < -1 || b.z > 1 || Math.hypot(x2-x1,y2-y1) < 4) continue;
    context.strokeStyle = "#ffdb88"; context.lineWidth = 1.5;
    context.beginPath(); context.moveTo(x1,y1); context.lineTo(x2,y2); context.stroke();
    const anchorX = Math.max(60, Math.min(canvas.width - 60, (x1 + x2) / 2));
    const anchorY = Math.max(24, Math.min(canvas.height - 24, (y1 + y2) / 2 - 8));
    const candidates: Array<{ x: number; y: number }> = [];
    for (let row = 24; row <= canvas.height - 24; row += 24) {
      for (let column = 60; column <= canvas.width - 60; column += 96) candidates.push({ x: column, y: row });
    }
    candidates.unshift({ x: anchorX, y: anchorY });
    candidates.sort((a, b) => Math.hypot(a.x - anchorX, a.y - anchorY) - Math.hypot(b.x - anchorX, b.y - anchorY));
    const position = candidates.find(p => occupied.every(other => Math.abs(other.x - p.x) >= 90 || Math.abs(other.y - p.y) >= 22));
    if (!position) throw new Error("Clearance labels do not fit the image");
    const { x, y } = position;
    occupied.push({x,y}); context.beginPath(); context.moveTo((x1+x2)/2,(y1+y2)/2);context.lineTo(x,y);context.stroke();
    const label = `${g.distanceMm} mm`; const width = context.measureText(label).width;
    context.fillStyle = "#07111f";context.fillRect(x-width/2-3,y-15,width+6,18);context.fillStyle="#ffdb88";context.fillText(label,x,y);
  }
  context.restore();
  return {
    dataUrl: canvas.toDataURL("image/png"),
    height: LOADING_REPORT_IMAGE_HEIGHT,
    kind,
    labelCount: visibleLabels.length,
    title,
    width: LOADING_REPORT_IMAGE_WIDTH,
  };
}

export function captureLoadingReportImages(
  renderer: THREE.WebGLRenderer | undefined,
  projection: ProjectSceneProjection | null,
  currentCameraSnapshot: LoadingReportCurrentCameraSnapshot | undefined,
  labels: readonly LoadingReportImageLabel[],
  gaps: readonly MeasuredGap[] = [],
): LoadingReportImageCaptureResult {
  if (renderer === undefined || currentCameraSnapshot === undefined) {
    return { code: "report-image.renderer-unavailable", ok: false };
  }
  if (projection === null) {
    return { code: "report-image.projection-unavailable", ok: false };
  }
  const placedCargoIds = projection.cargoes
    .filter((cargo) => cargo.kind === "placed")
    .map((cargo) => cargo.cargoId)
    .sort();
  const labelCargoIds = labels.map((label) => label.cargoId).sort();
  if (
    placedCargoIds.length !== labelCargoIds.length ||
    placedCargoIds.some((cargoId, index) => cargoId !== labelCargoIds[index])
  ) {
    return { code: "report-image.label-mismatch", ok: false };
  }
  if (renderer.getContext().isContextLost()) {
    return { code: "report-image.renderer-unavailable", ok: false };
  }

  const previousTarget = renderer.getRenderTarget();
  const previousClearColor = renderer.getClearColor(new THREE.Color()).clone();
  const previousClearAlpha = renderer.getClearAlpha();
  const target = new THREE.WebGLRenderTarget(
    LOADING_REPORT_IMAGE_WIDTH,
    LOADING_REPORT_IMAGE_HEIGHT,
    { depthBuffer: true, stencilBuffer: false },
  );
  const resources = createReportScene(projection);
  try {
    renderer.setClearColor(0x07111f, 1);
    const images: LoadingReportImage[] = [
      renderImage(
        renderer,
        target,
        resources.scene,
        currentCamera(currentCameraSnapshot),
        projection,
        labels,
        "current",
        "現在視点",
        gaps,
      ),
    ];
    for (const definition of LOADING_REPORT_FIXED_VIEWS) {
      images.push(
        renderImage(
          renderer,
          target,
          resources.scene,
          createLoadingReportFixedCamera(definition, projection),
          projection,
          labels,
          definition.kind,
          definition.title,
          gaps,
        ),
      );
    }
    return { images, ok: true };
  } catch {
    return { code: "report-image.capture-failed", ok: false };
  } finally {
    renderer.setRenderTarget(previousTarget);
    renderer.setClearColor(previousClearColor, previousClearAlpha);
    target.dispose();
    for (const geometry of resources.geometries) geometry.dispose();
    for (const material of resources.materials) material.dispose();
  }
}
