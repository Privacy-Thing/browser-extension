import { BRAND_DISPLAY_NAME } from "@/shared/brand";

const ABOUT_PRODUCT = `О ${BRAND_DISPLAY_NAME}`;
const ABOUT_PRODUCT_LOWER = `о ${BRAND_DISPLAY_NAME}`;
const HOW_TO_USE_PRODUCT = `Как использовать ${BRAND_DISPLAY_NAME}`;
const HOW_TO_USE_PRODUCT_LOWER = `как использовать ${BRAND_DISPLAY_NAME}`;
const WHAT_PRODUCT_IS_NOT = `Чем ${BRAND_DISPLAY_NAME} не является`;
const PRODUCT_NOT_LOWER = `раздел об ограничениях ${BRAND_DISPLAY_NAME}`;
const TERMS_OF_USE = "Условия использования";

export const about = {
  title: ABOUT_PRODUCT,
  description: `${BRAND_DISPLAY_NAME} помогает вам контролировать, как веб-сайты видят ваше местоположение, регион, часовой пояс и выбранные данные браузера.`,
  body1:
    "Каждый сохраненный региональный профиль объединяет координаты, языковые настройки и целевой часовой пояс в профиль, который можно назначать разным доменам.",
  body2: `Ваши изменения сохраняются автоматически. Обновлённые профили и правила вступают в силу при следующей загрузке страницы, поэтому ${BRAND_DISPLAY_NAME} может применить новые настройки с самого начала.`,
  body3Prefix: "Общие настройки защиты браузера находятся на вкладке",
  body3LinkLabel: "«Настройки»",
  body3Suffix: ".",
  website: {
    prefix: "Посетите ",
    linkLabel: `Сайт ${BRAND_DISPLAY_NAME}`,
    url: "https://privacything.com",
    suffix:
      ", чтобы узнать новости проекта, скачать расширение и найти другую информацию.",
  },
  versionLabel: "Версия",
  browserTargetLabel: "Браузер",
  releaseChannelLabel: "Канал выпуска",
  copyLinkLabel: ABOUT_PRODUCT_LOWER,
  copyLinkTermsLabel: "Условия использования",
  copyLinkPrivacyLabel: "о конфиденциальности",
  copyLinkLimitationsLabel: PRODUCT_NOT_LOWER,
  copyLinkLicenseLabel: "лицензия",
  copyLinkAssetsLabel: "сторонние компоненты",
  copyLinkUsageLabel: HOW_TO_USE_PRODUCT_LOWER,
  releaseChannels: {
    local: "Локальный",
    beta: "Бета",
    stable: "Стабильный",
  },

  support: {
    url: "https://webh.pl",
    logoLinkAriaLabel: "Открыть webh.pl",
    bodyPrefix: `${BRAND_DISPLAY_NAME} растет благодаря поддержке со стороны `,
    linkLabel: "webh.pl",
    bodySuffix: " — быстрая, гибкая инфраструктура для амбициозных проектов.",
  },

  terms: {
    title: TERMS_OF_USE,
    body1: `${BRAND_DISPLAY_NAME} предоставляется «как есть», без каких-либо гарантий.`,
    body2: `${BRAND_DISPLAY_NAME} помогает пользователям локально управлять выбранным местоположением, языковым стандартом, часовым поясом и соответствующими данными, отображаемыми в браузере. Это не VPN, прокси, инструмент анонимности, продукт безопасности или гарантия необнаружимости.`,
    body3: `Используйте ${BRAND_DISPLAY_NAME} на свой страх и риск. Вы несете ответственность за соблюдение действующего законодательства, условий веб-сайта, политики на рабочем месте и правил платформы.`,
  },

  privacy: {
    title: "Конфиденциальность",
    body: `${BRAND_DISPLAY_NAME} сохраняет настройки локально в браузере. Запросы внешних карт не являются обязательными: OpenStreetMap Nominatim используется для поиска местоположения, а OpenFreeMap используется для интерактивного предварительного просмотра карт после вашего согласия.`,
    openPolicyButton: "Открыть политику конфиденциальности",
  },

  limitations: {
    title: WHAT_PRODUCT_IS_NOT,
    intro: `${BRAND_DISPLAY_NAME} изменяет видимые в браузере данные, такие как геолокация, локаль, часовой пояс и выбранные данные цифрового отпечатка. Расширение не направляет трафик через другую сеть.`,
    body1: "Расширение не скрывает и не заменяет ваш IP-адрес.",
    body2: "Оно не заменяет VPN, прокси или настройки DNS.",
    body3:
      "Само по себе расширение не заставит сайты считать, что вы подключаетесь из другой страны.",
    outro: `Используйте ${BRAND_DISPLAY_NAME} для подмены на уровне браузера. Используйте инструменты VPN, прокси-сервера или DNS, когда вам нужно изменить местоположение на уровне сети.`,
  },

  license: {
    title: "Лицензия",
    creatorPrefix: "Автор проекта — ",
    creatorLabel: "Tomasz Janusz",
    creatorUrl: "https://tomaszjanusz.dev",
    creatorSuffix: ".",
    copyright: "© 2025 — настоящее время.",
    body: `${BRAND_DISPLAY_NAME} доступен по лицензии GNU Affero General Public License v3.0 или более поздней версии с дополнительными условиями.`,
    openLicenseButton: "Открыть лицензию",
  },

  assets: {
    title: "Сторонние компоненты",
    body: `Просмотрите сторонние компоненты и откройте тексты лицензий, поставляемые с ${BRAND_DISPLAY_NAME}.`,
    openNoticesButton: "Открыть сторонние уведомления",
    fontAwesome: {
      label: "Font Awesome Free 7.2.0",
      url: "https://fontawesome.com",
      body: " от Font Awesome / Fonticons, Inc. имеет лицензию CC BY 4.0, SIL OFL 1.1 и MIT.",
    },
    mapLibre: {
      label: "MapLibre GL JS",
      url: "https://maplibre.org/maplibre-gl-js/docs/",
      body: " поставляется локально для рендеринга векторных карт.",
    },
    openFreeMap: {
      label: "OpenFreeMap",
      url: "https://openfreemap.org/",
    },
    openStreetMap: {
      label: "OpenStreetMap",
      url: "https://www.openstreetmap.org/copyright",
    },
    osmWikiCountryCodes: {
      label: "OpenStreetMap Wiki: Nominatim/Country Codes",
      url: "https://wiki.openstreetmap.org/wiki/Nominatim/Country_Codes",
      body: " содержит типичные сочетания стран и языков для создания региональных профилей.",
      licenseLabel: "CC BY-SA 2.0",
      licenseUrl: "https://wiki.openstreetmap.org/wiki/Wiki_content_license",
      licenseBody:
        " относится к этому содержимому вики и соответственно упоминается здесь.",
    },
    mapPreviewsPrefix: "Для интерактивного просмотра карт используются сервисы ",
    mapPreviewsMiddle: "; сведения об участниках ",
    mapPreviewsSuffix: " показаны на карте.",

    localData: {
      title: "Локальные наборы данных",
      body: `${BRAND_DISPLAY_NAME} содержит небольшие локальные наборы данных из открытых источников, чтобы подменённые значения оставались статистически правдоподобными. Во время работы данные не загружаются из Интернета: локальные копии обновляются вместе с расширением.`,
      steam: {
        label: "Опрос оборудования и программного обеспечения Steam",
        url: "https://store.steampowered.com/hwsurvey/",
        body: " (Valve) предоставляет статистику разрешения экрана, числа ядер процессора и объёма памяти для Windows, Linux и macOS. Эти данные используются для локальных профилей оборудования.",
      },
      chromiumDash: {
        label: "ChromiumDash",
        url: "https://chromiumdash.appspot.com/",
        body: " предоставляет реальные версии выпуска Chrome, используемые для User-Agent и Client Hints.",
      },
      localeCatalog: {
        prefix: "Каталоги ",
        mozilla: {
          label: "Mozilla",
          url: "https://github.com/mozilla-firefox/firefox/blob/main/intl/locale/language.properties",
        },
        middle: " и ",
        chromium: {
          label: "Chromium",
          url: "https://github.com/chromium/chromium/blob/main/ui/base/l10n/l10n_util.cc",
        },
        body: " предоставляют названия языков, согласованные с соответствующими браузерными движками.",
      },
    },
  },

  projectLinks: {
    description: `У ${BRAND_DISPLAY_NAME} есть сайт и открытый исходный код. Посетите сайт, изучите репозиторий или сообщите об ошибке.`,
    websiteLabel: "Сайт",
    websiteUrl: "https://privacything.com",
    sourceLabel: "Источник",
    sourceUrl: "https://github.com/Privacy-Thing/browser-extension",
    reportBugLabel: "Сообщить об ошибке",
    reportBugUrl:
      "https://github.com/Privacy-Thing/browser-extension/issues/new?template=bug_report.yml",
  },

  usage: {
    title: HOW_TO_USE_PRODUCT,
    body1:
      "Если вам нужна быстрая и реалистичная отправная точка, начните с создания регионального профиля на основе искомого места.",
    body2: `Создайте отдельный региональный профиль для каждого места, которое нужно имитировать, а затем назначьте сайтам подходящие профили.`,
    body3:
      "Используйте всплывающее окно для быстрого назначения домена. Откройте «Настройки», если вам нужна полная панель управления для региональных профилей и правил.",
    body4: `Изучите «Настройки» и «Дополнительно», если вам нужен больший контроль над поведением ${BRAND_DISPLAY_NAME}.`,
  },
} as const;
