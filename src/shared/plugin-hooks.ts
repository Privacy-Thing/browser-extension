export type PluginConfigurationScope =
  | "rules"
  | "locations"
  | "featureBindings"
  | "preferences"
  | "containers"
  | "trustedSites";

/** PT exposes changed scopes, never raw storage values or plugin credentials. */
export type PluginHooks = {
  onConfigurationChanged: (
    scopes: readonly PluginConfigurationScope[],
    listener: (changed: readonly PluginConfigurationScope[]) => void | Promise<void>,
  ) => () => void;
};
