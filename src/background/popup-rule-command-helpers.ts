import type { PopupCommandDeps } from "@/background/popup-command-types";
import type { getPopupCurrentRule } from "@/background/popup-state";
import { createRuleSeedKey } from "@/shared/rule-seed";
import type {
  ContainerAssignment,
  DomainRule,
  GetPopupStateResponse,
} from "@/shared/types";

export type PopupStateGetter = (tabId?: number) => Promise<GetPopupStateResponse>;

export type PopupMutationContext = {
  deps: PopupCommandDeps;
  getPopupState: PopupStateGetter;
};

export const findContainerAssignment = (
  assignments: readonly ContainerAssignment[],
  cookieStoreId: string | undefined,
): ContainerAssignment | null =>
  cookieStoreId
    ? (assignments.find((assignment) => assignment.cookieStoreId === cookieStoreId) ??
      null)
    : null;

export const resolveSeedKeyPatch = (
  existingRule: Pick<DomainRule, "locationId" | "ruleSeedKey"> | null,
  locationId: string,
): { ruleSeedKey?: string } => {
  if (!existingRule) return {};
  if (existingRule.locationId && existingRule.locationId !== locationId) {
    return { ruleSeedKey: createRuleSeedKey() };
  }
  return existingRule.ruleSeedKey ? { ruleSeedKey: existingRule.ruleSeedKey } : {};
};

export const buildPopupSuccess = async (
  getPopupState: PopupStateGetter,
  tabId: number | undefined,
): Promise<Pick<GetPopupStateResponse, "state">> => ({
  state: (await getPopupState(tabId)).state,
});

export const shouldToggleContainer = (
  containerAssignment: ContainerAssignment | null,
  winningSource: string,
  activeContainer: unknown,
): containerAssignment is ContainerAssignment =>
  Boolean(
    containerAssignment &&
    (winningSource === "container" ||
      (winningSource === "none" && Boolean(activeContainer))),
  );

export type CurrentPopupRule = NonNullable<ReturnType<typeof getPopupCurrentRule>>;
