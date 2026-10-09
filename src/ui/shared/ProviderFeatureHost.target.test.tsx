// @vitest-environment jsdom

import { act, createElement } from "react";
import { createRoot, type Root } from "react-dom/client";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import type * as BuildFlags from "@/shared/build-flags";
import {
  FEATURE_COMMANDS,
  type ProviderFeatureCommand,
  type ProviderFeatureReply,
  type ProviderFeatureState,
} from "@/shared/provider-feature";
import { flushReactEffects } from "@/test-utils/react";
import {
  ProviderFeatureHost,
  type ProviderFeatureHostProps,
} from "@/ui/shared/ProviderFeatureHost";
import { toFeatureSyncStatus } from "@/ui/shared/use-provider-feature";

const channel = vi.hoisted(() => ({ value: "local" }));

vi.mock("@/shared/build-flags", async (importOriginal) => ({
  ...(await importOriginal<typeof BuildFlags>()),
  get BUILD_CHANNEL() {
    return channel.value;
  },
}));

const youtube = {
  providerId: "dns",
  featureId: "youtube",
  type: "service" as const,
  name: "YouTube",
};

const baseState: ProviderFeatureState = {
  available: true,
  providerId: "dns",
  providerName: "Example DNS",
  features: [youtube],
  match: null,
  binding: null,
  dismissed: false,
  syncStatus: "synced",
  error: null,
};

const matched = (hostname: string): ProviderFeatureState => ({
  ...baseState,
  match: {
    hostname,
    providerId: "dns",
    featureId: "youtube",
    matchSource: "domain-test",
    status: "matched",
    checkedAt: "2026-10-09T12:00:00.000Z",
  },
});

type Pending = {
  command: ProviderFeatureCommand;
  resolve: (reply: ProviderFeatureReply | null) => void;
};

let root: Root | null = null;
let pending: Pending[] = [];

const sendMessage = vi.fn(
  (command: ProviderFeatureCommand) =>
    new Promise<ProviderFeatureReply | null>((resolve) => {
      pending.push({ command, resolve });
    }),
);

const render = async (props: ProviderFeatureHostProps) => {
  const container = document.getElementById("root");
  if (!container) throw new Error("Missing root.");
  root = createRoot(container);
  await act(async () => {
    root?.render(createElement(ProviderFeatureHost, props));
  });
};

const reply = async (index: number, value: ProviderFeatureReply | null) => {
  const entry = pending[index];
  if (!entry) throw new Error(`No pending command ${index}.`);
  await act(async () => {
    entry.resolve(value);
  });
  await flushReactEffects();
};

const commands = () => pending.map(({ command }) => command.type);

const panel = () => document.querySelector("[data-provider-feature]");

const action = (name: string) => {
  const button = document.querySelector<HTMLButtonElement>(
    `[data-provider-feature-action="${name}"]`,
  );
  if (!button) throw new Error(`Missing action ${name}.`);
  return button;
};

const click = async (name: string) => {
  await act(async () => {
    action(name).click();
  });
};

const hostInput = () => {
  const input = document.querySelector<HTMLInputElement>(
    "[data-provider-feature-host-field] input",
  );
  if (!input) throw new Error("Missing hostname field.");
  return input;
};

const typeHost = async (value: string) => {
  const input = hostInput();
  await act(async () => {
    const setter = Object.getOwnPropertyDescriptor(
      HTMLInputElement.prototype,
      "value",
    )?.set;
    setter?.call(input, value);
    input.dispatchEvent(new Event("input", { bubbles: true }));
  });
  await act(async () => {
    input.dispatchEvent(new KeyboardEvent("keydown", { key: "Enter", bubbles: true }));
  });
};

describe("ProviderFeatureHost", () => {
  beforeEach(() => {
    (globalThis as { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT =
      true;
    channel.value = "local";
    pending = [];
    sendMessage.mockClear();
    vi.stubGlobal("chrome", { runtime: { id: "test", sendMessage } });
    document.body.innerHTML = '<div id="root"></div>';
  });

  afterEach(() => {
    act(() => root?.unmount());
    root = null;
    vi.unstubAllGlobals();
    document.body.innerHTML = "";
  });

  it("renders nothing and sends nothing in release builds", async () => {
    channel.value = "release";
    await render({ rulePattern: "video.example.com" });
    expect(sendMessage).not.toHaveBeenCalled();
    expect(document.getElementById("root")?.innerHTML).toBe("");
  });

  it("only reads state on render and recognizes on explicit action", async () => {
    await render({ rulePattern: "video.example.com" });
    expect(pending.map(({ command }) => command)).toEqual([
      {
        type: FEATURE_COMMANDS.getState,
        rulePattern: "video.example.com",
        hostname: "video.example.com",
      },
    ]);
    await reply(0, { ok: true, state: baseState });
    expect(panel()?.getAttribute("data-provider-feature-view")).toBe("idle");

    await click("recognize");
    expect(pending[1]?.command).toMatchObject({
      type: FEATURE_COMMANDS.recognize,
      providerId: "dns",
      rulePattern: "video.example.com",
      hostname: "video.example.com",
    });
    expect(panel()?.getAttribute("data-provider-feature-busy")).toBe("true");
  });

  it("stays hidden without a connected provider or background listener", async () => {
    await render({ rulePattern: "video.example.com" });
    await reply(0, { ok: true, state: { ...baseState, available: false } });
    expect(panel()).toBeNull();

    act(() => root?.unmount());
    pending = [];
    await render({ rulePattern: "video.example.com" });
    await reply(0, null);
    expect(panel()).toBeNull();
  });

  it("keeps a disconnected binding visible so it can be detached", async () => {
    await render({ rulePattern: "video.example.com" });
    await reply(0, {
      ok: true,
      state: {
        ...baseState,
        available: false,
        syncStatus: "disconnected",
        binding: {
          rulePattern: "video.example.com",
          providerId: "dns",
          featureId: "youtube",
          featureName: "YouTube",
          featureType: "service",
        },
      },
    });
    expect(panel()?.getAttribute("data-provider-feature-view")).toBe("bound");
    expect(
      document
        .querySelector("[data-provider-feature-sync]")
        ?.getAttribute("data-provider-feature-sync"),
    ).toBe("error");
    await click("detach");
    expect(pending[1]?.command.type).toBe(FEATURE_COMMANDS.detach);
  });

  it("presents the last good state and an alert after a failed reply", async () => {
    await render({ rulePattern: "video.example.com" });
    await reply(0, { ok: true, state: matched("video.example.com") });
    await click("confirm");
    expect(pending[1]?.command).toMatchObject({
      type: FEATURE_COMMANDS.confirm,
      featureId: "youtube",
    });
    await reply(1, {
      ok: false,
      error: "Provider rejected the change.",
      state: { ...baseState, error: "Provider rejected the change." },
    });
    expect(panel()?.getAttribute("data-provider-feature-view")).toBe("suggested");
    expect(panel()?.getAttribute("data-provider-feature-busy")).toBe("false");
    expect(document.querySelector('[role="alert"]')?.textContent).toBe(
      "Provider rejected the change.",
    );
  });

  it("reports a rejected runtime message as an alert", async () => {
    await render({ rulePattern: "video.example.com" });
    await reply(0, { ok: true, state: matched("video.example.com") });
    sendMessage.mockImplementationOnce(() =>
      Promise.reject(new Error("Could not establish connection.")),
    );
    await click("dismiss");
    await flushReactEffects();
    expect(document.querySelector('[role="alert"]')?.textContent).toBe(
      "Could not establish connection.",
    );
    expect(panel()?.getAttribute("data-provider-feature-view")).toBe("suggested");
  });

  it("asks for a representative hostname on broad patterns and ignores stale replies", async () => {
    await render({ rulePattern: "*.example.com" });
    expect(pending[0]?.command.hostname).toBe("");
    await reply(0, { ok: true, state: baseState });
    expect(hostInput().value).toBe("");

    await typeHost("example.com");
    expect(hostInput().getAttribute("aria-invalid")).toBe("true");
    expect(pending).toHaveLength(1);

    await typeHost("a.example.com");
    await typeHost("b.example.com");
    expect(pending.map(({ command }) => command.hostname)).toEqual([
      "",
      "a.example.com",
      "b.example.com",
    ]);
    await reply(2, { ok: true, state: matched("b.example.com") });
    await reply(1, { ok: true, state: matched("a.example.com") });
    expect(
      document.querySelector("[data-provider-feature-section=evidence]")?.textContent,
    ).toContain("b.example.com");

    await click("dismiss");
    expect(pending[3]?.command).toMatchObject({
      type: FEATURE_COMMANDS.dismiss,
      rulePattern: "*.example.com",
      hostname: "b.example.com",
    });
  });

  it("uses a fixed popup hostname as the representative host", async () => {
    await render({ rulePattern: "*example.com", hostname: "www.example.com" });
    expect(pending[0]?.command.hostname).toBe("www.example.com");
    await reply(0, { ok: true, state: baseState });
    expect(panel()).not.toBeNull();
    expect(document.querySelector("[data-provider-feature-host-field]")).toBeNull();
    expect(commands()).toEqual([FEATURE_COMMANDS.getState]);
  });
});

describe("toFeatureSyncStatus", () => {
  it.each([
    ["queued", "queued"],
    ["syncing", "syncing"],
    ["synced", "synced"],
    ["ready", "synced"],
    ["conflict", "error"],
    ["auth-error", "error"],
    ["disconnected", "error"],
    ["unavailable", "error"],
  ] as const)("maps %s to %s", (input, expected) => {
    expect(toFeatureSyncStatus(input)).toBe(expected);
  });
});
