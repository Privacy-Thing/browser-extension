import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";

import { controlDFeatureUi } from "./ui-rule-feature-presentation";

import type {
  FeatureSyncContext,
  ProviderFeatureState,
} from "@/shared/provider-feature";

const renderNotice = (status: FeatureSyncContext["state"]): string => {
  const state: ProviderFeatureState = {
    available: true,
    providerId: "control-d",
    providerName: "Control D",
    features: [],
    match: null,
    binding: null,
    dismissed: false,
    syncStatus: "ready",
    error: null,
    syncContext: {
      state: status,
      presetName: "Warsaw",
      settingsPath:
        "src/ui/options/index.html#page-experimental-integration?section=routes&preset=warsaw",
    },
  };
  return renderToStaticMarkup(
    createElement(
      "div",
      null,
      controlDFeatureUi.renderStatus?.({ state, locale: "en" }),
    ),
  );
};

describe("Control D rule synchronization guidance", () => {
  it("explains the proxy location and names the setting to change", () => {
    const markup = renderNotice("pending");
    expect(markup).toContain("proxy location (city/country)");
    expect(markup).toContain("before this rule can sync");
    expect(markup).toContain("Control D settings → Route overrides");
    expect(markup).toContain("section=routes&amp;preset=warsaw");
    expect(markup).not.toContain("{link}");
  });
  it("states that managed redirects are removed from the Control D profile", () => {
    const markup = renderNotice("disabled");
    expect(markup).toContain("On the next sync");
    expect(markup).toContain("from the Control D profile");
    expect(markup).toContain("managed redirects for this rule");
  });
  it("offers a concrete way to include an excluded preset", () => {
    const markup = renderNotice("excluded");
    expect(markup).toContain("To include it, choose a redirect location");
    expect(markup).toContain("Control D settings → Route overrides");
    expect(markup).not.toContain("{preset}");
  });
  it("does not describe the draft preset as the joined rule's sync configuration", () => {
    const state: ProviderFeatureState = {
      available: true,
      providerId: "control-d",
      providerName: "Control D",
      features: [],
      match: null,
      binding: null,
      dismissed: false,
      syncStatus: "ready",
      error: null,
      syncContext: { state: "excluded", presetName: "Draft preset" },
    };
    const context = {
      feature: {
        providerId: "control-d",
        featureId: "video",
        type: "service" as const,
        name: "Video",
      },
      isJoin: true,
      state,
      locale: "en" as const,
    };
    const render = (isStaged: boolean) =>
      renderToStaticMarkup(
        createElement(
          "div",
          null,
          controlDFeatureUi.renderExplanation({ ...context, isStaged }),
        ),
      );
    expect(render(false)).not.toContain("Draft preset");
    expect(render(false)).not.toContain("data-plugin-sync-context");
    expect(render(true)).toContain("data-plugin-sync-context");
  });
});
