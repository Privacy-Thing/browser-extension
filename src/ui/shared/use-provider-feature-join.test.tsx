// @vitest-environment jsdom

import { act, createElement, useState, type ReactNode } from "react";
import { createRoot, type Root } from "react-dom/client";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import type { DomainRule } from "@/shared/types";
import {
  applyJoinToPopupDraft,
  providerFeatureScopeKey,
  shownRuleSettings,
  useProviderFeatureJoin,
  type FeatureDecisionChange,
  type RuleDraftSettings,
} from "@/ui/shared/use-provider-feature-join";

const warsaw: DomainRule = {
  pattern: "www.example.com",
  locationId: "warsaw",
  enabled: false,
  relaxCspForWorkers: true,
  fingerprintSurfaceOverrides: { serviceWorker: true, sharedWorker: "strict" },
};

const draft: RuleDraftSettings = {
  locationId: "paris",
  enabled: true,
  surfaceOverrides: undefined,
  relaxCspForWorkers: false,
};

const joinDecision = {
  providerId: "dns",
  featureId: "youtube",
  joinExisting: true as const,
};

let root: Root | null = null;

const Harness = ({
  scopeKey,
  onDecision,
  lockOnOffer,
}: {
  scopeKey: string;
  onDecision?: FeatureDecisionChange;
  lockOnOffer?: boolean;
}) => {
  const join = useProviderFeatureJoin(scopeKey, onDecision, lockOnOffer);
  const shown = shownRuleSettings(draft, join);
  return createElement(
    "div",
    null,
    createElement("button", {
      id: "collision",
      type: "button",
      onClick: () => join.onJoinOfferChange({ configuration: warsaw }),
    }),
    createElement("button", {
      id: "no-collision",
      type: "button",
      onClick: () => join.onJoinOfferChange(undefined),
    }),
    createElement("button", {
      id: "join",
      type: "button",
      onClick: () => join.onDecisionChange(joinDecision, warsaw),
    }),
    createElement("button", {
      id: "join-missing",
      type: "button",
      onClick: () => join.onDecisionChange(joinDecision),
    }),
    createElement("button", {
      id: "accept",
      type: "button",
      onClick: () => join.onDecisionChange({ providerId: "dns", featureId: "youtube" }),
    }),
    createElement("button", {
      id: "clear",
      type: "button",
      onClick: () => join.onDecisionChange(undefined),
    }),
    createElement("output", { id: "source" }, join.source),
    createElement("output", { id: "location" }, shown.locationId),
    createElement("output", { id: "enabled" }, String(shown.enabled)),
    createElement("output", { id: "relax" }, String(shown.relaxCspForWorkers)),
    createElement(
      "output",
      { id: "service" },
      String(shown.surfaceOverrides?.serviceWorker),
    ),
    createElement("output", { id: "locked" }, String(join.locked)),
    createElement("output", { id: "save" }, String(join.saveDisabled)),
  );
};

const ScopeHarness = ({ onDecision }: { onDecision?: FeatureDecisionChange }) => {
  const [scope, setScope] = useState("music.example.com");
  return createElement(
    "div",
    null,
    createElement("button", {
      id: "retarget",
      type: "button",
      onClick: () => setScope("edited.example.com"),
    }),
    createElement(Harness, { scopeKey: scope, ...(onDecision ? { onDecision } : {}) }),
  );
};

const text = (id: string) => document.getElementById(id)?.textContent;

const click = async (id: string) => {
  await act(async () => {
    document.getElementById(id)?.click();
  });
};

describe("provider feature join draft", () => {
  it("locks Add rule when a collision is detected and requires merge consent to save", async () => {
    await render(
      createElement(Harness, { scopeKey: "music.example.com", lockOnOffer: true }),
    );
    await click("collision");
    expect(text("locked")).toBe("true");
    expect(text("location")).toBe("warsaw");
    expect(text("save")).toBe("true");
    await click("join");
    expect(text("save")).toBe("false");
    await click("clear");
    expect(text("locked")).toBe("true");
    expect(text("save")).toBe("true");
    await click("no-collision");
    expect(text("locked")).toBe("false");
    expect(text("location")).toBe("paris");
  });
  beforeEach(() => {
    (globalThis as { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT =
      true;
    document.body.innerHTML = '<div id="root"></div>';
  });

  afterEach(() => {
    act(() => root?.unmount());
    root = null;
    document.body.innerHTML = "";
  });

  const render = async (node: ReactNode) => {
    const container = document.getElementById("root");
    if (!container) throw new Error("Missing root.");
    await act(async () => {
      root = createRoot(container);
      root.render(node);
    });
  };

  it("keeps the draft editable until an explicit join", async () => {
    await render(createElement(Harness, { scopeKey: "music.example.com" }));
    expect(text("source")).toBe("open");
    expect(text("location")).toBe("paris");
    expect(text("enabled")).toBe("true");
    expect(text("locked")).toBe("false");
    expect(text("save")).toBe("false");
    await click("accept");
    expect(text("source")).toBe("open");
    expect(text("location")).toBe("paris");
    expect(text("locked")).toBe("false");
  });

  it("shows the canonical rule immediately and restores the draft on cancel", async () => {
    const onDecision = vi.fn();
    await render(createElement(Harness, { scopeKey: "music.example.com", onDecision }));
    await click("join");
    expect(onDecision).toHaveBeenLastCalledWith(joinDecision, warsaw);
    expect(text("source")).toBe("canonical");
    expect(text("locked")).toBe("true");
    expect(text("save")).toBe("false");
    expect(text("location")).toBe("warsaw");
    expect(text("enabled")).toBe("false");
    expect(text("relax")).toBe("true");
    expect(text("service")).toBe("true");
    await click("clear");
    expect(text("source")).toBe("open");
    expect(text("location")).toBe("paris");
    expect(text("enabled")).toBe("true");
    expect(text("relax")).toBe("false");
    expect(text("locked")).toBe("false");
  });

  it("locks a join whose canonical rule is missing and disables save", async () => {
    await render(createElement(Harness, { scopeKey: "music.example.com" }));
    await click("join-missing");
    expect(text("source")).toBe("pending");
    expect(text("locked")).toBe("true");
    expect(text("save")).toBe("true");
    expect(text("location")).toBe("paris");
  });

  it("clears a staged join when the scope key changes", async () => {
    const onDecision = vi.fn();
    await render(createElement(ScopeHarness, { onDecision }));
    await click("join");
    expect(text("location")).toBe("warsaw");
    await click("retarget");
    expect(text("source")).toBe("open");
    expect(text("location")).toBe("paris");
    expect(text("locked")).toBe("false");
    expect(onDecision).toHaveBeenLastCalledWith(undefined);
  });

  it("builds a scope key from the primary pattern and every additional row", () => {
    expect(providerFeatureScopeKey("music.example.com", ["", "api.example.com"])).toBe(
      "music.example.com\0\0api.example.com",
    );
  });

  it("maps a canonical rule onto popup fields and leaves a pending join unsaved", () => {
    const popupDraft = {
      selectedLocationId: "paris" as string | null,
      regionalPresetEnabled: true,
      serviceWorkerOverride: undefined,
      workerHandlingOverride: undefined,
      relaxCspForWorkers: false,
    };
    expect(
      applyJoinToPopupDraft(popupDraft, {
        source: "canonical",
        locked: true,
        configuration: warsaw,
      }),
    ).toEqual({
      settingsLocked: true,
      selectedLocationId: "warsaw",
      regionalPresetEnabled: true,
      serviceWorkerOverride: true,
      workerHandlingOverride: "strict",
      relaxCspForWorkers: true,
    });
    expect(
      applyJoinToPopupDraft(popupDraft, {
        source: "pending",
        locked: true,
        configuration: undefined,
      }),
    ).toMatchObject({
      settingsLocked: true,
      selectedLocationId: "paris",
      relaxCspForWorkers: false,
    });
  });
});
