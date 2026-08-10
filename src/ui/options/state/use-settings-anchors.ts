import { useCallback, useEffect, useRef, useState } from "react";

import {
  getAnchorUrl,
  getTabAnchor,
  getRulesLocationHref,
  isPageAnchor,
  parseSettingsHash,
} from "@/ui/options/navigation";
import type { SettingsTab } from "@/ui/options/utils";

/** A pending request to scroll to (and if needed reveal) one anchor. */
export type AnchorRequest = {
  anchorId: string;
  nonce: number;
};

type HashListenerOptions = {
  setActiveTab: React.Dispatch<React.SetStateAction<SettingsTab>>;
  setAnchorRequest: React.Dispatch<React.SetStateAction<AnchorRequest | null>>;
  setHighlightedAnchorId: React.Dispatch<React.SetStateAction<string | null>>;
  setLinkedRuleLocationId: React.Dispatch<React.SetStateAction<string | null>>;
  setSettingsSubpageView: React.Dispatch<
    React.SetStateAction<ReturnType<typeof parseSettingsHash>["settingsSubpageView"]>
  >;
  triggerAnchorHighlight: (anchorId: string) => void;
};

const useHashListeners = ({
  setActiveTab,
  setAnchorRequest,
  setHighlightedAnchorId,
  setLinkedRuleLocationId,
  setSettingsSubpageView,
  triggerAnchorHighlight,
}: HashListenerOptions): void => {
  useEffect(() => {
    const handleHashChange = (): void => {
      const parsed = parseSettingsHash(window.location.hash);
      setActiveTab(parsed.activeTab);
      setSettingsSubpageView(parsed.settingsSubpageView);
      setLinkedRuleLocationId(parsed.linkedRuleLocationId);
      if (parsed.anchorId && !isPageAnchor(parsed.anchorId)) {
        setAnchorRequest({ anchorId: parsed.anchorId, nonce: Date.now() });
        triggerAnchorHighlight(parsed.anchorId);
      } else {
        setAnchorRequest(null);
        setHighlightedAnchorId(null);
      }
    };
    window.addEventListener("hashchange", handleHashChange);
    window.addEventListener("popstate", handleHashChange);
    return () => {
      window.removeEventListener("hashchange", handleHashChange);
      window.removeEventListener("popstate", handleHashChange);
    };
  }, [
    setActiveTab,
    setAnchorRequest,
    setHighlightedAnchorId,
    setLinkedRuleLocationId,
    setSettingsSubpageView,
    triggerAnchorHighlight,
  ]);
};

const useHighlightLifecycle = ({
  initialAnchorId,
  setHighlightedAnchorId,
  timerRef,
}: {
  initialAnchorId: string | null;
  setHighlightedAnchorId: React.Dispatch<React.SetStateAction<string | null>>;
  timerRef: React.RefObject<ReturnType<typeof setTimeout> | null>;
}): void => {
  useEffect(() => {
    if (!initialAnchorId || isPageAnchor(initialAnchorId)) return;
    timerRef.current = setTimeout(() => {
      setHighlightedAnchorId((current) =>
        current === initialAnchorId ? null : current,
      );
      timerRef.current = null;
    }, 2700);
  }, [initialAnchorId, setHighlightedAnchorId, timerRef]);
  useEffect(
    () => () => {
      if (timerRef.current) clearTimeout(timerRef.current);
    },
    [timerRef],
  );
};

export const useSettingsAnchors = () => {
  const initialHashState = parseSettingsHash(window.location.hash);
  const [activeTab, setActiveTab] = useState<SettingsTab>(initialHashState.activeTab);
  const [settingsSubpageView, setSettingsSubpageView] = useState(
    initialHashState.settingsSubpageView,
  );
  const [linkedRuleLocationId, setLinkedRuleLocationId] = useState<string | null>(
    initialHashState.linkedRuleLocationId,
  );
  const [logsHostFilter] = useState<string | null>(initialHashState.logsHostFilter);
  const [anchorRequest, setAnchorRequest] = useState<AnchorRequest | null>(() =>
    initialHashState.anchorId && !isPageAnchor(initialHashState.anchorId)
      ? { anchorId: initialHashState.anchorId, nonce: Date.now() }
      : null,
  );
  const [highlightedAnchorId, setHighlightedAnchorId] = useState<string | null>(
    initialHashState.anchorId && !isPageAnchor(initialHashState.anchorId)
      ? initialHashState.anchorId
      : null,
  );
  const anchorHighlightTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const initialAnchorIdRef = useRef(initialHashState.anchorId);
  useHighlightLifecycle({
    initialAnchorId: initialAnchorIdRef.current,
    setHighlightedAnchorId,
    timerRef: anchorHighlightTimerRef,
  });

  const triggerAnchorHighlight = useCallback((anchorId: string): void => {
    if (anchorHighlightTimerRef.current) {
      clearTimeout(anchorHighlightTimerRef.current);
    }

    setHighlightedAnchorId(anchorId);
    anchorHighlightTimerRef.current = setTimeout(() => {
      setHighlightedAnchorId((current) => (current === anchorId ? null : current));
      anchorHighlightTimerRef.current = null;
    }, 2700);
  }, []);

  const navigateToAnchor = useCallback(
    (
      anchorId: string,
      options: { replace?: boolean; highlight?: boolean } = {},
    ): void => {
      const { replace = false, highlight = true } = options;
      const nextHash = `#${anchorId}`;
      const parsed = parseSettingsHash(nextHash);

      setActiveTab(parsed.activeTab);
      setSettingsSubpageView(parsed.settingsSubpageView);
      setLinkedRuleLocationId(parsed.linkedRuleLocationId);
      setAnchorRequest(isPageAnchor(anchorId) ? null : { anchorId, nonce: Date.now() });

      if (highlight && !isPageAnchor(anchorId)) {
        triggerAnchorHighlight(anchorId);
      }

      if (window.location.hash === nextHash) {
        return;
      }

      if (replace) {
        window.history.replaceState(null, "", nextHash);
        return;
      }

      window.history.pushState(null, "", nextHash);
    },
    [triggerAnchorHighlight],
  );

  const copyAnchorLink = useCallback(
    async (anchorId: string): Promise<void> => {
      const url = getAnchorUrl(anchorId);

      try {
        await navigator.clipboard.writeText(url);
      } catch {
        const input = document.createElement("input");
        input.value = url;
        document.body.appendChild(input);
        input.select();
        document.execCommand("copy");
        document.body.removeChild(input);
      }

      navigateToAnchor(anchorId, { replace: true, highlight: true });
    },
    [navigateToAnchor],
  );

  const setRuleLocationFilter = useCallback((locationId: string | null): void => {
    const nextHash = locationId
      ? getRulesLocationHref(locationId)
      : `#${getTabAnchor("rules")}`;
    const parsed = parseSettingsHash(nextHash);

    setActiveTab(parsed.activeTab);
    setSettingsSubpageView(parsed.settingsSubpageView);
    setLinkedRuleLocationId(parsed.linkedRuleLocationId);
    setAnchorRequest(null);
    setHighlightedAnchorId(null);

    if (window.location.hash === nextHash) {
      return;
    }

    window.history.replaceState(null, "", nextHash);
  }, []);

  useHashListeners({
    setActiveTab,
    setAnchorRequest,
    setHighlightedAnchorId,
    setLinkedRuleLocationId,
    setSettingsSubpageView,
    triggerAnchorHighlight,
  });

  return {
    activeTab,
    setActiveTab,
    settingsSubpageView,
    setSettingsSubpageView,
    linkedRuleLocationId,
    setLinkedRuleLocationId,
    setRuleLocationFilter,
    anchorRequest,
    setAnchorRequest,
    highlightedAnchorId,
    triggerAnchorHighlight,
    navigateToAnchor,
    copyAnchorLink,
    logsHostFilter,
  };
};
