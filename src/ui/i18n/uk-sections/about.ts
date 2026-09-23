import { BRAND_DISPLAY_NAME } from "@/shared/brand";

const ABOUT_PRODUCT = `Про ${BRAND_DISPLAY_NAME}`;
const ABOUT_PRODUCT_LOWER = `про ${BRAND_DISPLAY_NAME}`;
const HOW_TO_USE_PRODUCT = `Як використовувати ${BRAND_DISPLAY_NAME}`;
const HOW_TO_USE_PRODUCT_LOWER = `як використовувати ${BRAND_DISPLAY_NAME}`;
const WHAT_PRODUCT_IS_NOT = `Чим не є ${BRAND_DISPLAY_NAME}`;
const PRODUCT_NOT_LOWER = `розділ про обмеження ${BRAND_DISPLAY_NAME}`;
const TERMS_OF_USE = "Умови використання";

export const about = {
  title: ABOUT_PRODUCT,
  description: `${BRAND_DISPLAY_NAME} допомагає контролювати, як веб-сайти бачать ваше місцезнаходження, регіон, часовий пояс і вибрані відомості про браузер.`,
  body1:
    "Кожен збережений регіональний профіль об’єднує координати, мовні параметри та цільовий часовий пояс у профіль, який можна призначати різним доменам.",
  body2: `Ваші зміни зберігаються автоматично. Оновлені профілі та правила набувають чинності під час наступного завантаження сторінки, тому ${BRAND_DISPLAY_NAME} може застосувати нові налаштування з самого початку.`,
  body3Prefix: "Загальні налаштування захисту браузера є на вкладці",
  body3LinkLabel: "«Налаштування»",
  body3Suffix: ".",
  website: {
    prefix: "Відвідайте ",
    linkLabel: `Веб-сайт ${BRAND_DISPLAY_NAME}`,
    url: "https://privacything.com",
    suffix: ", щоб знайти новини про проєкт, завантаження та іншу інформацію.",
  },
  versionLabel: "Версія",
  browserTargetLabel: "Цільовий браузер",
  releaseChannelLabel: "Канал випуску",
  copyLinkLabel: ABOUT_PRODUCT_LOWER,
  copyLinkTermsLabel: "умови використання",
  copyLinkPrivacyLabel: "про конфіденційність",
  copyLinkLimitationsLabel: PRODUCT_NOT_LOWER,
  copyLinkLicenseLabel: "ліцензія",
  copyLinkAssetsLabel: "сторонні компоненти",
  copyLinkUsageLabel: HOW_TO_USE_PRODUCT_LOWER,
  releaseChannels: {
    local: "Локальний",
    beta: "Бета",
    stable: "Стабільний",
  },

  support: {
    url: "https://webh.pl",
    logoLinkAriaLabel: "Відкрити webh.pl",
    bodyPrefix: `${BRAND_DISPLAY_NAME} розвивається за підтримки `,
    linkLabel: "webh.pl",
    bodySuffix: " — швидка, гнучка інфраструктура для амбітних проєктів.",
  },

  terms: {
    title: TERMS_OF_USE,
    body1: `${BRAND_DISPLAY_NAME} надається «як є», без будь-яких гарантій.`,
    body2: `${BRAND_DISPLAY_NAME} допомагає користувачам локально контролювати вибране місцезнаходження, регіон, часовий пояс і пов’язані дані, які браузер надає сайтам. Це не VPN, проксі-сервер, інструмент анонімності, продукт безпеки чи гарантія неможливості виявлення.`,
    body3: `Використовуйте ${BRAND_DISPLAY_NAME} на власний ризик. Ви несете відповідальність за дотримання відповідних законів, умов використання сайтів, правил робочого місця і правил платформи.`,
  },

  privacy: {
    title: "Конфіденційність",
    body: `${BRAND_DISPLAY_NAME} зберігає налаштування локально у вашому браузері. Зовнішні запити карт необов’язкові: OpenStreetMap Nominatim використовується для пошуку місцезнаходження, а OpenFreeMap використовується для інтерактивного попереднього перегляду карти після вашої згоди.`,
    openPolicyButton: "Відкрити політику конфіденційності",
  },

  limitations: {
    title: WHAT_PRODUCT_IS_NOT,
    intro: `${BRAND_DISPLAY_NAME} змінює видимі у браузері дані, такі як геолокація, локаль, часовий пояс і вибрані дані цифрових відбитків. Розширення не спрямовує трафік через іншу мережу.`,
    body1: "Воно не приховує та не замінює вашу IP-адресу.",
    body2: "Воно не замінює VPN, проксі чи налаштування DNS.",
    body3:
      "Саме по собі розширення не змусить сайти вважати, що ви підключаєтеся з іншої країни.",
    outro: `Використовуйте ${BRAND_DISPLAY_NAME} для підміни на рівні браузера. Використовуйте інструменти VPN, проксі або DNS, коли потрібно змінити розташування на рівні мережі.`,
  },

  license: {
    title: "Ліцензія",
    creatorPrefix: "Автор проєкту — ",
    creatorLabel: "Tomasz Janusz",
    creatorUrl: "https://tomaszjanusz.dev",
    creatorSuffix: ".",
    copyright: "© 2025 — дотепер.",
    body: `${BRAND_DISPLAY_NAME} доступний за GNU Affero General Public License v3.0 або новішої версії з додатковими умовами.`,
    openLicenseButton: "Відкрити ліцензію",
  },

  assets: {
    title: "Сторонні активи",
    body: `Ознайомтеся зі сторонніми компонентами, що входять у комплект, і відкрийте тексти ліцензій, що постачаються разом із ${BRAND_DISPLAY_NAME}.`,
    openNoticesButton: "Відкрити відомості про сторонні компоненти",
    fontAwesome: {
      label: "Font Awesome Free 7.2.0",
      url: "https://fontawesome.com",
      body: " від Font Awesome / Fonticons, Inc. ліцензовано відповідно до CC BY 4.0, SIL OFL 1.1 і MIT.",
    },
    mapLibre: {
      label: "MapLibre GL JS",
      url: "https://maplibre.org/maplibre-gl-js/docs/",
      body: " входить до складу розширення для відображення векторних карт.",
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
      body: " надає типові пари країн і мов для створення регіональних профілів.",
      licenseLabel: "CC BY-SA 2.0",
      licenseUrl: "https://wiki.openstreetmap.org/wiki/Wiki_content_license",
      licenseBody:
        " поширюється на вміст вікі та зазначена тут відповідно до вимог ліцензії.",
    },
    mapPreviewsPrefix: "Для інтерактивного перегляду карт використовуються сервіси ",
    mapPreviewsMiddle: "; відомості про учасників ",
    mapPreviewsSuffix: " показано на карті.",

    localData: {
      title: "Локальні набори даних",
      body: `${BRAND_DISPLAY_NAME} містить невеликі локальні набори даних, створені на основі оброблених відкритих даних, тому підмінені значення залишаються статистично реалістичними. Нічого не завантажується з Інтернету — це локальні знімки, які оновлюються з кожним оновленням розширення.`,
      steam: {
        label: "Опитування апаратного та програмного забезпечення Steam",
        url: "https://store.steampowered.com/hwsurvey/",
        body: " (Valve) надає статистику роздільної здатності екрана, кількості ядер процесора й обсягу пам’яті для Windows, Linux і macOS, які використовуються для профілів локального обладнання.",
      },
      chromiumDash: {
        label: "ChromiumDash",
        url: "https://chromiumdash.appspot.com/",
        body: " надає справжні номери версій Chrome, які використовуються для User-Agent і Client Hints.",
      },
      localeCatalog: {
        prefix: "Каталоги ",
        mozilla: {
          label: "Mozilla",
          url: "https://github.com/mozilla-firefox/firefox/blob/main/intl/locale/language.properties",
        },
        middle: " та ",
        chromium: {
          label: "Chromium",
          url: "https://github.com/chromium/chromium/blob/main/ui/base/l10n/l10n_util.cc",
        },
        body: " надають назви мов, узгоджені з відповідними браузерними рушіями.",
      },
    },
  },

  projectLinks: {
    description: `${BRAND_DISPLAY_NAME} має власний сайт і відкритий код. Перейдіть на сайт, перегляньте репозиторій або повідомте про помилку.`,
    websiteLabel: "Веб-сайт",
    websiteUrl: "https://privacything.com",
    sourceLabel: "Джерело",
    sourceUrl: "https://github.com/Privacy-Thing/browser-extension",
    reportBugLabel: "Повідомити про помилку",
    reportBugUrl:
      "https://github.com/Privacy-Thing/browser-extension/issues/new?template=bug_report.yml",
  },

  usage: {
    title: HOW_TO_USE_PRODUCT,
    body1:
      "Почніть зі створення регіонального профілю з місця пошуку, якщо вам потрібна швидка, реалістична відправна точка.",
    body2: `Зберігайте окремий профіль для кожного місця, яке має імітувати ${BRAND_DISPLAY_NAME}, а потім призначте веб-сайти відповідному профілю.`,
    body3:
      "Використовуйте вікно розширення для швидкого призначення домену. Відкрийте «Налаштування», якщо вам потрібна повна панель керування профілями та правилами.",
    body4: `Відкрийте «Налаштування» та «Додатково», якщо вам потрібно більше контролювати поведінку ${BRAND_DISPLAY_NAME}.`,
  },
} as const;
