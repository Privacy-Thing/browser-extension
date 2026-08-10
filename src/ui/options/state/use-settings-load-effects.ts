import { useEffect, type RefObject } from "react";

import { EXTENSION_COMMAND_TYPES } from "@/shared/extension-contract";
import type {
  GetControlStateResponse,
  GetSettingsResponse,
  ImportSettingsResponse,
  ResetSettingsResponse,
} from "@/shared/types";
import { notify } from "@/ui/components/ui/toast";
import { LOAD_MAX_RETRIES, LOAD_RETRY_DELAY_MS } from "@/ui/options/constants";
import { capabilities } from "@/ui/options/utils";
import { migrateLegacyPrefs } from "@/ui/shared/preferences-migration";
import { sendMessageOrThrow } from "@/ui/shared/runtime-messaging";

type LoadedSettingsPayload =
  | GetSettingsResponse
  | ResetSettingsResponse
  | Extract<ImportSettingsResponse, { ok: true }>;

type LoadEffectOptions = {
  applyLoadedSettingsState: (payload: LoadedSettingsPayload) => void;
  autosaveTimerRef: RefObject<ReturnType<typeof setTimeout> | null>;
  setPanicMode: (value: boolean) => void;
  setSettingsLoaded: (value: boolean) => void;
};

export const useSettingsLoadEffects = (options: LoadEffectOptions): void => {
  useEffect(() => {
    document.body.dataset.browserTarget = capabilities.target;
  }, []);

  useEffect(() => {
    let cancelled = false;
    const retryTimers: ReturnType<typeof setTimeout>[] = [];

    const load = async (attempt = 0): Promise<void> => {
      try {
        await migrateLegacyPrefs().catch(() => undefined);
        const [controlResponse, settingsResponse] = await Promise.all([
          sendMessageOrThrow({
            type: EXTENSION_COMMAND_TYPES.getControlState,
          }) as Promise<GetControlStateResponse>,
          sendMessageOrThrow({
            type: EXTENSION_COMMAND_TYPES.getSettings,
          }) as Promise<GetSettingsResponse>,
        ]);
        if (cancelled) {
          return;
        }

        options.setPanicMode(controlResponse.state.panicMode);
        options.applyLoadedSettingsState(settingsResponse);
        // Autosave stays gated until canonical stored values have been applied.
        options.setSettingsLoaded(true);
        if (settingsResponse.notice) {
          notify.info(settingsResponse.notice);
        }
      } catch {
        if (cancelled) {
          return;
        }
        if (attempt < LOAD_MAX_RETRIES) {
          retryTimers.push(
            setTimeout(() => {
              void load(attempt + 1);
            }, LOAD_RETRY_DELAY_MS),
          );
          return;
        }
        notify.error("Loading settings failed.", {
          description: "Reopen this page to try again.",
        });
      }
    };

    void load();
    return () => {
      cancelled = true;
      for (const timer of retryTimers) {
        clearTimeout(timer);
      }
      if (options.autosaveTimerRef.current) {
        clearTimeout(options.autosaveTimerRef.current);
      }
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps -- preserves the original dependency boundary; setters and the ref are stable
  }, [options.applyLoadedSettingsState]);
};
