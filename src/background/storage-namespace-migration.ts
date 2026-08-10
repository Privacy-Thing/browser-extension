import { EXTENSION_STORAGE_KEYS } from "@/shared/extension-contract";

const joinNamespace = (secondPart: "warp" | "wrap"): string =>
  ["geo", secondPart].join("");

const RETIRED_NAMESPACES = [joinNamespace("warp"), joinNamespace("wrap")] as const;

const dotKey = (namespace: string, suffix: string): string => `${namespace}.${suffix}`;
const snakeKey = (namespace: string, suffix: string): string =>
  `${namespace}_${suffix}`;
const sessionKey = (namespace: string, suffix: string): string =>
  `${namespace}:${suffix}`;

type StorageKeyMigration = {
  target: string;
  sourceSuffixes: readonly string[];
  separator: "dot" | "snake";
};

const STORAGE_KEY_MIGRATIONS: readonly StorageKeyMigration[] = [
  {
    target: EXTENSION_STORAGE_KEYS.locations,
    sourceSuffixes: ["locations", "profiles"],
    separator: "dot",
  },
  {
    target: EXTENSION_STORAGE_KEYS.rules,
    sourceSuffixes: ["rules"],
    separator: "dot",
  },
  {
    target: EXTENSION_STORAGE_KEYS.trustedSites,
    sourceSuffixes: ["trustedSites"],
    separator: "dot",
  },
  {
    target: EXTENSION_STORAGE_KEYS.controlState,
    sourceSuffixes: ["control-state"],
    separator: "dot",
  },
  {
    target: EXTENSION_STORAGE_KEYS.migrationNotice,
    sourceSuffixes: ["migrationNotice"],
    separator: "dot",
  },
  {
    target: EXTENSION_STORAGE_KEYS.siteSuggestions,
    sourceSuffixes: ["siteSuggestions"],
    separator: "dot",
  },
  {
    target: EXTENSION_STORAGE_KEYS.popupNotifications,
    sourceSuffixes: ["popupNotifications"],
    separator: "dot",
  },
  {
    target: EXTENSION_STORAGE_KEYS.preferences,
    sourceSuffixes: ["preferences"],
    separator: "dot",
  },
  {
    target: EXTENSION_STORAGE_KEYS.defaultNoiseRadius,
    sourceSuffixes: ["defaultNoiseRadius"],
    separator: "dot",
  },
  {
    target: EXTENSION_STORAGE_KEYS.watchPositionDelayMin,
    sourceSuffixes: ["watchPositionDelay.min"],
    separator: "dot",
  },
  {
    target: EXTENSION_STORAGE_KEYS.watchPositionDelayMax,
    sourceSuffixes: ["watchPositionDelay.max"],
    separator: "dot",
  },
  {
    target: EXTENSION_STORAGE_KEYS.theme,
    sourceSuffixes: ["theme"],
    separator: "dot",
  },
  {
    target: EXTENSION_STORAGE_KEYS.surfaceProtectionsDefaultReset,
    sourceSuffixes: ["surfaceProtectionsDefaultReset"],
    separator: "dot",
  },
  {
    target: EXTENSION_STORAGE_KEYS.seenHosts,
    sourceSuffixes: ["seen_hosts"],
    separator: "snake",
  },
  {
    target: EXTENSION_STORAGE_KEYS.containerAssignments,
    sourceSuffixes: ["container_assignments"],
    separator: "snake",
  },
] as const;

const sourceKeysFor = ({ sourceSuffixes, separator }: StorageKeyMigration): string[] =>
  RETIRED_NAMESPACES.flatMap((namespace) =>
    sourceSuffixes.map((suffix) =>
      separator === "dot" ? dotKey(namespace, suffix) : snakeKey(namespace, suffix),
    ),
  );

const RETIRED_LOCAL_KEYS = [
  ...STORAGE_KEY_MIGRATIONS.flatMap(sourceKeysFor),
  "developerMode",
  "errorReportingEnabled",
  ...RETIRED_NAMESPACES.flatMap((namespace) => [
    dotKey(namespace, "errorReports"),
    dotKey(namespace, "sentryDsn"),
  ]),
] as const;

const RETIRED_SESSION_KEYS = RETIRED_NAMESPACES.flatMap((namespace) => [
  sessionKey(namespace, "preloaded-runtime-state"),
  sessionKey(namespace, "qa-access-state"),
]);

const firstStoredValue = (
  stored: Record<string, unknown>,
  keys: readonly string[],
): unknown => {
  for (const key of keys) {
    if (Object.hasOwn(stored, key)) return stored[key];
  }
  return undefined;
};

/**
 * Imports persisted data into the current namespace before any storage loader
 * runs. Source keys are removed only after every required write succeeds, so a
 * failed attempt remains retryable and a second successful run is a no-op.
 */
export const migrateRetiredNamespace = async (): Promise<boolean> => {
  const currentKeys = STORAGE_KEY_MIGRATIONS.map(({ target }) => target);
  const stored = await chrome.storage.local.get([
    ...currentKeys,
    ...RETIRED_LOCAL_KEYS,
  ]);
  const session = await chrome.storage.session.get(RETIRED_SESSION_KEYS);
  const writes: Record<string, unknown> = {};

  for (const migration of STORAGE_KEY_MIGRATIONS) {
    if (Object.hasOwn(stored, migration.target)) continue;

    const sourceValue = firstStoredValue(stored, sourceKeysFor(migration));
    if (sourceValue !== undefined) writes[migration.target] = sourceValue;
  }

  const localKeysToRemove = RETIRED_LOCAL_KEYS.filter((key) =>
    Object.hasOwn(stored, key),
  );
  const sessionKeysToRemove = RETIRED_SESSION_KEYS.filter((key) =>
    Object.hasOwn(session, key),
  );

  if (Object.keys(writes).length > 0) {
    await chrome.storage.local.set(writes);
  }
  if (localKeysToRemove.length > 0) {
    await chrome.storage.local.remove(localKeysToRemove);
  }
  if (sessionKeysToRemove.length > 0) {
    await chrome.storage.session.remove(sessionKeysToRemove);
  }

  return (
    Object.keys(writes).length > 0 ||
    localKeysToRemove.length > 0 ||
    sessionKeysToRemove.length > 0
  );
};
