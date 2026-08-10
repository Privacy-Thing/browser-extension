import {
  DEFAULT_CONTAINER_COLOR,
  DEFAULT_CONTAINER_ICON,
  getContainerIconUrl,
  isFirefoxContainerColor,
  isFirefoxContainerIcon,
  type FirefoxContainerColor,
  type FirefoxContainerIcon,
} from "@/shared/firefox-containers";
import type { ContainerPresentation } from "@/shared/types";

type ContextualIdentityEvent = {
  addListener: (callback: () => void) => void;
  removeListener?: (callback: () => void) => void;
};

type ContextualIdentityApi = {
  query: (details: object) => Promise<
    Array<{
      cookieStoreId: string;
      name: string;
      icon?: string;
      iconUrl?: string;
      color?: string;
      colorCode?: string;
    }>
  >;
  get: (cookieStoreId: string) => Promise<
    | {
        cookieStoreId: string;
        name: string;
        icon?: string;
        iconUrl?: string;
        color?: string;
        colorCode?: string;
      }
    | undefined
  >;
  create: (details: {
    name: string;
    color: FirefoxContainerColor;
    icon: FirefoxContainerIcon;
  }) => Promise<{
    cookieStoreId: string;
    name: string;
    icon?: string;
    iconUrl?: string;
    color?: string;
    colorCode?: string;
  }>;
  update: (
    cookieStoreId: string,
    details: {
      name?: string;
      color?: FirefoxContainerColor;
      icon?: FirefoxContainerIcon;
    },
  ) => Promise<{
    cookieStoreId: string;
    name: string;
    icon?: string;
    iconUrl?: string;
    color?: string;
    colorCode?: string;
  }>;
  onCreated?: ContextualIdentityEvent;
  onRemoved?: ContextualIdentityEvent;
  remove: (cookieStoreId: string) => Promise<{
    cookieStoreId: string;
    name: string;
    icon?: string;
    iconUrl?: string;
    color?: string;
    colorCode?: string;
  }>;
};

const contextualIdentitiesApi = (
  globalThis as typeof globalThis & {
    browser?: {
      contextualIdentities?: ContextualIdentityApi;
    };
  }
).browser?.contextualIdentities;

const CONTAINERS_API_ERROR = "Firefox contextual identities API is unavailable.";

type RawContextualIdentity = Awaited<ReturnType<ContextualIdentityApi["get"]>>;

export type BrowserContainerCatalog = {
  available: boolean;
  containers: ContainerPresentation[];
};

const normalizeIdentity = (
  identity: RawContextualIdentity,
): ContainerPresentation | null => {
  if (!identity) {
    return null;
  }

  const colorValue = identity.color ?? "";
  const iconValue = identity.icon ?? "";
  const color = isFirefoxContainerColor(colorValue)
    ? colorValue
    : DEFAULT_CONTAINER_COLOR;
  const icon = isFirefoxContainerIcon(iconValue) ? iconValue : DEFAULT_CONTAINER_ICON;

  return {
    cookieStoreId: identity.cookieStoreId,
    name: identity.name,
    icon,
    iconUrl: identity.iconUrl ?? getContainerIconUrl(icon),
    color,
    colorCode: identity.colorCode ?? "",
  };
};

const requireContainersApi = (): ContextualIdentityApi => {
  if (!contextualIdentitiesApi) {
    throw new Error(CONTAINERS_API_ERROR);
  }

  return contextualIdentitiesApi;
};

export const isContainersApiAvailable = async (): Promise<boolean> => {
  return (await getContainerCatalog()).available;
};

export const getContainerCatalog = async (): Promise<BrowserContainerCatalog> => {
  if (!contextualIdentitiesApi) {
    return {
      available: false,
      containers: [],
    };
  }

  try {
    const identities = await contextualIdentitiesApi.query({});
    return {
      available: true,
      containers: identities
        .map((identity) => normalizeIdentity(identity))
        .filter((identity): identity is ContainerPresentation => identity !== null),
    };
  } catch {
    return {
      available: false,
      containers: [],
    };
  }
};

export const getBrowserContainers = async (): Promise<ContainerPresentation[]> =>
  (await getContainerCatalog()).containers;

export const getBrowserContainer = async (
  cookieStoreId: string,
): Promise<ContainerPresentation | null> => {
  if (!contextualIdentitiesApi) {
    return null;
  }

  try {
    return normalizeIdentity(await contextualIdentitiesApi.get(cookieStoreId));
  } catch {
    return null;
  }
};

export const createBrowserContainer = async (details: {
  name: string;
  color: FirefoxContainerColor;
  icon: FirefoxContainerIcon;
}): Promise<ContainerPresentation> => {
  const api = requireContainersApi();
  const created = normalizeIdentity(await api.create(details));
  if (!created) {
    throw new Error("Firefox did not return the created container.");
  }
  return created;
};

export const updateBrowserContainer = async (
  cookieStoreId: string,
  details: {
    name?: string;
    color?: FirefoxContainerColor;
    icon?: FirefoxContainerIcon;
  },
): Promise<ContainerPresentation> => {
  const api = requireContainersApi();
  const updated = normalizeIdentity(await api.update(cookieStoreId, details));
  if (!updated) {
    throw new Error("Firefox did not return the updated container.");
  }
  return updated;
};

export const removeBrowserContainer = async (
  cookieStoreId: string,
): Promise<ContainerPresentation> => {
  const api = requireContainersApi();
  const removed = normalizeIdentity(await api.remove(cookieStoreId));
  if (!removed) {
    throw new Error("Firefox did not return the removed container.");
  }
  return removed;
};

/**
 * Registers a listener fired when a Firefox container is created. No-op when the
 * contextual identities API (or the event) is unavailable, e.g. on Chromium.
 * The callback receives no arguments — listeners re-query the catalog so they
 * always act on the current container set.
 */
export const onContainerCreated = (callback: () => void): void => {
  contextualIdentitiesApi?.onCreated?.addListener(callback);
};

/**
 * Registers a listener fired when a Firefox container is removed. No-op when the
 * contextual identities API (or the event) is unavailable.
 */
export const onContainerRemoved = (callback: () => void): void => {
  contextualIdentitiesApi?.onRemoved?.addListener(callback);
};

export { CONTAINERS_API_ERROR };
