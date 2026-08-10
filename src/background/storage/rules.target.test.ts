import { afterEach, describe, expect, it, vi } from "vitest";

import { loadRules, RULES_STORAGE_KEY } from "@/background/storage/rules";

describe("loadRules", () => {
  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it("migrates legacy SW flag to a surface override and preserves CSP flag", async () => {
    vi.stubGlobal("chrome", {
      storage: {
        local: {
          get: vi.fn().mockResolvedValue({
            [RULES_STORAGE_KEY]: [
              {
                pattern: "example.com",
                locationId: "warsaw",
                enabled: true,
                blockServiceWorkerRegistration: true,
                relaxCspForWorkers: true,
              },
            ],
          }),
        },
      },
    });

    const rules = await loadRules();
    expect(rules[0]).toEqual(
      expect.objectContaining({
        pattern: "example.com",
        locationId: "warsaw",
        enabled: true,
        relaxCspForWorkers: true,
        fingerprintSurfaceOverrides: { serviceWorker: true },
      }),
    );
    expect(rules[0]).not.toHaveProperty("blockServiceWorkerRegistration");
  });
});
