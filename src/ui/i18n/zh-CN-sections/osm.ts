import { BRAND_DISPLAY_NAME } from "@/shared/brand";

export const externalMapConsentCopy = {
  title: "允许位置搜索和地图请求",
  description: `允许 ${BRAND_DISPLAY_NAME} 在你搜索位置时向 OpenStreetMap Nominatim 发送搜索查询，并在显示地图预览时从 OpenFreeMap 请求矢量瓦片和字体。这些服务会收到你的搜索文本、地图和字体请求以及你的 IP 地址，但不会收到你保存的规则、预设或浏览记录。如果你希望在设置过程中手动输入坐标、不向地图服务发出请求，请保持此项关闭。`,
} as const;

export const osm = {
  modalTitle: "允许外部地图和搜索请求？",
  body1: `外部地图访问是可选的。${BRAND_DISPLAY_NAME} 本身不会将你的预设、规则或浏览数据发送给这些服务。`,
  body2: `如果你允许，${BRAND_DISPLAY_NAME} 可能会联系 OpenStreetMap Nominatim 进行位置搜索，并联系 OpenFreeMap 获取交互式地图预览。`,
} as const;
