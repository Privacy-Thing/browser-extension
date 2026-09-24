import { BRAND_DISPLAY_NAME } from "@/shared/brand";

const SPOOFED_PRODUCT = `Подменено — ${BRAND_DISPLAY_NAME}`;

export const demo = {
  loadingSettings: "Загрузка настроек…",
  noLocationsTitle: "Пока нет региональных профилей",
  noLocationsBody:
    "Создайте хотя бы один региональный профиль в настройках, чтобы открыть песочницу.",
  openSettingsButton: "Открыть настройки",

  locationPreview: {
    title: "Предпросмотр профиля",
    activeLocationLabel: "Активный профиль",
    activeLocationDescription:
      "Выберите сохранённый региональный профиль, чтобы увидеть его значения. При смене профиля путь сбрасывается, и геолокация начинает обновляться для нового места.",
    activeLocationPlaceholder: "Выберите профиль…",
    playgroundCadenceLabel: "Интервал обновления в песочнице",
    realSiteCadenceLabel: "Интервал обновления на сайте",
    configuredDelayLabel: "Задержка watchPosition",
    callbackDelayLabel: "Задержка ответа",
    runtimeModeLabel: "Режим работы",
    runtimeModeSimple: "Стандартный интервал",
    realLocationTitleIdle: "Сравните с текущим местоположением вашего браузера",
    realLocationTitleLoading: "Запрос вашего текущего местоположения в браузере",
    realLocationTitleGranted: "Текущее местоположение браузера готово",
    realLocationTitleDenied:
      "Разрешение на определение местоположения браузера отклонено",
    realLocationTitleUnavailable: "Местоположение браузера недоступно",
    realLocationDescription:
      "Запросите реальную геолокацию браузера один раз, чтобы сравнить ее с выбранным предварительным просмотром ниже.",
    realLocationGrantedDescription:
      "Текущее местоположение вашего браузера теперь доступно в строках геолокации ниже для параллельного сравнения.",
    realLocationDeniedDescription:
      "Браузер запретил доступ к реальной геолокации. Вы можете попробовать еще раз, если разрешение изменится.",
    realLocationUnavailable:
      "Сравнение реального местоположения недоступно, поскольку этот браузер не отображает здесь геолокацию.",
    realLocationRefresh: "Обновить реальное местоположение",
  },

  localMachineTitle: "Этот браузер",
  spoofedTitle: SPOOFED_PRODUCT,
  waitingForPermission: "Ожидание разрешения браузера…",
  permissionDenied: "Разрешение отклонено браузером",
  geolocationUnavailable: "Геолокация недоступна",
  requestRealLocation: "Запросить реальное местоположение",
  requestRealLocationHintTitle: "Реальное местоположение еще не загружено",
  requestRealLocationTableHint:
    "Запросите реальное местоположение вашего браузера выше, чтобы сравнить его здесь.",
  waitingForFix: "Ожидание первых координат…",
  selectLocationPrompt:
    "Выберите региональный профиль выше, чтобы увидеть его значения.",

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
    timestampInfoLabel: "Об отображении метки времени геолокации",
    timestampTooltip: `${BRAND_DISPLAY_NAME} возвращает необработанную временную метку эпохи Unix в миллисекундах. Удобочитаемая дата, показанная здесь, предназначена только для удобства и отформатирована в соответствии с часовым поясом отображаемого столбца.`,
    userAgent: "navigator.userAgent",
    appVersion: "navigator.appVersion",
    vendor: "navigator.vendor",
    hardwareConcurrency: "navigator.hardwareConcurrency",
    deviceMemory: "navigator.deviceMemory",
    platform: "navigator.platform",
    pixelDepth: "screen.pixelDepth",
    screenMetrics: "screen.width/height/avail*/colorDepth",
    devicePixelRatio: "window.devicePixelRatio",
    canvas2d: "Результат проверки Canvas 2D",
    webglRenderer: "Проверка рендерера WebGL",
    webglDebugExtension: "WEBGL_debug_renderer_info",
    webglReadPixels: "Проверка WebGL readPixels()",
    audioFingerprint: "Проверка AnalyserNode и AudioBuffer",
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
    webRTCIcePolicy: "Политика RTCPeerConnection ICE",
    probePending: "Сбор данных…",
    notAvailable: "Н/Д",
    spoofedMatchesLocal:
      "Для этой идентичности значение предпросмотра совпадает с данными вашего браузера.",
    browserVersionNote: (versionToken: string) =>
      `${BRAND_DISPLAY_NAME} сохраняет стандартные обозначения версии браузера и не изменяет заполнители вроде ${versionToken}.`,
  },

  previewSeed: {
    title: "Предварительный просмотр идентичности",
    description: "Выберите идентичность браузера для этого предварительного просмотра.",
    inputAriaLabel: "Код идентичности для предварительного просмотра",
    placeholder: "Код идентичности",
    hint: "Используйте 6 строчных букв или цифр. Измените код, чтобы просмотреть другую идентичность.",
    randomize: "Создать новую идентичность",
  },

  sections: {
    localeDate: "Локаль и Date",
    networkHeaders: "Сетевые заголовки",
    geolocation: "Геолокация",
    browserFingerprint: "Цифровой отпечаток браузера",
    webglCanvas: "Canvas и WebGL",
    screen: "Экран",
    audio: "Аудио",
    webRTC: "WebRTC",
  },

  map: {
    title: "Предварительный просмотр карты",
    noLocationTitle: "Сначала выберите региональный профиль",
    noLocationDescription:
      "Выберите сохраненный региональный профиль выше, чтобы включить элементы управления картой и путевыми точками.",
    osmRequired: "Требуется доступ к карте",
    osmRequiredDescription:
      "Разрешите загрузку внешних карт, чтобы увидеть подменённое положение на интерактивной карте.",
    demoIntervalLabel: "Демонстрационный интервал (2–5 с)",
    clearButton: "Очистить",
  },

  disclaimer: {
    title: "Это предварительный просмотр",
    body: `Здесь можно проверить, какие данные ${BRAND_DISPLAY_NAME} покажет сайтам для выбранного регионального профиля. Язык, локаль, время, заголовки и другие значения отображаются как <em>предварительный просмотр</em> на основе данных профиля. Геолокация работает так же, как на защищённых сайтах, но в песочнице координаты обновляются чаще, чтобы изменения было легче заметить.`,
  },

  howItWorks: {
    title: "Как пользоваться предварительным просмотром",
    body1:
      "<strong>Язык, локаль и время</strong> — здесь показаны значения, которые увидят сайты для выбранного профиля. Сама страница песочницы не меняется.",
    body2: `<strong>Геолокация</strong> — карта и координаты показывают движение и частоту обновления, которые будут действовать на защищённых сайтах.`,
    body3: `<strong>Данные браузера и заголовки</strong> — сравните настоящие данные браузера со значениями, которые ${BRAND_DISPLAY_NAME} покажет для выбранного профиля с учётом ваших настроек защиты.`,
    body4:
      "В песочнице данные обновляются чаще, чем на обычных сайтах, чтобы изменения было легче заметить.",
  },
} as const;
