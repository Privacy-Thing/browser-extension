import { BRAND_DISPLAY_NAME } from "@/shared/brand";
import { slavicCount } from "@/ui/shared/slavic-plural";

export const trustedSites = {
  title: "Довірені сайти",
  hint: `Сайти, де ${BRAND_DISPLAY_NAME} залишається вимкненим, навіть якщо правило, призначення контейнера або правило за замовчуванням застосовуються інакше.`,
  patternLabel: "Шаблон домену",
  patternPlaceholder: "Введіть шаблон домену",
  filterLabel: "Фільтрувати довірені сайти",
  filterPlaceholder: "Пошук домену",
  addButton: "Додати сайт",
  copyLinkLabel: "довірені сайти",
  copyLinkHelpLabel: "довідка про довірені сайти",
  copyLinkInspectorLabel: "інспектор імен хостів",
  tableHeadPattern: "Домен",
  tableHeadStatus: "Статус",
  tableHeadActions: "Дії",
  empty: "Ще немає довірених сайтів.",
  filteredEmpty: "Жоден довірений сайт не відповідає поточному фільтру.",
  inactiveBadge: "неактивний",
  toggleSiteAriaLabel: (pattern: string, enabled: boolean) =>
    `${enabled ? "Вимкнути" : "Увімкнути"} довірений сайт ${pattern}`,
  deleteSiteAriaLabel: (pattern: string) => `Видалити довірений сайт ${pattern}`,
  deleteSiteTitle: "Видалити довірений сайт",
  duplicateWarning: "Цей довірений сайт уже існує.",
  patternRequired: "Введіть шаблон домену.",
  saved: "Довірений сайт збережено.",
  updated: "Довірений сайт оновлено.",
  deleted: "Довірений сайт видалено.",
  help: {
    title: "Коли використовувати довірені сайти",
    body1:
      "Використовуйте довірені сайти для доменів, де підміна заважає, як-от банківські послуги, оформлення покупок або відновлення облікового запису, де зміна даних браузера може викликати підозру.",
    body2: `Довірені сайти мають пріоритет над правилами для доменів, призначеннями контейнерів Firefox і правилом за замовчуванням. Використовуйте <code>example.com</code> для одного конкретного хоста, <code>*example.com</code> для цього хоста та його субдоменів або <code>*.example.com</code> лише для субдоменів.`,
  },
  rulesCta: {
    title: "Захист на інших сайтах",
    activeRulesOnly: (count: number) =>
      `Поза довіреними сайтами: ${slavicCount(count, ["активне правило", "активні правила", "активних правил"])}. Відкрийте правила для доменів, щоб перевірити, де вони застосовуються.`,
    activeRulesWithDefault: (count: number) =>
      `Поза довіреними сайтами: ${slavicCount(count, ["активне правило", "активні правила", "активних правил"])}. Правило за замовчуванням також охоплює решту сайтів без збігів.`,
    defaultRuleOnly: `Правило за замовчуванням все ще застосовується до сайтів без відповідного правила. Довірені сайти вимикають ${BRAND_DISPLAY_NAME} лише на відповідних хостах.`,
    openRules: "Відкрити правила для доменів",
    openDefaultRule: "Відкрити правило за замовчуванням",
  },
  dialog: {
    title: "Додати сайт",
    description: `Вимкніть ${BRAND_DISPLAY_NAME} на відповідних сайтах, якщо підміна заважає їхній роботі.`,
    patternInfo:
      "Використовуйте <code>example.com</code> для одного точного хоста. Використовуйте <code>*example.com</code> для цього хоста та будь-якого субдомену, наприклад <code>www.example.com</code>. Використовуйте <code>*.example.com</code> лише для субдоменів.",
    patternInfoAriaLabel: "Дізнайтеся, як працюють шаблони довірених сайтів",
    submit: "Додати сайт",
  },
} as const;
