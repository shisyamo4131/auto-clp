import { describe, expect, it } from "vitest";
import * as THREE from "three";

import type { ProjectSceneProjection } from "./project-scene";
import {
  createLoadingReportFixedCamera,
  LOADING_REPORT_FIXED_VIEWS,
} from "./loading-report-images";

function projection(): ProjectSceneProjection {
  return {
    container: {
      id: "container-1",
      name: "匿名コンテナ",
      center: { x: 3, y: 1.3, z: -1.2 },
      dimensions: { x: 6, y: 2.6, z: 2.4 },
      opening: { center: { x: 0, y: 1.25, z: -1.2 }, width: 2.4, height: 2.5 },
    },
    cargoes: [
      {
        kind: "placed",
        cargoId: "cargo-1",
        name: "配置積荷",
        center: { x: 5.25, y: 0.5, z: -1.8 },
        dimensions: { x: 1.5, y: 1, z: 0.8 },
        dimensionsMm: { xMm: 1_500, yMm: 800, zMm: 1_000 },
        orientation: "LWH",
        positionMm: { xMm: 4_500, yMm: 1_400, zMm: 0 },
      },
      {
        kind: "staged",
        cargoId: "cargo-staged",
        name: "荷室外積荷",
        center: { x: -10, y: 0.5, z: 0 },
        dimensions: { x: 1, y: 1, z: 1 },
        dimensionsMm: { xMm: 1_000, yMm: 1_000, zMm: 1_000 },
        orientation: "LWH",
        positionMm: { xMm: -10_500, yMm: -500, zMm: 0 },
      },
    ],
    weightBalance: { kind: "empty", containerCenter: { x: 3, y: 1.3, z: -1.2 } },
  };
}

function containerCorners(source: ProjectSceneProjection): readonly THREE.Vector3[] {
  const center = new THREE.Vector3(
    source.container.center.x,
    source.container.center.y,
    source.container.center.z,
  );
  const half = new THREE.Vector3(
    source.container.dimensions.x / 2,
    source.container.dimensions.y / 2,
    source.container.dimensions.z / 2,
  );
  const corners: THREE.Vector3[] = [];
  for (const x of [-1, 1]) {
    for (const y of [-1, 1]) {
      for (const z of [-1, 1]) {
        corners.push(
          center.clone().add(new THREE.Vector3(half.x * x, half.y * y, half.z * z)),
        );
      }
    }
  }
  return corners;
}

describe("loading report fixed views", () => {
  it("defines front, rear, left, and right from the approved user-relative directions", () => {
    expect(LOADING_REPORT_FIXED_VIEWS).toEqual([
      expect.objectContaining({ kind: "front", direction: [-1, 0, 0] }),
      expect.objectContaining({ kind: "rear", direction: [1, 0, 0] }),
      expect.objectContaining({ kind: "left", direction: [0, 0, -1] }),
      expect.objectContaining({ kind: "right", direction: [0, 0, 1] }),
    ]);
  });

  it("frames the container in every orthographic view without including staged cargo", () => {
    const source = projection();
    for (const definition of LOADING_REPORT_FIXED_VIEWS) {
      const camera = createLoadingReportFixedCamera(definition, source);
      for (const corner of containerCorners(source)) {
        const ndc = corner.clone().project(camera);
        expect(Math.abs(ndc.x)).toBeLessThanOrEqual(1);
        expect(Math.abs(ndc.y)).toBeLessThanOrEqual(1);
        expect(ndc.z).toBeGreaterThanOrEqual(-1);
        expect(ndc.z).toBeLessThanOrEqual(1);
      }
      expect(camera.position.length()).toBeLessThan(20);
    }
  });

  it("keeps the user's left side on the image left in the front view", () => {
    const source = projection();
    const front = createLoadingReportFixedCamera(
      LOADING_REPORT_FIXED_VIEWS.find((view) => view.kind === "front")!,
      source,
    );
    const userLeft = new THREE.Vector3(3, 1.3, -2).project(front);
    const userRight = new THREE.Vector3(3, 1.3, -0.4).project(front);
    expect(userLeft.x).toBeLessThan(userRight.x);
  });
});
