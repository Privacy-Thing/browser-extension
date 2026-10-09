import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";

import type { ProviderFeature, ProviderFeatureMatch } from "./model";
import {
  ProviderFeaturePanel,
  type ProviderFeatureProps,
} from "./ProviderFeaturePanel";

const youtube: ProviderFeature = {
  providerId: "provider",
  featureId: "youtube",
  type: "service",
  name: "YouTube",
};

const matched: ProviderFeatureMatch = {
  hostname: "www.youtube.com",
  providerId: "provider",
  featureId: "youtube",
  matchSource: "domain-test",
  status: "matched",
  checkedAt: "2026-10-09T12:00:00.000Z",
};

const noop = () => undefined;

const render = (overrides: Partial<ProviderFeatureProps> = {}) =>
  renderToStaticMarkup(
    createElement(ProviderFeaturePanel, {
      providerName: "Example DNS",
      hostname: "www.youtube.com",
      rulePattern: "*.youtube.com",
      features: [youtube],
      match: matched,
      binding: null,
      busy: false,
      dismissed: false,
      syncStatus: "queued",
      onRecognize: noop,
      onConfirm: noop,
      onDismiss: noop,
      onDetach: noop,
      ...overrides,
    }),
  );

const actions = (markup: string) =>
  [...markup.matchAll(/data-provider-feature-action="([^"]+)"/g)].map((m) => m[1]);

describe("ProviderFeaturePanel", () => {
  it("offers confirm, another feature and dismiss for a suggestion", () => {
    const markup = render();
    expect(markup).toContain('data-provider-feature-view="suggested"');
    expect(markup).toContain("Matched to YouTube · Example DNS");
    expect(actions(markup)).toEqual(["confirm", "choose", "dismiss"]);
  });

  it("keeps evidence, local protection and provider sync in separate sections", () => {
    const markup = render();
    expect(markup).toContain('data-provider-feature-section="evidence"');
    expect(markup).toContain('data-provider-feature-section="local"');
    expect(markup).toContain('data-provider-feature-sync="none"');
    expect(markup).toContain('data-provider-feature-rule-pattern="*.youtube.com"');
  });

  it("describes the provider-native scope without widening the local rule", () => {
    const markup = render();
    const confirm = /<button[^>]*data-provider-feature-action="confirm"[^>]*>/.exec(
      markup,
    );
    expect(confirm?.[0]).toContain("aria-describedby=");
    expect(markup).toContain("Example DNS decides which domains it covers");
    expect(markup).toContain("protection still applies only to *.youtube.com");
  });

  it("shows sync state and detach once bound", () => {
    const markup = render({
      binding: {
        rulePattern: "*.youtube.com",
        providerId: "provider",
        featureId: "youtube",
        featureName: "YouTube",
        featureType: "service",
      },
      syncStatus: "synced",
    });
    expect(markup).toContain('data-provider-feature-view="bound"');
    expect(markup).toContain('data-provider-feature-sync="synced"');
    expect(actions(markup)).toEqual(["choose", "detach"]);
  });

  it("disables every action while busy", () => {
    const markup = render({
      match: { ...matched, status: "error", featureId: null },
      busy: true,
    });
    expect(markup).toContain('data-provider-feature-busy="true"');
    expect(markup.match(/<button[^>]*disabled=""/g)).toHaveLength(
      actions(markup).length,
    );
  });
});
