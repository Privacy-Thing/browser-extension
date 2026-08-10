// @vitest-environment jsdom

import { act, type ReactNode } from "react";
import { createRoot, type Root } from "react-dom/client";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { AppPageFrame } from "./AppPageFrame";

import { flushReactEffects } from "@/test-utils/react";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/ui/components/ui/tabs";

vi.mock("@/ui/branding/BrandLogo", () => ({
  BrandLogo: ({
    className,
    href,
    tone,
    animateCursor,
    animateIcon,
    thingPose,
    thingTiming,
    thingHoverReaction,
    trackThingPointer,
    reduceMotion,
  }: {
    className?: string;
    href?: string;
    tone?: string;
    animateCursor?: boolean;
    animateIcon?: boolean;
    thingPose?: string;
    thingTiming?: { pointer?: { directionDelayMs?: number } };
    thingHoverReaction?: string;
    trackThingPointer?: boolean;
    reduceMotion?: boolean;
  }) =>
    href ? (
      <a
        className={className}
        data-testid="brand-link"
        data-tone={tone}
        data-animate-cursor={animateCursor}
        data-animate-icon={animateIcon}
        data-thing-pose={thingPose}
        data-direction-delay={thingTiming?.pointer?.directionDelayMs}
        data-hover-reaction={thingHoverReaction}
        data-track-thing-pointer={trackThingPointer}
        data-reduce-motion={reduceMotion}
        href={href}
      >
        Privacy Thing
      </a>
    ) : (
      <span
        className={className}
        data-testid="brand-link"
        data-tone={tone}
        data-animate-cursor={animateCursor}
        data-animate-icon={animateIcon}
        data-thing-pose={thingPose}
        data-direction-delay={thingTiming?.pointer?.directionDelayMs}
        data-hover-reaction={thingHoverReaction}
        data-track-thing-pointer={trackThingPointer}
        data-reduce-motion={reduceMotion}
      >
        Privacy Thing
      </span>
    ),
}));

vi.mock("@/ui/shared/MadeWithLoveBadge", () => ({
  MadeWithLoveBadge: () => null,
}));

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
  await flushReactEffects();
  return root;
};

describe("AppPageFrame", () => {
  let root: Root | null = null;

  beforeEach(() => {
    Object.defineProperty(globalThis, "IS_REACT_ACT_ENVIRONMENT", {
      configurable: true,
      value: true,
    });
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
  });

  it("threads brandHref into the shared brand logo", async () => {
    root = await renderWithRoot(
      <AppPageFrame title="Settings" brandHref="/src/ui/options/index.html">
        <div>Body</div>
      </AppPageFrame>,
    );

    const link = document.querySelector<HTMLAnchorElement>(
      'a[data-testid="brand-link"]',
    );
    expect(link?.getAttribute("href")).toBe("/src/ui/options/index.html");
    expect(link?.dataset.tone).toBe("foreground");
    expect(link?.dataset.animateCursor).toBe("true");
    expect(link?.className).toContain("gw-brand-logo--accent-cursor");
    expect(link?.className).toContain("w-[210px]");
  });

  it("keeps a hidden page title when the visible header title is suppressed", async () => {
    root = await renderWithRoot(
      <AppPageFrame title="Settings" hideTitle brandHref="/src/ui/options/index.html">
        <div>Body</div>
      </AppPageFrame>,
    );

    const pageTitle = document.getElementById("page-title");
    expect(pageTitle?.textContent).toBe("Settings");
    expect(pageTitle?.className).toContain("sr-only");
  });

  it("enables the animated signet while respecting reduced motion", async () => {
    root = await renderWithRoot(
      <AppPageFrame
        title="Settings"
        animateBrandIcon
        brandThingPose="zz"
        brandThingTiming={{ pointer: { directionDelayMs: 480 } }}
        brandThingHoverReaction="boop"
        trackBrandThingPointer
        reduceBrandMotion
      >
        <div>Body</div>
      </AppPageFrame>,
    );

    const brand = document.querySelector<HTMLElement>('[data-testid="brand-link"]');
    expect(brand?.dataset.animateIcon).toBe("true");
    expect(brand?.dataset.thingPose).toBe("zz");
    expect(brand?.dataset.directionDelay).toBe("480");
    expect(brand?.dataset.hoverReaction).toBe("boop");
    expect(brand?.dataset.trackThingPointer).toBe("true");
    expect(brand?.dataset.reduceMotion).toBe("true");
  });

  it("renders header tabs inside the shared frame when Tabs wraps it", async () => {
    root = await renderWithRoot(
      <Tabs defaultValue="rules">
        <AppPageFrame
          title="Settings"
          headerAside={
            <TabsList aria-label="Settings tabs">
              <TabsTrigger value="rules">Rules</TabsTrigger>
              <TabsTrigger value="options">Options</TabsTrigger>
            </TabsList>
          }
        >
          <TabsContent value="rules">Rules panel</TabsContent>
          <TabsContent value="options">Options panel</TabsContent>
        </AppPageFrame>
      </Tabs>,
    );

    const optionsTrigger = Array.from(document.querySelectorAll("button")).find(
      (candidate) => candidate.textContent?.trim() === "Options",
    );
    if (!(optionsTrigger instanceof HTMLButtonElement)) {
      throw new Error("Options trigger not found.");
    }

    const rulesTrigger = Array.from(document.querySelectorAll("button")).find(
      (candidate) => candidate.textContent?.trim() === "Rules",
    );
    expect(optionsTrigger.getAttribute("data-state")).toBe("inactive");
    expect(rulesTrigger?.getAttribute("data-state")).toBe("active");
    expect(document.body.textContent).toContain("Rules panel");
  });
});
