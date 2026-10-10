import { BRAND_DISPLAY_NAME } from "@/shared/brand";
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

const fill =
  (template: string) =>
  (value: string): string =>
    template.replaceAll("{value}", value);

const pair =
  (template: string) =>
  (first: string, second: string): string =>
    template.replaceAll("{first}", first).replaceAll("{second}", second);

const hint =
  (one: string, more: string): JoinHint =>
  (pattern, extra) =>
    (extra > 0 ? more : one)
      .replaceAll("{pattern}", pattern)
      .replaceAll("{extra}", String(extra));

const sharedWith =
  (one: string, two: string, more: string): SharedWith =>
  (hosts) => {
    const first = hosts[0];
    if (!first) return "";
    if (hosts.length === 1) return one.replaceAll("{a}", first);
    const second = hosts[1];
    if (hosts.length === 2 && second) {
      return two.replaceAll("{a}", first).replaceAll("{b}", second);
    }
    return more
      .replaceAll("{a}", first)
      .replaceAll("{extra}", String(hosts.length - 1));
  };

const scope = (provider: string, service: string): string =>
  `${BRAND_DISPLAY_NAME} protects only domains matching this rule. ${provider}'s ${service} service may cover different domains.`;

const en: ProviderFeatureMessages = {
  suggestQuestion: fill("Setup {value} service?"),
  includeService: "Include service",
  saveWithRule: "Saved with this rule.",
  yes: "Yes",
  no: "No thanks",
  scope,
  joinQuestion: fill("Join {value}?"),
  joinHint: hint(
    "Uses the settings and identity of {pattern}.",
    "Uses the settings and identity of {pattern} and {extra} more.",
  ),
  joinReplaces: "This rule's current settings will be replaced.",
  join: "Join",
  stagedLabel: fill("{value} · unsaved"),
  addService: "Link a service",
  change: "Change service",
  removeService: "Unlink service",
  dontUse: "Don't link",
  back: "Back",
  checking: "Checking…",
  checkingLabel: fill("Looking for a {value} service"),
  checkingStatus: "Checking status…",
  preparing: "Getting ready…",
  pendingRemoval: fill("{value} is unlinked when you save. The rule stays."),
  pendingRemovalGroup: fill(
    "{value} is unlinked from all these domains when you save. The rule and its domains stay.",
  ),
  pickerLabel: fill("{value} service"),
  pickerPlaceholder: "Choose a service",
  pickerSearch: "Search services",
  pickerEmpty: "No matching services",
  use: "Link",
  chipLabel: pair("{first}, {second}. Show options"),
  menuHeader: pair("{first} · {second}"),
  sharedWith: sharedWith(
    "Shares settings with {a}",
    "Shares settings with {a} and {b}",
    "Shares settings with {a} and {extra} more",
  ),
  errorBlocked: fill(
    "Suggestions are paused. Pick a service, or check {value} settings.",
  ),
  errorConnect: fill("Connect {value} to link a service."),
  errorCatalogue: fill("{value} services couldn't load right now."),
  errorGeneric: "Something went wrong. Try again.",
  errorSync: pair("{first} couldn't apply {second}. See {first} settings."),
  errorJoinTaken: pair(
    "{first} is already linked to {second}. Turn on the service to share its settings.",
  ),
  errorPattern: "Fix the rule's pattern before linking a service.",
  errorMissingService: "That service is no longer available. Choose another.",
  errorGroupChanged: fill(
    "The domains using {value} changed. Reopen this rule and try again.",
  ),
  errorGroupSettings: fill(
    "Domains using {value} have different settings. Save one of them to share its settings.",
  ),
  errorGroupIdentity: fill("Domains using {value} must share settings and identity."),
};

const es: ProviderFeatureMessages = {
  suggestQuestion: fill("¿Configurar el servicio {value}?"),
  includeService: "Incluir servicio",
  saveWithRule: "Se aplica al guardar esta regla.",
  yes: "Sí",
  no: "No, gracias",
  scope: (provider, service) =>
    `${BRAND_DISPLAY_NAME} protege solo los dominios de esta regla. Un servicio de ${provider} para ${service} puede cubrir otros.`,
  joinQuestion: fill("¿Unirse a {value}?"),
  joinHint: hint(
    "Usa la configuración y la identidad de {pattern}.",
    "Usa la configuración y la identidad de {pattern} y {extra} más.",
  ),
  joinReplaces: "Se reemplazará la configuración actual de esta regla.",
  join: "Unirse",
  stagedLabel: fill("{value} · sin guardar"),
  addService: "Vincular un servicio",
  change: "Cambiar servicio",
  removeService: "Desvincular servicio",
  dontUse: "No vincular",
  back: "Volver",
  checking: "Comprobando…",
  checkingLabel: fill("Buscando un servicio de {value}"),
  checkingStatus: "Comprobando el estado…",
  preparing: "Preparando…",
  pendingRemoval: fill("{value} se desvincula al guardar. La regla se mantiene."),
  pendingRemovalGroup: fill(
    "{value} se desvincula de todos estos dominios al guardar. La regla y sus dominios se mantienen.",
  ),
  pickerLabel: fill("Servicio de {value}"),
  pickerPlaceholder: "Elige un servicio",
  pickerSearch: "Buscar servicios",
  pickerEmpty: "No hay servicios que coincidan",
  use: "Vincular",
  chipLabel: pair("{first}, {second}. Mostrar opciones"),
  menuHeader: pair("{first} · {second}"),
  sharedWith: sharedWith(
    "Comparte configuración con {a}",
    "Comparte configuración con {a} y {b}",
    "Comparte configuración con {a} y {extra} más",
  ),
  errorBlocked: fill(
    "Las sugerencias están en pausa. Elige un servicio o revisa los ajustes de {value}.",
  ),
  errorConnect: fill("Conecta {value} para vincular un servicio."),
  errorCatalogue: fill("No se pudieron cargar los servicios de {value}."),
  errorGeneric: "Algo salió mal. Inténtalo de nuevo.",
  errorSync: pair("{first} no pudo aplicar {second}. Revisa los ajustes de {first}."),
  errorJoinTaken: pair(
    "{first} ya está vinculado a {second}. Activa el servicio para compartir su configuración.",
  ),
  errorPattern: "Corrige el patrón de la regla antes de vincular un servicio.",
  errorMissingService: "Ese servicio ya no está disponible. Elige otro.",
  errorGroupChanged: fill(
    "Los dominios que usan {value} cambiaron. Vuelve a abrir esta regla e inténtalo de nuevo.",
  ),
  errorGroupSettings: fill(
    "Los dominios que usan {value} tienen configuraciones distintas. Guarda uno de ellos para compartir su configuración.",
  ),
  errorGroupIdentity: fill(
    "Los dominios que usan {value} deben compartir configuración e identidad.",
  ),
};

const pt: ProviderFeatureMessages = {
  suggestQuestion: fill("Configurar o serviço {value}?"),
  includeService: "Incluir serviço",
  saveWithRule: "Aplicado ao salvar esta regra.",
  yes: "Sim",
  no: "Agora não",
  scope: (provider, service) =>
    `O ${BRAND_DISPLAY_NAME} protege só os domínios desta regra. Um serviço do ${provider} para ${service} pode abranger outros.`,
  joinQuestion: fill("Entrar em {value}?"),
  joinHint: hint(
    "Usa as configurações e a identidade de {pattern}.",
    "Usa as configurações e a identidade de {pattern} e mais {extra}.",
  ),
  joinReplaces: "As configurações atuais desta regra serão substituídas.",
  join: "Entrar",
  stagedLabel: fill("{value} · não salvo"),
  addService: "Vincular um serviço",
  change: "Trocar serviço",
  removeService: "Desvincular serviço",
  dontUse: "Não vincular",
  back: "Voltar",
  checking: "Verificando…",
  checkingLabel: fill("Procurando um serviço de {value}"),
  checkingStatus: "Verificando o status…",
  preparing: "Preparando…",
  pendingRemoval: fill("{value} será desvinculado ao salvar. A regra continua."),
  pendingRemovalGroup: fill(
    "{value} será desvinculado de todos estes domínios ao salvar. A regra e seus domínios continuam.",
  ),
  pickerLabel: fill("Serviço de {value}"),
  pickerPlaceholder: "Escolha um serviço",
  pickerSearch: "Buscar serviços",
  pickerEmpty: "Nenhum serviço corresponde",
  use: "Vincular",
  chipLabel: pair("{first}, {second}. Mostrar opções"),
  menuHeader: pair("{first} · {second}"),
  sharedWith: sharedWith(
    "Compartilha configurações com {a}",
    "Compartilha configurações com {a} e {b}",
    "Compartilha configurações com {a} e mais {extra}",
  ),
  errorBlocked: fill(
    "As sugestões estão pausadas. Escolha um serviço ou confira as configurações do {value}.",
  ),
  errorConnect: fill("Conecte o {value} para vincular um serviço."),
  errorCatalogue: fill("Não foi possível carregar os serviços do {value}."),
  errorGeneric: "Algo deu errado. Tente novamente.",
  errorSync: pair(
    "O {first} não conseguiu aplicar {second}. Confira as configurações do {first}.",
  ),
  errorJoinTaken: pair(
    "{first} já está vinculado a {second}. Ative o serviço para compartilhar as configurações.",
  ),
  errorPattern: "Corrija o padrão da regra antes de vincular um serviço.",
  errorMissingService: "Esse serviço não está mais disponível. Escolha outro.",
  errorGroupChanged: fill(
    "Os domínios que usam {value} mudaram. Reabra esta regra e tente novamente.",
  ),
  errorGroupSettings: fill(
    "Os domínios que usam {value} têm configurações diferentes. Salve um deles para compartilhar as configurações.",
  ),
  errorGroupIdentity: fill(
    "Os domínios que usam {value} devem compartilhar configurações e identidade.",
  ),
};

const ru: ProviderFeatureMessages = {
  suggestQuestion: fill("Настроить сервис {value}?"),
  includeService: "Использовать сервис",
  saveWithRule: "Применится при сохранении правила.",
  yes: "Да",
  no: "Не нужно",
  scope: (provider, service) =>
    `${BRAND_DISPLAY_NAME} защищает только домены этого правила. Сервис ${provider} для ${service} может охватывать и другие.`,
  joinQuestion: fill("Присоединить к {value}?"),
  joinHint: hint(
    "Использует настройки и идентичность {pattern}.",
    "Использует настройки и идентичность {pattern} и ещё {extra}.",
  ),
  joinReplaces: "Текущие настройки этого правила будут заменены.",
  join: "Присоединить",
  stagedLabel: fill("{value} · не сохранено"),
  addService: "Связать с сервисом",
  change: "Сменить сервис",
  removeService: "Отвязать сервис",
  dontUse: "Не связывать",
  back: "Назад",
  checking: "Проверка…",
  checkingLabel: fill("Поиск сервиса {value}"),
  checkingStatus: "Проверка состояния…",
  preparing: "Подготовка…",
  pendingRemoval: fill("{value} будет отвязан при сохранении. Правило останется."),
  pendingRemovalGroup: fill(
    "{value} будет отвязан от всех этих доменов при сохранении. Правило и его домены останутся.",
  ),
  pickerLabel: fill("Сервис {value}"),
  pickerPlaceholder: "Выберите сервис",
  pickerSearch: "Поиск сервисов",
  pickerEmpty: "Нет подходящих сервисов",
  use: "Связать",
  chipLabel: pair("{first}, {second}. Показать действия"),
  menuHeader: pair("{first} · {second}"),
  sharedWith: sharedWith(
    "Общие настройки с {a}",
    "Общие настройки с {a} и {b}",
    "Общие настройки с {a} и ещё {extra}",
  ),
  errorBlocked: fill(
    "Подсказки приостановлены. Выберите сервис или проверьте настройки {value}.",
  ),
  errorConnect: fill("Подключите {value}, чтобы связать сервис."),
  errorCatalogue: fill("Не удалось загрузить сервисы {value}."),
  errorGeneric: "Что-то пошло не так. Попробуйте ещё раз.",
  errorSync: pair(
    "{first} не удалось применить {second}. Проверьте настройки {first}.",
  ),
  errorJoinTaken: pair(
    "{first} уже связан с {second}. Включите сервис, чтобы использовать общие настройки.",
  ),
  errorPattern: "Исправьте шаблон правила, прежде чем связывать сервис.",
  errorMissingService: "Этот сервис больше недоступен. Выберите другой.",
  errorGroupChanged: fill(
    "Домены, связанные с {value}, изменились. Откройте правило заново и повторите.",
  ),
  errorGroupSettings: fill(
    "У доменов, связанных с {value}, разные настройки. Сохраните один из них, чтобы настройки стали общими.",
  ),
  errorGroupIdentity: fill(
    "Домены, связанные с {value}, должны иметь общие настройки и идентичность.",
  ),
};

const uk: ProviderFeatureMessages = {
  suggestQuestion: fill("Налаштувати сервіс {value}?"),
  includeService: "Використовувати сервіс",
  saveWithRule: "Застосується після збереження правила.",
  yes: "Так",
  no: "Не треба",
  scope: (provider, service) =>
    `${BRAND_DISPLAY_NAME} захищає лише домени цього правила. Сервіс ${provider} для ${service} може охоплювати й інші.`,
  joinQuestion: fill("Приєднати до {value}?"),
  joinHint: hint(
    "Використовує налаштування та ідентичність {pattern}.",
    "Використовує налаштування та ідентичність {pattern} і ще {extra}.",
  ),
  joinReplaces: "Поточні налаштування цього правила буде замінено.",
  join: "Приєднати",
  stagedLabel: fill("{value} · не збережено"),
  addService: "Пов'язати із сервісом",
  change: "Змінити сервіс",
  removeService: "Відв'язати сервіс",
  dontUse: "Не пов'язувати",
  back: "Назад",
  checking: "Перевірка…",
  checkingLabel: fill("Пошук сервісу {value}"),
  checkingStatus: "Перевірка стану…",
  preparing: "Підготовка…",
  pendingRemoval: fill(
    "{value} буде відв'язано під час збереження. Правило залишиться.",
  ),
  pendingRemovalGroup: fill(
    "{value} буде відв'язано від усіх цих доменів під час збереження. Правило та його домени залишаться.",
  ),
  pickerLabel: fill("Сервіс {value}"),
  pickerPlaceholder: "Виберіть сервіс",
  pickerSearch: "Пошук сервісів",
  pickerEmpty: "Немає відповідних сервісів",
  use: "Пов'язати",
  chipLabel: pair("{first}, {second}. Показати дії"),
  menuHeader: pair("{first} · {second}"),
  sharedWith: sharedWith(
    "Спільні налаштування з {a}",
    "Спільні налаштування з {a} і {b}",
    "Спільні налаштування з {a} і ще {extra}",
  ),
  errorBlocked: fill(
    "Підказки призупинено. Виберіть сервіс або перевірте налаштування {value}.",
  ),
  errorConnect: fill("Підключіть {value}, щоб пов'язати сервіс."),
  errorCatalogue: fill("Не вдалося завантажити сервіси {value}."),
  errorGeneric: "Щось пішло не так. Спробуйте ще раз.",
  errorSync: pair(
    "{first} не вдалося застосувати {second}. Перевірте налаштування {first}.",
  ),
  errorJoinTaken: pair(
    "{first} уже пов'язано з {second}. Увімкніть сервіс, щоб використати спільні налаштування.",
  ),
  errorPattern: "Виправте шаблон правила, перш ніж пов'язувати сервіс.",
  errorMissingService: "Цей сервіс більше недоступний. Виберіть інший.",
  errorGroupChanged: fill(
    "Домени, пов'язані з {value}, змінилися. Відкрийте правило знову й повторіть.",
  ),
  errorGroupSettings: fill(
    "Домени, пов'язані з {value}, мають різні налаштування. Збережіть один із них, щоб налаштування стали спільними.",
  ),
  errorGroupIdentity: fill(
    "Домени, пов'язані з {value}, мають мати спільні налаштування та ідентичність.",
  ),
};

export const providerFeatureCopy: Record<UiLocale, ProviderFeatureMessages> = {
  en,
  es,
  pt,
  ru,
  uk,
};
