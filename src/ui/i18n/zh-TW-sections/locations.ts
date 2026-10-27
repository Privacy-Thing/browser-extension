import { BRAND_DISPLAY_NAME } from "@/shared/brand";

const PRODUCT_NOT_LOWER = `${BRAND_DISPLAY_NAME} 不是什麼`;

export const locations = {
  title: "地區預設集",
  description: "地區預設集將座標、地區設定和時區整合在一起，用於偽裝。",
  addManualButton: "手動新增",
  actionsMenuLabel: "預設集操作",
  generateButton: "產生預設集",
  searchPlaceholder: "搜尋預設集…",
  unused: "未使用",
  assigned: (count: number) => `已指派 ${count} 項`,
  viewAssignedRulesAriaLabel: (locationLabel: string, count: number) =>
    `顯示指派給 ${locationLabel} 的 ${count} 條網域規則`,
  copyLinkLabel: "地區預設集",
  copyLinkHelpLabel: "地區預設集說明",

  playgroundCard: {
    title: "演練場",
    body1:
      "在將已儲存的預設集指派給網站前先預覽。演練場會使用與受保護網站相同的地理位置行為，顯示它的地區設定、時區、日期格式和偽裝座標。",
    body2:
      "演練場預設每 2-5 秒更新一次偽裝的地理位置，方便觀察移動。實際網站則會改用你設定的「位置監看延遲」。",
  },

  help: {
    title: "地區預設集",
    body1:
      "一個地區預設集應描述一個可信的地點。請讓它的主要語言、語言清單和時區，與座標屬於同一地區。",
    body2: `變更會自動儲存。編輯欄位後，${BRAND_DISPLAY_NAME} 會在短暫停頓後寫入更新。`,
    body3:
      "已儲存的地區預設集會變更瀏覽器層級的值，例如地理位置、地區設定和時區。它本身不會轉送流量。設定 Control D 後，已同步的網域規則可以使用相符的出口。",
    privacyTitle: "隱私",
    privacyBody: `搜尋和地圖預覽為選用功能。只有在你允許後，${BRAND_DISPLAY_NAME} 才會連線至 OpenStreetMap Nominatim 進行搜尋，以及連線至 OpenFreeMap 取得互動式地圖預覽。`,
    networkTitle: "網路限制",
    networkBodyPrefix:
      "需要變更網路層級的位置嗎？請使用 VPN、代理伺服器或 DNS 工具。請參閱「",
    networkBodyLinkLabel: PRODUCT_NOT_LOWER,
    networkBodySuffix: "」。",
  },

  regionalReview: {
    title: "地區預覽",
    mismatch: (saved: string, suggested: string) =>
      `時區 ${saved} 與建議的 ${suggested} 不同。`,
    approximation:
      "你可以保留自己的選擇。變更時區不會改變語言。在邊界附近和海上，建議僅為近似值。",
    outsideLand:
      "這些座標位於陸地之外，因此不提供時區建議。請檢查緯度和經度；你的時區會維持原本的選擇。",
    applyTimeZone: (zone: string) => `使用 ${zone}`,
    scope:
      "以下是時間與語言保護開啟時顯示的值。部分規則可能會停用此保護。英文偏好會改變網站語言；日期和數字仍維持地區格式。",
    browserLanguage: "瀏覽器語言",
    preferredLanguages: "偏好語言",
    languageHeader: "網站語言標頭",
    formattingLocale: "日期與數字的地區設定",
    january: "一月範例",
    july: "七月範例",
    number: "數字範例",
    samples:
      "範例使用 2026 年 1 月 15 日與 7 月 15 日的 12:34:56 UTC，以及數字 1234567.89。",
    unavailable: "無法預覽。請檢查時區和語言；你的草稿不會變更。",
  },

  editor: {
    title: "編輯預設集",
    description: "更新已儲存的地區預設集，包括座標、地區格式和位置回報行為。",
    deleteBlockedTitle: "無法刪除此預設集",
    deleteBlocked: (count: number) =>
      `有 ${count} 條規則正在使用。請先重新指派或移除這些規則。`,
    deleteBlockedListLabel: "使用此預設集的規則",
    disabledDependencySuffix: "（停用）",
    mapDisabledTitle: "地圖已停用",
    mapDisabledBody: "由於你未允許外部地圖要求，因此未載入地圖預覽。",
    geolocationSectionTitle: "地理位置",
    geolocationSectionDescription: "座標、精確度，以及偽裝位置允許的最大分散範圍。",
    localeSectionTitle: "時間與語言",
    localeSectionDescription: "讓與地區設定相關的值，與已儲存的座標屬於同一地區。",
    primaryLocaleLabel: "主要地區設定",
    languageDescription: "這是此預設集用於日期、數字和其他在地化值的主要地區格式。",
    languageBehaviorDescription:
      "關閉「在網站上優先使用英文」時，網站也會將此值視為 navigator.language。即使英文排在語言清單的第一位，此地區設定仍會控制預設的日期和數字格式。",
    preferredLanguagesLabel: "偏好語言",
    languagesDescription: "此預設集的瀏覽器語言偏好順序清單。",
    languagesBehaviorDescription: `${BRAND_DISPLAY_NAME} 會將此順序公開為 navigator.languages 及相關語言偏好。請將主要地區設定放在第一位，再加入網站在此預設集下可能合理看到的其他語言。`,
    preferEnglishContentLabel: "在網站上優先使用英文",
    preferEnglishContentDescriptionPrefix: `${BRAND_DISPLAY_NAME} 會保留已儲存的地區設定作為你的地區基準，但會將`,
    preferEnglishContentDescriptionSuffix:
      "排在瀏覽器語言偏好的第一位，讓網站更可能維持英文。",
    preferEnglishContentLockedTagTitle: (locale: string) =>
      `${locale} 是由英文瀏覽器語言偏好加入的，無法在此移除。`,
    accuracyDescription: "控制網站在地理位置結果中看到的精確度值。",
    noiseRadiusDescription: "偽裝座標與此預設集已儲存地點之間允許的最大距離。",
  },

  generator: {
    title: "產生預設集",
    searchStepDescription: "搜尋城市、地址或地點名稱，以建立新的預設集。",
    resultStepDescription: `請在 ${BRAND_DISPLAY_NAME} 建立預設集前選擇相符的結果。`,
    languageStepDescription: "在檢閱其餘內容前，先選擇此預設集要依據的瀏覽器語言。",
    confirmStepDescription: "新增前，請在地圖上確認預設集。",
    locationLabel: "位置",
    locationPlaceholder: "波蘭華沙",
    osmDisclaimer:
      "搜尋查詢會使用外部的 OpenStreetMap Nominatim API。你同意後，互動式預覽會使用 OpenFreeMap 的向量圖磚和字型。",
    resultSelectLabel: "搜尋結果",
    resultStepBody:
      "OpenStreetMap 傳回多個可能相符的結果。請選擇你要的地點，然後繼續。",
    resultStepHint: "選擇結果以繼續。",
    languageSelectLabel: "瀏覽器語言",
    languageStepBody: "此地點有多種瀏覽器語言可用。請選擇此預設集要使用的語言。",
    languageStepHint: "如果下方沒有列出你要的語言，可以在下一步選擇其他語言。",
    resultPrefix: "結果：",
  },
} as const;
