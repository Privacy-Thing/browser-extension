import type { ControlDProxyLocation } from "./contracts";
import {
  controlDQueryMessage,
  executeControlDQuery,
  type ControlDDomainResult,
} from "./domain-test";
import { redactControlDLogValue } from "./redaction";
import {
  parseProfileServices,
  parseControlDServices,
  type ControlDProfileService,
  type ControlDService,
} from "./services";

export type { ControlDDomainResult };

const API_BASE = "https://api.controld.com";
const MAX_ATTEMPTS = 3;

type UnknownRecord = Record<string, unknown>;

export class ControlDApiError extends Error {
  // eslint-disable-next-line max-params -- Carries the complete sanitized API failure context.
  constructor(
    message: string,
    readonly status: number,
    readonly requestId: string | null,
    readonly retryAfterSeconds: number | null,
    readonly causeMessage: string | null = null,
    readonly operation: string | null = null,
    readonly apiCode: number | null = null,
  ) {
    super(message);
    this.name = "ControlDApiError";
  }
}

const isRecord = (value: unknown): value is UnknownRecord =>
  Boolean(value) && typeof value === "object" && !Array.isArray(value);

const asRecord = (value: unknown): UnknownRecord => (isRecord(value) ? value : {});
const asArray = (value: unknown): unknown[] => (Array.isArray(value) ? value : []);
const asString = (value: unknown): string | null =>
  typeof value === "string" && value.length > 0 ? value : null;
const profileKey = (value: unknown): string | null => {
  if (value === 0 || value === "0" || value === -1) return null;
  const id = asString(value);
  return id && id !== "-1" ? id : null;
};
const profileIdFromValue = (value: unknown): string | null => {
  if (!isRecord(value)) return profileKey(value);
  return profileKey(value.PK) ?? profileKey(value.pk) ?? profileKey(value.id);
};
const slotProfileId = (profile: unknown, profileId: unknown): string | null =>
  profileIdFromValue(profile) ?? profileIdFromValue(profileId);
const enforcedDeviceProfiles = (record: UnknownRecord): string[] => [
  ...new Set(
    [
      slotProfileId(record.profile, record.profile_id),
      slotProfileId(record.profile2, record.profile_id2),
      slotProfileId(record.profile3, record.profile_id3),
      ...asArray(record.profiles).map(profileIdFromValue),
    ].filter((id): id is string => id !== null),
  ),
];
const asNumber = (value: unknown): number | null => {
  const parsed = typeof value === "number" ? value : Number(value);
  return Number.isFinite(parsed) ? parsed : null;
};

const bodyRecord = (payload: unknown): UnknownRecord =>
  asRecord(asRecord(payload).body);
const extractCollection = (payload: unknown, key: string): unknown[] => {
  const body = bodyRecord(payload);
  return asArray(body[key] ?? asRecord(body.data)[key] ?? asRecord(payload)[key]);
};

const formBody = (
  fields: Record<string, string | number | readonly string[]>,
): URLSearchParams => {
  const body = new URLSearchParams();
  for (const [key, value] of Object.entries(fields)) {
    if (Array.isArray(value)) {
      value.forEach((entry) => body.append(key, entry));
    } else {
      body.set(key, String(value));
    }
  }
  return body;
};

const delay = async (milliseconds: number): Promise<void> => {
  await new Promise<void>((resolve) => setTimeout(resolve, milliseconds));
};

const parseJson = (text: string): unknown => {
  if (!text) return {};
  try {
    return JSON.parse(text) as unknown;
  } catch {
    return {};
  }
};

export type ControlDProfile = { id: string; name: string };
export type ControlDGroup = {
  id: number;
  name: string;
  action: number | null;
  via: string | null;
};
export type ControlDRule = {
  hostname: string;
  groupId: number | null;
  action: number | null;
  via: string | null;
  status: number | null;
  comment: string | null;
};
export type ControlDDevice = {
  id: string;
  name: string;
  profileId: string | null;
  enforcedProfileIds?: readonly string[];
  resolverDoh: string | null;
};

export const deviceProfileIds = (device: ControlDDevice): readonly string[] =>
  device.enforcedProfileIds ?? (device.profileId ? [device.profileId] : []);

export const deviceUsesAnotherProfile = (
  device: ControlDDevice,
  managedProfileId: string | null | undefined,
): boolean => {
  if (!managedProfileId) return false;
  const ids = deviceProfileIds(device);
  return !ids.includes(managedProfileId);
};

const parseRules = (payload: unknown): ControlDRule[] =>
  extractCollection(payload, "rules").flatMap((entry) => {
    const record = asRecord(entry);
    const action = asRecord(record.action);
    const hostname = asString(record.hostname ?? record.host ?? record.PK);
    if (!hostname) return [];
    return [
      {
        hostname,
        groupId: asNumber(record.group ?? record.group_id),
        action: asNumber(record.do ?? action.do),
        via: asString(record.via ?? action.via),
        status: asNumber(record.status ?? action.status),
        comment: asString(record.comment),
      },
    ];
  });

export type ControlDRetryEvent = {
  attempt: number;
  delayMs: number;
  status: number;
  requestId: string | null;
};

export class ControlDClient {
  constructor(
    private readonly token: string,
    private readonly fetchImpl: typeof fetch = fetch,
    private readonly timeoutMs = 12_000,
    private readonly onRetry?: (event: ControlDRetryEvent) => void,
  ) {}

  // eslint-disable-next-line sonarjs/cognitive-complexity -- Retry, timeout, and HTTP policy stay centralized.
  private async request(
    path: string,
    init: RequestInit = {},
    retryable = false,
    operation = "API request",
  ): Promise<unknown> {
    for (let attempt = 1; attempt <= MAX_ATTEMPTS; attempt += 1) {
      const controller = new AbortController();
      const timer = setTimeout(() => controller.abort(), this.timeoutMs);
      try {
        const response = await this.fetchImpl.call(globalThis, `${API_BASE}${path}`, {
          ...init,
          headers: {
            Accept: "application/json",
            Authorization: `Bearer ${this.token}`,
            ...(init.body
              ? { "Content-Type": "application/x-www-form-urlencoded" }
              : {}),
            ...init.headers,
          },
          signal: controller.signal,
        });
        const requestId =
          response.headers.get("x-request-id") ?? response.headers.get("cf-ray");
        const retryAfterHeader = response.headers.get("retry-after");
        const retryAfterSeconds = retryAfterHeader
          ? Number.parseInt(retryAfterHeader, 10)
          : null;
        const responseText = response.status === 204 ? "" : await response.text();
        const payload = parseJson(responseText);

        if (!response.ok) {
          if (
            retryable &&
            (response.status === 429 || response.status >= 500) &&
            attempt < MAX_ATTEMPTS
          ) {
            const delayMs =
              response.status === 429 && Number.isFinite(retryAfterSeconds)
                ? Math.max(0, retryAfterSeconds ?? 0) * 1_000
                : 250 * 2 ** (attempt - 1);
            this.onRetry?.({
              attempt,
              delayMs,
              status: response.status,
              requestId,
            });
            await delay(delayMs);
            continue;
          }
          const apiError = asRecord(asRecord(payload).error);
          const apiCode = asNumber(apiError.code);
          const rawApiMessage = asString(apiError.message);
          const apiMessage = rawApiMessage
            ? String(redactControlDLogValue(rawApiMessage, this.token)).slice(0, 240)
            : null;
          const codeLabel = apiCode === null ? "" : `, code ${apiCode}`;
          const detail = apiMessage ? `: ${apiMessage}` : ".";
          throw new ControlDApiError(
            `Control D rejected ${operation} (HTTP ${response.status}${codeLabel})${detail}`,
            response.status,
            requestId,
            Number.isFinite(retryAfterSeconds) ? retryAfterSeconds : null,
            null,
            operation,
            apiCode,
          );
        }

        return payload;
      } catch (error) {
        if (error instanceof ControlDApiError) throw error;
        if (retryable && attempt < MAX_ATTEMPTS) {
          const delayMs = 250 * 2 ** (attempt - 1);
          this.onRetry?.({ attempt, delayMs, status: 0, requestId: null });
          await delay(delayMs);
          continue;
        }
        throw new ControlDApiError(
          error instanceof DOMException && error.name === "AbortError"
            ? "Control D API request timed out."
            : "Control D API request failed.",
          0,
          null,
          null,
          error instanceof Error ? `${error.name}: ${error.message}` : String(error),
        );
      } finally {
        clearTimeout(timer);
      }
    }
    throw new ControlDApiError("Control D API request failed.", 0, null, null, null);
  }

  async listProfiles(): Promise<ControlDProfile[]> {
    const payload = await this.request("/profiles", {}, true, "list profiles");
    return extractCollection(payload, "profiles").flatMap((entry) => {
      const record = asRecord(entry);
      const id = asString(record.PK ?? record.pk ?? record.id);
      const name = asString(record.name);
      return id && name ? [{ id, name }] : [];
    });
  }

  async listServices(): Promise<ControlDService[]> {
    const payload = await this.request(
      "/services/categories/all",
      {},
      true,
      "list service catalogue",
    );
    const services = parseControlDServices(payload);
    if (!services) {
      throw new ControlDApiError(
        "Control D returned an invalid service catalogue.",
        200,
        null,
        null,
      );
    }
    return services;
  }

  async listProfileServices(profileId: string): Promise<ControlDProfileService[]> {
    const payload = await this.request(
      `/profiles/${encodeURIComponent(profileId)}/services`,
      {},
      true,
      "list profile services",
    );
    const services = parseProfileServices(payload);
    if (!services) {
      throw new ControlDApiError(
        "Control D returned invalid profile services.",
        200,
        null,
        null,
      );
    }
    return services;
  }

  async redirectProfileService(
    profileId: string,
    serviceId: string,
    via: string,
  ): Promise<void> {
    await this.request(
      `/profiles/${encodeURIComponent(profileId)}/services/${encodeURIComponent(serviceId)}`,
      { method: "PUT", body: formBody({ do: 3, status: 1, via }) },
      true,
      "redirect profile service",
    );
  }

  async deleteProfileService(profileId: string, serviceId: string): Promise<void> {
    await this.request(
      `/profiles/${encodeURIComponent(profileId)}/services/${encodeURIComponent(serviceId)}`,
      { method: "DELETE" },
      true,
      "delete profile service",
    );
  }

  async bypassProfileService(profileId: string, servicePk: string): Promise<void> {
    await this.request(
      `/profiles/${encodeURIComponent(profileId)}/services/${encodeURIComponent(servicePk)}`,
      { method: "PUT", body: formBody({ do: 1, status: 1 }) },
      true,
      "bypass profile service",
    );
  }

  // The bearer token is attached only after the DoH URL is confined to
  // https://dns.controld.com. Other origins never receive it.
  async queryDomain(
    resolverId: string,
    hostname: string,
    signal?: AbortSignal,
  ): Promise<ControlDDomainResult> {
    const outcome = await executeControlDQuery({
      fetchImpl: this.fetchImpl,
      token: this.token,
      resolverId,
      hostname,
      timeoutMs: this.timeoutMs,
      ...(signal ? { signal } : {}),
    });
    if (outcome.ok) return outcome.result;
    throw new ControlDApiError(
      controlDQueryMessage(outcome.failure, outcome.status),
      outcome.status,
      outcome.requestId,
      null,
      outcome.causeMessage,
      "query domain",
    );
  }

  async createProfile(name: string): Promise<void> {
    await this.request(
      "/profiles",
      { method: "POST", body: formBody({ name }) },
      false,
      "create profile",
    );
  }

  async setDefaultBypass(profileId: string): Promise<void> {
    await this.request(
      `/profiles/${encodeURIComponent(profileId)}/default`,
      { method: "PUT", body: formBody({ do: 1, status: 1 }) },
      true,
      "set profile default",
    );
  }

  async listGroups(profileId: string): Promise<ControlDGroup[]> {
    const payload = await this.request(
      `/profiles/${encodeURIComponent(profileId)}/groups`,
      {},
      true,
      "list rule folders",
    );
    return extractCollection(payload, "groups").flatMap((entry) => {
      const record = asRecord(entry);
      const id = asNumber(record.PK ?? record.pk ?? record.id);
      const name = asString(record.name ?? record.group);
      return id !== null && name
        ? [
            {
              id,
              name,
              action: asNumber(record.do ?? asRecord(record.action).do),
              via: asString(record.via ?? asRecord(record.action).via),
            },
          ]
        : [];
    });
  }

  async createGroup(profileId: string, name: string, proxyPk: string): Promise<void> {
    await this.request(
      `/profiles/${encodeURIComponent(profileId)}/groups`,
      {
        method: "POST",
        body: formBody({ name, do: 3, via: proxyPk, status: 1 }),
      },
      false,
      "create rule folder",
    );
  }

  async listRules(profileId: string, folderId: number): Promise<ControlDRule[]> {
    const payload = await this.request(
      `/profiles/${encodeURIComponent(profileId)}/rules/${folderId}`,
      {},
      true,
      "list managed rules",
    );
    return parseRules(payload);
  }

  async listCustomRules(profileId: string): Promise<ControlDRule[]> {
    const payload = await this.request(
      `/profiles/${encodeURIComponent(profileId)}/rules/all`,
      {},
      true,
      "list custom rules",
    );
    return parseRules(payload);
  }

  // eslint-disable-next-line max-params -- Mirrors the public API form contract.
  async createRules(
    profileId: string,
    folderId: number,
    proxyPk: string,
    hostnames: readonly string[],
    comment: string,
  ): Promise<void> {
    if (hostnames.length === 0) return;
    await this.request(
      `/profiles/${encodeURIComponent(profileId)}/rules`,
      {
        method: "POST",
        body: formBody({
          do: 3,
          status: 1,
          via: proxyPk,
          group: folderId,
          comment,
          "hostnames[]": hostnames,
        }),
      },
      false,
      "create managed rules",
    );
  }

  // eslint-disable-next-line max-params -- Mirrors the public API form contract.
  async updateRules(
    profileId: string,
    folderId: number,
    proxyPk: string,
    hostnames: readonly string[],
    comment: string,
  ): Promise<void> {
    if (hostnames.length === 0) return;
    await this.request(
      `/profiles/${encodeURIComponent(profileId)}/rules`,
      {
        method: "PUT",
        body: formBody({
          do: 3,
          status: 1,
          via: proxyPk,
          group: folderId,
          comment,
          "hostnames[]": hostnames,
        }),
      },
      true,
      "update managed rules",
    );
  }

  async deleteRule(profileId: string, hostname: string): Promise<void> {
    await this.request(
      `/profiles/${encodeURIComponent(profileId)}/rules/${encodeURIComponent(hostname)}`,
      { method: "DELETE" },
      true,
      "delete managed rule",
    );
  }

  async listProxies(): Promise<ControlDProxyLocation[]> {
    const payload = await this.request("/proxies", {}, true, "list proxy locations");
    return extractCollection(payload, "proxies").flatMap((entry) => {
      const record = asRecord(entry);
      const pk = asString(record.PK ?? record.pk ?? record.uid);
      const city = asString(record.city);
      const countryCode = asString(record.country);
      const countryName = asString(record.country_name) ?? countryCode;
      const latitude = asNumber(record.gps_lat);
      const longitude = asNumber(record.gps_long);
      const hidden = record.hidden === true || record.hidden === 1;
      return pk &&
        city &&
        countryCode &&
        latitude !== null &&
        longitude !== null &&
        !hidden
        ? [
            {
              pk,
              city,
              countryCode: countryCode.toUpperCase(),
              countryName: countryName ?? countryCode,
              latitude,
              longitude,
            },
          ]
        : [];
    });
  }

  async listDevices(): Promise<ControlDDevice[]> {
    const payload = await this.request("/devices", {}, true, "list endpoints");
    return extractCollection(payload, "devices").flatMap((entry) => {
      const record = asRecord(entry);
      const resolvers = asRecord(record.resolvers);
      const enforcedProfileIds = enforcedDeviceProfiles(record);
      const id = asString(record.PK ?? record.pk ?? record.id);
      const name = asString(record.name);
      return id && name
        ? [
            {
              id,
              name,
              profileId: enforcedProfileIds[0] ?? null,
              enforcedProfileIds,
              resolverDoh: asString(resolvers.doh ?? record.doh),
            },
          ]
        : [];
    });
  }

  async listDeviceTypes(): Promise<string[]> {
    const payload = await this.request(
      "/devices/types",
      {},
      true,
      "list endpoint types",
    );
    const types = bodyRecord(payload).types;
    const entries = extractCollection(payload, "types");
    const arrayIds = entries.flatMap((entry) => {
      if (typeof entry === "string" && entry) return [entry];
      const record = asRecord(entry);
      const value = asString(record.id ?? record.PK ?? record.value ?? record.slug);
      return value ? [value] : [];
    });
    const typeGroups = asRecord(types);
    const flatIds = Object.entries(typeGroups).flatMap(([id, value]) =>
      typeof value === "string" ? [id] : [],
    );
    const nestedIds = Object.values(typeGroups).flatMap((group) =>
      Object.keys(asRecord(asRecord(group).icons)),
    );
    return [...new Set([...arrayIds, ...flatIds, ...nestedIds])];
  }

  async createDevice(
    name: string,
    profileId: string,
    icon: string,
    options?: { readonly stats?: number; readonly learnIp?: number },
  ): Promise<ControlDDevice | null> {
    const fields: Record<string, string | number> = {
      name,
      client_count: 1,
      profile_id: profileId,
      icon,
    };
    // stats and learn_ip are opt-in so the browser DNS endpoint keeps its previous body.
    if (options?.stats !== undefined) fields.stats = options.stats;
    if (options?.learnIp !== undefined) fields.learn_ip = options.learnIp;
    const payload = await this.request(
      "/devices",
      { method: "POST", body: formBody(fields) },
      false,
      "create endpoint",
    );
    const candidates = [
      ...extractCollection(payload, "devices"),
      bodyRecord(payload).device,
      bodyRecord(payload),
    ];
    for (const entry of candidates) {
      const record = asRecord(entry);
      const id = asString(record.PK ?? record.pk ?? record.id);
      const resolvers = asRecord(record.resolvers);
      const resolverDoh = asString(resolvers.doh ?? record.doh);
      if (id)
        return { id, name, profileId, enforcedProfileIds: [profileId], resolverDoh };
    }
    return null;
  }
}
