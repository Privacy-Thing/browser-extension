import { EXTENSION_STORAGE_KEYS } from "@/shared/extension-contract";
import { trustedSitesSchema } from "@/shared/profile-schema";
import type { TrustedSite } from "@/shared/types";

export const TRUSTED_STORAGE_KEY = EXTENSION_STORAGE_KEYS.trustedSites;

export const DEFAULT_TRUSTED_SITES: TrustedSite[] = [];
let trustedSiteMutationQueue: Promise<unknown> = Promise.resolve();

export const loadTrustedSites = async (): Promise<TrustedSite[]> => {
  const stored = await chrome.storage.local.get(TRUSTED_STORAGE_KEY);
  const trustedSites = stored[TRUSTED_STORAGE_KEY];
  return Array.isArray(trustedSites)
    ? trustedSitesSchema.parse(trustedSites)
    : DEFAULT_TRUSTED_SITES;
};

export const saveTrustedSites = async (
  trustedSites: readonly TrustedSite[],
): Promise<void> => {
  await chrome.storage.local.set({
    [TRUSTED_STORAGE_KEY]: trustedSitesSchema.parse(trustedSites),
  });
};

export const upsertTrustedSite = (pattern: string): Promise<TrustedSite[]> => {
  const operation = async (): Promise<TrustedSite[]> => {
    const normalizedPattern = pattern.trim().toLowerCase();
    const current = await loadTrustedSites();
    const existing = current.find((site) => site.pattern === normalizedPattern);
    const next = existing
      ? current.map((site) =>
          site.pattern === normalizedPattern ? { ...site, enabled: true } : site,
        )
      : [...current, { pattern: normalizedPattern, enabled: true }];
    await saveTrustedSites(next);
    return next;
  };
  const next = trustedSiteMutationQueue.then(operation, operation);
  trustedSiteMutationQueue = next.then(
    () => undefined,
    () => undefined,
  );
  return next;
};

export const setTrustedSiteEnabled = (
  pattern: string,
  enabled: boolean,
): Promise<TrustedSite[]> => {
  const operation = async (): Promise<TrustedSite[]> => {
    const normalizedPattern = pattern.trim().toLowerCase();
    const current = await loadTrustedSites();
    if (!current.some((site) => site.pattern === normalizedPattern)) {
      throw new Error(`Trusted Site rule not found: ${normalizedPattern}`);
    }
    const next = current.map((site) =>
      site.pattern === normalizedPattern ? { ...site, enabled } : site,
    );
    await saveTrustedSites(next);
    return next;
  };
  const next = trustedSiteMutationQueue.then(operation, operation);
  trustedSiteMutationQueue = next.then(
    () => undefined,
    () => undefined,
  );
  return next;
};
