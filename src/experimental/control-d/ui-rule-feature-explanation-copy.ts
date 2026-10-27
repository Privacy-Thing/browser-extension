import { BRAND_DISPLAY_NAME } from "@/shared/brand";
import type { UiLocale } from "@/shared/ui-locale";

type ExplanationMessages = {
  /** Joins the fallback sentence to the next one. */
  sentenceGap: string;
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
    sentenceGap: " ",
    serviceRules: "Service Rules",
    customRules: "Custom Rules",
    service: "service",
    scope: `{term} in Control D usually cover more domains than this rule. ${BRAND_DISPLAY_NAME} can set up a {feature} {service} redirect in Control D.`,
    joining: `{feature} is already linked to another ${BRAND_DISPLAY_NAME} rule. Adding this pattern shares its Control D configuration.`,
    tooltip: `A Service Rule covers a group of domains maintained by Control D. A Custom Rule applies to a specified domain or pattern and takes priority over a Service Rule. Linking a service does not extend ${BRAND_DISPLAY_NAME} protection beyond this rule's patterns.`,
    fallback: `Saving creates {term} for these patterns. Include the service to add a Service Rule.`,
    ready: "To change the redirect location or skip sync for {preset}, open {link}.",
    excluded:
      "{preset} is excluded from Control D sync. No domain or service redirects will be created for this preset. To include it, choose a redirect location in {link}.",
    paused: `Automatic sync is off. Saving keeps the link in ${BRAND_DISPLAY_NAME} without updating Control D. Turn on automatic sync in {link}.`,
    pending:
      "Choose or confirm the Control D proxy location (city/country) for {preset} in {link} before this rule can sync.",
    noPreset:
      "Assign a Regional Preset to this rule before syncing redirects with Control D. Configure its redirect location in {link}.",
    disabled: `This rule is off. On the next sync, ${BRAND_DISPLAY_NAME} removes its managed redirects for this rule from the Control D profile. Manage syncing in {link}.`,
    preset: "Regional preset",
    routes: "Control D settings → Route overrides",
    settings: "Control D settings",
  },
  es: {
    sentenceGap: " ",
    serviceRules: "Reglas de servicio",
    customRules: "Custom Rules",
    service: "servicio",
    scope: `Las {term} de Control D suelen cubrir más dominios que esta regla. ${BRAND_DISPLAY_NAME} puede configurar una redirección del {service} {feature} en Control D.`,
    joining: `{feature} ya está vinculado a otra regla de ${BRAND_DISPLAY_NAME}. Añadir este patrón comparte su configuración de Control D.`,
    tooltip: `Una regla de servicio cubre un grupo de dominios mantenido por Control D. Una Custom Rule se aplica a un dominio o patrón y tiene prioridad sobre la regla de servicio. Vincular un servicio no amplía la protección de ${BRAND_DISPLAY_NAME} más allá de los patrones de esta regla.`,
    fallback: `Al guardar se crean {term} para estos patrones. Incluir el servicio añade una regla de servicio.`,
    ready:
      "Para cambiar el destino de redirección o excluir {preset} de la sincronización, abre {link}.",
    excluded:
      "{preset} está excluido de la sincronización con Control D. No se crearán redirecciones de dominios ni servicios para este preset. Para incluirlo, elige un destino de redirección en {link}.",
    paused: `La sincronización automática está desactivada. Guardar mantiene el vínculo en ${BRAND_DISPLAY_NAME} sin actualizar Control D. Activa la sincronización automática en {link}.`,
    pending:
      "Elige o confirma la ubicación del proxy de Control D (ciudad/país) para {preset} en {link} antes de sincronizar esta regla.",
    noPreset:
      "Asigna un preset regional a esta regla antes de sincronizar redirecciones con Control D. Configura su destino de redirección en {link}.",
    disabled: `Esta regla está desactivada. En la próxima sincronización, ${BRAND_DISPLAY_NAME} eliminará del perfil de Control D las redirecciones que gestiona para esta regla. Gestiona la sincronización en {link}.`,
    preset: "Preset regional",
    routes: "Ajustes de Control D → Rutas personalizadas",
    settings: "Ajustes de Control D",
  },
  pt: {
    sentenceGap: " ",
    serviceRules: "Regras de serviço",
    customRules: "Custom Rules",
    service: "serviço",
    scope: `As {term} do Control D costumam abranger mais domínios que esta regra. O ${BRAND_DISPLAY_NAME} pode configurar um redirecionamento do {service} {feature} no Control D.`,
    joining: `{feature} já está vinculado a outra regra do ${BRAND_DISPLAY_NAME}. Adicionar este padrão compartilha sua configuração do Control D.`,
    tooltip: `Uma regra de serviço abrange um grupo de domínios mantido pelo Control D. Uma Custom Rule se aplica a um domínio ou padrão e tem prioridade sobre a regra de serviço. Vincular um serviço não estende a proteção do ${BRAND_DISPLAY_NAME} além dos padrões desta regra.`,
    fallback: `Salvar cria {term} para estes padrões. Incluir o serviço adiciona uma regra de serviço.`,
    ready:
      "Para alterar o destino do redirecionamento ou excluir {preset} da sincronização, abra {link}.",
    excluded:
      "{preset} está excluído da sincronização com o Control D. Não serão criados redirecionamentos de domínios ou serviços para este preset. Para incluí-lo, escolha um destino de redirecionamento em {link}.",
    paused: `A sincronização automática está desligada. Salvar mantém o vínculo no ${BRAND_DISPLAY_NAME} sem atualizar o Control D. Ative a sincronização automática em {link}.`,
    pending:
      "Escolha ou confirme a localização do proxy do Control D (cidade/país) para {preset} em {link} antes de sincronizar esta regra.",
    noPreset:
      "Atribua um preset regional a esta regra antes de sincronizar redirecionamentos com o Control D. Configure seu destino de redirecionamento em {link}.",
    disabled: `Esta regra está desligada. Na próxima sincronização, o ${BRAND_DISPLAY_NAME} removerá do perfil do Control D os redirecionamentos que gerencia para esta regra. Gerencie a sincronização em {link}.`,
    preset: "Preset regional",
    routes: "Configurações do Control D → Rotas personalizadas",
    settings: "Configurações do Control D",
  },
  ru: {
    sentenceGap: " ",
    serviceRules: "Правила сервисов",
    customRules: "Custom Rules",
    service: "сервиса",
    scope: `{term} Control D обычно охватывают больше доменов, чем это правило. ${BRAND_DISPLAY_NAME} может настроить перенаправление {service} {feature} в Control D.`,
    joining: `{feature} уже связан с другим правилом ${BRAND_DISPLAY_NAME}. Этот шаблон будет использовать его конфигурацию Control D.`,
    tooltip: `Правило сервиса охватывает группу доменов, которую поддерживает Control D. Custom Rule применяется к указанному домену или шаблону и имеет приоритет над правилом сервиса. Привязка сервиса не расширяет защиту ${BRAND_DISPLAY_NAME} за пределы шаблонов этого правила.`,
    fallback: `Сохранение создаёт {term} для этих шаблонов. Подключение сервиса добавляет правило сервиса.`,
    ready:
      "Чтобы изменить место перенаправления или исключить {preset} из синхронизации, откройте {link}.",
    excluded:
      "{preset} исключён из синхронизации с Control D. Перенаправления доменов и сервисов для этого пресета не будут созданы. Чтобы включить его, выберите место перенаправления в {link}.",
    paused: `Автоматическая синхронизация отключена. Сохранение оставит привязку в ${BRAND_DISPLAY_NAME} без обновления Control D. Включите автоматическую синхронизацию в {link}.`,
    pending:
      "Выберите или подтвердите расположение прокси Control D (город/страну) для {preset} в {link} перед синхронизацией правила.",
    noPreset:
      "Назначьте правилу региональный пресет перед синхронизацией перенаправлений с Control D. Настройте место перенаправления в {link}.",
    disabled: `Правило отключено. При следующей синхронизации ${BRAND_DISPLAY_NAME} удалит из профиля Control D перенаправления этого правила, которыми он управляет. Управление синхронизацией — в {link}.`,
    preset: "Региональный пресет",
    routes: "Настройки Control D → Настройки маршрутов",
    settings: "Настройки Control D",
  },
  uk: {
    sentenceGap: " ",
    serviceRules: "Правила сервісів",
    customRules: "Custom Rules",
    service: "сервісу",
    scope: `{term} Control D зазвичай охоплюють більше доменів, ніж це правило. ${BRAND_DISPLAY_NAME} може налаштувати перенаправлення {service} {feature} у Control D.`,
    joining: `{feature} уже пов’язаний з іншим правилом ${BRAND_DISPLAY_NAME}. Цей шаблон використовуватиме його конфігурацію Control D.`,
    tooltip: `Правило сервісу охоплює групу доменів, яку підтримує Control D. Custom Rule застосовується до вказаного домену або шаблону та має пріоритет над правилом сервісу. Прив'язка сервісу не розширює захист ${BRAND_DISPLAY_NAME} за межі шаблонів цього правила.`,
    fallback: `Збереження створює {term} для цих шаблонів. Підключення сервісу додає правило сервісу.`,
    ready:
      "Щоб змінити місце перенаправлення або виключити {preset} із синхронізації, відкрийте {link}.",
    excluded:
      "{preset} виключено із синхронізації з Control D. Перенаправлення доменів і сервісів для цього пресета не будуть створені. Щоб увімкнути його, виберіть місце перенаправлення в {link}.",
    paused: `Автоматичну синхронізацію вимкнено. Збереження залишить прив’язку в ${BRAND_DISPLAY_NAME} без оновлення Control D. Увімкніть автоматичну синхронізацію в {link}.`,
    pending:
      "Виберіть або підтвердьте розташування проксі Control D (місто/країну) для {preset} у {link} перед синхронізацією правила.",
    noPreset:
      "Призначте правилу регіональний пресет перед синхронізацією перенаправлень із Control D. Налаштуйте місце перенаправлення в {link}.",
    disabled: `Правило вимкнено. Під час наступної синхронізації ${BRAND_DISPLAY_NAME} видалить із профілю Control D перенаправлення цього правила, якими він керує. Керування синхронізацією — у {link}.`,
    preset: "Регіональний пресет",
    routes: "Налаштування Control D → Налаштування маршрутів",
    settings: "Налаштування Control D",
  },
  "zh-CN": {
    sentenceGap: "",
    serviceRules: "服务规则",
    customRules: "自定义规则",
    service: "服务",
    scope: `Control D 中的{term}通常涵盖比此规则更多的域名。${BRAND_DISPLAY_NAME} 可以在 Control D 中设置 {feature} {service}重定向。`,
    joining: `{feature} 已关联到另一条 ${BRAND_DISPLAY_NAME} 规则。添加此匹配模式将共享其 Control D 配置。`,
    tooltip: `服务规则涵盖由 Control D 维护的一组域名。自定义规则适用于指定的域名或匹配模式，并优先于服务规则。关联服务不会将 ${BRAND_DISPLAY_NAME} 的保护扩展到此规则的匹配模式之外。`,
    fallback: `保存后将为这些匹配模式创建{term}。包括该服务即可添加服务规则。`,
    ready: "如需更改 {preset} 的重定向位置或将其排除在同步之外，请打开 {link}。",
    excluded:
      "{preset} 已从 Control D 同步中排除。不会为此预设创建域名或服务重定向。如需包括它，请在 {link} 中选择重定向位置。",
    paused: `自动同步已关闭。保存后会在 ${BRAND_DISPLAY_NAME} 中保留关联，但不会更新 Control D。请在 {link} 中开启自动同步。`,
    pending:
      "请先在 {link} 中为 {preset} 选择或确认 Control D 代理位置（城市/国家），此规则才能同步。",
    noPreset:
      "与 Control D 同步重定向之前，请为此规则分配区域预设。请在 {link} 中配置其重定向位置。",
    disabled: `此规则已关闭。下次同步时，${BRAND_DISPLAY_NAME} 会从 Control D 配置文件中移除此规则的受管理重定向。请在 {link} 中管理同步。`,
    preset: "区域预设",
    routes: "Control D 设置 → 路由覆盖",
    settings: "Control D 设置",
  },
  "zh-TW": {
    sentenceGap: "",
    serviceRules: "服務規則",
    customRules: "自訂規則",
    service: "服務",
    scope: `Control D 中的{term}涵蓋的網域通常比此規則多。${BRAND_DISPLAY_NAME} 可以在 Control D 中設定 {feature} {service}的重新導向。`,
    joining: `{feature} 已連結至另一條 ${BRAND_DISPLAY_NAME} 規則。加入此比對模式會共用其 Control D 設定。`,
    tooltip: `服務規則涵蓋由 Control D 維護的一組網域。自訂規則適用於指定的網域或比對模式，並優先於服務規則。連結服務不會將 ${BRAND_DISPLAY_NAME} 的保護延伸到此規則的比對模式之外。`,
    fallback: `儲存時會為這些比對模式建立{term}。包含此服務即可新增服務規則。`,
    ready: "若要變更 {preset} 的重新導向位置，或將其排除在同步之外，請開啟 {link}。",
    excluded:
      "{preset} 已排除在 Control D 同步之外。不會為此預設集建立任何網域或服務重新導向。若要包含它，請在 {link}中選擇重新導向位置。",
    paused: `自動同步已關閉。儲存時會在 ${BRAND_DISPLAY_NAME} 中保留連結，但不會更新 Control D。請在 {link}中開啟自動同步。`,
    pending:
      "此規則同步前，請在 {link}中為 {preset} 選擇或確認 Control D 代理位置（城市／國家）。",
    noPreset:
      "與 Control D 同步重新導向前，請先為此規則指派地區預設集。請在 {link}中設定其重新導向位置。",
    disabled: `此規則已關閉。下次同步時，${BRAND_DISPLAY_NAME} 會從 Control D 設定檔中移除它為此規則管理的重新導向。請在 {link}中管理同步。`,
    preset: "地區預設集",
    routes: "Control D 設定 → 路由覆寫",
    settings: "Control D 設定",
  },
};
