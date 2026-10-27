import { BRAND_DISPLAY_NAME } from "@/shared/brand";

export const common = {
  copyLinkTo: (section: string) => `复制指向“${section}”的链接`,

  /** Joins sentence fragments around inline links and emphasis. */
  typography: {
    fragmentSpace: "",
    fullStop: "。",
    listSeparator: "、",
  },

  actions: {
    cancel: "取消",
    reset: "重置",
    close: "关闭",
    create: "创建",
    save: "保存",
    back: "返回",
    continue: "继续",
    edit: "编辑",
    delete: "删除",
    duplicate: "创建副本",
    search: "搜索",
    clear: "清除",
    deleteSelected: "删除所选项",
    clearSelection: "清除选择",
    openPrivacyPolicy: "打开隐私政策",
    allowOpenStreetMap: "允许访问地图",
    notNow: "以后再说",
    openPlayground: "打开演练场",
  },
  selectionCount: (count: number) => `已选择 ${count} 项`,

  fields: {
    name: "名称",
    latitude: "纬度",
    longitude: "经度",
    countryCodeHint: "用于区域性服务的两字母国家/地区代码。",
    countryCode: "国家/地区代码",
    accuracy: "精确度",
    noiseRadius: "最大半径（米）",
    timeZone: "时区",
  },

  coordinateRandomization: {
    labelBefore: "随机化坐标，半径",
    labelAfter: "公里。",
    radiusInputLabel: "坐标随机化半径（公里）",
    readWhy: "了解原因。",
    tooltipPrivacy: `${BRAND_DISPLAY_NAME} 注重隐私。预设应当易于使用，但重复使用目录或搜索结果中的精确坐标可能会让 ${BRAND_DISPLAY_NAME} 用户更容易被识别。`,
    tooltipExact: `需要特定位置？关闭此开关后，${BRAND_DISPLAY_NAME} 将使用精确坐标。你可以在“选项 > 地理位置 > 高级”中更改默认值。`,
  },
} as const;
