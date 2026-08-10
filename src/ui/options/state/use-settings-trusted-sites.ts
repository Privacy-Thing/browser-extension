import { useState, type Dispatch, type SetStateAction, type RefObject } from "react";

import type { TrustedSite } from "@/shared/types";
import { notify } from "@/ui/components/ui/toast";
import { t } from "@/ui/i18n";
import { useLatestRef } from "@/ui/options/state/use-latest-ref";
import { normalizeRulePattern } from "@/ui/options/utils";

/**
 * Trusted-site state, split from the handlers because the write path they need
 * (`persistTrustedSites`) is built from `setTrustedSites` — so the state has to
 * exist before the persistence runtime, and the handlers after it.
 */
export const useTrustedSitesState = () => {
  const [trustedSites, setTrustedSites] = useState<TrustedSite[]>([]);
  const [trustedSitesFilter, setTrustedSitesFilter] = useState("");
  const [trustedSitePattern, setTrustedSitePattern] = useState("");
  const [trustedSiteDialogOpened, setTrustedDialogOpen] = useState(false);
  const trustedSitesRef = useLatestRef(trustedSites);

  const normalizedFilter = trustedSitesFilter.trim().toLowerCase();
  const filteredTrustedSites = trustedSites.filter((site) =>
    normalizedFilter
      ? normalizeRulePattern(site.pattern).includes(normalizedFilter)
      : true,
  );

  return {
    filteredTrustedSites,
    setTrustedDialogOpen,
    setTrustedSitePattern,
    setTrustedSites,
    setTrustedSitesFilter,
    trustedSiteDialogOpened,
    trustedSitePattern,
    trustedSites,
    trustedSitesFilter,
    trustedSitesRef,
  };
};

export type TrustedSiteOptions = {
  persistTrustedSites: (
    nextTrustedSites: readonly TrustedSite[],
    successMessage: string,
  ) => Promise<boolean>;
  setTrustedDialogOpen: Dispatch<SetStateAction<boolean>>;
  setTrustedSitePattern: Dispatch<SetStateAction<string>>;
  setTrustedSites: Dispatch<SetStateAction<TrustedSite[]>>;
  /** Current draft value; the factory reruns each render, as it did inline. */
  trustedSitePattern: string;
  trustedSitesRef: RefObject<readonly TrustedSite[]>;
};

/**
 * Every mutation writes optimistically and rolls back on a failed save, which is
 * why each handler captures the previous list before calling the setter.
 */
export const createTrustedHandlers = ({
  persistTrustedSites,
  setTrustedDialogOpen,
  setTrustedSitePattern,
  setTrustedSites,
  trustedSitePattern,
  trustedSitesRef,
}: TrustedSiteOptions) => {
  const openTrustedSiteDialog = (): void => {
    setTrustedSitePattern("");
    setTrustedDialogOpen(true);
  };

  const closeTrustedSiteDialog = (): void => {
    setTrustedDialogOpen(false);
    setTrustedSitePattern("");
  };

  const persistOrRollback = async (
    nextTrustedSites: TrustedSite[],
    successMessage: string,
  ): Promise<boolean> => {
    const previousTrustedSites = [...trustedSitesRef.current];

    setTrustedSites(nextTrustedSites);
    if (await persistTrustedSites(nextTrustedSites, successMessage)) {
      return true;
    }

    setTrustedSites(previousTrustedSites);
    return false;
  };

  const handleAddTrustedSite = async (): Promise<boolean> => {
    const normalized = normalizeRulePattern(trustedSitePattern);

    if (!normalized) {
      notify.warning(t.trustedSites.patternRequired);
      return false;
    }

    const existingSite = trustedSitesRef.current.find(
      (site) => normalizeRulePattern(site.pattern) === normalized,
    );

    if (existingSite?.enabled) {
      notify.warning(t.trustedSites.duplicateWarning);
      return false;
    }

    const nextTrustedSites = existingSite
      ? trustedSitesRef.current.map((site) =>
          normalizeRulePattern(site.pattern) === normalized
            ? { ...site, enabled: true }
            : site,
        )
      : [...trustedSitesRef.current, { pattern: normalized, enabled: true }];

    if (
      await persistOrRollback(
        nextTrustedSites,
        existingSite ? t.trustedSites.updated : t.trustedSites.saved,
      )
    ) {
      setTrustedSitePattern("");
      return true;
    }

    return false;
  };

  const handleToggleTrustedSite = async (
    pattern: string,
    enabled: boolean,
  ): Promise<void> => {
    const nextTrustedSites = trustedSitesRef.current.map((site) =>
      normalizeRulePattern(site.pattern) === normalizeRulePattern(pattern)
        ? { ...site, enabled }
        : site,
    );

    await persistOrRollback(nextTrustedSites, t.trustedSites.updated);
  };

  const handleDeleteTrustedSite = async (pattern: string): Promise<void> => {
    const nextTrustedSites = trustedSitesRef.current.filter(
      (site) => normalizeRulePattern(site.pattern) !== normalizeRulePattern(pattern),
    );

    await persistOrRollback(nextTrustedSites, t.trustedSites.deleted);
  };

  const handleTrustedSiteSubmit = async (
    event: React.FormEvent<HTMLFormElement>,
  ): Promise<void> => {
    event.preventDefault();

    if (await handleAddTrustedSite()) {
      closeTrustedSiteDialog();
    }
  };

  return {
    closeTrustedSiteDialog,
    handleDeleteTrustedSite,
    handleToggleTrustedSite,
    handleTrustedSiteSubmit,
    openTrustedSiteDialog,
  };
};
