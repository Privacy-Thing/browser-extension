import { BRAND_DISPLAY_NAME } from "@/shared/brand";
import { slavicCount } from "@/ui/shared/slavic-plural";

const PRODUCT_NOT_LOWER = `чем ${BRAND_DISPLAY_NAME} не является`;

export const rules = {
  title: "Правила для доменов",
  hint: "Правила для доменов сопоставляют шаблоны хостов с региональными профилями.",
  addButton: "Добавить правило",
  filterLabel: "Фильтр правил",
  filterPlaceholder: "Поиск по профилям, доменам и предупреждениям",
  locationFilterLabel: "Фильтровать по профилю",
  locationFilterPlaceholder: "Все профили",
  assignLocationLabel: "Назначить профиль",
  tableHeadRule: "Правило",
  tableHeadProfile: "Профиль",
  tableHeadActions: "Действия",
  selectAllAriaLabel: "Выбрать все видимые правила",
  selectMenuAriaLabel: "Открыть меню выбора правил",
  selectRuleAriaLabel: (pattern: string) => `Выберите правило ${pattern}`,
  editRuleAriaLabel: (pattern: string) => `Изменить правило ${pattern}`,
  editRuleTitle: "Изменить правило",
  deleteRuleAriaLabel: (pattern: string) => `Удалить правило ${pattern}`,
  deleteRuleTitle: "Удалить правило",
  inactiveBadge: "неактивный",
  selectionMenuAllVisible: "Все видимые",
  selectionMenuAll: "Все",
  selectionMenuNone: "Нет",
  selectionMenuActive: "Только активные",
  selectionMenuInactive: "Только неактивные",
  noRulesFiltered: "Ни одно правило не соответствует текущему фильтру.",
  noRulesEmpty: `Правил для доменов пока нет. Добавьте правило, чтобы выбрать, как ${BRAND_DISPLAY_NAME} будет обрабатывать соответствующие сайты.`,
  copyLinkLabel: "правила для доменов",
  copyLinkHelpLabel: "справка по правилам домена",
  copyLinkInspectorLabel: "проверка имени хоста",
  copyLinkRuleAriaLabel: (pattern: string) => `Скопируйте ссылку на правило ${pattern}`,

  help: {
    title: "Правила для доменов",
    body1:
      "Используйте <code>example.com</code> для одного конкретного хоста. Используйте <code>*example.com</code> для этого хоста и любого поддомена, например <code>www.example.com</code>. Используйте <code>*.example.com</code> только для субдоменов.",
    body2: `Побеждает наиболее конкретный шаблон соответствия. Если два правила пересекаются и указывают на разные региональные профили, ${BRAND_DISPLAY_NAME} предупреждает об этом.`,
  },

  globalFallback: {
    title: "Правило по умолчанию",
    description: `Настройте защиту и при необходимости выберите региональный профиль, который ${BRAND_DISPLAY_NAME} использует, когда нет более конкретных правил.`,
    copyLinkLabel: "Правило по умолчанию",
    overridesBadge: (count: number) =>
      slavicCount(count, ["особая настройка", "особые настройки", "особых настроек"]),
    openInRules: "Изменить в правилах домена",
    editAriaLabel: "Изменить правило по умолчанию",
    editTitle: "Изменить правило по умолчанию",
    noPresetLabel: "Профиль не назначен",
    setupHint: "Профиль и особые настройки защиты пока не заданы.",
    tableHint: "Настройки для сайтов без более конкретного правила.",
    dialog: {
      title: "Правило по умолчанию",
      description:
        "Выберите защиту и необязательный профиль для сайтов, к которым не применяются более конкретные правила.",
      identityDescription:
        "У правила по умолчанию есть собственная постоянная цифровая идентичность для подмены. Её нельзя изменить вручную.",
      enabledLabel: "Включено",
      enabledHint:
        "Если отключено, это правило не применяется. Его настройки сохраняются.",
      enabledAriaLabel: "Переключить правило по умолчанию",
      locationProfileLabel: "Региональный профиль",
      locationProfileHint:
        "Выберите профиль для правила по умолчанию. Если профиль не назначен, будут действовать только настройки защиты ниже.",
      locationProfileWarningPrefix: `${BRAND_DISPLAY_NAME} не заменяет инструменты VPN, прокси-сервера или DNS. `,
      locationProfileWarningLinkLabel: `Узнайте, ${PRODUCT_NOT_LOWER}`,
      locationProfileWarningSuffix: ".",
      locationLabel: "Профиль",
      locationPlaceholder: "Выбрать профиль",
      submit: "Сохранить правило",
    },
  },

  inspector: {
    title: "Проверка хоста",
    hint: `Прежде чем сохранять изменения, проверьте, как ${BRAND_DISPLAY_NAME} обрабатывает имя хоста. Здесь видно, соответствует ли хост правилу домена или доверенному сайту, а также какой региональный профиль будет применяться.`,
    hostnameLabel: "Имя хоста",
    hostnameHint:
      "Используйте именно тот хост, который вы хотите проверить, например shop.example.com.",
    hostnamePlaceholder: "например shop.example.com",
    noMatchTitle:
      "Ни одно сохраненное правило для домена или доверенный сайт не соответствуют этому имени хоста.",
    noMatchDescription:
      "Ни одно сохраненное правило не применяется, а правило по умолчанию отключено или не настроено.",
    trustedSiteWinsTitle: "Этот хост отключён через доверенные сайты",
    trustedSiteWinsDescription: `Он соответствует вашему списку доверенных сайтов, поэтому ${BRAND_DISPLAY_NAME} не действует на этом сайте, пока вы не удалите или не отключите эту запись.`,
    trustedSiteOverridesRuleTitle:
      "Доверенные сайты имеют приоритет над правилом домена",
    trustedSiteOverridesRuleDescription: `Это имя хоста соответствует как доверенному сайту, так и правилу домена. Доверенные сайты имеют приоритет, поэтому ${BRAND_DISPLAY_NAME} остается выключенным, а приведенное ниже правило для домена игнорируется.`,
    fallbackWinsTitle: "Здесь применяется правило по умолчанию",
    fallbackWinsDescription: `Ни одно правило для домена или доверенный сайт не соответствовали этому имени хоста, поэтому ${BRAND_DISPLAY_NAME} здесь применит правило по умолчанию.`,
    ruleMatchTitle: (locationLabel: string) =>
      `${locationLabel} — активный профиль здесь.`,
    ruleMatchDescription: `Это имя хоста соответствует приведенному ниже правилу домена, поэтому ${BRAND_DISPLAY_NAME} будет использовать этот профиль на сайте.`,
    hostnameDetailLabel: "Имя хоста",
    trustedSiteDetailLabel: "Доверенный сайт",
    ruleDetailLabel: "Правило",
    defaultRuleDetailLabel: "Правило по умолчанию",
    ignoredRuleDetailLabel: "Игнорируемое правило",
    profileDetailLabel: "Региональный профиль",
    geolocationDetailLabel: "Геолокация",
    localeDetailLabel: "Локаль",
    timeZoneDetailLabel: "Часовой пояс",
    geolocationOn: "Вкл.",
    geolocationOff: "Выкл.",
  },

  dialog: {
    titleAdd: "Добавить правило",
    titleEdit: "Изменить правило",
    description:
      "Выберите хосты, на которых действует правило, а затем назначьте региональный профиль, особые настройки защиты или оба варианта.",
    patternLabel: "Шаблон",
    patternInfo:
      "Используйте <code>example.com</code> для одного конкретного хоста. Используйте <code>*example.com</code> для этого хоста и любого поддомена, например <code>www.example.com</code>. Используйте <code>*.example.com</code> только для субдоменов.",
    patternInfoAriaLabel: "Узнайте, как работают шаблоны правил",
    patternPlaceholder: "Введите шаблон домена",
    locationLabel: "Профиль",
    locationProfileLabel: "Региональный профиль",
    locationProfileHint: `Выберите региональный профиль для этого правила. Если ничего не назначено, ${BRAND_DISPLAY_NAME} использует следующий подходящий профиль, сохраняя при этом настройки защиты этого правила.`,
    bulkAssignSearchPlaceholder: "Поиск профилей...",
    enabledLabel: "Включено",
    enabledHint:
      "Если отключено, это правило не применяется. Его настройки сохраняются.",
    enabledAriaLabel: (pattern: string) => `Включить или отключить правило ${pattern}`,
    advancedModal: {
      trigger: "Дополнительно",
      title: (pattern: string) => `Расширенные настройки для ${pattern}`,
      description: "Изменения останутся в черновике, пока вы не сохраните правило.",
      confirm: "ОК",
      patternFallback: "это правило",
    },
    relaxCspLabel: "Ослабить CSP для защиты воркеров",
    relaxCspHint: `Удаляет заголовки Content Security Policy этого сайта, когда они мешают ${BRAND_DISPLAY_NAME} защищать воркеров.`,
    relaxCspRiskHint:
      "Предупреждение безопасности: это облегчает запуск вредоносных скриптов на сайте. Включайте его только для сайта, которому вы доверяете, и только в том случае, если в противном случае защита воркеров не сработает.",
    relaxCspAriaLabel: (pattern: string) =>
      `Переключить ослабление CSP для правила ${pattern}`,
    surfaceOverrides: {
      title: "Настройки защиты",
      description:
        "Выберите другие настройки защиты для этого правила. Оставьте настройку «Наследовать», чтобы следовать глобальной настройке.",
      stateOn: "Вкл.",
      stateInherit: "Наследовать",
      stateOff: "Выкл.",
      stateNative: "Без подмены",
      stateSpoof: "Подмена",
      stateStrict: "Строгий",
      stateBlock: "Блокировать",
      stateAllow: "Разрешить",
      helpAriaLabel: (label: string) => `Узнайте, чем управляет ${label}`,
      geolocation: {
        label: "Геолокация",
        info: "Управляет Geolocation API. Отключите подмену геолокации, если сайт должен получать настоящее местоположение, или включите её, чтобы правило подменяло ответы на запросы геолокации.",
      },
      timeLocale: {
        label: "Время и локаль",
        info: "Управляет Date, Intl, navigator.language, navigator.languages и языковыми заголовками, чтобы сайты видели регион из активного регионального профиля.",
      },
      canvas: {
        label: "Canvas",
        info: "Управляет результатом скрытого рисунка Canvas, по которому сайты могут распознавать браузер.",
      },
      webGL: {
        label: "WebGL",
        info: "Управляет графическими данными WebGL: рендерером, сведениями о GPU и другими признаками цифрового отпечатка.",
      },
      audio: {
        label: "Аудио",
        info: "Управляет измеряемым выводом AudioContext, который сайты используют для цифрового отпечатка.",
      },
      navigator: {
        label: "Navigator",
        info: "Управляет полями идентификации браузера, такими как платформа, подсказки об оборудовании и другие свойства навигатора.",
      },
      screen: {
        label: "Экран",
        info: "Управляет размером экрана, плотностью пикселей и соответствующими деталями дисплея.",
      },
      clientHints: {
        label: "Client Hints",
        info: "Управляет сведениями о браузере и устройстве, передаваемыми через заголовки и API Client Hints.",
      },
      battery: {
        label: "Аккумулятор",
        info: "Определяет, получает ли сайт данные о полностью заряженном аккумуляторе вместо сведений о фактическом состоянии аккумулятора устройства.",
      },
      webRTC: {
        label: "WebRTC",
        info: "Управляет защитой IP-адресов в WebRTC, которая может уменьшить утечки локальных и публичных адресов.",
      },
      serviceWorker: {
        label: "Service Workers",
        info: "Определяет, может ли этот сайт регистрировать Service Workers, которые могут работать в фоновом режиме и хранить долговременные данные. Блокировка может нарушить работу PWA, автономного режима, push-уведомлений и фоновой синхронизации; «Разрешить» позволяет браузеру регистрировать их как обычно; «Наследовать» использует глобальную настройку.",
      },
      sharedWorker: {
        label: "Dedicated и Shared Workers",
        info: "Задаёт режим Dedicated и Shared Workers для этого правила. «Без подмены» оставляет воркеры без защиты, «Подмена» пытается заменить значения, а «Строгий» блокирует воркер, если защиту нельзя подтвердить до запуска.",
      },
    },
    identity: {
      sectionTitle: "Цифровая идентичность",
      sectionDescription:
        "Это правило использует постоянную цифровую идентичность для подмены. Меняйте её только тогда, когда нужен новый цифровой отпечаток и чистое состояние связанных сайтов.",
      actionDescription:
        "Удаляет связанные данные сайтов и создаёт для правила новую цифровую идентичность.",
      actionLabel: "Новая идентичность",
      confirmTitle: (pattern: string) => `Создать новую идентичность для «${pattern}»?`,
      confirmDescription:
        "Это удалит файлы cookie, данные хранилищ, Service Workers и кеши сайтов, связанных с правилом. Затем будет создана новая цифровая идентичность.",
      confirmDomainsLabel: `${BRAND_DISPLAY_NAME} удалит данные браузера для этих доменов:`,
      confirmNoDomains: `Для этого правила пока нет сохранённых данных браузера. ${BRAND_DISPLAY_NAME} всё равно создаст новую цифровую идентичность.`,
      confirmLabel: "Создать новую идентичность",
      rotateSuccess: "Для правила создана новая идентичность.",
      rotateError: "Не удалось создать новую идентичность для правила.",
    },
    submitAdd: "Добавить правило",
    submitEdit: "Сохранить",
    duplicateAlertTitle: "Перезаписать существующее правило?",
    duplicateAlertDescription: (pattern: string) =>
      `Правило для «${pattern}» уже существует. Перезаписать его с этими настройками?`,
    duplicateAlertConfirm: "Перезаписать",
    duplicateAlertClose: "Нет",
    trustedSiteOverrideWarning: (pattern: string) =>
      `Этот домен соответствует записи доверенных сайтов «${pattern}». ${BRAND_DISPLAY_NAME} здесь останется выключенным независимо от этих настроек.`,
  },
} as const;
