import { BRAND_DISPLAY_NAME } from "@/shared/brand";

const PRODUCT_NOT_LOWER = `${BRAND_DISPLAY_NAME} 不是什么`;

export const locations = {
  title: "区域预设",
  description: "区域预设将坐标、区域设置和时区组合在一起，用于伪装。",
  addManualButton: "手动添加",
  actionsMenuLabel: "预设操作",
  generateButton: "生成预设",
  searchPlaceholder: "搜索预设…",
  unused: "未使用",
  assigned: (count: number) => `用于 ${count} 条规则`,
  viewAssignedRulesAriaLabel: (locationLabel: string, count: number) =>
    `显示分配给 ${locationLabel} 的 ${count} 条域名规则`,
  copyLinkLabel: "区域预设",
  copyLinkHelpLabel: "区域预设帮助",

  playgroundCard: {
    title: "演练场",
    body1:
      "在将已保存的预设分配给网站之前进行预览。演练场会使用与受保护网站相同的地理位置行为，显示其区域设置、时区、日期格式和伪装坐标。",
    body2:
      "默认情况下，演练场每 2 到 5 秒更新一次伪装的地理位置，便于观察移动。真实网站则使用您配置的“位置跟踪延迟”。",
  },

  help: {
    title: "区域预设",
    body1:
      "一个区域预设应描述一个可信的地点。请让其主要语言、语言列表和时区与坐标所在的同一区域保持一致。",
    body2: `更改会自动保存。编辑字段后，${BRAND_DISPLAY_NAME} 会在短暂停顿后写入更新。`,
    body3:
      "已保存的区域预设会更改浏览器层面的值，例如地理位置、区域设置和时区。它本身不会路由流量。配置 Control D 后，已同步的域名规则可以使用匹配的出口。",
    privacyTitle: "隐私",
    privacyBody: `搜索和地图预览是可选的。只有在您允许后，${BRAND_DISPLAY_NAME} 才会连接 OpenStreetMap Nominatim 进行搜索，并连接 OpenFreeMap 显示交互式地图预览。`,
    networkTitle: "网络限制",
    networkBodyPrefix: "需要在网络层面更改位置？请使用 VPN、代理或 DNS 工具。请参阅“",
    networkBodyLinkLabel: PRODUCT_NOT_LOWER,
    networkBodySuffix: "”。",
  },

  regionalReview: {
    title: "区域预览",
    mismatch: (saved: string, suggested: string) =>
      `时区 ${saved} 与建议的 ${suggested} 不同。`,
    approximation:
      "您可以保留自己的选择。更改时区不会改变语言。在边境附近和海上，建议的时区只是近似值。",
    outsideLand:
      "这些坐标位于陆地之外，因此不提供时区建议。请检查纬度和经度；您所选的时区保持不变。",
    applyTimeZone: (zone: string) => `使用 ${zone}`,
    scope:
      "这些值在时间和语言保护开启时显示。域名规则可能会停用此保护。“优先使用英语”会更改网站语言；日期和数字仍保留区域格式。",
    browserLanguage: "浏览器语言",
    preferredLanguages: "首选语言",
    languageHeader: "网站语言标头",
    formattingLocale: "日期和数字区域设置",
    january: "1 月示例",
    july: "7 月示例",
    number: "数字示例",
    samples:
      "示例使用 2026 年 1 月 15 日和 7 月 15 日 12:34:56 UTC 的时间，以及数字 1234567.89。",
    unavailable: "预览不可用。请检查时区和语言；您的草稿未更改。",
  },

  editor: {
    title: "编辑预设",
    description: "更新已保存的区域预设，包括坐标、区域格式和位置报告行为。",
    deleteBlockedTitle: "无法删除此预设",
    deleteBlocked: (count: number) =>
      `有 ${count} 条规则正在使用此预设。请先重新分配或移除这些规则。`,
    deleteBlockedListLabel: "使用此预设的规则",
    disabledDependencySuffix: "（关闭）",
    mapDisabledTitle: "地图已停用",
    mapDisabledBody: "由于您未允许外部地图请求，地图预览未加载。",
    geolocationSectionTitle: "地理位置",
    geolocationSectionDescription: "坐标、精确度，以及伪装位置允许的最大偏移范围。",
    localeSectionTitle: "时间和语言",
    localeSectionDescription: "让与区域设置相关的值与已保存坐标所在的区域保持一致。",
    primaryLocaleLabel: "主要区域设置",
    languageDescription: "这是此预设用于日期、数字和其他本地化值的主要区域格式。",
    languageBehaviorDescription:
      "关闭“在网站上优先使用英语”时，网站读取的 navigator.language 也是此值。即使英语排在语言列表首位，此区域设置仍决定默认的日期和数字格式。",
    preferredLanguagesLabel: "首选语言",
    languagesDescription: "此预设的浏览器语言偏好的有序列表。",
    languagesBehaviorDescription: `${BRAND_DISPLAY_NAME} 会将此顺序作为 navigator.languages 及相关语言偏好公开。请将主要区域设置放在首位，然后添加网站在此预设下可能合理看到的备选语言。`,
    preferEnglishContentLabel: "在网站上优先使用英语",
    preferEnglishContentDescriptionPrefix: `${BRAND_DISPLAY_NAME} 会保留已保存的区域设置作为区域基准，但会将`,
    preferEnglishContentDescriptionSuffix:
      "放在浏览器语言偏好的首位，使网站更有可能保持英文显示。",
    preferEnglishContentLockedTagTitle: (locale: string) =>
      `${locale} 由“在网站上优先使用英语”偏好注入，无法在此处移除。`,
    accuracyDescription: "控制网站在地理位置结果中看到的精确度值。",
    noiseRadiusDescription: "伪装坐标与此预设的已保存位置之间允许的最大距离。",
  },

  generator: {
    title: "生成预设",
    searchStepDescription: "搜索城市、地址或地名以创建新预设。",
    resultStepDescription: `请在 ${BRAND_DISPLAY_NAME} 创建预设之前选择匹配的结果。`,
    languageStepDescription: "在查看其余内容之前，请选择作为此预设基础的浏览器语言。",
    confirmStepDescription: "添加前，请在地图上确认该预设。",
    locationLabel: "位置",
    locationPlaceholder: "波兰华沙",
    osmDisclaimer:
      "搜索查询使用外部 OpenStreetMap Nominatim API。在您同意后，交互式预览会使用 OpenFreeMap 的矢量瓦片和字体。",
    resultSelectLabel: "搜索结果",
    resultStepBody:
      "OpenStreetMap 返回了多个可能的匹配项。请选择您要找的地点，然后继续。",
    resultStepHint: "请选择一个结果以继续。",
    languageSelectLabel: "浏览器语言",
    languageStepBody: "此地点有多种可用的浏览器语言。请选择您希望此预设使用的语言。",
    languageStepHint: "如果下方没有列出您想要的语言，可以在下一步中选择其他语言。",
    resultPrefix: "结果：",
  },
} as const;
