import type { RuntimeSnapshot } from "@/shared/types";

/**
 * Experimental tab identity: every subframe in a tab presents the top-frame
 * snapshot so JS realms (page, iframe, worker) do not diverge.
 */
export type TopFrameDecision = {
  snapshot: RuntimeSnapshot | null;
  trustedSiteMatched: boolean;
  fencesIdentity?: boolean;
};

export const pickTopFrameDecision = (
  frameId: number,
  ownDecision: TopFrameDecision,
  topDecision: TopFrameDecision | undefined,
): { decision: TopFrameDecision; inherited: boolean } => {
  if (frameId === 0 || topDecision === undefined) {
    return { decision: ownDecision, inherited: false };
  }
  return { decision: topDecision, inherited: true };
};

const isHttpUrl = (url: string | undefined): url is string =>
  typeof url === "string" &&
  (url.startsWith("https://") || url.startsWith("http://"));

export const resolveTopFrameDecision = async (input: {
  frameId: number;
  ownDecision: TopFrameDecision;
  readTop: () => TopFrameDecision | undefined;
  resolveTopFromTab: () => Promise<{
    hostname: string;
    decision: TopFrameDecision;
    cookieStoreId?: string;
  } | null>;
}): Promise<{
  decision: TopFrameDecision;
  inherited: boolean;
  seededTop?: {
    hostname: string;
    cookieStoreId?: string;
  };
}> => {
  if (input.frameId === 0) {
    return { decision: input.ownDecision, inherited: false };
  }

  const cached = input.readTop();
  if (cached !== undefined) {
    return { decision: cached, inherited: true };
  }

  const resolved = await input.resolveTopFromTab();
  if (resolved) {
    return {
      decision: resolved.decision,
      inherited: true,
      seededTop: {
        hostname: resolved.hostname,
        ...(resolved.cookieStoreId ? { cookieStoreId: resolved.cookieStoreId } : {}),
      },
    };
  }

  return { decision: input.ownDecision, inherited: false };
};

export const inheritTabSnapshot = async (input: {
  tabId: number;
  frameId: number;
  hostname: string;
  cookieStoreId?: string;
  readTop: (tabId: number) => TopFrameDecision | undefined;
  tabHostname?: string;
  resolveHost: (hostname: string) => Promise<TopFrameDecision>;
  writeCache: (input: {
    tabId: number;
    frameId: number;
    hostname: string;
    value: TopFrameDecision;
    cookieStoreId?: string;
  }) => void;
}): Promise<TopFrameDecision | null> => {
  if (input.frameId === 0) {
    return null;
  }
  const cachedTop = input.readTop(input.tabId);
  if (cachedTop) {
    input.writeCache({
      tabId: input.tabId,
      frameId: input.frameId,
      hostname: input.hostname,
      value: cachedTop,
      ...(input.cookieStoreId ? { cookieStoreId: input.cookieStoreId } : {}),
    });
    return cachedTop;
  }
  if (!input.tabHostname) {
    return null;
  }
  const inherited = await input.resolveHost(input.tabHostname);
  input.writeCache({
    tabId: input.tabId,
    frameId: 0,
    hostname: input.tabHostname,
    value: inherited,
    ...(input.cookieStoreId ? { cookieStoreId: input.cookieStoreId } : {}),
  });
  input.writeCache({
    tabId: input.tabId,
    frameId: input.frameId,
    hostname: input.hostname,
    value: inherited,
    ...(input.cookieStoreId ? { cookieStoreId: input.cookieStoreId } : {}),
  });
  return inherited;
};

export { isHttpUrl };
