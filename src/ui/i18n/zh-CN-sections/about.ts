import { BRAND_DISPLAY_NAME } from "@/shared/brand";

const ABOUT_PRODUCT = `关于 ${BRAND_DISPLAY_NAME}`;
const ABOUT_PRODUCT_LOWER = `关于 ${BRAND_DISPLAY_NAME}`;
const HOW_TO_USE_PRODUCT = `如何使用 ${BRAND_DISPLAY_NAME}`;
const HOW_TO_USE_PRODUCT_LOWER = `如何使用 ${BRAND_DISPLAY_NAME}`;
const WHAT_PRODUCT_IS_NOT = `${BRAND_DISPLAY_NAME} 不是什么`;
const PRODUCT_NOT_LOWER = `${BRAND_DISPLAY_NAME} 不是什么`;
const TERMS_OF_USE = "使用条款";

export const about = {
  title: ABOUT_PRODUCT,
  description: `${BRAND_DISPLAY_NAME} 帮助你控制网站如何看到你的位置、区域设置、时区和部分浏览器身份信息。`,
  body1:
    "每个已保存的区域预设都将坐标、语言偏好和目标时区组合成一套可重复使用的配置，你可以将其应用到所选域名，而无需每次重新创建。",
  body2: `你的更改会自动保存。更新后的预设和规则将在下次加载页面时生效，以便 ${BRAND_DISPLAY_NAME} 从一开始就应用新配置。`,
  body3Prefix: "共享的浏览器保护控件位于",
  body3LinkLabel: "“选项”标签页",
  body3Suffix: "。",
  website: {
    prefix: "你可以访问 ",
    linkLabel: `${BRAND_DISPLAY_NAME} 网站`,
    url: "https://privacything.com",
    suffix: "，了解项目动态、下载和更多信息。",
  },
  versionLabel: "版本",
  browserTargetLabel: "目标浏览器",
  releaseChannelLabel: "发布渠道",
  copyLinkLabel: ABOUT_PRODUCT_LOWER,
  copyLinkTermsLabel: "使用条款",
  copyLinkPrivacyLabel: "关于隐私",
  copyLinkLimitationsLabel: PRODUCT_NOT_LOWER,
  copyLinkLicenseLabel: "许可证",
  copyLinkAssetsLabel: "第三方资源",
  copyLinkUsageLabel: HOW_TO_USE_PRODUCT_LOWER,
  releaseChannels: {
    local: "本地",
    beta: "Beta",
    stable: "稳定版",
  },

  support: {
    url: "https://webh.pl",
    logoLinkAriaLabel: "打开 webh.pl",
    bodyPrefix: `${BRAND_DISPLAY_NAME} 的发展得到了 `,
    linkLabel: "webh.pl",
    bodySuffix: " 的支持——为有抱负的项目提供快速、灵活的基础设施。",
  },

  terms: {
    title: TERMS_OF_USE,
    body1: `${BRAND_DISPLAY_NAME} 按“原样”提供，不附带任何形式的保证。`,
    body2: `${BRAND_DISPLAY_NAME} 帮助用户在本地控制浏览器暴露的部分位置、区域设置、时区及相关数据。它不是 VPN、代理、匿名工具或安全产品，也不保证不被检测到。`,
    body3: `使用 ${BRAND_DISPLAY_NAME} 的风险由你自行承担。你有责任遵守适用的法律、网站条款、工作场所政策和平台规则。`,
  },

  privacy: {
    title: "隐私",
    body: `${BRAND_DISPLAY_NAME} 将设置和已保存的配置存储在本地。可选的地图服务在你同意后会收到搜索和地图请求。如果你启用 Control D，域名规则的主机名、所选出口和受管理资源的名称会发送给 Control D。详情请参阅隐私政策。`,
    openPolicyButton: "打开隐私政策",
  },

  limitations: {
    title: WHAT_PRODUCT_IS_NOT,
    intro: `${BRAND_DISPLAY_NAME} 会更改通过浏览器可见的数据，例如地理位置、区域设置、时区和部分指纹细节。它的伪装不会路由流量。可选的 Control D 集成会同步区域规则；在你配置其解析器后，由 Control D 路由流量。`,
    body1:
      "仅靠浏览器层面的伪装，无法隐藏或替换你的 IP 地址。已配置的 Control D 解析器可以将所选网站的流量经由其出口路由。",
    body2: "它不能替代 VPN、代理或基于 DNS 的路由配置。",
    body3: "它本身不能让网站认为你的连接来自另一个国家。",
    outro: `使用 ${BRAND_DISPLAY_NAME} 进行浏览器层面的伪装。需要在网络层面更改位置时，请使用 VPN、代理或 DNS 工具。`,
  },

  license: {
    title: "许可证",
    creatorPrefix: "本项目的创建者是 ",
    creatorLabel: "Tomasz Janusz",
    creatorUrl: "https://tomaszjanusz.dev",
    creatorSuffix: "。",
    copyright: "版权所有 © 2025 至今。",
    body: `${BRAND_DISPLAY_NAME} 依据 GNU Affero General Public License v3.0 或更高版本提供，并附有附加条款。`,
    openLicenseButton: "打开许可证",
  },

  assets: {
    title: "第三方资源",
    body: `查看 ${BRAND_DISPLAY_NAME} 内置的第三方组件，并打开随附的许可证文本。`,
    openNoticesButton: "打开第三方声明",
    fontAwesome: {
      label: "Font Awesome Free 7.2.0",
      url: "https://fontawesome.com",
      body: " 由 Font Awesome / Fonticons, Inc. 提供，采用 CC BY 4.0、SIL OFL 1.1 和 MIT 许可证。",
    },
    mapLibre: {
      label: "MapLibre GL JS",
      url: "https://maplibre.org/maplibre-gl-js/docs/",
      body: " 已内置在本地，用于渲染矢量地图。",
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
      body: " 提供生成预设时使用的国家与语言默认对应关系。",
      licenseLabel: "CC BY-SA 2.0",
      licenseUrl: "https://wiki.openstreetmap.org/wiki/Wiki_content_license",
      licenseBody: " 适用于该 Wiki 内容，此处据此注明出处。",
    },
    mapPreviewsPrefix: "交互式地图预览使用 ",
    mapPreviewsMiddle: " 服务，地图上显示 ",
    mapPreviewsSuffix: " 贡献者署名。",

    localData: {
      title: "本地数据集",
      body: `${BRAND_DISPLAY_NAME} 内置了基于经过处理的公开数据构建的小型本地数据库，使伪装值在统计上保持真实。不会从互联网获取任何内容——这些是内置在本地的快照，每次扩展更新时一并更新。`,
      steam: {
        label: "Steam Hardware & Software Survey",
        url: "https://store.steampowered.com/hwsurvey/",
        body: "（Valve）提供本地硬件配置所用的 Windows、Linux 和 macOS 屏幕分辨率、CPU 核心数和内存分布。",
      },
      chromiumDash: {
        label: "ChromiumDash",
        url: "https://chromiumdash.appspot.com/",
        body: " 提供用于 User-Agent 和客户端提示的真实 Chrome 发布版本号。",
      },
      localeCatalog: {
        prefix: "来自 ",
        mozilla: {
          label: "Mozilla",
          url: "https://github.com/mozilla-firefox/firefox/blob/main/intl/locale/language.properties",
        },
        middle: " 和 ",
        chromium: {
          label: "Chromium",
          url: "https://github.com/chromium/chromium/blob/main/ui/base/l10n/l10n_util.cc",
        },
        body: " 的区域设置目录提供与各浏览器引擎一致的语言显示名称。",
      },
    },
  },

  projectLinks: {
    description: `${BRAND_DISPLAY_NAME} 不止存在于扩展之中。你可以访问网站、浏览代码，或在出现问题时告诉我。`,
    websiteLabel: "网站",
    websiteUrl: "https://privacything.com",
    sourceLabel: "源代码",
    sourceUrl: "https://github.com/Privacy-Thing/browser-extension",
    reportBugLabel: "报告错误",
    reportBugUrl:
      "https://github.com/Privacy-Thing/browser-extension/issues/new?template=bug_report.yml",
  },

  usage: {
    title: HOW_TO_USE_PRODUCT,
    body1: "如果你想要一个快速、真实的起点，可以先根据搜索到的地点生成区域预设。",
    body2: `为每个希望 ${BRAND_DISPLAY_NAME} 模拟的真实地点保存一个区域预设，然后将网站分配给对应的预设。`,
    body3:
      "使用弹出窗口快速分配域名。需要管理预设和规则的完整控制面板时，请打开“设置”。",
    body4: `需要进一步控制 ${BRAND_DISPLAY_NAME} 的行为时，请查看“选项”和“高级”。`,
  },
} as const;
