import { seedPauseFrames, type PauseSeedDeps } from "@/background/host-pause-seed";
import type { ResolutionDecision } from "@/background/prepared-runtime-decisions";
import { withConfigurationLock } from "@/background/settings-import-transaction";
import {
  expireHostPauses,
  getHostPauses,
  getHostPause,
  HOST_PAUSE_ALARM,
  initializeHostPauses,
  recordPausedDocument,
  setHostPause,
} from "@/background/storage/host-protection-pauses";
import { fireAndForget } from "@/shared/async";
import type {
  EffectiveTabContext,
  GetPopupStateResponse,
  ToggleRuleResponse,
} from "@/shared/types";

type PauseControllerDeps = {
  prepareReload: (context: EffectiveTabContext) => Promise<void>;
  refresh: (contexts: EffectiveTabContext[]) => Promise<void>;
  getPopupState: (tabId?: number) => Promise<GetPopupStateResponse>;
};

const getWebContexts = async (): Promise<EffectiveTabContext[]> => {
  const tabs = await chrome.tabs.query({});
  return tabs.flatMap((tab) => {
    if (tab.id === undefined || !tab.url || !/^https?:/.test(tab.url)) return [];
    const cookieStoreId = (tab as chrome.tabs.Tab & { cookieStoreId?: string })
      .cookieStoreId;
    return [
      {
        tabId: tab.id,
        hostname: new URL(tab.url).hostname,
        ...(cookieStoreId ? { cookieStoreId } : {}),
      },
    ];
  });
};

export const createHostPauseCtl = (deps: PauseControllerDeps) => {
  const reloadHosts = async (contexts: EffectiveTabContext[], hosts: string[]) => {
    await Promise.all(
      contexts
        .filter((context) => hosts.includes(context.hostname))
        .map(async (context) => {
          const live = await chrome.tabs.get(context.tabId).catch(() => undefined);
          if (!live?.url || new URL(live.url).hostname !== context.hostname) return;
          await deps.prepareReload(context);
          await chrome.tabs.reload(context.tabId).catch(() => undefined);
        }),
    );
  };
  const activate = async (hostname: string) => {
    const contexts = await getWebContexts();
    const pause = getHostPause(hostname);
    if (pause)
      await Promise.all(
        contexts
          .filter((context) => context.hostname === hostname)
          .map((context) => recordPausedDocument(context.tabId, hostname, "pending")),
      );
    await deps.refresh(contexts);
    await reloadHosts(contexts, [hostname]);
  };
  const reconcile = async (): Promise<void> => {
    const tests = getHostPauses().filter((pause) => pause.workerTest);
    const expired = await expireHostPauses();
    if (expired.length > 0) {
      const contexts = await getWebContexts();
      await deps.refresh(contexts);
      await reloadHosts(
        contexts,
        tests
          .filter((pause) => expired.includes(pause.hostname))
          .map((pause) => pause.hostname),
      );
    }
  };
  const setPause = async (
    duration: "ten-minutes" | "session" | "resume",
    tabId?: number,
  ): Promise<ToggleRuleResponse> => {
    if (!["ten-minutes", "session", "resume"].includes(duration))
      return { ok: false, error: "Invalid pause duration." };
    const tab =
      tabId === undefined
        ? (await chrome.tabs.query({ active: true, currentWindow: true }))[0]
        : await chrome.tabs.get(tabId);
    if (!tab?.url || tab.id === undefined || !/^https?:/.test(tab.url))
      return { ok: false, error: "A supported top-level document is required." };
    const hostname = new URL(tab.url).hostname;
    await withConfigurationLock(async () => {
      await setHostPause(hostname, duration);
      const contexts = await getWebContexts();
      const affected = contexts.filter((context) => context.hostname === hostname);
      // Until navigation commits, an existing document cannot prove the new
      // activation. Keep this marker across worker restarts and failed reloads.
      if (duration !== "resume") {
        await Promise.all(
          affected.map((context) =>
            recordPausedDocument(context.tabId, hostname, "pending"),
          ),
        );
      }
      await deps.refresh(contexts);
      await Promise.all(
        affected.map(async (context) => {
          const live = await chrome.tabs.get(context.tabId).catch(() => undefined);
          if (live?.url && new URL(live.url).hostname === hostname) {
            await deps.prepareReload(context);
            await chrome.tabs.reload(context.tabId).catch(() => undefined);
          }
        }),
      );
    });
    return { ok: true, state: (await deps.getPopupState(tab.id)).state };
  };
  const register = (): void => {
    chrome.alarms.onAlarm.addListener((alarm) => {
      if (alarm.name === HOST_PAUSE_ALARM)
        fireAndForget(withConfigurationLock(reconcile));
    });
    chrome.tabs.onRemoved.addListener((tabId) =>
      fireAndForget(recordPausedDocument(tabId, "")),
    );
    // Rebuild tab-scoped DNR rules on every worker start, not just onStartup.
    // A delayed alarm is not required to reject a deadline in the resolver.
    fireAndForget(
      withConfigurationLock(async () => {
        await initializeHostPauses();
        await reconcile();
        await deps.refresh(await getWebContexts());
      }),
    );
  };
  return { setPause, reconcile, register, activate, prepareReload: deps.prepareReload };
};

type RefreshDeps = PauseSeedDeps & {
  resolveRuntimeDecision: (
    hostname: string,
    cookieStoreId?: string,
  ) => Promise<ResolutionDecision>;
  ensureStorageMigration: () => Promise<void>;
  effectiveSnapshotCache: { clear: () => void };
  activeTabContexts: Map<number, EffectiveTabContext>;
  refreshCachedConfig: () => Promise<unknown>;
  syncPreloadedState: () => Promise<unknown>;
  resyncActiveHeaderRules: () => Promise<unknown>;
  refreshActionState: () => Promise<unknown>;
  publishSidebarEvent: (event: {
    type: "doctor-state-invalidated";
    tabId: number;
  }) => unknown;
};

export const createPauseActivation = (deps: RefreshDeps) => ({
  refresh: async (contexts: EffectiveTabContext[]) => {
    await deps.ensureStorageMigration();
    deps.effectiveSnapshotCache.clear();
    deps.activeTabContexts.clear();
    for (const context of contexts) deps.activeTabContexts.set(context.tabId, context);
    await deps.refreshCachedConfig();
    await deps.syncPreloadedState();
    await deps.resyncActiveHeaderRules();
    await deps.refreshActionState();
    for (const context of contexts)
      deps.publishSidebarEvent({
        type: "doctor-state-invalidated",
        tabId: context.tabId,
      });
  },
  prepareReload: async (context: EffectiveTabContext) => {
    const decision = await deps.resolveRuntimeDecision(
      context.hostname,
      context.cookieStoreId,
    );
    await seedPauseFrames(context, decision, deps);
  },
});
