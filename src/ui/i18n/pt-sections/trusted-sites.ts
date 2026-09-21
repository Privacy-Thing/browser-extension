import { BRAND_DISPLAY_NAME } from "@/shared/brand";

export const trustedSites = {
  title: "Sites Confiáveis",
  hint: `Sites onde ${BRAND_DISPLAY_NAME} permanece desativado mesmo quando uma regra, atribuição de contêiner ou a Regra Padrão normalmente se aplicaria.`,
  patternLabel: "Padrão de domínio",
  patternPlaceholder: "Insira um padrão de domínio",
  filterLabel: "Filtrar sites confiáveis",
  filterPlaceholder: "Pesquisar domínio",
  addButton: "Adicionar site",
  copyLinkLabel: "sites confiáveis",
  copyLinkHelpLabel: "ajuda de sites confiáveis",
  copyLinkInspectorLabel: "inspetor de hostname",
  tableHeadPattern: "Domínio",
  tableHeadStatus: "Status",
  tableHeadActions: "Ações",
  empty: "Ainda não há sites confiáveis.",
  filteredEmpty: "Nenhum site confiável corresponde ao filtro atual.",
  inactiveBadge: "inativo",
  toggleSiteAriaLabel: (pattern: string, enabled: boolean) =>
    `${enabled ? "Desativar" : "Ativar"} o site confiável ${pattern}`,
  deleteSiteAriaLabel: (pattern: string) => `Excluir site confiável ${pattern}`,
  deleteSiteTitle: "Excluir site confiável",
  duplicateWarning: "Esse site confiável já existe.",
  patternRequired: "Digite um padrão de domínio.",
  saved: "Site confiável salvo.",
  updated: "Site confiável atualizado.",
  deleted: "Site confiável excluído.",
  help: {
    title: "Quando usar Sites Confiáveis",
    body1:
      "Use Sites Confiáveis para domínios onde simulação atrapalha, como fluxos de banco, checkout ou recuperação de conta que tratam mudanças no navegador como suspeitas.",
    body2: `Sites Confiáveis substituem Regras de Domínio, atribuições de contêiner do Firefox e a Regra Padrão. Use <code>example.com</code> para um host exato, <code>*example.com</code> para esse host mais seus subdomínios, ou <code>*.example.com</code> apenas para subdomínios.`,
  },
  rulesCta: {
    title: "Proteção em outros sites",
    activeRulesOnly: (count: number) =>
      `${count} ${count === 1 ? "Regra de Domínio ativa se aplica" : "Regras de Domínio ativas se aplicam"} fora dos Sites Confiáveis. Abra Regras de Domínio para revisar onde ${count === 1 ? "ela está ativa" : "elas estão ativas"}.`,
    activeRulesWithDefault: (count: number) =>
      `${count} ${count === 1 ? "Regra de Domínio ativa se aplica" : "Regras de Domínio ativas se aplicam"} fora dos Sites Confiáveis. A Regra Padrão também cobre outros sites sem correspondência.`,
    defaultRuleOnly: `A Regra Padrão ainda se aplica a sites não correspondentes. Sites Confiáveis desativam ${BRAND_DISPLAY_NAME} apenas em hosts correspondentes.`,
    openRules: "Abrir Regras de Domínio",
    openDefaultRule: "Abrir Regra Padrão",
  },
  dialog: {
    title: "Adicionar site",
    description: `Mantenha ${BRAND_DISPLAY_NAME} desativado em páginas correspondentes quando um site funcionar melhor com o estado normal do seu navegador.`,
    patternInfo:
      "Use <code>example.com</code> para um host exato. Use <code>*example.com</code> para esse host e qualquer subdomínio, como <code>www.example.com</code>. Use <code>*.example.com</code> apenas para subdomínios.",
    patternInfoAriaLabel: "Saiba como funcionam os padrões de sites confiáveis",
    submit: "Adicionar site",
  },
} as const;
