import { BRAND_DISPLAY_NAME } from "@/shared/brand";

const SPOOFED_PRODUCT = `Підмінено — ${BRAND_DISPLAY_NAME}`;

export const demo = {
  loadingSettings: "Завантаження налаштувань…",
  noLocationsTitle: "Регіональних профілів ще немає",
  noLocationsBody:
    "Створіть принаймні один регіональний профіль у налаштуваннях, щоб користуватися пісочницею.",
  openSettingsButton: "Відкрити налаштування",

  locationPreview: {
    title: "Попередній перегляд",
    activeLocationLabel: "Активний профіль",
    activeLocationDescription:
      "Виберіть збережений регіональний профіль, щоб переглянути його значення в браузері. Зміна профілю скидає маршрут і оновлює попередній перегляд геолокації.",
    activeLocationPlaceholder: "Вибрати профіль…",
    playgroundCadenceLabel: "Інтервал оновлення в пісочниці",
    realSiteCadenceLabel: "Інтервал оновлення на сайті",
    configuredDelayLabel: "Задана затримка координат",
    callbackDelayLabel: "Затримка відповіді",
    runtimeModeLabel: "Режим роботи",
    runtimeModeSimple: "Типовий інтервал",
    realLocationTitleIdle: "Порівняйте з поточним розташуванням веб-переглядача",
    realLocationTitleLoading: "Запит поточного розташування браузера",
    realLocationTitleGranted: "Поточне розташування браузера готове",
    realLocationTitleDenied: "Доступ до місцезнаходження відхилено",
    realLocationTitleUnavailable: "Розташування веб-переглядача недоступне",
    realLocationDescription:
      "Запитайте справжнє місцезнаходження браузера один раз, щоб порівняти його з попереднім переглядом нижче.",
    realLocationGrantedDescription:
      "Поточне місцезнаходження вашого браузера тепер доступне в рядках геолокації нижче для порівняння.",
    realLocationDeniedDescription:
      "Браузер відмовив у доступі до реальної геолокації. Ви можете спробувати ще раз, якщо дозвіл зміниться.",
    realLocationUnavailable:
      "Порівняння реального місцезнаходження недоступне, оскільки цей веб-переглядач не надає тут геолокації.",
    realLocationRefresh: "Оновити реальне розташування",
  },

  localMachineTitle: "Цей браузер",
  spoofedTitle: SPOOFED_PRODUCT,
  waitingForPermission: "Очікування дозволу браузера…",
  permissionDenied: "Браузер відхилив дозвіл",
  geolocationUnavailable: "Геолокація недоступна",
  requestRealLocation: "Запит реального місцезнаходження",
  requestRealLocationHintTitle: "Справжнє місцезнаходження ще не завантажено",
  requestRealLocationTableHint:
    "Надішліть запит на справжнє розташування вашого браузера, щоб порівняти його тут.",
  waitingForFix: "Очікування перших координат…",
  selectLocationPrompt:
    "Виберіть регіональний профіль вище, щоб переглянути його значення.",

  comparison: {
    language: "navigator.language",
    languages: "navigator.languages",
    timeZone: "Intl…resolvedOptions().timeZone",
    acceptLanguage: "Заголовок Accept-Language",
    timeZoneOffset: "new Date().getTimezoneOffset()",
    dateToString: "new Date().toString()",
    dateToDateString: "new Date().toDateString()",
    dateToTimeString: "new Date().toTimeString()",
    dateLocaleString: "new Date().toLocaleString()",
    dateLocaleDateString: "new Date().toLocaleDateString()",
    dateLocaleTimeString: "new Date().toLocaleTimeString()",
    currentPosition: "navigator.geolocation.getCurrentPosition()",
    coords: "geolocation.coords",
    timestamp: "geolocation.timestamp",
    timestampInfoLabel: "Про відображення позначки часу геолокації",
    timestampTooltip: `${BRAND_DISPLAY_NAME} повертає необроблену позначку часу Unix у мілісекундах. Показана тут зрозуміла для людини дата лише для зручності та відформатована відповідно до часового поясу стовпця, що відображається.`,
    userAgent: "navigator.userAgent",
    appVersion: "navigator.appVersion",
    vendor: "navigator.vendor",
    hardwareConcurrency: "navigator.hardwareConcurrency",
    deviceMemory: "navigator.deviceMemory",
    platform: "navigator.platform",
    pixelDepth: "screen.pixelDepth",
    screenMetrics: "screen.width/height/avail*/colorDepth",
    devicePixelRatio: "window.devicePixelRatio",
    canvas2d: "Результат перевірки Canvas 2D",
    webglRenderer: "Перевірка рендерера WebGL",
    webglDebugExtension: "WEBGL_debug_renderer_info",
    webglReadPixels: "Перевірка WebGL readPixels()",
    audioFingerprint: "Перевірка AnalyserNode і AudioBuffer",
    clientHintBrands: "navigator.userAgentData.brands",
    clientHintPlatform: "navigator.userAgentData.platform",
    clientHintPlatformVersion: "navigator.userAgentData.platformVersion",
    clientHintArchitecture: "navigator.userAgentData.architecture",
    clientHintBitness: "navigator.userAgentData.bitness",
    clientHintModel: "navigator.userAgentData.model",
    clientHintMobile: "navigator.userAgentData.mobile",
    clientHintFullVersionList: "navigator.userAgentData.fullVersionList",
    secChUa: "Заголовок Sec-CH-UA",
    secChUaPlatform: "Заголовок Sec-CH-UA-Platform",
    secChUaMobile: "Заголовок Sec-CH-UA-Mobile",
    secChUaFullVersionList: "Заголовок Sec-CH-UA-Full-Version-List",
    webRTCIcePolicy: "Політика ICE RTCPeerConnection",
    probePending: "Збирання даних…",
    notAvailable: "N/A",
    spoofedMatchesLocal:
      "Для цієї ідентичності значення попереднього перегляду збігається з даними вашого браузера.",
    browserVersionNote: (versionToken: string) =>
      `${BRAND_DISPLAY_NAME} зберігає нормалізовані маркери версії браузера та не рандомізує варіанти заповнювачів, як-от ${versionToken}.`,
  },

  previewSeed: {
    title: "Попередній перегляд ідентичності",
    description: "Виберіть ідентичність браузера для цього попереднього перегляду.",
    inputAriaLabel: "Код ідентичності для попереднього перегляду",
    placeholder: "Код ідентичності",
    hint: "Введіть 6 малих літер або цифр. Змініть код, щоб переглянути іншу ідентичність.",
    randomize: "Створити нову ідентичність",
  },

  sections: {
    localeDate: "Локаль і Date",
    networkHeaders: "Мережні заголовки",
    geolocation: "Геолокація",
    browserFingerprint: "Ідентичність браузера",
    webglCanvas: "Canvas і WebGL",
    screen: "Екран",
    audio: "Аудіо",
    webRTC: "WebRTC",
  },

  map: {
    title: "Попередній перегляд карти",
    noLocationTitle: "Спочатку виберіть профіль",
    noLocationDescription:
      "Виберіть збережений регіональний профіль вище, щоб увімкнути керування картою та маршрутними точками.",
    osmRequired: "Потрібен доступ до карти",
    osmRequiredDescription:
      "Дозвольте зовнішній доступ до карти для попереднього перегляду підміненої позиції на інтерактивній карті.",
    demoIntervalLabel: "Демонстраційний інтервал (2–5 с)",
    clearButton: "Очистити",
  },

  disclaimer: {
    title: "Це попередній перегляд",
    body: `Тут можна перевірити, як ${BRAND_DISPLAY_NAME} показуватиме вибраний регіональний профіль на сайтах. Мова, локаль, час, заголовки та інші значення відображаються як <em>попередній перегляд</em> на основі даних профілю. Геолокація працює так само, як на захищених сайтах, але в пісочниці координати оновлюються частіше, щоб зміни було легше помітити.`,
  },

  howItWorks: {
    title: "Як читати цей попередній перегляд",
    body1:
      "<strong>Мова, локаль і час</strong> — тут показано, які значення побачать сайти для вибраного профілю. Саму сторінку пісочниці ці дані не змінюють.",
    body2: `<strong>Геолокація</strong> — карта й координати відтворюють переміщення та частоту оновлення, які діятимуть на захищених сайтах.`,
    body3: `<strong>Дані браузера й заголовки</strong> — порівняйте справжні дані браузера зі значеннями, які ${BRAND_DISPLAY_NAME} показуватиме для вибраного профілю з урахуванням ваших налаштувань захисту.`,
    body4:
      "Пісочниця оновлюється швидше, ніж звичайний перегляд, тому зміни легше помітити під час тестування.",
  },
} as const;
