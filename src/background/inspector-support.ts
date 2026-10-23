import type { SpoofingSurfaceMethodId } from "@/shared/spoofing-surfaces";

/** Existing Firefox Date/Intl early wrappers report only category activity.
 * They cannot select an individual method without adding a new wrapper hook.
 * Temporal uses the shared method emitter and is independently selectable.
 */
export const FX_TRAP_EXCLUSIONS = {
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
