import { describe, expect, it, vi } from "vitest";

import { buildEffectiveSummary } from "@/background/popup-effective-summary";
import type { PopupState } from "@/shared/types";
import { getPopupFooterActions } from "@/ui/popup/popup-footer-actions";

const createPopupState = (
  overrides: Partial<Omit<PopupState, "currentRule" | "currentTab">> & {
    currentRule?: Partial<PopupState["currentRule"]>;
    currentTab?: Partial<PopupState["currentTab"]>;
  } = {},
): PopupState => {
  const { currentRule, currentTab, ...rest } = overrides;

  return {
    panicMode: false,
    effectiveSummary: buildEffectiveSummary({
      generation: 1,
      source: "none",
      pattern: null,
      enabled: null,
      editable: false,
      toggleable: false,
      panicMode: false,
      supported: true,
      snapshot: null,
      suggestions: [],
      attentionKinds: [],
    }),
    availableLocations: [
      { id: "warsaw", label: "Warsaw", language: "pl", languages: ["pl", "en"] },
    ],
    currentRule: {
      pattern: null,
      enabled: null,
      type: null,
      canToggle: false,
      canEdit: false,
      isExplicit: false,
      blockServiceWorkerRegistration: false,
      regionalPresetEnabled: true,
      relaxCspForWorkers: false,
      ...currentRule,
    },
    currentTab: {
      supported: true,
      hostname: "example.com",
      url: "https://example.com",
      locationLabel: null,
      locationId: null,
      locationProfileActive: false,
      fallbackState: "disabled",
      matchedRulePattern: null,
      hasExactRule: false,
      canCleanDomain: true,
      pendingRulePattern: "example.com",
      hasMatch: false,
      activeContainer: null,
      winningSource: "none",
      firefoxFirstInlinePermissionRequired: false,
      firefoxFirstInlineEnabled: false,
      ...currentTab,
    },
    suggestions: [],
    hasSuggestionWarning: false,
    notifications: [],
    hasUnreadNotification: false,
    ...rest,
  };
};

describe("getPopupFooterActions", () => {
  it("describes the site activity shown by X-Ray", () => {
    const actions = getPopupFooterActions({
      popupState: createPopupState(),
      supported: true,
      onOpenXRay: vi.fn(),
      onOpenNewIdentity: vi.fn(),
      onOpenOptions: vi.fn(),
    });

    expect(actions.find((action) => action.id === "open-xray")).toMatchObject({
      label: "X-Ray",
      title: "See this site’s activity in X-Ray",
      disabled: false,
    });
  });

  it("disables New identity with the Default Rule-specific tooltip", () => {
    const actions = getPopupFooterActions({
      popupState: createPopupState(),
      supported: true,
      onOpenXRay: vi.fn(),
      onOpenNewIdentity: vi.fn(),
      onOpenOptions: vi.fn(),
    });

    expect(
      actions.find((action) => action.id === "new-identity-current-domain"),
    ).toMatchObject({
      title:
        "Unavailable for the Default Rule. New identity works with a Domain Rule or configured Firefox Container.",
      ariaLabel:
        "Unavailable for the Default Rule. New identity works with a Domain Rule or configured Firefox Container.",
      disabled: true,
    });
  });

  it("keeps New identity enabled for an active domain rule", () => {
    const actions = getPopupFooterActions({
      popupState: createPopupState({
        currentRule: {
          pattern: "example.com",
          enabled: true,
          type: "exact",
          canToggle: true,
          canEdit: true,
          isExplicit: true,
        },
        currentTab: {
          hasMatch: true,
          winningSource: "rule",
        },
      }),
      supported: true,
      onOpenXRay: vi.fn(),
      onOpenNewIdentity: vi.fn(),
      onOpenOptions: vi.fn(),
    });

    expect(
      actions.find((action) => action.id === "new-identity-current-domain"),
    ).toMatchObject({
      title: "Create a new identity for this site",
      ariaLabel: "Create a new identity for this site",
      disabled: false,
    });
  });

  it("disables New identity when the Default Rule is the active source", () => {
    const actions = getPopupFooterActions({
      popupState: createPopupState({
        currentTab: {
          locationLabel: "Warsaw",
          locationId: "warsaw",
          locationProfileActive: true,
          fallbackState: "active",
          hasMatch: true,
          winningSource: "fallback",
        },
      }),
      supported: true,
      onOpenXRay: vi.fn(),
      onOpenNewIdentity: vi.fn(),
      onOpenOptions: vi.fn(),
    });

    expect(
      actions.find((action) => action.id === "new-identity-current-domain"),
    ).toMatchObject({
      title:
        "Unavailable for the Default Rule. New identity works with a Domain Rule or configured Firefox Container.",
      ariaLabel:
        "Unavailable for the Default Rule. New identity works with a Domain Rule or configured Firefox Container.",
      disabled: true,
    });
  });

  it("keeps Settings available while the popup is loading or unsupported", () => {
    const actions = getPopupFooterActions({
      popupState: createPopupState({
        availableLocations: [],
        currentTab: { supported: false },
      }),
      supported: false,
      onOpenXRay: vi.fn(),
      onOpenNewIdentity: vi.fn(),
      onOpenOptions: vi.fn(),
    });

    expect(actions.find((action) => action.id === "open-options")).toMatchObject({
      disabled: false,
    });
  });
});
