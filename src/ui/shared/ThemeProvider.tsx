import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useLayoutEffect,
  useMemo,
  useState,
} from "react";
import type { ReactNode } from "react";

import { fireAndForget } from "@/shared/async";
import {
  EXTENSION_COMMAND_TYPES,
  EXTENSION_STORAGE_KEYS,
} from "@/shared/extension-contract";
import {
  DEFAULT_PREFERENCES,
  normalizePreferences,
  type Preferences,
} from "@/shared/settings-defaults";
import {
  type ThemeAccentPreset,
  type ThemeMode,
  type SaveSettingsResponse,
} from "@/shared/types";
import { migrateLegacyPrefs } from "@/ui/shared/preferences-migration";
import { sendRuntimeMessage, sendMessageOrThrow } from "@/ui/shared/runtime-messaging";
import {
  type ResolvedTheme,
  getThemeAccentTokens,
  resolveSystemTheme,
} from "@/ui/shared/theme";

interface ThemeContextValue {
  theme: ResolvedTheme;
  preference: ThemeMode;
  setPreference: (preference: ThemeMode) => Promise<void>;
  accentPreset: ThemeAccentPreset;
  setAccentPreset: (accentPreset: ThemeAccentPreset) => Promise<void>;
  reduceMotion: boolean;
  motionOverride: boolean;
  setReduceMotion: (enabled: boolean) => Promise<void>;
  highContrast: boolean;
  setHighContrast: (enabled: boolean) => Promise<void>;
}

const ThemeContext = createContext<ThemeContextValue | null>(null);

const applyTheme = (theme: ResolvedTheme): void => {
  document.documentElement.setAttribute("data-theme", theme);
  document.body?.setAttribute("data-theme", theme);
};

const applyReduceMotion = (enabled: boolean): void => {
  document.documentElement.toggleAttribute("data-reduce-motion", enabled);
};

const applyThemeAccent = (
  accentPreset: ThemeAccentPreset,
  theme: ResolvedTheme,
  highContrast: boolean,
): void => {
  const tokens = getThemeAccentTokens(accentPreset, theme, highContrast);
  const targets = [document.documentElement, document.body].filter(
    (target): target is HTMLElement => target instanceof HTMLElement,
  );

  for (const target of targets) {
    target.style.setProperty("--primary", tokens.primary);
    target.style.setProperty("--primary-foreground", tokens.primaryForeground);
    target.style.setProperty("--ring", tokens.ring);
  }
};

const readStoredPreferences = async (): Promise<Preferences> => {
  const result = await chrome.storage.local.get(EXTENSION_STORAGE_KEYS.preferences);
  return normalizePreferences(result[EXTENSION_STORAGE_KEYS.preferences]);
};

type ThemeSetters = {
  setAccent: React.Dispatch<React.SetStateAction<ThemeAccentPreset>>;
  setContrast: React.Dispatch<React.SetStateAction<boolean>>;
  setMotion: React.Dispatch<React.SetStateAction<boolean>>;
  setPreference: React.Dispatch<React.SetStateAction<ThemeMode>>;
};

const applyStoredPreferences = (prefs: Preferences, setters: ThemeSetters): void => {
  setters.setPreference(prefs.themeMode);
  setters.setAccent(prefs.themeAccentPreset);
  setters.setMotion(prefs.reduceMotion);
  setters.setContrast(prefs.highContrastMode);
};

const useInitialPreferences = (
  setters: ThemeSetters,
  setReady: React.Dispatch<React.SetStateAction<boolean>>,
): void => {
  useEffect(() => {
    let cancelled = false;
    fireAndForget(
      migrateLegacyPrefs()
        .catch(() => undefined)
        .then(() => readStoredPreferences())
        .then((prefs) => {
          if (!cancelled) {
            applyStoredPreferences(prefs, setters);
            setReady(true);
          }
        })
        .catch(() => {
          if (!cancelled) setReady(true);
        }),
    );
    return () => {
      cancelled = true;
    };
  }, [setReady, setters]);
};

const useAutoContrast = (): void => {
  useEffect(() => {
    const mq = window.matchMedia("(prefers-contrast: more)");
    const applyIfNoOverride = async (prefersMore: boolean) => {
      const preferences = await readStoredPreferences();
      if (preferences.highContrastExplicit) return;
      await sendRuntimeMessage({
        type: EXTENSION_COMMAND_TYPES.saveSimpleSettings,
        highContrastMode: prefersMore,
      });
    };
    fireAndForget(applyIfNoOverride(mq.matches));
    const handleChange = (event: MediaQueryListEvent) => {
      fireAndForget(applyIfNoOverride(event.matches));
    };
    mq.addEventListener("change", handleChange);
    return () => mq.removeEventListener("change", handleChange);
  }, []);
};

const useSystemTheme = (): ResolvedTheme => {
  const [theme, setTheme] = useState<ResolvedTheme>(() =>
    typeof window === "undefined" ? "light" : resolveSystemTheme(),
  );
  useEffect(() => {
    const mediaQuery = window.matchMedia("(prefers-color-scheme: dark)");
    const handleChange = (event: MediaQueryListEvent) => {
      setTheme(event.matches ? "dark" : "light");
    };
    setTheme(mediaQuery.matches ? "dark" : "light");
    mediaQuery.addEventListener("change", handleChange);
    return () => mediaQuery.removeEventListener("change", handleChange);
  }, []);
  return theme;
};

const useThemeEffects = ({
  accent,
  contrast,
  motion,
  ready,
  theme,
}: {
  accent: ThemeAccentPreset;
  contrast: boolean;
  motion: boolean;
  ready: boolean;
  theme: ResolvedTheme;
}): void => {
  useLayoutEffect(() => {
    if (ready) applyTheme(theme);
  }, [ready, theme]);
  useLayoutEffect(() => {
    if (ready) applyReduceMotion(motion);
  }, [motion, ready]);
  useLayoutEffect(() => {
    if (!ready) return;
    document.documentElement.classList.toggle("high-contrast", contrast);
    document.body?.classList.toggle("high-contrast", contrast);
  }, [contrast, ready]);
  useLayoutEffect(() => {
    if (ready) applyThemeAccent(accent, theme, contrast);
  }, [accent, contrast, ready, theme]);
};

const usePreferenceSync = (setters: ThemeSetters): void => {
  useEffect(() => {
    const handleChange = (
      changes: Record<string, chrome.storage.StorageChange>,
      areaName: string,
    ) => {
      if (areaName !== "local") return;
      const change = changes[EXTENSION_STORAGE_KEYS.preferences];
      if (change)
        applyStoredPreferences(normalizePreferences(change.newValue), setters);
    };
    chrome.storage.onChanged.addListener(handleChange);
    return () => chrome.storage.onChanged.removeListener(handleChange);
  }, [setters]);
};

const useThemeActions = (setters: ThemeSetters) => {
  const persist = useCallback(
    async (patch: Partial<Preferences>) => {
      try {
        const response = await sendMessageOrThrow<SaveSettingsResponse>({
          type: EXTENSION_COMMAND_TYPES.saveSimpleSettings,
          ...patch,
        });
        if (!response.ok) throw new Error(response.error);
      } catch (error) {
        applyStoredPreferences(await readStoredPreferences(), setters);
        throw error;
      }
    },
    [setters],
  );
  const setPreference = useCallback(
    async (next: ThemeMode) => {
      setters.setPreference(next);
      await persist({ themeMode: next });
    },
    [persist, setters],
  );
  const setAccentPreset = useCallback(
    async (next: ThemeAccentPreset) => {
      setters.setAccent(next);
      await persist({ themeAccentPreset: next });
    },
    [persist, setters],
  );
  const setReduceMotion = useCallback(
    async (next: boolean) => {
      setters.setMotion(next);
      await persist({ reduceMotion: next });
    },
    [persist, setters],
  );
  const setHighContrast = useCallback(
    async (next: boolean) => {
      setters.setContrast(next);
      await persist({ highContrastMode: next, highContrastExplicit: true });
    },
    [persist, setters],
  );
  return { setAccentPreset, setHighContrast, setPreference, setReduceMotion };
};

export function ThemeProvider({
  children,
  deferInitialPaint = false,
}: {
  children: ReactNode;
  deferInitialPaint?: boolean;
}) {
  const [preference, setPreferenceState] = useState<ThemeMode>(
    DEFAULT_PREFERENCES.themeMode,
  );
  const [accentPreset, setAccentPresetState] = useState<ThemeAccentPreset>(
    DEFAULT_PREFERENCES.themeAccentPreset,
  );
  const [reduceMotion, setReduceMotionState] = useState(
    DEFAULT_PREFERENCES.reduceMotion,
  );
  const [systemReduceMotion] = useState(
    () =>
      typeof window !== "undefined" &&
      window.matchMedia("(prefers-reduced-motion: reduce)").matches,
  );
  const systemTheme = useSystemTheme();
  const [highContrastMode, setHighContrastMode] = useState(
    DEFAULT_PREFERENCES.highContrastMode,
  );
  const [initialPreferencesReady, setPrefsReady] = useState(!deferInitialPaint);
  const theme = preference === "system" ? systemTheme : preference;
  const effectiveReduceMotion = reduceMotion || systemReduceMotion;
  const setters = useMemo<ThemeSetters>(
    () => ({
      setAccent: setAccentPresetState,
      setContrast: setHighContrastMode,
      setMotion: setReduceMotionState,
      setPreference: setPreferenceState,
    }),
    [],
  );
  useInitialPreferences(setters, setPrefsReady);
  useAutoContrast();
  useThemeEffects({
    accent: accentPreset,
    contrast: highContrastMode,
    motion: effectiveReduceMotion,
    ready: initialPreferencesReady,
    theme,
  });
  usePreferenceSync(setters);
  const { setAccentPreset, setHighContrast, setPreference, setReduceMotion } =
    useThemeActions(setters);

  const value = useMemo<ThemeContextValue>(
    () => ({
      theme,
      preference,
      setPreference,
      accentPreset,
      setAccentPreset,
      reduceMotion: effectiveReduceMotion,
      motionOverride: systemReduceMotion,
      setReduceMotion,
      highContrast: highContrastMode,
      setHighContrast,
    }),
    [
      theme,
      preference,
      setPreference,
      accentPreset,
      setAccentPreset,
      effectiveReduceMotion,
      systemReduceMotion,
      setReduceMotion,
      highContrastMode,
      setHighContrast,
    ],
  );

  return <ThemeContext.Provider value={value}>{children}</ThemeContext.Provider>;
}

export function useTheme(): ThemeContextValue {
  const ctx = useContext(ThemeContext);
  if (!ctx) {
    throw new Error("useTheme must be used within a ThemeProvider");
  }
  return ctx;
}
