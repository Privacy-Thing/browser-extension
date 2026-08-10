import { useState, type Dispatch, type RefObject, type SetStateAction } from "react";

import { SETTINGS_EXPORT_STEM } from "@/shared/brand";
import { EXTENSION_COMMAND_TYPES } from "@/shared/extension-contract";
import type {
  ExportSettingsResponse,
  GetSettingsResponse,
  ImportSettingsResponse,
  ResetSettingsResponse,
  SaveSettingsResponse,
} from "@/shared/types";
import { notify } from "@/ui/components/ui/toast";
import { t } from "@/ui/i18n";
import { useLatestRef } from "@/ui/options/state/use-latest-ref";
import type { ConfirmDialogConfig } from "@/ui/options/state/use-settings-confirm-dialog";
import { downloadJson } from "@/ui/options/utils";
import { sendMessageOrThrow } from "@/ui/shared/runtime-messaging";

/** Whether the next reset should relaunch onboarding, toggled in the dialog. */
export const useManagementState = () => {
  const [resetRunOnboarding, setResetRunOnboarding] = useState(true);
  const resetRunOnboardingRef = useLatestRef(resetRunOnboarding);

  return { resetRunOnboarding, resetRunOnboardingRef, setResetRunOnboarding };
};

export type ManagementOptions = {
  applyLoadedSettingsState: (
    payload:
      | GetSettingsResponse
      | ResetSettingsResponse
      | Extract<ImportSettingsResponse, { ok: true }>,
  ) => void;
  autosaveTimerRef: RefObject<ReturnType<typeof setTimeout> | null>;
  requestConfirmation: (config: ConfirmDialogConfig) => Promise<boolean>;
  resetRunOnboardingRef: RefObject<boolean>;
  setOnboardingCompleted: Dispatch<SetStateAction<boolean>>;
  setResetRunOnboarding: Dispatch<SetStateAction<boolean>>;
};

/** Needs nothing from the provider, so it lives outside the factory. */
const handleExportSettings = async (): Promise<void> => {
  try {
    const response = (await sendMessageOrThrow({
      type: EXTENSION_COMMAND_TYPES.exportSettings,
    })) as ExportSettingsResponse;
    const exportedAt = response.settings.exportedAt.slice(0, 10);
    downloadJson(`${SETTINGS_EXPORT_STEM}-${exportedAt}.json`, response.settings);
    notify.success("Settings exported.");
  } catch {
    notify.error("Export failed.");
  }
};

const importSettingsFromFile = async (
  event: React.ChangeEvent<HTMLInputElement>,
  applyLoadedSettingsState: ManagementOptions["applyLoadedSettingsState"],
): Promise<void> => {
  const file = event.target.files?.[0];
  if (!file) {
    return;
  }

  try {
    const payload = JSON.parse(await file.text());
    const response = (await sendMessageOrThrow({
      type: EXTENSION_COMMAND_TYPES.importSettings,
      settings: payload,
    })) as ImportSettingsResponse;

    if (!response.ok) {
      notify.error(response.error);
      return;
    }

    applyLoadedSettingsState(response);
    notify.success("Settings imported.");
  } catch {
    notify.error("Import failed.");
  } finally {
    event.target.value = "";
  }
};

/**
 * Whole-profile operations: reload, reset, export, import.
 *
 * They bypass `persistSettings` because each one replaces the entire stored
 * state rather than patching a scope, and they re-seed the UI through
 * `applyLoadedSettingsState` instead.
 */
export const createManagementHandlers = ({
  applyLoadedSettingsState,
  autosaveTimerRef,
  requestConfirmation,
  resetRunOnboardingRef,
  setOnboardingCompleted,
  setResetRunOnboarding,
}: ManagementOptions) => {
  const handleReloadSettings = async (): Promise<void> => {
    if (autosaveTimerRef.current) {
      clearTimeout(autosaveTimerRef.current);
      autosaveTimerRef.current = null;
    }

    const response = (await sendMessageOrThrow({
      type: EXTENSION_COMMAND_TYPES.getSettings,
    })) as GetSettingsResponse;

    applyLoadedSettingsState(response);
    notify.success("Reloaded saved settings.");
  };

  const handleResetSettings = async (): Promise<void> => {
    try {
      const response = (await sendMessageOrThrow({
        type: EXTENSION_COMMAND_TYPES.resetSettings,
      })) as ResetSettingsResponse;

      applyLoadedSettingsState(response);
      const saveResponse = (await sendMessageOrThrow({
        type: EXTENSION_COMMAND_TYPES.saveSimpleSettings,
        onboardingCompleted: true,
      })) as SaveSettingsResponse;

      if (!saveResponse.ok) {
        throw new Error(saveResponse.error);
      }

      setOnboardingCompleted(true);
      notify.success("Settings reset to defaults.");
    } catch {
      notify.error("Reset failed.");
    }
  };

  const resetAndRunOnboarding = async (): Promise<void> => {
    try {
      const response = (await sendMessageOrThrow({
        type: EXTENSION_COMMAND_TYPES.resetSettings,
      })) as ResetSettingsResponse;

      applyLoadedSettingsState(response);
      setOnboardingCompleted(false);
      window.history.replaceState(null, "", `${window.location.pathname}?onboarding=1`);
      notify.success("Settings reset. Setup is ready to run again.");
    } catch {
      notify.error("Reset failed.");
    }
  };

  const requestResetSettings = async (): Promise<void> => {
    setResetRunOnboarding(true);
    const confirmed = await requestConfirmation({
      title: t.advanced.danger.reset.confirmTitle,
      description: t.advanced.danger.reset.confirmBody,
      showOnboardingReset: true,
      confirmLabel: t.common.actions.reset,
      cancelLabel: t.common.actions.cancel,
      confirmTone: "destructive",
      cancelVariant: "default",
      actionOrder: "confirm-cancel",
      footerLayout: "split",
    });

    if (!confirmed) {
      return;
    }

    if (resetRunOnboardingRef.current) {
      await resetAndRunOnboarding();
    } else {
      await handleResetSettings();
    }
  };

  const handleImportSettings = (
    event: React.ChangeEvent<HTMLInputElement>,
  ): Promise<void> => importSettingsFromFile(event, applyLoadedSettingsState);

  return {
    handleExportSettings,
    handleImportSettings,
    handleReloadSettings,
    handleResetSettings,
    resetAndRunOnboarding,
    requestResetSettings,
  };
};
