import { BRAND_DISPLAY_NAME } from "@/shared/brand";

export const trustedSites = {
  title: "受信任的網站",
  hint: `即使規則、容器指派或預設規則原本會套用，${BRAND_DISPLAY_NAME} 仍會在這些網站上保持關閉。`,
  patternLabel: "網域比對模式",
  patternPlaceholder: "輸入網域比對模式",
  filterLabel: "篩選受信任的網站",
  filterPlaceholder: "搜尋網域",
  addButton: "新增網站",
  copyLinkLabel: "受信任的網站",
  copyLinkHelpLabel: "受信任的網站說明",
  copyLinkInspectorLabel: "主機名稱檢查工具",
  tableHeadPattern: "網域",
  tableHeadStatus: "狀態",
  tableHeadActions: "動作",
  empty: "尚無「受信任的網站」。",
  filteredEmpty: "沒有「受信任的網站」符合目前的篩選條件。",
  inactiveBadge: "未啟用",
  toggleSiteAriaLabel: (pattern: string, enabled: boolean) =>
    `${enabled ? "停用" : "啟用"}受信任的網站 ${pattern}`,
  deleteSiteAriaLabel: (pattern: string) => `刪除受信任的網站 ${pattern}`,
  deleteSiteTitle: "刪除受信任的網站",
  duplicateWarning: "該「受信任的網站」已存在。",
  patternRequired: "請輸入網域比對模式。",
  saved: "已儲存「受信任的網站」。",
  updated: "已更新「受信任的網站」。",
  deleted: "已刪除「受信任的網站」。",
  help: {
    title: "何時使用受信任的網站",
    body1:
      "如果偽裝會造成妨礙，例如網路銀行、結帳或帳戶復原流程會將瀏覽器變更視為可疑，請對這些網域使用「受信任的網站」。",
    body2: `「受信任的網站」會覆寫網域規則、Firefox 容器指派和預設規則。使用 <code>example.com</code> 比對單一完全相符的主機，<code>*example.com</code> 比對該主機及其子網域，<code>*.example.com</code> 則只比對子網域。`,
  },
  rulesCta: {
    title: "其他網站的保護",
    activeRulesOnly: (count: number) =>
      `「受信任的網站」以外有 ${count} 條已啟用的網域規則適用。開啟網域規則以查看其生效範圍。`,
    activeRulesWithDefault: (count: number) =>
      `「受信任的網站」以外有 ${count} 條已啟用的網域規則適用。預設規則也涵蓋其他不相符的網站。`,
    defaultRuleOnly: `預設規則仍會套用至不相符的網站。「受信任的網站」只會在相符的主機上停用 ${BRAND_DISPLAY_NAME}。`,
    openRules: "開啟網域規則",
    openDefaultRule: "開啟預設規則",
  },
  dialog: {
    title: "新增網站",
    description: `當網站在一般瀏覽器狀態下運作得更好時，讓 ${BRAND_DISPLAY_NAME} 在相符的頁面上保持關閉。`,
    patternInfo:
      "使用 <code>example.com</code> 比對單一完全相符的主機。使用 <code>*example.com</code> 比對該主機及其任何子網域，例如 <code>www.example.com</code>。使用 <code>*.example.com</code> 則只比對子網域。",
    patternInfoAriaLabel: "了解受信任的網站比對模式的運作方式",
    submit: "新增網站",
  },
} as const;
