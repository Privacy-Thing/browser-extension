import type { Meta, StoryObj } from "@storybook/react";

import { BRAND_DISPLAY_NAME } from "@/shared/brand";
import { Button } from "@/ui/components/ui/button";
import { AppToast, AppToaster, notify } from "@/ui/components/ui/toast";

const meta = {
  title: "Components/Toast",
  component: AppToast,
  tags: ["autodocs"],
  decorators: [
    (Story) => (
      <div className="min-h-[280px] p-6 bg-background text-foreground">
        <Story />
      </div>
    ),
  ],
} satisfies Meta<typeof AppToast>;

export default meta;
type Story = StoryObj<typeof meta>;

export const Preview: Story = {
  args: {
    toastId: "storybook-preview",
    tone: "success",
    message: "Settings imported.",
    description:
      "This preview uses the same toast shell and countdown bar as the live runtime.",
    duration: 4200,
    dismissible: true,
  },
};

export const AllVariants: Story = {
  args: {
    toastId: "storybook-variants",
    tone: "success",
    message: "Preview",
    duration: 4000,
    dismissible: false,
  },
  render: () => (
    <div className="flex w-full max-w-[420px] flex-col gap-4">
      <AppToast
        toastId="variant-success"
        tone="success"
        message="Settings exported."
        description="Hover the card to pause the progress bar."
        duration={4600}
        dismissible={false}
      />
      <AppToast
        toastId="variant-info"
        tone="info"
        message="Map access enabled."
        duration={4600}
        dismissible={false}
      />
      <AppToast
        toastId="variant-warning"
        tone="warning"
        message="Choose a location and enter a domain pattern."
        duration={5200}
        dismissible={false}
      />
      <AppToast
        toastId="variant-error"
        tone="error"
        message="Saving settings failed."
        description="Errors stay on screen a little longer by default."
        duration={6200}
        dismissible={false}
      />
    </div>
  ),
};

export const InteractiveDemo: Story = {
  args: {
    toastId: "storybook-demo",
    tone: "info",
    message: "Preview",
    duration: 4000,
    dismissible: true,
  },
  render: () => (
    <div className="space-y-4">
      <p className="max-w-[54ch] text-sm text-muted-foreground">
        Trigger live toasts with the shared API. Hover any visible toast to pause both
        auto-dismiss and the progress bar.
      </p>
      <div className="flex flex-wrap gap-3">
        <Button
          onClick={() => {
            notify.success("Settings exported.", {
              description: "The file download started successfully.",
            });
          }}
        >
          Show success
        </Button>
        <Button
          variant="secondary"
          onClick={() => {
            notify.info("Reloaded saved settings.");
          }}
        >
          Show info
        </Button>
        <Button
          variant="outline"
          onClick={() => {
            notify.warning("Enter a hostname to clean.");
          }}
        >
          Show warning
        </Button>
        <Button
          variant="destructive"
          onClick={() => {
            notify.error("Import failed.", {
              description: `The selected file could not be parsed as ${BRAND_DISPLAY_NAME} settings.`,
            });
          }}
        >
          Show error
        </Button>
      </div>
      <AppToaster />
    </div>
  ),
};
