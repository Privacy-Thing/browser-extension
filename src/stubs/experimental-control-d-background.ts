export const controlDFeaturePlugins = null;

export const registerControlD =
  (_deps: { getDebugMode: () => boolean | Promise<boolean> }): (() => void) =>
  () =>
    undefined;
