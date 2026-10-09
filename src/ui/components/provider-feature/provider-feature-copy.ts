import type { FeatureSyncStatus, ProviderFeatureView } from "./model";

import { BRAND_DISPLAY_NAME } from "@/shared/brand";
import type { UiLocale } from "@/shared/ui-locale";

type Text = (value: string) => string;
type PairText = (first: string, second: string) => string;
type ScopeText = (feature: string, provider: string, pattern: string) => string;

export type ProviderFeatureMessages = {
  heading: string;
  status: Record<ProviderFeatureView, string>;
  summary: {
    idle: PairText;
    checking: PairText;
    suggested: PairText;
    unresolved: PairText;
    error: PairText;
    dismissed: Text;
    bound: PairText;
  };
  evidence: {
    label: string;
    domainTest: Text;
    manual: string;
    overridden: string;
    notChecked: string;
    checkedAt: Text;
  };
  local: { label: string; value: Text };
  sync: { label: Text; none: string } & Record<FeatureSyncStatus, string>;
  scope: { confirm: ScopeText; bound: ScopeText; recognize: PairText };
  actions: {
    recognize: Text;
    retry: string;
    confirm: string;
    confirmChoice: Text;
    chooseOther: string;
    chooseManual: string;
    change: string;
    cancel: string;
    dismiss: string;
    dismissLabel: Text;
    detach: string;
    detachLabel: PairText;
  };
  picker: { label: Text; placeholder: string; search: string; empty: string };
  busy: string;
};

const en: ProviderFeatureMessages = {
  heading: "DNS service",
  status: {
    idle: "Not checked",
    checking: "Checking",
    suggested: "Suggested",
    unresolved: "No match",
    error: "Check failed",
    dismissed: "Dismissed",
    bound: "Linked",
  },
  summary: {
    idle: (provider, host) =>
      `Ask ${provider} whether ${host} belongs to one of its services.`,
    checking: (provider, host) => `Checking ${host} with ${provider}…`,
    suggested: (feature, provider) => `Matched to ${feature} · ${provider}`,
    unresolved: (provider, host) => `${provider} has no service for ${host}.`,
    error: (provider, host) => `Couldn’t check ${host} with ${provider}.`,
    dismissed: (provider) => `${provider} suggestion dismissed.`,
    bound: (feature, provider) => `Linked to ${feature} · ${provider}`,
  },
  evidence: {
    label: "Match evidence",
    domainTest: (host) => `Domain test for ${host}`,
    manual: "Chosen manually",
    overridden: "A manual choice replaced the domain test",
    notChecked: "Not checked yet",
    checkedAt: (time) => `Checked ${time}`,
  },
  local: {
    label: `${BRAND_DISPLAY_NAME} protection`,
    value: (pattern) => `Stays on ${pattern}`,
  },
  sync: {
    label: (provider) => `${provider} rule`,
    none: "None — nothing changes until you confirm",
    queued: "Waiting to sync",
    syncing: "Syncing",
    synced: "In sync",
    error: "Sync failed",
  },
  scope: {
    confirm: (feature, provider, pattern) =>
      `Confirming turns on the ${feature} service rule in your ${provider} profile. ${provider} decides which domains it covers at the DNS level; ${BRAND_DISPLAY_NAME} protection still applies only to ${pattern}.`,
    bound: (feature, provider, pattern) =>
      `${provider} applies its ${feature} rule to the service’s own domains. ${BRAND_DISPLAY_NAME} protection applies only to ${pattern}.`,
    recognize: (provider, host) =>
      `Sends ${host} to ${provider}. Nothing changes until you confirm.`,
  },
  actions: {
    recognize: (provider) => `Check with ${provider}`,
    retry: "Check again",
    confirm: "Add DNS service rule",
    confirmChoice: (feature) => `Add DNS rule for ${feature}`,
    chooseOther: "Choose another service",
    chooseManual: "Choose a service",
    change: "Change service",
    cancel: "Cancel",
    dismiss: "Dismiss",
    dismissLabel: (feature) => `Dismiss the ${feature} suggestion`,
    detach: "Remove DNS service rule",
    detachLabel: (feature, provider) => `Remove the ${feature} rule from ${provider}`,
  },
  picker: {
    label: (provider) => `${provider} service`,
    placeholder: "Select a service",
    search: "Search services",
    empty: "No services found.",
  },
  busy: "Working…",
};

const es: ProviderFeatureMessages = {
  heading: "Servicio DNS",
  status: {
    idle: "Sin comprobar",
    checking: "Comprobando",
    suggested: "Sugerido",
    unresolved: "Sin coincidencia",
    error: "Error al comprobar",
    dismissed: "Descartado",
    bound: "Vinculado",
  },
  summary: {
    idle: (provider, host) =>
      `Pregunta a ${provider} si ${host} pertenece a uno de sus servicios.`,
    checking: (provider, host) => `Comprobando ${host} con ${provider}…`,
    suggested: (feature, provider) => `Coincide con ${feature} · ${provider}`,
    unresolved: (provider, host) =>
      `${provider} no tiene ningún servicio para ${host}.`,
    error: (provider, host) => `No se pudo comprobar ${host} con ${provider}.`,
    dismissed: (provider) => `Sugerencia de ${provider} descartada.`,
    bound: (feature, provider) => `Vinculado a ${feature} · ${provider}`,
  },
  evidence: {
    label: "Evidencia de coincidencia",
    domainTest: (host) => `Prueba de dominio para ${host}`,
    manual: "Elegido manualmente",
    overridden: "Una elección manual sustituyó a la prueba de dominio",
    notChecked: "Aún sin comprobar",
    checkedAt: (time) => `Comprobado: ${time}`,
  },
  local: {
    label: `Protección de ${BRAND_DISPLAY_NAME}`,
    value: (pattern) => `Sigue limitada a ${pattern}`,
  },
  sync: {
    label: (provider) => `Regla en ${provider}`,
    none: "Ninguna: nada cambia hasta que confirmes",
    queued: "Pendiente de sincronizar",
    syncing: "Sincronizando",
    synced: "Sincronizada",
    error: "Error de sincronización",
  },
  scope: {
    confirm: (feature, provider, pattern) =>
      `Al confirmar se activa la regla del servicio ${feature} en tu perfil de ${provider}. ${provider} decide qué dominios abarca a nivel de DNS; la protección de ${BRAND_DISPLAY_NAME} sigue aplicándose solo a ${pattern}.`,
    bound: (feature, provider, pattern) =>
      `${provider} aplica su regla de ${feature} a los dominios propios del servicio. La protección de ${BRAND_DISPLAY_NAME} se aplica solo a ${pattern}.`,
    recognize: (provider, host) =>
      `Envía ${host} a ${provider}. Nada cambia hasta que confirmes.`,
  },
  actions: {
    recognize: (provider) => `Comprobar con ${provider}`,
    retry: "Volver a comprobar",
    confirm: "Añadir regla de servicio DNS",
    confirmChoice: (feature) => `Añadir regla DNS para ${feature}`,
    chooseOther: "Elegir otro servicio",
    chooseManual: "Elegir un servicio",
    change: "Cambiar servicio",
    cancel: "Cancelar",
    dismiss: "Descartar",
    dismissLabel: (feature) => `Descartar la sugerencia ${feature}`,
    detach: "Quitar regla de servicio DNS",
    detachLabel: (feature, provider) => `Quitar la regla de ${feature} de ${provider}`,
  },
  picker: {
    label: (provider) => `Servicio de ${provider}`,
    placeholder: "Selecciona un servicio",
    search: "Buscar servicios",
    empty: "No se encontraron servicios.",
  },
  busy: "Procesando…",
};

const pt: ProviderFeatureMessages = {
  heading: "Serviço DNS",
  status: {
    idle: "Não verificado",
    checking: "Verificando",
    suggested: "Sugerido",
    unresolved: "Sem correspondência",
    error: "Falha na verificação",
    dismissed: "Dispensado",
    bound: "Vinculado",
  },
  summary: {
    idle: (provider, host) =>
      `Consulte ${provider} para saber se ${host} pertence a um de seus serviços.`,
    checking: (provider, host) => `Verificando ${host} em ${provider}…`,
    suggested: (feature, provider) => `Corresponde a ${feature} · ${provider}`,
    unresolved: (provider, host) => `${provider} não tem nenhum serviço para ${host}.`,
    error: (provider, host) => `Não foi possível verificar ${host} em ${provider}.`,
    dismissed: (provider) => `Sugestão de ${provider} dispensada.`,
    bound: (feature, provider) => `Vinculado a ${feature} · ${provider}`,
  },
  evidence: {
    label: "Evidência da correspondência",
    domainTest: (host) => `Teste de domínio para ${host}`,
    manual: "Escolhido manualmente",
    overridden: "Uma escolha manual substituiu o teste de domínio",
    notChecked: "Ainda não verificado",
    checkedAt: (time) => `Verificado: ${time}`,
  },
  local: {
    label: `Proteção do ${BRAND_DISPLAY_NAME}`,
    value: (pattern) => `Continua limitada a ${pattern}`,
  },
  sync: {
    label: (provider) => `Regra em ${provider}`,
    none: "Nenhuma: nada muda até você confirmar",
    queued: "Aguardando sincronização",
    syncing: "Sincronizando",
    synced: "Sincronizada",
    error: "Falha na sincronização",
  },
  scope: {
    confirm: (feature, provider, pattern) =>
      `Ao confirmar, a regra do serviço ${feature} é ativada no seu perfil de ${provider}. ${provider} decide quais domínios ela abrange no nível do DNS; a proteção do ${BRAND_DISPLAY_NAME} continua valendo apenas para ${pattern}.`,
    bound: (feature, provider, pattern) =>
      `${provider} aplica sua regra de ${feature} aos domínios do próprio serviço. A proteção do ${BRAND_DISPLAY_NAME} vale apenas para ${pattern}.`,
    recognize: (provider, host) =>
      `Envia ${host} para ${provider}. Nada muda até você confirmar.`,
  },
  actions: {
    recognize: (provider) => `Verificar em ${provider}`,
    retry: "Verificar novamente",
    confirm: "Adicionar regra de serviço DNS",
    confirmChoice: (feature) => `Adicionar regra DNS para ${feature}`,
    chooseOther: "Escolher outro serviço",
    chooseManual: "Escolher um serviço",
    change: "Alterar serviço",
    cancel: "Cancelar",
    dismiss: "Dispensar",
    dismissLabel: (feature) => `Dispensar a sugestão ${feature}`,
    detach: "Remover regra de serviço DNS",
    detachLabel: (feature, provider) => `Remover a regra de ${feature} de ${provider}`,
  },
  picker: {
    label: (provider) => `Serviço de ${provider}`,
    placeholder: "Selecione um serviço",
    search: "Pesquisar serviços",
    empty: "Nenhum serviço encontrado.",
  },
  busy: "Processando…",
};

const ru: ProviderFeatureMessages = {
  heading: "DNS-сервис",
  status: {
    idle: "Не проверено",
    checking: "Проверка",
    suggested: "Предложено",
    unresolved: "Нет совпадения",
    error: "Ошибка проверки",
    dismissed: "Скрыто",
    bound: "Привязано",
  },
  summary: {
    idle: (provider, host) =>
      `Узнать у ${provider}, относится ли ${host} к одному из его сервисов.`,
    checking: (provider, host) => `Проверяем ${host} в ${provider}…`,
    suggested: (feature, provider) => `Совпадение: ${feature} · ${provider}`,
    unresolved: (provider, host) => `В ${provider} нет сервиса для ${host}.`,
    error: (provider, host) => `Не удалось проверить ${host} в ${provider}.`,
    dismissed: (provider) => `Предложение ${provider} скрыто.`,
    bound: (feature, provider) => `Привязано: ${feature} · ${provider}`,
  },
  evidence: {
    label: "Основание совпадения",
    domainTest: (host) => `Проверка домена ${host}`,
    manual: "Выбрано вручную",
    overridden: "Ручной выбор заменил проверку домена",
    notChecked: "Ещё не проверялось",
    checkedAt: (time) => `Проверено: ${time}`,
  },
  local: {
    label: `Защита ${BRAND_DISPLAY_NAME}`,
    value: (pattern) => `Действует только для ${pattern}`,
  },
  sync: {
    label: (provider) => `Правило в ${provider}`,
    none: "Нет — ничего не изменится до подтверждения",
    queued: "Ожидает синхронизации",
    syncing: "Синхронизация",
    synced: "Синхронизировано",
    error: "Ошибка синхронизации",
  },
  scope: {
    confirm: (feature, provider, pattern) =>
      `После подтверждения в профиле ${provider} включится правило сервиса ${feature}. Какие домены оно охватывает на уровне DNS, решает ${provider}; защита ${BRAND_DISPLAY_NAME} по-прежнему действует только для ${pattern}.`,
    bound: (feature, provider, pattern) =>
      `${provider} применяет правило ${feature} к собственным доменам сервиса. Защита ${BRAND_DISPLAY_NAME} действует только для ${pattern}.`,
    recognize: (provider, host) =>
      `${host} будет отправлен в ${provider}. Ничего не изменится до подтверждения.`,
  },
  actions: {
    recognize: (provider) => `Проверить в ${provider}`,
    retry: "Проверить снова",
    confirm: "Добавить DNS-правило сервиса",
    confirmChoice: (feature) => `Добавить DNS-правило для ${feature}`,
    chooseOther: "Выбрать другой сервис",
    chooseManual: "Выбрать сервис",
    change: "Изменить сервис",
    cancel: "Отмена",
    dismiss: "Скрыть",
    dismissLabel: (feature) => `Скрыть предложение ${feature}`,
    detach: "Удалить DNS-правило сервиса",
    detachLabel: (feature, provider) => `Удалить правило ${feature} из ${provider}`,
  },
  picker: {
    label: (provider) => `Сервис ${provider}`,
    placeholder: "Выберите сервис",
    search: "Поиск сервисов",
    empty: "Сервисы не найдены.",
  },
  busy: "Выполняется…",
};

const uk: ProviderFeatureMessages = {
  heading: "DNS-сервіс",
  status: {
    idle: "Не перевірено",
    checking: "Перевірка",
    suggested: "Запропоновано",
    unresolved: "Немає збігу",
    error: "Помилка перевірки",
    dismissed: "Приховано",
    bound: "Прив’язано",
  },
  summary: {
    idle: (provider, host) =>
      `Дізнатися в ${provider}, чи належить ${host} до одного з його сервісів.`,
    checking: (provider, host) => `Перевіряємо ${host} у ${provider}…`,
    suggested: (feature, provider) => `Збіг: ${feature} · ${provider}`,
    unresolved: (provider, host) => `У ${provider} немає сервісу для ${host}.`,
    error: (provider, host) => `Не вдалося перевірити ${host} у ${provider}.`,
    dismissed: (provider) => `Пропозицію ${provider} приховано.`,
    bound: (feature, provider) => `Прив’язано: ${feature} · ${provider}`,
  },
  evidence: {
    label: "Підстава збігу",
    domainTest: (host) => `Перевірка домену ${host}`,
    manual: "Вибрано вручну",
    overridden: "Ручний вибір замінив перевірку домену",
    notChecked: "Ще не перевірялося",
    checkedAt: (time) => `Перевірено: ${time}`,
  },
  local: {
    label: `Захист ${BRAND_DISPLAY_NAME}`,
    value: (pattern) => `Діє лише для ${pattern}`,
  },
  sync: {
    label: (provider) => `Правило в ${provider}`,
    none: "Немає — нічого не зміниться до підтвердження",
    queued: "Очікує синхронізації",
    syncing: "Синхронізація",
    synced: "Синхронізовано",
    error: "Помилка синхронізації",
  },
  scope: {
    confirm: (feature, provider, pattern) =>
      `Після підтвердження в профілі ${provider} увімкнеться правило сервісу ${feature}. Які домени воно охоплює на рівні DNS, вирішує ${provider}; захист ${BRAND_DISPLAY_NAME} і далі діє лише для ${pattern}.`,
    bound: (feature, provider, pattern) =>
      `${provider} застосовує правило ${feature} до власних доменів сервісу. Захист ${BRAND_DISPLAY_NAME} діє лише для ${pattern}.`,
    recognize: (provider, host) =>
      `${host} буде надіслано в ${provider}. Нічого не зміниться до підтвердження.`,
  },
  actions: {
    recognize: (provider) => `Перевірити в ${provider}`,
    retry: "Перевірити знову",
    confirm: "Додати DNS-правило сервісу",
    confirmChoice: (feature) => `Додати DNS-правило для ${feature}`,
    chooseOther: "Вибрати інший сервіс",
    chooseManual: "Вибрати сервіс",
    change: "Змінити сервіс",
    cancel: "Скасувати",
    dismiss: "Приховати",
    dismissLabel: (feature) => `Приховати пропозицію ${feature}`,
    detach: "Видалити DNS-правило сервісу",
    detachLabel: (feature, provider) => `Видалити правило ${feature} з ${provider}`,
  },
  picker: {
    label: (provider) => `Сервіс ${provider}`,
    placeholder: "Виберіть сервіс",
    search: "Пошук сервісів",
    empty: "Сервісів не знайдено.",
  },
  busy: "Виконується…",
};

export const providerFeatureCopy: Record<UiLocale, ProviderFeatureMessages> = {
  en,
  es,
  pt,
  ru,
  uk,
};
