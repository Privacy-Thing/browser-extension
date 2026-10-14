import type { PluginUiRoute } from "./contracts";
import { pluginUiRegistry } from "./registry";
import "./feature-registration";

import { controlDPluginUi } from "@/experimental/control-d/ui-entry";

/** Compose installed plugin settings UI with the PT-owned contribution interface. */
if (controlDPluginUi) pluginUiRegistry.register(controlDPluginUi);

export const pluginUiContributions = () => pluginUiRegistry.contributions();

export const pluginUiForRoute = (route: PluginUiRoute) =>
  pluginUiRegistry.forRoute(route);
