import type { EffectiveTabContext } from "@/shared/types";

const documentKey = (value: string): string | null => {
  try {
    const url = new URL(value);
    url.hash = "";
    return url.toString();
  } catch {
    return null;
  }
};

/** Browser-owned frame records bind an unscoped worker request to its top host.
 * Ambiguous document URLs must satisfy every possible owner; page seed contents
 * never authorize a request. */
export const findWorkerRequestOwners = async (
  documentUrl: string | undefined,
  cookieStoreId: string,
  contexts: EffectiveTabContext[],
): Promise<EffectiveTabContext[]> => {
  const key = documentUrl ? documentKey(documentUrl) : null;
  if (!key) return [];
  const matches = await Promise.all(
    contexts
      .filter(
        (context) =>
          context.cookieStoreId === cookieStoreId ||
          (!context.cookieStoreId && cookieStoreId === "firefox-default"),
      )
      .map(async (context) => {
        const frames = await chrome.webNavigation
          .getAllFrames({ tabId: context.tabId })
          .catch(() => null);
        return frames?.some((frame) => documentKey(frame.url) === key) ? context : null;
      }),
  );
  return matches.filter((context): context is EffectiveTabContext => context !== null);
};
