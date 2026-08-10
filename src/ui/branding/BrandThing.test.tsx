// @vitest-environment jsdom

import { act } from "react";
import { createRoot, type Root } from "react-dom/client";
import { afterEach, beforeEach, describe, expect, it } from "vitest";

import { BRAND_THING_POSES, BrandThing } from "./BrandThing";

const getElement = () => document.querySelector<HTMLElement>("privacy-thing-logo");
const getThing = () =>
  getElement()?.shadowRoot?.querySelector<HTMLElement>(".pt-brand-thing");

describe("BrandThing adapter", () => {
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

  it("renders the native component with both motion layers disabled by default", async () => {
    await render(<BrandThing />);
    expect(getElement()?.classList.contains("gw-brand-thing")).toBe(true);
    expect(getElement()?.getAttribute("aria-label")).toBe("Privacy Thing");
    expect(getThing()?.dataset.pose).toBe("idle");
    expect(getThing()?.dataset.lookAround).toBe("false");
    expect(getThing()?.dataset.blink).toBe("false");
  });

  it("passes all poses through the React adapter", async () => {
    for (const pose of BRAND_THING_POSES) {
      await render(<BrandThing pose={pose} />);
      expect(getThing()?.dataset.pose).toBe(pose);
    }
  });

  it("composes independent look and blink motion", async () => {
    await render(
      <BrandThing
        lookAround
        lookAroundDirections={["south-west", "south-east"]}
        blink
      />,
    );
    const shadow = getElement()?.shadowRoot;
    expect(getThing()?.dataset.lookAroundDirections).toBe("south-west south-east");
    expect(shadow?.querySelectorAll('[data-motion-part="head-look"]')).toHaveLength(1);
    expect(shadow?.querySelectorAll('[data-motion-part="eye-look"]')).toHaveLength(4);
    expect(shadow?.querySelectorAll('[data-motion-part="eye-blink"]')).toHaveLength(2);
    expect(shadow?.querySelectorAll('[dur="60s"]')).toHaveLength(5);
    expect(shadow?.querySelectorAll('[dur="15s"]')).toHaveLength(2);
  });

  it("passes custom timing and reduced motion", async () => {
    await render(
      <BrandThing
        lookAround
        blink
        timing={{
          lookAround: { cycleMs: 8_400, holdMs: 1_200 },
          blink: { cycleMs: 5_500, durationMs: 280, eyeStaggerMs: 80 },
          pointer: { transitionMs: 340 },
        }}
      />,
    );
    expect(getElement()?.shadowRoot?.querySelectorAll('[dur="8.4s"]')).toHaveLength(5);
    expect(getElement()?.shadowRoot?.querySelectorAll('[dur="5.5s"]')).toHaveLength(2);
    expect(getThing()?.dataset.poseTransitionMs).toBe("340");

    await render(<BrandThing pose="zz" lookAround blink reduceMotion />);
    expect(getThing()?.dataset.pose).toBe("zz");
    expect(getElement()?.shadowRoot?.querySelector('[data-scene="zz"]')).not.toBeNull();
    expect(getElement()?.shadowRoot?.querySelector("[data-motion-part]")).toBeNull();
  });

  it("creates a unique SVG mask per mounted adapter", async () => {
    await render(
      <>
        <BrandThing />
        <BrandThing />
      </>,
    );
    const ids = Array.from(document.querySelectorAll("privacy-thing-logo")).map(
      (element) => element.shadowRoot?.querySelector("mask")?.id,
    );
    expect(ids).toHaveLength(2);
    expect(new Set(ids).size).toBe(2);
  });
});
