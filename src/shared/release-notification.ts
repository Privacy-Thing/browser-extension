import { BRAND_DISPLAY_NAME } from "@/shared/brand";
import notificationCatalog from "@/shared/extension-notifications.json";
import {
  compareNoticeVersions,
  isCatalogNoticeVersion,
  type NotificationChannel,
} from "@/shared/notification-version";

const DEFAULT_NOTICE_LOCALE = "en";
const BRAND_TOKEN = "{{brand}}";

const resolveBrandTokens = (value: string): string =>
  value.replaceAll(BRAND_TOKEN, BRAND_DISPLAY_NAME);

type LocalizedText = Readonly<Record<string, string>>;
type LocalizedParagraphs = Readonly<Record<string, readonly string[]>>;

export type ReleaseNotice = {
  id: string;
  channel: NotificationChannel;
  introducedInVersion: string;
  title: string;
  message: readonly string[];
  actionUrl?: string;
};

type NoticeCatalogEntry = {
  id: string;
  channel: NotificationChannel;
  introducedInVersion: string;
  title: LocalizedText;
  message: LocalizedParagraphs;
  actionUrl?: string;
};

const isNonEmptyString = (value: unknown): value is string =>
  typeof value === "string" && value.trim().length > 0;

const isLocalizedText = (value: unknown): value is LocalizedText => {
  if (!value || typeof value !== "object" || Array.isArray(value)) return false;
  const entries = Object.entries(value);
  return (
    entries.length > 0 &&
    entries.every(
      ([locale, text]) => isNonEmptyString(locale) && isNonEmptyString(text),
    )
  );
};

const isLocalizedParagraphs = (value: unknown): value is LocalizedParagraphs => {
  if (!value || typeof value !== "object" || Array.isArray(value)) return false;
  const entries = Object.entries(value);
  return (
    entries.length > 0 &&
    entries.every(
      ([locale, paragraphs]) =>
        isNonEmptyString(locale) &&
        Array.isArray(paragraphs) &&
        paragraphs.length > 0 &&
        paragraphs.every(isNonEmptyString),
    )
  );
};

const hasMatchingLocales = (
  title: LocalizedText,
  message: LocalizedParagraphs,
): boolean => {
  const titleLocales = Object.keys(title).sort();
  const messageLocales = Object.keys(message).sort();
  return (
    titleLocales.length === messageLocales.length &&
    titleLocales.every((locale, index) => locale === messageLocales[index])
  );
};

const isCatalogEntry = (value: unknown): value is NoticeCatalogEntry => {
  if (!value || typeof value !== "object") return false;
  const entry = value as Partial<NoticeCatalogEntry>;
  return (
    isNonEmptyString(entry.id) &&
    (entry.channel === "release" || entry.channel === "beta") &&
    isNonEmptyString(entry.introducedInVersion) &&
    isCatalogNoticeVersion(entry.channel, entry.introducedInVersion) &&
    isLocalizedText(entry.title) &&
    isLocalizedParagraphs(entry.message) &&
    Object.hasOwn(entry.title, DEFAULT_NOTICE_LOCALE) &&
    Object.hasOwn(entry.message, DEFAULT_NOTICE_LOCALE) &&
    hasMatchingLocales(entry.title, entry.message) &&
    (entry.actionUrl === undefined || isNonEmptyString(entry.actionUrl))
  );
};

const getLocaleCandidates = (locale: string): string[] => {
  const normalized = locale.trim();
  const base = normalized.split("-")[0];
  return [...new Set([normalized, ...(base ? [base] : []), DEFAULT_NOTICE_LOCALE])];
};

const resolveLocalizedValue = <T>(
  values: Readonly<Record<string, T>>,
  locale: string,
): T => {
  for (const candidate of getLocaleCandidates(locale)) {
    const value = values[candidate];
    if (value !== undefined) return value;
  }
  const fallback = Object.values(values)[0];
  if (fallback === undefined) {
    throw new Error("Extension notification has no localized content.");
  }
  return fallback;
};

export const parseNoticeCatalog = (value: unknown): readonly NoticeCatalogEntry[] => {
  if (!value || typeof value !== "object") {
    throw new Error("Extension notification catalog must be an object.");
  }
  const notifications = (value as { notifications?: unknown }).notifications;
  if (!Array.isArray(notifications)) {
    throw new Error(
      "Extension notification catalog must contain a notifications array.",
    );
  }

  const entries = notifications.map((entry, index) => {
    if (!isCatalogEntry(entry)) {
      throw new Error(`Invalid extension notification at index ${index}.`);
    }
    return entry;
  });
  const ids = new Set<string>();
  for (const entry of entries) {
    if (ids.has(entry.id)) {
      throw new Error(`Duplicate extension notification ID: ${entry.id}`);
    }
    ids.add(entry.id);
  }
  return entries;
};

const catalogEntries = parseNoticeCatalog(notificationCatalog);

const catalogEntriesById = new Map(
  catalogEntries.map((entry) => [entry.id, entry] as const),
);

const localizeCatalogEntry = (
  entry: NoticeCatalogEntry,
  locale: string,
): ReleaseNotice => ({
  id: entry.id,
  channel: entry.channel,
  introducedInVersion: entry.introducedInVersion,
  title: resolveBrandTokens(resolveLocalizedValue(entry.title, locale)),
  message: resolveLocalizedValue(entry.message, locale).map(resolveBrandTokens),
  ...(entry.actionUrl ? { actionUrl: entry.actionUrl } : {}),
});

/** English catalog view retained for tooling and simple catalog inspection. */
export const RELEASE_NOTICES: Readonly<Record<string, ReleaseNotice>> =
  Object.fromEntries(
    catalogEntries.map((entry) => [
      entry.id,
      localizeCatalogEntry(entry, DEFAULT_NOTICE_LOCALE),
    ]),
  );

export const getReleaseNotice = (
  id: string,
  locale = DEFAULT_NOTICE_LOCALE,
): ReleaseNotice | null => {
  const entry = catalogEntriesById.get(id);
  return entry ? localizeCatalogEntry(entry, locale) : null;
};

export const getVersionNotices = (
  channel: NotificationChannel,
  version: string,
  locale = DEFAULT_NOTICE_LOCALE,
): ReleaseNotice[] =>
  catalogEntries
    .filter(
      (entry) =>
        entry.channel === channel &&
        compareNoticeVersions(channel, entry.introducedInVersion, version) === 0,
    )
    .map((entry) => localizeCatalogEntry(entry, locale));

export const getAllReleaseNotices = (locale = DEFAULT_NOTICE_LOCALE): ReleaseNotice[] =>
  catalogEntries.map((entry) => localizeCatalogEntry(entry, locale));
