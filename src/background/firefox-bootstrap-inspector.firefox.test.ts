import {
  parseFirefoxHashSeed,
  resolveFxSeedForHost,
  type FirefoxWindowSeedState,
} from "@privacy-brand/refract-browser/common/firefox-shim-state";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { createPreparedDecisions } from "@/background/prepared-runtime-decisions";
import type { HostProtectionPause } from "@/shared/host-protection-pause";
import type { DomainRule, TrustedSite } from "@/shared/types";

const TAB = 9;
const HOST = "probe.example";
const traps = { methods: ["geolocation.getCurrentPosition"], mode: "every-call" };
const rule: DomainRule = {
  pattern: HOST,
  locationId: "warsaw",
  enabled: true,
  ruleSeedKey: "rule01",
};

let stored: Record<string, unknown>;
const execute = vi.fn(async (_injection: { args: unknown[] }) => []);

beforeEach(() => {
  vi.resetModules();
  stored = {};
  execute.mockClear();
  vi.stubGlobal("chrome", {
    storage: {
      local: { get: vi.fn(async () => ({})) },
      session: {
        get: vi.fn(async () => structuredClone(stored)),
        set: vi.fn(async (value: Record<string, unknown>) => {
          Object.assign(stored, structuredClone(value));
        }),
      },
    },
    scripting: { executeScript: execute },
  });
});
afterEach(() => vi.unstubAllGlobals());

const setup = async ({
  hostPauses = [],
  trustedSites = [],
  currentUrl = "https://start.example/",
}: {
  hostPauses?: HostProtectionPause[];
  trustedSites?: TrustedSite[];
  currentUrl?: string;
}) => {
  const { createFxBootstrap } = await import("./firefox-bootstrap-controller");
  const { createRuntimeState } = await import("./runtime-state");
  const { storeInspector } = await import("./storage/inspector-sessions");
  const runtimeState = createRuntimeState<ReturnType<typeof createPreparedDecisions>>();
  runtimeState.setLastKnownTrustedSites(trustedSites);
  runtimeState.setPreparedRuntimeDecisions(
    createPreparedDecisions({
      rules: [rule],
      trustedSites,
      hostPauses,
      workerPolicyExceptions: {},
      locations: [
        {
          id: "warsaw",
          label: "Warsaw",
          latitude: 52,
          longitude: 21,
          accuracy: 25,
          noiseRadius: 50,
          language: "en-US",
          languages: ["en-US", "en"],
          timeZone: "Europe/Warsaw",
        },
      ],
      controlState: { panicMode: false },
      debugMode: false,
      watchPositionDelay: [60, 500],
      fingerprintEnabled: true,
      featureFlags: { temporalApi: false, domainFencing: false },
      sharedWorkerHandlingMode: "native",
      sharedSpoofing: undefined,
      browserFingerprintSource: {
        userAgent:
          "Mozilla/5.0 (X11; Linux x86_64; rv:146.0) Gecko/20100101 Firefox/146.0",
        platform: "Linux x86_64",
        vendor: "",
        hardwareConcurrency: 8,
        deviceMemory: 8,
      },
      globalFallbackRule: undefined,
      containerAssignments: [],
    }),
  );
  await storeInspector(TAB, HOST, traps as never);
  return createFxBootstrap({
    runtimeState,
    getPopupTabById: async () => ({ url: currentUrl }) as chrome.tabs.Tab,
    getExactHostname: (url) => new URL(url).hostname,
    isSupportedWebUrl: (url): url is string => /^https?:/.test(url ?? ""),
    logBootstrapEvent: vi.fn(),
  });
};

const redirectState = (redirect: string | null) =>
  redirect ? parseFirefoxHashSeed(new URL(redirect).hash)?.state : undefined;

/** The window.name seed the outgoing document receives, resolved for the host. */
const windowSeedFor = async (
  bootstrap: Awaited<ReturnType<typeof setup>>,
  url: string,
) => {
  await bootstrap.injectFxWindowSeed({
    tabId: TAB,
    frameId: 0,
    navigationUrl: url,
    trigger: "on-before-request",
  });
  const seed = execute.mock.calls.at(-1)?.[0].args[0] as FirefoxWindowSeedState;
  return resolveFxSeedForHost(HOST, seed);
};

const pause = (workerTest?: "shared-worker"): HostProtectionPause => ({
  hostname: HOST,
  id: "pause-1",
  expiresAt: null,
  ...(workerTest ? { workerTest } : {}),
});

describe("Firefox delivery of an Inspector selection", () => {
  it("carries the armed tab's selection in the next document's hash seed", async () => {
    const bootstrap = await setup({});
    const state = redirectState(
      await bootstrap.maybeBuildFxRedirect(`https://${HOST}/`, undefined, TAB),
    );
    expect(state?.analystTraps).toEqual(traps);
    expect(
      redirectState(
        await bootstrap.maybeBuildFxRedirect(`https://${HOST}/`, undefined, TAB + 1),
      )?.analystTraps,
    ).toBeUndefined();
  });

  it.each([
    ["Protection paused", pause()],
    ["a worker test", pause("shared-worker")],
  ])("lets %s win over the selection", async (_label, hostPause) => {
    const bootstrap = await setup({ hostPauses: [hostPause] });
    const state = redirectState(
      await bootstrap.maybeBuildFxRedirect(`https://${HOST}/`, undefined, TAB),
    );
    expect(state?.hostPause).toEqual(hostPause);
    expect(state?.analystTraps).toBeUndefined();
    const seeded = await windowSeedFor(bootstrap, `https://${HOST}/`);
    expect(seeded?.hostPause).toEqual(hostPause);
    expect(seeded?.analystTraps).toBeUndefined();
  });

  it("leaves Trusted Sites without a seed", async () => {
    const bootstrap = await setup({ trustedSites: [{ pattern: HOST, enabled: true }] });
    expect(
      await bootstrap.maybeBuildFxRedirect(`https://${HOST}/`, undefined, TAB),
    ).toBeNull();
    expect(await windowSeedFor(bootstrap, `https://${HOST}/`)).toBeNull();
  });

  it("keeps same-origin navigations free of a hash hop and seeds window.name", async () => {
    const bootstrap = await setup({ currentUrl: `https://${HOST}/#/inbox` });
    expect(
      await bootstrap.maybeBuildFxRedirect(`https://${HOST}/settings`, undefined, TAB),
    ).toBeNull();
    expect(
      (await windowSeedFor(bootstrap, `https://${HOST}/settings`))?.analystTraps,
    ).toEqual(traps);
  });
});
