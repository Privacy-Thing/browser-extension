import { describe, expect, it } from "vitest";

import { createXRayStoryState, XRAY_STORY_SCENARIOS } from "./xray-story-fixtures";

describe("XRay Storybook fixtures", () => {
  it("creates every documented scenario", () => {
    expect(
      XRAY_STORY_SCENARIOS.map((scenario) => createXRayStoryState(scenario)),
    ).toHaveLength(6);
  });

  it("exercises every new presentation state in the evidence-states scenario", () => {
    const state = createXRayStoryState("evidence-states");
    if (!state.ok) throw new Error("Expected a successful X-Ray state.");

    const presentationByKey = new Map(
      state.assessments.map((assessment) => [assessment.key, assessment.presentation]),
    );
    expect(presentationByKey.get("canvas")).toBe("repaired");
    expect(presentationByKey.get("webGL")).toBe("unrecoverable");
    expect(presentationByKey.get("audio")).toBe("pending");
    expect(presentationByKey.get("worker")).toBe("pending");
    expect(presentationByKey.get("webRTC")).toBe("browser-enforced");
  });

  it("models a fully armed diagnostic state with page usage", () => {
    const state = createXRayStoryState("active");

    expect(state).toMatchObject({
      ok: true,
      hostname: "allegro.pl",
      accessedCategories: { geolocation: true, canvas: true, serviceWorker: true },
      queryCounts: { canvas: 4, webGL: 5 },
    });
  });

  it("keeps the syncing state armed while omitting late runtime telemetry", () => {
    const state = createXRayStoryState("syncing");
    if (!state.ok) throw new Error("Expected a successful X-Ray state.");

    expect(state.snapshot).not.toBeNull();
    expect(state.accessedCategories).toEqual({});
    expect(state.queryCounts).toBeUndefined();
  });

  it("keeps trusted sites and errors outside the spoofed runtime path", () => {
    const trusted = createXRayStoryState("trusted-site");
    const error = createXRayStoryState("error");

    expect(trusted).toMatchObject({ ok: true, snapshot: null });
    expect(error).toEqual({ ok: false, error: expect.any(String) });
  });
});
