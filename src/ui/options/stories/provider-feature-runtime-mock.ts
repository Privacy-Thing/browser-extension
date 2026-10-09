import {
  FEATURE_COMMANDS,
  type ProviderFeature,
  type ProviderFeatureCommand,
  type ProviderFeatureMatch,
  type ProviderFeatureReply,
  type ProviderFeatureState,
} from "@/shared/provider-feature";

export const FEATURE_STORY_SCENARIOS = [
  "unavailable",
  "not-checked",
  "suggested",
  "unresolved",
  "dismissed",
  "linked",
  "sync-failed",
  "check-failed",
  "checking",
] as const;

export type FeatureStoryScenario = (typeof FEATURE_STORY_SCENARIOS)[number];

const PROVIDER_ID = "example-dns";
const CHECKED_AT = "2026-10-09T12:40:00.000Z";

const service = (featureId: string, name: string): ProviderFeature => ({
  providerId: PROVIDER_ID,
  featureId,
  type: "service",
  name,
});

const FEATURES = [
  service("youtube", "YouTube"),
  service("netflix", "Netflix"),
  service("spotify", "Spotify"),
  service("twitch", "Twitch"),
];

const SERVICE_HOSTS: Record<string, string> = {
  "youtube.com": "youtube",
  "netflix.com": "netflix",
  "spotify.com": "spotify",
  "twitch.tv": "twitch",
};

const recognizeHost = (hostname: string): ProviderFeatureMatch => {
  const featureId =
    Object.entries(SERVICE_HOSTS).find(
      ([domain]) => hostname === domain || hostname.endsWith(`.${domain}`),
    )?.[1] ?? null;
  return {
    hostname,
    providerId: PROVIDER_ID,
    featureId,
    matchSource: "domain-test",
    status: featureId ? "matched" : "unresolved",
    checkedAt: CHECKED_AT,
  };
};

type MockState = Omit<ProviderFeatureState, "match"> & {
  matches: Map<string, ProviderFeatureMatch>;
};

const seed = (
  scenario: FeatureStoryScenario,
  rulePattern: string,
  hostname: string,
): MockState => {
  const state: MockState = {
    available: scenario !== "unavailable",
    providerId: PROVIDER_ID,
    providerName: "Example DNS",
    features: FEATURES,
    matches: new Map(),
    binding: null,
    dismissed: scenario === "dismissed",
    syncStatus: scenario === "sync-failed" ? "conflict" : "ready",
    error:
      scenario === "sync-failed"
        ? "Example DNS changed this service rule outside Privacy Thing."
        : null,
  };
  if (["suggested", "dismissed", "linked", "sync-failed"].includes(scenario)) {
    state.matches.set(hostname, recognizeHost(hostname));
  }
  if (scenario === "unresolved") {
    state.matches.set(hostname, {
      ...recognizeHost(hostname),
      featureId: null,
      status: "unresolved",
    });
  }
  if (scenario === "linked" || scenario === "sync-failed") {
    state.binding = {
      rulePattern,
      providerId: PROVIDER_ID,
      featureId: "youtube",
      featureName: "YouTube",
      featureType: "service",
    };
  }
  return state;
};

const snapshot = (state: MockState, hostname: string): ProviderFeatureState => {
  const { matches, ...rest } = state;
  return { ...rest, match: matches.get(hostname) ?? null };
};

/**
 * Stateful stand-in for the background feature controller. Replies settle on the
 * next microtask, except `checking`, whose recognition never settles.
 */
export const createFeatureRuntimeMock = (
  scenario: FeatureStoryScenario,
  rulePattern: string,
  seededHostname: string,
) => {
  const state = seed(scenario, rulePattern, seededHostname);
  const log: ProviderFeatureCommand[] = [];
  const respond = (command: ProviderFeatureCommand): ProviderFeatureReply => {
    const { hostname } = command;
    switch (command.type) {
      case FEATURE_COMMANDS.recognize:
        if (scenario === "check-failed") {
          const error = "Example DNS could not be reached. Try again later.";
          return { ok: false, error, state: { ...snapshot(state, hostname), error } };
        }
        state.matches.set(hostname, recognizeHost(hostname));
        state.dismissed = false;
        break;
      case FEATURE_COMMANDS.confirm: {
        const feature = FEATURES.find((item) => item.featureId === command.featureId);
        if (!feature)
          return { ok: false, error: "Choose an available provider feature." };
        state.binding = {
          rulePattern,
          providerId: PROVIDER_ID,
          featureId: feature.featureId,
          featureName: feature.name,
          featureType: feature.type,
        };
        state.syncStatus = "queued";
        state.error = null;
        break;
      }
      case FEATURE_COMMANDS.dismiss:
        state.dismissed = true;
        break;
      case FEATURE_COMMANDS.detach:
        state.binding = null;
        state.error = null;
        state.syncStatus = "ready";
        break;
      default:
        break;
    }
    return { ok: true, state: snapshot(state, hostname) };
  };
  const sendMessage = async (
    message: unknown,
  ): Promise<ProviderFeatureReply | null> => {
    const command = message as ProviderFeatureCommand;
    if (!Object.values(FEATURE_COMMANDS).includes(command.type)) return null;
    log.push(command);
    if (scenario === "checking" && command.type === FEATURE_COMMANDS.recognize) {
      return new Promise(() => undefined);
    }
    return respond(command);
  };
  return { sendMessage, log };
};

/** Points the Storybook `chrome.runtime` boundary at a mock, or at no listener. */
export const installFeatureRuntime = (
  sendMessage: ((message: unknown) => Promise<unknown>) | null,
): void => {
  const runtime: unknown = Reflect.get(
    Reflect.get(globalThis, "chrome") ?? {},
    "runtime",
  );
  if (typeof runtime !== "object" || runtime === null) return;
  Reflect.set(runtime, "sendMessage", sendMessage ?? (async () => null));
};
