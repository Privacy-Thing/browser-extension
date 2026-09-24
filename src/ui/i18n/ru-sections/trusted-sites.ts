import { BRAND_DISPLAY_NAME } from "@/shared/brand";
import { slavicCount } from "@/ui/shared/slavic-plural";

export const trustedSites = {
  title: "Доверенные сайты",
  hint: `Сайты, на которых ${BRAND_DISPLAY_NAME} остается выключенным, даже если в противном случае применяется правило, назначение контейнера или правило по умолчанию.`,
  patternLabel: "Шаблон домена",
  patternPlaceholder: "Введите шаблон домена",
  filterLabel: "Фильтровать доверенные сайты",
  filterPlaceholder: "Поиск домена",
  addButton: "Добавить сайт",
  copyLinkLabel: "доверенные сайты",
  copyLinkHelpLabel: "справка по доверенным сайтам",
  copyLinkInspectorLabel: "инспектор имен хостов",
  tableHeadPattern: "Домен",
  tableHeadStatus: "Статус",
  tableHeadActions: "Действия",
  empty: "Доверенных сайтов пока нет.",
  filteredEmpty: "Ни один доверенный сайт не соответствует текущему фильтру.",
  inactiveBadge: "неактивный",
  toggleSiteAriaLabel: (pattern: string, enabled: boolean) =>
    `${enabled ? "Отключить" : "Включить"} доверенный сайт ${pattern}`,
  deleteSiteAriaLabel: (pattern: string) => `Удалить доверенный сайт ${pattern}`,
  deleteSiteTitle: "Удалить доверенный сайт",
  duplicateWarning: "Этот доверенный сайт уже существует.",
  patternRequired: "Введите шаблон домена.",
  saved: "Доверенный сайт сохранен.",
  updated: "Доверенный сайт обновлен.",
  deleted: "Доверенный сайт удален.",
  help: {
    title: "Когда использовать доверенные сайты",
    body1:
      "Используйте доверенные сайты для доменов, которым мешает подмена, например банковские операции, оформление покупок или восстановление учётной записи, где изменение данных браузера может вызвать подозрение.",
    body2: `Доверенные сайты переопределяют правила домена, назначения контейнеров Firefox и правило по умолчанию. Используйте <code>example.com</code> для одного хоста, <code>*example.com</code> для этого хоста и его субдоменов или <code>*.example.com</code> только для субдоменов.`,
  },
  rulesCta: {
    title: "Защита на других сайтах",
    activeRulesOnly: (count: number) =>
      `За пределами доверенных сайтов: ${slavicCount(count, ["активное правило", "активных правила", "активных правил"])}. Откройте правила для доменов, чтобы проверить, где они применяются.`,
    activeRulesWithDefault: (count: number) =>
      `За пределами доверенных сайтов: ${slavicCount(count, ["активное правило", "активных правила", "активных правил"])}. Правило по умолчанию также охватывает остальные сайты без совпадений.`,
    defaultRuleOnly: `Правило по умолчанию по-прежнему применяется к несовпадающим сайтам. Доверенные сайты отключают ${BRAND_DISPLAY_NAME} только на соответствующих хостах.`,
    openRules: "Открыть правила для доменов",
    openDefaultRule: "Открыть правило по умолчанию",
  },
  dialog: {
    title: "Добавить сайт",
    description: `Отключите ${BRAND_DISPLAY_NAME} на подходящих сайтах, если подмена мешает их работе.`,
    patternInfo:
      "Используйте <code>example.com</code> для одного конкретного хоста. Используйте <code>*example.com</code> для этого хоста и любого поддомена, например <code>www.example.com</code>. Используйте <code>*.example.com</code> только для субдоменов.",
    patternInfoAriaLabel: "Узнайте, как работают шаблоны доверенных сайтов",
    submit: "Добавить сайт",
  },
} as const;
