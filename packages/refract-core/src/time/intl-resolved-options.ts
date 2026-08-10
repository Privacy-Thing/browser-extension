export type ResolvedOptionsDefaults = {
  locale?: boolean;
  timeZone?: boolean;
};

export type ResolvedOptionsOverrides = {
  language: string;
  timeZone: string;
};

export type ResolvedOptionsTransform = (
  options: object,
  defaults: ResolvedOptionsDefaults | undefined,
) => object;

export type ResolvedOverridesFn = () => ResolvedOptionsOverrides | null;

/**
 * Shapes native `resolvedOptions()` output so runtime patches only inject the
 * spoofed locale/timeZone when the page omitted them. The helper keeps the
 * existing object-spread behavior used by the runtime paths, including the
 * property-order characteristics of overwriting vs appending keys.
 */
export const applyResolvedDefaults = (
  options: object,
  defaults: ResolvedOptionsDefaults | undefined,
  overrides: ResolvedOptionsOverrides,
): object => ({
  ...options,
  ...(defaults?.locale ? { locale: overrides.language } : {}),
  ...(defaults?.timeZone ? { timeZone: overrides.timeZone } : {}),
});

/**
 * Binds the spoofed locale/timeZone overrides once so constructor patchers can
 * reuse the same `resolvedOptions()` transform without repeating the snapshot
 * plumbing inline at each call site.
 */
export const createResolvedTransform =
  (overrides: ResolvedOptionsOverrides): ResolvedOptionsTransform =>
  (options, defaults) =>
    applyResolvedDefaults(options, defaults, overrides);

/**
 * Defers spoofed locale/timeZone lookup until `resolvedOptions()` runs so
 * runtimes with late-arriving state (Firefox shim) can still reuse the same
 * shared transform logic without keeping a local copy.
 */
export const createLazyResolved =
  (resolveOverrides: ResolvedOverridesFn): ResolvedOptionsTransform =>
  (options, defaults) => {
    const overrides = resolveOverrides();
    if (!overrides) {
      return options;
    }

    return applyResolvedDefaults(options, defaults, overrides);
  };

export const INTL_RESOLVED_SOURCE = `
  const applyResolvedDefaults = (options, defaults, overrides) => ({
    ...options,
    ...(defaults?.locale ? { locale: overrides.language } : {}),
    ...(defaults?.timeZone ? { timeZone: overrides.timeZone } : {})
  });
  const createResolvedTransform = (overrides) => (options, defaults) =>
    applyResolvedDefaults(options, defaults, overrides);
  const createLazyResolved = (resolveOverrides) => (options, defaults) => {
    const overrides = resolveOverrides();
    if (!overrides) {
      return options;
    }

    return applyResolvedDefaults(options, defaults, overrides);
  };
`;
