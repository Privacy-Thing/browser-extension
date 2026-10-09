import { BRAND_DISPLAY_NAME } from "@/shared/brand";
import { createMessagesProxy, getActiveUiLocale } from "@/ui/i18n";

const en = {
  serviceChanges: "DNS service rules",
  add: "Add",
  update: "Update",
  remove: "Remove",
  recognitionTitle: "Recognize services",
  recognitionDescription:
    "Use a separate lookup profile to identify a domain without interference from the profile's Custom Rules. It is used only for checks from the rule editor and popup.",
  recognitionScope: `This creates a lookup profile and endpoint with service rules set to Bypass. Keep your browser on its regional DNS endpoint; the lookup endpoint does not extend ${BRAND_DISPLAY_NAME} protection.`,
  preview: "Preview lookup setup",
  apply: "Apply lookup setup",
  ready: "Lookup setup ready",
  notReady: "Lookup setup not configured",
  stale: "Lookup setup needs review",
  profiles: "Profiles",
  endpoints: "Endpoints",
  services: "Bypass service rules",
  working: "Working…",
};
type FeatureMessages = typeof en;
const es: FeatureMessages = {
  serviceChanges: "Reglas DNS de servicios",
  add: "Añadir",
  update: "Actualizar",
  remove: "Eliminar",
  recognitionTitle: "Reconocer servicios",
  recognitionDescription:
    "Un perfil de consulta independiente identifica un dominio sin interferencias de las reglas personalizadas del perfil. Solo se usa para comprobaciones desde el editor y la ventana emergente.",
  recognitionScope: `Se crean un perfil y un endpoint de consulta con reglas de servicios en Bypass. Mantén el navegador en su endpoint DNS regional; el endpoint de consulta no amplía la protección de ${BRAND_DISPLAY_NAME}.`,
  preview: "Previsualizar la configuración",
  apply: "Aplicar la configuración",
  ready: "Consulta lista",
  notReady: "Consulta sin configurar",
  stale: "La consulta requiere revisión",
  profiles: "Perfiles",
  endpoints: "Endpoints",
  services: "Reglas de servicios en Bypass",
  working: "Procesando…",
};
const pt: FeatureMessages = {
  serviceChanges: "Regras DNS de serviços",
  add: "Adicionar",
  update: "Atualizar",
  remove: "Remover",
  recognitionTitle: "Reconhecer serviços",
  recognitionDescription:
    "Um perfil de consulta separado identifica um domínio sem interferência das regras personalizadas do perfil. É usado apenas para verificações no editor e no popup.",
  recognitionScope: `Cria um perfil e um endpoint de consulta com regras de serviços em Bypass. Mantenha o navegador no endpoint DNS regional; o endpoint de consulta não amplia a proteção do ${BRAND_DISPLAY_NAME}.`,
  preview: "Prévia da configuração",
  apply: "Aplicar configuração",
  ready: "Consulta pronta",
  notReady: "Consulta não configurada",
  stale: "A consulta precisa de revisão",
  profiles: "Perfis",
  endpoints: "Endpoints",
  services: "Regras de serviços em Bypass",
  working: "Processando…",
};
const ru: FeatureMessages = {
  serviceChanges: "DNS-правила сервисов",
  add: "Добавить",
  update: "Обновить",
  remove: "Удалить",
  recognitionTitle: "Распознавание сервисов",
  recognitionDescription:
    "Отдельный профиль запросов определяет домен без влияния пользовательских правил основного профиля. Он используется только для проверок из редактора и всплывающего окна.",
  recognitionScope: `Будут созданы профиль и конечная точка запросов с правилами сервисов Bypass. Сохраните региональную DNS-точку браузера; точка запросов не расширяет защиту ${BRAND_DISPLAY_NAME}.`,
  preview: "Предпросмотр настройки",
  apply: "Применить настройку",
  ready: "Запросы настроены",
  notReady: "Запросы не настроены",
  stale: "Настройку запросов нужно проверить",
  profiles: "Профили",
  endpoints: "Конечные точки",
  services: "Правила сервисов Bypass",
  working: "Обработка…",
};
const uk: FeatureMessages = {
  serviceChanges: "DNS-правила сервісів",
  add: "Додати",
  update: "Оновити",
  remove: "Видалити",
  recognitionTitle: "Розпізнавання сервісів",
  recognitionDescription:
    "Окремий профіль запитів визначає домен без впливу користувацьких правил основного профілю. Він використовується лише для перевірок із редактора та спливного вікна.",
  recognitionScope: `Буде створено профіль і кінцеву точку запитів із правилами сервісів Bypass. Збережіть регіональну DNS-точку браузера; точка запитів не розширює захист ${BRAND_DISPLAY_NAME}.`,
  preview: "Попередній перегляд",
  apply: "Застосувати налаштування",
  ready: "Запити налаштовано",
  notReady: "Запити не налаштовано",
  stale: "Налаштування запитів потребує перевірки",
  profiles: "Профілі",
  endpoints: "Кінцеві точки",
  services: "Правила сервісів Bypass",
  working: "Обробка…",
};
const catalogs = { en, es, pt, ru, uk };
export const featureText = createMessagesProxy(
  () => catalogs[getActiveUiLocale()],
) as FeatureMessages;
