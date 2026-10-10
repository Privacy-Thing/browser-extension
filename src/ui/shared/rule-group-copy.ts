import type { UiLocale } from "@/shared/ui-locale";

type RuleGroupMessages = {
  patterns: string;
  matchThisDomain: string;
  additionalPatterns: string;
  hint: string;
  addPattern: string;
  removePattern: string;
  patternLabel: (index: number) => string;
  duplicate: (pattern: string) => string;
};

export const ruleGroupCopy: Record<UiLocale, RuleGroupMessages> = {
  en: {
    patterns: "Patterns in this rule",
    matchThisDomain: "Match this domain",
    additionalPatterns: "Additional patterns",
    hint: "All patterns use the same settings and identity.",
    addPattern: "Add pattern",
    removePattern: "Remove pattern",
    patternLabel: (index) => `Pattern ${index}`,
    duplicate: (pattern) => `${pattern} already belongs to another rule.`,
  },
  es: {
    patterns: "Patrones de esta regla",
    matchThisDomain: "Coincidencia para este dominio",
    additionalPatterns: "Patrones adicionales",
    hint: "Todos los patrones usan la misma configuración e identidad.",
    addPattern: "Añadir patrón",
    removePattern: "Quitar patrón",
    patternLabel: (index) => `Patrón ${index}`,
    duplicate: (pattern) => `${pattern} ya pertenece a otra regla.`,
  },
  pt: {
    patterns: "Padrões desta regra",
    matchThisDomain: "Correspondência deste domínio",
    additionalPatterns: "Padrões adicionais",
    hint: "Todos os padrões usam as mesmas configurações e identidade.",
    addPattern: "Adicionar padrão",
    removePattern: "Remover padrão",
    patternLabel: (index) => `Padrão ${index}`,
    duplicate: (pattern) => `${pattern} já pertence a outra regra.`,
  },
  ru: {
    patterns: "Шаблоны этого правила",
    matchThisDomain: "Сопоставление этого домена",
    additionalPatterns: "Дополнительные шаблоны",
    hint: "Все шаблоны используют общие настройки и идентичность.",
    addPattern: "Добавить шаблон",
    removePattern: "Удалить шаблон",
    patternLabel: (index) => `Шаблон ${index}`,
    duplicate: (pattern) => `${pattern} уже относится к другому правилу.`,
  },
  uk: {
    patterns: "Шаблони цього правила",
    matchThisDomain: "Відповідність цього домену",
    additionalPatterns: "Додаткові шаблони",
    hint: "Усі шаблони використовують спільні налаштування й ідентичність.",
    addPattern: "Додати шаблон",
    removePattern: "Видалити шаблон",
    patternLabel: (index) => `Шаблон ${index}`,
    duplicate: (pattern) => `${pattern} вже належить до іншого правила.`,
  },
};
