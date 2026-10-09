// @vitest-environment jsdom

import { act, createElement } from "react";
import { createRoot, type Root } from "react-dom/client";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import type * as BuildFlags from "@/shared/build-flags";
import {
  FEATURE_COMMANDS,
  FEATURE_EVENTS,
  type ProviderFeatureCommand,
  type ProviderFeatureReply,
  type ProviderFeatureState,
} from "@/shared/provider-feature";
import { flushReactEffects } from "@/test-utils/react";
import {
  ProviderFeatureHost,
  type HostSchedule,
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

type Listener = (message: unknown) => void;

let root: Root | null = null;
let pending: Pending[] = [];
let listeners: Listener[] = [];

const sendMessage = vi.fn(
  (command: ProviderFeatureCommand) =>
    new Promise<ProviderFeatureReply | null>((resolve) => {
      pending.push({ command, resolve });
    }),
);

const renderHost = async (props: ProviderFeatureHostProps) => {
  const container = document.getElementById("root");
  if (!container) throw new Error("Missing root.");
  await act(async () => {
    if (!root) root = createRoot(container);
    root.render(createElement(ProviderFeatureHost, props));
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

const commands = () => pending.map(({ command }) => command);

const commandIndex = (type: ProviderFeatureCommand["type"], hostname?: string) =>
  commands().findIndex(
    (command) =>
      command.type === type &&
      (hostname === undefined || command.hostname === hostname),
  );

const lastCommand = (
  type: ProviderFeatureCommand["type"],
  hostname?: string,
): number => {
  const found = commands().reduce(
    (latest, command, index) =>
      command.type === type && (hostname === undefined || command.hostname === hostname)
        ? index
        : latest,
    -1,
  );
  if (found < 0) throw new Error(`Missing ${type}.`);
  return found;
};

const slot = () => document.querySelector("[data-provider-feature]");

const stateOf = () => slot()?.getAttribute("data-provider-feature-state");

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

const decisionInput = () =>
  document.querySelector<HTMLInputElement>('input[name="featureDecision"]');

const hold: { run: (() => void) | null } = { run: null };

const schedule: HostSchedule = (run) => {
  hold.run = run;
  return () => {
    if (hold.run === run) hold.run = null;
  };
};

describe("ProviderFeatureHost", () => {
  beforeEach(() => {
    (globalThis as { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT =
      true;
    channel.value = "local";
    pending = [];
    listeners = [];
    hold.run = null;
    sendMessage.mockClear();
    vi.stubGlobal("chrome", {
      runtime: {
        id: "test",
        sendMessage,
        onMessage: {
          addListener: (listener: Listener) => {
            listeners.push(listener);
          },
          removeListener: (listener: Listener) => {
            listeners = listeners.filter((item) => item !== listener);
          },
        },
      },
    });
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
    await renderHost({ rulePattern: "video.example.com" });
    expect(sendMessage).not.toHaveBeenCalled();
    expect(document.getElementById("root")?.innerHTML).toBe("");
  });

  it("sends nothing when the page has no extension runtime", async () => {
    vi.stubGlobal("chrome", { runtime: { sendMessage } });
    await renderHost({ rulePattern: "video.example.com" });
    expect(sendMessage).not.toHaveBeenCalled();
    expect(slot()).toBeNull();
  });

  it("recognizes an exact draft when the background has no cached match", async () => {
    await renderHost({ rulePattern: "video.example.com" });
    expect(commands()).toEqual([
      {
        type: FEATURE_COMMANDS.getState,
        rulePattern: "video.example.com",
        hostname: "video.example.com",
      },
    ]);
    await reply(0, { ok: true, state: baseState });
    expect(commands()[1]).toMatchObject({
      type: FEATURE_COMMANDS.recognize,
      providerId: "dns",
      rulePattern: "video.example.com",
      hostname: "video.example.com",
    });
    await reply(1, { ok: true, state: matched("video.example.com") });
    expect(stateOf()).toBe("suggest");
    expect(document.querySelector("[data-provider-initials]")?.textContent).toBe("ED");
    expect(document.querySelector("[data-provider-feature-host-field]")).toBeNull();
  });

  it("recognizes once even when that host is already cached", async () => {
    await renderHost({ rulePattern: "video.example.com", schedule });
    await reply(0, { ok: true, state: matched("video.example.com") });
    const recognized = commandIndex(FEATURE_COMMANDS.recognize, "video.example.com");
    expect(recognized).toBeGreaterThan(0);
    await reply(recognized, { ok: true, state: matched("video.example.com") });
    expect(
      commands().filter((command) => command.type === FEATURE_COMMANDS.recognize),
    ).toHaveLength(1);
    expect(stateOf()).toBe("suggest");
    expect(hold.run).toBeNull();
  });

  it("does not recognize a dismissed host or clear that rejection", async () => {
    await renderHost({ rulePattern: "video.example.com", schedule });
    await reply(0, {
      ok: true,
      state: { ...matched("video.example.com"), dismissed: true },
    });
    expect(commands()).toHaveLength(1);
    listeners.forEach((listener) => listener({ type: FEATURE_EVENTS.stateChanged }));
    await flushReactEffects();
    const refresh = lastCommand(FEATURE_COMMANDS.getState);
    await reply(refresh, {
      ok: true,
      state: { ...matched("video.example.com"), dismissed: true },
    });
    expect(commands().map(({ type }) => type)).toEqual([
      FEATURE_COMMANDS.getState,
      FEATURE_COMMANDS.getState,
    ]);
    expect(stateOf()).toBe("manual");
    expect(hold.run).toBeNull();
  });

  it("hides a disabled provider", async () => {
    await renderHost({ rulePattern: "video.example.com" });
    await reply(0, { ok: true, state: { ...baseState, available: false } });
    expect(slot()).toBeNull();
    expect(commands().map(({ type }) => type)).toEqual([FEATURE_COMMANDS.getState]);
  });

  it("stages yes until save and does not confirm immediately", async () => {
    const onDecisionChange = vi.fn();
    await renderHost({ rulePattern: "video.example.com", onDecisionChange });
    await reply(0, { ok: true, state: matched("video.example.com") });
    await reply(1, { ok: true, state: matched("video.example.com") });
    await click("accept");
    expect(decisionInput()?.value).toBe(
      JSON.stringify({ providerId: "dns", featureId: "youtube" }),
    );
    expect(onDecisionChange).toHaveBeenCalledWith({
      providerId: "dns",
      featureId: "youtube",
    });
    expect(stateOf()).toBe("staged");
    expect(commands().map(({ type }) => type)).toEqual([
      FEATURE_COMMANDS.getState,
      FEATURE_COMMANDS.recognize,
    ]);
  });

  it("stages No for save and keeps that rejection across a refresh", async () => {
    const onDecisionChange = vi.fn();
    await renderHost({ rulePattern: "video.example.com", onDecisionChange, schedule });
    await reply(0, { ok: true, state: matched("video.example.com") });
    await reply(1, { ok: true, state: matched("video.example.com") });
    await click("decline");
    expect(JSON.parse(decisionInput()?.value ?? "null")).toEqual({
      providerId: "dns",
      featureId: null,
    });
    expect(onDecisionChange).toHaveBeenCalledWith({
      providerId: "dns",
      featureId: null,
    });
    expect(stateOf()).toBe("manual");
    expect(document.querySelector("[data-provider-feature-pending]")).toBeNull();
    listeners.forEach((listener) => listener({ type: FEATURE_EVENTS.stateChanged }));
    await flushReactEffects();
    const refresh = lastCommand(FEATURE_COMMANDS.getState);
    await reply(refresh, { ok: true, state: matched("video.example.com") });
    expect(stateOf()).toBe("manual");
    expect(JSON.parse(decisionInput()?.value ?? "null")).toEqual({
      providerId: "dns",
      featureId: null,
    });
    expect(commands().map(({ type }) => type)).not.toContain(FEATURE_COMMANDS.dismiss);
    expect(
      commands().filter((command) => command.type === FEATURE_COMMANDS.recognize),
    ).toHaveLength(1);
  });

  it("stages a join that adopts the existing group", async () => {
    await renderHost({ rulePattern: "music.example.com" });
    await reply(0, {
      ok: true,
      state: {
        ...matched("music.example.com"),
        bindings: [
          {
            rulePattern: "www.example.com",
            rulePatterns: ["www.example.com", "m.example.com"],
            providerId: "dns",
            featureId: "youtube",
            featureName: "YouTube",
            featureType: "service",
          },
        ],
      },
    });
    expect(stateOf()).toBe("join");
    expect(document.body.textContent).toContain("settings and identity");
    await click("join");
    expect(
      document.querySelector("[data-provider-feature-join]")?.textContent,
    ).toContain("current settings will be replaced");
    expect(JSON.parse(decisionInput()?.value ?? "{}")).toEqual({
      providerId: "dns",
      featureId: "youtube",
      joinExisting: true,
    });
    expect(commands().map(({ type }) => type)).toEqual([
      FEATURE_COMMANDS.getState,
      FEATURE_COMMANDS.recognize,
    ]);
    expect(commands().map(({ type }) => type)).not.toContain(FEATURE_COMMANDS.confirm);
  });

  it("reads the saved pattern so an edit keeps the existing group", async () => {
    await renderHost({
      rulePattern: "music.example.com",
      savedRulePattern: "www.example.com",
    });
    expect(commands()[0]).toMatchObject({
      type: FEATURE_COMMANDS.getState,
      rulePattern: "www.example.com",
      hostname: "music.example.com",
    });
    await reply(0, {
      ok: true,
      state: {
        ...baseState,
        binding: {
          rulePattern: "www.example.com",
          rulePatterns: ["www.example.com"],
          providerId: "dns",
          featureId: "youtube",
          featureName: "YouTube",
          featureType: "service",
        },
        decorator: {
          providerId: "dns",
          providerName: "Example DNS",
          initials: "QX",
          featureId: "youtube",
          label: "YouTube",
          type: "service",
        },
      },
    });
    expect(stateOf()).toBe("linked");
    expect(document.querySelector("[data-provider-initials]")?.textContent).toBe("QX");
    expect(commands()[1]).toMatchObject({
      type: FEATURE_COMMANDS.recognize,
      rulePattern: "music.example.com",
      hostname: "music.example.com",
    });
  });

  it("renders an unmodified binding from cache", async () => {
    await renderHost({
      rulePattern: "www.example.com",
      savedRulePattern: "www.example.com",
      schedule,
    });
    await reply(0, {
      ok: true,
      state: {
        ...matched("www.example.com"),
        binding: {
          rulePattern: "www.example.com",
          rulePatterns: ["www.example.com", "m.example.com"],
          providerId: "dns",
          featureId: "youtube",
          featureName: "YouTube",
          featureType: "service",
        },
      },
    });
    expect(stateOf()).toBe("linked");
    expect(commands().map(({ type }) => type)).toEqual([FEATURE_COMMANDS.getState]);
    expect(hold.run).toBeNull();
  });

  it("stages detach from the linked chip without calling the provider", async () => {
    await renderHost({ rulePattern: "video.example.com" });
    await reply(0, {
      ok: true,
      state: {
        ...matched("video.example.com"),
        binding: {
          rulePattern: "video.example.com",
          providerId: "dns",
          featureId: "youtube",
          featureName: "YouTube",
          featureType: "service",
        },
      },
    });
    await click("open");
    expect(
      document
        .querySelector("[data-slot='popover-content']")
        ?.getAttribute("aria-label"),
    ).toBe("YouTube · Example DNS");
    expect(action("detach").textContent).toBe("Unlink service");
    await click("detach");
    expect(JSON.parse(decisionInput()?.value ?? "{}")).toEqual({
      providerId: "dns",
      featureId: null,
    });
    expect(stateOf()).toBe("manual");
    expect(document.querySelector("[data-provider-feature-pending]")?.textContent).toBe(
      "YouTube is unlinked when you save. The rule stays.",
    );
    expect(commands().map(({ type }) => type)).not.toContain(FEATURE_COMMANDS.detach);
  });

  it("resets a staged decision when the draft pattern changes", async () => {
    const onDecisionChange = vi.fn();
    await renderHost({ rulePattern: "a.example.com", onDecisionChange, schedule });
    await reply(0, { ok: true, state: matched("a.example.com") });
    await click("accept");
    expect(decisionInput()).not.toBeNull();
    await renderHost({ rulePattern: "b.example.com", onDecisionChange, schedule });
    expect(decisionInput()).toBeNull();
    expect(onDecisionChange).toHaveBeenCalledWith(undefined);
    expect(commands().every(({ hostname }) => hostname === "a.example.com")).toBe(true);
  });

  it("debounces typed patterns and drops a stale reply", async () => {
    await renderHost({ rulePattern: "a.example.com", schedule });
    await renderHost({ rulePattern: "b.example.com", schedule });
    expect(hold.run).not.toBeNull();
    expect(commands().map(({ hostname }) => hostname)).toEqual(["a.example.com"]);
    await reply(0, { ok: true, state: matched("a.example.com") });
    expect(stateOf()).toBe("suggest");
    await act(async () => {
      hold.run?.();
    });
    await flushReactEffects();
    const fresh = commands().findIndex(
      (command) =>
        command.hostname === "b.example.com" &&
        command.type === FEATURE_COMMANDS.getState,
    );
    expect(fresh).toBeGreaterThanOrEqual(0);
    await reply(fresh, { ok: true, state: matched("b.example.com") });
    expect(stateOf()).toBe("suggest");
    expect(document.body.textContent).toContain("Link YouTube service?");
  });

  it("recognizes the apex of *host and www of *.host and skips other wildcards", async () => {
    await renderHost({ rulePattern: "*example.com" });
    expect(commands()[0]?.hostname).toBe("example.com");
    act(() => root?.unmount());
    root = null;
    pending = [];
    await renderHost({ rulePattern: "*.example.com" });
    expect(commands()[0]?.hostname).toBe("www.example.com");
    act(() => root?.unmount());
    root = null;
    pending = [];
    await renderHost({ rulePattern: "foo.*.com" });
    expect(commands()[0]?.hostname).toBe("");
    await reply(0, { ok: true, state: baseState });
    expect(commands().map(({ type }) => type)).toEqual([FEATURE_COMMANDS.getState]);
    expect(stateOf()).toBe("manual");
  });

  it("uses a fixed popup hostname and shows a small error without an alert", async () => {
    await renderHost({ rulePattern: "*example.com", hostname: "www.example.com" });
    expect(commands()[0]?.hostname).toBe("www.example.com");
    expect(document.querySelector("[data-provider-feature-host-field]")).toBeNull();
    await reply(0, { ok: true, state: baseState });
    await reply(1, {
      ok: false,
      error: "Couldn’t check.",
      state: { ...baseState, error: "Couldn’t check." },
    });
    expect(document.querySelector("[data-provider-feature-error]")?.textContent).toBe(
      "Something went wrong. Try again.",
    );
    expect(document.body.textContent).not.toContain("Couldn’t check.");
    expect(document.querySelector('[role="alert"]')).toBeNull();
    expect(stateOf()).toBe("manual");
  });

  it("queries a bound draft only after its host settles on a new name", async () => {
    const binding = {
      rulePattern: "a.example.com",
      providerId: "dns",
      featureId: "youtube",
      featureName: "YouTube",
      featureType: "service" as const,
    };
    await renderHost({
      rulePattern: "a.example.com",
      savedRulePattern: "a.example.com",
      schedule,
    });
    await reply(0, { ok: true, state: { ...matched("a.example.com"), binding } });
    expect(commands().map(({ type }) => type)).toEqual([FEATURE_COMMANDS.getState]);
    await renderHost({
      rulePattern: "b.example.com",
      savedRulePattern: "a.example.com",
      schedule,
    });
    expect(commands().some((command) => command.hostname === "b.example.com")).toBe(
      false,
    );
    await act(async () => {
      hold.run?.();
    });
    await flushReactEffects();
    const read = lastCommand(FEATURE_COMMANDS.getState, "b.example.com");
    expect(commands()[read]).toMatchObject({
      rulePattern: "a.example.com",
      hostname: "b.example.com",
    });
    await reply(read, { ok: true, state: { ...matched("b.example.com"), binding } });
    const recognized = lastCommand(FEATURE_COMMANDS.recognize, "b.example.com");
    expect(commands()[recognized]).toMatchObject({
      rulePattern: "b.example.com",
      hostname: "b.example.com",
    });
    await reply(recognized, {
      ok: true,
      state: { ...matched("b.example.com"), binding },
    });
    expect(
      commands().filter(
        (command) =>
          command.type === FEATURE_COMMANDS.recognize &&
          command.hostname === "b.example.com",
      ),
    ).toHaveLength(1);
    expect(stateOf()).toBe("linked");
  });

  it("leaves a stable popup binding cached when the tab host is not the apex", async () => {
    await renderHost({
      rulePattern: "*example.com",
      savedRulePattern: "*example.com",
      hostname: "www.example.com",
      schedule,
    });
    expect(commands()[0]?.hostname).toBe("www.example.com");
    await reply(0, {
      ok: true,
      state: {
        ...baseState,
        binding: {
          rulePattern: "*example.com",
          providerId: "dns",
          featureId: "youtube",
          featureName: "YouTube",
          featureType: "service",
        },
      },
    });
    expect(stateOf()).toBe("linked");
    expect(commands().map(({ type }) => type)).toEqual([FEATURE_COMMANDS.getState]);
  });

  it("retries recognition only after a refreshed ready status", async () => {
    await renderHost({ rulePattern: "video.example.com", schedule });
    await reply(0, { ok: true, state: { ...baseState, recognitionStatus: "ready" } });
    await reply(lastCommand(FEATURE_COMMANDS.recognize), {
      ok: false,
      error: "Control D is preparing domain matching.",
      errorCode: "recognition-preparing",
      state: {
        ...baseState,
        recognitionStatus: "preparing",
        error: "Control D is preparing domain matching.",
      },
    });
    expect(document.body.textContent).toContain("Getting ready…");
    expect(document.body.textContent).not.toContain("Control D is preparing");
    expect(
      commands().filter((command) => command.type === FEATURE_COMMANDS.recognize),
    ).toHaveLength(1);
    listeners.forEach((listener) => listener({ type: FEATURE_EVENTS.stateChanged }));
    await flushReactEffects();
    await reply(lastCommand(FEATURE_COMMANDS.getState), {
      ok: true,
      state: { ...baseState, recognitionStatus: "unavailable", error: "sweep blew up" },
    });
    expect(document.querySelector("[data-provider-request-pending]")).toBeNull();
    expect(document.body.textContent).not.toContain("sweep blew up");
    expect(document.body.textContent).toContain("Suggestions are paused");
    expect(
      commands().filter((command) => command.type === FEATURE_COMMANDS.recognize),
    ).toHaveLength(1);
    listeners.forEach((listener) => listener({ type: FEATURE_EVENTS.stateChanged }));
    await flushReactEffects();
    await reply(lastCommand(FEATURE_COMMANDS.getState), {
      ok: true,
      state: { ...baseState, recognitionStatus: "ready", error: null },
    });
    expect(
      commands().filter((command) => command.type === FEATURE_COMMANDS.recognize),
    ).toHaveLength(2);
  });

  it("applies a failed lookup's newer state without recognizing again", async () => {
    await renderHost({ rulePattern: "video.example.com", schedule });
    await reply(0, { ok: true, state: baseState });
    await reply(lastCommand(FEATURE_COMMANDS.recognize), {
      ok: false,
      error: "Lookup failed.",
      state: { ...matched("video.example.com"), error: "Lookup failed." },
    });
    expect(stateOf()).toBe("suggest");
    expect(document.querySelector("[data-provider-feature-error]")?.textContent).toBe(
      "Something went wrong. Try again.",
    );
    expect(document.body.textContent).not.toContain("Lookup failed.");
    listeners.forEach((listener) => listener({ type: FEATURE_EVENTS.stateChanged }));
    await flushReactEffects();
    await reply(lastCommand(FEATURE_COMMANDS.getState), {
      ok: true,
      state: matched("video.example.com"),
    });
    expect(
      commands().filter((command) => command.type === FEATURE_COMMANDS.recognize),
    ).toHaveLength(1);
    expect(stateOf()).toBe("suggest");
  });

  it("keeps a staged decision when a failed reply has a newer match", async () => {
    await renderHost({ rulePattern: "video.example.com", schedule });
    await reply(0, { ok: true, state: matched("video.example.com") });
    await reply(lastCommand(FEATURE_COMMANDS.recognize), {
      ok: true,
      state: matched("video.example.com"),
    });
    await click("accept");
    const staged = decisionInput()?.value;
    listeners.forEach((listener) => listener({ type: FEATURE_EVENTS.stateChanged }));
    await flushReactEffects();
    await reply(lastCommand(FEATURE_COMMANDS.getState), {
      ok: false,
      error: "Catalogue expired.",
      state: {
        ...matched("video.example.com"),
        providerInitials: "ZZ",
        features: [
          {
            providerId: "dns",
            featureId: "netflix",
            type: "service",
            name: "Netflix",
          },
        ],
        match: {
          hostname: "video.example.com",
          providerId: "dns",
          featureId: "netflix",
          matchSource: "domain-test",
          status: "matched",
          checkedAt: "2026-10-09T18:00:00.000Z",
        },
        error: "Catalogue expired.",
      },
    });
    expect(decisionInput()?.value).toBe(staged);
    expect(stateOf()).toBe("staged");
    expect(document.body.textContent).not.toContain("Use Netflix?");
    expect(document.querySelector("[data-provider-initials]")?.textContent).toBe("ZZ");
    expect(document.querySelector("[data-provider-feature-error]")?.textContent).toBe(
      "Something went wrong. Try again.",
    );
    expect(document.body.textContent).not.toContain("Catalogue expired.");
  });

  it("shows a status spinner for the first read and keeps a linked chip while refreshing", async () => {
    await renderHost({ rulePattern: "video.example.com", schedule });
    expect(
      document
        .querySelector("[data-provider-request-pending]")
        ?.getAttribute("data-provider-request-pending"),
    ).toBe("status");
    expect(document.body.textContent).toContain("Checking status…");
    await reply(0, {
      ok: true,
      state: {
        ...baseState,
        recognitionStatus: "ready",
        badgeColors: { background: "#1BE3AD", foreground: "#010818" },
        binding: {
          rulePattern: "video.example.com",
          rulePatterns: ["video.example.com", "m.example.com", "music.example.com"],
          providerId: "dns",
          featureId: "youtube",
          featureName: "YouTube",
          featureType: "service",
        },
        groupPatterns: ["video.example.com", "m.example.com", "music.example.com"],
      },
    });
    expect(stateOf()).toBe("linked");
    expect(document.querySelector("[data-provider-request-pending]")).toBeNull();
    expect(
      document.querySelector("[data-provider-initials]")?.getAttribute("style"),
    ).toContain("rgb(27, 227, 173)");
    listeners.forEach((listener) => listener({ type: FEATURE_EVENTS.stateChanged }));
    await flushReactEffects();
    expect(stateOf()).toBe("linked");
    expect(
      document
        .querySelector("[data-provider-request-pending]")
        ?.getAttribute("data-provider-request-pending"),
    ).toBe("status");
    await reply(lastCommand(FEATURE_COMMANDS.getState), {
      ok: true,
      state: {
        ...baseState,
        recognitionStatus: "ready",
        binding: {
          rulePattern: "video.example.com",
          rulePatterns: ["video.example.com", "m.example.com", "music.example.com"],
          providerId: "dns",
          featureId: "youtube",
          featureName: "YouTube",
          featureType: "service",
        },
        groupPatterns: ["video.example.com", "m.example.com", "music.example.com"],
      },
    });
    await click("open");
    expect(document.querySelector("[data-provider-feature-shared]")?.textContent).toBe(
      "Shares settings with m.example.com and music.example.com",
    );
  });

  it("does not show checking while a draft is still being typed", async () => {
    await renderHost({ rulePattern: "video.example.com", schedule });
    await reply(0, {
      ok: true,
      state: {
        ...matched("video.example.com"),
        dismissed: true,
        recognitionStatus: "ready",
      },
    });
    expect(stateOf()).toBe("manual");
    await renderHost({ rulePattern: "other.example.com", schedule });
    expect(document.body.textContent).not.toContain("Checking");
    expect(commands().some((command) => command.hostname === "other.example.com")).toBe(
      false,
    );
  });

  it("does not recognize again after an unavailable lookup", async () => {
    await renderHost({ rulePattern: "video.example.com", schedule });
    await reply(0, { ok: true, state: { ...baseState, recognitionStatus: "ready" } });
    await reply(lastCommand(FEATURE_COMMANDS.recognize), {
      ok: false,
      error: "Connect Control D before recognizing domains.",
      errorCode: "recognition-unavailable",
      state: {
        ...baseState,
        recognitionStatus: "unavailable",
        error: "The lookup profile has custom rules.",
      },
    });
    expect(document.body.textContent).not.toContain("lookup profile");
    expect(document.body.textContent).toContain("Connect Example DNS");
    listeners.forEach((listener) => listener({ type: FEATURE_EVENTS.stateChanged }));
    await flushReactEffects();
    await reply(lastCommand(FEATURE_COMMANDS.getState), {
      ok: true,
      state: { ...baseState, recognitionStatus: "ready", error: null },
    });
    expect(
      commands().filter((command) => command.type === FEATURE_COMMANDS.recognize),
    ).toHaveLength(1);
  });
});

describe("toFeatureSyncStatus", () => {
  it.each([
    ["queued", "queued"],
    ["syncing", "syncing"],
    ["synced", "synced"],
    ["ready", "synced"],
    ["conflict", "error"],
    ["disconnected", "error"],
  ] as const)("maps %s to %s", (input, expected) => {
    expect(toFeatureSyncStatus(input)).toBe(expected);
  });
});
