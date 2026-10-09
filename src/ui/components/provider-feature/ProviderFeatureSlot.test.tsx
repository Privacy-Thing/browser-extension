import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";

import { resolveSlot, type ProviderFeature, type SlotInput } from "./model";
import { providerFeatureCopy } from "./provider-feature-copy";
import { ProviderDecoratorBadge } from "./ProviderDecoratorBadge";
import {
  ProviderFeatureSlot,
  type ProviderFeatureSlotProps,
} from "./ProviderFeatureSlot";

import { BRAND_DISPLAY_NAME } from "@/shared/brand";

const youtube: ProviderFeature = {
  providerId: "provider",
  featureId: "youtube",
  type: "service",
  name: "YouTube",
};

const baseInput = (overrides: Partial<SlotInput> = {}): SlotInput => ({
  available: true,
  providerId: "provider",
  providerName: "Example DNS",
  initials: "ED",
  features: [youtube],
  bindings: [],
  binding: null,
  match: {
    hostname: "www.youtube.com",
    providerId: "provider",
    featureId: "youtube",
    matchSource: "domain-test",
    status: "matched",
    checkedAt: "2026-10-09T12:00:00.000Z",
  },
  dismissed: false,
  recognizing: false,
  identityPattern: "www.youtube.com",
  decision: undefined,
  declinedId: null,
  ...overrides,
});

const noop = () => undefined;

const render = (
  overrides: Partial<SlotInput> = {},
  props: Partial<ProviderFeatureSlotProps> = {},
) => {
  const model = resolveSlot(baseInput(overrides));
  return renderToStaticMarkup(
    createElement(ProviderFeatureSlot, {
      model,
      copy: providerFeatureCopy.en,
      features: [youtube],
      removing: false,
      joinFor: () => null,
      onAccept: noop,
      onDecline: noop,
      onJoin: noop,
      onChoose: noop,
      onDetach: noop,
      onClear: noop,
      ...props,
    }),
  );
};

describe("ProviderFeatureSlot", () => {
  it("offers yes and no with a scope note for a suggestion", () => {
    const markup = render();
    expect(markup).toContain('data-provider-feature-state="suggest"');
    expect(markup).toContain('data-provider-initials="ED"');
    expect(markup).toContain("Link YouTube service?");
    expect(markup).toContain('data-provider-feature-action="accept"');
    expect(markup).toContain('data-provider-feature-action="decline"');
    expect(markup).toContain("bg-secondary");
    expect(markup).toContain(BRAND_DISPLAY_NAME);
    expect(markup).toContain("protects only this rule");
    expect(markup).not.toContain(">CD<");
    expect(markup).not.toContain("Control D");
  });

  it("explains that joining adopts the existing group", () => {
    const markup = render(
      {
        identityPattern: "music.youtube.com",
        bindings: [
          {
            rulePattern: "www.youtube.com",
            providerId: "provider",
            featureId: "youtube",
            featureName: "YouTube",
            featureType: "service",
          },
        ],
      },
      {
        joinFor: () => ({ pattern: "www.youtube.com", extra: 0 }),
      },
    );
    expect(markup).toContain('data-provider-feature-state="join"');
    expect(markup).toContain("Join YouTube?");
    expect(markup).toContain("Uses the settings and identity of www.youtube.com.");
    expect(markup).toContain("current settings will be replaced");
    expect(markup).toContain('data-provider-feature-action="join"');
  });

  it("shows a dashed staged chip and a linked chip with a count", () => {
    const staged = render({
      decision: { providerId: "provider", featureId: "youtube" },
    });
    expect(staged).toContain('data-provider-feature-state="staged"');
    expect(staged).toContain("YouTube · unsaved");
    expect(staged).toContain("data-provider-feature-chevron");
    expect(staged).toContain('data-provider-feature-chip="staged"');

    const linked = render({
      binding: {
        rulePattern: "www.youtube.com",
        rulePatterns: ["www.youtube.com", "m.youtube.com", "music.youtube.com"],
        providerId: "provider",
        featureId: "youtube",
        featureName: "YouTube",
        featureType: "service",
      },
    });
    expect(linked).toContain('data-provider-feature-state="linked"');
    expect(linked).toContain('data-provider-feature-group-size="3"');
    expect(linked).toContain('data-provider-feature-count="2"');
    expect(linked).toContain(">+2<");
    expect(linked).not.toContain("Match evidence");
    expect(linked).not.toContain('data-provider-feature-action="recognize"');
  });

  it("uses a quiet add chip after decline and while removing a bound service", () => {
    const declined = render({ declinedId: "youtube" });
    expect(declined).toContain('data-provider-feature-state="manual"');
    expect(declined).toContain("Link a service");
    expect(declined).not.toContain("data-provider-feature-pending");

    const unbound = render({
      decision: { providerId: "provider", featureId: null },
    });
    expect(unbound).not.toContain("data-provider-feature-pending");

    const removing = render(
      { decision: { providerId: "provider", featureId: null } },
      { removing: true, removalService: "YouTube" },
    );
    expect(removing).toContain("YouTube is unlinked when you save. The rule stays.");
    expect(removing).not.toContain('role="alert"');
  });

  it("renders nothing when the provider is hidden", () => {
    expect(render({ available: false })).toBe("");
  });
});

describe("providerFeatureCopy", () => {
  it("describes shared sites and whole-group removal in every language", () => {
    expect(providerFeatureCopy.en.sharedWith(["music.youtube.com"])).toBe(
      "Shares settings with music.youtube.com",
    );
    expect(
      providerFeatureCopy.en.sharedWith(["a.example", "b.example", "c.example"]),
    ).toBe("Shares settings with a.example and 2 more");
    expect(providerFeatureCopy.en.removeService).toBe("Unlink service");
    expect(providerFeatureCopy.en.pendingRemovalGroup("YouTube")).toContain(
      "rules stay",
    );
    expect(providerFeatureCopy.es.sharedWith(["a.example", "b.example"])).toContain(
      " y ",
    );
    expect(providerFeatureCopy.es.removeService).toBe("Desvincular servicio");
    expect(providerFeatureCopy.pt.sharedWith(["a.example"])).toContain("Compartilha");
    expect(providerFeatureCopy.pt.removeService).toBe("Desvincular serviço");
    expect(providerFeatureCopy.ru.sharedWith(["a.example"])).toContain(
      "Общие настройки",
    );
    expect(providerFeatureCopy.ru.removeService).toBe("Отвязать сервис");
    expect(
      providerFeatureCopy.uk.sharedWith(["a.example", "b.example", "c.example"]),
    ).toContain("ще 2");
    expect(providerFeatureCopy.uk.removeService).toBe("Відв'язати сервіс");
    expect(providerFeatureCopy.en.scope("Example DNS", "YouTube")).toContain(
      BRAND_DISPLAY_NAME,
    );
  });
});

describe("ProviderDecoratorBadge", () => {
  it("omits the count for a single site", () => {
    const markup = renderToStaticMarkup(
      createElement(ProviderDecoratorBadge, {
        decorator: {
          providerId: "provider",
          providerName: "Example DNS",
          initials: "ED",
          featureId: "youtube",
          label: "YouTube",
          type: "service",
        },
        groupSize: 1,
      }),
    );
    expect(markup).toContain("YouTube");
    expect(markup).toContain("border-border");
    expect(markup).toContain('title="Example DNS"');
    expect(markup).not.toContain("data-provider-feature-count");
    expect(markup).not.toContain("#1BE3AD");
  });

  it("fills the circle from provider badge colors", () => {
    const markup = renderToStaticMarkup(
      createElement(ProviderDecoratorBadge, {
        decorator: {
          providerId: "provider",
          providerName: "Example DNS",
          initials: "ED",
          badgeColors: { background: "#1BE3AD", foreground: "#010818" },
          featureId: "youtube",
          label: "YouTube",
          type: "service",
        },
      }),
    );
    expect(markup).toContain("background-color:#1BE3AD");
    expect(markup).toContain("color:#010818");
    expect(markup).toContain("size-[18px]");
  });
});
