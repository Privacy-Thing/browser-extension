import { BRAND_DISPLAY_NAME } from "@/shared/brand";
import { externalMapConsentCopy } from "@/ui/i18n/zh-CN-sections/osm";

const WELCOME_PRODUCT = `欢迎使用 ${BRAND_DISPLAY_NAME}`;

export const welcome = {
  title: WELCOME_PRODUCT,
  loading: "正在加载设置向导…",
  progressLabel: "设置进度",
  previous: "上一步",
  next: "下一步",
  privacyPolicy: "隐私政策",
  privacyDialog: {
    title: "隐私政策",
    description: `${BRAND_DISPLAY_NAME} 如何处理设置、诊断信息和网络请求。`,
    close: "关闭隐私政策",
  },
  saving: "正在保存…",
  unexpectedError: "出了点问题",
  importSuccess: "设置已导入",
  importError: "无法导入设置",
  importParseError: "无法读取设置文件",
  steps: {
    welcome: {
      title: "感谢您安装此扩展",
      description:
        "自行选择网站看到的内容，而不是暴露您的真实位置和浏览器身份。这份简短的可选向导会带您完成首次设置中的各项选择（每一项都可以撤消），并将其保存到您随时可以重新查看的“设置”中。已有可以重复使用的配置？",
      importInline: "改为导入设置",
      advancedTitle: "我知道自己想要什么",
      advancedDescription:
        "跳过向导，以干净的默认设置打开“设置”。不会添加任何区域预设或域名规则，默认规则保持关闭，浏览器保护仍可用于您之后创建的规则。",
      guidedTitle: "前往设置向导",
      guidedDescription:
        "按顺序完成最初的几项决定。向导会限定选择范围、说明利弊，并将所有内容保存到之后可以编辑的同一“设置”界面中。",
      advancedCta: "跳过设置向导",
      guidedCta: "开始设置",
    },
    privacy: {
      title: "您的浏览数据保留在本地",
      description: `${BRAND_DISPLAY_NAME} 将规则和预设存储在本地。此步骤仅涉及可选的外部地图服务：如果您希望在设置过程中使用搜索和预览，请启用它们；也可以保持关闭，手动输入坐标。`,
      descriptionBeforePolicy: `${BRAND_DISPLAY_NAME} 将规则和预设存储在本地。可选的地图搜索和预览只有在您允许后才会使用外部服务。请先阅读`,
      policyLink: "隐私政策",
      descriptionAfterPolicy: "，再决定这些请求是否适合您的配置。",
      consentTitle: externalMapConsentCopy.title,
      consentDescription: externalMapConsentCopy.description,
    },
    presets: {
      title: "添加区域预设",
      description:
        "区域预设提供现成的位置以及匹配的语言和时区设置，因此当您使用该位置时，网站看到的区域配置会更加一致。请只选择您希望加入初始预设库的地点。设置向导会在最后导入所选的预设，之后您可以编辑或删除其中任何一个。",
      selectAll: "全选",
      selectNone: "全部清除",
      selectedCount: (count: number) => `已选择 ${count} 个`,
    },
    scope: {
      title: "选择保护从哪里开始",
      description:
        "当没有更具体的设置优先适用时，默认规则才会生效。保持关闭可以从更少的改动开始，或启用它来保护未匹配的网站。",
      defaultRuleDescription:
        "如果您为默认规则分配了区域预设，请保持选中该预设，以便设置向导在保存前导入它。",
      enableEverywhereTitle: `在所有网站上使用 ${BRAND_DISPLAY_NAME}`,
      enableEverywhereDescription: `如果您希望 ${BRAND_DISPLAY_NAME} 在没有专属规则的网站上也处于活动状态，请立即开启默认规则。之后您仍可以使用域名规则缩小作用范围、为特定主机分配不同的预设，或通过“受信任的网站”排除敏感网站。`,
      editDefaultRuleTitle: "默认规则设置",
      editDefaultRule: "编辑默认规则",
      editDefaultRuleDescription: "在设置完成前，选择默认规则的预设和自定义保护设置。",
      defaultRuleDialogDescription:
        "在设置过程中，此对话框可以使用您选择的区域预设，即使它们尚未导入。如果您在此处分配了预设，请保持选中它，以便设置向导创建该预设。",
      presetMismatch: (label: string) =>
        `默认规则已分配给 ${label}，但该预设未被选中导入。请重新选中该预设，或为默认规则选择其他预设。`,
    },
    chromium: {
      title: "轮换 Chromium 构建信息",
      description: (count: number) =>
        `${BRAND_DISPLAY_NAME} 可以轮换通过客户端提示暴露的 Chromium 引擎构建号和补丁号，同时让主版本号与您已安装的浏览器保持一致。内置目录包含近期的 Chromium 构建；对于此浏览器版本，${BRAND_DISPLAY_NAME} 可以从 ${count} 个匹配条目中选择。`,
      switchTitle: "轮换构建号和补丁号",
      switchDescription:
        "伪装客户端提示时，使用内置目录中近期的 Chromium 构建号和补丁号。如果您希望这些次要版本信息保持固定，请关闭此选项。",
    },
    firefox: {
      title: "Firefox userScripts 权限（可选）",
      description: `不授予此权限，您也可以在 Firefox 中使用 ${BRAND_DISPLAY_NAME}。如果您授予 userScripts 权限，${BRAND_DISPLAY_NAME} 可以在受支持的网站上更早地应用伪装值，从而在首次加载页面时改善保护。您可以现在跳过，之后在“设置”中更改。`,
      action: "授予 userScripts 权限",
      granted: "已授予权限",
      skipped: `没有此权限，您也可以继续使用 ${BRAND_DISPLAY_NAME}。`,
    },
    appearance: {
      title: "调整到舒适的样式",
      description: `在开始使用之前，选择扩展界面的外观。这些设置仅影响 ${BRAND_DISPLAY_NAME} 界面，不会改变网站上的伪装行为、区域预设或规则。之后您也可以在“设置”中调整相同的显示选项。`,
      themeTitle: "主题",
      themeDescription: `跟随系统设置，或为所有 ${BRAND_DISPLAY_NAME} 界面选择固定的浅色或深色主题。`,
      reduceMotionTitle: "减少动画",
      reduceMotionDescription: `关闭 ${BRAND_DISPLAY_NAME} 中的所有界面动画。`,
      reduceMotionSystemOverride: "您的系统无障碍设置已启用“减少动画”。",
      accentTitle: "强调色",
      accentDescription: "选择用于控件、活动状态、焦点强调和所选项目的突出显示颜色。",
      contrastTitle: "高对比度模式",
      contrastDescription:
        "如果默认外观看起来太淡，可以提高整个扩展界面中文字、边框和控件的对比度。",
    },
    done: {
      title: "设置已就绪",
      description: `${BRAND_DISPLAY_NAME} 将保存这些选择并打开“设置”。您可以在那里查看已导入的预设、调整默认规则，以及更改外观或隐私设置。`,
      cta: "打开设置",
    },
  },
  presetNames: {
    spfWarsaw: "华沙",
    spfParis: "巴黎",
    spfLondon: "伦敦",
    spfOttawa: "渥太华",
    spfNewYork: "纽约",
    spfLasVegas: "拉斯维加斯",
    spfSanFrancisco: "旧金山",
    spfSydney: "悉尼",
    spfBeijing: "北京",
    spfHongKong: "香港",
    spfNewDelhi: "新德里",
    spfCairo: "开罗",
    spfLagos: "拉各斯",
    spfKyiv: "基辅",
    spfKinshasa: "金沙萨",
    spfSaoPaulo: "圣保罗",
    spfBuenosAires: "布宜诺斯艾利斯",
    spfLima: "利马",
    spfRioDeJaneiro: "里约热内卢",
    spfCaracas: "加拉加斯",
    spfBerlin: "柏林",
    spfMadrid: "马德里",
  },
  themeOptions: {
    system: "跟随系统",
    light: "浅色",
    dark: "深色",
  },
} as const;
