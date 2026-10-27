import { BRAND_DISPLAY_NAME } from "@/shared/brand";

export const trustedSites = {
  title: "受信任的网站",
  hint: `在这些网站上，即使原本会应用某条规则、容器分配或默认规则，${BRAND_DISPLAY_NAME} 也会保持关闭。`,
  patternLabel: "域名匹配模式",
  patternPlaceholder: "输入域名匹配模式",
  filterLabel: "筛选受信任的网站",
  filterPlaceholder: "搜索域名",
  addButton: "添加网站",
  copyLinkLabel: "受信任的网站",
  copyLinkHelpLabel: "受信任的网站帮助",
  copyLinkInspectorLabel: "主机名检查工具",
  tableHeadPattern: "域名",
  tableHeadStatus: "状态",
  tableHeadActions: "操作",
  empty: "尚无受信任的网站。",
  filteredEmpty: "没有与当前筛选条件匹配的受信任的网站。",
  inactiveBadge: "未启用",
  toggleSiteAriaLabel: (pattern: string, enabled: boolean) =>
    `${enabled ? "停用" : "启用"}受信任的网站 ${pattern}`,
  deleteSiteAriaLabel: (pattern: string) => `删除受信任的网站 ${pattern}`,
  deleteSiteTitle: "删除受信任的网站",
  duplicateWarning: "该受信任的网站已存在。",
  patternRequired: "请输入域名匹配模式。",
  saved: "受信任的网站已保存。",
  updated: "受信任的网站已更新。",
  deleted: "受信任的网站已删除。",
  help: {
    title: "何时使用受信任的网站",
    body1:
      "对于伪装会造成妨碍的域名，请使用受信任的网站，例如会将浏览器变化视为可疑的银行、结账或账户找回流程。",
    body2: `受信任的网站优先于域名规则、Firefox 容器分配和默认规则。使用 <code>example.com</code> 匹配单个确切主机，使用 <code>*example.com</code> 匹配该主机及其子域名，使用 <code>*.example.com</code> 仅匹配子域名。`,
  },
  rulesCta: {
    title: "其他网站上的保护",
    activeRulesOnly: (count: number) =>
      `${count} 条已启用的域名规则在受信任的网站之外生效。打开域名规则可查看它们在哪里生效。`,
    activeRulesWithDefault: (count: number) =>
      `${count} 条已启用的域名规则在受信任的网站之外生效。默认规则还会覆盖其他未匹配的网站。`,
    defaultRuleOnly: `默认规则仍适用于未匹配的网站。受信任的网站仅在匹配的主机上停用 ${BRAND_DISPLAY_NAME}。`,
    openRules: "打开域名规则",
    openDefaultRule: "打开默认规则",
  },
  dialog: {
    title: "添加网站",
    description: `当某个网站在浏览器的正常状态下运行得更好时，让 ${BRAND_DISPLAY_NAME} 在匹配的页面上保持关闭。`,
    patternInfo:
      "使用 <code>example.com</code> 匹配单个确切主机。使用 <code>*example.com</code> 匹配该主机及其任意子域名，例如 <code>www.example.com</code>。使用 <code>*.example.com</code> 仅匹配子域名。",
    patternInfoAriaLabel: "了解受信任的网站匹配模式的工作方式",
    submit: "添加网站",
  },
} as const;
