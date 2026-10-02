import type { SnapshotCacheInput } from "@/background/effective-snapshot-cache";
import type { ResolutionDecision } from "@/background/prepared-runtime-decisions";
import { inheritTabSnapshot } from "@/background/top-frame-snapshot";
import type { EXTENSION_COMMAND_TYPES } from "@/shared/extension-contract";
import type {
  ExtensionCommand,
  ResolveSnapshotResponse,
  RuntimeSnapshot,
} from "@/shared/types";

type SnapshotHandlerDeps = {
  ensureStorageMigration: () => Promise<void>;
  runtimeState: { getLastKnownDebugMode: () => boolean | null };
  logResolverEvent: (
    enabled: boolean,
    event: string,
    input: { hostname: string; tabId?: number; details: Record<string, unknown> },
  ) => void;
  resolveCachedSnapshot: (
    hostname: string,
    cookieStoreId?: string,
    exactOrigin?: string,
    options?: { respectHostPause?: boolean },
  ) => Promise<RuntimeSnapshot | null>;
  resolveRuntimeDecision: (
    hostname: string,
    cookieStoreId?: string,
  ) => Promise<ResolutionDecision>;
  readDecisionCache: (
    tabId: number,
    frameId: number,
    hostname: string,
    cookieStoreId?: string,
  ) => ResolutionDecision | undefined;
  readTopDecision: (tabId: number) => ResolutionDecision | undefined;
  updateSnapshotCache: (
    input: SnapshotCacheInput & { value: ResolutionDecision | RuntimeSnapshot | null },
  ) => void;
};

export const createSnapshotHandler =
  (deps: SnapshotHandlerDeps) =>
  async (
    message: Extract<
      ExtensionCommand,
      { type: typeof EXTENSION_COMMAND_TYPES.resolveRuntimeSnapshot }
    >,
    cookieStoreId?: string,
    tabId?: number,
    frameId?: number,
  ): Promise<ResolveSnapshotResponse> => {
    await deps.ensureStorageMigration();
    if (tabId === undefined || frameId === undefined) {
      return {
        ok: true,
        snapshot: await deps.resolveCachedSnapshot(
          message.hostname,
          cookieStoreId,
          undefined,
          { respectHostPause: false },
        ),
      };
    }
    const cached = deps.readDecisionCache(
      tabId,
      frameId,
      message.hostname,
      cookieStoreId,
    );
    if (cached !== undefined) {
      deps.logResolverEvent(
        deps.runtimeState.getLastKnownDebugMode() ?? false,
        "resolver.snapshot-cache-hit",
        {
          hostname: message.hostname,
          tabId,
          details: {
            frameId,
            cookieStoreId: cookieStoreId ?? null,
            resolved: cached.snapshot !== null,
            blockServiceWorkerRegistration:
              cached.snapshot?.blockServiceWorkerRegistration ?? false,
          },
        },
      );
      return { ok: true, snapshot: cached.snapshot };
    }
    const inherited = inheritTabSnapshot({
      tabId,
      frameId,
      hostname: message.hostname,
      readTop: deps.readTopDecision,
      writeCache: deps.updateSnapshotCache,
      ...(cookieStoreId ? { cookieStoreId } : {}),
    });
    if (inherited) {
      deps.logResolverEvent(
        deps.runtimeState.getLastKnownDebugMode() ?? false,
        "resolver.top-frame-inherit",
        {
          hostname: message.hostname,
          tabId,
          details: {
            frameId,
            cookieStoreId: cookieStoreId ?? null,
            resolved: inherited.snapshot !== null,
          },
        },
      );
      return { ok: true, snapshot: inherited.snapshot };
    }
    const tab =
      frameId !== 0 ? await chrome.tabs.get(tabId).catch(() => undefined) : undefined;
    let topHostname = message.hostname;
    if (tab?.url && /^https?:/.test(tab.url)) topHostname = new URL(tab.url).hostname;
    const decision = await deps.resolveRuntimeDecision(topHostname, cookieStoreId);
    if (frameId !== 0)
      deps.updateSnapshotCache({
        tabId,
        frameId: 0,
        hostname: topHostname,
        value: decision,
        ...(cookieStoreId ? { cookieStoreId } : {}),
      });
    deps.updateSnapshotCache({
      tabId,
      frameId,
      hostname: message.hostname,
      value: decision,
      ...(cookieStoreId ? { cookieStoreId } : {}),
    });
    return { ok: true, snapshot: decision.snapshot };
  };
