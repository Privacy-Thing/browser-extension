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
  empty: string;
  repeated: (pattern: string) => string;
};

export const ruleGroupCopy: Record<UiLocale, RuleGroupMessages> = {
  en: {
    patterns: "Patterns in this rule",
    matchThisDomain: "Match this domain",
    additionalPatterns: "Additional patterns",
    hint: "All patterns share the same settings and identity.",
    addPattern: "Add pattern",
    removePattern: "Remove pattern",
    patternLabel: (index) => `Pattern ${index}`,
    duplicate: (pattern) => `${pattern} already belongs to another rule.`,
    empty: "Complete or remove the empty pattern before saving.",
    repeated: (pattern) => `${pattern} is listed more than once. Keep one entry.`,
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
    empty: "Completa o elimina el patrón vacío antes de guardar.",
    repeated: (pattern) => `${pattern} aparece más de una vez. Deja una sola entrada.`,
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
    empty: "Preencha ou remova o padrão vazio antes de salvar.",
    repeated: (pattern) => `${pattern} aparece mais de uma vez. Mantenha uma entrada.`,
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
    empty: "Заполните или удалите пустой шаблон перед сохранением.",
    repeated: (pattern) => `${pattern} указан несколько раз. Оставьте одну запись.`,
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
    empty: "Заповніть або видаліть порожній шаблон перед збереженням.",
    repeated: (pattern) => `${pattern} зазначено кілька разів. Залиште один запис.`,
  },
  "zh-CN": {
    patterns: "此规则中的匹配模式",
    matchThisDomain: "匹配此域名",
    additionalPatterns: "其他匹配模式",
    hint: "所有匹配模式共享相同的设置和身份。",
    addPattern: "添加匹配模式",
    removePattern: "移除匹配模式",
    patternLabel: (index) => `匹配模式 ${index}`,
    duplicate: (pattern) => `${pattern} 已属于另一条规则。`,
    empty: "保存前，请填写或移除空的匹配模式。",
    repeated: (pattern) => `${pattern} 出现了多次。请只保留一项。`,
  },
  "zh-TW": {
    patterns: "此規則中的比對模式",
    matchThisDomain: "比對此網域",
    additionalPatterns: "其他比對模式",
    hint: "所有比對模式共用相同的設定和身分。",
    addPattern: "新增比對模式",
    removePattern: "移除比對模式",
    patternLabel: (index) => `比對模式 ${index}`,
    duplicate: (pattern) => `${pattern} 已屬於另一條規則。`,
    empty: "儲存前，請填寫或移除空白的比對模式。",
    repeated: (pattern) => `${pattern} 列出了不只一次。請只保留一項。`,
  },
};
