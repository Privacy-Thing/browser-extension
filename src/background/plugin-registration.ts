import { registerFeatureMessages } from "./plugin-feature-messages";
import { createPluginHooks } from "./plugin-hooks";

import {
  controlDFeaturePlugins,
  registerControlD,
} from "@/experimental/control-d/background-entry";

/** Compose installed plugins with the PT-owned lifecycle interface. */
export const registerPlugins = (deps: {
  getDebugMode: () => boolean | Promise<boolean>;
}): (() => void) => {
  const hooks = createPluginHooks();
  const stopFeatures = registerFeatureMessages(
    controlDFeaturePlugins ? controlDFeaturePlugins() : [],
  );
  const stopPlugin = registerControlD({ ...deps, hooks });
  return () => {
    stopPlugin();
    stopFeatures();
  };
};
