import type { Meta, StoryObj } from "@storybook/react";
import { useLayoutEffect, useState } from "react";
import { expect, userEvent, within } from "storybook/test";

import type { ProviderFeature, SlotInput } from "./model";
import { resolveSlot } from "./model";
import { providerFeatureCopy } from "./provider-feature-copy";
import { ProviderDecoratorBadge } from "./ProviderDecoratorBadge";
import {
  ProviderFeatureSlot,
  type ProviderFeatureSlotProps,
} from "./ProviderFeatureSlot";

import { applyUiLocalePreference, type UiLocale } from "@/ui/i18n";

const service = (featureId: string, name: string): ProviderFeature => ({
  providerId: "example-dns",
  featureId,
  type: "service",
  name,
});

const features = [
  service("youtube", "YouTube"),
  service("netflix", "Netflix"),
  service("spotify", "Spotify"),
];

const slotInput = (overrides: Partial<SlotInput> = {}): SlotInput => ({
  available: true,
  providerId: "example-dns",
  providerName: "Example DNS",
  initials: "ED",
  features,
  bindings: [],
  binding: null,
  match: {
    hostname: "www.youtube.com",
    providerId: "example-dns",
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

const meta = {
  title: "Components/Provider feature",
  tags: ["autodocs"],
  decorators: [
    (Story) => (
      <div className="max-w-xl">
        <Story />
      </div>
    ),
  ],
} satisfies Meta;

export default meta;
type Story = StoryObj<typeof meta>;

const LiveSlot = ({
  locale = "en",
  input,
  pending,
  sharedHosts = [],
}: {
  locale?: UiLocale;
  input: SlotInput;
  pending?: "status" | "lookup" | "preparing";
  sharedHosts?: readonly string[];
}) => {
  const [applied, setApplied] = useState<UiLocale | null>(null);
  const [current, setCurrent] = useState(input);
  useLayoutEffect(() => {
    applyUiLocalePreference(locale);
    setApplied(locale);
    return () => applyUiLocalePreference("en");
  }, [locale]);
  if (applied !== locale) return null;
  const copy = providerFeatureCopy[locale];
  const model = resolveSlot(current);
  const props: ProviderFeatureSlotProps = {
    model,
    copy,
    features,
    removing: current.decision?.featureId === null && current.binding !== null,
    sharedHosts,
    ...(pending ? { pending } : {}),
    joinFor: (featureId) =>
      current.bindings.some((binding) => binding.featureId === featureId)
        ? { pattern: "www.youtube.com", extra: 1 }
        : null,
    onAccept: () =>
      setCurrent((previous) => ({
        ...previous,
        decision: { providerId: "example-dns", featureId: "youtube" },
      })),
    onDecline: () =>
      setCurrent((previous) => ({
        ...previous,
        decision: { providerId: "example-dns", featureId: null },
      })),
    onJoin: () =>
      setCurrent((previous) => ({
        ...previous,
        decision: {
          providerId: "example-dns",
          featureId: "youtube",
          joinExisting: true,
        },
      })),
    onChoose: (feature) =>
      setCurrent((previous) => ({
        ...previous,
        decision: { providerId: feature.providerId, featureId: feature.featureId },
      })),
    onDetach: () =>
      setCurrent((previous) => ({
        ...previous,
        decision: { providerId: "example-dns", featureId: null },
      })),
    onClear: () => setCurrent((previous) => ({ ...previous, decision: undefined })),
  };
  return <ProviderFeatureSlot {...props} />;
};

export const Suggest: Story = {
  render: () => <LiveSlot input={slotInput()} />,
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);
    await userEvent.click(canvas.getByRole("button", { name: "Yes" }));
    await expect(
      canvasElement.querySelector("[data-provider-feature]"),
    ).toHaveAttribute("data-provider-feature-state", "staged");
  },
};

export const Decline: Story = {
  render: () => <LiveSlot input={slotInput()} />,
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);
    await userEvent.click(canvas.getByRole("button", { name: "No thanks" }));
    await expect(
      canvasElement.querySelector("[data-provider-feature]"),
    ).toHaveAttribute("data-provider-feature-state", "manual");
    await expect(canvas.getByRole("button", { name: /Link a service/ })).toBeVisible();
  },
};

export const Join: Story = {
  render: () => (
    <LiveSlot
      input={slotInput({
        identityPattern: "music.youtube.com",
        bindings: [
          {
            rulePattern: "www.youtube.com",
            rulePatterns: ["www.youtube.com", "m.youtube.com"],
            providerId: "example-dns",
            featureId: "youtube",
            featureName: "YouTube",
            featureType: "service",
          },
        ],
      })}
    />
  ),
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);
    await expect(canvas.getByText(/settings and identity/)).toBeVisible();
    await userEvent.click(canvas.getByRole("button", { name: "Yes" }));
    await expect(
      canvasElement.querySelector("[data-provider-feature]"),
    ).toHaveAttribute("data-provider-feature-state", "staged");
  },
};

export const Linked: Story = {
  render: () => (
    <LiveSlot
      input={slotInput({
        binding: {
          rulePattern: "www.youtube.com",
          rulePatterns: ["www.youtube.com", "m.youtube.com", "music.youtube.com"],
          providerId: "example-dns",
          featureId: "youtube",
          featureName: "YouTube",
          featureType: "service",
        },
      })}
    />
  ),
};

export const Chooser: Story = {
  ...Linked,
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);
    await userEvent.click(
      canvas.getByRole("button", { name: /YouTube, 3 sites, Example DNS/ }),
    );
    await userEvent.click(
      await within(document.body).findByRole("menuitem", { name: "Change service" }),
    );
    await userEvent.click(
      await within(document.body).findByRole("combobox", {
        name: "Example DNS service",
      }),
    );
    await userEvent.click(
      await within(document.body).findByRole("option", { name: "Netflix" }),
    );
    await userEvent.click(within(document.body).getByRole("button", { name: "Link" }));
    await expect(
      canvasElement.querySelector("[data-provider-feature]"),
    ).toHaveAttribute("data-provider-feature-state", "staged");
    await expect(canvas.getByText(/Netflix · unsaved/)).toBeVisible();
  },
};

export const Badge: Story = {
  render: () => (
    <ProviderDecoratorBadge
      decorator={{
        providerId: "example-dns",
        providerName: "Example DNS",
        initials: "ED",
        featureId: "youtube",
        label: "YouTube",
        type: "service",
      }}
      groupSize={3}
    />
  ),
  play: async ({ canvasElement }) => {
    const count = canvasElement.querySelector("[data-provider-feature-site-count]");
    const mark = canvasElement.querySelector("[data-provider-initials]");
    await expect(count).toHaveAttribute("data-provider-feature-site-count", "3");
    await expect(count).toHaveTextContent("3 sites");
    await expect(mark).toHaveClass("size-[24px]", "text-[10px]");
  },
};

export const RussianSuggest: Story = {
  render: () => <LiveSlot locale="ru" input={slotInput()} />,
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);
    await expect(canvas.getByText("Связать с сервисом YouTube?")).toBeVisible();
    await expect(canvas.getByRole("button", { name: "Да" })).toBeEnabled();
  },
};

const linkedInput = slotInput({
  binding: {
    rulePattern: "www.youtube.com",
    rulePatterns: ["www.youtube.com", "m.youtube.com", "music.youtube.com"],
    providerId: "example-dns",
    featureId: "youtube",
    featureName: "YouTube",
    featureType: "service",
  },
});

export const Checking: Story = {
  render: () => (
    <LiveSlot pending="lookup" input={slotInput({ match: null, recognizing: true })} />
  ),
  play: async ({ canvasElement }) => {
    await expect(
      canvasElement.querySelector("[data-provider-request-pending]"),
    ).toHaveAttribute("data-provider-request-pending", "lookup");
    await expect(
      canvasElement.querySelector("[data-provider-feature]"),
    ).toHaveAttribute("aria-busy", "true");
  },
};

export const LinkedBusy: Story = {
  render: () => (
    <LiveSlot
      pending="status"
      sharedHosts={["m.youtube.com", "music.youtube.com"]}
      input={linkedInput}
    />
  ),
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);
    await expect(
      canvas.getByRole("button", { name: /YouTube, 3 sites, Example DNS/ }),
    ).toBeVisible();
    await expect(
      canvasElement.querySelector("[data-provider-request-pending]"),
    ).toHaveAttribute("data-provider-request-pending", "status");
  },
};

export const Preparing: Story = {
  render: () => <LiveSlot pending="preparing" input={slotInput({ match: null })} />,
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);
    await expect(canvas.getByRole("button", { name: /Link a service/ })).toBeEnabled();
    await expect(canvas.getByText("Getting ready…")).toBeVisible();
  },
};

export const DarkLinked: Story = {
  render: () => (
    <div data-theme="dark" className="bg-background p-4 text-foreground">
      <LiveSlot pending="lookup" input={linkedInput} />
    </div>
  ),
};

export const LongUkrainian: Story = {
  render: () => (
    <div className="max-w-[360px]">
      <LiveSlot
        locale="uk"
        input={slotInput({
          providerName: "Дуже довга назва постачальника",
          features: [
            service("youtube", "Дуже довга назва відеосервісу для перевірки рядка"),
          ],
        })}
      />
    </div>
  ),
};

export const ColoredBadge: Story = {
  render: () => (
    <ProviderDecoratorBadge
      decorator={{
        providerId: "example-dns",
        providerName: "Example DNS",
        initials: "ED",
        badgeColors: { background: "#1BE3AD", foreground: "#010818" },
        featureId: "youtube",
        label: "YouTube",
        type: "service",
      }}
    />
  ),
};
