import { loadContainerAssignments } from "@/background/storage/container-assignments";
import {
  getPreferences,
  savePreferences,
  getGlobalFallbackRule,
} from "@/background/storage/preferences";
import { loadRules } from "@/background/storage/rules";
import { loadTrustedSites } from "@/background/storage/trusted-sites";
import { resolveRuleSources } from "@/shared/rule-resolution";
import type { WorkerTestSession } from "@/shared/worker-test";
export const saveWorkerTestException = async (
  tab: chrome.tabs.Tab | undefined,
  session: WorkerTestSession,
): Promise<void> => {
  const cookieStoreId = (
    tab as (chrome.tabs.Tab & { cookieStoreId?: string }) | undefined
  )?.cookieStoreId;
  const hostname = session.hostname;
  const rules = await loadRules();
  const resolved = resolveRuleSources({
    hostname,
    cookieStoreId,
    rules,
    containerAssignments: await loadContainerAssignments(),
    globalFallbackRule: await getGlobalFallbackRule(),
    trustedSites: await loadTrustedSites(),
  });
  if (resolved.trustedSite) throw new Error("test-unavailable");
  const source =
    resolved.activeRule ?? resolved.usableContainer ?? resolved.runtimeFallbackRule;
  if (!source) throw new Error("test-unavailable");
  const preferences = await getPreferences();
  await savePreferences({
    workerPolicyExceptions: {
      ...preferences.workerPolicyExceptions,
      [hostname]: {
        ...preferences.workerPolicyExceptions[hostname],
        ...(session.kind === "service-worker"
          ? { serviceWorker: false }
          : { sharedWorker: "native" }),
      },
    },
  });
};
