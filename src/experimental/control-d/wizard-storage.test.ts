import { expect, it, vi } from "vitest";

import { loadControlDConfig, saveControlDConfig } from "./storage";

it("preserves adoption review and route consent through a storage round trip", async () => {
  const values: Record<string, unknown> = {};
  vi.stubGlobal("chrome", {
    storage: {
      local: {
        get: async (key: string) => ({ [key]: values[key] }),
        set: async (next: Record<string, unknown>) => Object.assign(values, next),
      },
    },
  });
  const config = await loadControlDConfig();
  config.adoptionKind = "foreign";
  config.locationMappings.sydney = {
    locationId: "sydney",
    proxyPk: "WAW",
    status: "approximate",
    confirmed: true,
    routeFingerprint: '["WAW","Warsaw","PL","Poland"]',
  };
  await saveControlDConfig(config);
  expect(await loadControlDConfig()).toEqual(config);
  vi.unstubAllGlobals();
});
