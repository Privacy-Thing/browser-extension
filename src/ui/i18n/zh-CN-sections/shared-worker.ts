import { BRAND_DISPLAY_NAME } from "@/shared/brand";

export const sharedWorkerModeCopy = {
  native: {
    label: "原生",
    description: `正常运行 Shared Worker，不使用 ${BRAND_DISPLAY_NAME} 保护。这样兼容性最好，但 Worker 可以读取你浏览器的真实值。`,
  },
  spoof: {
    label: "伪装",
    description: `为 Shared Worker 尝试另一种保护方法。某些 Worker 可能仍无法启动。`,
  },
  strict: {
    label: "严格",
    description: `除非 ${BRAND_DISPLAY_NAME} 能在 Shared Worker 启动前确认伪装生效，否则阻止该 Worker。这可以防止未伪装的 Shared Worker 看到浏览器的原生值，但依赖该 Worker 的功能可能无法正常工作。`,
  },
} as const;

export const workerHandlingModeCopy = {
  native: {
    label: "原生",
    description: `正常运行专用 Worker 和 Shared Worker，不使用 ${BRAND_DISPLAY_NAME} 保护。这样兼容性最好，但 Worker 可以读取你浏览器的真实值。`,
  },
  spoof: {
    label: "伪装",
    description: `尝试在 Worker 启动前应用 ${BRAND_DISPLAY_NAME} 的伪装值。如果无法应用保护，Worker 可能会使用浏览器的真实值，或无法启动。`,
  },
  strict: {
    label: "严格",
    description: `当 ${BRAND_DISPLAY_NAME} 能判断无法确认伪装时，会在 Worker 启动前将其阻止。如果在启动后发生失败，${BRAND_DISPLAY_NAME} 会改为显示通知。依赖这些 Worker 的功能可能无法正常工作。`,
  },
} as const;
