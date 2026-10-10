import { describe, expect, it } from "vitest";

import type { PluginUiContribution } from "./contracts";
import { createPluginRegistry } from "./registry";

const Toggle = () => null;
const Subpage = () => null;

const contribution = (
  overrides: Partial<PluginUiContribution> = {},
): PluginUiContribution => ({
  id: "control-d",
  name: "Control D",
  route: "experimentalIntegration",
  supported: () => false,
  Toggle,
  Subpage,
  ...overrides,
});

describe("plugin UI registry", () => {
  it("omits a plugin the build does not support", () => {
    const registry = createPluginRegistry();
    registry.register(contribution());
    expect(registry.contributions()).toEqual([]);
    expect(registry.forRoute("experimentalIntegration")).toBeUndefined();
  });

  it("returns a supported route and toggle", () => {
    const registry = createPluginRegistry();
    const installed = contribution({ supported: () => true });
    registry.register(installed);
    expect(registry.contributions()).toEqual([installed]);
    expect(registry.forRoute("experimentalIntegration")).toBe(installed);
  });

  it("keeps one contribution per plugin id", () => {
    const registry = createPluginRegistry();
    const first = contribution({ supported: () => true });
    registry.register(first);
    registry.register(contribution({ supported: () => true, name: "Other" }));
    expect(registry.contributions()).toEqual([first]);
  });
});
