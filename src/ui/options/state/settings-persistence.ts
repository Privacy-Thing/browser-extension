export type AutosaveScope = "simple-settings" | "location-model";

export type PendingAutosaveScopes = Record<AutosaveScope, boolean>;

export const hasPendingAutosaveScopes = (
  pendingAutosaveScopes: PendingAutosaveScopes,
): boolean =>
  pendingAutosaveScopes["simple-settings"] || pendingAutosaveScopes["location-model"];

export const collectAutosaveScopes = (
  pendingAutosaveScopes: PendingAutosaveScopes,
  requestedScopes: readonly AutosaveScope[],
): AutosaveScope[] => {
  const nextScopes = new Set<AutosaveScope>(requestedScopes);

  if (pendingAutosaveScopes["simple-settings"]) {
    nextScopes.add("simple-settings");
  }

  if (pendingAutosaveScopes["location-model"]) {
    nextScopes.add("location-model");
  }

  const orderedScopes: AutosaveScope[] = [];
  if (nextScopes.has("simple-settings")) {
    orderedScopes.push("simple-settings");
  }

  if (nextScopes.has("location-model")) {
    orderedScopes.push("location-model");
  }

  return orderedScopes;
};

export const clearAutosaveScopes = (
  pendingAutosaveScopes: PendingAutosaveScopes,
  ...scopes: AutosaveScope[]
): void => {
  for (const scope of scopes) {
    pendingAutosaveScopes[scope] = false;
  }
};
