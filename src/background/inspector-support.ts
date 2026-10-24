import type { SpoofingSurfaceMethodId } from "@/shared/spoofing-surfaces";
import type { RuntimeSnapshot } from "@/shared/types";

/** Existing Firefox Date/Intl early wrappers report only category activity.
 * They cannot select an individual method without adding a new wrapper hook.
 * Temporal uses the shared method emitter and is independently selectable.
 */
export const FX_TRAP_EXCLUSIONS = {
  "navigator.deviceMemory": "Firefox has no native deviceMemory getter.",
  "date.constructor": "Early Date adapter has no method hook.",
  "date.now": "Early Date adapter has no method hook.",
  "date.parse": "Early Date adapter has no method hook.",
  "date.getTimezoneOffset": "Early Date adapter has no method hook.",
  "date.toString": "Early Date adapter has no method hook.",
  "date.toLocaleString": "Early Date adapter has no method hook.",
  "intl.constructor": "Early Intl adapter has no method hook.",
  "intl.resolvedOptions": "Early Intl adapter has no method hook.",
  "intl.DateTimeFormat.format": "Early Intl adapter has no method hook.",
  "intl.DateTimeFormat.formatToParts": "Early Intl adapter has no method hook.",
} satisfies Partial<Record<SpoofingSurfaceMethodId, string>>;

const hasScreenPayload = (id: string, snapshot: RuntimeSnapshot): boolean => {
  const aliases: Record<string, string> = {
    availWidth: "width",
    availHeight: "height",
    pixelDepth: "colorDepth",
  };
  const property = id.slice(7);
  const screen = snapshot.fingerprint?.screen;
  const key = (aliases[property] ?? property) as keyof NonNullable<typeof screen>;
  return typeof screen?.[key] === "number";
};

/** Only methods for which the winning payload installs a replacement can pause. */
export const hasTrapPayload = (
  id: SpoofingSurfaceMethodId,
  snapshot: RuntimeSnapshot,
): boolean => {
  const fingerprint = snapshot.fingerprint;
  if (id.startsWith("navigator.") && id !== "navigator.webdriver") {
    const value = fingerprint?.[id.slice(10) as keyof NonNullable<typeof fingerprint>];
    return typeof value === "number" || (typeof value === "string" && value.length > 0);
  }
  if (id.startsWith("screen.")) return hasScreenPayload(id, snapshot);
  switch (id.split(".")[0]) {
    case "clientHints":
      return fingerprint?.clientHints !== undefined;
    case "canvas":
      return typeof fingerprint?.canvasNoiseSeed === "number";
    case "audio":
      return typeof fingerprint?.audioNoiseSeed === "number";
    case "webGL":
      return fingerprint?.webGL !== undefined;
    default:
      return true;
  }
};
