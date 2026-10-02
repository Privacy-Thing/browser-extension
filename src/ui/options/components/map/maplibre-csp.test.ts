import { beforeEach, describe, expect, it, vi } from "vitest";

const { setWorkerUrl } = vi.hoisted(() => ({
  setWorkerUrl: vi.fn(),
}));

vi.mock("maplibre-gl", () => ({
  setWorkerUrl,
}));

vi.mock("maplibre-gl/dist/maplibre-gl-worker.mjs?worker&url", () => ({
  default: "/assets/maplibre-gl-worker.js",
}));

describe("maplibre-csp", () => {
  beforeEach(() => {
    setWorkerUrl.mockClear();
    vi.resetModules();
    vi.unstubAllGlobals();
  });

  it.each(["chrome-extension://test", "moz-extension://test"])(
    "configures the bundled worker against the %s page origin",
    async (origin) => {
      vi.stubGlobal("location", new URL(`${origin}/src/ui/options/index.html`));

      const module = await import("@/ui/options/components/map/maplibre-csp");

      expect(setWorkerUrl).toHaveBeenCalledWith(
        `${origin}/assets/maplibre-gl-worker.js`,
      );
      expect(module.default).toHaveProperty("setWorkerUrl", setWorkerUrl);
    },
  );
});
