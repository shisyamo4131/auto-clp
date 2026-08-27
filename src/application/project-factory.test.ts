import { describe, expect, it } from "vitest";

import { validateProjectReferences } from "../domain/validation";
import { validateProjectJsonSchema } from "../persistence/project-json-schema";
import {
  createInitialProject,
  nextAvailableEntityId,
  nextCargoId,
  nextContainerId,
} from "./project-factory";

describe("project factory", () => {
  it("creates a valid empty canonical project", () => {
    const project = createInitialProject();

    expect(project).toEqual({
      schemaVersion: "0.1.0",
      projectId: "project-1",
      name: "新規案件",
      clearancesMm: { xMm: 0, yMm: 0, zMm: 0 },
      cargoes: [],
      containers: [],
      placements: [],
    });
    expect(validateProjectJsonSchema(project).valid).toBe(true);
    expect(validateProjectReferences(project)).toEqual([]);
  });

  it("chooses deterministic collision-free entity IDs", () => {
    expect(nextAvailableEntityId("cargo", ["cargo-1", "cargo-3"])).toBe("cargo-2");
    expect(nextAvailableEntityId("container", ["container-2", "container-1"])).toBe(
      "container-3",
    );

    const project = {
      ...createInitialProject(),
      cargoes: [
        {
          id: "cargo-1",
          name: "合成積荷A",
          dimensionsMm: { lengthMm: 1, widthMm: 1, heightMm: 1 },
          massGrams: 1,
          canSupportCargo: false,
          allowedOrientations: ["LWH" as const],
        },
      ],
      containers: [
        {
          id: "container-1",
          name: "合成候補A",
          internalDimensionsMm: { lengthMm: 1, widthMm: 1, heightMm: 1 },
          openingMm: { widthMm: 1, heightMm: 1 },
          payloadCapacityGrams: 1,
        },
      ],
    };
    expect(nextCargoId(project)).toBe("cargo-2");
    expect(nextContainerId(project)).toBe("container-2");
  });

  it("scans consecutive collisions without treating lookalike IDs as collisions", () => {
    expect(
      nextAvailableEntityId("cargo", [
        "cargo-1",
        "cargo-2",
        "cargo-4",
        "cargo-01",
        "Cargo-3",
      ]),
    ).toBe("cargo-3");
    expect(nextAvailableEntityId("container", ["container-1", "container-2"])).toBe(
      "container-3",
    );
  });
});
