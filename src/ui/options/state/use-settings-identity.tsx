import type { Dispatch, RefObject, SetStateAction } from "react";

import { EXTENSION_COMMAND_TYPES } from "@/shared/extension-contract";
import type {
  ContainerAssignment,
  DomainRule,
  CleanupPreviewResponse,
  RotateIdentityResponse,
} from "@/shared/types";
import { notify } from "@/ui/components/ui/toast";
import { t } from "@/ui/i18n";
import type { ConfirmDialogConfig } from "@/ui/options/state/use-settings-confirm-dialog";
import { normalizeRulePattern } from "@/ui/options/utils";
import { sendMessageOrThrow } from "@/ui/shared/runtime-messaging";

type IdentityHandlerOptions = {
  containerAssignmentsRef: RefObject<readonly ContainerAssignment[]>;
  requestConfirmation: (config: ConfirmDialogConfig) => Promise<boolean>;
  rulesRef: RefObject<readonly DomainRule[]>;
  setContainerAssignments: Dispatch<SetStateAction<ContainerAssignment[]>>;
  setRules: Dispatch<SetStateAction<DomainRule[]>>;
  setSaveInFlight: (value: boolean) => void;
};

const buildIdentityConfirm = (
  summary: string,
  domainsLabel: string,
  emptyState: string,
  cleanupDomains: readonly string[],
) => (
  <>
    <span className="block">{summary}</span>
    <span className="mt-3 block">
      {cleanupDomains.length > 0
        ? `${domainsLabel} ${cleanupDomains.join(", ")}`
        : emptyState}
    </span>
  </>
);

const previewCleanupDomains = async (
  target:
    | { target: "rule"; pattern: string }
    | { target: "container"; cookieStoreId: string },
): Promise<string[]> => {
  try {
    const response = (await sendMessageOrThrow({
      type: EXTENSION_COMMAND_TYPES.previewIdentityCleanup,
      ...target,
    })) as CleanupPreviewResponse;
    return response.ok ? response.cleanupHostnames : [];
  } catch {
    return [];
  }
};

const commitRuleRotation = async (
  options: IdentityHandlerOptions,
  rule: DomainRule,
): Promise<boolean> => {
  options.setSaveInFlight(true);
  try {
    const response = (await sendMessageOrThrow({
      type: EXTENSION_COMMAND_TYPES.rotateIdentityTarget,
      target: "rule",
      pattern: rule.pattern,
    })) as RotateIdentityResponse;
    if (!response.ok || response.target !== "rule") {
      notify.error(response.ok ? t.rules.dialog.identity.rotateError : response.error);
      return false;
    }

    options.setRules(
      options.rulesRef.current.map((entry) =>
        normalizeRulePattern(entry.pattern) === normalizeRulePattern(response.pattern)
          ? { ...entry, ruleSeedKey: response.ruleSeedKey }
          : entry,
      ),
    );
    notify.success(t.rules.dialog.identity.rotateSuccess);
    return true;
  } catch {
    notify.error(t.rules.dialog.identity.rotateError);
    return false;
  } finally {
    options.setSaveInFlight(false);
  }
};

const rotateRuleIdentity = async (
  options: IdentityHandlerOptions,
  pattern: string,
): Promise<boolean> => {
  const rule = options.rulesRef.current.find(
    (entry) => normalizeRulePattern(entry.pattern) === normalizeRulePattern(pattern),
  );
  if (!rule) {
    notify.error(t.rules.dialog.identity.rotateError);
    return false;
  }

  const cleanupDomains = await previewCleanupDomains({
    target: "rule",
    pattern: rule.pattern,
  });
  const confirmed = await options.requestConfirmation({
    title: t.rules.dialog.identity.confirmTitle(rule.pattern),
    description: buildIdentityConfirm(
      t.rules.dialog.identity.confirmDescription,
      t.rules.dialog.identity.confirmDomainsLabel,
      t.rules.dialog.identity.confirmNoDomains,
      cleanupDomains,
    ),
    confirmLabel: t.rules.dialog.identity.confirmLabel,
    cancelLabel: t.common.actions.cancel,
    confirmTone: "destructive",
  });

  return confirmed ? await commitRuleRotation(options, rule) : false;
};

const commitContainerRotation = async (
  options: IdentityHandlerOptions,
  cookieStoreId: string,
): Promise<boolean> => {
  options.setSaveInFlight(true);
  try {
    const response = (await sendMessageOrThrow({
      type: EXTENSION_COMMAND_TYPES.rotateIdentityTarget,
      target: "container",
      cookieStoreId,
    })) as RotateIdentityResponse;
    if (!response.ok || response.target !== "container") {
      notify.error(
        response.ok ? t.firefoxContainers.editor.identity.rotateError : response.error,
      );
      return false;
    }

    options.setContainerAssignments(
      options.containerAssignmentsRef.current.map((assignment) =>
        assignment.cookieStoreId === response.cookieStoreId
          ? { ...assignment, ruleSeedKey: response.ruleSeedKey }
          : assignment,
      ),
    );
    notify.success(t.firefoxContainers.editor.identity.rotateSuccess);
    return true;
  } catch {
    notify.error(t.firefoxContainers.editor.identity.rotateError);
    return false;
  } finally {
    options.setSaveInFlight(false);
  }
};

const rotateContainerIdentity = async (
  options: IdentityHandlerOptions,
  cookieStoreId: string,
  name: string,
): Promise<boolean> => {
  const assignment = options.containerAssignmentsRef.current.find(
    (entry) => entry.cookieStoreId === cookieStoreId,
  );
  if (!assignment) {
    notify.error(t.firefoxContainers.editor.identity.rotateError);
    return false;
  }

  const cleanupDomains = await previewCleanupDomains({
    target: "container",
    cookieStoreId,
  });
  const confirmed = await options.requestConfirmation({
    title: t.firefoxContainers.editor.identity.confirmTitle(name),
    description: buildIdentityConfirm(
      t.firefoxContainers.editor.identity.confirmDescription,
      t.firefoxContainers.editor.identity.confirmDomainsLabel,
      t.firefoxContainers.editor.identity.confirmNoDomains,
      cleanupDomains,
    ),
    confirmLabel: t.firefoxContainers.editor.identity.confirmLabel,
    cancelLabel: t.common.actions.cancel,
    confirmTone: "destructive",
  });

  return confirmed ? await commitContainerRotation(options, cookieStoreId) : false;
};

export const createIdentityHandlers = (options: IdentityHandlerOptions) => ({
  rotateContainerIdentity: (cookieStoreId: string, name: string) =>
    rotateContainerIdentity(options, cookieStoreId, name),
  rotateRuleIdentity: (pattern: string) => rotateRuleIdentity(options, pattern),
});
