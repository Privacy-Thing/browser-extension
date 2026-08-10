import { describe, expect, it } from "vitest";

import {
  FALLBACK_MODAL_ANCHOR,
  HASH_QUERY_KEYS,
  PAGE_ANCHORS,
  SETTINGS_SUBPAGE_ANCHORS,
  SECTION_ANCHORS,
  SETTING_ANCHORS,
  getContainerAnchor,
  getLocationAnchor,
  getLogsPageUrl,
  getRulesLocationHref,
  getRuleAnchor,
  parseSettingsHash,
} from "@/ui/options/navigation";

const parsedHash = (
  expected: Omit<
    ReturnType<typeof parseSettingsHash>,
    "settingsSubpageView" | "logsHostFilter"
  > & {
    settingsSubpageView?: ReturnType<typeof parseSettingsHash>["settingsSubpageView"];
    logsHostFilter?: string | null;
  },
) => ({
  settingsSubpageView: "none",
  logsHostFilter: null,
  ...expected,
});

describe("parseSettingsHash", () => {
  it("returns the default tab for an empty hash", () => {
    expect(parseSettingsHash("")).toEqual(
      parsedHash({
        activeTab: "rules",
        anchorId: null,
        isKnownAnchor: false,
        linkedRuleLocationId: null,
      }),
    );
  });

  it("resolves static section anchors to their tab", () => {
    expect(parseSettingsHash(`#${SECTION_ANCHORS.advanced.danger}`)).toEqual(
      parsedHash({
        activeTab: "advanced",
        anchorId: SECTION_ANCHORS.advanced.danger,
        isKnownAnchor: true,
        linkedRuleLocationId: null,
      }),
    );
  });

  it("resolves options anchors to the options tab", () => {
    expect(parseSettingsHash(`#${SECTION_ANCHORS.options.surfaces}`)).toEqual(
      parsedHash({
        activeTab: "options",
        anchorId: SECTION_ANCHORS.options.surfaces,
        isKnownAnchor: true,
        linkedRuleLocationId: null,
      }),
    );
  });

  it("keeps moved Options sections on the options tab", () => {
    expect(parseSettingsHash(`#${SECTION_ANCHORS.options.privacy}`)).toEqual(
      parsedHash({
        activeTab: "options",
        anchorId: SECTION_ANCHORS.options.privacy,
        isKnownAnchor: true,
        linkedRuleLocationId: null,
      }),
    );
  });

  it("keeps moved Options setting anchors on the options tab", () => {
    expect(parseSettingsHash(`#${SETTING_ANCHORS.advanced.themeMode}`)).toEqual(
      parsedHash({
        activeTab: "options",
        anchorId: SETTING_ANCHORS.advanced.themeMode,
        isKnownAnchor: true,
        linkedRuleLocationId: null,
      }),
    );
    expect(
      parseSettingsHash(`#${SETTING_ANCHORS.advanced.defaultNoiseRadius}`),
    ).toEqual(
      parsedHash({
        activeTab: "options",
        anchorId: SETTING_ANCHORS.advanced.defaultNoiseRadius,
        isKnownAnchor: true,
        linkedRuleLocationId: null,
      }),
    );
    expect(
      parseSettingsHash(`#${SETTING_ANCHORS.advanced.watchPositionDelay}`),
    ).toEqual(
      parsedHash({
        activeTab: "options",
        anchorId: SETTING_ANCHORS.advanced.watchPositionDelay,
        isKnownAnchor: true,
        linkedRuleLocationId: null,
      }),
    );
    expect(
      parseSettingsHash(`#${SETTING_ANCHORS.advanced.sharedWorkerCompatibilityMode}`),
    ).toEqual(
      parsedHash({
        activeTab: "options",
        anchorId: SETTING_ANCHORS.options.sharedWorkerHandlingMode,
        isKnownAnchor: true,
        linkedRuleLocationId: null,
      }),
    );
  });

  it("resolves location anchors to the profiles tab", () => {
    const anchorId = getLocationAnchor("warsaw");

    expect(parseSettingsHash(`#${anchorId}`)).toEqual(
      parsedHash({
        activeTab: "profiles",
        anchorId,
        isKnownAnchor: true,
        linkedRuleLocationId: null,
      }),
    );
  });

  it("resolves normalized rule anchors to the rules tab", () => {
    const anchorId = getRuleAnchor("*.Example.com");

    expect(anchorId).toMatch(/^rule-/);
    expect(parseSettingsHash(`#${anchorId}`)).toEqual(
      parsedHash({
        activeTab: "rules",
        anchorId,
        isKnownAnchor: true,
        linkedRuleLocationId: null,
      }),
    );
  });

  it("resolves the default-rule modal anchor to the rules tab", () => {
    expect(parseSettingsHash(`#${FALLBACK_MODAL_ANCHOR}`)).toEqual(
      parsedHash({
        activeTab: "rules",
        anchorId: FALLBACK_MODAL_ANCHOR,
        isKnownAnchor: true,
        linkedRuleLocationId: null,
      }),
    );
  });

  it("resolves container anchors to the containers tab", () => {
    const anchorId = getContainerAnchor("firefox-container-1");

    expect(parseSettingsHash(`#${anchorId}`)).toEqual(
      parsedHash({
        activeTab: "containers",
        anchorId,
        isKnownAnchor: true,
        linkedRuleLocationId: null,
      }),
    );
  });

  it("resolves page anchors to their tab", () => {
    expect(parseSettingsHash(`#${PAGE_ANCHORS.rules}`)).toEqual(
      parsedHash({
        activeTab: "rules",
        anchorId: PAGE_ANCHORS.rules,
        isKnownAnchor: true,
        linkedRuleLocationId: null,
      }),
    );
  });

  it("resolves the playground page anchor", () => {
    expect(parseSettingsHash(`#${PAGE_ANCHORS.playground}`)).toEqual(
      parsedHash({
        activeTab: "playground",
        anchorId: PAGE_ANCHORS.playground,
        isKnownAnchor: true,
        linkedRuleLocationId: null,
      }),
    );
  });

  it("resolves the logs page anchor as an advanced subview", () => {
    expect(parseSettingsHash(`#${SETTINGS_SUBPAGE_ANCHORS.logs}`)).toEqual(
      parsedHash({
        activeTab: "advanced",
        settingsSubpageView: "logs",
        anchorId: SETTINGS_SUBPAGE_ANCHORS.logs,
        isKnownAnchor: true,
        linkedRuleLocationId: null,
      }),
    );
  });

  it("resolves the privacy policy page anchor as an about subview", () => {
    expect(parseSettingsHash(`#${SETTINGS_SUBPAGE_ANCHORS.privacyPolicy}`)).toEqual(
      parsedHash({
        activeTab: "about",
        settingsSubpageView: "privacyPolicy",
        anchorId: SETTINGS_SUBPAGE_ANCHORS.privacyPolicy,
        isKnownAnchor: true,
        linkedRuleLocationId: null,
      }),
    );
  });

  it("resolves the third-party notices page anchor as an about subview", () => {
    expect(parseSettingsHash(`#${SETTINGS_SUBPAGE_ANCHORS.thirdPartyNotices}`)).toEqual(
      parsedHash({
        activeTab: "about",
        settingsSubpageView: "thirdPartyNotices",
        anchorId: SETTINGS_SUBPAGE_ANCHORS.thirdPartyNotices,
        isKnownAnchor: true,
        linkedRuleLocationId: null,
      }),
    );
  });

  it("resolves the license page anchor as an about subview", () => {
    expect(parseSettingsHash(`#${SETTINGS_SUBPAGE_ANCHORS.license}`)).toEqual(
      parsedHash({
        activeTab: "about",
        settingsSubpageView: "license",
        anchorId: SETTINGS_SUBPAGE_ANCHORS.license,
        isKnownAnchor: true,
        linkedRuleLocationId: null,
      }),
    );
  });

  it("parses linked rules location ids from hash query params", () => {
    expect(parseSettingsHash(getRulesLocationHref("warsaw"))).toEqual(
      parsedHash({
        activeTab: "rules",
        anchorId: PAGE_ANCHORS.rules,
        isKnownAnchor: true,
        linkedRuleLocationId: "warsaw",
      }),
    );
  });

  it("ignores linked rules params for unknown anchors", () => {
    expect(
      parseSettingsHash(
        `#something-else?${HASH_QUERY_KEYS.linkedRuleLocationId}=warsaw`,
      ),
    ).toEqual(
      parsedHash({
        activeTab: "rules",
        anchorId: null,
        isKnownAnchor: false,
        linkedRuleLocationId: null,
      }),
    );
  });

  it("treats unknown anchors as the default view", () => {
    expect(parseSettingsHash("#something-else")).toEqual(
      parsedHash({
        activeTab: "rules",
        anchorId: null,
        isKnownAnchor: false,
        linkedRuleLocationId: null,
      }),
    );
  });

  it("parses logsHostFilter from the logs page hash", () => {
    expect(
      parseSettingsHash(`#${SETTINGS_SUBPAGE_ANCHORS.logs}?host=example.com`),
    ).toEqual(
      parsedHash({
        activeTab: "advanced",
        settingsSubpageView: "logs",
        anchorId: SETTINGS_SUBPAGE_ANCHORS.logs,
        isKnownAnchor: true,
        linkedRuleLocationId: null,
        logsHostFilter: "example.com",
      }),
    );
  });

  it("ignores logsHostFilter on non-logs anchors", () => {
    expect(parseSettingsHash(`#${PAGE_ANCHORS.rules}?host=example.com`)).toEqual(
      parsedHash({
        activeTab: "rules",
        anchorId: PAGE_ANCHORS.rules,
        isKnownAnchor: true,
        linkedRuleLocationId: null,
        logsHostFilter: null,
      }),
    );
  });
});

describe("getLogsPageUrl", () => {
  it("returns a plain logs URL without a filter", () => {
    const url = getLogsPageUrl();
    expect(url).toContain("page-logs");
    expect(url).not.toContain("host=");
  });

  it("includes host query param when a filter is provided", () => {
    const url = getLogsPageUrl("example.com");
    expect(url).toContain("page-logs");
    expect(url).toContain("host=example.com");
  });
});
