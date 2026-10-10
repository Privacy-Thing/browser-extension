import type { PluginUiContribution, PluginUiRoute } from "./contracts";

export type PluginRegistry = {
  register: (contribution: PluginUiContribution) => void;
  contributions: () => readonly PluginUiContribution[];
  forRoute: (route: PluginUiRoute) => PluginUiContribution | undefined;
};

export const createPluginRegistry = (): PluginRegistry => {
  const items: PluginUiContribution[] = [];
  const supported = () => items.filter((item) => item.supported());
  return {
    register(contribution) {
      if (items.some((item) => item.id === contribution.id)) return;
      items.push(contribution);
    },
    contributions: supported,
    forRoute: (route) => supported().find((item) => item.route === route),
  };
};

export const pluginUiRegistry = createPluginRegistry();
