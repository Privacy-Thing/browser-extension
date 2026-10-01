const SECRET_FIELD = /authorization|api[-_ ]?key|token|secret/i;
const BEARER = /Bearer\s+\S+/gi;
const CONTROL_D_URL = /https:\/\/[^\s"'<>]*controld\.com\/[^\s"'<>]*/gi;

const redactString = (value: string, apiKey?: string): string => {
  let redacted = value.replace(CONTROL_D_URL, "[CONTROL_D_URL_REDACTED]");
  redacted = redacted.replace(BEARER, "Bearer [REDACTED]");
  if (apiKey) redacted = redacted.split(apiKey).join("[REDACTED]");
  return redacted;
};

export const redactControlDLogValue = (value: unknown, apiKey?: string): unknown => {
  if (typeof value === "string") return redactString(value, apiKey);
  if (Array.isArray(value)) {
    return value.map((entry) => redactControlDLogValue(entry, apiKey));
  }
  if (!value || typeof value !== "object") return value;

  return Object.fromEntries(
    Object.entries(value as Record<string, unknown>).map(([key, entry]) => [
      key,
      SECRET_FIELD.test(key) ? "[REDACTED]" : redactControlDLogValue(entry, apiKey),
    ]),
  );
};
