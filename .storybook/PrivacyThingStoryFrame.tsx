import type { Decorator } from "@storybook/react";
import type { ReactNode } from "react";

import { cn } from "@/ui/components/lib/utils";

type StorySurface = "component" | "popup" | "sidebar" | "options";

const surfaceClassNames: Record<StorySurface, string> = {
  component: "w-full max-w-5xl",
  popup: "w-full max-w-[360px]",
  sidebar: "w-full max-w-[360px] overflow-hidden",
  options: "w-full max-w-7xl",
};

export const StoryFrame = ({ surface, children }: { surface: StorySurface; children: ReactNode }) => (
  <div
    className={cn(
      "min-h-screen bg-background text-foreground",
      surface === "component" && "p-6 sm:p-8",
      surface === "popup" && "p-4 sm:p-6",
      surface === "options" && "p-4 sm:p-6 lg:p-8",
    )}
  >
    <div className={cn("mx-auto", surfaceClassNames[surface])}>{children}</div>
  </div>
);

export const withBrandStoryFrame: Decorator = (Story, context) => {
  const privacyThing = context.parameters.privacyThing as { surface?: StorySurface } | undefined;
  const surface = privacyThing?.surface ?? "component";

  return (
    <StoryFrame surface={surface}>
      <Story />
    </StoryFrame>
  );
};
