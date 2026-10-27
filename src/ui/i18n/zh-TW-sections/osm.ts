import { BRAND_DISPLAY_NAME } from "@/shared/brand";

export const externalMapConsentCopy = {
  title: "允許位置搜尋和地圖請求",
  description: `允許 ${BRAND_DISPLAY_NAME} 在你搜尋位置時，將搜尋查詢傳送到 OpenStreetMap Nominatim；並在顯示地圖預覽時，向 OpenFreeMap 請求向量圖磚和字型。這些服務會收到你的搜尋文字、地圖和字型請求，以及你的 IP 位址，但不會收到你已儲存的規則、預設集或瀏覽記錄。如果你偏好手動輸入座標，不想在設定期間發出地圖服務請求，請保持關閉。`,
} as const;

export const osm = {
  modalTitle: "要允許外部地圖和搜尋請求嗎？",
  body1: `外部地圖存取為選用功能。${BRAND_DISPLAY_NAME} 本身不會將你的預設集、規則或瀏覽資料傳送給這些服務。`,
  body2: `如果你允許，${BRAND_DISPLAY_NAME} 可能會連線至 OpenStreetMap Nominatim 以搜尋位置，並連線至 OpenFreeMap 以顯示互動式地圖預覽。`,
} as const;
