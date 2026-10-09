/* eslint-disable max-lines -- Preview, apply, and recognition storage share one state machine and stay in this module. */
import {
  ControlDClient,
  deviceProfileIds,
  type ControlDDevice,
  type ControlDGroup,
  type ControlDProfile,
  type ControlDRule,
} from "./client";
import { generateResourceCode, isControlDResourceCode } from "./resource-names";
import type { ControlDProfileService } from "./services";
import { loadControlDApiKey } from "./storage";

import { BUILD_BROWSER_TARGET } from "@/shared/build-flags";

export const RECOGNITION_STORE_KEY = "pt.experimental.control-d.v2.recognition";

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

export type RecognitionPhase = "ready" | "error" | "stale" | "not-setup";

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

type SetupPlan = {
  fingerprint: string;
  profileCreateCount: number;
  endpointCreateCount: number;
  servicePks: readonly string[];
  profileId: string | null;
  endpointId: string | null;
  resolverDoh: string | null;
  blocker: string | null;
  bypassReady: boolean;
};

type ProfileDetail = {
  services: readonly ControlDProfileService[];
  groups: readonly ControlDGroup[];
  rules: readonly ControlDRule[];
};

type OwnedResources = {
  profile: ControlDProfile | null;
  endpoint: ControlDDevice | null;
  blocker: string | null;
};

type ResourceDraft = {
  code: string | null;
  profileId: string | null;
  endpointId: string | null;
};

type PreviewSession = {
  token: string;
  fingerprint: string;
};

export type RecognitionDeps = {
  fetchImpl?: typeof fetch;
  loadApiKey?: () => Promise<string | null>;
  createToken?: () => string;
  createCode?: () => string;
};

const emptyDetail = (): ProfileDetail => ({ services: [], groups: [], rules: [] });

const emptyState = (): RecognitionState => ({
  phase: "not-setup",
  code: null,
  profileId: null,
  endpointId: null,
  resolverDoh: null,
  servicePks: [],
  expectedFingerprint: null,
  freshFingerprint: null,
  lastError: null,
});

const isPhase = (value: unknown): value is RecognitionPhase =>
  value === "ready" || value === "error" || value === "stale" || value === "not-setup";

const textOrNull = (value: unknown): string | null | undefined => {
  if (value === null) return null;
  return typeof value === "string" && value.length > 0 ? value : undefined;
};

const stringList = (value: unknown): string[] | null =>
  Array.isArray(value) && value.every((item) => typeof item === "string")
    ? value
    : null;

const errorMessage = (error: unknown): string =>
  error instanceof Error ? error.message : "Control D diagnostic setup failed.";

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
  if (
    record.version !== 1 ||
    !isPhase(record.phase) ||
    (code !== null && (typeof code !== "string" || !isControlDResourceCode(code))) ||
    profileId === undefined ||
    endpointId === undefined ||
    resolverDoh === undefined ||
    expectedFingerprint === undefined ||
    freshFingerprint === undefined ||
    lastError === undefined ||
    !servicePks ||
    (resolverDoh !== null && !RESOLVER_ID.test(resolverDoh))
  ) {
    return null;
  }
  const state: RecognitionState = {
    phase: record.phase,
    code: typeof code === "string" ? code : null,
    profileId,
    endpointId,
    resolverDoh,
    servicePks,
    expectedFingerprint,
    freshFingerprint,
    lastError,
  };
  if (
    state.phase === "ready" &&
    (state.resolverDoh === null || !state.profileId || !state.endpointId || !state.code)
  ) {
    return { ...state, phase: "error", resolverDoh: null };
  }
  return state;
};

export const loadRecognitionState = async (): Promise<RecognitionState> => {
  const stored = await chrome.storage.local.get(RECOGNITION_STORE_KEY);
  return parseState(stored[RECOGNITION_STORE_KEY]) ?? emptyState();
};

const saveRecognitionState = async (state: RecognitionState): Promise<void> => {
  const parsed = parseState({
    version: 1,
    ...state,
    servicePks: [...state.servicePks],
  });
  if (!parsed) throw new Error("Control D recognition state is invalid.");
  await chrome.storage.local.set({
    [RECOGNITION_STORE_KEY]: {
      version: 1,
      ...parsed,
      servicePks: [...parsed.servicePks],
    },
  });
};

const keepsResolver = (phase: RecognitionPhase): boolean =>
  phase === "ready" || phase === "stale";

const failureState = (
  current: RecognitionState,
  message: string,
  freshFingerprint: string | null,
): RecognitionState =>
  keepsResolver(current.phase)
    ? {
        ...current,
        phase: "stale",
        lastError: message,
        freshFingerprint: freshFingerprint ?? current.freshFingerprint,
      }
    : {
        ...current,
        phase: current.code ? "error" : "not-setup",
        resolverDoh: null,
        lastError: message,
        freshFingerprint: freshFingerprint ?? current.freshFingerprint,
      };

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

const locateEndpoint = (
  devices: readonly ControlDDevice[],
  state: RecognitionState,
  profileId: string | null,
): { endpoint: ControlDDevice | null; blocker: string | null } => {
  if (!state.code) return { endpoint: null, blocker: null };
  const name = resourceName(ENDPOINT_PREFIX, state.code);
  const matches = devices.filter((device) => device.name === name);
  if (matches.length > 1) {
    return { endpoint: null, blocker: "More than one lookup endpoint uses this name." };
  }
  const named = matches[0] ?? null;
  const stored = state.endpointId
    ? (devices.find((device) => device.id === state.endpointId) ?? null)
    : null;
  if (stored && (stored.name !== name || (named && stored.id !== named.id))) {
    return {
      endpoint: null,
      blocker: "The stored lookup endpoint does not belong to this setup.",
    };
  }
  if (!named) return { endpoint: null, blocker: null };
  if (!profileId || !exclusiveProfile(named, profileId)) {
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
  const owned: OwnedResources = {
    profile: profileHit.profile,
    endpoint: endpointHit.endpoint,
    blocker: profileHit.blocker ?? endpointHit.blocker,
  };
  const detail = owned.profile
    ? await readDetail(client, owned.profile.id)
    : emptyDetail();
  let blocker = owned.blocker;
  if (!blocker && servicePks.length === 0) {
    blocker = "Control D returned no services to recognize.";
  } else if (!blocker && owned.profile) {
    blocker = detailBlocker(owned.profile, owned.endpoint, detail, {
      devices,
      catalogue: new Set(servicePks),
    });
  }
  const bypassReady =
    servicePks.length > 0 &&
    servicePks.every((pk) => {
      const service = detail.services.find((item) => item.pk === pk);
      return service ? isBypass(service) : false;
    });
  const fingerprint = await fingerprintOf({
    catalogue: servicePks,
    profile: owned.profile ? { id: owned.profile.id, name: owned.profile.name } : null,
    endpoint: owned.endpoint
      ? {
          id: owned.endpoint.id,
          name: owned.endpoint.name,
          profiles: [...deviceProfileIds(owned.endpoint)].sort(),
          resolver: resolverIdFrom(owned.endpoint.resolverDoh),
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
    profileCreateCount: blocker || owned.profile ? 0 : 1,
    endpointCreateCount: blocker || owned.endpoint ? 0 : 1,
    servicePks,
    profileId: owned.profile?.id ?? null,
    endpointId: owned.endpoint?.id ?? null,
    resolverDoh: resolverIdFrom(owned.endpoint?.resolverDoh ?? null),
    blocker,
    bypassReady,
  };
};

const reviewedPhase = (
  current: RecognitionState,
  plan: SetupPlan,
): RecognitionPhase => {
  if (keepsResolver(current.phase)) {
    return current.expectedFingerprint === plan.fingerprint &&
      !plan.blocker &&
      current.resolverDoh
      ? "ready"
      : "stale";
  }
  return plan.blocker && current.code ? "error" : current.phase;
};

const rememberReview = async (
  current: RecognitionState,
  plan: SetupPlan,
): Promise<RecognitionState> => {
  const next: RecognitionState = {
    ...current,
    phase: reviewedPhase(current, plan),
    freshFingerprint: plan.fingerprint,
    lastError: plan.blocker,
  };
  await saveRecognitionState(next);
  return next;
};

const response = (
  ok: boolean,
  state: RecognitionState,
  error?: string,
  preview?: RecognitionPreview,
): RecognitionResponse => ({
  ok,
  summary: toRecognitionSummary(state),
  ...(error === undefined ? {} : { error }),
  ...(preview === undefined ? {} : { preview }),
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

const savePartial = async (
  current: RecognitionState,
  draft: ResourceDraft,
): Promise<void> => {
  if (keepsResolver(current.phase)) return;
  await saveRecognitionState({
    ...current,
    phase: "error",
    code: draft.code,
    profileId: draft.profileId,
    endpointId: draft.endpointId,
    resolverDoh: null,
    servicePks: [],
    expectedFingerprint: null,
    lastError: null,
  });
};

const ensureProfile = async (
  client: ControlDClient,
  current: RecognitionState,
  draft: ResourceDraft,
  profileId: string | null,
): Promise<string> => {
  if (profileId) return profileId;
  const code = draft.code;
  if (!code) throw new Error("Invalid Control D resource code.");
  const name = resourceName(PROFILE_PREFIX, code);
  await client.createProfile(name);
  const created = requireUnique(await client.listProfiles(), name, "profile");
  draft.profileId = created.id;
  await savePartial(current, draft);
  return created.id;
};

const ensureEndpoint = async (
  client: ControlDClient,
  current: RecognitionState,
  draft: ResourceDraft,
  profileId: string,
): Promise<string> => {
  if (draft.endpointId) return draft.endpointId;
  const code = draft.code;
  if (!code) throw new Error("Invalid Control D resource code.");
  const name = resourceName(ENDPOINT_PREFIX, code);
  const icon = endpointIcon(await client.listDeviceTypes());
  if (!icon) throw new Error("Control D returned no supported browser endpoint type.");
  const created = await client.createDevice(name, profileId, icon);
  const endpoint =
    created ?? requireUnique(await client.listDevices(), name, "endpoint");
  if (!exclusiveProfile(endpoint, profileId)) {
    throw new Error("The lookup endpoint enforces another profile.");
  }
  draft.endpointId = endpoint.id;
  await savePartial(current, draft);
  return endpoint.id;
};

const verifiedSetup = async (
  client: ControlDClient,
  draft: ResourceDraft,
  servicePks: readonly string[],
): Promise<RecognitionState> => {
  const verified = await inspect(client, {
    ...emptyState(),
    code: draft.code,
    profileId: draft.profileId,
    endpointId: draft.endpointId,
  });
  if (
    verified.blocker ||
    !verified.bypassReady ||
    verified.profileCreateCount !== 0 ||
    verified.endpointCreateCount !== 0 ||
    !verified.profileId ||
    !verified.endpointId ||
    !verified.resolverDoh ||
    !draft.code
  ) {
    throw new Error(verified.blocker ?? "The lookup setup could not be verified.");
  }
  return {
    phase: "ready",
    code: draft.code,
    profileId: verified.profileId,
    endpointId: verified.endpointId,
    resolverDoh: verified.resolverDoh,
    servicePks: [...servicePks],
    expectedFingerprint: verified.fingerprint,
    freshFingerprint: verified.fingerprint,
    lastError: null,
  };
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

const createSingleFlight = () => {
  let tail = Promise.resolve();
  return <T>(operation: () => Promise<T>): Promise<T> => {
    const run = tail.then(operation, operation);
    tail = run.then(
      () => undefined,
      () => undefined,
    );
    return run;
  };
};

type SessionBox = { value: PreviewSession | null };

const previewSetup = async (
  client: ControlDClient,
  session: SessionBox,
  createToken: () => string,
): Promise<RecognitionResponse> => {
  const current = await loadRecognitionState();
  const plan = await inspect(client, current);
  const reviewed = await rememberReview(current, plan);
  if (plan.blocker || plan.servicePks.length === 0) {
    session.value = null;
    return response(
      false,
      reviewed,
      plan.blocker ?? "Control D returned no services to recognize.",
    );
  }
  const token = createToken();
  session.value = { token, fingerprint: plan.fingerprint };
  return response(true, reviewed, undefined, {
    token,
    profileCreateCount: plan.profileCreateCount,
    endpointCreateCount: plan.endpointCreateCount,
    serviceCount: plan.servicePks.length,
  });
};

const rejectReview = async (
  session: SessionBox,
  current: RecognitionState,
  plan: SetupPlan,
  drifted: boolean,
): Promise<RecognitionResponse> => {
  session.value = null;
  const message = drifted
    ? "Control D changed since the preview. Review it again."
    : (plan.blocker ?? "Control D changed since the preview. Review it again.");
  const next = failureState(current, message, plan.fingerprint);
  await saveRecognitionState(next);
  return response(false, next, message);
};

const applySetup = async (
  client: ControlDClient,
  session: SessionBox,
  previewToken: string,
  createCode: () => string,
): Promise<RecognitionResponse> => {
  const current = await loadRecognitionState();
  const reviewed = session.value;
  if (!reviewed || reviewed.token !== previewToken) {
    return response(
      false,
      current,
      "Preview and review the diagnostic setup before applying.",
    );
  }
  const plan = await inspect(client, current);
  if (plan.fingerprint !== reviewed.fingerprint || plan.blocker) {
    return rejectReview(
      session,
      current,
      plan,
      plan.fingerprint !== reviewed.fingerprint,
    );
  }
  session.value = null;
  const draft: ResourceDraft = {
    code: current.code,
    profileId: plan.profileId,
    endpointId: plan.endpointId,
  };
  try {
    if (!draft.code) {
      draft.code = createCode();
      await savePartial(current, draft);
    }
    const profileId = await ensureProfile(client, current, draft, plan.profileId);
    const endpointId = await ensureEndpoint(client, current, draft, profileId);
    await client.bypassProfileServices(profileId, plan.servicePks);
    const ready = await verifiedSetup(
      client,
      { ...draft, profileId, endpointId },
      plan.servicePks,
    );
    await saveRecognitionState(ready);
    return response(true, ready);
  } catch (error) {
    const failed = failureState(current, errorMessage(error), plan.fingerprint);
    const partial = keepsResolver(current.phase)
      ? failed
      : {
          ...failed,
          phase: "error" as const,
          code: draft.code,
          profileId: draft.profileId,
          endpointId: draft.endpointId,
          resolverDoh: null,
        };
    await saveRecognitionState(partial);
    return response(false, partial, errorMessage(error));
  }
};

const openRecognition = (
  deps: RecognitionDeps = {},
): { respond: (input: unknown) => Promise<RecognitionResponse> } => {
  const flight = createSingleFlight();
  const session: SessionBox = { value: null };
  const loadApiKey = deps.loadApiKey ?? loadControlDApiKey;
  const createToken = deps.createToken ?? (() => crypto.randomUUID());
  const createCode = deps.createCode ?? generateResourceCode;
  const openClient = async (): Promise<ControlDClient | null> => {
    const apiKey = await loadApiKey();
    return apiKey ? new ControlDClient(apiKey, deps.fetchImpl ?? fetch) : null;
  };

  return {
    respond: (input) =>
      flight(async () => {
        const current = await loadRecognitionState();
        if (!isDiagnosticCommand(input)) {
          return response(false, current, "Unknown diagnostic command.");
        }
        if (input.type === DIAGNOSTIC_COMMANDS.getState) return response(true, current);
        try {
          const client = await openClient();
          if (!client) {
            return response(false, current, "Connect a Control D API key first.");
          }
          return input.type === DIAGNOSTIC_COMMANDS.preview
            ? await previewSetup(client, session, createToken)
            : await applySetup(client, session, input.previewToken, createCode);
        } catch (error) {
          const failed = failureState(current, errorMessage(error), null);
          await saveRecognitionState(failed);
          return response(false, failed, errorMessage(error));
        }
      }),
  };
};

export { openRecognition as createRecognitionController };
