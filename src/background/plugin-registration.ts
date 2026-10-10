import { createPluginHooks } from "./plugin-hooks";

import { registerControlD } from "@/experimental/control-d/background-entry";

/** Compose installed plugins with the PT-owned lifecycle interface. */
export const registerPlugins = (deps: {
  getDebugMode: () => boolean | Promise<boolean>;
}): (() => void) => {
  const hooks = createPluginHooks();
  return registerControlD({ ...deps, hooks });
};
