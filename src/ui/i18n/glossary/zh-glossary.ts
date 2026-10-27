/**
 * Chinese terminology glossary for the Simplified (`zh-CN`, mainland vocabulary) and
 * Traditional (`zh-TW`, Taiwan vocabulary) interface languages.
 *
 * No native speaker has reviewed these catalogs yet. This file fixes the translation of
 * every core product term so both catalogs stay consistent, and
 * `src/ui/i18n/chinese-copy.test.ts` enforces it:
 *
 * - `required`: when the English message matches `en`, the Chinese message must contain
 *   `term` (or one of `alternatives`), unless its catalog path is listed in `exempt`.
 * - `forbidden`: these strings must not appear anywhere in that catalog.
 *
 * Choices follow the browsers users already read every day. Evidence (checked
 * 2026-10-27) comes from the files listed in `ZH_GLOSSARY_SOURCES`; the `evidence`
 * field of each entry names the files that use the chosen term. The two scripts are
 * translated separately: Taiwan vocabulary differs from a character conversion of the
 * mainland text (设置 → 設定, 默认 → 預設, 软件 → 軟體, 服务器 → 伺服器).
 *
 * To correct a term, change it here first, run the Chinese copy tests and update every
 * message they report. See CONTRIBUTING.md, "Translations".
 */

export type ZhVariant = "zh-CN" | "zh-TW";

export type ZhTermChoice = {
  /** The translation to use. */
  term: string;
  /** Other accepted spellings, for example a shorter form in tight labels. */
  alternatives?: readonly string[];
  /** Strings that must not appear anywhere in this catalog. */
  forbidden?: readonly string[];
};

export type ZhGlossaryEntry = {
  id: string;
  /** English term as used in the English catalog. */
  english: string;
  /**
   * English messages matching this pattern must contain the term. Omit it for
   * guidance-only entries, where the English word has several unrelated senses.
   */
  required?: RegExp;
  /** Catalog paths exempt from `required`, each with the reason. */
  exempt?: Readonly<Record<string, string>>;
  "zh-CN": ZhTermChoice;
  "zh-TW": ZhTermChoice;
  rationale: string;
  /** Keys of `ZH_GLOSSARY_SOURCES` that use the chosen terms. */
  evidence: readonly ZhSourceId[];
};

export const ZH_GLOSSARY_SOURCES = {
  firefox:
    "Firefox zh-CN / zh-TW localizations, https://github.com/mozilla-l10n/firefox-l10n (preferences.ftl, permissions.ftl, protections.ftl, containers.ftl, browser.ftl, aboutAddons.ftl, devtools debugger.properties)",
  chrome:
    "Chromium zh-CN / zh-TW translations, https://github.com/chromium/chromium/tree/main/chrome/app/resources (generated_resources_zh-*.xtb) and components/strings (components_strings_zh-*.xtb)",
  ublock:
    "uBlock Origin zh_CN / zh_TW, https://github.com/gorhill/uBlock/tree/master/src/_locales",
  privacyBadger:
    "Privacy Badger zh_CN / zh_TW, https://github.com/EFForg/privacybadger/tree/master/src/_locales",
  mullvad:
    "Mullvad VPN app zh-CN / zh-TW, https://github.com/mullvad/mullvadvpn-app/tree/main/desktop/packages/mullvad-vpn/locales",
  mdn: "MDN Web Docs zh-CN / zh-TW, https://github.com/mdn/translated-content (web/api/geolocation_api, glossary/fingerprinting, mozilla/add-ons/webextensions/match_patterns)",
  adobe:
    "Adobe Lightroom Taiwan help, https://helpx.adobe.com/tw/lightroom/web/edit-photos/use-presets/apply-presets.html (預設集 for presets)",
  copywriting:
    "Chinese Copywriting Guidelines, https://sparanoid.com/note/chinese-copywriting-guidelines/ (spacing and full-width punctuation)",
} as const;

export type ZhSourceId = keyof typeof ZH_GLOSSARY_SOURCES;

export const ZH_GLOSSARY: readonly ZhGlossaryEntry[] = [
  {
    id: "domain",
    english: "Domain",
    required: /\bdomains?\b/i,
    "zh-CN": { term: "域名", forbidden: ["网域", "站点"] },
    "zh-TW": { term: "網域", forbidden: ["域名", "站點"] },
    rationale:
      "A hostname. AGENTS.md separates Domain from Pattern and from the Trusted Sites feature, so neither catalog may call it a site (站点/站點). Chrome and Privacy Badger use 域名 (zh-CN) and 網域 (zh-TW).",
    evidence: ["chrome", "privacyBadger", "ublock"],
  },
  {
    id: "pattern",
    english: "Pattern",
    required: /\bpatterns?\b/i,
    "zh-CN": { term: "匹配模式", forbidden: ["网址格式", "通配模式"] },
    "zh-TW": { term: "比對模式", forbidden: ["匹配模式", "網址格式"] },
    rationale:
      "A rule's matching expression, including wildcards. MDN zh-CN translates WebExtensions match patterns as 匹配模式. Taiwan uses 比對 for matching; Chrome zh-TW uses 網址模式 for URL patterns, but a Pattern here is not always a full URL. Never shorten it to 模式 alone, which means mode.",
    evidence: ["mdn", "chrome"],
  },
  {
    id: "trusted-sites",
    english: "Trusted Sites / Trusted Site",
    required: /\btrusted sites?\b/i,
    "zh-CN": {
      term: "受信任的网站",
      forbidden: ["白名单", "信任站点", "可信网站"],
    },
    "zh-TW": {
      term: "受信任的網站",
      forbidden: ["白名單", "信任站點", "可信網站"],
    },
    rationale:
      "Product feature name, the only place where “site” is a product term. 受信任 is the browsers' word for trusted. 白名单 is avoided: Chrome and Firefox now use neutral wording, and allowlist slang does not say that protection is fully off.",
    evidence: ["chrome", "firefox", "ublock"],
  },
  {
    id: "trusted-short",
    english: "Trusted (short source label)",
    "zh-CN": { term: "受信任" },
    "zh-TW": { term: "受信任" },
    rationale: "Short form of Trusted Site in compact labels.",
    evidence: ["chrome", "firefox"],
  },
  {
    id: "rule",
    english: "Rule",
    required: /\brules?\b/i,
    "zh-CN": { term: "规则", forbidden: ["规例"] },
    "zh-TW": { term: "規則", forbidden: ["規例"] },
    rationale: "Used for rules by uBlock Origin, Chrome policy strings and Firefox.",
    evidence: ["ublock", "chrome", "firefox"],
  },
  {
    id: "domain-rule",
    english: "Domain Rule",
    required: /\bdomain rules?\b/i,
    "zh-CN": { term: "域名规则" },
    "zh-TW": { term: "網域規則" },
    rationale: "Combination of the Domain and Rule terms.",
    evidence: ["chrome", "ublock"],
  },
  {
    id: "default-rule",
    english: "Default Rule",
    required: /\bdefault rules?\b/i,
    "zh-CN": { term: "默认规则" },
    "zh-TW": { term: "預設規則" },
    rationale:
      "The global fallback rule. Default is 默认 in mainland browsers and 預設 in Taiwan.",
    evidence: ["chrome", "firefox"],
  },
  {
    id: "default",
    english: "default (adjective)",
    "zh-CN": { term: "默认", forbidden: ["缺省"] },
    "zh-TW": { term: "預設", forbidden: ["默認", "缺省"] },
    rationale:
      "Regional vocabulary: 默认 (zh-CN) and 預設 (zh-TW). Because 預設 means default in Taiwan, the zh-TW word for Preset must be 預設集.",
    evidence: ["chrome", "firefox", "mullvad"],
  },
  {
    id: "preset",
    english: "Preset / Regional preset",
    required: /\bpresets?\b/i,
    "zh-CN": { term: "预设", forbidden: ["预设集", "模板"] },
    "zh-TW": { term: "預設集", forbidden: ["範本"] },
    rationale:
      "A saved location with matching language and time zone. 预设 is the mainland word (Chrome zh-CN “预设窗口大小”). In Taiwan 預設 alone means default, so zh-TW uses 預設集 as Adobe Lightroom Taiwan does. Regional preset: 区域预设 / 地區預設集.",
    evidence: ["chrome", "adobe"],
  },
  {
    id: "profile",
    english: "Profile (Control D profile)",
    "zh-CN": { term: "配置文件" },
    "zh-TW": { term: "設定檔" },
    rationale:
      "A configuration profile on the Control D service. Firefox and Chrome use 配置文件 / 設定檔 for profiles. Hardware and battery “profiles” in protection descriptions may use 配置 / 設定 instead.",
    evidence: ["firefox", "chrome"],
  },
  {
    id: "geolocation",
    english: "Geolocation",
    required: /\bgeolocation\b/i,
    "zh-CN": { term: "地理位置" },
    "zh-TW": { term: "地理位置" },
    rationale:
      "MDN uses 地理位置 for the Geolocation API in both scripts. Location alone is 位置; location information is 位置信息 / 位置資訊.",
    evidence: ["mdn", "chrome"],
  },
  {
    id: "spoofing",
    english: "spoof / spoofing / spoofed",
    required: /\bspoof/i,
    exempt: {},
    "zh-CN": {
      term: "伪装",
      forbidden: ["欺骗", "伪造", "仿冒", "篡改", "冒充"],
    },
    "zh-TW": {
      term: "偽裝",
      forbidden: ["欺騙", "偽造", "仿冒", "竄改", "冒充"],
    },
    rationale:
      "Replacing values a site can read. 伪装 (disguise) is the usual word for user-agent and location spoofing. Chrome uses 欺骗, 仿冒 and 伪造 for phishing, forgery and attacks, which would describe the product as deceptive or illegal.",
    evidence: ["chrome"],
  },
  {
    id: "fingerprint",
    english: "Fingerprint / fingerprinting",
    required: /\bfingerprint/i,
    "zh-CN": { term: "指纹" },
    "zh-TW": { term: "指紋" },
    rationale:
      "Firefox: 数字指纹跟踪程序 / 數位指紋追蹤程式. Browser fingerprint: 浏览器指纹 / 瀏覽器指紋.",
    evidence: ["firefox", "chrome", "mdn", "privacyBadger"],
  },
  {
    id: "inspector",
    english: "Inspector (X-Ray feature)",
    required: /\bInspector\b/,
    "zh-CN": { term: "检查器", forbidden: ["查看器", "审查器", "审查元素"] },
    "zh-TW": { term: "檢查器", forbidden: ["檢測器", "審查器"] },
    rationale:
      "X-Ray's mode that stops script execution. It must not reuse the names of browser DevTools panels (Firefox: 查看器 / 檢測器) because the feature works alongside those tools.",
    evidence: ["firefox"],
  },
  {
    id: "x-ray",
    english: "X-Ray",
    required: /\bX-Ray\b/,
    "zh-CN": { term: "X-Ray", forbidden: ["X光", "X 光", "透视"] },
    "zh-TW": { term: "X-Ray", forbidden: ["X光", "X 光", "透視"] },
    rationale: "Product name of the diagnostics surface; never translated.",
    evidence: [],
  },
  {
    id: "page-activity",
    english: "Page activity",
    required: /\bpage activity\b/i,
    "zh-CN": { term: "页面活动" },
    "zh-TW": { term: "頁面活動" },
    rationale: "Literal and short; 页面 / 頁面 as in browser UIs.",
    evidence: ["chrome", "firefox"],
  },
  {
    id: "arm",
    english: "Arm / Armed / Disarm (Inspector)",
    required: /\b(?:dis)?arm(?:ed)?\b/i,
    exempt: {
      "sidebar.accessed.armed":
        "Page activity status “Waiting”: the English key name says armed, the text does not.",
    },
    "zh-CN": {
      term: "启用",
      alternatives: ["停用"],
      forbidden: ["武装", "布防", "撤防"],
    },
    "zh-TW": {
      term: "啟用",
      alternatives: ["停用"],
      forbidden: ["武裝", "布防", "撤防"],
    },
    rationale:
      "Arming makes the chosen script stops active. Plain enable/disable wording (启用/停用, 啟用/停用) as for breakpoints in DevTools; literal 武装 (weapons) and alarm jargon 布防 are wrong.",
    evidence: ["firefox", "chrome"],
  },
  {
    id: "stop-script",
    english: "stop script execution",
    required: /\bstop script execution\b/i,
    "zh-CN": { term: "停止脚本执行" },
    "zh-TW": { term: "停止指令碼執行", forbidden: ["腳本"] },
    rationale:
      "Script is 脚本 in mainland browsers and 指令碼 in Firefox and Chrome zh-TW. Execution: 执行 / 執行.",
    evidence: ["firefox", "chrome", "ublock"],
  },
  {
    id: "container",
    english: "Container / Firefox Container",
    required: /\bcontainers?\b/i,
    "zh-CN": { term: "容器" },
    "zh-TW": { term: "容器" },
    rationale:
      "Firefox zh-CN calls container tabs 容器标签页 (the feature itself 身份标签页); Firefox zh-TW uses 容器 / 容器分頁. 容器 is shared by both.",
    evidence: ["firefox"],
  },
  {
    id: "time-zone",
    english: "Time zone",
    required: /\btime[ -]?zones?\b/i,
    "zh-CN": { term: "时区" },
    "zh-TW": { term: "時區" },
    rationale: "Chrome: 时区 / 時區.",
    evidence: ["chrome", "mdn"],
  },
  {
    id: "language",
    english: "Language",
    required: /\blanguages?\b/i,
    "zh-CN": { term: "语言" },
    "zh-TW": { term: "語言" },
    rationale: "Standard browser term.",
    evidence: ["chrome", "firefox"],
  },
  {
    id: "locale",
    english: "Locale",
    "zh-CN": { term: "区域设置" },
    "zh-TW": { term: "地區設定" },
    rationale:
      "Language plus regional formats. Windows and Chrome wording; Taiwan uses 地區 for region.",
    evidence: ["chrome"],
  },
  {
    id: "accuracy",
    english: "Accuracy",
    required: /\baccuracy\b/i,
    "zh-CN": { term: "精确度", forbidden: ["准确性"] },
    "zh-TW": { term: "精確度", forbidden: ["準確性"] },
    rationale:
      "Geolocation accuracy in metres. Chrome zh-CN “位置信息精确度”; MDN zh-TW and Chrome zh-TW 精確度.",
    evidence: ["chrome", "mdn"],
  },
  {
    id: "radius",
    english: "Noise radius / randomization radius",
    required: /\bradius\b/i,
    "zh-CN": { term: "半径" },
    "zh-TW": { term: "半徑" },
    rationale:
      "A hard privacy bound (AGENTS.md). Max radius (m): 最大半径（米） / 最大半徑（公尺）.",
    evidence: [],
  },
  {
    id: "metre",
    english: "m / metres (unit)",
    "zh-CN": { term: "米" },
    "zh-TW": { term: "公尺", forbidden: ["（米）", "(米)"] },
    rationale:
      "Metre is 米 in the mainland and 公尺 in Taiwan; kilometre is 公里 in both.",
    evidence: [],
  },
  {
    id: "coordinates",
    english: "Coordinates",
    required: /\bcoordinates?\b/i,
    "zh-CN": { term: "坐标", forbidden: ["座标"] },
    "zh-TW": { term: "座標", forbidden: ["坐標"] },
    rationale: "MDN zh-CN 坐标; Taiwan's standard form is 座標.",
    evidence: ["mdn"],
  },
  {
    id: "control-d",
    english: "Control D (plugin and its terms)",
    required: /\bControl D\b/,
    "zh-CN": { term: "Control D" },
    "zh-TW": { term: "Control D" },
    rationale:
      "Brand, never translated. Its terms: service 服务 / 服務, API key API 密钥 / API 金鑰, endpoint 端点 / 端點, exit 出口, sync 同步, profile 配置文件 / 設定檔, Service Rules 服务规则 / 服務規則, Custom Rules 自定义规则 / 自訂規則, DNS unchanged.",
    evidence: ["chrome", "mullvad"],
  },
  {
    id: "api-key",
    english: "API key",
    required: /\bAPI key/i,
    "zh-CN": { term: "API 密钥" },
    "zh-TW": { term: "API 金鑰" },
    rationale: "Chrome and Mullvad: 密钥 / 金鑰.",
    evidence: ["chrome", "mullvad"],
  },
  {
    id: "protection",
    english: "Protection / protected",
    "zh-CN": { term: "保护" },
    "zh-TW": { term: "保護" },
    rationale:
      "Firefox Enhanced Tracking Protection: 增强型跟踪保护 / 加強型追蹤保護. Never promise more than English does (no 完全保护 for “protected”).",
    evidence: ["firefox"],
  },
  {
    id: "pause",
    english: "Pause",
    required: /\bpause/i,
    "zh-CN": { term: "暂停" },
    "zh-TW": { term: "暫停" },
    rationale: "Standard media and browser wording.",
    evidence: ["chrome", "firefox"],
  },
  {
    id: "reload",
    english: "Reload",
    required: /\breload/i,
    "zh-CN": { term: "重新加载", forbidden: ["刷新"] },
    "zh-TW": { term: "重新載入", forbidden: ["重新整理"] },
    rationale: "Chrome and Firefox: 重新加载 / 重新載入.",
    evidence: ["chrome", "firefox", "ublock"],
  },
  {
    id: "tab",
    english: "Tab",
    required: /\btabs?\b/i,
    "zh-CN": { term: "标签页", forbidden: ["选项卡", "分页"] },
    "zh-TW": { term: "分頁", forbidden: ["標籤頁"] },
    rationale:
      "Chrome and Firefox: 标签页 / 分頁. The Options page “tab” is also 标签页 / 分頁.",
    evidence: ["chrome", "firefox"],
  },
  {
    id: "settings",
    english: "Settings / Options",
    "zh-CN": { term: "设置", alternatives: ["选项"], forbidden: ["设定"] },
    "zh-TW": { term: "設定", alternatives: ["選項"], forbidden: ["設置"] },
    rationale:
      "Settings: 设置 / 設定. The Options page and the Options tab: 选项 / 選項, as Chrome names extension options.",
    evidence: ["chrome", "firefox", "ublock", "privacyBadger"],
  },
  {
    id: "extension",
    english: "Extension",
    "zh-CN": { term: "扩展" },
    "zh-TW": { term: "擴充功能", forbidden: ["擴展"] },
    rationale:
      "Chrome zh-CN 扩展程序 and Firefox zh-CN 扩展 share 扩展. zh-TW follows Chrome and Edge (擴充功能); Firefox zh-TW says 擴充套件.",
    evidence: ["chrome", "firefox"],
  },
  {
    id: "popup",
    english: "Popup",
    "zh-CN": { term: "弹出窗口" },
    "zh-TW": { term: "彈出式視窗", forbidden: ["彈窗"] },
    rationale: "uBlock Origin: 弹出窗口 / 彈出式視窗.",
    evidence: ["ublock"],
  },
  {
    id: "sidebar",
    english: "Sidebar / side panel",
    "zh-CN": { term: "侧边栏" },
    "zh-TW": { term: "側邊欄" },
    rationale: "Chrome zh-CN 侧边栏; Firefox zh-TW 側邊欄.",
    evidence: ["chrome", "firefox"],
  },
  {
    id: "privacy-policy",
    english: "Privacy policy",
    required: /\bprivacy policy\b/i,
    "zh-CN": { term: "隐私政策" },
    "zh-TW": { term: "隱私權政策" },
    rationale: "Mullvad, uBlock Origin (zh-CN) and Chrome (zh-TW).",
    evidence: ["mullvad", "ublock", "chrome"],
  },
  {
    id: "import-export",
    english: "Import / Export",
    required: /\b(?:import|export)(?:s|ed|ing)?\b/i,
    "zh-CN": { term: "导入", alternatives: ["导出"], forbidden: ["汇入", "汇出"] },
    "zh-TW": { term: "匯入", alternatives: ["匯出"], forbidden: ["導入", "導出"] },
    rationale: "Chrome, Firefox, Mullvad, uBlock Origin: 导入/导出 and 匯入/匯出.",
    evidence: ["chrome", "firefox", "mullvad", "ublock"],
  },
  {
    id: "reset",
    english: "Reset",
    required: /\breset\b/i,
    "zh-CN": { term: "重置", forbidden: ["重设"] },
    "zh-TW": { term: "重設", forbidden: ["重置"] },
    rationale: "Chrome and Firefox: 重置 / 重設.",
    evidence: ["chrome", "firefox", "mullvad"],
  },
  {
    id: "delete-remove",
    english: "Delete / Remove",
    "zh-CN": { term: "删除", alternatives: ["移除"] },
    "zh-TW": { term: "刪除", alternatives: ["移除"] },
    rationale:
      "Delete (destroys data) is 删除 / 刪除; Remove (takes out of a list) is 移除. Keep the distinction in destructive confirmations.",
    evidence: ["chrome", "firefox"],
  },
  {
    id: "identity",
    english: "Identity",
    "zh-CN": { term: "身份" },
    "zh-TW": { term: "身分", forbidden: ["身份"] },
    rationale: "Chrome zh-TW uses Taiwan's standard form 身分.",
    evidence: ["chrome"],
  },
  {
    id: "client-hints",
    english: "Client hints",
    "zh-CN": { term: "客户端提示" },
    "zh-TW": { term: "用戶端提示", forbidden: ["客戶端"] },
    rationale: "Client is 客户端 in the mainland and 用戶端 in Taiwan.",
    evidence: ["mdn"],
  },
  {
    id: "devtools",
    english: "Developer tools",
    "zh-CN": { term: "开发者工具" },
    "zh-TW": { term: "開發者工具" },
    rationale: "Chrome zh-CN and Firefox zh-TW wording.",
    evidence: ["chrome", "firefox"],
  },
  {
    id: "website",
    english: "Site / website (generic)",
    "zh-CN": { term: "网站" },
    "zh-TW": { term: "網站" },
    rationale:
      "Generic websites only; never for Domain or Pattern. 站点 / 站點 are forbidden through the Domain entry.",
    evidence: ["chrome", "firefox"],
  },
  {
    id: "worker",
    english: "Web Worker / Service Worker / Shared Worker",
    "zh-CN": { term: "Worker" },
    "zh-TW": { term: "Worker" },
    rationale:
      "Web platform API names stay in English, as on MDN zh-CN. Dedicated Workers: 专用 Worker / 專用 Worker.",
    evidence: ["mdn", "chrome"],
  },
  {
    id: "playground",
    english: "Playground",
    required: /\bPlayground\b/,
    "zh-CN": { term: "演练场" },
    "zh-TW": { term: "演練場" },
    rationale:
      "The Options test page that compares real and spoofed values; same word as the TypeScript Playground's Chinese name.",
    evidence: [],
  },
  {
    id: "native",
    english: "Native (unprotected values or mode)",
    "zh-CN": { term: "原生", alternatives: ["真实"] },
    "zh-TW": { term: "原生", alternatives: ["真實"] },
    rationale:
      "The Native mode label is 原生; native browser values are 浏览器的真实值 / 瀏覽器的真實值.",
    evidence: [],
  },
];

/**
 * Regional vocabulary: each catalog must use its own region's words. These are the
 * other region's words written in this catalog's script, which a character conversion
 * would leave behind.
 */
export const ZH_REGIONAL_FORBIDDEN: Readonly<
  Record<ZhVariant, Readonly<Record<string, string>>>
> = {
  "zh-CN": {
    软体: "软件",
    硬体: "硬件",
    资讯: "信息",
    视讯: "视频",
    音讯: "音频",
    伺服器: "服务器",
    网路: "网络",
    萤幕: "屏幕",
    使用者: "用户",
    帐户: "账户",
    帐号: "账号",
    连结: "链接",
    载入: "加载",
    支援: "支持",
    介面: "界面",
    物件: "对象",
    函式: "函数",
    字元: "字符",
    程式码: "代码",
    程式: "程序",
    指令码: "脚本",
    记忆体: "内存",
    解析度: "分辨率",
    搜寻: "搜索",
    选单: "菜单",
    视窗: "窗口",
    档案: "文件",
    资料夹: "文件夹",
    线上: "在线",
    自订: "自定义",
    快取: "缓存",
    品质: "质量",
    最佳化: "优化",
    列印: "打印",
    预设值: "默认值",
    全域: "全局",
    回报: "报告",
    "「": "“",
    "」": "”",
  },
  "zh-TW": {
    默認: "預設",
    設置: "設定",
    軟件: "軟體",
    硬件: "硬體",
    信息: "資訊",
    視頻: "影片",
    音頻: "音訊",
    服務器: "伺服器",
    網絡: "網路",
    屏幕: "螢幕",
    賬戶: "帳戶",
    賬號: "帳號",
    鏈接: "連結",
    加載: "載入",
    界面: "介面",
    對象: "物件",
    函數: "函式",
    字符: "字元",
    內存: "記憶體",
    分辨率: "解析度",
    搜索: "搜尋",
    菜單: "選單",
    窗口: "視窗",
    文件夾: "資料夾",
    激活: "啟用",
    在線: "線上",
    實時: "即時",
    自定義: "自訂",
    緩存: "快取",
    數據: "資料",
    質量: "品質",
    優化: "最佳化",
    保存: "儲存",
    打印: "列印",
    全局: "全域",
    互聯網: "網際網路",
    "“": "「",
    "”": "」",
  },
};
