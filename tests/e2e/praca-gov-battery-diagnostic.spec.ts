import { EXAMPLE_LOCATIONS } from "../../src/background/storage/locations";
import { EXTENSION_COMMAND_TYPES } from "../../src/shared/extension-contract";
import type { DomainRule, Location } from "../../src/shared/types";

import {
  exportSettings,
  importSettings,
  openPopupWithDefaults,
} from "./extension-test.helpers";
import { expect, test } from "./fixtures";

const PRACA_GOV_URL = "https://www.praca.gov.pl/eurzad/strona-glowna";

test.skip(
  process.env.PT_PRACA_GOV !== "1",
  "Set PT_PRACA_GOV=1 to run the external Praca.gov.pl diagnostic.",
);

test("diagnoses Battery protection on Praca.gov.pl", async ({
  context,
  extensionId,
}, testInfo) => {
  const optionsPage = await context.newPage();
  await optionsPage.goto(`chrome-extension://${extensionId}/src/ui/options/index.html`);
  const settings = await exportSettings<{
    version: 3;
    exportedAt: string;
    locations: Location[];
    rules: DomainRule[];
  }>(optionsPage);
  await importSettings(optionsPage, {
    ...settings,
    locations: EXAMPLE_LOCATIONS,
    rules: [
      {
        pattern: new URL(PRACA_GOV_URL).hostname,
        locationId: "spf-warsaw",
        enabled: true,
      },
    ],
  });
  await optionsPage.close();

  const page = await context.newPage();
  const response = await page.goto(PRACA_GOV_URL, { waitUntil: "domcontentloaded" });
  const popupPage = await openPopupWithDefaults(context, extensionId, page);
  const tabId = Number(new URL(popupPage.url()).searchParams.get("tabId"));
  expect(Number.isInteger(tabId)).toBe(true);
  const batteryAssessment = () =>
    popupPage.evaluate(
      async ({ commandType, tabId }) => {
        const response = (await chrome.runtime.sendMessage({
          type: commandType,
          tabId,
        })) as {
          assessments?: Array<{
            key: string;
            presentation: string;
            activity: { queryCount: number };
          }>;
        };
        return response.assessments?.find((assessment) => assessment.key === "battery");
      },
      { commandType: EXTENSION_COMMAND_TYPES.getXRayState, tabId },
    );

  await expect
    .poll(async () => (await batteryAssessment())?.presentation)
    .toBe("protected");
  const assessment = await batteryAssessment();
  await popupPage.getByRole("button", { name: "View details" }).click();
  await expect(
    popupPage.locator('[data-surface="battery"] [data-surface-state]'),
  ).toHaveAttribute("data-surface-state", "protected");

  await testInfo.attach("praca-gov-battery.json", {
    body: Buffer.from(
      JSON.stringify(
        {
          url: page.url(),
          status: response?.status() ?? null,
          battery: assessment,
        },
        null,
        2,
      ),
    ),
    contentType: "application/json",
  });
  await testInfo.attach("praca-gov-battery.png", {
    body: await popupPage.screenshot(),
    contentType: "image/png",
  });
});
