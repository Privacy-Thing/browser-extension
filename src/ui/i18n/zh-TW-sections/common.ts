import { BRAND_DISPLAY_NAME } from "@/shared/brand";

export const common = {
  copyLinkTo: (section: string) => `複製「${section}」的連結`,

  /** Joins sentence fragments around inline links and emphasis. */
  typography: {
    fragmentSpace: "",
    fullStop: "。",
    listSeparator: "、",
  },

  actions: {
    cancel: "取消",
    reset: "重設",
    close: "關閉",
    create: "建立",
    save: "儲存",
    back: "返回",
    continue: "繼續",
    edit: "編輯",
    delete: "刪除",
    duplicate: "建立副本",
    search: "搜尋",
    clear: "清除",
    deleteSelected: "刪除所選項目",
    clearSelection: "清除選取",
    openPrivacyPolicy: "開啟隱私權政策",
    allowOpenStreetMap: "允許地圖存取",
    notNow: "以後再說",
    openPlayground: "開啟演練場",
  },
  selectionCount: (count: number) => `已選取 ${count} 項`,

  fields: {
    name: "名稱",
    latitude: "緯度",
    longitude: "經度",
    countryCodeHint: "用於地區服務的兩個字母國家／地區代碼。",
    countryCode: "國家／地區代碼",
    accuracy: "精確度",
    noiseRadius: "最大半徑（公尺）",
    timeZone: "時區",
  },

  coordinateRandomization: {
    labelBefore: "座標隨機偏移半徑",
    labelAfter: "公里。",
    radiusInputLabel: "座標隨機偏移半徑（公里）",
    readWhy: "了解原因。",
    tooltipPrivacy: `${BRAND_DISPLAY_NAME} 以隱私為重。預設集應該容易使用，但重複使用目錄或搜尋結果中的精確座標，可能會讓 ${BRAND_DISPLAY_NAME} 使用者更容易被辨識。`,
    tooltipExact: `需要特定位置嗎？關閉此開關，${BRAND_DISPLAY_NAME} 就會使用精確座標。你可以在「選項 > 地理位置 > 進階」中變更預設值。`,
  },
} as const;
