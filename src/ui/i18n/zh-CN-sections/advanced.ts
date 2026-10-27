import { BRAND_DISPLAY_NAME } from "@/shared/brand";
import { externalMapConsentCopy } from "@/ui/i18n/zh-CN-sections/osm";

const TURN_OFF_PRODUCT = `关闭 ${BRAND_DISPLAY_NAME}`;

export const advanced = {
  runtimeTitle: "高级选项",
  runtimeDescription: "管理详细的运行时日志。",
  copyLinkRuntimeLabel: "高级设置",
  copyLinkHelpLabel: "高级帮助",

  noiseRadius: {
    title: "默认最大坐标半径",
    description: "设置新建预设的默认最大坐标半径（单位：米）。",
    copyLinkLabel: "默认最大坐标半径",
  },

  generatedLocationRandomization: {
    enabled: {
      title: "新建区域预设时随机化坐标",
      description:
        "将此设置用作生成预设的默认值。需要精确坐标时，你仍可在每次操作中将其关闭。",
      readWhy: "了解原因。",
      tooltipPrivacy: `${BRAND_DISPLAY_NAME} 注重隐私。预设应当易于使用，但重复使用目录或搜索结果中的精确坐标，可能会让 ${BRAND_DISPLAY_NAME} 用户更容易被识别。`,
      tooltipExact: "需要特定位置？关闭此开关后，预设将使用精确坐标。",
      copyLinkLabel: "新预设坐标随机化",
    },
    radius: {
      title: "默认坐标随机化半径",
      description:
        "选择开启坐标随机化时使用的默认半径。请输入 1 到 99 之间的整数（单位：公里）。",
      inputLabel: "默认坐标随机化半径（公里）",
      copyLinkLabel: "默认坐标随机化半径",
    },
  },

  themeMode: {
    title: "主题",
    description: `选择 ${BRAND_DISPLAY_NAME} 跟随系统外观，还是始终使用固定的浅色或深色主题。`,
    label: "外观",
    options: {
      system: "跟随系统",
      light: "浅色",
      dark: "深色",
    },
    copyLinkLabel: "主题",
  },

  watchPositionDelay: {
    title: "位置跟踪延迟范围（秒）",
    description: "设置网站上两次位置更新之间的最短和最长延迟。",
    copyLinkLabel: "位置跟踪延迟范围",
  },

  debugMode: {
    title: "调试模式",
    description: `在浏览器开发者控制台中记录 ${BRAND_DISPLAY_NAME} 的详细运行时活动。`,
    copyLinkLabel: "调试模式",
  },

  experimental: {
    title: "实验性功能",
    description:
      "试用针对仍在逐步推出的浏览器 API 的保护。这些开关在所有发布渠道中均可用。",
    copyLinkLabel: "实验性设置",
    temporalApi: {
      title: "Temporal API",
      description:
        "当此浏览器提供原生 Temporal API 时，保护其日期、时间、区域设置和默认时区行为。不会安装垫片代码。",
      copyLinkLabel: "Temporal API",
    },
    domainFencing: {
      title: "域名隔离",
      description:
        "当默认规则或 Firefox 容器生效时，每个网站都会获得各自稳定的指纹。你的区域预设保持不变。",
      copyLinkLabel: "域名隔离",
    },
  },

  privacy: {
    title: "隐私",
    description: `${BRAND_DISPLAY_NAME} 在你的设备上运行，不会将你的浏览数据发送到任何地方。只有在你设置区域预设时使用位置搜索或地图预览，才会发出可选的网络请求。`,
    copyLinkLabel: "隐私",

    osmConsent: {
      title: externalMapConsentCopy.title,
      description: externalMapConsentCopy.description,
      stateUnknown: `你尚未作出选择。${BRAND_DISPLAY_NAME} 在连接外部地图服务之前会先询问你。`,
      statePrefix: "外部地图访问",
      stateEnabled: "已启用——可以加载位置搜索和地图预览",
      stateDisabled: `已停用——配置位置时 ${BRAND_DISPLAY_NAME} 将保持离线`,
      copyLinkLabel: "外部地图访问",
    },
  },

  display: {
    title: "外观",
    description: "调整视觉呈现和无障碍设置。",
    copyLinkLabel: "外观",

    language: {
      title: "语言",
      description: `设为“自动”时，${BRAND_DISPLAY_NAME} 跟随浏览器语言。选择一种语言即可改用该语言。`,
      optionAutomatic: "自动",
      optionEnglish: "英语",
      optionSpanish: "西班牙语",
      optionPortuguese: "葡萄牙语",
      optionRussian: "俄语",
      optionUkrainian: "乌克兰语",
      optionSimplifiedChinese: "简体中文",
      optionTraditionalChinese: "繁体中文",
      reportLabel: "发现翻译错误？请报告",
      copyLinkLabel: "语言",
    },

    reduceMotion: {
      title: "减少动画",
      description: `关闭 ${BRAND_DISPLAY_NAME} 中的所有界面动画。`,
      systemOverride: "你的系统无障碍设置已启用“减少动画”。",
      copyLinkLabel: "减少动画",
    },

    accentColor: {
      title: "强调色",
      description: `从受 Firefox 容器颜色启发的预设调色板中选择 ${BRAND_DISPLAY_NAME} 的主强调色。`,
      copyLinkLabel: "强调色",
      optionAriaLabel: (label: string) => `使用${label}作为强调色`,
      options: {
        teal: "青色",
        blue: "蓝色",
        green: "绿色",
        yellow: "黄色",
        orange: "橙色",
        red: "红色",
        pink: "粉色",
        purple: "紫色",
        gray: "灰色",
      },
    },

    highContrast: {
      title: "高对比度模式",
      description: "提高文字对比度和边框可见度，以改善可读性。",
      copyLinkLabel: "高对比度模式",
    },
  },

  danger: {
    title: "危险区域",
    description: `这些操作可能会替换、删除或恢复你在本地保存的 ${BRAND_DISPLAY_NAME} 设置和数据。`,
    copyLinkLabel: "危险区域",

    spoofing: {
      title: TURN_OFF_PRODUCT,
      description: `关闭 ${BRAND_DISPLAY_NAME} 的所有保护，直到你重新开启。`,
      copyLinkLabel: TURN_OFF_PRODUCT,
    },

    export: {
      title: "导出",
      description: "将当前的预设、规则和相关设置下载为 JSON 备份。",
      button: "导出设置",
      copyLinkLabel: "导出设置",
    },

    import: {
      title: "导入",
      description: "预览 JSON 备份，然后替换配置，或合并所选的预设和规则。",
      button: "导入设置",
      copyLinkLabel: "导入设置",
    },

    reload: {
      title: "重新加载",
      description: "从扩展存储重新加载已保存的设置，并丢弃当前视图中未保存的更改。",
      button: "重新加载设置",
      copyLinkLabel: "重新加载设置",
    },

    reset: {
      title: "重置",
      description: "恢复初始默认设置，并移除你的自定义预设和规则。",
      button: "重置设置",
      copyLinkLabel: "重置设置",
      confirmTitle: "要重置设置吗？",
      confirmBody: "此操作将永久删除你保存的预设、规则和自定义设置，且无法撤消。",
      onboardingToggleLabel: "重置后再次运行设置向导",
      onboardingToggleDescription: "清除设置后，重新打开首次运行设置向导。",
    },
  },

  help: {
    title: "高级",
    body1: `使用“高级”可以微调保护、暂时关闭 ${BRAND_DISPLAY_NAME}，或管理你在本地保存的设置和数据。`,
    body2:
      "导入、导出、重新加载和重置可帮助你在浏览器之间迁移设置、从错误中恢复，或在出现不同步时恢复已保存的设置。",
  },
} as const;
