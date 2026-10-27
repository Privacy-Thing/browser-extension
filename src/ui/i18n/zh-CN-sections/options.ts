import { workerHandlingModeCopy } from "./shared-worker";

import { BRAND_DISPLAY_NAME } from "@/shared/brand";

export const options = {
  title: "设置",
  tabsAriaLabel: "设置类别",
  spoofingOffBannerTitle: "伪装已关闭",
  spoofingOffBannerBody: `${BRAND_DISPLAY_NAME} 目前未应用伪装的位置或浏览器值。`,
  spoofingOffBannerAction: "重新开启伪装",
  spoofingTurnedOffToast: `${BRAND_DISPLAY_NAME} 已关闭。`,
  spoofingTurnedOnToast: `${BRAND_DISPLAY_NAME} 已开启。`,

  tabs: {
    locations: "区域预设",
    rules: "域名规则",
    trustedSites: "受信任的网站",
    playground: "演练场",
    options: "选项",
    advanced: "高级",
    about: "关于",
  },
} as const;

export const optionsPage = {
  browserFingerprintSpoofing: {
    title: "全局保护设置",
    description: `选择 ${BRAND_DISPLAY_NAME} 默认使用哪些浏览器保护。更具体的设置可以覆盖单项保护，而“受信任的网站”可以对匹配的网站停用这些保护。`,
    disabledNote: `浏览器保护已在所有网站上关闭。重新开启后，即可选择 ${BRAND_DISPLAY_NAME} 默认伪装哪些内容。`,
    copyLinkLabel: "浏览器保护",
    interceptsApis: (count: number) => `拦截 ${count} 个浏览器 API`,
    items: {
      geolocation: {
        label: "地理位置",
        description: `控制地理位置 API。开启后，${BRAND_DISPLAY_NAME} 会使用你当前的预设响应位置请求。关闭后，网站将获得浏览器真实的地理位置结果。`,
        advancedButton: "高级",
        advancedModal: {
          title: "地理位置高级设置",
          description: "调整默认坐标半径和位置更新时间。",
        },
      },
      timeLocale: {
        label: "时间和区域设置",
        description: `控制 Date、Intl、navigator.language、navigator.languages 和语言标头。开启后，${BRAND_DISPLAY_NAME} 会让这些值与你当前的预设保持一致。关闭后，网站将看到你浏览器真实的区域设置。`,
      },
      canvas: {
        label: "Canvas",
        description: `网站可以绘制隐藏图像，并利用细微的渲染差异来识别你的浏览器。开启后，${BRAND_DISPLAY_NAME} 会添加受控的噪声，使结果更难被当作指纹重复使用。关闭后，网站将获得你真实的 Canvas 输出。`,
      },
      webGL: {
        label: "WebGL",
        description: `WebGL 会暴露图形相关细节，例如 GPU 型号、渲染器和驱动程序行为。开启后，${BRAND_DISPLAY_NAME} 会用符合你当前平台的一致配置替换这些线索。关闭后，网站可以读取更接近你真实设备的图形数据。`,
      },
      audio: {
        label: "音频",
        description: `音频 API 会产生网站可在后台测量的细微硬件差异。开启后，${BRAND_DISPLAY_NAME} 会略微更改这些值，降低其用于跟踪的价值。关闭后，音频输出保持不变。`,
      },
      navigator: {
        label: "Navigator",
        description: `Navigator 字段会暴露你的平台、语言设置、CPU 信息及其他浏览器身份数据。开启后，${BRAND_DISPLAY_NAME} 会掩盖所选的身份字段，同时保持它们内部一致。关闭后，网站将看到更多你真实的浏览器身份。`,
      },
      screen: {
        label: "屏幕",
        description: `屏幕尺寸、像素比和色深有助于将你缩小到一小部分设备。开启后，${BRAND_DISPLAY_NAME} 会掩盖这些确切的显示细节。关闭后，网站将获得你真实的屏幕属性。`,
      },
      clientHints: {
        label: "客户端提示",
        description: `客户端提示通过请求标头和 JavaScript API 共享浏览器版本、平台和设备数据。开启后，${BRAND_DISPLAY_NAME} 会让这些值与你伪装的浏览器身份保持一致。关闭后，网站将获得你真实的浏览器和平台信息。`,
      },
      battery: {
        label: "电池",
        description: `电池状态可能暴露不断变化的设备信息，网站可能借此关联多次访问。开启后，${BRAND_DISPLAY_NAME} 会报告电池已充满且正在充电，而不是设备的真实状态。关闭后，网站可以读取原生的电池状态 API。`,
      },
      clientHintsVersionRotation: {
        label: "轮换构建号和补丁号",
        description: (count: number) =>
          `轮换通过客户端提示暴露的 Chromium 引擎构建号和补丁号，同时保留你已安装浏览器的主版本号。${BRAND_DISPLAY_NAME} 内置了最近 Chromium 构建的目录；对于此浏览器版本，它可以从 ${count} 个匹配条目中选择。精简后的 User-Agent 字符串保持浏览器原生的隐私保护格式 .0.0.0。`,
        hintPrefix: "例如：",
        hint: "139.0.[构建号].[补丁号]",
      },
      webRTC: {
        label: "WebRTC",
        description: `即使你使用 VPN 或代理，WebRTC 也可能暴露本地或公网 IP 地址。开启后，${BRAND_DISPLAY_NAME} 会要求浏览器使用最严格的 IP 处理模式。关闭后，WebRTC 将正常运行，这可能会暴露更多网络信息。`,
      },
      serviceWorker: {
        label: "Service Worker",
        description: `Service Worker 在后台运行，可能让网站保留长期数据和标识符。如果你希望 ${BRAND_DISPLAY_NAME} 默认在所有网站上阻止注册 Service Worker，请开启此选项。`,
        warning:
          "阻止 Service Worker 可能导致可安装的 Web 应用（PWA）、离线模式、推送通知和后台同步无法正常工作。某些应用还可能运行变慢或丢失功能。",
        defaultState:
          "默认不阻止——你可以全局开启阻止，然后通过域名规则为特定域名允许 Service Worker。",
        allow: "允许",
        block: "阻止",
      },
      sharedWorker: {
        label: "专用 Worker 和 Shared Worker",
        descriptionLead:
          "选择专用 Worker 和 Shared Worker 的默认运行方式。域名规则和 Firefox 容器可以为匹配的网站覆盖此策略。",
        copyLinkLabel: "专用 Worker 和 Shared Worker 处理方式",
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
    label: "在扩展徽章上显示调用次数",
    description: `在扩展徽章上显示 ${BRAND_DISPLAY_NAME} 已处理的浏览器 API 调用次数，而不是文字标签。`,
    includeDateCalls: {
      label: "包括 Date 和 Temporal API 调用",
      description:
        "将 Date.* 和 Temporal.* 调用计入徽章数字。关闭此选项可避免频繁的时间检查导致计数虚高。",
    },
  },
  copyLinkHelpLabel: "选项帮助",
  help: {
    title: "选项",
    body1: `浏览器保护让你选择 ${BRAND_DISPLAY_NAME} 默认伪装哪些值。除非域名规则或 Firefox 容器另有设置，否则这些设置会影响所有网站。`,
    body2: `隐私设置管理 ${BRAND_DISPLAY_NAME} 仅有的可选网络请求，这些请求只在你设置位置时发出。即使保持关闭，${BRAND_DISPLAY_NAME} 仍可正常工作——你只需手动添加位置，而不使用搜索或地图预览。`,
  },
} as const;
