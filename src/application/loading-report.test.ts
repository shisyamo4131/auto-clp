import { describe, expect, it } from "vitest";

import type { Cargo, Container, Placement, Project } from "../domain/model";
import { createLoadingReportSnapshot } from "./loading-report";

function cargo(id: string, name = id): Cargo {
  return {
    id,
    name,
    dimensionsMm: { lengthMm: 200, widthMm: 100, heightMm: 50 },
    massGrams: 1_250,
    canSupportCargo: true,
    allowedOrientations: ["LWH", "WLH", "LHW", "HLW", "WHL", "HWL"],
  };
}

function container(): Container {
  return {
    id: "container-1",
    name: "匿名コンテナ",
    internalDimensionsMm: { lengthMm: 2_000, widthMm: 1_000, heightMm: 1_000 },
    openingMm: { widthMm: 1_000, heightMm: 1_000 },
    payloadCapacityGrams: 100_000,
  };
}

function placement(
  cargoId: string,
  xMm: number,
  zMm = 0,
  orientation: Placement["orientation"] = "LWH",
): Placement {
  return {
    cargoId,
    containerId: "container-1",
    positionMm: { xMm, yMm: 0, zMm },
    orientation,
  };
}

function project(cargoes: readonly Cargo[], placements: readonly Placement[]): Project {
  return {
    schemaVersion: "0.1.0",
    projectId: "anonymous-report",
    name: "匿名帳票CLP",
    clearancesMm: { xMm: 0, yMm: 0, zMm: 0 },
    cargoes,
    containers: [container()],
    placements,
  };
}

describe("createLoadingReportSnapshot", () => {
  it("captures ordered report values, current orientation, dependencies, and validation", () => {
    const snapshot = createLoadingReportSnapshot(
      project(
        [cargo("front", "手前"), cargo("back", "奥")],
        [placement("front", 0, 0, "WLH"), placement("back", 300)],
      ),
      "container-1",
    );

    expect(snapshot.status).toBe("available");
    if (snapshot.status !== "available") return;
    expect(snapshot.projectName).toBe("匿名帳票CLP");
    expect(snapshot.containerName).toBe("匿名コンテナ");
    expect(snapshot.cargoes.map((item) => item.cargoId)).toEqual(["back", "front"]);
    expect(snapshot.cargoes[1]).toMatchObject({
      cargoId: "front",
      massGrams: 1_250,
      name: "手前",
      orientedDimensionsMm: { xMm: 100, yMm: 200, zMm: 50 },
      sequenceNumber: 2,
    });
    expect(snapshot.cargoes[1]?.dependencies).toEqual([
      { cargoId: "back", reasons: ["access"] },
    ]);
    expect(snapshot.physicalValidation.kind).toBe("evaluated");
  });

  it("keeps the explicit empty and unavailable states without inventing rows", () => {
    expect(
      createLoadingReportSnapshot(project([], []), "container-1"),
    ).toMatchObject({ status: "empty", containerId: "container-1" });

    const unavailable = createLoadingReportSnapshot(
      project(
        [cargo("cargo-a"), cargo("cargo-b")],
        [placement("cargo-a", 0), placement("cargo-b", 100)],
      ),
      "container-1",
    );
    expect(unavailable).toMatchObject({
      status: "unavailable",
      reason: {
        code: "loading-sequence.positive-volume-overlap",
        relatedCargoIds: ["cargo-a", "cargo-b"],
      },
    });
    expect("cargoes" in unavailable).toBe(false);
  });

  it("does not add report data to Project", () => {
    const source = project([cargo("cargo-a")], [placement("cargo-a", 0)]);
    const before = JSON.stringify(source);
    createLoadingReportSnapshot(source, "container-1");
    expect(JSON.stringify(source)).toBe(before);
    expect(Object.keys(source)).toEqual([
      "schemaVersion",
      "projectId",
      "name",
      "clearancesMm",
      "cargoes",
      "containers",
      "placements",
    ]);
  });
});
