import {
  useCallback,
  useEffect,
  useRef,
  useState,
  type ChangeEvent,
  type RefObject,
} from "react";

import {
  EXTENSION_COMMAND_TYPES,
  EXTENSION_STORAGE_KEYS,
} from "@/shared/extension-contract";
import type {
  ImportUndoStatusResponse,
  ImportPreviewResponse,
  SettingsImportPreview,
  SettingsImportSelection,
} from "@/shared/settings-import";
import type { ExportedSettings, ImportSettingsResponse } from "@/shared/types";
import { notify } from "@/ui/components/ui/toast";
import { t } from "@/ui/i18n";
import { sendMessageOrThrow } from "@/ui/shared/runtime-messaging";

const useImportUndoStatus = () => {
  const [importUndoAvailable, setImportUndoAvailable] = useState(false);
  const refreshUndo = useCallback(async (): Promise<void> => {
    try {
      const status = (await sendMessageOrThrow({
        type: EXTENSION_COMMAND_TYPES.getImportUndoStatus,
      })) as ImportUndoStatusResponse;
      setImportUndoAvailable(status.available);
    } catch {
      setImportUndoAvailable(false);
    }
  }, []);
  useEffect(() => {
    void refreshUndo();
    const keys = new Set<string>([
      ...Object.values(EXTENSION_STORAGE_KEYS),
      "sharedSpoofing",
      "globalFallbackRule",
    ]);
    const listener = (changes: Record<string, unknown>, area: string) => {
      if (area === "local" && Object.keys(changes).some((key) => keys.has(key)))
        void refreshUndo();
    };
    chrome.storage.onChanged.addListener(listener);
    return () => chrome.storage.onChanged.removeListener(listener);
  }, [refreshUndo]);

  return { importUndoAvailable, refreshUndo };
};

type ImportOptions = {
  apply: (response: Extract<ImportSettingsResponse, { ok: true }>) => void;
  autosaveTimerRef: RefObject<ReturnType<typeof setTimeout> | null>;
  saveInFlight: boolean;
};
const undoImport = async (input: {
  options: ImportOptions;
  importBusy: boolean;
  setImportBusy: (busy: boolean) => void;
  refreshUndo: () => Promise<void>;
}): Promise<void> => {
  const { options, importBusy, setImportBusy, refreshUndo } = input;
  if (importBusy || options.saveInFlight || options.autosaveTimerRef.current) return;
  setImportBusy(true);
  try {
    const response = (await sendMessageOrThrow({
      type: EXTENSION_COMMAND_TYPES.undoSettingsImport,
    })) as ImportSettingsResponse;
    if (!response.ok) throw new Error(response.error);
    options.apply(response);
    notify.success(t.settingsImport.undoSuccess);
    await refreshUndo();
  } catch (error) {
    notify.error(error instanceof Error ? error.message : t.settingsImport.failed);
  } finally {
    setImportBusy(false);
  }
};

const createImportUpdates = (
  importPreview: SettingsImportPreview | null,
  preview: (
    settings: ExportedSettings,
    selection?: SettingsImportSelection,
  ) => Promise<void>,
) => ({
  updateImportTimeZone: (id: string, timeZone: string) =>
    importPreview
      ? preview(
          {
            ...importPreview.source,
            locations: importPreview.source.locations.map((profile) =>
              profile.id === id ? { ...profile, timeZone } : profile,
            ),
          },
          importPreview.selection,
        )
      : Promise.resolve(),
  updateImportSelection: (selection: SettingsImportSelection) =>
    importPreview ? preview(importPreview.source, selection) : Promise.resolve(),
});

export const useSettingsImport = (options: ImportOptions) => {
  const [importPreview, setImportPreview] = useState<SettingsImportPreview | null>(
    null,
  );
  const [importBusy, setImportBusy] = useState(false);
  const [importError, setImportError] = useState<string | null>(null);
  const { importUndoAvailable, refreshUndo } = useImportUndoStatus();
  const onAppliedRef = useRef<(() => void) | undefined>(undefined);
  const requestIdRef = useRef(0);
  useEffect(
    () => () => {
      requestIdRef.current++;
    },
    [],
  );

  const preview = async (
    settings: ExportedSettings,
    selection?: SettingsImportSelection,
  ): Promise<void> => {
    const requestId = ++requestIdRef.current;
    setImportBusy(true);
    setImportError(null);
    try {
      const response = (await sendMessageOrThrow({
        type: EXTENSION_COMMAND_TYPES.previewSettingsImport,
        settings,
        ...(selection ? { selection } : {}),
        ...(importPreview ? { previousToken: importPreview.token } : {}),
      })) as ImportPreviewResponse;
      if (requestId !== requestIdRef.current) return;
      if (!response.ok) throw new Error(response.error);
      setImportPreview(response.preview);
    } catch (error) {
      if (requestId === requestIdRef.current)
        setImportError(
          error instanceof Error ? error.message : t.settingsImport.failed,
        );
    } finally {
      if (requestId === requestIdRef.current) setImportBusy(false);
    }
  };
  const handleImportSettings = async (
    event: ChangeEvent<HTMLInputElement>,
    onboarding?: { onApplied: () => void },
  ): Promise<void> => {
    const input = event.currentTarget;
    const file = input.files?.[0];
    if (!file) return;
    const fileRequest = ++requestIdRef.current;
    setImportBusy(true);
    onAppliedRef.current = onboarding?.onApplied;
    setImportPreview(null);
    setImportError(null);
    try {
      const settings = JSON.parse(await file.text()) as ExportedSettings;
      if (fileRequest !== requestIdRef.current) return;
      await preview(onboarding ? { ...settings, onboardingCompleted: true } : settings);
    } catch (error) {
      if (fileRequest !== requestIdRef.current) return;
      const message =
        error instanceof Error ? error.message : t.welcome.importParseError;
      setImportBusy(false);
      setImportError(message);
      notify.error(onboarding ? t.welcome.importError : t.settingsImport.failed, {
        description: message,
      });
    } finally {
      input.value = "";
    }
  };
  const cancelImport = (): void => {
    requestIdRef.current++;
    setImportPreview(null);
    setImportError(null);
    setImportBusy(false);
    onAppliedRef.current = undefined;
  };
  const applyImport = async (): Promise<void> => {
    if (
      !importPreview ||
      importBusy ||
      options.saveInFlight ||
      options.autosaveTimerRef.current
    )
      return;
    setImportBusy(true);
    try {
      const response = (await sendMessageOrThrow({
        type: EXTENSION_COMMAND_TYPES.importSettings,
        previewToken: importPreview.token,
      })) as ImportSettingsResponse;
      if (!response.ok) throw new Error(response.error);
      options.apply(response);
      onAppliedRef.current?.();
      setImportPreview(null);
      notify.success(
        onAppliedRef.current ? t.welcome.importSuccess : t.settingsImport.success,
      );
      await refreshUndo();
    } catch (error) {
      setImportError(error instanceof Error ? error.message : t.settingsImport.failed);
    } finally {
      setImportBusy(false);
    }
  };
  const handleUndoImport = () =>
    undoImport({ options, importBusy, setImportBusy, refreshUndo });
  return {
    importPreview,
    importBusy,
    importError,
    importUndoAvailable,
    handleImportSettings,
    handleUndoImport,
    cancelImport,
    applyImport,
    ...createImportUpdates(importPreview, preview),
  };
};
