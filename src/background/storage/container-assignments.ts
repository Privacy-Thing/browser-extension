import { EXTENSION_STORAGE_KEYS } from "@/shared/extension-contract";
import { containerSchema } from "@/shared/profile-schema";
import { withContainerSeed } from "@/shared/rule-seed";
import type { ContainerAssignment } from "@/shared/types";

export const CONTAINERS_STORAGE_KEY = EXTENSION_STORAGE_KEYS.containerAssignments;

export const loadContainerAssignments = async (): Promise<ContainerAssignment[]> => {
  const data = await chrome.storage.local.get(CONTAINERS_STORAGE_KEY);
  const raw = data[CONTAINERS_STORAGE_KEY];

  if (!raw || !Array.isArray(raw)) {
    return [];
  }

  const seen = new Set<string>();
  const assignments: ContainerAssignment[] = [];

  for (const item of raw) {
    const parsed = containerSchema.safeParse(item);
    if (!parsed.success) {
      continue;
    }

    const assignment = parsed.data;
    const cookieStoreId = assignment.cookieStoreId;

    if (!cookieStoreId || seen.has(cookieStoreId)) {
      continue;
    }

    seen.add(cookieStoreId);
    assignments.push(withContainerSeed(assignment));
  }

  return assignments;
};

export const saveContainerAssignments = async (
  assignments: readonly ContainerAssignment[],
): Promise<void> => {
  await chrome.storage.local.set({
    [CONTAINERS_STORAGE_KEY]: assignments.map((assignment) =>
      withContainerSeed(assignment),
    ),
  });
};
