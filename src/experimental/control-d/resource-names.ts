const MAX_RESOURCE_NAME_LENGTH = 32;

const fnv1a = (value: string): string => {
  let hash = 0x811c9dc5;
  for (const byte of new TextEncoder().encode(value)) {
    hash ^= byte;
    hash = Math.imul(hash, 0x01000193);
  }
  return (hash >>> 0).toString(16).padStart(8, "0");
};

const instanceKey = (instanceId: string): string => {
  const compact = instanceId.replaceAll(/[^a-z0-9]/gi, "").toLowerCase();
  return compact.padEnd(16, fnv1a(instanceId)).slice(0, 16);
};

const browserKey = (browserTarget: string): string => {
  if (browserTarget === "chromium") return "chr";
  if (browserTarget === "firefox") return "ff";
  return fnv1a(browserTarget).slice(0, 3);
};

const assertValidName = (name: string): string => {
  if (name.length > MAX_RESOURCE_NAME_LENGTH) {
    throw new Error("Generated Control D resource name exceeds 32 characters.");
  }
  return name;
};

export const controlDProfileName = (instanceId: string): string =>
  assertValidName(`Privacy Thing ${instanceKey(instanceId)}`);

export const controlDEndpointName = (
  instanceId: string,
  browserTarget: string,
): string =>
  assertValidName(`PT ${browserKey(browserTarget)} ${instanceKey(instanceId)}`);

export const controlDFolderName = (instanceId: string, proxyPk: string): string =>
  assertValidName(`PT ${instanceKey(instanceId)} ${fnv1a(proxyPk)}`);

export const controlDRuleComment = (instanceId: string): string =>
  `PT ${instanceKey(instanceId)}`;
