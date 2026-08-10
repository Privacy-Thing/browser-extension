import type { BrowserContext, Page } from "@playwright/test";

import { EXAMPLE_LOCATIONS } from "../../src/background/storage/locations";
import { DEFAULT_RULES } from "../../src/background/storage/rules";

import {
  exportSettings,
  importSettings,
  openSettingsTab,
  readSettings,
  saveLocationModel,
} from "./extension-test.helpers";
import { expect, test } from "./fixtures";

type LookupStubGlobal = typeof globalThis & {
  __e2eOriginalFetch?: typeof fetch;
};

const installLookupStub = async (
  context: BrowserContext,
): Promise<() => Promise<void>> => {
  const worker =
    context.serviceWorkers()[0] ?? (await context.waitForEvent("serviceworker"));

  await worker.evaluate(() => {
    const stubGlobal = globalThis as LookupStubGlobal;
    const originalFetch =
      stubGlobal.__e2eOriginalFetch ?? globalThis.fetch.bind(globalThis);
    stubGlobal.__e2eOriginalFetch = originalFetch;
    globalThis.fetch = async (input, init) => {
      if (String(input).startsWith("https://nominatim.openstreetmap.org/search")) {
        return new Response(
          JSON.stringify([
            {
              lat: "48.8566",
              lon: "2.3522",
              display_name: "Paris, Ile-de-France, France",
              addresstype: "city",
              address: {
                city: "Paris",
                country: "France",
                country_code: "fr",
              },
            },
          ]),
          {
            status: 200,
            headers: { "content-type": "application/json" },
          },
        );
      }

      return originalFetch(input, init);
    };
  });

  return async () => {
    await worker
      .evaluate(() => {
        const stubGlobal = globalThis as LookupStubGlobal;
        if (stubGlobal.__e2eOriginalFetch) {
          globalThis.fetch = stubGlobal.__e2eOriginalFetch;
          delete stubGlobal.__e2eOriginalFetch;
        }
      })
      .catch(() => undefined);
  };
};

const resolveCandidate = async (page: Page): Promise<void> => {
  const resultStep = page.locator("#profile-generator-result-step");
  const languageStep = page.locator("#profile-generator-language-step");
  const confirmStep = page.locator("#profile-generator-confirm-step");

  await expect
    .poll(
      async () =>
        (await resultStep.isVisible()) ||
        (await languageStep.isVisible()) ||
        (await confirmStep.isVisible()),
    )
    .toBe(true);

  if (await resultStep.isVisible()) {
    await page
      .locator("#profile-generator-result-select")
      .getByRole("option")
      .first()
      .click();
    await page.locator("#continue-profile-generator-result").click();
  }

  if (await languageStep.isVisible()) {
    await page
      .locator("#profile-generator-language-select")
      .getByRole("option")
      .first()
      .click();
    await page.locator("#continue-profile-generator-language").click();
  }
};

const readLocationLabels = async (page: Page): Promise<string[]> => {
  const exported = await exportSettings<{
    locations: Array<{ label: string }>;
  }>(page);
  return exported.locations.map((location) => location.label);
};

test("reset restores the default locations and rules", async ({
  context,
  extensionId,
}) => {
  const page = await context.newPage();
  await page.goto(`chrome-extension://${extensionId}/src/ui/options/index.html`);
  await saveLocationModel(page, {
    locations: [EXAMPLE_LOCATIONS[0]!],
    rules: [{ pattern: "custom.example.com", locationId: EXAMPLE_LOCATIONS[0]!.id }],
    containerAssignments: [],
  });

  await openSettingsTab(page, "advanced");
  await page.locator("#reset-settings").click();
  await page.locator("#reset-run-onboarding").click();
  await page.locator("#confirm-dialog-confirm").click();

  await expect
    .poll(async () => {
      const settings = await readSettings(page);
      return { locations: settings.locations, rules: settings.rules };
    })
    .toEqual({ locations: [], rules: DEFAULT_RULES });
});

test("generates a location through the modal flow", async ({
  context,
  extensionId,
}) => {
  const restoreLookup = await installLookupStub(context);
  const page = await context.newPage();

  try {
    await page.goto(`chrome-extension://${extensionId}/src/ui/options/index.html`);
    await importSettings(page, {
      version: 2,
      exportedAt: new Date().toISOString(),
      locations: EXAMPLE_LOCATIONS,
      rules: [],
      osmConsent: "granted",
    });
    await page.reload();

    await openSettingsTab(page, "profiles");
    await page.locator("#open-profile-generator").click();
    await page.locator("#profile-draft-query").fill("Paris, France");
    await page.locator("#run-profile-generator").click();
    await resolveCandidate(page);
    await expect(page.locator("#profile-generator-confirm-step")).toBeVisible();
    await page.locator("#save-profile-generator").click();

    await expect.poll(() => readLocationLabels(page)).toContain("Paris, France");
  } finally {
    await restoreLookup();
  }
});

test("adds a location manually from the actions menu", async ({
  context,
  extensionId,
}) => {
  const label = "Manual E2E location";
  const page = await context.newPage();
  await page.goto(`chrome-extension://${extensionId}/src/ui/options/index.html`);

  await openSettingsTab(page, "profiles");
  await page.locator("#open-profile-actions-menu").click();
  await page.locator("#add-profile-manually").click();
  await expect(page.locator("#profile-dialog")).toBeVisible();
  await page.locator("#profile-dialog input").first().fill(label);
  await page.locator("#profile-dialog").getByRole("button").last().click();

  await expect.poll(() => readLocationLabels(page)).toContain(label);
});
