import { beforeEach, describe, expect, it, vi } from "vitest";

const { setWorkerUrl } = vi.hoisted(() => ({
  setWorkerUrl: vi.fn(),
}));

vi.mock("maplibre-gl/dist/maplibre-gl-csp.js", () => ({
  default: {
    setWorkerUrl,
  },
}));

vi.mock("maplibre-gl/dist/maplibre-gl-csp-worker.js?url", () => ({
  default: "/assets/maplibre-gl-csp-worker.js",
}));

describe("maplibre-csp", () => {
  beforeEach(() => {
    setWorkerUrl.mockClear();
    vi.resetModules();
    vi.unstubAllGlobals();
  });

  it("configures the CSP worker against the current extension page origin", async () => {
    vi.stubGlobal(
      "location",
      new URL("chrome-extension://test/src/ui/options/index.html"),
    );

    const module = await import("@/ui/options/components/map/maplibre-csp");

    expect(setWorkerUrl).toHaveBeenCalledWith(
      "chrome-extension://test/assets/maplibre-gl-csp-worker.js",
    );
    expect(module.default).toHaveProperty("setWorkerUrl", setWorkerUrl);
  });
});
