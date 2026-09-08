import { expect, test as base } from "@playwright/test";

const usageRequirementsStorageKey = "auto-clp.usage-requirements-version";
const usageRequirementsVersion = "1.2.0";

/**
 * Product-flow tests start from an already-confirmed app preference. Dedicated
 * usage-requirements tests explicitly clear or fault this preference.
 */
export const test = base.extend({
  page: async ({ page }, provide) => {
    await page.addInitScript(
      ({ key, version }) => globalThis.localStorage.setItem(key, version),
      { key: usageRequirementsStorageKey, version: usageRequirementsVersion },
    );
    await provide(page);
  },
});

export { expect };
export type { Download, Locator, Page } from "@playwright/test";
export { usageRequirementsStorageKey, usageRequirementsVersion };

export function weightBalanceProject() {
  return {
    schemaVersion: "0.1.0",
    projectId: "weight-balance-browser",
    name: "匿名重心確認CLP",
    clearancesMm: { xMm: 0, yMm: 0, zMm: 0 },
    cargoes: ["a", "b"].map((suffix) => ({
      id: `cargo-${suffix}`,
      name: `重心確認荷${suffix.toUpperCase()}`,
      dimensionsMm: { lengthMm: 1_000, widthMm: 1_000, heightMm: 1_000 },
      massGrams: 1_000_000,
      canSupportCargo: false,
      allowedOrientations: ["LWH", "WLH"],
    })),
    containers: [
      {
        id: "container-balanced",
        name: "重心確認コンテナ",
        internalDimensionsMm: { lengthMm: 4_000, widthMm: 2_000, heightMm: 2_000 },
        openingMm: { widthMm: 2_000, heightMm: 2_000 },
        payloadCapacityGrams: 3_000_000,
      },
      {
        id: "container-empty",
        name: "空コンテナ",
        internalDimensionsMm: { lengthMm: 2_000, widthMm: 1_500, heightMm: 1_500 },
        openingMm: { widthMm: 1_500, heightMm: 1_500 },
        payloadCapacityGrams: 3_000_000,
      },
    ],
    placements: [
      {
        cargoId: "cargo-a",
        containerId: "container-balanced",
        positionMm: { xMm: 0, yMm: 500, zMm: 0 },
        orientation: "LWH",
      },
      {
        cargoId: "cargo-b",
        containerId: "container-balanced",
        positionMm: { xMm: 3_000, yMm: 500, zMm: 1_000 },
        orientation: "LWH",
      },
    ],
  };
}
