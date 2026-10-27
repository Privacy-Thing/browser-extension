import { BRAND_DISPLAY_NAME } from "@/shared/brand";

export const sharedWorkerModeCopy = {
  native: {
    label: "Native",
    description: `Runs Shared Workers normally, without ${BRAND_DISPLAY_NAME} protection. This offers the best compatibility, but a worker can read your real browser values.`,
  },
  spoof: {
    label: "Spoof",
    description: `Tries an alternate protection method for Shared Workers. Some workers may still fail to start.`,
  },
  strict: {
    label: "Strict",
    description: `Blocks a Shared Worker unless ${BRAND_DISPLAY_NAME} can confirm spoofing before it starts. This prevents an unspoofed Shared Worker from seeing native browser values, but features that depend on that worker may not work.`,
  },
} as const;

export const workerHandlingModeCopy = {
  native: {
    label: "Native",
    description: `Runs Dedicated and Shared Workers normally, without ${BRAND_DISPLAY_NAME} protection. This offers the best compatibility, but workers can read your real browser values.`,
  },
  spoof: {
    label: "Spoof",
    description: `Tries to apply ${BRAND_DISPLAY_NAME}’s spoofed values before workers start. If protection cannot be applied, a worker may use real browser values or fail to start.`,
  },
  strict: {
    label: "Strict",
    description: `Blocks a worker before startup when ${BRAND_DISPLAY_NAME} can tell that spoofing cannot be confirmed. If a failure happens after startup, ${BRAND_DISPLAY_NAME} shows a notification instead. Features that depend on these workers may not work.`,
  },
} as const;
