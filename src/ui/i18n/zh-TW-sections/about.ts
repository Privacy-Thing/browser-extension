import { BRAND_DISPLAY_NAME } from "@/shared/brand";

const ABOUT_PRODUCT = `關於 ${BRAND_DISPLAY_NAME}`;
const ABOUT_PRODUCT_LOWER = `關於 ${BRAND_DISPLAY_NAME}`;
const HOW_TO_USE_PRODUCT = `如何使用 ${BRAND_DISPLAY_NAME}`;
const HOW_TO_USE_PRODUCT_LOWER = `如何使用 ${BRAND_DISPLAY_NAME}`;
const WHAT_PRODUCT_IS_NOT = `${BRAND_DISPLAY_NAME} 不是什麼`;
const PRODUCT_NOT_LOWER = `${BRAND_DISPLAY_NAME} 不是什麼`;
const TERMS_OF_USE = "使用條款";

export const about = {
  title: ABOUT_PRODUCT,
  description: `${BRAND_DISPLAY_NAME} 可協助你控制網站如何看見你的位置、地區設定、時區，以及部分瀏覽器身分細節。`,
  body1:
    "每個已儲存的地區預設集都會將座標、語言偏好和目標時區整合成可重複使用的設定，你可以套用到所選網域，而不必每次重新建立。",
  body2: `你的變更會自動儲存。更新後的預設集和規則會在下次載入頁面時生效，讓 ${BRAND_DISPLAY_NAME} 從一開始就套用新設定。`,
  body3Prefix: "共用的瀏覽器保護控制項位於",
  body3LinkLabel: "「選項」分頁",
  body3Suffix: "中。",
  website: {
    prefix: "你可以造訪 ",
    linkLabel: `${BRAND_DISPLAY_NAME} 網站`,
    url: "https://privacything.com",
    suffix: "，取得專案消息、下載及更多資訊。",
  },
  versionLabel: "版本",
  browserTargetLabel: "目標瀏覽器",
  releaseChannelLabel: "發行管道",
  copyLinkLabel: ABOUT_PRODUCT_LOWER,
  copyLinkTermsLabel: "使用條款",
  copyLinkPrivacyLabel: "關於隱私",
  copyLinkLimitationsLabel: PRODUCT_NOT_LOWER,
  copyLinkLicenseLabel: "授權",
  copyLinkAssetsLabel: "第三方資源",
  copyLinkUsageLabel: HOW_TO_USE_PRODUCT_LOWER,
  releaseChannels: {
    local: "本機",
    beta: "測試版",
    stable: "穩定版",
  },

  support: {
    url: "https://webh.pl",
    logoLinkAriaLabel: "開啟 webh.pl",
    bodyPrefix: `${BRAND_DISPLAY_NAME} 的成長獲得 `,
    linkLabel: "webh.pl",
    bodySuffix: " 的支持——為具有遠大目標的專案提供快速、靈活的基礎架構。",
  },

  terms: {
    title: TERMS_OF_USE,
    body1: `${BRAND_DISPLAY_NAME} 依「現狀」提供，不附帶任何形式的保證。`,
    body2: `${BRAND_DISPLAY_NAME} 協助使用者在本機控制瀏覽器所公開的部分位置、地區設定、時區及相關資料。它不是 VPN、代理伺服器、匿名工具或安全性產品，也不保證無法被偵測。`,
    body3: `使用 ${BRAND_DISPLAY_NAME} 的風險由你自行承擔。你有責任遵守適用的法律、網站條款、工作場所政策及平台規則。`,
  },

  privacy: {
    title: "隱私",
    body: `${BRAND_DISPLAY_NAME} 會將設定和已儲存的組態儲存在本機。選用的地圖服務會在你同意後接收搜尋和地圖要求。如果你啟用 Control D，網域規則的主機名稱、所選出口和受管理的資源名稱會傳送給 Control D。詳情請參閱隱私權政策。`,
    openPolicyButton: "開啟隱私權政策",
  },

  limitations: {
    title: WHAT_PRODUCT_IS_NOT,
    intro: `${BRAND_DISPLAY_NAME} 會變更瀏覽器可見的資料，例如地理位置、地區設定、時區和部分指紋細節。它的偽裝不會轉送流量。選用的 Control D 整合會同步地區規則；你設定 Control D 的解析器後，才由 Control D 轉送流量。`,
    body1:
      "僅靠瀏覽器層級的偽裝，無法隱藏或取代你的 IP 位址。已設定的 Control D 解析器可以讓所選網站經由其出口連線。",
    body2: "它無法取代 VPN、代理伺服器或以 DNS 為基礎的路由設定。",
    body3: "它本身無法讓網站認為你的連線來自其他國家。",
    outro: `${BRAND_DISPLAY_NAME} 適用於瀏覽器層級的偽裝。需要變更網路層級的位置時，請使用 VPN、代理伺服器或 DNS 工具。`,
  },

  license: {
    title: "授權",
    creatorPrefix: "本專案的作者是 ",
    creatorLabel: "Tomasz Janusz",
    creatorUrl: "https://tomaszjanusz.dev",
    creatorSuffix: "。",
    copyright: "版權所有 © 2025 至今。",
    body: `${BRAND_DISPLAY_NAME} 依 GNU Affero General Public License v3.0 或更新版本授權提供，並附有額外條款。`,
    openLicenseButton: "開啟授權條款",
  },

  assets: {
    title: "第三方資源",
    body: `檢視隨附的第三方元件，並開啟 ${BRAND_DISPLAY_NAME} 隨附的授權條款文字。`,
    openNoticesButton: "開啟第三方聲明",
    fontAwesome: {
      label: "Font Awesome Free 7.2.0",
      url: "https://fontawesome.com",
      body: " 由 Font Awesome / Fonticons, Inc. 提供，依 CC BY 4.0、SIL OFL 1.1 和 MIT 授權。",
    },
    mapLibre: {
      label: "MapLibre GL JS",
      url: "https://maplibre.org/maplibre-gl-js/docs/",
      body: " 已隨附於本機，用於轉譯向量地圖。",
    },
    openFreeMap: {
      label: "OpenFreeMap",
      url: "https://openfreemap.org/",
    },
    openStreetMap: {
      label: "OpenStreetMap",
      url: "https://www.openstreetmap.org/copyright",
    },
    osmWikiCountryCodes: {
      label: "OpenStreetMap Wiki: Nominatim/Country Codes",
      url: "https://wiki.openstreetmap.org/wiki/Nominatim/Country_Codes",
      body: " 提供產生預設集時使用的國家對應語言預設值。",
      licenseLabel: "CC BY-SA 2.0",
      licenseUrl: "https://wiki.openstreetmap.org/wiki/Wiki_content_license",
      licenseBody: " 適用於該 Wiki 內容，並已在此註明出處。",
    },
    mapPreviewsPrefix: "互動式地圖預覽使用 ",
    mapPreviewsMiddle: " 服務，並顯示 ",
    mapPreviewsSuffix: " 貢獻者在地圖上的署名。",

    localData: {
      title: "本機資料集",
      body: `${BRAND_DISPLAY_NAME} 隨附以經處理的公開資料建立的小型本機資料庫，讓偽裝的值在統計上保持逼真。不會從網際網路擷取任何內容——這些是隨附於本機的快照，會隨每次擴充功能更新一併更新。`,
      steam: {
        label: "Steam Hardware & Software Survey",
        url: "https://store.steampowered.com/hwsurvey/",
        body: "（Valve）提供本機硬體設定檔使用的 Windows、Linux 和 macOS 螢幕解析度、CPU 核心數與 RAM 分布。",
      },
      chromiumDash: {
        label: "ChromiumDash",
        url: "https://chromiumdash.appspot.com/",
        body: " 提供 User-Agent 和用戶端提示使用的實際 Chrome 發行版本。",
      },
      localeCatalog: {
        prefix: "",
        mozilla: {
          label: "Mozilla",
          url: "https://github.com/mozilla-firefox/firefox/blob/main/intl/locale/language.properties",
        },
        middle: " 和 ",
        chromium: {
          label: "Chromium",
          url: "https://github.com/chromium/chromium/blob/main/ui/base/l10n/l10n_util.cc",
        },
        body: " 的地區設定目錄提供與各瀏覽器引擎一致的語言顯示名稱。",
      },
    },
  },

  projectLinks: {
    description: `${BRAND_DISPLAY_NAME} 不只存在於擴充功能中。你可以造訪網站、瀏覽原始碼，或在功能異常時告訴我。`,
    websiteLabel: "網站",
    websiteUrl: "https://privacything.com",
    sourceLabel: "原始碼",
    sourceUrl: "https://github.com/Privacy-Thing/browser-extension",
    reportBugLabel: "回報錯誤",
    reportBugUrl:
      "https://github.com/Privacy-Thing/browser-extension/issues/new?template=bug_report.yml",
  },

  usage: {
    title: HOW_TO_USE_PRODUCT,
    body1: "想要快速取得逼真的起點時，可以先從搜尋到的地點產生地區預設集。",
    body2: `為每個想讓 ${BRAND_DISPLAY_NAME} 模擬的真實地點保留一個地區預設集，然後將網站指派給對應的預設集。`,
    body3:
      "使用彈出式視窗快速指派網域。需要預設集和規則的完整控制介面時，請開啟「設定」。",
    body4: `想要更進一步控制 ${BRAND_DISPLAY_NAME} 的行為時，請查看「選項」和「進階」。`,
  },
} as const;
