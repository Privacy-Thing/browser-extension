import {
  dispatchPrivacyThingCommand,
  type PrivacyThingLogoElement,
} from "@privacy-thing/brand";
import {
  useEffect,
  useLayoutEffect,
  useMemo,
  useReducer,
  useRef,
  useState,
} from "react";

import type { PopupRuleSheetProps } from "./components/PopupRuleSheet";
import { resolvePopupAutoOpen } from "./popup-auto-open";
import {
  INITIAL_MUTATION_STATE,
  reducePopupMutationState,
} from "./popup-mutation-state";
import {
  createRefreshController,
  type PopupRefreshContext,
  type PopupRefreshController,
} from "./popup-refresh-controller";
import {
  requestPopupSizingState,
  resolvePopupSizingState,
  type PopupSizingState,
} from "./popup-sizing-controller";

import { fireAndForget } from "@/shared/async";
import { EXTENSION_COMMAND_TYPES } from "@/shared/extension-contract";
import type {
  CleanupPlan,
  CleanupResult,
  GetPopupStateResponse,
  PopupState,
  SharedWorkerHandlingMode,
} from "@/shared/types";
import { t } from "@/ui/i18n";
import { sendMessageOrThrow } from "@/ui/shared/runtime-messaging";

const REFRESH_DEBOUNCE_MS = 100;
export type PopupSheetView = PopupRuleSheetProps["view"];

const logPopupError = (context: string, error: unknown): void => {
  console.error(`[popup] ${context}`, error);
};

const resolveTargetTab = async (): Promise<chrome.tabs.Tab | undefined> => {
  const activeTabs = await chrome.tabs.query({
    active: true,
    lastFocusedWindow: true,
  });
  return activeTabs[0];
};

const readExplicitPopupTabId = (): number | undefined => {
  const rawTabId = new URLSearchParams(window.location.search).get("tabId");
  if (!rawTabId) return undefined;
  const parsedTabId = Number.parseInt(rawTabId, 10);
  return Number.isFinite(parsedTabId) ? parsedTabId : undefined;
};

export const usePopupAppState = () => {
  const explicitTargetTabId = useMemo(readExplicitPopupTabId, []);
  const [popupState, setPopupState] = useState<PopupState | null>(null);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [mutationState, dispatchMutation] = useReducer(
    reducePopupMutationState,
    INITIAL_MUTATION_STATE,
  );
  const [conflictPattern, setConflictPattern] = useState<string | null>(null);
  const [selectedRuleMode, setSelectedRuleMode] = useState<"exact" | "suffix">(
    "suffix",
  );
  const [selectedLocationId, setSelectedLocationId] = useState<string | null>(null);
  const [isRegionalPresetOn, setRegionalPresetOn] = useState(true);
  const [isRegionalPresetChanged, setRegionalPresetChanged] = useState(false);
  const [allowInheritedLocation, setAllowInherited] = useState(false);
  const [creatingExactOverride, setCreatingExactOverride] = useState(false);
  const [serviceWorkerOverride, setServiceWorkerOverride] = useState<
    boolean | undefined
  >(undefined);
  const [workerOverride, setWorkerOverride] = useState<
    SharedWorkerHandlingMode | undefined
  >(undefined);
  const [shouldRelaxWorkerCsp, setRelaxWorkerCsp] = useState(false);
  const [sheetTargetPattern, setSheetTargetPattern] = useState<string | null>(null);
  const [isRuleSheetOpen, setRuleSheetOpen] = useState(false);
  const [sizingState, setSizingState] = useState<PopupSizingState>("compact");
  const [sheetView, setSheetView] = useState<PopupSheetView>("rule-form");
  const [sheetDraftHostname, setSheetDraftHostname] = useState<string | null>(null);
  const [selectedNotificationId, setNotificationId] = useState<string | null>(null);
  const [activeSheetTrigger, setActiveSheetTrigger] = useState<string | null>(null);
  const [cleanupPlan, setCleanupPlan] = useState<CleanupPlan | null>(null);
  const [cleanupResult, setCleanupResult] = useState<CleanupResult | null>(null);
  const targetTabIdRef = useRef<number | undefined>(undefined);
  const popupRefreshDebounceRef = useRef<number | null>(null);
  const isRuleSheetOpenRef = useRef(false);
  const loadPopupStateRef = useRef<() => Promise<void>>(() => Promise.resolve());
  const popupRefreshRunnerRef = useRef<
    ((context: PopupRefreshContext) => Promise<void>) | null
  >(null);
  const refreshControllerRef = useRef<PopupRefreshController | null>(null);
  const brandThingElementRef = useRef<PrivacyThingLogoElement | null>(null);
  const previousSheetOpenRef = useRef(false);

  return {
    explicitTargetTabId,
    popupState,
    setPopupState,
    loadError,
    setLoadError,
    mutationState,
    dispatchMutation,
    conflictPattern,
    setConflictPattern,
    selectedRuleMode,
    setSelectedRuleMode,
    selectedLocationId,
    setSelectedLocationId,
    isRegionalPresetOn,
    setRegionalPresetOn,
    isRegionalPresetChanged,
    setRegionalPresetChanged,
    allowInheritedLocation,
    setAllowInherited,
    creatingExactOverride,
    setCreatingExactOverride,
    serviceWorkerOverride,
    setServiceWorkerOverride,
    workerOverride,
    setWorkerOverride,
    shouldRelaxWorkerCsp,
    setRelaxWorkerCsp,
    sheetTargetPattern,
    setSheetTargetPattern,
    isRuleSheetOpen,
    setRuleSheetOpen,
    sizingState,
    setSizingState,
    sheetView,
    setSheetView,
    sheetDraftHostname,
    setSheetDraftHostname,
    selectedNotificationId,
    setNotificationId,
    activeSheetTrigger,
    setActiveSheetTrigger,
    cleanupPlan,
    setCleanupPlan,
    cleanupResult,
    setCleanupResult,
    targetTabIdRef,
    popupRefreshDebounceRef,
    isRuleSheetOpenRef,
    loadPopupStateRef,
    popupRefreshRunnerRef,
    refreshControllerRef,
    brandThingElementRef,
    previousSheetOpenRef,
  };
};

export type PopupAppState = ReturnType<typeof usePopupAppState>;

export const useBrandSheetPose = (state: PopupAppState): void => {
  useEffect(() => {
    const wasOpen = state.previousSheetOpenRef.current;
    state.previousSheetOpenRef.current = state.isRuleSheetOpen;
    const element = state.brandThingElementRef.current;
    if (!element || wasOpen === state.isRuleSheetOpen) return;
    dispatchPrivacyThingCommand(
      element,
      state.isRuleSheetOpen
        ? { type: "look", direction: "south-west" }
        : { type: "reset" },
    );
  }, [state.brandThingElementRef, state.isRuleSheetOpen, state.previousSheetOpenRef]);
};

export const useSheetTopOffset = (): void => {
  useLayoutEffect(() => {
    const syncSheetTopOffset = () => {
      const header = document.querySelector<HTMLElement>(".gw-popup-header");
      const nextOffset = header
        ? Math.round(header.getBoundingClientRect().bottom)
        : 81;
      document.documentElement.style.setProperty(
        "--gw-popup-sheet-top",
        `${nextOffset}px`,
      );
      document.body.style.setProperty("--gw-popup-sheet-top", `${nextOffset}px`);
    };
    syncSheetTopOffset();
    const header = document.querySelector<HTMLElement>(".gw-popup-header");
    const observer =
      typeof ResizeObserver !== "undefined" && header
        ? new ResizeObserver(syncSheetTopOffset)
        : null;
    if (observer && header) observer.observe(header);
    window.addEventListener("resize", syncSheetTopOffset);
    return () => {
      observer?.disconnect();
      window.removeEventListener("resize", syncSheetTopOffset);
    };
  }, []);
};

const useRefreshListeners = (state: PopupAppState): void => {
  const {
    isRuleSheetOpenRef,
    loadPopupStateRef,
    popupRefreshDebounceRef,
    targetTabIdRef,
  } = state;
  useLayoutEffect(() => {
    const refreshNow = () => {
      if (!isRuleSheetOpenRef.current && document.visibilityState === "visible") {
        fireAndForget(loadPopupStateRef.current());
      }
    };
    const refresh = () => {
      if (popupRefreshDebounceRef.current !== null) {
        window.clearTimeout(popupRefreshDebounceRef.current);
      }
      popupRefreshDebounceRef.current = window.setTimeout(() => {
        popupRefreshDebounceRef.current = null;
        refreshNow();
      }, REFRESH_DEBOUNCE_MS);
    };
    const handleVisibility = () => {
      if (document.visibilityState === "visible") refresh();
    };
    const handleTabUpdated: Parameters<typeof chrome.tabs.onUpdated.addListener>[0] = (
      tabId,
      changeInfo,
    ) => {
      if (targetTabIdRef.current !== undefined && tabId !== targetTabIdRef.current) {
        return;
      }
      if (changeInfo.status === "complete" || changeInfo.url) refresh();
    };
    window.addEventListener("focus", refresh);
    document.addEventListener("visibilitychange", handleVisibility);
    chrome.tabs.onActivated.addListener(refresh);
    chrome.tabs.onUpdated.addListener(handleTabUpdated);
    chrome.windows.onFocusChanged.addListener(refresh);
    refreshNow();
    return () => {
      if (popupRefreshDebounceRef.current !== null) {
        window.clearTimeout(popupRefreshDebounceRef.current);
        popupRefreshDebounceRef.current = null;
      }
      window.removeEventListener("focus", refresh);
      document.removeEventListener("visibilitychange", handleVisibility);
      chrome.tabs.onActivated.removeListener(refresh);
      chrome.tabs.onUpdated.removeListener(handleTabUpdated);
      chrome.windows.onFocusChanged.removeListener(refresh);
    };
  }, [isRuleSheetOpenRef, loadPopupStateRef, popupRefreshDebounceRef, targetTabIdRef]);
};

export const usePopupRefresh = (
  state: PopupAppState,
  syncSheetDraft: (nextState: PopupState) => void,
): {
  loadPopupState: () => Promise<void>;
  getTargetTabId: () => Promise<number | undefined>;
} => {
  state.popupRefreshRunnerRef.current = async ({ shouldApply }) => {
    const targetTabId = state.explicitTargetTabId ?? (await resolveTargetTab())?.id;
    state.targetTabIdRef.current = targetTabId;
    const response = (await sendMessageOrThrow({
      type: EXTENSION_COMMAND_TYPES.getPopupState,
      tabId: targetTabId,
    })) as GetPopupStateResponse | { ok: false; error: string };
    if (!response.ok) throw new Error(response.error);
    if (!shouldApply()) return;
    state.setPopupState((current) => {
      const next = response.state;
      if (
        !current ||
        !state.isRuleSheetOpen ||
        state.sheetDraftHostname !== next.currentTab.hostname
      ) {
        syncSheetDraft(next);
      }
      return next;
    });
  };
  state.refreshControllerRef.current ??= createRefreshController(
    (context) => state.popupRefreshRunnerRef.current?.(context) ?? Promise.resolve(),
  );
  const loadPopupState = async (): Promise<void> => {
    try {
      await state.refreshControllerRef.current?.refresh();
      state.setLoadError(null);
    } catch (error) {
      logPopupError("Could not load popup state.", error);
      state.setLoadError(t.popup.popupDataUnavailable);
      throw error;
    }
  };
  const getTargetTabId = async (): Promise<number | undefined> => {
    if (state.explicitTargetTabId !== undefined) return state.explicitTargetTabId;
    if (state.targetTabIdRef.current !== undefined) {
      return state.targetTabIdRef.current;
    }
    const targetTab = await resolveTargetTab();
    state.targetTabIdRef.current = targetTab?.id;
    return targetTab?.id;
  };
  state.isRuleSheetOpenRef.current = state.isRuleSheetOpen;
  state.loadPopupStateRef.current = loadPopupState;
  useRefreshListeners(state);
  return { loadPopupState, getTargetTabId };
};

export const usePopupAutoOpen = (state: PopupAppState): void => {
  const {
    isRuleSheetOpen,
    loadPopupStateRef,
    popupState,
    setActiveSheetTrigger,
    setNotificationId,
    setRuleSheetOpen,
    setSheetView,
  } = state;
  useEffect(() => {
    if (!popupState || isRuleSheetOpen) return;
    const autoOpen = resolvePopupAutoOpen({
      notifications: popupState.notifications,
    });
    if (!autoOpen) return;
    setActiveSheetTrigger("auto:notification");
    if (autoOpen.kind === "notification-detail") {
      setNotificationId(autoOpen.notification.id);
      setSheetView("notification-detail");
      setRuleSheetOpen(true);
      fireAndForget(
        sendMessageOrThrow({
          type: EXTENSION_COMMAND_TYPES.markNoticeRead,
          id: autoOpen.notification.id,
        }).then(() => loadPopupStateRef.current()),
      );
      return;
    }
    setNotificationId(null);
    setSheetView("notification-list");
    setRuleSheetOpen(true);
    fireAndForget(
      sendMessageOrThrow({
        type: EXTENSION_COMMAND_TYPES.markNoticesAutoPresented,
        ids: autoOpen.notificationIds,
      }).then(() => loadPopupStateRef.current()),
    );
  }, [
    isRuleSheetOpen,
    loadPopupStateRef,
    popupState,
    setActiveSheetTrigger,
    setNotificationId,
    setRuleSheetOpen,
    setSheetView,
  ]);
};

export const usePopupSizing = (state: PopupAppState): void => {
  const { isRuleSheetOpen, setSizingState, sizingState } = state;
  useLayoutEffect(() => {
    const value = isRuleSheetOpen ? "true" : "false";
    document.documentElement.dataset.popupWorkspaceOpen = value;
    document.body.dataset.popupWorkspaceOpen = value;
    const cancel = requestPopupSizingState(isRuleSheetOpen, setSizingState);
    return () => {
      cancel();
      delete document.documentElement.dataset.popupWorkspaceOpen;
      delete document.body.dataset.popupWorkspaceOpen;
    };
  }, [isRuleSheetOpen, setSizingState]);
  useLayoutEffect(() => {
    document.documentElement.dataset.popupSizingState = sizingState;
    document.body.dataset.popupSizingState = sizingState;
    return () => {
      delete document.documentElement.dataset.popupSizingState;
      delete document.body.dataset.popupSizingState;
    };
  }, [sizingState]);
  useEffect(() => {
    if (!isRuleSheetOpen) return;
    const handleResize = () => {
      setSizingState(resolvePopupSizingState(window.innerWidth));
    };
    window.addEventListener("resize", handleResize);
    return () => window.removeEventListener("resize", handleResize);
  }, [isRuleSheetOpen, setSizingState]);
};

export { logPopupError };
