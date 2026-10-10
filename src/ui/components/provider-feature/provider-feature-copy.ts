import type { UiLocale } from "@/shared/ui-locale";

type Text = (value: string) => string;
type PairText = (first: string, second: string) => string;
type JoinHint = (pattern: string, extra: number) => string;
type SharedWith = (hosts: readonly string[]) => string;

export type ProviderFeatureMessages = {
  suggestQuestion: Text;
  yes: string;
  includeService: string;
  saveWithRule: string;
  no: string;
  scope: PairText;
  joinQuestion: Text;
  joinHint: JoinHint;
  joinReplaces: string;
  join: string;
  stagedLabel: Text;
  addService: string;
  change: string;
  removeService: string;
  dontUse: string;
  back: string;
  checking: string;
  checkingLabel: Text;
  checkingStatus: string;
  preparing: string;
  pendingRemoval: Text;
  pendingRemovalGroup: Text;
  pickerLabel: Text;
  pickerPlaceholder: string;
  pickerSearch: string;
  pickerEmpty: string;
  use: string;
  chipLabel: PairText;
  menuHeader: PairText;
  sharedWith: SharedWith;
  errorBlocked: Text;
  errorConnect: Text;
  errorCatalogue: Text;
  errorGeneric: string;
  errorSync: PairText;
  errorJoinTaken: PairText;
  errorPattern: string;
  errorMissingService: string;
  errorGroupChanged: Text;
  errorGroupSettings: Text;
  errorGroupIdentity: Text;
};

export const featurePendingCopy: Record<
  UiLocale,
  Pick<
    ProviderFeatureMessages,
    "checking" | "checkingLabel" | "checkingStatus" | "preparing"
  >
> = {
  en: {
    checking: "Checking…",
    checkingLabel: (value) => `Checking ${value}`,
    checkingStatus: "Checking status…",
    preparing: "Getting ready…",
  },
  es: {
    checking: "Comprobando…",
    checkingLabel: (value) => `Comprobando ${value}`,
    checkingStatus: "Comprobando el estado…",
    preparing: "Preparando…",
  },
  pt: {
    checking: "Verificando…",
    checkingLabel: (value) => `Verificando ${value}`,
    checkingStatus: "Verificando status…",
    preparing: "Preparando…",
  },
  ru: {
    checking: "Проверка…",
    checkingLabel: (value) => `Проверка ${value}`,
    checkingStatus: "Проверка состояния…",
    preparing: "Подготовка…",
  },
  uk: {
    checking: "Перевірка…",
    checkingLabel: (value) => `Перевірка ${value}`,
    checkingStatus: "Перевірка стану…",
    preparing: "Підготовка…",
  },
};
