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
import {
  describeCorrections,
  findUnsupportedTimeZones,
  mergeCorrections,
  withPresetTimeZone,
} from "@/ui/options/state/import-time-zones";
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

const errorMessage = (error: unknown): string =>
  error instanceof Error ? error.message : t.settingsImport.failed;

const applyPreviewedImport = async (input: {
  options: ImportOptions;
  importPreview: SettingsImportPreview | null;
  importBusy: boolean;
  setImportBusy: (busy: boolean) => void;
  setImportError: (error: string | null) => void;
  onAppliedRef: RefObject<(() => void) | undefined>;
  resetImportSession: () => void;
  refreshUndo: () => Promise<void>;
}): Promise<void> => {
  const { options, importPreview, setImportBusy, onAppliedRef } = input;
  if (
    !importPreview ||
    input.importBusy ||
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
    input.resetImportSession();
    notify.success(
      onAppliedRef.current ? t.welcome.importSuccess : t.settingsImport.success,
    );
    await input.refreshUndo();
  } catch (error) {
    input.setImportError(errorMessage(error));
  } finally {
    setImportBusy(false);
  }
};

/**
 * Latest requested source and selection: still in flight, rejected by the background,
 * or waiting for more time zone choices before it is sent.
 */
type ImportDraft = { source: ExportedSettings; selection: SettingsImportSelection };

const DEFAULT_SELECTION: SettingsImportSelection = {
  mode: "replace",
  locations: {},
  rules: {},
  containers: {},
};

/** Rejected file and presets whose time zone the user still replaces in the dialog. */
const useRejectedImport = () => {
  const rejectedRef = useRef<ImportDraft | null>(null);
  const [requestedSource, setRequestedSource] = useState<ExportedSettings | null>(null);
  const [rejectedPresets, setRejectedPresets] = useState<
    ReturnType<typeof findUnsupportedTimeZones>
  >([]);
  return {
    rejectedRef,
    setRequestedSource,
    corrections: describeCorrections(rejectedPresets, requestedSource),
    reject: (source: ExportedSettings, selection?: SettingsImportSelection): void => {
      rejectedRef.current = { source, selection: selection ?? DEFAULT_SELECTION };
      const rejected = findUnsupportedTimeZones(source);
      setRejectedPresets((current) => mergeCorrections(current, rejected));
    },
    reset: (): void => {
      rejectedRef.current = null;
      setRequestedSource(null);
      setRejectedPresets([]);
    },
  };
};

const createImportUpdates = (input: {
  importPreview: SettingsImportPreview | null;
  draftRef: RefObject<ImportDraft | null>;
  rejection: Pick<
    ReturnType<typeof useRejectedImport>,
    "rejectedRef" | "setRequestedSource"
  >;
  preview: (
    settings: ExportedSettings,
    selection?: SettingsImportSelection,
  ) => Promise<void>;
}) => {
  const { importPreview, draftRef, rejection, preview } = input;
  // Build on the draft, not the rendered preview, so corrections made before a
  // rerender (or before the previous preview response) are not lost. A rejected
  // file has no preview yet, so its time zone choices build on the rejected source.
  const request = (patch: (draft: ImportDraft) => ImportDraft): Promise<void> => {
    const base =
      draftRef.current ??
      (importPreview
        ? { source: importPreview.source, selection: importPreview.selection }
        : rejection.rejectedRef.current);
    if (!base) return Promise.resolve();
    const draft = patch(base);
    draftRef.current = draft;
    rejection.setRequestedSource(draft.source);
    // The background stays the only validator; this only avoids asking it again
    // while presets the user still has to choose a zone for are left.
    if (findUnsupportedTimeZones(draft.source).length > 0) return Promise.resolve();
    return preview(draft.source, draft.selection);
  };
  return {
    updateImportTimeZone: (id: string, timeZone: string) =>
      request((draft) => ({
        ...draft,
        source: withPresetTimeZone(draft.source, id, timeZone),
      })),
    updateImportSelection: (selection: SettingsImportSelection) =>
      request((draft) => ({ ...draft, selection })),
  };
};

export const useSettingsImport = (options: ImportOptions) => {
  const [importPreview, setImportPreview] = useState<SettingsImportPreview | null>(
    null,
  );
  const [importBusy, setImportBusy] = useState(false);
  const [importError, setImportError] = useState<string | null>(null);
  const { importUndoAvailable, refreshUndo } = useImportUndoStatus();
  const onAppliedRef = useRef<(() => void) | undefined>(undefined);
  const requestIdRef = useRef(0);
  const draftRef = useRef<ImportDraft | null>(null);
  const rejection = useRejectedImport();
  useEffect(
    () => () => {
      requestIdRef.current++;
    },
    [],
  );

  const resetImportSession = (): void => {
    draftRef.current = null;
    rejection.reset();
    setImportPreview(null);
    setImportError(null);
  };
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
      draftRef.current = null;
      if (!response.ok) {
        rejection.reject(settings, selection);
        throw new Error(response.error);
      }
      rejection.rejectedRef.current = null;
      setImportPreview(response.preview);
    } catch (error) {
      if (requestId === requestIdRef.current) setImportError(errorMessage(error));
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
    resetImportSession();
    try {
      const parsed = JSON.parse(await file.text()) as ExportedSettings;
      if (fileRequest !== requestIdRef.current) return;
      const settings = onboarding ? { ...parsed, onboardingCompleted: true } : parsed;
      rejection.setRequestedSource(settings);
      await preview(settings);
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
    resetImportSession();
    setImportBusy(false);
    onAppliedRef.current = undefined;
  };
  const applyImport = () =>
    applyPreviewedImport({
      options,
      importPreview,
      importBusy,
      setImportBusy,
      setImportError,
      onAppliedRef,
      resetImportSession,
      refreshUndo,
    });
  const handleUndoImport = () =>
    undoImport({ options, importBusy, setImportBusy, refreshUndo });
  return {
    importPreview,
    importBusy,
    importError,
    importTimeZoneCorrections: rejection.corrections,
    importUndoAvailable,
    handleImportSettings,
    handleUndoImport,
    cancelImport,
    applyImport,
    ...createImportUpdates({
      importPreview,
      draftRef,
      rejection,
      preview,
    }),
  };
};
