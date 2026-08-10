import { EXTENSION_STORAGE_KEYS } from "@/shared/extension-contract";
import type { SeenHostRecord } from "@/shared/types";

export const SEEN_HOSTS_STORAGE_KEY = EXTENSION_STORAGE_KEYS.seenHosts;
export const SEEN_HOSTS_TTL_MS = 30 * 24 * 60 * 60 * 1000;
export const MAX_SEEN_HOSTS = 1000;

const normalizeCookieStoreId = (value: string | undefined): string | undefined => {
  const normalizedValue = value?.trim();
  return normalizedValue ? normalizedValue : undefined;
};

const normalizeExactOrigin = (value: unknown): string | undefined => {
  if (typeof value !== "string") {
    return undefined;
  }

  const trimmed = value.trim();
  if (!trimmed) {
    return undefined;
  }

  try {
    const url = new URL(trimmed);
    if (url.protocol !== "http:" && url.protocol !== "https:") {
      return undefined;
    }

    return url.origin.toLowerCase();
  } catch {
    return undefined;
  }
};

const normalizeSeenHostRecord = (value: unknown): SeenHostRecord | null => {
  if (!value || typeof value !== "object") {
    return null;
  }

  const hostname =
    typeof (value as { hostname?: unknown }).hostname === "string"
      ? (value as { hostname: string }).hostname.trim().toLowerCase()
      : "";
  const identityKind =
    (value as { identityKind?: unknown }).identityKind === "rule" ||
    (value as { identityKind?: unknown }).identityKind === "container" ||
    (value as { identityKind?: unknown }).identityKind === "fallback"
      ? (value as { identityKind: "rule" | "container" | "fallback" }).identityKind
      : null;
  const identitySeedKey =
    typeof (value as { identitySeedKey?: unknown }).identitySeedKey === "string"
      ? (value as { identitySeedKey: string }).identitySeedKey.trim().toLowerCase()
      : "";
  const lastSeenAt =
    typeof (value as { lastSeenAt?: unknown }).lastSeenAt === "string"
      ? (value as { lastSeenAt: string }).lastSeenAt
      : "";
  const exactOrigin = normalizeExactOrigin(
    (value as { exactOrigin?: unknown }).exactOrigin,
  );

  if (
    !hostname ||
    !identityKind ||
    !identitySeedKey ||
    Number.isNaN(Date.parse(lastSeenAt))
  ) {
    return null;
  }

  const identityPattern =
    typeof (value as { identityPattern?: unknown }).identityPattern === "string"
      ? (value as { identityPattern: string }).identityPattern.trim().toLowerCase()
      : undefined;
  const identityStoreId =
    typeof (value as { identityStoreId?: unknown }).identityStoreId === "string"
      ? normalizeCookieStoreId((value as { identityStoreId: string }).identityStoreId)
      : undefined;
  const cookieStoreId =
    typeof (value as { cookieStoreId?: unknown }).cookieStoreId === "string"
      ? normalizeCookieStoreId((value as { cookieStoreId: string }).cookieStoreId)
      : undefined;

  return {
    hostname,
    ...(exactOrigin ? { exactOrigin } : {}),
    ...(cookieStoreId ? { cookieStoreId } : {}),
    identityKind,
    ...(identityPattern ? { identityPattern } : {}),
    ...(identityStoreId ? { identityStoreId } : {}),
    identitySeedKey,
    lastSeenAt,
  };
};

const getSeenHostKey = (
  record: Pick<SeenHostRecord, "hostname" | "exactOrigin" | "cookieStoreId">,
): string => `${record.exactOrigin ?? record.hostname}|${record.cookieStoreId ?? ""}`;

export const pruneSeenHosts = (
  records: readonly SeenHostRecord[],
  now = Date.now(),
): SeenHostRecord[] => {
  const latestByKey = new Map<string, SeenHostRecord>();

  for (const record of records) {
    const parsed = normalizeSeenHostRecord(record);
    if (!parsed) {
      continue;
    }

    const ageMs = now - Date.parse(parsed.lastSeenAt);
    if (ageMs > SEEN_HOSTS_TTL_MS) {
      continue;
    }

    const key = getSeenHostKey(parsed);
    const existingRecord = latestByKey.get(key);
    if (
      !existingRecord ||
      Date.parse(existingRecord.lastSeenAt) < Date.parse(parsed.lastSeenAt)
    ) {
      latestByKey.set(key, parsed);
    }
  }

  return [...latestByKey.values()]
    .sort((left, right) => Date.parse(right.lastSeenAt) - Date.parse(left.lastSeenAt))
    .slice(0, MAX_SEEN_HOSTS);
};

export const loadSeenHosts = async (): Promise<SeenHostRecord[]> => {
  const data = await chrome.storage.local.get(SEEN_HOSTS_STORAGE_KEY);
  const raw = data[SEEN_HOSTS_STORAGE_KEY];

  if (!Array.isArray(raw)) {
    return [];
  }

  return pruneSeenHosts(raw as SeenHostRecord[]);
};

export const saveSeenHosts = async (
  records: readonly SeenHostRecord[],
): Promise<void> => {
  await chrome.storage.local.set({
    [SEEN_HOSTS_STORAGE_KEY]: pruneSeenHosts(records),
  });
};

export const rememberSeenHost = (
  records: readonly SeenHostRecord[],
  record: Omit<SeenHostRecord, "lastSeenAt">,
  now = new Date(),
): SeenHostRecord[] =>
  pruneSeenHosts(
    [
      ...records.filter((entry) => getSeenHostKey(entry) !== getSeenHostKey(record)),
      {
        ...record,
        lastSeenAt: now.toISOString(),
      },
    ],
    now.getTime(),
  );

type ActiveIdentityLookup =
  | {
      kind: "rule";
      pattern: string;
      ruleSeedKey: string;
    }
  | {
      kind: "container";
      cookieStoreId: string;
      ruleSeedKey: string;
    }
  | {
      kind: "fallback";
      ruleSeedKey: string;
    };

const matchesSeenHostIdentity = (
  record: SeenHostRecord,
  identity: ActiveIdentityLookup,
): boolean => {
  if (identity.kind === "rule") {
    return (
      record.identityKind === "rule" &&
      record.identityPattern === identity.pattern &&
      record.identitySeedKey === identity.ruleSeedKey
    );
  }

  if (identity.kind === "container") {
    return (
      record.identityKind === "container" &&
      record.identityStoreId === identity.cookieStoreId &&
      record.identitySeedKey === identity.ruleSeedKey
    );
  }

  return (
    record.identityKind === "fallback" &&
    record.identitySeedKey === identity.ruleSeedKey
  );
};

const collectSeenHostValues = (
  records: readonly SeenHostRecord[],
  identity: ActiveIdentityLookup,
  getValue: (record: SeenHostRecord) => string | undefined,
): string[] => {
  const values = new Set<string>();

  for (const record of pruneSeenHosts(records)) {
    const value = getValue(record);
    if (!value || !matchesSeenHostIdentity(record, identity)) {
      continue;
    }

    values.add(value);
  }

  return [...values];
};

export const findIdentityHostRecords = (
  records: readonly SeenHostRecord[],
  identity: ActiveIdentityLookup,
): SeenHostRecord[] =>
  pruneSeenHosts(records).filter((record) => matchesSeenHostIdentity(record, identity));

export const findIdentityHosts = (
  records: readonly SeenHostRecord[],
  identity: ActiveIdentityLookup,
): string[] => collectSeenHostValues(records, identity, (record) => record.hostname);

export const findIdentityOrigins = (
  records: readonly SeenHostRecord[],
  identity: ActiveIdentityLookup,
): string[] => collectSeenHostValues(records, identity, (record) => record.exactOrigin);
