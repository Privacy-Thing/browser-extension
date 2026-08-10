import { EXTENSION_COMMAND_TYPES } from "@/shared/extension-contract";
import type {
  ContainerAssignment,
  DomainRule,
  ExportedSettings,
  ExportSettingsResponse,
  ExtensionCommand,
  GetSettingsResponse,
  GlobalFallbackRule,
  ImportSettingsResponse,
  Location as LocationProfile,
  ResetSettingsResponse,
  SaveLocationResponse,
  SaveSettingsResponse,
  SharedSpoofingConfig,
  TrustedSite,
} from "@/shared/types";
import { sendMessageOrThrow } from "@/ui/shared/runtime-messaging";

type SaveSettingsCommand = Extract<
  ExtensionCommand,
  { type: typeof EXTENSION_COMMAND_TYPES.saveSimpleSettings }
>;

export type BooleanSettingKey =
  | "debugMode"
  | "browserFingerprintSpoofingEnabled"
  | "sharedWorkerCompatibilityMode"
  | "highContrastMode"
  | "randomizeGeneratedLocationByDefault"
  | "showBadgeQueryCount"
  | "includeDateCallsInBadgeCount";

export type SettingsCollection =
  "locations" | "rules" | "trustedSites" | "containerAssignments";

export type NullableSetting = "sharedSpoofing" | "globalFallbackRule";

export type InternalSettingsPatch = Omit<SaveSettingsCommand, "type">;

export type CollectionItemMap = {
  locations: LocationProfile;
  rules: DomainRule;
  trustedSites: TrustedSite;
  containerAssignments: ContainerAssignment;
};

export type NullableSettingMap = {
  sharedSpoofing: SharedSpoofingConfig;
  globalFallbackRule: GlobalFallbackRule;
};

export interface SettingsAPI {
  version: 1;
  get(): Promise<GetSettingsResponse>;
  export(): Promise<ExportedSettings>;
  import(settings: ExportedSettings): Promise<ImportSettingsResponse>;
  reset(options?: { onboardingCompleted?: boolean }): Promise<ResetSettingsResponse>;
  booleans: {
    get(key: BooleanSettingKey): Promise<boolean>;
    set(key: BooleanSettingKey, value: boolean): Promise<SaveSettingsResponse>;
    toggle(key: BooleanSettingKey): Promise<SaveSettingsResponse>;
  };
  preferences: {
    patch(patch: InternalSettingsPatch): Promise<SaveSettingsResponse>;
  };
  collections: {
    list<T extends SettingsCollection>(
      collection: T,
    ): Promise<Array<CollectionItemMap[T]>>;
    replace<T extends SettingsCollection>(
      collection: T,
      items: Array<CollectionItemMap[T]>,
    ): Promise<SaveLocationResponse | SaveSettingsResponse>;
    create<T extends SettingsCollection>(
      collection: T,
      item: CollectionItemMap[T],
    ): Promise<CollectionItemMap[T]>;
    update<T extends SettingsCollection>(
      collection: T,
      id: string,
      patch: Partial<CollectionItemMap[T]>,
    ): Promise<CollectionItemMap[T]>;
    delete<T extends SettingsCollection>(collection: T, id: string): Promise<void>;
  };
  nullable: {
    get<T extends NullableSetting>(key: T): Promise<NullableSettingMap[T] | undefined>;
    set<T extends NullableSetting>(
      key: T,
      value: NullableSettingMap[T] | undefined,
    ): Promise<SaveSettingsResponse>;
    clear<T extends NullableSetting>(key: T): Promise<SaveSettingsResponse>;
  };
}

type SettingsAPIGlobal = {
  SettingsAPI?: SettingsAPI;
  location?: Pick<globalThis.Location, "protocol">;
};

declare global {
  interface Window {
    SettingsAPI?: SettingsAPI;
  }
}

const responseFailed = (response: unknown): response is { ok: false; error: string } =>
  Boolean(
    response &&
    typeof response === "object" &&
    (response as { ok?: unknown }).ok === false &&
    typeof (response as { error?: unknown }).error === "string",
  );

const assertOk = <TResponse>(response: TResponse): TResponse => {
  if (responseFailed(response)) {
    throw new Error(response.error);
  }

  return response;
};

const sendCommand = async <TResponse>(command: ExtensionCommand): Promise<TResponse> =>
  sendMessageOrThrow<TResponse>(command);

const normalizePatternId = (pattern: string): string => pattern.trim().toLowerCase();

const getCollectionItemId = <T extends SettingsCollection>(
  collection: T,
  item: CollectionItemMap[T],
): string => {
  switch (collection) {
    case "locations":
      return (item as LocationProfile).id;
    case "rules":
      return normalizePatternId((item as DomainRule).pattern);
    case "trustedSites":
      return normalizePatternId((item as TrustedSite).pattern);
    case "containerAssignments":
      return (item as ContainerAssignment).cookieStoreId;
  }
};

const assertUniqueIds = <T extends SettingsCollection>(
  collection: T,
  items: Array<CollectionItemMap[T]>,
): void => {
  const seen = new Set<string>();

  for (const item of items) {
    const id = getCollectionItemId(collection, item);
    if (seen.has(id)) {
      throw new Error(`Duplicate ${collection} id: ${id}`);
    }
    seen.add(id);
  }
};

const listFromSettings = <T extends SettingsCollection>(
  settings: GetSettingsResponse,
  collection: T,
): Array<CollectionItemMap[T]> => {
  switch (collection) {
    case "locations":
      return [...settings.locations] as Array<CollectionItemMap[T]>;
    case "rules":
      return [...settings.rules] as Array<CollectionItemMap[T]>;
    case "trustedSites":
      return [...settings.trustedSites] as Array<CollectionItemMap[T]>;
    case "containerAssignments":
      return [...(settings.containerAssignments ?? [])] as Array<CollectionItemMap[T]>;
  }
};

const findCollectionItem = <T extends SettingsCollection>(
  settings: GetSettingsResponse,
  collection: T,
  id: string,
): CollectionItemMap[T] | undefined => {
  const normalizedId =
    collection === "rules" || collection === "trustedSites"
      ? normalizePatternId(id)
      : id;

  return listFromSettings(settings, collection).find(
    (item) => getCollectionItemId(collection, item) === normalizedId,
  );
};

const buildLocationCommand = (
  settings: GetSettingsResponse,
  patch: Partial<{
    locations: LocationProfile[];
    rules: DomainRule[];
    containerAssignments: ContainerAssignment[];
  }>,
): Extract<
  ExtensionCommand,
  { type: typeof EXTENSION_COMMAND_TYPES.saveLocationModel }
> => ({
  type: EXTENSION_COMMAND_TYPES.saveLocationModel,
  locations: patch.locations ?? settings.locations,
  rules: patch.rules ?? settings.rules,
  containerAssignments:
    patch.containerAssignments ?? settings.containerAssignments ?? [],
});

const booleanPatchFor = async (
  key: BooleanSettingKey,
  value: boolean,
): Promise<InternalSettingsPatch> => ({ [key]: value }) as InternalSettingsPatch;

const getBooleanFromSettings = (
  settings: GetSettingsResponse,
  key: BooleanSettingKey,
): boolean => {
  return settings[key];
};

const isExtensionPageProtocol = (protocol: string | undefined): boolean =>
  protocol === "chrome-extension:" || protocol === "moz-extension:";

type SettingsGet = SettingsAPI["get"];
type PreferencesPatch = SettingsAPI["preferences"]["patch"];

const createBooleanAPI = (
  get: SettingsGet,
  patchPreferences: PreferencesPatch,
): SettingsAPI["booleans"] => ({
  get: async (key) => getBooleanFromSettings(await get(), key),
  set: async (key, value) => patchPreferences(await booleanPatchFor(key, value)),
  toggle: async (key) => {
    const currentValue = getBooleanFromSettings(await get(), key);
    return patchPreferences(await booleanPatchFor(key, !currentValue));
  },
});

const createCollectionsAPI = (
  get: SettingsGet,
  patchPreferences: PreferencesPatch,
): SettingsAPI["collections"] => {
  const persist = async <T extends SettingsCollection>(
    settings: GetSettingsResponse,
    collection: T,
    items: Array<CollectionItemMap[T]>,
  ): Promise<SaveLocationResponse | SaveSettingsResponse> => {
    assertUniqueIds(collection, items);
    switch (collection) {
      case "trustedSites":
        return patchPreferences({ trustedSites: items as TrustedSite[] });
      case "locations":
        return sendCommand<SaveLocationResponse>(
          buildLocationCommand(settings, { locations: items as LocationProfile[] }),
        );
      case "rules":
        return sendCommand<SaveLocationResponse>(
          buildLocationCommand(settings, { rules: items as DomainRule[] }),
        );
      case "containerAssignments":
        return sendCommand<SaveLocationResponse>(
          buildLocationCommand(settings, {
            containerAssignments: items as ContainerAssignment[],
          }),
        );
    }
  };
  const read = async <T extends SettingsCollection>(
    collection: T,
    id: string,
  ): Promise<CollectionItemMap[T]> => {
    const item = findCollectionItem(await get(), collection, id);
    if (!item) throw new Error(`Missing persisted ${collection} item: ${id}`);
    return item;
  };

  return {
    list: async (collection) => listFromSettings(await get(), collection),
    replace: async (collection, items) => persist(await get(), collection, items),
    create: async (collection, item) => {
      const settings = await get();
      const current = listFromSettings(settings, collection);
      const id = getCollectionItemId(collection, item);
      if (findCollectionItem(settings, collection, id)) {
        throw new Error(`Duplicate ${collection} id: ${id}`);
      }
      assertOk(await persist(settings, collection, [...current, item]));
      return read(collection, id);
    },
    update: async (collection, id, patch) => {
      const settings = await get();
      const current = listFromSettings(settings, collection);
      const normalizedId =
        collection === "rules" || collection === "trustedSites"
          ? normalizePatternId(id)
          : id;
      const index = current.findIndex(
        (item) => getCollectionItemId(collection, item) === normalizedId,
      );
      if (index < 0) throw new Error(`Unknown ${collection} id: ${id}`);
      const nextItem = {
        ...current[index],
        ...patch,
      } as CollectionItemMap[typeof collection];
      const next = [...current];
      next[index] = nextItem;
      const nextId = getCollectionItemId(collection, nextItem);
      assertOk(await persist(settings, collection, next));
      return read(collection, nextId);
    },
    delete: async (collection, id) => {
      const settings = await get();
      const current = listFromSettings(settings, collection);
      const normalizedId =
        collection === "rules" || collection === "trustedSites"
          ? normalizePatternId(id)
          : id;
      const next = current.filter(
        (item) => getCollectionItemId(collection, item) !== normalizedId,
      );
      if (next.length === current.length) {
        throw new Error(`Unknown ${collection} id: ${id}`);
      }
      assertOk(await persist(settings, collection, next));
    },
  };
};

export const createSettingsAPI = (): SettingsAPI => {
  const get = async (): Promise<GetSettingsResponse> =>
    sendCommand<GetSettingsResponse>({
      type: EXTENSION_COMMAND_TYPES.getSettings,
    });

  const patchPreferences = async (
    patch: InternalSettingsPatch,
  ): Promise<SaveSettingsResponse> =>
    sendCommand<SaveSettingsResponse>({
      type: EXTENSION_COMMAND_TYPES.saveSimpleSettings,
      ...patch,
    } as Extract<
      ExtensionCommand,
      { type: typeof EXTENSION_COMMAND_TYPES.saveSimpleSettings }
    >);

  const api: SettingsAPI = {
    version: 1,
    get,
    export: async () => {
      const response = await sendCommand<ExportSettingsResponse>({
        type: EXTENSION_COMMAND_TYPES.exportSettings,
      });
      return response.settings;
    },
    import: (settings) =>
      sendCommand<ImportSettingsResponse>({
        type: EXTENSION_COMMAND_TYPES.importSettings,
        settings,
      }),
    reset: async (options) => {
      const response = await sendCommand<ResetSettingsResponse>({
        type: EXTENSION_COMMAND_TYPES.resetSettings,
      });

      if (options?.onboardingCompleted !== undefined) {
        assertOk(
          await patchPreferences({
            onboardingCompleted: options.onboardingCompleted,
          }),
        );
      }

      return response;
    },
    booleans: createBooleanAPI(get, patchPreferences),
    preferences: {
      patch: patchPreferences,
    },
    collections: createCollectionsAPI(get, patchPreferences),
    nullable: {
      get: async (key) =>
        (await get())[key] as NullableSettingMap[typeof key] | undefined,
      set: (key, value) => patchPreferences({ [key]: value }),
      clear: (key) => patchPreferences({ [key]: undefined }),
    },
  };

  return api;
};

export const installSettingsAPI = (
  target: SettingsAPIGlobal = typeof window === "undefined" ? {} : window,
): SettingsAPI | undefined => {
  if (!isExtensionPageProtocol(target.location?.protocol)) {
    return undefined;
  }

  target.SettingsAPI ??= createSettingsAPI();

  return target.SettingsAPI;
};
