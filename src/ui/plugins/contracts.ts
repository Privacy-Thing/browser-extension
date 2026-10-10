import type { ComponentType } from "react";

/** Settings subpage a plugin may own. */
export type PluginUiRoute = "experimentalIntegration";

export type PluginToggleProps = {
  onEnabledChange: (enabled: boolean) => void;
};

/** Universal settings contribution. Plugin code owns the React components. */
export type PluginUiContribution = {
  id: string;
  name: string;
  route: PluginUiRoute;
  supported: () => boolean;
  Toggle: ComponentType<PluginToggleProps>;
  Subpage: ComponentType;
};
