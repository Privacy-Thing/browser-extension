import { workerHandlingModeCopy } from "./shared-worker";

import { BRAND_DISPLAY_NAME } from "@/shared/brand";

export const options = {
  title: "設定",
  tabsAriaLabel: "設定區段",
  spoofingOffBannerTitle: "偽裝已關閉",
  spoofingOffBannerBody: `${BRAND_DISPLAY_NAME} 目前未套用偽裝的位置或瀏覽器值。`,
  spoofingOffBannerAction: "重新開啟偽裝",
  spoofingTurnedOffToast: `${BRAND_DISPLAY_NAME} 已關閉。`,
  spoofingTurnedOnToast: `${BRAND_DISPLAY_NAME} 已開啟。`,

  tabs: {
    locations: "地區預設集",
    rules: "網域規則",
    trustedSites: "受信任的網站",
    playground: "演練場",
    options: "選項",
    advanced: "進階",
    about: "關於",
  },
} as const;

export const optionsPage = {
  browserFingerprintSpoofing: {
    title: "全域保護設定",
    description: `選擇 ${BRAND_DISPLAY_NAME} 預設使用哪些瀏覽器保護。更具體的設定可以覆寫個別保護，而「受信任的網站」可以對相符的網站停用這些保護。`,
    disabledNote: `瀏覽器保護已在所有地方關閉。重新開啟後，即可選擇 ${BRAND_DISPLAY_NAME} 預設要偽裝的項目。`,
    copyLinkLabel: "瀏覽器保護",
    interceptsApis: (count: number) => `攔截 ${count} 個瀏覽器 API`,
    items: {
      geolocation: {
        label: "地理位置",
        description: `控制地理位置 API。開啟時，${BRAND_DISPLAY_NAME} 會以你使用中的預設集回應位置要求。關閉後，網站會取得瀏覽器的真實地理位置結果。`,
        advancedButton: "進階",
        advancedModal: {
          title: "地理位置進階設定",
          description: "調整預設座標半徑和位置更新時機。",
        },
      },
      timeLocale: {
        label: "時間與地區設定",
        description: `控制 Date、Intl、navigator.language、navigator.languages 和語言標頭。開啟時，${BRAND_DISPLAY_NAME} 會讓這些值與你使用中的預設集保持一致。關閉後，網站會看到瀏覽器的真實地區設定。`,
      },
      canvas: {
        label: "Canvas",
        description: `網站可以繪製隱藏圖像，並利用細微的轉譯差異辨識你的瀏覽器。開啟時，${BRAND_DISPLAY_NAME} 會加入受控雜訊，讓結果更難被重複用作指紋。關閉後，網站會取得你真實的 Canvas 輸出。`,
      },
      webGL: {
        label: "WebGL",
        description: `WebGL 會透露圖形細節，例如 GPU 型號、轉譯器和驅動程式行為。開啟時，${BRAND_DISPLAY_NAME} 會以符合你目前平台的一致設定取代這些線索。關閉後，網站可以讀取更接近你真實電腦的圖形資料。`,
      },
      audio: {
        label: "音訊",
        description: `音訊 API 會產生與硬體相關的細微差異，網站可以在背景中測量這些差異。開啟時，${BRAND_DISPLAY_NAME} 會稍微變更這些值，降低它們用於追蹤的效用。關閉後，音訊輸出會保持不變。`,
      },
      navigator: {
        label: "Navigator",
        description: `Navigator 欄位會透露平台、語言設定、CPU 提示和其他瀏覽器身分資料等細節。開啟時，${BRAND_DISPLAY_NAME} 會遮蔽部分身分欄位，同時讓它們在內部保持一致。關閉後，網站會看到更多你真實的瀏覽器身分。`,
      },
      screen: {
        label: "螢幕",
        description: `螢幕尺寸、像素比和色彩深度有助於將你的裝置範圍縮小到少數幾種。開啟時，${BRAND_DISPLAY_NAME} 會遮蔽這些精確的顯示細節。關閉後，網站會取得你真實的螢幕屬性。`,
      },
      clientHints: {
        label: "用戶端提示",
        description: `用戶端提示會透過要求標頭和 JavaScript API 分享瀏覽器版本、平台和裝置資料。開啟時，${BRAND_DISPLAY_NAME} 會讓這些值與你偽裝的瀏覽器身分保持一致。關閉後，網站會取得你真實的瀏覽器和平台細節。`,
      },
      battery: {
        label: "電池",
        description: `電池狀態可能透露不斷變化的裝置資訊，網站可能用它來關聯不同的造訪。開啟時，${BRAND_DISPLAY_NAME} 會回報電池已充滿且正在充電，而不是裝置的真實狀態。關閉後，網站可以讀取原生的電池狀態 API。`,
      },
      clientHintsVersionRotation: {
        label: "輪替組建與修補版本號碼",
        description: (count: number) =>
          `輪替透過用戶端提示公開的 Chromium 引擎組建與修補版本號碼，同時保留你安裝的瀏覽器的主要版本。${BRAND_DISPLAY_NAME} 隨附近期 Chromium 組建的目錄；對於此瀏覽器版本，它可以從 ${count} 個相符項目中選擇。精簡的 User-Agent 字串會維持瀏覽器原生、保護隱私的 .0.0.0 格式。`,
        hintPrefix: "例如：",
        hint: "139.0.[組建].[修補]",
      },
      webRTC: {
        label: "WebRTC",
        description: `即使你使用 VPN 或代理伺服器，WebRTC 仍可能透露本機或公用 IP 位址。開啟時，${BRAND_DISPLAY_NAME} 會要求瀏覽器使用最嚴格的 IP 處理模式。關閉後，WebRTC 會正常運作，可能暴露更多網路細節。`,
      },
      serviceWorker: {
        label: "Service Worker",
        description: `Service Worker 會在背景執行，並可讓網站保留長期資料和識別碼。如果你希望 ${BRAND_DISPLAY_NAME} 預設在所有地方封鎖網站註冊 Service Worker，請開啟此選項。`,
        warning:
          "封鎖 Service Worker 可能導致可安裝的網頁應用程式（PWA）、離線模式、推播通知和背景同步無法運作。部分應用程式也可能變慢或失去功能。",
        defaultState:
          "預設不會封鎖——你可以在全域開啟封鎖，再透過網域規則允許特定網域。",
        allow: "允許",
        block: "封鎖",
      },
      sharedWorker: {
        label: "專用 Worker 與 Shared Worker",
        descriptionLead:
          "選擇專用 Worker 和 Shared Worker 預設的執行方式。網域規則和 Firefox 容器可以為相符的網站覆寫此原則。",
        copyLinkLabel: "專用 Worker 與 Shared Worker 的處理方式",
        native: workerHandlingModeCopy.native.label,
        nativeDescription: workerHandlingModeCopy.native.description,
        spoof: workerHandlingModeCopy.spoof.label,
        spoofDescription: workerHandlingModeCopy.spoof.description,
        strict: workerHandlingModeCopy.strict.label,
        strictDescription: workerHandlingModeCopy.strict.description,
      },
    },
  },
  badgeQueryCount: {
    label: "在擴充功能徽章上顯示呼叫次數",
    description: `在擴充功能徽章上顯示 ${BRAND_DISPLAY_NAME} 處理的瀏覽器 API 呼叫次數，而非文字標籤。`,
    includeDateCalls: {
      label: "包含 Date 和 Temporal API 呼叫",
      description:
        "將 Date.* 和 Temporal.* 呼叫計入徽章數字。關閉此選項可避免頻繁的時間檢查使次數膨脹。",
    },
  },
  copyLinkHelpLabel: "選項說明",
  help: {
    title: "選項",
    body1: `瀏覽器保護可讓你選擇 ${BRAND_DISPLAY_NAME} 預設要偽裝哪些值。除非網域規則或 Firefox 容器另有設定，這些設定會影響所有網站。`,
    body2: `隱私控制項涵蓋 ${BRAND_DISPLAY_NAME} 在你設定位置時唯一會發出的選用網路要求。保持關閉時 ${BRAND_DISPLAY_NAME} 仍可正常運作——你只需要手動新增位置，而不使用搜尋或地圖預覽。`,
  },
} as const;
