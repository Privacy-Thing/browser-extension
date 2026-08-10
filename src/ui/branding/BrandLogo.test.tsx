// @vitest-environment jsdom

import { act } from "react";
import { createRoot, type Root } from "react-dom/client";
import { renderToStaticMarkup } from "react-dom/server";
import { afterEach, beforeEach, describe, expect, it } from "vitest";

import { BrandLogo } from "./BrandLogo";

import { BRAND_DISPLAY_NAME } from "@/shared/brand";

const getElement = () => document.querySelector<HTMLElement>("privacy-thing-logo");
const getThing = () =>
  getElement()?.shadowRoot?.querySelector<HTMLElement>(".pt-brand-thing");

describe("BrandLogo adapter", () => {
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

  it("keeps an accessible static fallback for SSR", () => {
    const markup = renderToStaticMarkup(<BrandLogo className="w-40" />);
    expect(markup).toContain("privacy-thing-logo");
    expect(markup).toContain("gw-brand-logo");
    expect(markup).toContain(`aria-label="${BRAND_DISPLAY_NAME}"`);
    expect(markup).toContain('id="logo"');
  });

  it("supports tone, color, and cursor animation", async () => {
    await render(<BrandLogo tone="accent" color="#123456" animateCursor />);
    expect(getElement()?.dataset.tone).toBe("accent");
    expect(getElement()?.style.color).toBe("rgb(18, 52, 86)");
    expect(
      getElement()?.shadowRoot?.querySelector('[data-cursor-animated="true"]'),
    ).not.toBeNull();
  });

  it("composes and configures the animated Thing", async () => {
    await render(
      <BrandLogo
        animateIcon
        lookDirections={["south-west", "south-east"]}
        trackThingPointer
        thingHoverReaction="boop"
        thingTiming={{
          pointer: { directionDelayMs: 480, idleHoldMs: 360, transitionMs: 280 },
        }}
      />,
    );
    expect(
      getElement()?.shadowRoot?.querySelector('[data-animated-icon="true"]'),
    ).not.toBeNull();
    expect(getThing()?.dataset.lookAround).toBe("true");
    expect(getThing()?.dataset.lookAroundDirections).toBe("south-west south-east");
    expect(getThing()?.dataset.blink).toBe("true");
    expect(getThing()?.dataset.trackPointer).toBe("true");
    expect(getThing()?.dataset.hoverReaction).toBe("boop");
    expect(getThing()?.dataset.pointerDirectionDelayMs).toBe("480");
    expect(getThing()?.dataset.pointerIdleHoldMs).toBe("360");
    expect(getThing()?.dataset.poseTransitionMs).toBe("280");
  });

  it("forces Zz and stops the cursor", async () => {
    await render(<BrandLogo animateCursor animateIcon thingPose="zz" />);
    expect(getThing()?.dataset.pose).toBe("zz");
    expect(
      getElement()?.shadowRoot?.querySelector('[data-cursor-animated="false"]'),
    ).not.toBeNull();
  });

  it("keeps link semantics outside the decorative custom element", () => {
    const markup = renderToStaticMarkup(
      <BrandLogo href="/src/ui/options/index.html" ariaLabel="Open Settings" />,
    );
    expect(markup).toContain('href="/src/ui/options/index.html"');
    expect(markup).toContain('aria-label="Open Settings"');
    expect(markup).toContain('aria-hidden="true"');
  });
});
