import { capturedStringTrim } from "@/injection/main/iframe-realm-ownership";

const isAsciiCaseInsensitive = (value: unknown, expected: string): value is string => {
  if (typeof value !== "string" || value.length !== expected.length) {
    return false;
  }

  for (let index = 0; index < expected.length; index += 1) {
    const actual = value.charCodeAt(index);
    const target = expected.charCodeAt(index);
    if (actual !== target && actual !== target - 32) {
      return false;
    }
  }
  return true;
};

export const isIframeSrcAttribute = (value: unknown): value is string =>
  isAsciiCaseInsensitive(value, "src");

export const isIframeSrcdocAttribute = (value: unknown): value is string =>
  isAsciiCaseInsensitive(value, "srcdoc");

export const sameOriginSeedHostname = (
  value: unknown,
  baseUrl: string,
  ownerOrigin: string,
): string | null => {
  if (typeof value !== "string" || capturedStringTrim(value) === "") {
    return null;
  }

  try {
    const destination = new URL(value, baseUrl);
    return destination.origin === ownerOrigin ? destination.hostname : null;
  } catch {
    return null;
  }
};
