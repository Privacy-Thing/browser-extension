import { loadContainerAssignments } from "@/background/storage/container-assignments";
import { getGlobalFallbackRule } from "@/background/storage/preferences";
import { loadRules, saveRules } from "@/background/storage/rules";
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
  // Copy the current source so an exact exception keeps unrelated policy
  // and identity fields; never replace a wildcard or a container assignment.
  const source =
    resolved.activeRule ?? resolved.usableContainer ?? resolved.runtimeFallbackRule;
  if (!source) throw new Error("test-unavailable");
  await saveRules([
    {
      ...(source.locationId ? { locationId: source.locationId } : {}),
      ...(source.ruleSeedKey ? { ruleSeedKey: source.ruleSeedKey } : {}),
      ...("pattern" in source && source.pattern === hostname && source.authKey
        ? { authKey: source.authKey }
        : {}),
      ...("relaxCspForWorkers" in source
        ? { relaxCspForWorkers: source.relaxCspForWorkers }
        : {}),
      pattern: hostname,
      enabled: true,
      fingerprintSurfaceOverrides: {
        ...source.fingerprintSurfaceOverrides,
        ...(session.kind === "service-worker"
          ? { serviceWorker: false }
          : { sharedWorker: "native" as const }),
      },
    },
    ...rules.filter((rule) => rule.pattern !== hostname),
  ]);
};
