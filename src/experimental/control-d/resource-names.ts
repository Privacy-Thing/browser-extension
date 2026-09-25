const MAX_RESOURCE_NAME_LENGTH = 32;
const CODE_ALPHABET = "0123456789ABCDEFGHJKMNPQRSTVWXYZ";
const CODE_PATTERN = /^[0-9A-HJKMNP-TV-Z]{5}-[0-9A-HJKMNP-TV-Z]{5}$/;

const fnv1a = (value: string): number => {
  let hash = 0x811c9dc5;
  for (const byte of new TextEncoder().encode(value)) {
    hash ^= byte;
    hash = Math.imul(hash, 0x01000193);
  }
  return hash >>> 0;
};

const encodeBase32 = (value: number, length: number): string => {
  let remaining = value >>> 0;
  let result = "";
  for (let index = 0; index < length; index += 1) {
    result = CODE_ALPHABET[remaining & 31] + result;
    remaining >>>= 5;
  }
  return result;
};

export const isControlDResourceCode = (value: string): boolean =>
  CODE_PATTERN.test(value);

export const generateResourceCode = (): string => {
  const bytes = crypto.getRandomValues(new Uint8Array(7));
  let bits = 0n;
  for (const byte of bytes) bits = (bits << 8n) | BigInt(byte);
  bits &= (1n << 50n) - 1n;
  let compact = "";
  for (let index = 0; index < 10; index += 1) {
    compact = CODE_ALPHABET[Number(bits & 31n)] + compact;
    bits >>= 5n;
  }
  return `${compact.slice(0, 5)}-${compact.slice(5)}`;
};

const assertCode = (code: string): string => {
  if (!isControlDResourceCode(code))
    throw new Error("Invalid Control D resource code.");
  return code;
};

const assertValidName = (name: string): string => {
  if (name.length > MAX_RESOURCE_NAME_LENGTH) {
    throw new Error("Generated Control D resource name exceeds 32 characters.");
  }
  return name;
};

const routeToken = (proxyPk: string): string => {
  const normalized = proxyPk
    .trim()
    .toUpperCase()
    .replaceAll(/[^0-9A-Z]+/g, "-")
    .replaceAll(/^-|-$/g, "");
  if (normalized && normalized.length <= 17) return normalized;
  const prefix = (normalized || "ROUTE").slice(0, 12);
  return `${prefix}-${encodeBase32(fnv1a(proxyPk), 4)}`;
};

export const controlDProfileName = (code: string): string =>
  assertValidName(`Privacy Thing ${assertCode(code)}`);

export const controlDEndpointName = (code: string, browserTarget: string): string =>
  assertValidName(
    `PT ${browserTarget === "firefox" ? "Firefox" : "Browser"} ${assertCode(code)}`,
  );

export const controlDFolderName = (code: string, proxyPk: string): string =>
  assertValidName(`PT ${assertCode(code)} ${routeToken(proxyPk)}`);

export const controlDRuleComment = (code: string): string => `PT ${assertCode(code)}`;

export const parseControlDProfileCode = (name: string): string | null => {
  const match = /^Privacy Thing ([0-9A-HJKMNP-TV-Z]{5}-[0-9A-HJKMNP-TV-Z]{5})$/.exec(
    name,
  );
  return match?.[1] ?? null;
};

export const isControlDEndpointName = (name: string, code: string): boolean =>
  name === `PT Browser ${code}` || name === `PT Firefox ${code}`;

export const isControlDFolderName = (
  name: string,
  code: string,
  proxyPk: string,
): boolean => name === controlDFolderName(code, proxyPk);
