import type { Meta, StoryObj } from "@storybook/react";
import { useEffect, useState } from "react";
import { expect, fn, userEvent, within } from "storybook/test";

import type {
  ProviderFeature,
  ProviderFeatureMatch,
  RuleFeatureBinding,
} from "./model";
import {
  ProviderFeaturePanel,
  type ProviderFeatureProps,
} from "./ProviderFeaturePanel";

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
  service("twitch", "Twitch"),
  service("disneyplus", "Disney+"),
  service("primevideo", "Prime Video"),
  service("bbc-iplayer", "BBC iPlayer"),
];

const matched: ProviderFeatureMatch = {
  hostname: "www.youtube.com",
  providerId: "example-dns",
  featureId: "youtube",
  matchSource: "domain-test",
  status: "matched",
  checkedAt: "2026-10-09T12:40:00.000Z",
};

const binding: RuleFeatureBinding = {
  rulePattern: "*.youtube.com",
  providerId: "example-dns",
  featureId: "youtube",
  featureName: "YouTube",
  featureType: "service",
};

const meta = {
  title: "Components/Provider feature",
  component: ProviderFeaturePanel,
  tags: ["autodocs"],
  args: {
    variant: "default",
    providerName: "Example DNS",
    hostname: "www.youtube.com",
    rulePattern: "*.youtube.com",
    features,
    match: matched,
    binding: null,
    busy: false,
    dismissed: false,
    syncStatus: "queued",
    onRecognize: fn(),
    onConfirm: fn(),
    onDismiss: fn(),
    onDetach: fn(),
  },
  decorators: [
    (Story, { args }) => (
      <div className={args.variant === "compact" ? "max-w-[328px]" : "max-w-xl"}>
        <Story />
      </div>
    ),
  ],
} satisfies Meta<typeof ProviderFeaturePanel>;

export default meta;
type Story = StoryObj<typeof meta>;

export const Suggested: Story = {};

export const NotChecked: Story = { args: { match: null } };

export const Checking: Story = { args: { match: null, busy: true } };

export const Unresolved: Story = {
  args: {
    hostname: "video.example.org",
    rulePattern: "video.example.org",
    match: {
      ...matched,
      hostname: "video.example.org",
      featureId: null,
      status: "unresolved",
    },
  },
};

export const CheckFailed: Story = {
  args: { match: { ...matched, featureId: null, status: "error" } },
};

export const Dismissed: Story = { args: { dismissed: true } };

export const Confirming: Story = { args: { busy: true } };

export const LinkedQueued: Story = { args: { binding } };

export const LinkedInSync: Story = { args: { binding, syncStatus: "synced" } };

export const LinkedSyncFailed: Story = { args: { binding, syncStatus: "error" } };

export const ManualOverride: Story = {
  args: {
    match: {
      ...matched,
      featureId: "primevideo",
      matchSource: "manual",
      status: "overridden",
    },
    binding: { ...binding, featureId: "primevideo", featureName: "Prime Video" },
    syncStatus: "synced",
  },
};

export const CompactSuggested: Story = {
  args: { variant: "compact" },
};

export const CompactLinked: Story = {
  args: { variant: "compact", binding, syncStatus: "synced" },
};

export const CompactNotChecked: Story = {
  args: { variant: "compact", match: null },
};

const LocalizedPanel = ({
  locale,
  ...props
}: ProviderFeatureProps & { locale: UiLocale }) => {
  applyUiLocalePreference(locale);
  useEffect(() => () => applyUiLocalePreference("en"), []);
  return <ProviderFeaturePanel {...props} />;
};

export const RussianCompact: Story = {
  args: { variant: "compact" },
  render: (args) => <LocalizedPanel {...args} locale="ru" />,
};

export const UkrainianDefault: Story = {
  args: { binding, syncStatus: "error" },
  render: (args) => <LocalizedPanel {...args} locale="uk" />,
};

export const RussianCopyCheck: Story = {
  ...RussianCompact,
  tags: ["!dev", "!autodocs"],
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);
    await expect(canvas.getByText("Совпадение: YouTube · Example DNS")).toBeVisible();
    await expect(
      canvas.getByRole("button", { name: "Добавить DNS-правило сервиса" }),
    ).toBeEnabled();
  },
};

const StatefulPanel = (props: ProviderFeatureProps) => {
  const [current, setCurrent] = useState<RuleFeatureBinding | null>(props.binding);
  return (
    <ProviderFeaturePanel
      {...props}
      binding={current}
      onConfirm={(feature) => {
        props.onConfirm(feature);
        setCurrent({
          rulePattern: props.rulePattern,
          providerId: feature.providerId,
          featureId: feature.featureId,
          featureName: feature.name,
          featureType: feature.type,
        });
      }}
      onDetach={() => {
        props.onDetach();
        setCurrent(null);
      }}
    />
  );
};

export const ChooseAnotherInteraction: Story = {
  tags: ["!dev", "!autodocs"],
  render: (args) => <StatefulPanel {...args} />,
  play: async ({ args, canvasElement }) => {
    const canvas = within(canvasElement);
    const panel = canvasElement.querySelector("[data-provider-feature]");
    await userEvent.click(
      canvas.getByRole("button", { name: "Choose another service" }),
    );
    const confirm = canvas.getByRole("button", { name: "Add DNS service rule" });
    await expect(confirm).toBeDisabled();
    await userEvent.click(
      canvas.getByRole("combobox", { name: "Example DNS service" }),
    );
    await userEvent.click(
      await within(document.body).findByRole("option", { name: "Netflix" }),
    );
    await userEvent.click(
      canvas.getByRole("button", { name: "Add DNS rule for Netflix" }),
    );
    await expect(args.onConfirm).toHaveBeenCalledWith(features[1]);
    await expect(panel).toHaveAttribute("data-provider-feature-view", "bound");
    await expect(canvas.getByText("Linked to Netflix · Example DNS")).toBeVisible();
  },
};
