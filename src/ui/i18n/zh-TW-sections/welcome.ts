import { BRAND_DISPLAY_NAME } from "@/shared/brand";
import { externalMapConsentCopy } from "@/ui/i18n/zh-TW-sections/osm";

const WELCOME_PRODUCT = `歡迎使用 ${BRAND_DISPLAY_NAME}`;

export const welcome = {
  title: WELCOME_PRODUCT,
  loading: "正在載入初始設定…",
  progressLabel: "設定進度",
  previous: "上一步",
  next: "下一步",
  privacyPolicy: "隱私權政策",
  privacyDialog: {
    title: "隱私權政策",
    description: `${BRAND_DISPLAY_NAME} 如何處理設定、診斷資料和網路要求。`,
    close: "關閉隱私權政策",
  },
  saving: "正在儲存…",
  unexpectedError: "發生錯誤",
  importSuccess: "已匯入設定",
  importError: "無法匯入設定",
  importParseError: "無法讀取設定檔案",
  steps: {
    welcome: {
      title: "感謝你安裝這個擴充功能",
      description:
        "自行選擇網站看到的內容，而不是暴露你的真實位置和瀏覽器身分。這份簡短的選用指南會帶你完成初次設定的各項選擇（每一項都可以復原），並將它們儲存到你隨時可以再次查看的「設定」中。已經有要重複使用的設定了嗎？",
      importInline: "改為匯入設定",
      advancedTitle: "我知道自己要什麼",
      advancedDescription:
        "略過指南，以乾淨的預設值開啟「設定」。不會新增任何地區預設集或網域規則，預設規則保持關閉，瀏覽器保護仍可用於你之後建立的規則。",
      guidedTitle: "前往初始設定",
      guidedDescription:
        "依序完成初次決定。指南會限縮選項範圍、說明取捨，並將所有內容儲存到你之後可以編輯的同一組「設定」畫面中。",
      advancedCta: "略過設定",
      guidedCta: "開始設定",
    },
    privacy: {
      title: "你的瀏覽資料保留在本機",
      description: `${BRAND_DISPLAY_NAME} 會將規則和預設集儲存在本機。此步驟只與選用的外部地圖服務有關：如果你想在設定期間使用搜尋和預覽，請啟用它們；或保持關閉，改為手動輸入座標。`,
      descriptionBeforePolicy: `${BRAND_DISPLAY_NAME} 會將規則和預設集儲存在本機。選用的地圖搜尋和預覽只有在你允許後才會使用外部服務。決定這些要求是否適合你的設定前，請先閱讀`,
      policyLink: "隱私權政策",
      descriptionAfterPolicy: "。",
      consentTitle: externalMapConsentCopy.title,
      consentDescription: externalMapConsentCopy.description,
    },
    presets: {
      title: "新增地區預設集",
      description:
        "地區預設集提供現成的位置，並搭配相符的語言和時區設定，讓你使用該位置時，網站看到的地區特徵更一致。請只選擇你想放入初始清單的地點。初始設定會在最後匯入所選的預設集，你之後也可以編輯或刪除每一個預設集。",
      selectAll: "全選",
      selectNone: "全部清除",
      selectedCount: (count: number) => `已選取 ${count} 個`,
    },
    scope: {
      title: "選擇保護的起始範圍",
      description:
        "沒有其他更具體的設定優先時，會套用預設規則。保持關閉可以低調地開始，或啟用它來保護沒有相符規則的網站。",
      defaultRuleDescription:
        "如果你將地區預設集指派給預設規則，請保持該預設集為選取狀態，讓初始設定在儲存前將它匯入。",
      enableEverywhereTitle: `在所有網站上使用 ${BRAND_DISPLAY_NAME}`,
      enableEverywhereDescription: `如果你希望 ${BRAND_DISPLAY_NAME} 在沒有專屬規則的網站上也能運作，請立即開啟預設規則。之後你仍可以使用網域規則縮小範圍、將不同預設集指派給特定主機，或使用「受信任的網站」排除敏感網站。`,
      editDefaultRuleTitle: "預設規則設定",
      editDefaultRule: "編輯預設規則",
      editDefaultRuleDescription:
        "在初始設定完成前，選擇預設規則的預設集和自訂保護設定。",
      defaultRuleDialogDescription:
        "在初始設定期間，此對話方塊可以使用你選取的地區預設集，即使它們尚未匯入。如果你在這裡指派其中一個，請保持它為選取狀態，讓初始設定可以建立它。",
      presetMismatch: (label: string) =>
        `預設規則已指派給「${label}」，但匯入清單中未選取該預設集。請重新選取該預設集，或為預設規則選擇其他預設集。`,
    },
    chromium: {
      title: "輪替 Chromium 組建詳細資料",
      description: (count: number) =>
        `${BRAND_DISPLAY_NAME} 可以輪替透過用戶端提示公開的 Chromium 引擎組建與修補版本值，同時讓主要版本與你安裝的瀏覽器一致。隨附目錄包含近期的 Chromium 組建；對於此瀏覽器版本，${BRAND_DISPLAY_NAME} 可以從 ${count} 個相符項目中選擇。`,
      switchTitle: "輪替組建與修補版本號碼",
      switchDescription:
        "偽裝用戶端提示時，使用隨附目錄中近期的 Chromium 組建與修補版本值。如果你希望這些次要版本細節保持固定，請關閉此選項。",
    },
    firefox: {
      title: "Firefox userScripts 權限（選用）",
      description: `不授予此權限也可以在 Firefox 中使用 ${BRAND_DISPLAY_NAME}。如果你授予 userScripts 權限，${BRAND_DISPLAY_NAME} 可以在支援的網站上更早套用偽裝值，改善首次載入頁面時的保護。你可以現在略過，之後在「設定」中變更。`,
      action: "授予 userScripts 權限",
      granted: "已授予權限",
      skipped: `你可以在沒有此權限的情況下繼續使用 ${BRAND_DISPLAY_NAME}。`,
    },
    appearance: {
      title: "讓介面更舒適",
      description: `開始使用前，選擇擴充功能介面的外觀。這些設定只會影響 ${BRAND_DISPLAY_NAME} 的畫面，不會變更網站上的偽裝行為、地區預設集或規則。你之後可以在「設定」中調整相同的顯示選項。`,
      themeTitle: "主題",
      themeDescription: `跟隨系統設定，或為所有 ${BRAND_DISPLAY_NAME} 畫面選擇固定的淺色或深色介面。`,
      reduceMotionTitle: "減少動態效果",
      reduceMotionDescription: `關閉 ${BRAND_DISPLAY_NAME} 中的所有介面動畫。`,
      reduceMotionSystemOverride: "你的系統協助工具設定已啟用減少動態效果。",
      accentTitle: "強調色",
      accentDescription: "選擇用於控制項、使用中狀態、焦點強調和已選取項目的醒目顏色。",
      contrastTitle: "高對比模式",
      contrastDescription:
        "當預設外觀太過低調時，提高整個擴充功能介面中文字、邊框和控制項的對比。",
    },
    done: {
      title: "初始設定已就緒",
      description: `${BRAND_DISPLAY_NAME} 會儲存這些選擇並開啟「設定」。你可以在那裡檢閱已匯入的預設集、調整預設規則，以及變更外觀或隱私設定。`,
      cta: "開啟設定",
    },
  },
  presetNames: {
    spfWarsaw: "華沙",
    spfParis: "巴黎",
    spfLondon: "倫敦",
    spfOttawa: "渥太華",
    spfNewYork: "紐約",
    spfLasVegas: "拉斯維加斯",
    spfSanFrancisco: "舊金山",
    spfSydney: "雪梨",
    spfBeijing: "北京",
    spfHongKong: "香港",
    spfNewDelhi: "新德里",
    spfCairo: "開羅",
    spfLagos: "拉哥斯",
    spfKyiv: "基輔",
    spfKinshasa: "金夏沙",
    spfSaoPaulo: "聖保羅",
    spfBuenosAires: "布宜諾斯艾利斯",
    spfLima: "利馬",
    spfRioDeJaneiro: "里約熱內盧",
    spfCaracas: "卡拉卡斯",
    spfBerlin: "柏林",
    spfMadrid: "馬德里",
  },
  themeOptions: {
    system: "系統",
    light: "淺色",
    dark: "深色",
  },
} as const;
