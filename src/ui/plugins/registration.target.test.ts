import { describe, expect, it, vi } from "vitest";

import { pluginUiContributions, pluginUiForRoute } from "./registration";

const gate = vi.hoisted(() => ({ supported: false }));

vi.mock("@/experimental/control-d/ui-entry", () => ({
  controlDFeatureUi: null,
  controlDPluginUi: {
    id: "control-d",
    name: "Control D",
    route: "experimentalIntegration",
    supported: () => gate.supported,
    Toggle: () => null,
    Subpage: () => null,
  },
}));

describe("plugin UI registration", () => {
  it("hides the integration when the build excludes it", () => {
    gate.supported = false;
    expect(pluginUiContributions()).toEqual([]);
    expect(pluginUiForRoute("experimentalIntegration")).toBeUndefined();
  });

  it("exposes the generic integration when the build includes it", () => {
    gate.supported = true;
    const integration = pluginUiForRoute("experimentalIntegration");
    expect(integration?.id).toBe("control-d");
    expect(integration?.name).toBe("Control D");
    expect(integration?.route).toBe("experimentalIntegration");
    expect(typeof integration?.Toggle).toBe("function");
    expect(typeof integration?.Subpage).toBe("function");
    expect(pluginUiContributions()).toEqual(integration ? [integration] : []);
  });
});
