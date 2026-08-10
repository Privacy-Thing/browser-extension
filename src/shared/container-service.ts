import type {
  FirefoxContainerColor,
  FirefoxContainerIcon,
} from "@/shared/firefox-containers";
import type {
  ContainerAssignment,
  ContainerPresentation,
  HydratedAssignment,
} from "@/shared/types";
import {
  CONTAINERS_API_ERROR,
  createBrowserContainer,
  getBrowserContainer,
  getContainerCatalog,
  removeBrowserContainer,
  updateBrowserContainer,
} from "@/targets/firefox/containers-api";

export type ContainerCatalogResult = {
  available: boolean;
  containers: ContainerPresentation[];
};

export type CreateContainerDetails = {
  name: string;
  color: FirefoxContainerColor;
  icon: FirefoxContainerIcon;
};

export type UpdateContainerDetails = {
  name?: string;
  color?: FirefoxContainerColor;
  icon?: FirefoxContainerIcon;
};

export type HydrationResult = {
  hydratedAssignments: HydratedAssignment[];
  orphanedAssignments: ContainerAssignment[];
};

type ContainerBackend = {
  listContainers: () => Promise<ContainerCatalogResult>;
  getContainer: (cookieStoreId: string) => Promise<ContainerPresentation | null>;
  createContainer: (details: CreateContainerDetails) => Promise<ContainerPresentation>;
  updateContainer: (
    cookieStoreId: string,
    details: UpdateContainerDetails,
  ) => Promise<ContainerPresentation>;
  removeContainer: (cookieStoreId: string) => Promise<ContainerPresentation>;
};
const CONTAINER_BACKENDS: readonly ContainerBackend[] = [
  {
    listContainers: getContainerCatalog,
    getContainer: getBrowserContainer,
    createContainer: createBrowserContainer,
    updateContainer: updateBrowserContainer,
    removeContainer: removeBrowserContainer,
  },
];

const findContainerBackend = async (): Promise<{
  backend: ContainerBackend;
  catalog: ContainerCatalogResult;
} | null> => {
  for (const backend of CONTAINER_BACKENDS) {
    const catalog = await backend.listContainers();
    if (catalog.available) {
      return {
        backend,
        catalog,
      };
    }
  }

  return null;
};

const requireContainerBackend = async (): Promise<ContainerBackend> => {
  const availableBackend = await findContainerBackend();
  if (!availableBackend) {
    throw new Error(CONTAINERS_API_ERROR);
  }

  return availableBackend.backend;
};

const createContainerIndex = (
  containers: readonly ContainerPresentation[],
): ReadonlyMap<string, ContainerPresentation> =>
  new Map(containers.map((container) => [container.cookieStoreId, container] as const));

export const listContainers = async (): Promise<ContainerCatalogResult> => {
  const availableBackend = await findContainerBackend();
  return availableBackend?.catalog ?? { available: false, containers: [] };
};

export const getContainer = async (
  cookieStoreId: string,
): Promise<ContainerPresentation | null> => {
  const availableBackend = await findContainerBackend();
  return availableBackend ? availableBackend.backend.getContainer(cookieStoreId) : null;
};

export const createContainer = async (
  details: CreateContainerDetails,
): Promise<ContainerPresentation> => {
  const backend = await requireContainerBackend();
  return backend.createContainer(details);
};

export const updateContainer = async (
  cookieStoreId: string,
  details: UpdateContainerDetails,
): Promise<ContainerPresentation> => {
  const backend = await requireContainerBackend();
  return backend.updateContainer(cookieStoreId, details);
};

export const removeContainer = async (
  cookieStoreId: string,
): Promise<ContainerPresentation> => {
  const backend = await requireContainerBackend();
  return backend.removeContainer(cookieStoreId);
};

export const hydrateAssignment = (
  assignment: ContainerAssignment,
  containers: readonly ContainerPresentation[],
): HydratedAssignment | null => {
  const container = createContainerIndex(containers).get(assignment.cookieStoreId);
  return container
    ? {
        ...assignment,
        container,
      }
    : null;
};

export const hydrateAssignments = (
  assignments: readonly ContainerAssignment[],
  containers: readonly ContainerPresentation[],
): HydrationResult => {
  const containersById = createContainerIndex(containers);
  const hydratedAssignments: HydratedAssignment[] = [];
  const orphanedAssignments: ContainerAssignment[] = [];

  for (const assignment of assignments) {
    const container = containersById.get(assignment.cookieStoreId);
    if (container) {
      hydratedAssignments.push({
        ...assignment,
        container,
      });
      continue;
    }

    orphanedAssignments.push(assignment);
  }

  return {
    hydratedAssignments,
    orphanedAssignments,
  };
};

export type ReconcileResult = {
  next: ContainerAssignment[];
  changed: boolean;
};

/**
 * Ensures every existing container owns a `ContainerAssignment`, so each one gets
 * its own distinct spoofing identity (`ruleSeedKey`/`authKey` are minted at the
 * storage boundary — see `withContainerSeed`) instead of collapsing
 * onto the Default Rule's shared seed. Containers can be created outside the
 * Privacy Thing panel (directly in Firefox or by other extensions), so provisioning
 * must not assume the panel created them.
 *
 * - Adds a baseline assignment (`{ cookieStoreId }`, no preset, enabled) for any
 *   container that lacks one.
 * - Drops orphaned assignments whose container no longer exists.
 *
 * Pure: callers pass the current catalog. Only call with a catalog that was
 * actually `available`; otherwise an empty `containers` list would wrongly orphan
 * every assignment.
 */
export const reconcileAssignments = (
  assignments: readonly ContainerAssignment[],
  containers: readonly ContainerPresentation[],
): ReconcileResult => {
  const { hydratedAssignments, orphanedAssignments } = hydrateAssignments(
    assignments,
    containers,
  );
  const kept = hydratedAssignments.map(
    ({ container: _container, ...assignment }) => assignment,
  );
  const assignedIds = new Set(kept.map((assignment) => assignment.cookieStoreId));
  const added = containers
    .filter((container) => !assignedIds.has(container.cookieStoreId))
    .map((container) => ({ cookieStoreId: container.cookieStoreId }));

  return {
    next: [...kept, ...added],
    changed: added.length > 0 || orphanedAssignments.length > 0,
  };
};
