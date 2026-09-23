import { BRAND_DISPLAY_NAME } from "@/shared/brand";
import { slavicCount } from "@/ui/shared/slavic-plural";

const PRODUCT_NOT_LOWER = `чим не є ${BRAND_DISPLAY_NAME}`;

export const rules = {
  title: "Правила для доменів",
  hint: "Правила для доменів зіставляють шаблони хостів із регіональними профілями.",
  addButton: "Додати правило",
  filterLabel: "Фільтр правил",
  filterPlaceholder: "Пошук за профілями, доменами й попередженнями",
  locationFilterLabel: "Фільтр за профілем",
  locationFilterPlaceholder: "Усі профілі",
  assignLocationLabel: "Призначити профіль",
  tableHeadRule: "Правило",
  tableHeadProfile: "Профіль",
  tableHeadActions: "Дії",
  selectAllAriaLabel: "Виберіть усі видимі правила",
  selectMenuAriaLabel: "Відкрити меню вибору правил",
  selectRuleAriaLabel: (pattern: string) => `Виберіть правило ${pattern}`,
  editRuleAriaLabel: (pattern: string) => `Редагувати правило ${pattern}`,
  editRuleTitle: "Редагувати правило",
  deleteRuleAriaLabel: (pattern: string) => `Видалити правило ${pattern}`,
  deleteRuleTitle: "Видалити правило",
  inactiveBadge: "неактивний",
  selectionMenuAllVisible: "Усі видимі",
  selectionMenuAll: "Усі",
  selectionMenuNone: "Жодного",
  selectionMenuActive: "Лише активні",
  selectionMenuInactive: "Лише неактивні",
  noRulesFiltered: "Жодне правило не відповідає поточному фільтру.",
  noRulesEmpty: `Правил для доменів ще немає. Додайте правило, щоб вибрати, як ${BRAND_DISPLAY_NAME} обробляє відповідні сайти.`,
  copyLinkLabel: "правила для доменів",
  copyLinkHelpLabel: "довідка про правила для доменів",
  copyLinkInspectorLabel: "інспектор імен хостів",
  copyLinkRuleAriaLabel: (pattern: string) =>
    `Скопіюйте посилання на правило ${pattern}`,

  help: {
    title: "Правила для доменів",
    body1:
      "Використовуйте <code>example.com</code> для одного точного хоста. Використовуйте <code>*example.com</code> для цього хоста та будь-якого субдомену, наприклад <code>www.example.com</code>. Використовуйте <code>*.example.com</code> лише для субдоменів.",
    body2: `Перевагу має найточніший відповідний шаблон. Якщо два правила збігаються та вказують на різні регіональні профілі, ${BRAND_DISPLAY_NAME} попереджає про це.`,
  },

  globalFallback: {
    title: "Правило за замовчуванням",
    description: `Налаштуйте захист і за потреби виберіть регіональний профіль, які ${BRAND_DISPLAY_NAME} використовуватиме за відсутності конкретнішого правила.`,
    copyLinkLabel: "Правило за замовчуванням",
    overridesBadge: (count: number) =>
      slavicCount(count, [
        "особливе налаштування",
        "особливі налаштування",
        "особливих налаштувань",
      ]),
    openInRules: "Редагувати в правилах домену",
    editAriaLabel: "Редагувати правило за замовчуванням",
    editTitle: "Редагувати правило за замовчуванням",
    noPresetLabel: "Профіль не призначено",
    setupHint: "Профіль і особливі налаштування захисту ще не задано.",
    tableHint: "Налаштування за замовчуванням, якщо немає нічого більш конкретного.",
    dialog: {
      title: "Правило за замовчуванням",
      description:
        "Виберіть захист і необов’язковий профіль для сайтів без конкретнішого правила.",
      identityDescription:
        "Правило за замовчуванням зберігає власну сталу цифрову ідентичність для підміни. Її не можна змінити вручну.",
      enabledLabel: "Увімкнено",
      enabledHint:
        "Якщо вимкнено, це правило не застосовується. Його налаштування залишаються збереженими.",
      enabledAriaLabel: "Перемкніть правило за замовчуванням",
      locationProfileLabel: "Регіональний профіль",
      locationProfileHint:
        "Виберіть профіль, який має використовувати правило за замовчуванням. Залиште його непризначеним, щоб використовувати лише наведені нижче налаштування захисту.",
      locationProfileWarningPrefix: `${BRAND_DISPLAY_NAME} не замінює інструменти VPN, проксі чи DNS. `,
      locationProfileWarningLinkLabel: `Дізнайтеся, ${PRODUCT_NOT_LOWER}`,
      locationProfileWarningSuffix: ".",
      locationLabel: "Профіль",
      locationPlaceholder: "Вибрати профіль",
      submit: "Зберегти правило",
    },
  },

  inspector: {
    title: "Перевірка хоста",
    hint: `Перш ніж зберегти зміни, перевірте, як ${BRAND_DISPLAY_NAME} обробляє ім’я хоста. Тут видно, чи хост відповідає правилу для домену чи довіреному сайту, і який регіональний профіль буде застосовано.`,
    hostnameLabel: "Ім’я хоста",
    hostnameHint:
      "Використовуйте саме той хост, який ви хочете перевірити, наприклад shop.example.com.",
    hostnamePlaceholder: "напр. shop.example.com",
    noMatchTitle:
      "Жодне збережене правило для домену чи довірений сайт не відповідає цьому імені хоста",
    noMatchDescription:
      "Жодне збережене правило не застосовується, а правило за замовчуванням вимкнено або не налаштовано.",
    trustedSiteWinsTitle: "Це ім’я хоста вимкнено довіреними сайтами",
    trustedSiteWinsDescription: `Хост є у списку довірених сайтів, тому ${BRAND_DISPLAY_NAME} не діятиме тут, доки ви не видалите або не вимкнете цей запис.`,
    trustedSiteOverridesRuleTitle:
      "Довірені сайти мають пріоритет над правилом для домену",
    trustedSiteOverridesRuleDescription: `Це ім’я хоста відповідає як довіреному сайту, так і правилу домену. Довірені сайти мають пріоритет, тому ${BRAND_DISPLAY_NAME} залишається вимкненим, а наведене нижче правило для домену ігнорується.`,
    fallbackWinsTitle: "Тут застосовується правило за замовчуванням",
    fallbackWinsDescription: `Жодне правило для домену чи довірений сайт не відповідає цьому імені хоста, тому ${BRAND_DISPLAY_NAME} застосує тут правило за замовчуванням.`,
    ruleMatchTitle: (locationLabel: string) =>
      `${locationLabel} — активний профіль для цього сайту`,
    ruleMatchDescription: `Це ім’я хоста відповідає наведеному нижче правилу домену, тому ${BRAND_DISPLAY_NAME} використовуватиме цей профіль на сайті.`,
    hostnameDetailLabel: "Ім’я хоста",
    trustedSiteDetailLabel: "Довірений сайт",
    ruleDetailLabel: "Правило",
    defaultRuleDetailLabel: "Правило за замовчуванням",
    ignoredRuleDetailLabel: "Правило, яке ігнорується",
    profileDetailLabel: "Регіональний профіль",
    geolocationDetailLabel: "Геолокація",
    localeDetailLabel: "Локаль",
    timeZoneDetailLabel: "Часовий пояс",
    geolocationOn: "Увімкнено",
    geolocationOff: "Вимкнено",
  },

  dialog: {
    titleAdd: "Додати правило",
    titleEdit: "Редагувати правило",
    description:
      "Виберіть хости, на яких діє правило, а потім призначте регіональний профіль, особливі налаштування захисту або обидва варіанти.",
    patternLabel: "Шаблон",
    patternInfo:
      "Використовуйте <code>example.com</code> для одного точного хоста. Використовуйте <code>*example.com</code> для цього хоста та будь-якого субдомену, наприклад <code>www.example.com</code>. Використовуйте <code>*.example.com</code> лише для субдоменів.",
    patternInfoAriaLabel: "Дізнайтеся, як працюють шаблони правил",
    patternPlaceholder: "Введіть шаблон домену",
    locationLabel: "Профіль",
    locationProfileLabel: "Регіональний профіль",
    locationProfileHint: `Виберіть профіль, який має використовувати це правило. Якщо жодного не призначено, ${BRAND_DISPLAY_NAME} використовує наступний доступний профіль, зберігаючи налаштування захисту цього правила.`,
    bulkAssignSearchPlaceholder: "Пошук профілів…",
    enabledLabel: "Увімкнено",
    enabledHint:
      "Якщо вимкнено, це правило не застосовується. Його налаштування залишаються збереженими.",
    enabledAriaLabel: (pattern: string) => `Увімкнути або вимкнути правило ${pattern}`,
    advancedModal: {
      trigger: "Додатково",
      title: (pattern: string) => `Розширені налаштування для ${pattern}`,
      description:
        "Ці зміни залишаються в поточній чернетці, доки ви не збережете правило.",
      confirm: "Гаразд",
      patternFallback: "це правило",
    },
    relaxCspLabel: "Послабити CSP для захисту воркерів",
    relaxCspHint: `Видаляє заголовки Content Security Policy цього сайту, якщо вони заважають ${BRAND_DISPLAY_NAME} захищати воркерів.`,
    relaxCspRiskHint:
      "Попередження безпеки: це полегшує запуск шкідливих сценаріїв на сайті. Увімкніть його лише для сайту, якому ви довіряєте, і лише тоді, коли захист воркерів іншим чином не працює.",
    relaxCspAriaLabel: (pattern: string) =>
      `Перемкнути послаблення CSP для правила ${pattern}`,
    surfaceOverrides: {
      title: "Налаштування захисту",
      description:
        "Виберіть інші параметри захисту для цього правила. Залиште «Успадкувати», щоб застосувати глобальні налаштування.",
      stateOn: "Увімкнено",
      stateInherit: "Успадкувати",
      stateOff: "Вимкнено",
      stateNative: "Без підміни",
      stateSpoof: "Підміна",
      stateStrict: "Суворий",
      stateBlock: "Блокувати",
      stateAllow: "Дозволити",
      helpAriaLabel: (label: string) => `Дізнайтеся, чим керує ${label}`,
      geolocation: {
        label: "Геолокація",
        info: "Керує Geolocation API. Вимкніть підміну геолокації, якщо сайт має отримувати справжнє місцезнаходження, або ввімкніть її, щоб правило підміняло відповіді на запити геолокації.",
      },
      timeLocale: {
        label: "Час і локаль",
        info: "Керує Date, Intl, navigator.language, navigator.languages і заголовками мови, щоб сайти бачили регіон із вашого активного профілю.",
      },
      canvas: {
        label: "Canvas",
        info: "Керує результатом прихованого малюнка Canvas, за яким сайти можуть розпізнавати браузер.",
      },
      webGL: {
        label: "WebGL",
        info: "Контролює графічні деталі, такі як рендерер, дані GPU та пов’язані дані цифрових відбитків WebGL.",
      },
      audio: {
        label: "Аудіо",
        info: "Керує вихідними сигналами AudioContext, які сайти можуть вимірювати для відбитків аудіо.",
      },
      navigator: {
        label: "Navigator",
        info: "Керує полями ідентичності веб-переглядача, такими як платформа, відомості про обладнання та інші властивості Navigator.",
      },
      screen: {
        label: "Екран",
        info: "Керує розміром екрана, щільністю пікселів і відповідними деталями відображення.",
      },
      clientHints: {
        label: "Client Hints",
        info: "Керує деталями веб-переглядача та пристрою, наданими через заголовки та API Client Hints.",
      },
      battery: {
        label: "Акумулятор",
        info: "Контролює, чи отримує сайт фіксований стан повністю зарядженого акумулятора замість реального стану акумулятора пристрою.",
      },
      webRTC: {
        label: "WebRTC",
        info: "Керує захистом IP-адрес у WebRTC, який може зменшити витоки локальних і публічних адрес.",
      },
      serviceWorker: {
        label: "Service Workers",
        info: "Визначає, чи може цей сайт реєструвати Service Workers, які можуть працювати у фоновому режимі та зберігати дані надовго. Блокування може порушити роботу PWA, автономного режиму, push-сповіщень і фонової синхронізації; «Дозволити» дозволяє браузеру реєструвати їх як зазвичай; «Успадкувати» застосовує глобальне налаштування.",
      },
      sharedWorker: {
        label: "Dedicated і Shared Workers",
        info: "Замінює обробку Dedicated і Shared Worker для цього правила. «Без підміни» залишає воркери без змін, «Підміна» намагається застосувати підмінені значення, а «Суворий» блокує воркер, якщо підміну не можна підтвердити перед запуском.",
      },
    },
    identity: {
      sectionTitle: "Цифрова ідентичність",
      sectionDescription:
        "Це правило використовує сталу цифрову ідентичність для підміни. Змінюйте її лише тоді, коли потрібен новий цифровий відбиток і чистий стан пов’язаних сайтів.",
      actionDescription:
        "Видаляє пов’язані дані сайтів і створює для правила нову цифрову ідентичність.",
      actionLabel: "Нова ідентичність",
      confirmTitle: (pattern: string) => `Створити нову ідентичність для «${pattern}»?`,
      confirmDescription:
        "Це видалить файли cookie, дані сховищ, Service Workers і кеші сайтів, пов’язаних із правилом. Після цього буде створено нову цифрову ідентичність.",
      confirmDomainsLabel: `${BRAND_DISPLAY_NAME} видалить дані браузера для цих доменів:`,
      confirmNoDomains: `Для цього правила ще немає збережених даних браузера. ${BRAND_DISPLAY_NAME} однаково створить нову цифрову ідентичність.`,
      confirmLabel: "Створити нову ідентичність",
      rotateSuccess: "Для правила створено нову ідентичність.",
      rotateError: "Не вдалося створити нову ідентичність для правила.",
    },
    submitAdd: "Додати правило",
    submitEdit: "Зберегти",
    duplicateAlertTitle: "Перезаписати існуюче правило?",
    duplicateAlertDescription: (pattern: string) =>
      `Правило для «${pattern}» уже існує. Перезаписати його цими налаштуваннями?`,
    duplicateAlertConfirm: "Перезаписати",
    duplicateAlertClose: "Ні",
    trustedSiteOverrideWarning: (pattern: string) =>
      `Цей домен відповідає запису довірених сайтів «${pattern}». ${BRAND_DISPLAY_NAME} залишатиметься вимкненим тут незалежно від цих налаштувань.`,
  },
} as const;
