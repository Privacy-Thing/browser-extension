import { useEffect, type RefObject } from "react";

import type { DomainRule, Location } from "@/shared/types";
import {
  getFallbackModalAnchor,
  getLocationAnchorIndex,
  getLocationModalAnchor,
  getRuleForAnchor,
  getRuleModalAnchor,
  isLocationAnchor,
  isRuleAnchor,
} from "@/ui/options/navigation";
import type { AnchorRequest } from "@/ui/options/state/use-settings-anchors";
import type { RuleDialogMode, SettingsTab } from "@/ui/options/utils";
import { normalizeRulePattern } from "@/ui/options/utils";

export type AnchorEffectsOptions = {
  activeTab: SettingsTab;
  anchorRequest: AnchorRequest | null;
  editingProfileIndex: number | null;
  isFallbackDialogOpen: boolean;
  highlightedAnchorId: string | null;
  openFallbackDialog: () => void;
  openProfileEditor: (profileIndex: number) => void;
  openRuleDialog: (rule: DomainRule) => void;
  profileDialogOpened: boolean;
  profiles: readonly Location[];
  rulePattern: string;
  ruleDialogMode: RuleDialogMode;
  ruleDialogOpened: boolean;
  rules: readonly DomainRule[];
  setAnchorRequest: React.Dispatch<React.SetStateAction<AnchorRequest | null>>;
  settingsLoaded: boolean;
  suppressedRuleDialogRef: RefObject<string | null>;
  tabContentReadyVersion: number;
  triggerAnchorHighlight: (anchorId: string) => void;
};

/** Scrolls to the requested anchor, retargeting it when a dialog owns it. */
const useAnchorScrollEffect = ({
  activeTab,
  anchorRequest,
  editingProfileIndex,
  isFallbackDialogOpen,
  highlightedAnchorId,
  profileDialogOpened,
  profiles,
  rulePattern,
  ruleDialogMode,
  ruleDialogOpened,
  rules,
  setAnchorRequest,
  tabContentReadyVersion,
  triggerAnchorHighlight,
}: AnchorEffectsOptions): void => {
  useEffect(() => {
    if (!anchorRequest) {
      return;
    }

    let targetAnchorId = anchorRequest.anchorId;
    if (
      isLocationAnchor(anchorRequest.anchorId) &&
      editingProfileIndex !== null &&
      profiles[editingProfileIndex]
    ) {
      targetAnchorId = getLocationModalAnchor(profiles[editingProfileIndex].id);
    } else if (
      anchorRequest.anchorId === getFallbackModalAnchor() &&
      isFallbackDialogOpen
    ) {
      targetAnchorId = getFallbackModalAnchor();
    } else if (
      isRuleAnchor(anchorRequest.anchorId) &&
      ruleDialogOpened &&
      ruleDialogMode === "edit"
    ) {
      targetAnchorId = getRuleModalAnchor(rulePattern);
    }

    if (
      targetAnchorId !== anchorRequest.anchorId &&
      highlightedAnchorId !== targetAnchorId
    ) {
      triggerAnchorHighlight(targetAnchorId);
    }

    const element = document.getElementById(targetAnchorId);
    if (!element) {
      return;
    }

    element.scrollIntoView({
      behavior: "smooth",
      block: "center",
    });
    setAnchorRequest((current) =>
      current?.nonce === anchorRequest.nonce ? null : current,
    );
  }, [
    anchorRequest,
    activeTab,
    tabContentReadyVersion,
    profiles,
    rules,
    editingProfileIndex,
    profileDialogOpened,
    isFallbackDialogOpen,
    ruleDialogOpened,
    ruleDialogMode,
    rulePattern,
    highlightedAnchorId,
    setAnchorRequest,
    triggerAnchorHighlight,
  ]);
};

/** Opens the dialog that owns the requested anchor, once settings have loaded. */
const useAnchorDialogEffect = ({
  anchorRequest,
  editingProfileIndex,
  isFallbackDialogOpen,
  openFallbackDialog,
  openProfileEditor,
  openRuleDialog,
  profileDialogOpened,
  profiles,
  rulePattern,
  ruleDialogOpened,
  rules,
  setAnchorRequest,
  settingsLoaded,
  suppressedRuleDialogRef,
}: AnchorEffectsOptions): void => {
  useEffect(() => {
    if (!settingsLoaded) {
      return;
    }

    if (!anchorRequest?.anchorId) {
      return;
    }

    const clearAnchorRequest = () => {
      setAnchorRequest((current) =>
        current?.nonce === anchorRequest.nonce ? null : current,
      );
    };

    const handleLocationAnchor = (): boolean => {
      if (!isLocationAnchor(anchorRequest.anchorId)) {
        return false;
      }

      const profileIndex = getLocationAnchorIndex(anchorRequest.anchorId, profiles);
      if (profileIndex === -1) {
        if (profiles.length > 0) {
          clearAnchorRequest();
        }
        return true;
      }

      if (!profileDialogOpened || editingProfileIndex !== profileIndex) {
        openProfileEditor(profileIndex);
      }
      return true;
    };

    const handleRuleAnchorRequest = (): boolean => {
      if (!isRuleAnchor(anchorRequest.anchorId)) {
        return false;
      }

      if (suppressedRuleDialogRef.current === anchorRequest.anchorId) {
        suppressedRuleDialogRef.current = null;
        clearAnchorRequest();
        return true;
      }

      const rule = getRuleForAnchor(anchorRequest.anchorId, rules);
      if (!rule) {
        if (rules.length > 0) {
          clearAnchorRequest();
        }
        return true;
      }

      if (
        !ruleDialogOpened ||
        normalizeRulePattern(rulePattern) !== normalizeRulePattern(rule.pattern)
      ) {
        openRuleDialog(rule);
      }
      return true;
    };

    if (handleLocationAnchor() || handleRuleAnchorRequest()) {
      return;
    }

    if (anchorRequest.anchorId === getFallbackModalAnchor() && !isFallbackDialogOpen) {
      openFallbackDialog();
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps -- openFallbackDialog is a plain function that recreates every render; adding it would cause infinite re-runs
  }, [
    settingsLoaded,
    anchorRequest,
    profiles,
    rules,
    profileDialogOpened,
    editingProfileIndex,
    isFallbackDialogOpen,
    ruleDialogOpened,
    rulePattern,
    setAnchorRequest,
  ]);
};

/**
 * The two effects that translate an anchor request into scrolling and, when the
 * target lives inside a dialog, into opening that dialog.
 *
 * They read across every domain — both collections plus all five dialog-open
 * flags — which is why they are a standalone unit rather than part of any one
 * domain. The dependency arrays above are load-bearing and were moved verbatim:
 * a changed array here fails silently, and only the options-navigation e2e spec
 * would notice.
 */
export const useSettingsAnchorEffects = (options: AnchorEffectsOptions): void => {
  useAnchorScrollEffect(options);
  useAnchorDialogEffect(options);
};
