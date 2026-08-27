export type NotificationChannel = "release" | "beta";

const RELEASE_VERSION_PATTERN = /^\d+\.\d+\.\d+(?:\.\d+)?$/;
const PRODUCT_VERSION_PATTERN = /^\d+\.\d+\.\d+$/;
const BETA_VERSION_PATTERN = /^0\.\d{4}\.\d{3,4}\.\d{1,4}$/;

const isBetaVersion = (version: string): boolean => {
  if (!BETA_VERSION_PATTERN.test(version)) return false;
  const [, yearPart, monthDayPart, hourMinutePart] = version.split(".");
  const year = Number(yearPart);
  const monthDay = Number(monthDayPart);
  const hourMinute = Number(hourMinutePart);
  const month = Math.floor(monthDay / 100);
  const day = monthDay % 100;
  const hour = Math.floor(hourMinute / 100);
  const minute = hourMinute % 100;
  const date = new Date(Date.UTC(year, month - 1, day));
  return (
    date.getUTCFullYear() === year &&
    date.getUTCMonth() === month - 1 &&
    date.getUTCDate() === day &&
    hour >= 0 &&
    hour <= 23 &&
    minute >= 0 &&
    minute <= 59
  );
};

export const isNotificationVersion = (
  channel: NotificationChannel,
  version: string,
): boolean =>
  channel === "release"
    ? RELEASE_VERSION_PATTERN.test(version)
    : isBetaVersion(version);

/** Catalog entries announce product releases, never metadata revisions. */
export const isCatalogNoticeVersion = (
  channel: NotificationChannel,
  version: string,
): boolean =>
  channel === "release"
    ? PRODUCT_VERSION_PATTERN.test(version)
    : isBetaVersion(version);

const parseVersion = (
  channel: NotificationChannel,
  version: string,
): number[] | null => {
  if (!isNotificationVersion(channel, version)) return null;
  const parts = version.split(".").map(Number);
  // Release notices belong to the product version X.Y.Z. Metadata revisions
  // (X.Y.Z.REV) share that generation and must not age or replace it.
  return channel === "release" ? parts.slice(0, 3) : parts;
};

export const compareNoticeVersions = (
  channel: NotificationChannel,
  left: string,
  right: string,
): -1 | 0 | 1 | null => {
  const leftParts = parseVersion(channel, left);
  const rightParts = parseVersion(channel, right);
  if (!leftParts || !rightParts) return null;

  const length = Math.max(leftParts.length, rightParts.length);
  for (let index = 0; index < length; index += 1) {
    const leftPart = leftParts[index] ?? 0;
    const rightPart = rightParts[index] ?? 0;
    if (leftPart < rightPart) return -1;
    if (leftPart > rightPart) return 1;
  }
  return 0;
};
