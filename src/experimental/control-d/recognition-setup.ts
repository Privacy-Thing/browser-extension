/* eslint-disable max-lines -- Lookup ownership checks and the Bypass sweep stay in one state machine. */
import {
  ControlDApiError,
  ControlDClient,
  deviceProfileIds,
  type ControlDDevice,
  type ControlDGroup,
  type ControlDProfile,
  type ControlDRule,
} from "./client";
import { CONTROL_D_PROVIDER_ID } from "./contracts";
import { generateResourceCode, isControlDResourceCode } from "./resource-names";
import type { ControlDProfileService } from "./services";
import { loadControlDApiKey } from "./storage";

import { fireAndForget } from "@/shared/async";
import { BUILD_BROWSER_TARGET } from "@/shared/build-flags";
import { FEATURE_EVENTS } from "@/shared/provider-feature";

export const RECOGNITION_STORE_KEY = "pt.experimental.control-d.v2.recognition";
export const RECOGNITION_READY_TTL_MS = 15 * 60 * 1000;

export const DIAGNOSTIC_COMMANDS = {
  getState: "pt.control-d.recognition.get-state",
  preview: "pt.control-d.recognition.preview",
  apply: "pt.control-d.recognition.apply",
} as const;

export const RECOGNITION_LIMITATIONS = [
  "Global rules cannot be turned off for this lookup profile. A hostname they mask is reported as overridden.",
  "Custom rules and rule folders are refused. They are not deleted or rewritten.",
  "The lookup resolver is never applied as browser DNS.",
] as const;

const PROFILE_PREFIX = "PT Lookup ";
const ENDPOINT_PREFIX = "PT Probe ";
const MAX_NAME_LENGTH = 32;
const RESOLVER_ID = /^[A-Za-z0-9_-]{1,128}$/;
const STORED_PHASES = [
  "not-setup",
  "preparing",
  "ready",
  "blocked",
  "error",
  "stale",
] as const;

export type RecognitionPhase = (typeof STORED_PHASES)[number];

export type RecognitionState = {
  phase: RecognitionPhase;
  code: string | null;
  profileId: string | null;
  endpointId: string | null;
  resolverDoh: string | null;
  servicePks: readonly string[];
  expectedFingerprint: string | null;
  freshFingerprint: string | null;
  lastError: string | null;
  failedPks?: readonly string[];
  verifiedAt?: number | null;
};

export type RecognitionSummary = {
  phase: RecognitionPhase;
  code: string | null;
  profileId: string | null;
  endpointId: string | null;
  hasResolver: boolean;
  serviceCount: number;
  lastError: string | null;
};

export type RecognitionPreview = {
  token: string;
  profileCreateCount: number;
  endpointCreateCount: number;
  serviceCount: number;
};

export type RecognitionResponse = {
  ok: boolean;
  summary: RecognitionSummary;
  error?: string;
  preview?: RecognitionPreview;
};

export type DiagnosticCommand =
  | { type: typeof DIAGNOSTIC_COMMANDS.getState }
  | { type: typeof DIAGNOSTIC_COMMANDS.preview }
  | { type: typeof DIAGNOSTIC_COMMANDS.apply; previewToken: string };

export type RecognitionDeps = {
  fetchImpl?: typeof fetch;
  loadApiKey?: () => Promise<string | null>;
  createCode?: () => string;
  createToken?: () => string;
};

type SetupPlan = {
  fingerprint: string;
  servicePks: readonly string[];
  bypassed: ReadonlySet<string>;
  profileId: string | null;
  endpointId: string | null;
  resolverDoh: string | null;
  blocker: string | null;
};

type ProfileDetail = {
  services: readonly ControlDProfileService[];
  groups: readonly ControlDGroup[];
  rules: readonly ControlDRule[];
};

type ResourceDraft = {
  code: string | null;
  profileId: string | null;
  endpointId: string | null;
};

type SweepContext = {
  client: ControlDClient;
  deps: RecognitionDeps;
  state: RecognitionState;
};

const emptyDetail = (): ProfileDetail => ({ services: [], groups: [], rules: [] });

const emptyState = (): RecognitionState => ({
  phase: "not-setup",
  code: null,
  profileId: null,
  endpointId: null,
  resolverDoh: null,
  servicePks: [],
  failedPks: [],
  expectedFingerprint: null,
  freshFingerprint: null,
  lastError: null,
  verifiedAt: null,
});

const isStoredPhase = (value: unknown): value is RecognitionPhase =>
  typeof value === "string" && STORED_PHASES.some((phase) => phase === value);

const textOrNull = (value: unknown): string | null | undefined => {
  if (value === null) return null;
  return typeof value === "string" && value.length > 0 ? value : undefined;
};

const stringList = (value: unknown): string[] | null =>
  Array.isArray(value) && value.every((item) => typeof item === "string")
    ? value
    : null;

const errorMessage = (error: unknown): string =>
  error instanceof Error ? error.message : "Control D lookup setup failed.";

const apiStatus = (error: unknown): number | null =>
  error instanceof ControlDApiError ? error.status : null;

const rejectsService = (error: unknown): boolean => {
  const status = apiStatus(error);
  return (
    status !== null &&
    status >= 400 &&
    status < 500 &&
    status !== 401 &&
    status !== 403 &&
    status !== 429
  );
};

const resourceName = (prefix: string, code: string): string => {
  if (!isControlDResourceCode(code))
    throw new Error("Invalid Control D resource code.");
  const name = `${prefix}${code}`;
  if (name.length > MAX_NAME_LENGTH) {
    throw new Error("Generated Control D resource name exceeds 32 characters.");
  }
  return name;
};

export const toRecognitionSummary = (state: RecognitionState): RecognitionSummary => ({
  phase: state.phase,
  code: state.code,
  profileId: state.profileId,
  endpointId: state.endpointId,
  hasResolver: state.resolverDoh !== null,
  serviceCount: state.servicePks.length,
  lastError: state.lastError,
});

const resolverIdFrom = (value: string | null): string | null => {
  if (!value) return null;
  if (RESOLVER_ID.test(value)) return value;
  try {
    const url = new URL(value);
    const id = decodeURIComponent(url.pathname.slice(1));
    if (
      url.origin !== "https://dns.controld.com" ||
      url.username !== "" ||
      url.password !== "" ||
      url.search !== "" ||
      url.hash !== "" ||
      id.includes("/") ||
      !RESOLVER_ID.test(id)
    ) {
      return null;
    }
    return id;
  } catch {
    return null;
  }
};

const exclusiveProfile = (device: ControlDDevice, profileId: string): boolean => {
  const ids = deviceProfileIds(device);
  return ids.length === 1 && ids[0] === profileId;
};

const isBypass = (service: ControlDProfileService): boolean =>
  service.action === 1 &&
  service.status === 1 &&
  (service.via === null || service.via === "-1") &&
  (service.viaV6 === null || service.viaV6 === "-1");

const fingerprintOf = async (value: unknown): Promise<string> => {
  const digest = await crypto.subtle.digest(
    "SHA-256",
    new TextEncoder().encode(JSON.stringify(value)),
  );
  return [...new Uint8Array(digest)]
    .map((byte) => byte.toString(16).padStart(2, "0"))
    .join("");
};

const endpointIcon = (types: readonly string[]): string | null => {
  const preferred =
    BUILD_BROWSER_TARGET === "firefox"
      ? ["browser-firefox", "browser-other"]
      : ["browser-other", "browser-chrome", "browser-edge", "browser-brave"];
  return (
    preferred.find((candidate) => types.includes(candidate)) ??
    types.find((type) => type.startsWith("browser-")) ??
    null
  );
};

const normalizePhase = (
  version: number,
  phase: RecognitionPhase,
  code: string | null,
  resolverDoh: string | null,
): RecognitionPhase => {
  if (version === 1 && (phase !== "not-setup" || code !== null)) return "preparing";
  if (phase === "error" || phase === "stale") return "preparing";
  if (phase === "ready" && resolverDoh === null) return "preparing";
  return phase;
};

const parseState = (value: unknown): RecognitionState | null => {
  if (!value || typeof value !== "object") return null;
  const record = value as Record<string, unknown>;
  const code = record.code;
  const profileId = textOrNull(record.profileId);
  const endpointId = textOrNull(record.endpointId);
  const resolverDoh = textOrNull(record.resolverDoh);
  const expectedFingerprint = textOrNull(record.expectedFingerprint);
  const freshFingerprint = textOrNull(record.freshFingerprint);
  const lastError = record.lastError === null ? null : textOrNull(record.lastError);
  const servicePks = stringList(record.servicePks);
  const failedPks = record.failedPks === undefined ? [] : stringList(record.failedPks);
  if (
    (record.version !== 1 && record.version !== 2) ||
    !isStoredPhase(record.phase) ||
    (code !== null && (typeof code !== "string" || !isControlDResourceCode(code))) ||
    profileId === undefined ||
    endpointId === undefined ||
    resolverDoh === undefined ||
    expectedFingerprint === undefined ||
    freshFingerprint === undefined ||
    lastError === undefined ||
    !servicePks ||
    !failedPks ||
    (resolverDoh !== null && !RESOLVER_ID.test(resolverDoh))
  ) {
    return null;
  }
  const verifiedAt = typeof record.verifiedAt === "number" ? record.verifiedAt : null;
  const phase = normalizePhase(
    record.version,
    record.phase,
    typeof code === "string" ? code : null,
    resolverDoh,
  );
  return {
    phase,
    code: typeof code === "string" ? code : null,
    profileId,
    endpointId,
    resolverDoh: phase === "ready" ? resolverDoh : null,
    servicePks,
    failedPks,
    expectedFingerprint,
    freshFingerprint,
    lastError,
    verifiedAt: phase === "ready" && record.version === 2 ? verifiedAt : null,
  };
};

export const loadRecognitionState = async (): Promise<RecognitionState> => {
  const stored = await chrome.storage.local.get(RECOGNITION_STORE_KEY);
  return parseState(stored[RECOGNITION_STORE_KEY]) ?? emptyState();
};

const saveRecognitionState = async (state: RecognitionState): Promise<void> => {
  const parsed = parseState({
    version: 2,
    ...state,
    failedPks: [...(state.failedPks ?? [])],
  });
  if (!parsed || parsed.phase !== state.phase) {
    throw new Error("Control D recognition state is invalid.");
  }
  await chrome.storage.local.set({
    [RECOGNITION_STORE_KEY]: {
      version: 2,
      ...parsed,
      servicePks: [...parsed.servicePks],
      failedPks: [...(parsed.failedPks ?? [])],
      verifiedAt: parsed.verifiedAt ?? null,
    },
  });
};

const publishRecognition = (
  previous: RecognitionPhase,
  next: RecognitionPhase,
  settled?: boolean,
): void => {
  if (previous === next && !settled) return;
  if (next !== "preparing" && next !== "ready" && next !== "blocked") return;
  const runtime = globalThis.chrome?.runtime;
  if (!runtime?.sendMessage) return;
  fireAndForget(
    Promise.resolve(
      runtime.sendMessage({
        type: FEATURE_EVENTS.stateChanged,
        providerId: CONTROL_D_PROVIDER_ID,
      }),
    ),
  );
};

const savePhase = async (
  previous: RecognitionPhase,
  next: RecognitionState,
): Promise<RecognitionState> => {
  await saveRecognitionState(next);
  publishRecognition(previous, next.phase);
  return next;
};

export const isRecognitionReady = (
  state: RecognitionState,
  now = Date.now(),
): boolean =>
  state.phase === "ready" &&
  state.resolverDoh !== null &&
  state.profileId !== null &&
  state.endpointId !== null &&
  state.code !== null &&
  typeof state.verifiedAt === "number" &&
  state.verifiedAt <= now &&
  now - state.verifiedAt < RECOGNITION_READY_TTL_MS;

const locateProfile = (
  profiles: readonly ControlDProfile[],
  state: RecognitionState,
): { profile: ControlDProfile | null; blocker: string | null } => {
  if (!state.code) return { profile: null, blocker: null };
  const matches = profiles.filter(
    (profile) => profile.name === resourceName(PROFILE_PREFIX, state.code ?? ""),
  );
  if (matches.length > 1) {
    return { profile: null, blocker: "More than one lookup profile uses this name." };
  }
  const named = matches[0] ?? null;
  const stored = state.profileId
    ? (profiles.find((profile) => profile.id === state.profileId) ?? null)
    : null;
  if (
    (stored && stored !== named) ||
    (state.profileId && named && named.id !== state.profileId)
  ) {
    return {
      profile: null,
      blocker: "The stored lookup profile does not match this setup.",
    };
  }
  return { profile: named, blocker: null };
};

// Control D replaces spaces with hyphens in device names on the live API.
const matchesEndpointName = (actual: string, expected: string): boolean =>
  actual === expected || actual === expected.replaceAll(" ", "-");

const locateEndpoint = (
  devices: readonly ControlDDevice[],
  state: RecognitionState,
  profileId: string | null,
): { endpoint: ControlDDevice | null; blocker: string | null } => {
  if (!state.code) return { endpoint: null, blocker: null };
  const name = resourceName(ENDPOINT_PREFIX, state.code);
  const matches = devices.filter((device) => matchesEndpointName(device.name, name));
  if (matches.length > 1) {
    return { endpoint: null, blocker: "More than one lookup endpoint uses this name." };
  }
  const named = matches[0] ?? null;
  const stored = state.endpointId
    ? (devices.find((device) => device.id === state.endpointId) ?? null)
    : null;
  if (
    stored &&
    (!matchesEndpointName(stored.name, name) || (named && stored.id !== named.id))
  ) {
    return {
      endpoint: null,
      blocker: "The stored lookup endpoint does not belong to this setup.",
    };
  }
  if (!profileId) {
    return named
      ? { endpoint: null, blocker: "The lookup endpoint enforces another profile." }
      : { endpoint: null, blocker: null };
  }
  if (named && !exclusiveProfile(named, profileId)) {
    return { endpoint: null, blocker: "The lookup endpoint enforces another profile." };
  }
  return { endpoint: named, blocker: null };
};

const detailBlocker = (
  profile: ControlDProfile,
  endpoint: ControlDDevice | null,
  detail: ProfileDetail,
  input: { devices: readonly ControlDDevice[]; catalogue: ReadonlySet<string> },
): string | null => {
  if (detail.groups.length > 0) return "The lookup profile has rule folders.";
  if (detail.rules.length > 0) return "The lookup profile has custom rules.";
  if (detail.services.some((service) => !input.catalogue.has(service.pk))) {
    return "The lookup profile has a service outside the catalogue.";
  }
  const shared = input.devices.some(
    (device) =>
      device.id !== endpoint?.id && deviceProfileIds(device).includes(profile.id),
  );
  return shared ? "The lookup profile is shared with another endpoint." : null;
};

const readDetail = async (
  client: ControlDClient,
  profileId: string,
): Promise<ProfileDetail> => {
  const [services, groups, rules] = await Promise.all([
    client.listProfileServices(profileId),
    client.listGroups(profileId),
    client.listCustomRules(profileId),
  ]);
  return { services, groups, rules };
};

const inspect = async (
  client: ControlDClient,
  state: RecognitionState,
): Promise<SetupPlan> => {
  const [catalogue, profiles, devices] = await Promise.all([
    client.listServices(),
    client.listProfiles(),
    client.listDevices(),
  ]);
  const servicePks = catalogue
    .map((service) => service.pk)
    .sort((left, right) => left.localeCompare(right));
  const profileHit = locateProfile(profiles, state);
  const endpointHit = profileHit.blocker
    ? { endpoint: null, blocker: null }
    : locateEndpoint(devices, state, profileHit.profile?.id ?? null);
  const profile = profileHit.profile;
  const endpoint = endpointHit.endpoint;
  const detail = profile ? await readDetail(client, profile.id) : emptyDetail();
  let blocker = profileHit.blocker ?? endpointHit.blocker;
  if (!blocker && profile) {
    blocker = detailBlocker(profile, endpoint, detail, {
      devices,
      catalogue: new Set(servicePks),
    });
  }
  const bypassed = new Set(
    detail.services.filter((service) => isBypass(service)).map((service) => service.pk),
  );
  const fingerprint = await fingerprintOf({
    catalogue: servicePks,
    profile: profile ? { id: profile.id, name: profile.name } : null,
    endpoint: endpoint
      ? {
          id: endpoint.id,
          name: endpoint.name,
          profiles: [...deviceProfileIds(endpoint)].sort(),
          resolver: resolverIdFrom(endpoint.resolverDoh),
        }
      : null,
    groups: detail.groups.map((group) => group.id).sort((left, right) => left - right),
    rules: detail.rules.map((rule) => rule.hostname).sort(),
    services: detail.services
      .map((service) => ({
        pk: service.pk,
        action: service.action,
        status: service.status,
        via: service.via,
        viaV6: service.viaV6,
      }))
      .sort((left, right) => left.pk.localeCompare(right.pk)),
  });
  return {
    fingerprint,
    servicePks,
    bypassed,
    profileId: profile?.id ?? null,
    endpointId: endpoint?.id ?? null,
    resolverDoh: resolverIdFrom(endpoint?.resolverDoh ?? null),
    blocker,
  };
};

const isComplete = (plan: SetupPlan): boolean =>
  plan.blocker === null &&
  plan.profileId !== null &&
  plan.endpointId !== null &&
  plan.resolverDoh !== null &&
  plan.servicePks.length > 0 &&
  plan.servicePks.every((pk) => plan.bypassed.has(pk));

const readyState = (current: RecognitionState, plan: SetupPlan): RecognitionState => ({
  phase: "ready",
  code: current.code,
  profileId: plan.profileId,
  endpointId: plan.endpointId,
  resolverDoh: plan.resolverDoh,
  servicePks: [...plan.servicePks],
  failedPks: [],
  expectedFingerprint: plan.fingerprint,
  freshFingerprint: plan.fingerprint,
  lastError: null,
  verifiedAt: Date.now(),
});

const blockedState = (
  current: RecognitionState,
  plan: SetupPlan,
): RecognitionState => ({
  ...current,
  phase: "blocked",
  profileId: plan.profileId ?? current.profileId,
  endpointId: plan.endpointId,
  resolverDoh: null,
  freshFingerprint: plan.fingerprint,
  verifiedAt: null,
  lastError: plan.blocker,
});

const preparingState = (
  current: RecognitionState,
  draft: ResourceDraft,
  lastError: string | null,
): RecognitionState => ({
  ...current,
  phase: "preparing",
  code: draft.code,
  profileId: draft.profileId,
  endpointId: draft.endpointId,
  resolverDoh: null,
  verifiedAt: null,
  lastError,
});

const requireUnique = <T extends { id: string; name: string }>(
  resources: readonly T[],
  name: string,
  label: string,
): T => {
  const matches = resources.filter((resource) => resource.name === name);
  const found = matches[0];
  if (matches.length !== 1 || !found) {
    throw new Error(
      matches.length > 1
        ? `More than one lookup ${label} uses this name.`
        : `Could not identify the newly created lookup ${label}.`,
    );
  }
  return found;
};

const ensureProfile = async (
  client: ControlDClient,
  draft: ResourceDraft,
): Promise<string> => {
  if (draft.profileId) return draft.profileId;
  const code = draft.code;
  if (!code) throw new Error("Invalid Control D resource code.");
  const name = resourceName(PROFILE_PREFIX, code);
  await client.createProfile(name);
  const created = requireUnique(await client.listProfiles(), name, "profile");
  draft.profileId = created.id;
  return created.id;
};

const ensureEndpoint = async (
  client: ControlDClient,
  draft: ResourceDraft,
  profileId: string,
): Promise<string> => {
  if (draft.endpointId) return draft.endpointId;
  const code = draft.code;
  if (!code) throw new Error("Invalid Control D resource code.");
  const name = resourceName(ENDPOINT_PREFIX, code);
  const icon = endpointIcon(await client.listDeviceTypes());
  if (!icon) throw new Error("Control D returned no supported browser endpoint type.");
  const created = await client.createDevice(name, profileId, icon, {
    stats: 0,
    learnIp: 0,
  });
  const endpoint =
    created ??
    requireUnique(
      (await client.listDevices()).map((device) =>
        matchesEndpointName(device.name, name) ? { ...device, name } : device,
      ),
      name,
      "endpoint",
    );
  if (!exclusiveProfile(endpoint, profileId)) {
    throw new Error("The lookup endpoint enforces another profile.");
  }
  draft.endpointId = endpoint.id;
  return endpoint.id;
};

type SweepCursor = {
  current: RecognitionState;
  draft: ResourceDraft;
  servicePks: readonly string[];
  failedPks: readonly string[];
  lastError: string | null;
};

const saveCursor = async (cursor: SweepCursor): Promise<RecognitionState> =>
  savePhase(cursor.current.phase, {
    ...preparingState(cursor.current, cursor.draft, cursor.lastError),
    servicePks: [...cursor.servicePks],
    failedPks: [...cursor.failedPks],
  });

const writeMissing = async (job: {
  client: ControlDClient;
  deps: RecognitionDeps;
  current: RecognitionState;
  draft: ResourceDraft;
  profileId: string;
  plan: SetupPlan;
}): Promise<void> => {
  const { client, deps, draft, profileId, plan } = job;
  const loadApiKey = deps.loadApiKey ?? loadControlDApiKey;
  const failed: string[] = [];
  let cursor = plan.servicePks.filter((pk) => plan.bypassed.has(pk));
  const missing = plan.servicePks.filter((pk) => !plan.bypassed.has(pk));
  let saved = await saveCursor({
    current: job.current,
    draft,
    servicePks: cursor,
    failedPks: failed,
    lastError: null,
  });
  for (const pk of missing) {
    if (!(await loadApiKey())) {
      await saveCursor({
        current: saved,
        draft,
        servicePks: cursor,
        failedPks: failed,
        lastError: saved.lastError,
      });
      return;
    }
    try {
      await client.bypassProfileService(profileId, pk);
      cursor = [...cursor, pk];
      saved = await saveCursor({
        current: saved,
        draft,
        servicePks: cursor,
        failedPks: failed,
        lastError: saved.lastError,
      });
    } catch (error) {
      const stop = !rejectsService(error);
      if (!stop) failed.push(pk);
      saved = await saveCursor({
        current: saved,
        draft,
        servicePks: cursor,
        failedPks: failed,
        lastError: errorMessage(error),
      });
      if (stop) return;
    }
  }
  if (failed.length > 0) return;
  const done = await inspect(client, { ...saved, code: draft.code, profileId });
  if (done.blocker) {
    await savePhase(saved.phase, blockedState({ ...saved, code: draft.code }, done));
    return;
  }
  if (!isComplete(done) || !draft.code) {
    await saveCursor({
      current: saved,
      draft,
      servicePks: cursor,
      failedPks: failed,
      lastError: "The lookup setup could not be verified.",
    });
    return;
  }
  await savePhase(saved.phase, readyState({ ...saved, code: draft.code }, done));
};

const executeSweep = async ({ client, deps, state }: SweepContext): Promise<void> => {
  const draft: ResourceDraft = {
    code: state.code,
    profileId: state.profileId,
    endpointId: state.endpointId,
  };
  let current = state;
  try {
    if (!draft.code) {
      draft.code = (deps.createCode ?? generateResourceCode)();
      current = await savePhase(current.phase, preparingState(current, draft, null));
    }
    const profileId = await ensureProfile(client, draft);
    current = await saveCursor({
      current,
      draft,
      servicePks: current.servicePks,
      failedPks: current.failedPks ?? [],
      lastError: null,
    });
    const endpointId = await ensureEndpoint(client, draft, profileId);
    current = await saveCursor({
      current,
      draft: { ...draft, endpointId },
      servicePks: current.servicePks,
      failedPks: [],
      lastError: null,
    });
    const verified = await inspect(client, {
      ...current,
      code: draft.code,
      profileId,
      endpointId,
    });
    if (verified.blocker) {
      await savePhase(
        current.phase,
        blockedState({ ...current, code: draft.code, profileId, endpointId }, verified),
      );
      return;
    }
    if (verified.servicePks.length === 0) {
      throw new Error("Control D returned no services to recognize.");
    }
    await writeMissing({ client, deps, current, draft, profileId, plan: verified });
  } catch (error) {
    await savePhase(current.phase, preparingState(current, draft, errorMessage(error)));
  }
};

const acceptReady = async (
  current: RecognitionState,
  plan: SetupPlan,
): Promise<RecognitionState> => savePhase(current.phase, readyState(current, plan));

const blockRecognition = async (
  current: RecognitionState,
  plan: SetupPlan,
): Promise<RecognitionState> => savePhase(current.phase, blockedState(current, plan));

let flight: Promise<RecognitionState> | null = null;
let sweep: Promise<void> | null = null;

export const resetRecognitionRuntime = (): void => {
  flight = null;
  sweep = null;
};

export const isRecognitionSweepActive = (): boolean => sweep !== null;

export const whenRecognitionSettled = (): Promise<void> =>
  (sweep ?? Promise.resolve()).then(() => undefined);

const beginSweep = (
  client: ControlDClient,
  deps: RecognitionDeps,
  state: RecognitionState,
): RecognitionState => {
  const started = executeSweep({ client, deps, state }).then(
    () => undefined,
    () => undefined,
  );
  sweep = started;
  void started.finally(() => {
    if (sweep === started) {
      sweep = null;
      // The UI must read settled state after the single-flight marker is cleared.
      publishRecognition("preparing", "preparing", true);
    }
  });
  return state;
};

const runRecognition = async (deps: RecognitionDeps): Promise<RecognitionState> => {
  const loadApiKey = deps.loadApiKey ?? loadControlDApiKey;
  const apiKey = await loadApiKey();
  const current = await loadRecognitionState();
  if (!apiKey || isRecognitionReady(current)) return current;
  const client = new ControlDClient(apiKey, deps.fetchImpl ?? fetch);
  const plan = await inspect(client, current);
  if (plan.blocker) return blockRecognition(current, plan);
  if (plan.servicePks.length === 0) {
    throw new Error("Control D returned no services to recognize.");
  }
  if (isComplete(plan) && current.code) return acceptReady(current, plan);
  const preparing = await savePhase(current.phase, {
    ...current,
    phase: "preparing",
    resolverDoh: null,
    verifiedAt: null,
    lastError: null,
    profileId: plan.profileId,
    endpointId: plan.endpointId,
  });
  return beginSweep(client, deps, preparing);
};

// Plan name for the lazy lookup entry point.
// eslint-disable-next-line local/max-symbol-name-length -- adapter plan entry point
export const ensureControlDRecognition = (
  deps: RecognitionDeps = {},
): Promise<RecognitionState> => {
  if (sweep) {
    return loadRecognitionState().then((state) =>
      state.phase === "preparing" ? state : { ...state, phase: "preparing" },
    );
  }
  flight ??= runRecognition(deps).finally(() => {
    flight = null;
  });
  return flight;
};

export const isDiagnosticCommand = (value: unknown): value is DiagnosticCommand => {
  if (!value || typeof value !== "object") return false;
  const record = value as { type?: unknown; previewToken?: unknown };
  if (
    record.type === DIAGNOSTIC_COMMANDS.getState ||
    record.type === DIAGNOSTIC_COMMANDS.preview
  ) {
    return true;
  }
  return (
    record.type === DIAGNOSTIC_COMMANDS.apply &&
    typeof record.previewToken === "string" &&
    record.previewToken.length > 0
  );
};

const recognitionResponse = (
  ok: boolean,
  state: RecognitionState,
  error?: string,
): RecognitionResponse => ({
  ok,
  summary: toRecognitionSummary(state),
  ...(error === undefined ? {} : { error }),
});

const openRecognition = (): {
  respond: (input: unknown) => Promise<RecognitionResponse>;
} => ({
  respond: async (input) => {
    const current = await loadRecognitionState();
    if (!isDiagnosticCommand(input)) {
      return recognitionResponse(false, current, "Unknown diagnostic command.");
    }
    if (input.type === DIAGNOSTIC_COMMANDS.getState) {
      return recognitionResponse(true, current);
    }
    return recognitionResponse(
      false,
      current,
      "Domain matching starts automatically when you edit a domain.",
    );
  },
});

export { openRecognition as createRecognitionController };
