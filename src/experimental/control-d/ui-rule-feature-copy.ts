import { BRAND_DISPLAY_NAME } from "@/shared/brand";
import type { UiLocale } from "@/shared/ui-locale";
import type { ProviderFeatureMessages } from "@/ui/components/provider-feature/provider-feature-copy";

const fill =
  (template: string) =>
  (value: string): string =>
    template.replaceAll("{value}", value);

const pair =
  (template: string) =>
  (first: string, second: string): string =>
    template.replaceAll("{first}", first).replaceAll("{second}", second);

const hint =
  (one: string, more: string): ProviderFeatureMessages["joinHint"] =>
  (pattern, extra) =>
    (extra > 0 ? more : one)
      .replaceAll("{pattern}", pattern)
      .replaceAll("{extra}", String(extra));

const sharedWith =
  (one: string, two: string, more: string): ProviderFeatureMessages["sharedWith"] =>
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
  saveWithRule: "Applies when you save this rule.",
  yes: "Yes",
  no: "No thanks",
  scope,
  joinQuestion: fill("Add this pattern to the existing {value} rule?"),
  joinHint: hint(
    "Uses the settings and identity of {pattern}.",
    "Uses the settings and identity of {pattern} and {extra} more.",
  ),
  joinReplaces:
    "This rule's Regional Preset, protection settings and identity will be replaced.",
  join: "Add to existing rule",
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
  joinQuestion: fill("¿Añadir este patrón a la regla existente de {value}?"),
  joinHint: hint(
    "Usa la configuración y la identidad de {pattern}.",
    "Usa la configuración y la identidad de {pattern} y {extra} más.",
  ),
  joinReplaces:
    "Se sustituirán el preset regional, los ajustes de protección y la identidad de esta regla.",
  join: "Añadir a la regla existente",
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
  joinQuestion: fill("Adicionar este padrão à regra existente de {value}?"),
  joinHint: hint(
    "Usa as configurações e a identidade de {pattern}.",
    "Usa as configurações e a identidade de {pattern} e mais {extra}.",
  ),
  joinReplaces:
    "O preset regional, as configurações de proteção e a identidade desta regra serão substituídos.",
  join: "Adicionar à regra existente",
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
  joinQuestion: fill("Добавить этот шаблон в существующее правило {value}?"),
  joinHint: hint(
    "Использует настройки и идентичность {pattern}.",
    "Использует настройки и идентичность {pattern} и ещё {extra}.",
  ),
  joinReplaces:
    "Региональный пресет, настройки защиты и идентичность этого правила будут заменены.",
  join: "Добавить в существующее правило",
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
  joinQuestion: fill("Додати цей шаблон до наявного правила {value}?"),
  joinHint: hint(
    "Використовує налаштування та ідентичність {pattern}.",
    "Використовує налаштування та ідентичність {pattern} і ще {extra}.",
  ),
  joinReplaces:
    "Регіональний пресет, налаштування захисту та ідентичність цього правила буде замінено.",
  join: "Додати до наявного правила",
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

const zhCN: ProviderFeatureMessages = {
  suggestQuestion: fill("要设置 {value} 服务吗？"),
  includeService: "包括服务",
  saveWithRule: "保存此规则时生效。",
  yes: "是",
  no: "不用了",
  scope: (provider, service) =>
    `${BRAND_DISPLAY_NAME} 仅保护与此规则匹配的域名。${provider} 的 ${service} 服务可能涵盖其他域名。`,
  joinQuestion: fill("要将此匹配模式添加到现有的 {value} 规则吗？"),
  joinHint: hint(
    "使用 {pattern} 的设置和身份。",
    "使用 {pattern} 及其他 {extra} 项的设置和身份。",
  ),
  joinReplaces: "此规则的区域预设、保护设置和身份将被替换。",
  join: "添加到现有规则",
  stagedLabel: fill("{value} · 未保存"),
  addService: "关联服务",
  change: "更改服务",
  removeService: "取消关联服务",
  dontUse: "不关联",
  back: "返回",
  checking: "正在检查…",
  checkingLabel: fill("正在查找 {value} 服务"),
  checkingStatus: "正在检查状态…",
  preparing: "正在准备…",
  pendingRemoval: fill("保存时将取消关联 {value}。规则会保留。"),
  pendingRemovalGroup: fill(
    "保存时，{value} 将与所有这些域名取消关联。规则及其域名会保留。",
  ),
  pickerLabel: fill("{value} 服务"),
  pickerPlaceholder: "选择服务",
  pickerSearch: "搜索服务",
  pickerEmpty: "没有匹配的服务",
  use: "关联",
  chipLabel: pair("{first}，{second}。显示选项"),
  menuHeader: pair("{first} · {second}"),
  sharedWith: sharedWith(
    "与 {a} 共享设置",
    "与 {a}、{b} 共享设置",
    "与 {a} 及其他 {extra} 项共享设置",
  ),
  errorBlocked: fill("建议已暂停。请选择服务，或检查 {value} 设置。"),
  errorConnect: fill("请连接 {value} 以关联服务。"),
  errorCatalogue: fill("暂时无法加载 {value} 服务。"),
  errorGeneric: "出了点问题。请重试。",
  errorSync: pair("{first} 无法应用 {second}。请查看 {first} 设置。"),
  errorJoinTaken: pair("{first} 已关联到 {second}。请开启该服务以共享其设置。"),
  errorPattern: "关联服务前，请先修正规则的匹配模式。",
  errorMissingService: "该服务已不可用。请选择其他服务。",
  errorGroupChanged: fill("使用 {value} 的域名已更改。请重新打开此规则并重试。"),
  errorGroupSettings: fill(
    "使用 {value} 的域名设置不同。请保存其中一个域名，以共享其设置。",
  ),
  errorGroupIdentity: fill("使用 {value} 的域名必须共享设置和身份。"),
};

const zhTW: ProviderFeatureMessages = {
  suggestQuestion: fill("要設定 {value} 服務嗎？"),
  includeService: "包含服務",
  saveWithRule: "儲存此規則時套用。",
  yes: "是",
  no: "不用了",
  scope: (provider, service) =>
    `${BRAND_DISPLAY_NAME} 只保護符合此規則的網域。${provider} 的 ${service} 服務可能涵蓋不同的網域。`,
  joinQuestion: fill("要將此比對模式加入現有的 {value} 規則嗎？"),
  joinHint: hint(
    "使用 {pattern} 的設定和身分。",
    "使用 {pattern} 及另外 {extra} 個項目的設定和身分。",
  ),
  joinReplaces: "此規則的地區預設集、保護設定和身分將被取代。",
  join: "加入現有規則",
  stagedLabel: fill("{value} · 未儲存"),
  addService: "連結服務",
  change: "變更服務",
  removeService: "取消連結服務",
  dontUse: "不要連結",
  back: "返回",
  checking: "正在檢查…",
  checkingLabel: fill("正在尋找 {value} 服務"),
  checkingStatus: "正在檢查狀態…",
  preparing: "正在準備…",
  pendingRemoval: fill("儲存時會取消連結 {value}。規則會保留。"),
  pendingRemovalGroup: fill(
    "儲存時會取消 {value} 與所有這些網域的連結。規則及其網域會保留。",
  ),
  pickerLabel: fill("{value} 服務"),
  pickerPlaceholder: "選擇服務",
  pickerSearch: "搜尋服務",
  pickerEmpty: "沒有相符的服務",
  use: "連結",
  chipLabel: pair("{first}，{second}。顯示選項"),
  menuHeader: pair("{first} · {second}"),
  sharedWith: sharedWith(
    "與 {a} 共用設定",
    "與 {a}、{b} 共用設定",
    "與 {a} 及其他 {extra} 個網域共用設定",
  ),
  errorBlocked: fill("建議已暫停。請選擇服務，或檢查 {value} 設定。"),
  errorConnect: fill("請連線 {value} 以連結服務。"),
  errorCatalogue: fill("目前無法載入 {value} 服務。"),
  errorGeneric: "發生錯誤。請再試一次。",
  errorSync: pair("{first} 無法套用 {second}。請查看 {first} 設定。"),
  errorJoinTaken: pair("{first} 已連結至 {second}。請開啟此服務以共用其設定。"),
  errorPattern: "請先修正規則的比對模式，再連結服務。",
  errorMissingService: "該服務已無法使用。請選擇其他服務。",
  errorGroupChanged: fill("使用 {value} 的網域已變更。請重新開啟此規則並再試一次。"),
  errorGroupSettings: fill(
    "使用 {value} 的網域設定不同。請儲存其中一個網域，以共用其設定。",
  ),
  errorGroupIdentity: fill("使用 {value} 的網域必須共用設定和身分。"),
};

export const controlDRuleFeatureCopy: Record<UiLocale, ProviderFeatureMessages> = {
  en,
  es,
  pt,
  ru,
  uk,
  "zh-CN": zhCN,
  "zh-TW": zhTW,
};
