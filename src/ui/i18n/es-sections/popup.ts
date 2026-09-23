import type { SurfacePresentationState } from "@privacy-brand/xray-protocol";

import { BRAND_DIAGNOSTICS_NAME, BRAND_DISPLAY_NAME } from "@/shared/brand";

const formatCount = (count: number, singular: string, plural: string): string =>
  `${count} ${count === 1 ? singular : plural}`;

export const popup = {
  loading: "Cargando…",
  protectionProtected: "Protegido",
  protectionOff: "Protecciones desactivadas",
  protectionDisabled: "Protecciones desactivadas",
  protectionNeedsAttention: "Necesita atención",
  protectionUnknown: "Estado de protección no disponible",
  protectionSourceSiteRule: "Regla de dominio",
  protectionSourceContainer: "Contenedor de Firefox",
  protectionSourceDefaultRule: "Regla predeterminada",
  protectionSourceTrustedSite: "Sitio de confianza",
  protectionSourceNone: "Sin regla activa",
  protectionSourceGlobalSetting: "Configuración global",
  languagePriorityTooltip: (languages: readonly string[]) =>
    [
      "Prioridad de idioma:",
      ...languages.map((language, index) => `${index + 1}. ${language}`),
    ].join("\n"),
  protectionViewDetails: "Ver detalles",
  protectionViewPageActivity: "Ver actividad de la página",
  protectionDetailsTitle: "Detalles de protección",
  protectionDetailsLead: `Consulta cómo gestiona ${BRAND_DISPLAY_NAME} cada función del navegador en este sitio.`,
  protectionGroupLocationLocale: "Ubicación, hora y configuración regional",
  protectionGroupBrowserIdentity: "Identidad del navegador",
  protectionGroupRenderingMedia: "Renderizado y medios",
  protectionGroupWorkers: "Web Workers",
  protectionStateProtected: "Protegido",
  protectionStateDegraded: "Degradado",
  protectionStateNative: "No modificado",
  protectionStateMixed: "Mixto",
  protectionStatePending: "Confirmando…",
  protectionStateRepaired: "Protección restaurada",
  protectionStateBrowserEnforced: "Protegido por el navegador",
  protectionStateUnrecoverable: "Protección fallida",
  protectionStateNotApplicable: "No aplicable",
  protectionStateCompatibility: "Problema de compatibilidad",
  protectionSurfaceUnknown: (surface: string) => `Estado desconocido de ${surface}.`,
  protectionPageMayNotWork: "Esta página puede no funcionar correctamente",
  protectionServiceWorkerBlockTitle: "Los Service Workers están bloqueados",
  protectionServiceWorkerBlockSummary: `${BRAND_DISPLAY_NAME} está bloqueando el registro de Service Worker en este sitio.`,
  protectionServiceWorkerBlockDescription:
    "El modo fuera de línea, las notificaciones push, la sincronización en segundo plano y otras funciones de Service Worker pueden no funcionar mientras el bloqueo esté activado.",
  protectionSharedWorkerStrictTitle: "El modo estricto de Shared Worker está activado",
  protectionSharedWorkerStrictSummary: `${BRAND_DISPLAY_NAME} bloquea cualquier Shared Worker cuya protección no pueda confirmar antes de iniciarlo.`,
  protectionSharedWorkerStrictDescription:
    "La sincronización entre pestañas, las conexiones compartidas y la colaboración en vivo pueden no funcionar mientras el modo estricto esté activado.",
  notificationsTitle: "Notificaciones",
  notificationsThisSite: "Este sitio",
  notificationsExtension: BRAND_DISPLAY_NAME,
  notificationsPreviousUpdates: "Actualizaciones anteriores",
  notificationsDismissed: "Descartado",
  notificationsResolved: "Resuelto",
  notificationsNew: "Nuevo",
  notificationsAcknowledged: "Leído",
  notificationsStillActive: "Necesita atención",
  notificationsEmpty: "No hay notificaciones activas.",
  notificationsDismiss: "Descartar",
  notificationsKeepStrictMode: "Mantener el modo estricto",
  notificationsWhatThisAffects: "Lo que esto afecta",
  notificationsBeforeYouContinue: "Antes de continuar",
  notificationsChooseSharedWorkerMode:
    "Elige cómo se ejecutan los Shared Workers en este sitio",
  notificationsCspTitle: "El sitio ha bloqueado la protección de workers",
  notificationsCspSummary: `${BRAND_DISPLAY_NAME} no ha podido proteger un worker en este sitio.`,
  notificationsSharedWorkerTitle: "No se ha podido proteger un Shared Worker",
  notificationsSharedWorkerSummary: `${BRAND_DISPLAY_NAME} no ha podido aplicar los valores simulados antes de que se iniciara un Shared Worker.`,
  notificationsRelaxWorkerPolicy: "Permitir la simulación de workers",
  notificationsAllowServiceWorkers: "Permitir Service Workers",
  notificationsSharedWorkerNative: "Nativo",
  notificationsSharedWorkerNativeDescription: `Ejecuta los Shared Workers con normalidad, sin la protección de ${BRAND_DISPLAY_NAME}. Ofrece la máxima compatibilidad, pero un worker puede leer los valores reales del navegador.`,
  notificationsSharedWorkerSpoof: "Simular",
  notificationsSharedWorkerSpoofDescription: `Intenta un método de protección alternativo para Shared Workers. Algunos workers aún pueden fallar al iniciarse.`,
  notificationsUpdateTitle: `${BRAND_DISPLAY_NAME} fue actualizado`,
  notificationsUpdateSummary: "Revisa los cambios en esta versión.",
  notificationsVersionLabel: "Versión",
  notificationsOpenLink: "Abrir enlace",
  notificationsBadgeLabel: (count: number) =>
    formatCount(count, "notificación no leída", "notificaciones no leídas"),
  protectionCounts: (counts: Record<SurfacePresentationState, number>) => {
    // Roll the 9 presentation states up into the buckets a one-line summary
    // can carry without becoming unreadable. `browser-enforced`/`repaired`
    // are protected-like; `unrecoverable` folds into the degraded bucket.
    const protectedCount =
      counts.protected + counts["browser-enforced"] + counts.repaired;
    const degradedCount = counts.degraded + counts.unrecoverable;
    return [
      ...(protectedCount > 0
        ? [formatCount(protectedCount, "protegido", "protegidos")]
        : []),
      ...(degradedCount > 0
        ? [formatCount(degradedCount, "degradado", "degradados")]
        : []),
      ...(counts.pending > 0 ? [`${counts.pending} confirmando`] : []),
      ...(counts["native-by-policy"] > 0
        ? [formatCount(counts["native-by-policy"], "no modificado", "no modificados")]
        : []),
      ...(counts["not-applicable"] > 0
        ? [formatCount(counts["not-applicable"], "no aplicable", "no aplicables")]
        : []),
      ...(counts.unknown > 0
        ? [formatCount(counts.unknown, "desconocido", "desconocidos")]
        : []),
    ].join(" · ");
  },
  protectionException: (_surface: string) =>
    "Esta página puede no funcionar correctamente",
  unsupportedTab: "Página restringida",
  noLocationYet: "No hay ningún perfil activo",
  noPresetAssigned: "No hay perfil asignado",
  regularPageRequired: `${BRAND_DISPLAY_NAME} no puede acceder a esta página.`,
  openXRay: `Ver la actividad de este sitio en ${BRAND_DIAGNOSTICS_NAME}`,
  saveLabelCreate: "Crear",
  saveLabelSave: "Guardar",
  ruleConflictConfirm: (pattern: string) =>
    `Ya existe una regla de dominio para «${pattern}». ¿Quieres sustituirla por esta configuración?`,
  ruleConflictTitle: "¿Sustituir la regla de dominio?",
  ruleConflictReplace: "Reemplazar",
  popupDataUnavailable: "No se pudo cargar el estado de este sitio.",
  retryLabel: "Reintentar",
  dismissLabel: "Descartar",
  mutationFailed: `${BRAND_DISPLAY_NAME} no ha podido completar la acción. Inténtalo de nuevo.`,
  enableExtensionFailed: `No se ha podido activar ${BRAND_DISPLAY_NAME}.`,
  trustSiteFailed: "No se ha podido añadir este sitio a Sitios de confianza.",
  firefoxPermissionFailed:
    "No se ha podido conceder el permiso userScripts de Firefox.",
  powerControlExtension: BRAND_DISPLAY_NAME,
  powerControlGlobalProtections: "Protecciones globales",
  powerTargetLoading: "Comprobando los ajustes de este sitio…",
  powerTargetGlobal: `${BRAND_DISPLAY_NAME} está desactivado en todos los sitios.`,
  powerTargetGlobalProtectionsDisabled:
    "Actívalos en Configuración para usar tus reglas y ajustes guardados.",
  powerTargetUnsupported: `${BRAND_DISPLAY_NAME} no puede acceder a esta página.`,
  powerTargetTrustedSite: `${BRAND_DISPLAY_NAME} está desactivado porque este sitio coincide con Sitios de confianza.`,
  powerTargetSiteRule: "Activa o desactiva esta regla de dominio.",
  powerTargetContainer: "Activa o desactiva esta asignación de contenedor de Firefox.",
  powerTargetContainerSetup: `Configura ${BRAND_DISPLAY_NAME} para este contenedor de Firefox.`,
  powerTargetContainerDefaultRule:
    "Este contenedor de Firefox usa la Regla predeterminada.",
  powerTargetDefaultRule:
    "Controla los sitios sin una regla de dominio ni una entrada en Sitios de confianza.",
  powerAriaLoading: "Verificando la configuración de este sitio",
  powerAriaGlobalOff: `${BRAND_DISPLAY_NAME} está desactivado en todos los sitios`,
  powerAriaGlobalProtectionsDisabled:
    "Las protecciones globales están deshabilitadas. Actívalas en Configuración.",
  powerAriaRestricted: `${BRAND_DISPLAY_NAME} no puede acceder a esta página`,
  powerAriaTrustedSite: `Activar ${BRAND_DISPLAY_NAME} para este sitio`,
  powerAriaDomainRuleOn: "Activar esta regla de dominio",
  powerAriaDomainRuleOff: "Desactivar esta regla de dominio",
  powerAriaContainerOn: "Activar esta asignación de contenedor de Firefox",
  powerAriaContainerOff: "Desactivar esta asignación de contenedor de Firefox",
  powerAriaContainerSetup: `Configurar ${BRAND_DISPLAY_NAME} para este contenedor de Firefox`,
  powerAriaDefaultRuleOn: "Activar la regla predeterminada",
  powerAriaDefaultRuleOff: "Desactivar la regla predeterminada",

  sheetTitle: "Regla de dominio",
  currentProfileLabel: "Perfil regional",
  noPresetLabel: "Sin perfil",
  inheritedDefaultRuleProfileLabel: "Usar el perfil de la Regla predeterminada",
  inheritedContainerProfileLabel: "Usar perfil de contenedor de Firefox",
  inheritedDomainRuleProfileLabel: "Usar perfil de regla de dominio coincidente",
  ruleTypeLabel: "Se aplica a",
  ruleTypeExact: "Host exacto",
  ruleTypeSuffix: "Host + subdominios",
  workerHandlingLabel: "Dedicated y Shared Workers",
  workerHandlingHint:
    "Elige un modo para esta regla. Heredar usa la configuración global. Nativo ejecuta los workers con los valores reales del navegador. Simular intenta protegerlos. Estricto bloquea un worker cuando no puede confirmar la protección antes de iniciarlo.",
  workerHandlingInherit: "Heredar",
  workerHandlingNative: "Nativo",
  workerHandlingSpoof: "Simular",
  workerHandlingStrict: "Estricto",
  viewXRay: BRAND_DIAGNOSTICS_NAME,
  deleteButtonLabel: "Eliminar",
  sheetLead:
    "Elige dónde se aplica esta regla de dominio y qué perfil regional utiliza. Al cambiar la configuración se vuelve a cargar la página.",
  cleanupSheetTitle: "Nueva identidad",
  cleanupConfirmTitle: "¿Crear nueva identidad?",
  cleanupPlanLoading: "Comprobando qué puede borrar este navegador…",
  cleanupPlanDescription: (available: string, unavailable: string) =>
    unavailable
      ? `${BRAND_DISPLAY_NAME} borrará ${available}. Este navegador no puede borrar ${unavailable} aquí.`
      : `${BRAND_DISPLAY_NAME} borrará ${available}.`,
  cleanupResultTitle: "Nueva identidad creada",
  cleanupResultComplete: `Se han borrado los datos del navegador disponibles para ${BRAND_DISPLAY_NAME}.`,
  cleanupResultPartial:
    "Algunos datos del navegador fueron borrados, pero este navegador no puso a disposición todos los elementos.",
  cleanupResultFailed: `La identidad cambió, pero ${BRAND_DISPLAY_NAME} no pudo borrar los datos asociados del navegador. Puedes intentarlo de nuevo sin cambiar la identidad.`,
  cleanupSurfaceCookies: "cookies",
  cleanupSurfaceLocalStorage: "almacenamiento local",
  cleanupSurfaceIndexedDb: "IndexedDB",
  cleanupSurfaceCacheStorage: "almacenamiento en caché",
  cleanupSurfaceServiceWorkers: "Service Workers",
  cleanupSurfacePageStorage: "almacenamiento en páginas abiertas",
  cleanupStatusCleaned: "Borrado",
  cleanupStatusSkipped: "No disponible",
  cleanupStatusFailed: "Fallido",
  cleanupConfirmLabel: "Crear nueva identidad",
  deleteConfirmTitle: "¿Eliminar regla de dominio?",
  deleteConfirmDescription: (pattern: string) =>
    `Esto elimina la regla de dominio guardada para “${pattern}”.`,
  cleanDomainAriaLabel: "Crear una nueva identidad para este sitio",
  cleanDomainLabel: "Nueva identidad",
  cleanDomainDefaultRuleDisabled: "No disponible para la regla predeterminada",
  cleanDomainProductOffDisabled: `No disponible mientras ${BRAND_DISPLAY_NAME} está desactivado para este sitio`,
  cleanDomainContainerSetupDisabled: "Configura este contenedor de Firefox primero",
  cleanDomainPageDisabled: "No disponible en esta página",
  cleanDomainLoadingDisabled: "Disponible después de que el sitio termine de cargar",
  cleanDomainAvailabilityHint:
    "La nueva identidad funciona con una regla de dominio o con un contenedor de Firefox configurado.",
  openSettingsAriaLabel: "Abrir Configuración",
  openFullRuleSettings: "Abrir en Reglas de dominio",
  settingsLabel: "Configuración",
  closeSheetAriaLabel: "Cerrar regla de dominio",
  trustedSiteCta: "Editar sitio de confianza",
  disableOnSiteCta: "Agregar a sitios de confianza",
  enableTrustCta: "Agregar a sitios de confianza",
  extensionOffCardAction: `Activar ${BRAND_DISPLAY_NAME}`,
  surfaceGeolocation: "Geolocalización",
  surfaceTimeLocale: "Hora y configuración regional",
  surfaceNavigator: "Navigator",
  surfaceScreen: "Pantalla",
  surfaceClientHints: "Client Hints",
  surfaceBattery: "Batería",
  surfaceCanvas: "Canvas",
  surfaceWebGL: "WebGL",
  surfaceAudio: "Audio",
  surfaceWebRTC: "WebRTC",
  surfaceWorker: "Dedicated Workers",
  surfaceServiceWorker: "Service Workers",
  surfaceSharedWorker: "Shared Workers",
  addExactOverrideCta: "Agregar regla del sitio",
  containerSetupCta: "Configurar contenedor",
  globalFallbackRuleCta: "Editar regla predeterminada",
  editDomainRuleLabel: "Editar regla de dominio",
  editContainerLabel: "Editar contenedor",
  firefoxFirstInlinePermissionTitle:
    "Mejorar la simulación en la primera carga en Firefox",
  firefoxFirstInlinePermissionDescription: `Firefox puede exponer tu hora y configuración regional reales al primer script de la página. Otorga el permiso opcional de userScripts para que ${BRAND_DISPLAY_NAME} pueda comenzar a simular antes.`,
  firefoxFirstInlinePermissionEnableLabel: "Conceder permiso",
  detailsAbout: (label: string) => `Detalles sobre ${label}`,
  relaxCspHint: `Elimina las cabeceras de la Política de Seguridad de Contenido del sitio cuando impiden que ${BRAND_DISPLAY_NAME} proteja sus workers. Reduce la protección contra scripts maliciosos; actívalo únicamente en un sitio de confianza.`,
  advancedSectionTitle: "Avanzado",
  suggestionWorkerCspDescription:
    "La Política de Seguridad de Contenido (CSP) del sitio ha bloqueado la protección de workers. Permitirla relajará esa política y reducirá la protección contra scripts inyectados. Continúa solo si confías en este sitio.",
  suggestionSharedWorkerInjectionDescription: `${BRAND_DISPLAY_NAME} no ha podido proteger este Shared Worker antes de iniciarlo. Elige si en este sitio importa más la compatibilidad o la protección.`,
} as const;
