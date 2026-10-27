import { BRAND_DISPLAY_NAME } from "@/shared/brand";
import { externalMapConsentCopy } from "@/ui/i18n/zh-TW-sections/osm";

const TURN_OFF_PRODUCT = `關閉 ${BRAND_DISPLAY_NAME}`;

export const advanced = {
  runtimeTitle: "進階選項",
  runtimeDescription: "管理詳細的執行階段記錄。",
  copyLinkRuntimeLabel: "進階設定",
  copyLinkHelpLabel: "進階說明",

  noiseRadius: {
    title: "預設最大座標半徑",
    description: "設定新建預設集的預設最大座標半徑（單位：公尺）。",
    copyLinkLabel: "預設最大座標半徑",
  },

  generatedLocationRandomization: {
    enabled: {
      title: "建立新的地區預設集時隨機化座標",
      description:
        "將此設為產生預設集時的預設值。需要精確座標時，仍可在個別操作中關閉。",
      readWhy: "了解原因。",
      tooltipPrivacy: `${BRAND_DISPLAY_NAME} 以隱私為重。預設集應該容易使用，但重複使用目錄或搜尋結果中的精確座標，可能讓 ${BRAND_DISPLAY_NAME} 使用者更容易被辨識。`,
      tooltipExact: "需要特定位置？關閉這個開關，預設集就會使用精確座標。",
      copyLinkLabel: "新預設集的座標隨機化",
    },
    radius: {
      title: "預設座標隨機化半徑",
      description:
        "選擇開啟座標隨機化時使用的預設半徑。請輸入 1 到 99 公里之間的整數。",
      inputLabel: "預設座標隨機化半徑（公里）",
      copyLinkLabel: "預設座標隨機化半徑",
    },
  },

  themeMode: {
    title: "主題",
    description: `選擇 ${BRAND_DISPLAY_NAME} 要跟隨系統外觀，或一律使用固定的淺色或深色主題。`,
    label: "外觀",
    options: {
      system: "系統",
      light: "淺色",
      dark: "深色",
    },
    copyLinkLabel: "主題",
  },

  watchPositionDelay: {
    title: "位置監看延遲範圍（秒）",
    description: "設定網站上兩次位置更新之間的最短與最長延遲。",
    copyLinkLabel: "位置監看延遲範圍",
  },

  debugMode: {
    title: "偵錯模式",
    description: `在瀏覽器的開發者控制台中記錄 ${BRAND_DISPLAY_NAME} 的詳細執行活動。`,
    copyLinkLabel: "偵錯模式",
  },

  experimental: {
    title: "實驗性功能",
    description:
      "試用針對仍在逐步推出的瀏覽器 API 的保護。這些開關在所有發行管道中皆可使用。",
    copyLinkLabel: "實驗性設定",
    temporalApi: {
      title: "Temporal API",
      description:
        "當此瀏覽器提供原生 API 時，保護 Temporal 的日期、時間、地區設定及預設時區行為。不會安裝 Temporal 的替代實作。",
      copyLinkLabel: "Temporal API",
    },
    domainFencing: {
      title: "網域隔離",
      description:
        "套用預設規則或 Firefox 容器時，每個網站都會取得各自穩定的指紋。你的地區預設集維持不變。",
      copyLinkLabel: "網域隔離",
    },
  },

  privacy: {
    title: "隱私",
    description: `${BRAND_DISPLAY_NAME} 在你的裝置上執行，不會將你的瀏覽資料傳送到任何地方。位置搜尋與地圖預覽是你設定地區預設集時唯一的選用網路要求。Control D 等整合有各自獨立的設定。`,
    copyLinkLabel: "隱私",

    osmConsent: {
      title: externalMapConsentCopy.title,
      description: externalMapConsentCopy.description,
      stateUnknown: `你尚未做出選擇。${BRAND_DISPLAY_NAME} 會在連線到外部地圖服務前先詢問你。`,
      statePrefix: "外部地圖存取",
      stateEnabled: "已啟用——可以載入位置搜尋與地圖預覽",
      stateDisabled: `已停用——不會載入位置搜尋與地圖預覽`,
      copyLinkLabel: "外部地圖存取",
    },
  },

  display: {
    title: "外觀",
    description: "調整視覺呈現與協助工具設定。",
    copyLinkLabel: "外觀",

    language: {
      title: "語言",
      description: `選擇「自動」時，${BRAND_DISPLAY_NAME} 會跟隨瀏覽器語言。選擇一種語言即可改用該語言。`,
      optionAutomatic: "自動",
      optionEnglish: "英文",
      optionSpanish: "西班牙文",
      optionPortuguese: "葡萄牙文",
      optionRussian: "俄文",
      optionUkrainian: "烏克蘭文",
      optionSimplifiedChinese: "簡體中文",
      optionTraditionalChinese: "繁體中文",
      reportLabel: "發現翻譯錯誤？請回報",
      copyLinkLabel: "語言",
    },

    reduceMotion: {
      title: "減少動態效果",
      description: `關閉 ${BRAND_DISPLAY_NAME} 中的所有介面動畫。`,
      systemOverride: "你的系統協助工具設定已啟用減少動態效果。",
      copyLinkLabel: "減少動態效果",
    },

    accentColor: {
      title: "強調色",
      description: `從參考 Firefox 容器顏色的色彩預設集中，選擇 ${BRAND_DISPLAY_NAME} 的主要強調色。`,
      copyLinkLabel: "強調色",
      optionAriaLabel: (label: string) => `使用${label}作為強調色`,
      options: {
        teal: "藍綠色",
        blue: "藍色",
        green: "綠色",
        yellow: "黃色",
        orange: "橘色",
        red: "紅色",
        pink: "粉紅色",
        purple: "紫色",
        gray: "灰色",
      },
    },

    highContrast: {
      title: "高對比模式",
      description: "提高文字對比與邊框能見度，讓內容更容易閱讀。",
      copyLinkLabel: "高對比模式",
    },
  },

  danger: {
    title: "危險區域",
    description: `這些操作可能會取代、刪除或還原你在本機儲存的 ${BRAND_DISPLAY_NAME} 設定與資料。`,
    copyLinkLabel: "危險區域",

    spoofing: {
      title: TURN_OFF_PRODUCT,
      description: `關閉 ${BRAND_DISPLAY_NAME} 的所有保護，直到你重新開啟為止。`,
      copyLinkLabel: TURN_OFF_PRODUCT,
    },

    export: {
      title: "匯出",
      description: "將目前的預設集、規則及相關設定下載為 JSON 備份。",
      button: "匯出設定",
      copyLinkLabel: "匯出設定",
    },

    import: {
      title: "匯入",
      description: "預覽 JSON 備份，然後取代設定，或合併所選的預設集與規則。",
      button: "匯入設定",
      copyLinkLabel: "匯入設定",
    },

    reload: {
      title: "重新載入",
      description:
        "從擴充功能儲存空間重新載入已儲存的設定，並捨棄目前檢視中未儲存的變更。",
      button: "重新載入設定",
      copyLinkLabel: "重新載入設定",
    },

    reset: {
      title: "重設",
      description: "還原為乾淨的預設值，並移除你的自訂預設集與規則。",
      button: "重設設定",
      copyLinkLabel: "重設設定",
      confirmTitle: "要重設設定嗎？",
      confirmBody: "這會永久刪除你儲存的預設集、規則和自訂設定。此操作無法復原。",
      onboardingToggleLabel: "重設後再次執行初始設定",
      onboardingToggleDescription: "清除設定後，重新開啟首次執行的設定指南。",
    },
  },

  help: {
    title: "進階",
    body1: `使用「進階」可微調保護、暫時關閉 ${BRAND_DISPLAY_NAME}，或管理你在本機儲存的設定與資料。`,
    body2:
      "匯入、匯出、重新載入和重設可協助你在瀏覽器之間移轉設定、從錯誤中復原，或在設定不同步時還原已儲存的設定。",
  },
} as const;
