// @vitest-environment jsdom

import { act, createElement, type ReactNode } from "react";
import { createRoot, type Root } from "react-dom/client";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { TrustedSitesTab, buildRulesCta } from "./TrustedSitesTab";

import { Tabs } from "@/ui/components/ui/tabs";
import { getTrustedSiteAnchor, SECTION_ANCHORS } from "@/ui/options/navigation";
import { useSettings } from "@/ui/options/state/SettingsContext";

vi.mock("@/ui/components/SettingsHelpCard", () => ({
  SettingsHelpCard: ({ children }: { children?: ReactNode }) =>
    createElement("div", null, children),
}));

vi.mock("@/ui/components/SettingsSectionCard", () => ({
  SettingsSectionCard: ({ children }: { children?: ReactNode }) =>
    createElement("div", null, children),
}));

vi.mock("@/ui/options/components/RuleInspectorCard", () => ({
  RuleInspectorCard: () => null,
}));

vi.mock("@/ui/options/state/SettingsContext", () => ({
  useSettings: vi.fn(),
}));

const useSettingsMock = vi.mocked(useSettings);

const flushEffects = async (): Promise<void> => {
  // Drain microtasks inside act() — this tab uses no real timers, so ordered
  // promise flushes settle effects deterministically without wall-clock waits.
  await act(async () => {
    for (let tick = 0; tick < 5; tick += 1) {
      await Promise.resolve();
    }
  });
};

const renderWithRoot = async (node: ReactNode): Promise<Root> => {
  document.body.innerHTML = '<div id="root"></div>';
  const container = document.getElementById("root");
  if (!container) {
    throw new Error("Missing test root.");
  }

  const root = createRoot(container);
  await act(async () => {
    root.render(node);
  });
  await flushEffects();
  return root;
};

describe("buildRulesCta", () => {
  it("returns null when no enabled rules or Default Rule remain active elsewhere", () => {
    expect(
      buildRulesCta({
        activeRuleCount: 0,
        hasEnabledGlobalFallback: false,
      }),
    ).toBeNull();
  });

  it("points to the Domain Rules table when enabled domain rules still apply elsewhere", () => {
    expect(
      buildRulesCta({
        activeRuleCount: 2,
        hasEnabledGlobalFallback: true,
      }),
    ).toEqual({
      title: "Protection on other sites",
      description:
        "2 enabled Domain Rules apply outside Trusted Sites. The Default Rule also covers other unmatched sites.",
      actionLabel: "Open Domain Rules",
      targetAnchorId: SECTION_ANCHORS.rules.overview,
    });
  });

  it("points to the Default Rule row when only fallback coverage remains active", () => {
    expect(
      buildRulesCta({
        activeRuleCount: 0,
        hasEnabledGlobalFallback: true,
      }),
    ).toEqual({
      title: "Protection on other sites",
      description:
        "The Default Rule still applies to unmatched sites. Trusted Sites disable Privacy Thing only on matching hosts.",
      actionLabel: "Open Default Rule",
      targetAnchorId: SECTION_ANCHORS.rules.globalFallback,
    });
  });
});

describe("TrustedSitesTab", () => {
  let root: Root | null = null;

  beforeEach(() => {
    Object.defineProperty(globalThis, "IS_REACT_ACT_ENVIRONMENT", {
      configurable: true,
      value: true,
    });
    useSettingsMock.mockReturnValue({
      rules: [],
      globalFallbackRule: undefined,
      trustedSitesFilter: "",
      setTrustedSitesFilter: vi.fn(),
      filteredTrustedSites: [
        {
          pattern: "billing.example.com",
          enabled: false,
        },
      ],
      openTrustedSiteDialog: vi.fn(),
      handleToggleTrustedSite: vi.fn(),
      handleDeleteTrustedSite: vi.fn(),
      highlightedAnchorId: null,
      navigateToAnchor: vi.fn(),
      saveInFlight: false,
    } as never);
  });

  afterEach(async () => {
    if (root) {
      const currentRoot = root;
      root = null;
      await act(async () => {
        currentRoot.unmount();
      });
    }

    document.body.innerHTML = "";
    Reflect.deleteProperty(globalThis, "IS_REACT_ACT_ENVIRONMENT");
    vi.clearAllMocks();
  });

  it("shows only the status toggle and inactive badge for disabled rows", async () => {
    root = await renderWithRoot(
      createElement(
        Tabs,
        { defaultValue: "trusted-sites" },
        createElement(TrustedSitesTab),
      ),
    );

    const row = document.getElementById(getTrustedSiteAnchor("billing.example.com"));
    expect(row?.textContent).not.toContain("Inactive");
    expect(row?.textContent).not.toContain("Enabled");
    expect(row?.textContent).toContain("inactive");
    expect(row?.querySelector('[role="switch"]')?.getAttribute("aria-label")).toBe(
      "Enable trusted site billing.example.com",
    );
  });
});
