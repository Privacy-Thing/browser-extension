import { BRAND_DISPLAY_NAME } from "@/shared/brand";
import type { UiLocale } from "@/shared/ui-locale";

type ExplanationMessages = {
  serviceRules: string;
  customRules: string;
  service: string;
  scope: string;
  joining: string;
  tooltip: string;
  fallback: string;
  ready: string;
  excluded: string;
  paused: string;
  pending: string;
  noPreset: string;
  disabled: string;
  preset: string;
  routes: string;
  settings: string;
};

export const explanationCopy: Record<UiLocale, ExplanationMessages> = {
  en: {
    serviceRules: "Service Rules",
    customRules: "Custom Rules",
    service: "service",
    scope: `{term} in Control D usually cover more domains than this rule. ${BRAND_DISPLAY_NAME} can set up a {feature} {service} redirect in Control D.`,
    joining:
      "{feature} already has a linked rule. Adding this pattern reuses its Control D service redirect.",
    tooltip: `A Service Rule covers a group of domains maintained by Control D. A Custom Rule applies to a specified domain or pattern and takes priority over a Service Rule. Linking a service does not extend ${BRAND_DISPLAY_NAME} protection beyond this rule's patterns.`,
    fallback: `Saving creates {term} for these patterns. Include the service to add a Service Rule.`,
    ready: "Skip sync for {preset} in ",
    excluded: `{preset} is excluded from Control D sync. ${BRAND_DISPLAY_NAME} will not create domain or service redirects for this preset. Change this in `,
    paused: `Automatic sync is off. Saving keeps the link in ${BRAND_DISPLAY_NAME} without updating Control D. Change this in `,
    pending: "Review the Control D exit for {preset} before syncing this rule in ",
    noPreset:
      "Choose a Regional Preset to sync redirects with Control D. Manage sync in ",
    disabled: `This rule is disabled. Its ${BRAND_DISPLAY_NAME}-managed redirects will be removed on the next sync. Manage sync in `,
    preset: "Regional preset",
    routes: "Route overrides",
    settings: "Control D settings",
  },
  es: {
    serviceRules: "Reglas de servicio",
    customRules: "Custom Rules",
    service: "servicio",
    scope: `Las {term} de Control D suelen cubrir más dominios que esta regla. ${BRAND_DISPLAY_NAME} puede configurar una redirección del {service} {feature} en Control D.`,
    joining:
      "{feature} ya tiene una regla vinculada. Añadir este patrón reutiliza su redirección de servicio en Control D.",
    tooltip: `Una regla de servicio cubre un grupo de dominios mantenido por Control D. Una Custom Rule se aplica a un dominio o patrón y tiene prioridad sobre la regla de servicio. Vincular un servicio no amplía la protección de ${BRAND_DISPLAY_NAME} más allá de los patrones de esta regla.`,
    fallback: `Al guardar se crean {term} para estos patrones. Incluir el servicio añade una regla de servicio.`,
    ready: "Excluye de la sincronización {preset} en ",
    excluded: `{preset} está excluido de la sincronización con Control D. ${BRAND_DISPLAY_NAME} no creará redirecciones de dominios ni servicios para este preset. Cámbialo en `,
    paused: `La sincronización automática está desactivada. Guardar mantiene el vínculo en ${BRAND_DISPLAY_NAME} sin actualizar Control D. Cámbialo en `,
    pending:
      "Revisa la salida de Control D para {preset} antes de sincronizar esta regla en ",
    noPreset:
      "Elige un preset regional para sincronizar redirecciones con Control D. Gestiona la sincronización en ",
    disabled: `Esta regla está desactivada. Sus redirecciones gestionadas por ${BRAND_DISPLAY_NAME} se eliminarán en la próxima sincronización. Gestiona la sincronización en `,
    preset: "Preset regional",
    routes: "Rutas personalizadas",
    settings: "Ajustes de Control D",
  },
  pt: {
    serviceRules: "Regras de serviço",
    customRules: "Custom Rules",
    service: "serviço",
    scope: `As {term} do Control D costumam abranger mais domínios que esta regra. O ${BRAND_DISPLAY_NAME} pode configurar um redirecionamento do {service} {feature} no Control D.`,
    joining:
      "{feature} já tem uma regra vinculada. Adicionar este padrão reutiliza seu redirecionamento de serviço no Control D.",
    tooltip: `Uma regra de serviço abrange um grupo de domínios mantido pelo Control D. Uma Custom Rule se aplica a um domínio ou padrão e tem prioridade sobre a regra de serviço. Vincular um serviço não estende a proteção do ${BRAND_DISPLAY_NAME} além dos padrões desta regra.`,
    fallback: `Salvar cria {term} para estes padrões. Incluir o serviço adiciona uma regra de serviço.`,
    ready: "Exclua {preset} da sincronização em ",
    excluded: `{preset} está excluído da sincronização com o Control D. O ${BRAND_DISPLAY_NAME} não criará redirecionamentos de domínios ou serviços para este preset. Altere em `,
    paused: `A sincronização automática está desligada. Salvar mantém o vínculo no ${BRAND_DISPLAY_NAME} sem atualizar o Control D. Altere em `,
    pending:
      "Revise a saída do Control D para {preset} antes de sincronizar esta regra em ",
    noPreset:
      "Escolha um preset regional para sincronizar redirecionamentos com o Control D. Gerencie a sincronização em ",
    disabled: `Esta regra está desligada. Seus redirecionamentos gerenciados pelo ${BRAND_DISPLAY_NAME} serão removidos na próxima sincronização. Gerencie a sincronização em `,
    preset: "Preset regional",
    routes: "Rotas personalizadas",
    settings: "Configurações do Control D",
  },
  ru: {
    serviceRules: "Правила сервисов",
    customRules: "Custom Rules",
    service: "сервиса",
    scope: `{term} Control D обычно охватывают больше доменов, чем это правило. ${BRAND_DISPLAY_NAME} может настроить перенаправление {service} {feature} в Control D.`,
    joining:
      "Для {feature} уже есть связанное правило. Этот шаблон будет использовать его перенаправление сервиса в Control D.",
    tooltip: `Правило сервиса охватывает группу доменов, которую поддерживает Control D. Custom Rule применяется к указанному домену или шаблону и имеет приоритет над правилом сервиса. Привязка сервиса не расширяет защиту ${BRAND_DISPLAY_NAME} за пределы шаблонов этого правила.`,
    fallback: `Сохранение создаёт {term} для этих шаблонов. Подключение сервиса добавляет правило сервиса.`,
    ready: "Исключить {preset} из синхронизации можно в ",
    excluded: `{preset} исключён из синхронизации с Control D. ${BRAND_DISPLAY_NAME} не создаст перенаправления доменов или сервисов для этого пресета. Измените это в `,
    paused: `Автоматическая синхронизация отключена. Сохранение оставит привязку в ${BRAND_DISPLAY_NAME} без обновления Control D. Измените это в `,
    pending: "Проверьте выход Control D для {preset} перед синхронизацией правила в ",
    noPreset:
      "Выберите региональный пресет для синхронизации перенаправлений с Control D. Управление синхронизацией — в ",
    disabled: `Правило отключено. Его перенаправления, управляемые ${BRAND_DISPLAY_NAME}, будут удалены при следующей синхронизации. Управление синхронизацией — в `,
    preset: "Региональный пресет",
    routes: "Настройки маршрутов",
    settings: "Настройки Control D",
  },
  uk: {
    serviceRules: "Правила сервісів",
    customRules: "Custom Rules",
    service: "сервісу",
    scope: `{term} Control D зазвичай охоплюють більше доменів, ніж це правило. ${BRAND_DISPLAY_NAME} може налаштувати перенаправлення {service} {feature} у Control D.`,
    joining:
      "Для {feature} уже є пов’язане правило. Цей шаблон використовуватиме його перенаправлення сервісу в Control D.",
    tooltip: `Правило сервісу охоплює групу доменів, яку підтримує Control D. Custom Rule застосовується до вказаного домену або шаблону та має пріоритет над правилом сервісу. Прив'язка сервісу не розширює захист ${BRAND_DISPLAY_NAME} за межі шаблонів цього правила.`,
    fallback: `Збереження створює {term} для цих шаблонів. Підключення сервісу додає правило сервісу.`,
    ready: "Виключити {preset} із синхронізації можна в ",
    excluded: `{preset} виключено із синхронізації з Control D. ${BRAND_DISPLAY_NAME} не створить перенаправлення доменів чи сервісів для цього пресета. Змініть це в `,
    paused: `Автоматичну синхронізацію вимкнено. Збереження залишить прив'язку в ${BRAND_DISPLAY_NAME} без оновлення Control D. Змініть це в `,
    pending: "Перевірте вихід Control D для {preset} перед синхронізацією правила в ",
    noPreset:
      "Виберіть регіональний пресет для синхронізації перенаправлень із Control D. Керування синхронізацією — у ",
    disabled: `Правило вимкнено. Його перенаправлення, керовані ${BRAND_DISPLAY_NAME}, буде видалено під час наступної синхронізації. Керування синхронізацією — у `,
    preset: "Регіональний пресет",
    routes: "Налаштування маршрутів",
    settings: "Налаштування Control D",
  },
};
