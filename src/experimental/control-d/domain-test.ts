import { redactControlDLogValue } from "./redaction";

const DOH_ORIGIN = "https://dns.controld.com";
const RESOLVER_ID = /^[A-Za-z0-9_-]{1,128}$/;
const DNS_STATUS_MAX = 15;

export type ControlDDomainStatus = "matched" | "overridden" | "unresolved";

export type ControlDDomainResult = {
  hostname: string;
  status: ControlDDomainStatus;
  serviceId: string | null;
};

export type ControlDQueryFailure =
  | "rejected-url"
  | "timeout"
  | "transport"
  | "http"
  | "invalid-json"
  | "malformed-status";

export type ControlDQueryTransport = {
  fetchImpl: typeof fetch;
  token: string;
  resolverId: string;
  hostname: string;
  timeoutMs: number;
};

export type ControlDQueryOutcome =
  | { ok: true; result: ControlDDomainResult }
  | {
      ok: false;
      failure: ControlDQueryFailure;
      status: number;
      requestId: string | null;
      causeMessage: string | null;
    };

const recordValue = (value: unknown): Record<string, unknown> | null =>
  value !== null && typeof value === "object" && !Array.isArray(value)
    ? (value as Record<string, unknown>)
    : null;

const hasRejectedHostnameChar = (value: string): boolean =>
  Array.from(value).some((character) => {
    const code = character.codePointAt(0) ?? 0;
    return code <= 32 || "/?#@\\:".includes(character);
  });

const isHostname = (value: string): boolean =>
  value.length > 0 &&
  value.length <= 253 &&
  !value.startsWith(".") &&
  !value.endsWith(".") &&
  !value.includes("..") &&
  !hasRejectedHostnameChar(value);

const isAllowedDohUrl = (url: URL): boolean =>
  url.origin === DOH_ORIGIN &&
  url.protocol === "https:" &&
  url.hostname === "dns.controld.com" &&
  url.port === "" &&
  url.username === "" &&
  url.password === "";

const serviceIdValue = (value: unknown): string | null => {
  if (typeof value === "number" && Number.isFinite(value)) return String(value);
  return typeof value === "string" && value.trim().length > 0 ? value : null;
};

const dnsStatus = (payload: unknown): number | null => {
  const status = recordValue(payload)?.Status;
  return typeof status === "number" &&
    Number.isInteger(status) &&
    status >= 0 &&
    status <= DNS_STATUS_MAX
    ? status
    : null;
};

const failure = (
  kind: ControlDQueryFailure,
  status: number,
  requestId: string | null,
  causeMessage: string | null,
): ControlDQueryOutcome => ({
  ok: false,
  failure: kind,
  status,
  requestId,
  causeMessage,
});

const requestIdFrom = (response: Response): string | null =>
  response.headers.get("x-request-id") ?? response.headers.get("cf-ray");

const causeMessageFrom = (error: unknown, token: string): string => {
  const raw =
    error instanceof Error ? `${error.name}: ${error.message}` : String(error);
  const redacted = redactControlDLogValue(raw, token);
  return (typeof redacted === "string" ? redacted : "Error").slice(0, 240);
};

// A winning service id is positive membership. Custom and global rules replace
// that verdict. Global rules cannot be turned off from a lookup profile, so an
// overridden result is the safe outcome. Every other source stays unknown.
const recognitionFrom = (hostname: string, payload: unknown): ControlDDomainResult => {
  const verdict = recordValue(recordValue(recordValue(payload)?.controld)?.verdict);
  const serviceId = serviceIdValue(verdict?.verdictMatch);
  if (verdict?.verdictSource === "svc" && serviceId) {
    return { hostname, status: "matched", serviceId };
  }
  if (verdict?.verdictSource === "rules" || verdict?.verdictSource === "grules") {
    return { hostname, status: "overridden", serviceId: null };
  }
  return { hostname, status: "unresolved", serviceId: null };
};

export const controlDDomainQueryUrl = (
  resolverId: string,
  hostname: string,
): string | null => {
  if (!RESOLVER_ID.test(resolverId) || !isHostname(hostname)) return null;
  const url = new URL(`${DOH_ORIGIN}/${encodeURIComponent(resolverId)}`);
  url.searchParams.set("name", hostname);
  url.searchParams.set("type", "A");
  url.searchParams.set("controld", "1");
  url.searchParams.set("no_log", "1");
  return isAllowedDohUrl(url) ? url.toString() : null;
};

export const interpretControlDQuery = (
  hostname: string,
  payload: unknown,
): ControlDDomainResult | null => {
  const status = dnsStatus(payload);
  if (status === null) return null;
  // NXDOMAIN and other errors can still carry a stale service verdict.
  if (status !== 0) return { hostname, status: "unresolved", serviceId: null };
  return recognitionFrom(hostname, payload);
};

export const controlDQueryMessage = (
  kind: ControlDQueryFailure,
  status: number,
): string => {
  switch (kind) {
    case "timeout":
      return "Control D domain query timed out.";
    case "invalid-json":
      return "Control D domain query returned invalid JSON.";
    case "malformed-status":
      return "Control D domain query returned a malformed DNS status.";
    case "http":
      return `Control D rejected query domain (HTTP ${status}).`;
    case "rejected-url":
      return "Control D domain query URL was rejected.";
    case "transport":
      return "Control D domain query failed.";
  }
};

const readDomainPayload = async (
  response: Response,
  hostname: string,
): Promise<ControlDQueryOutcome> => {
  const requestId = requestIdFrom(response);
  if (!response.ok) {
    await response.text();
    return failure("http", response.status, requestId, null);
  }
  const responseText = await response.text();
  let payload: unknown;
  try {
    payload = JSON.parse(responseText) as unknown;
  } catch {
    return failure("invalid-json", response.status, requestId, null);
  }
  const result = interpretControlDQuery(hostname, payload);
  return result
    ? { ok: true, result }
    : failure("malformed-status", response.status, requestId, null);
};

export const executeControlDQuery = async ({
  fetchImpl,
  token,
  resolverId,
  hostname,
  timeoutMs,
}: ControlDQueryTransport): Promise<ControlDQueryOutcome> => {
  const url = controlDDomainQueryUrl(resolverId, hostname);
  const parsed = url ? new URL(url) : null;
  if (!url || !parsed || !isAllowedDohUrl(parsed)) {
    return failure("rejected-url", 0, null, null);
  }
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), timeoutMs);
  try {
    const response = await fetchImpl.call(globalThis, url, {
      headers: {
        Accept: "application/dns+json",
        Authorization: `Bearer ${token}`,
      },
      redirect: "error",
      signal: controller.signal,
    });
    return await readDomainPayload(response, hostname);
  } catch (error) {
    const timedOut = error instanceof DOMException && error.name === "AbortError";
    return failure(
      timedOut ? "timeout" : "transport",
      0,
      null,
      timedOut ? null : causeMessageFrom(error, token),
    );
  } finally {
    clearTimeout(timer);
  }
};
