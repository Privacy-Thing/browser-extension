import { createHash } from "node:crypto";

export const deriveChromiumExtId = (extensionPath: string): string => {
  const idBytes = createHash("sha256").update(extensionPath).digest().subarray(0, 16);

  return Array.from(
    idBytes,
    (byte) =>
      `${String.fromCharCode(97 + (byte >> 4))}${String.fromCharCode(97 + (byte & 0x0f))}`,
  ).join("");
};
