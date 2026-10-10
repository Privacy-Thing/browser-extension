import type { UiLocale } from "@/shared/ui-locale";

type RuleGroupMessages = {
  sites: string;
  matchThisSite: string;
  additionalSites: string;
  hint: string;
  addSite: string;
  removeSite: string;
  siteLabel: (index: number) => string;
  duplicate: (pattern: string) => string;
};

export const ruleGroupCopy: Record<UiLocale, RuleGroupMessages> = {
  en: {
    sites: "Sites in this rule",
    matchThisSite: "Match this site",
    additionalSites: "Additional sites",
    hint: "All sites use the same settings and identity.",
    addSite: "Add site",
    removeSite: "Remove site",
    siteLabel: (index) => `Site ${index}`,
    duplicate: (pattern) => `${pattern} already belongs to another rule.`,
  },
  es: {
    sites: "Sitios de esta regla",
    matchThisSite: "Coincidencia para este sitio",
    additionalSites: "Otros sitios",
    hint: "Todos los sitios usan la misma configuración e identidad.",
    addSite: "Añadir sitio",
    removeSite: "Quitar sitio",
    siteLabel: (index) => `Sitio ${index}`,
    duplicate: (pattern) => `${pattern} ya pertenece a otra regla.`,
  },
  pt: {
    sites: "Sites desta regra",
    matchThisSite: "Correspondência deste site",
    additionalSites: "Outros sites",
    hint: "Todos os sites usam as mesmas configurações e identidade.",
    addSite: "Adicionar site",
    removeSite: "Remover site",
    siteLabel: (index) => `Site ${index}`,
    duplicate: (pattern) => `${pattern} já pertence a outra regra.`,
  },
  ru: {
    sites: "Сайты этого правила",
    matchThisSite: "Сопоставление этого сайта",
    additionalSites: "Другие сайты",
    hint: "Все сайты используют общие настройки и идентичность.",
    addSite: "Добавить сайт",
    removeSite: "Удалить сайт",
    siteLabel: (index) => `Сайт ${index}`,
    duplicate: (pattern) => `${pattern} уже относится к другому правилу.`,
  },
  uk: {
    sites: "Сайти цього правила",
    matchThisSite: "Відповідність цього сайту",
    additionalSites: "Інші сайти",
    hint: "Усі сайти використовують спільні налаштування й ідентичність.",
    addSite: "Додати сайт",
    removeSite: "Видалити сайт",
    siteLabel: (index) => `Сайт ${index}`,
    duplicate: (pattern) => `${pattern} вже належить до іншого правила.`,
  },
};
