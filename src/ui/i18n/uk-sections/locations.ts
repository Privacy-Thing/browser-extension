import { BRAND_DISPLAY_NAME } from "@/shared/brand";
import { slavicCount } from "@/ui/shared/slavic-plural";

const PRODUCT_NOT_LOWER = `чим не є ${BRAND_DISPLAY_NAME}`;

export const locations = {
  title: "Регіональні профілі",
  description:
    "Регіональні профілі об’єднують координати, локаль і часовий пояс для підміни.",
  addManualButton: "Додати вручну",
  actionsMenuLabel: "Дії з профілями",
  generateButton: "Створити профіль",
  searchPlaceholder: "Пошук профілів…",
  unused: "Не використовується",
  assigned: (count: number) =>
    slavicCount(count, ["призначення", "призначення", "призначень"]),
  viewAssignedRulesAriaLabel: (locationLabel: string, count: number) =>
    `Показати ${slavicCount(count, ["правило", "правила", "правил"])} для профілю «${locationLabel}»`,
  copyLinkLabel: "Регіональні профілі",
  copyLinkHelpLabel: "довідка про регіональні профілі",

  playgroundCard: {
    title: "Пісочниця",
    body1:
      "Перевірте збережений профіль перед призначенням сайтам. Пісочниця показує регіон, часовий пояс, формат дат і підмінені координати так само, як їх побачать захищені сайти.",
    body2:
      "У пісочниці координати оновлюються кожні 2–5 секунд, щоб рух було легко перевірити. На звичайних сайтах діє заданий вами інтервал.",
  },

  help: {
    title: "Регіональні профілі",
    body1:
      "Регіональний профіль має описувати одне правдоподібне місце. Локаль, список мов і часовий пояс мають відповідати регіону збережених координат.",
    body2: `Зміни зберігаються автоматично. Коли ви редагуєте поле, ${BRAND_DISPLAY_NAME} записує оновлення після короткої паузи.`,
    body3:
      "Збережений регіональний профіль змінює значення на рівні браузера, такі як геолокація, локаль і часовий пояс. Це не змінює IP-адресу чи маршрут мережевого трафіку.",
    privacyTitle: "Конфіденційність",
    privacyBody: `Пошук і попередній перегляд карти необов’язкові. ${BRAND_DISPLAY_NAME} зв’язується лише з OpenStreetMap Nominatim для пошуку та OpenFreeMap для попереднього перегляду інтерактивної карти після того, як ви це дозволите.`,
    networkTitle: "Обмеження мережі",
    networkBodyPrefix:
      "Потрібно змінити місцеперебування на рівні мережі? Скористайтеся VPN, проксі або DNS. Дізнайтеся, ",
    networkBodyLinkLabel: PRODUCT_NOT_LOWER,
    networkBodySuffix: ".",
  },

  editor: {
    title: "Редагувати профіль",
    description:
      "Оновіть збережений регіональний профіль, включаючи координати, регіональні формати та поведінку звітів про місцезнаходження.",
    deleteBlockedTitle: "Цей профіль ще призначено",
    deleteBlockedDescription:
      "Змініть або видаліть усі призначення нижче, перш ніж видаляти профіль.",
    deleteBlockedButtonTitle: "Спочатку видаліть усі призначення цього профілю.",
    disabledDependencySuffix: "(вимкнено)",
    mapDisabledTitle: "Карту вимкнено",
    mapDisabledBody:
      "Попередній перегляд карти не завантажується, оскільки ви не дозволили зовнішні запити карти.",
    geolocationSectionTitle: "Геолокація",
    geolocationSectionDescription:
      "Координати, точність і максимальний розкид, дозволений для підмінених позицій.",
    localeSectionTitle: "Час і мова",
    localeSectionDescription:
      "Зберігайте значення локалі у відповідності з тим самим регіоном, що й збережені координати.",
    primaryLocaleLabel: "Основна локаль",
    languageDescription:
      "Це основна локаль профілю для дат, чисел та інших локалізованих значень.",
    languageBehaviorDescription:
      "Якщо параметр «Віддавати перевагу англійській на веб-сайтах» вимкнено, веб-сайти також бачать це значення як navigator.language. Навіть якщо спочатку англійська, ця мова все ще контролює форматування дати та чисел за замовчуванням.",
    preferredLanguagesLabel: "Бажані мови",
    languagesDescription:
      "Упорядкований список налаштувань мови браузера для цього профілю.",
    languagesBehaviorDescription: `${BRAND_DISPLAY_NAME} розкриває цей порядок як navigator.languages і відповідні мовні налаштування. Спершу збережіть основну мову, а потім додайте реалістичні альтернативні мови, які сайт міг би вірогідно побачити для цього профілю.`,
    preferEnglishContentLabel: "Віддавати перевагу англійській на сайтах",
    preferEnglishContentDescriptionPrefix: `${BRAND_DISPLAY_NAME} зберігає вибраний регіон, але ставить`,
    preferEnglishContentDescriptionSuffix:
      "на перше місце в списку мов браузера, щоб сайти частіше показували вміст англійською.",
    preferEnglishContentLockedTagTitle: (locale: string) =>
      `${locale} додається через пріоритет англійської мови, тому тут його не можна видалити.`,
    accuracyDescription:
      "Контролює значення точності, яке веб-сайти бачать у результатах геолокації.",
    noiseRadiusDescription:
      "Максимально дозволена відстань між підміненими координатами та збереженою точкою цього профілю.",
  },

  generator: {
    title: "Створити профіль",
    searchStepDescription:
      "Знайдіть місто, адресу чи назву місця, щоб створити новий профіль.",
    resultStepDescription: `Виберіть відповідний результат, перш ніж ${BRAND_DISPLAY_NAME} створить профіль.`,
    languageStepDescription:
      "Спочатку виберіть основну локаль браузера для цього профілю.",
    confirmStepDescription: "Перевірте місце на карті, перш ніж додавати профіль.",
    locationLabel: "Розташування",
    locationPlaceholder: "Варшава, Польща",
    osmDisclaimer:
      "Для пошуку використовується зовнішній API OpenStreetMap Nominatim. Інтерактивний попередній перегляд використовує векторні плитки та шрифти OpenFreeMap після згоди.",
    resultSelectLabel: "Результат пошуку",
    resultStepBody:
      "OpenStreetMap повернув більше одного можливого збігу. Виберіть місце, яке ви мали на увазі, а потім продовжуйте.",
    resultStepHint: "Виберіть результат, щоб продовжити.",
    languageSelectLabel: "Мова браузера",
    languageStepBody:
      "Для цього місця доступно кілька мов браузера. Виберіть потрібну для профілю.",
    languageStepHint:
      "Якщо потрібної вам мови немає в списку нижче, ви можете вибрати іншу на наступному кроці.",
    resultPrefix: "Результат: ",
  },
} as const;
