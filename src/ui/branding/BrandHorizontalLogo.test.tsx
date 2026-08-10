// @vitest-environment jsdom

import {
  dispatchPrivacyThingCommand,
  type PrivacyThingLogoElement,
} from "@privacy-thing/brand";
import { act, createRef } from "react";
import { createRoot, type Root } from "react-dom/client";
import { renderToStaticMarkup } from "react-dom/server";
import { afterEach, beforeEach, describe, expect, it } from "vitest";

import { BrandHorizontalLogo } from "./BrandHorizontalLogo";

const getElement = () => document.querySelector<HTMLElement>("privacy-thing-logo");
const getThing = () =>
  getElement()?.shadowRoot?.querySelector<HTMLElement>(".pt-brand-thing");

describe("BrandHorizontalLogo adapter", () => {
  let root: Root;

  beforeEach(() => {
    document.body.innerHTML = '<div id="root"></div>';
    const container = document.getElementById("root");
    if (!container) throw new Error("Missing test root.");
    root = createRoot(container);
  });

  afterEach(() => {
    act(() => root.unmount());
    document.body.innerHTML = "";
  });

  const render = async (node: React.ReactNode) => {
    await act(async () => {
      root.render(node);
      await Promise.resolve();
    });
  };

  it("keeps the horizontal lockup as an SSR fallback", () => {
    const markup = renderToStaticMarkup(<BrandHorizontalLogo />);
    expect(markup).toContain("privacy-thing-logo");
    expect(markup).toContain("gw-brand-logo-horizontal");
    expect(markup).toContain('viewBox="0 0 1140 215"');
    expect(markup).toContain('id="logo_h"');
    expect(markup).toContain('id="sygnet"');
  });

  it("configures cursor and animated Thing in the native component", async () => {
    await render(
      <BrandHorizontalLogo
        animateCursor
        animateIcon
        lookDirections={["south-west", "south-east"]}
        thingHoverReaction="boop"
        thingTiming={{
          blink: { cycleMs: 5_000 },
          pointer: { directionDelayMs: 420 },
        }}
      />,
    );
    expect(
      getElement()?.shadowRoot?.querySelector('[data-variant="horizontal"]'),
    ).not.toBeNull();
    expect(
      getElement()?.shadowRoot?.querySelector('[data-cursor-animated="true"]'),
    ).not.toBeNull();
    expect(getThing()?.dataset.lookAround).toBe("true");
    expect(getThing()?.dataset.lookAroundDirections).toBe("south-west south-east");
    expect(getThing()?.dataset.blink).toBe("true");
    expect(getThing()?.dataset.hoverReaction).toBe("boop");
    expect(getThing()?.dataset.pointerDirectionDelayMs).toBe("420");
    expect(getElement()?.shadowRoot?.querySelectorAll('[dur="5s"]')).toHaveLength(2);
  });

  it("exposes the native element for event commands", async () => {
    const elementRef = createRef<PrivacyThingLogoElement>();
    await render(<BrandHorizontalLogo animateIcon elementRef={elementRef} />);

    const element = elementRef.current;
    expect(element).not.toBeNull();
    if (!element) throw new Error("Missing Privacy Thing logo element.");
    dispatchPrivacyThingCommand(element, { type: "look", direction: "south-west" });

    expect(getThing()?.dataset.pose).toBe("south-west");
    expect(
      getThing()?.querySelector('[data-eye-side="left"]')?.getAttribute("transform"),
    ).toBe("translate(-30 21)");
  });

  it("supports Zz and reduced motion", async () => {
    await render(
      <BrandHorizontalLogo animateCursor animateIcon thingPose="zz" reduceMotion />,
    );
    expect(getThing()?.dataset.pose).toBe("zz");
    expect(getThing()?.dataset.lookAround).toBe("false");
    expect(getThing()?.dataset.blink).toBe("false");
    expect(getElement()?.shadowRoot?.querySelector("[data-motion-part]")).toBeNull();
    expect(
      getElement()?.shadowRoot?.querySelector('[data-cursor-animated="false"]'),
    ).not.toBeNull();
  });

  it("keeps an explicit color across the lockup", async () => {
    await render(<BrandHorizontalLogo color="#123456" animateIcon />);
    expect(getElement()?.style.color).toBe("rgb(18, 52, 86)");
    expect(getThing()).not.toBeNull();
  });

  it("keeps accessible link semantics", () => {
    const markup = renderToStaticMarkup(
      <BrandHorizontalLogo
        href="/src/ui/options/index.html"
        tone="accent"
        ariaLabel="Open Settings"
      />,
    );
    expect(markup).toContain('href="/src/ui/options/index.html"');
    expect(markup).toContain('aria-label="Open Settings"');
    expect(markup).toContain('data-tone="accent"');
  });
});
