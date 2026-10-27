import { BRAND_DISPLAY_NAME } from "@/shared/brand";

export const sharedWorkerModeCopy = {
  native: {
    label: "原生",
    description: `正常執行 Shared Worker，不套用 ${BRAND_DISPLAY_NAME} 保護。這可提供最佳相容性，但 Worker 能讀取你瀏覽器的真實值。`,
  },
  spoof: {
    label: "偽裝",
    description: `嘗試以替代的保護方法處理 Shared Worker。部分 Worker 仍可能無法啟動。`,
  },
  strict: {
    label: "嚴格",
    description: `除非 ${BRAND_DISPLAY_NAME} 能在 Shared Worker 啟動前確認偽裝已生效，否則會封鎖該 Worker。這可防止未經偽裝的 Shared Worker 看見瀏覽器的原生值，但依賴該 Worker 的功能可能無法運作。`,
  },
} as const;

export const workerHandlingModeCopy = {
  native: {
    label: "原生",
    description: `正常執行專用 Worker 和 Shared Worker，不套用 ${BRAND_DISPLAY_NAME} 保護。這可提供最佳相容性，但 Worker 能讀取你瀏覽器的真實值。`,
  },
  spoof: {
    label: "偽裝",
    description: `嘗試在 Worker 啟動前套用 ${BRAND_DISPLAY_NAME} 的偽裝值。如果無法套用保護，Worker 可能會使用瀏覽器的真實值，或無法啟動。`,
  },
  strict: {
    label: "嚴格",
    description: `當 ${BRAND_DISPLAY_NAME} 判斷無法確認偽裝時，會在 Worker 啟動前將其封鎖。如果失敗發生在啟動之後，${BRAND_DISPLAY_NAME} 會改為顯示通知。依賴這些 Worker 的功能可能無法運作。`,
  },
} as const;
