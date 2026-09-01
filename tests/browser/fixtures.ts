import { expect, test as base } from "@playwright/test";

const usageRequirementsStorageKey = "auto-clp.usage-requirements-version";
const usageRequirementsVersion = "1.1.0";

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
