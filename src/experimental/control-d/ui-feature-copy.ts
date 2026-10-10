import { BRAND_DISPLAY_NAME } from "@/shared/brand";
import { createMessagesProxy, getActiveUiLocale } from "@/ui/i18n";

const en = {
  serviceChanges: "DNS service rules",
  add: "Add",
  update: "Update",
  remove: "Remove",
  automaticMatching: `When you add or edit a domain rule, ${BRAND_DISPLAY_NAME} suggests a matching Control D service. ${BRAND_DISPLAY_NAME} protects only your rule's domains; a Control D service may cover others.`,
};
type FeatureMessages = typeof en;
const es: FeatureMessages = {
  serviceChanges: "Reglas DNS de servicios",
  add: "Añadir",
  update: "Actualizar",
  remove: "Eliminar",
  automaticMatching: `Al añadir o editar una regla de dominio, ${BRAND_DISPLAY_NAME} sugiere un servicio de Control D. ${BRAND_DISPLAY_NAME} protege solo los dominios de tus reglas; un servicio de Control D puede cubrir otros.`,
};
const pt: FeatureMessages = {
  serviceChanges: "Regras DNS de serviços",
  add: "Adicionar",
  update: "Atualizar",
  remove: "Remover",
  automaticMatching: `Ao adicionar ou editar uma regra de domínio, o ${BRAND_DISPLAY_NAME} sugere um serviço do Control D. O ${BRAND_DISPLAY_NAME} protege só os domínios das suas regras; um serviço do Control D pode abranger outros.`,
};
const ru: FeatureMessages = {
  serviceChanges: "DNS-правила сервисов",
  add: "Добавить",
  update: "Обновить",
  remove: "Удалить",
  automaticMatching: `При добавлении или изменении правила домена ${BRAND_DISPLAY_NAME} предложит подходящий сервис Control D. ${BRAND_DISPLAY_NAME} защищает только домены из ваших правил; сервис Control D может охватывать и другие.`,
};
const uk: FeatureMessages = {
  serviceChanges: "DNS-правила сервісів",
  add: "Додати",
  update: "Оновити",
  remove: "Видалити",
  automaticMatching: `Під час додавання чи зміни правила домену ${BRAND_DISPLAY_NAME} запропонує відповідний сервіс Control D. ${BRAND_DISPLAY_NAME} захищає лише домени з ваших правил; сервіс Control D може охоплювати й інші.`,
};
const catalogs = { en, es, pt, ru, uk };
export const featureText = createMessagesProxy(
  () => catalogs[getActiveUiLocale()],
) as FeatureMessages;
