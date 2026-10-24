import { BRAND_DIAGNOSTICS_NAME, BRAND_DISPLAY_NAME } from "@/shared/brand";

export const sidebar = {
  troubleshooter: {
    savedExceptions: "Excepciones de workers guardadas",
    savedHint:
      "Eliminar una excepción restaura los ajustes actuales de workers y recarga las pestañas.",
    details: "Detalles",
    sources: {
      rule: "Regla del sitio",
      container: "Contenedor",
      fallback: "Regla predeterminada",
      trustedSite: "Sitio de confianza",
      none: "Ninguno",
    },
    title: "¿La página no funciona?",
    intro: "Prueba un ajuste de workers y decide si quieres conservarlo.",
    rule: "Ajuste actual",
    exceptions: "Excepciones",
    unknown: "No disponible",
    none: "Ninguna",
    active: "Prueba temporal de workers",
    scope:
      "Se aplica a este host en todas sus pestañas y contenedores. Los demás sitios conservan sus ajustes.",
    webrtc:
      "La política global WebRTC del navegador sigue activa. Este asistente no puede cambiarla para una sola web.",
    returnHint:
      "Hasta 10 minutos. Las pestañas de este host se recargan. Prueba el sitio y vuelve aquí. Cerrar esta ventana restaura los ajustes.",
    start: "Probar y recargar",
    helped: "Ayudó",
    failed: "No ayudó",
    restore: "Restaurar ajustes",
    save: "Conservar excepción",
    helpedHint:
      "Conserva este ajuste para el host sin cambiar otros ajustes ni la identidad de los contenedores. Puedes eliminarlo en Ajustes.",
    siteEffects:
      "Restaurar opciones no deshace cambios de la web: los workers y sus cachés pueden sobrevivir o compartirse por origen. Solo las llamadas nuevas en contextos compatibles usan la política elegida.",
    noCandidates: "No hay ajustes de workers disponibles para probar.",
    error:
      "No se pudo completar la operación. La web, la prueba o la configuración pueden haber cambiado. Vuelve a abrir para comprobar el estado; las pruebas temporales caducan automáticamente.",
    report: "Informe local antes / después",
    reportHint:
      "Solo JSON depurado; no se envía nada. Configuración y observaciones están separadas. Datos ausentes o antiguos no son pruebas. «Después» aparece al responder o restaurar.",
    before: "Antes",
    after: "Después",
    kinds: {
      serviceWorker: "Permitir registro de Service Worker",
      sharedWorker: "Usar SharedWorker nativo",
    },
    effects: {
      serviceWorker:
        "Permite nuevos Service Workers. Pueden ver los valores reales del navegador.",
      sharedWorker:
        "Usa SharedWorkers nativos. Los nuevos workers pueden ver los valores reales del navegador.",
    },
    evidence: {
      observed:
        "X-Ray tiene actividad o fallos recientes de workers. Es una pista, no una prueba de la causa.",
      missing:
        "Sin datos observados. La propuesta procede de la política configurada y puede no ayudar.",
      stale:
        "Los datos de workers son antiguos. La política es una candidata, pero la observación anterior no demuestra la causa actual.",
    },
    blocked: {
      unsupported: "Se necesita una web compatible y el estado del proceso de fondo.",
      trusted:
        "Una excepción de sitio de confianza desactiva la protección. Cámbiala en Ajustes antes de probar.",
      inactive: "No hay configuración de simulación activa que probar.",
      pause: "Ya hay una pausa para el host. Restáurala antes de probar workers.",
      reload:
        "Este documento necesita recargarse para aplicar la decisión actual. No puedes responder hasta confirmar la navegación.",
    },
    results: {
      failed:
        "La prueba no ayudó. Se eliminó la excepción temporal; las pestañas se recargan con las opciones actuales.",
      cancelled:
        "Prueba cancelada. Se eliminó la excepción temporal; las pestañas se recargan con las opciones actuales.",
      expired:
        "La prueba terminó. Las nuevas decisiones ya no usan la excepción. Recarga si un documento todavía usa la política probada.",
      saved:
        "Se guardó una excepción de workers para el host exacto tras tu confirmación. Las pestañas se recargan.",
    },
    remaining: (minutes: number): string =>
      `Restauración en un máximo de ${minutes} min.`,
  },
  xRayTitle: BRAND_DIAGNOSTICS_NAME,
  openSettings: "Abrir Configuración",
  openRule: "Editar regla de dominio",
  openLocation: "Editar perfil",
  openLogs: "Ver registros",
  report: {
    prepare: "Preparar informe",
    title: "Informe de diagnóstico",
    localOnly:
      "Se prepara localmente. No se envía ni se recopila nada automáticamente.",
    partial: "Informe parcial.",
    complete: "Hay evidencias disponibles.",
    evidenceHint:
      "La configuración y las evaluaciones de X-Ray están separadas de las observaciones. Las evidencias ausentes, antiguas o pendientes no confirman la protección.",
    includeSite: "Incluir datos del sitio",
    siteHint:
      "Añade solo el nombre de host y el patrón de la regla o del sitio de confianza. Se excluyen nombres de perfiles, URL, registros y secretos.",
    preview: "Vista previa del informe",
    text: "Texto",
    cancel: "Cancelar",
    downloadText: "Descargar texto",
    downloadJson: "Descargar JSON",
    error: "No se pudo preparar o descargar el informe.",
  },
  region: "Región",

  errorPrefix: `${BRAND_DISPLAY_NAME} ha detectado un problema:`,
  loading: "Comprobando esta página…",
  unsupportedTab:
    "No se pueden simular datos en las páginas internas del navegador. Abre un sitio web para comprobar la cobertura.",
  noSpoofing: `${BRAND_DISPLAY_NAME} no está activo en esta página. Abre la ventana emergente para configurar una regla para este sitio.`,
  trustedSite:
    "Has marcado este sitio como de confianza. La simulación está desactivada.",
  trustedSiteHint: "Abre Sitios de confianza en Configuración para cambiarlo.",

  surfaces: {
    title: "Superficies simuladas",
    timezone: "Zona horaria",
    language: "Idioma",
    languages: "Idiomas",
    acceptLanguage: "Accept-Language",
    geolocation: "Geolocalización",
    accuracyNoise: "Precisión / Ruido",
    platform: "Plataforma",
    userAgent: "Agente de usuario",
    cpuRam: "CPU / RAM",
    screen: "Pantalla",
    noise: "Ruido",
    canvas: "Canvas",
    audio: "Audio",
    gpu: "GPU",
    sharedWorker: "Shared Worker",
    sharedWorkerNativeCompatibility: "Nativo para compatibilidad",
    sharedWorkerBlobSpoofing: "Simulado mediante envoltorio de blob",
    sharedWorkerResponseRewriteSpoofing: "Simulado mediante reescritura de respuesta",
    sharedWorkerResponseRewriteCacheSensitive:
      "Reescritura de respaldo; sensible a la caché",
    sharedWorkerModuleUnsupported: "Reescritura de módulo no compatible",
    sharedWorkerIdentityConflict: "Conflicto de identidad",
    sharedWorkerRewriteUnavailable: "Reescritura de respuesta no disponible",
    sharedWorkerBlockedStrict: "Bloqueado por modo estricto",
    sharedWorkerStrictRewriteRequired:
      "El modo estricto requiere reescritura confirmada",
    sharedWorkerStrictBlockedCacheSensitive:
      "Bloqueado; la reescritura de respaldo era sensible a la caché",
    sharedWorkerCompatibilityHelp:
      "El modo de Shared Worker sigue la opción seleccionada: Nativo, Simular o Estricto.",
    gpuDebug: "Depuración de GPU",
    clientHintsPlatform: "plataforma",
    clientHintsBrands: "marcas",
    fingerprint: "Huella digital",
    off: "Desactivado",
    yes: "Activo",
    blocked: "Bloqueado",
    m: "m",
    GB: "GB",
    expand: "Mostrar valor completo",
    collapse: "Contraer",
  },

  accessed: {
    title: "Actividad de la página",
    description: "Categorías consultadas por la página desde la última navegación.",
    accessed: "Consultado",
    blocked: "Bloqueado",
    armed: "Esperando",
    connecting: "Conectando…",
    failed: "Fallido",
    off: "Desactivado",
    categories: {
      geolocation: "Geolocalización",
      timeLocale: "Hora y configuración regional",
      canvas: "Canvas",
      webGL: "WebGL",
      audio: "Audio",
      navigator: "Navigator",
      screen: "Pantalla",
      clientHints: "Client Hints",
      battery: "Batería",
      webRTC: "WebRTC",
      worker: "Dedicated Workers",
      serviceWorker: "Service Workers",
      sharedWorker: "Shared Workers",
    },
    methods: {
      geolocationGetCurrentPosition: "getCurrentPosition",
      geolocationWatchPosition: "watchPosition",
      geolocationClearWatch: "clearWatch",
      geolocationPermissionsQuery: "permissions.query",
      dateConstructor: "Date()",
      dateNow: "Date.now",
      dateParse: "Date.parse",
      dateGetTimezoneOffset: "Date.getTimezoneOffset",
      dateToString: "Date.toString",
      dateToLocaleString: "Date.toLocaleString",
      intlConstructor: "Intl constructor",
      intlResolvedOptions: "Intl.resolvedOptions",
      intlDateTimeFormatFormat: "DateTimeFormat.format",
      intlDateTimeFormatFormatToParts: "DateTimeFormat.formatToParts",
      temporalNowInstant: "Temporal.Now.instant",
      temporalNowTimeZoneId: "Temporal.Now.timeZoneId",
      temporalNowPlainDateTimeISO: "Temporal.Now.plainDateTimeISO",
      temporalNowZonedDateTimeISO: "Temporal.Now.zonedDateTimeISO",
      temporalNowPlainDateISO: "Temporal.Now.plainDateISO",
      temporalNowPlainTimeISO: "Temporal.Now.plainTimeISO",
      temporalDurationToLocaleString: "Temporal.Duration.toLocaleString",
      temporalInstantToLocaleString: "Temporal.Instant.toLocaleString",
      temporalPlainDateToLocaleString: "Temporal.PlainDate.toLocaleString",
      temporalPlainDateTimeToLocaleString: "Temporal.PlainDateTime.toLocaleString",
      temporalPlainMonthDayToLocaleString: "Temporal.PlainMonthDay.toLocaleString",
      temporalPlainTimeToLocaleString: "Temporal.PlainTime.toLocaleString",
      temporalPlainYearMonthToLocaleString: "Temporal.PlainYearMonth.toLocaleString",
      temporalZonedDateTimeToLocaleString: "Temporal.ZonedDateTime.toLocaleString",
      canvasGetImageData: "ctx.getImageData",
      canvasToDataURL: "canvas.toDataURL",
      canvasToBlob: "canvas.toBlob",
      webGLReadPixels: "gl.readPixels",
      webGLGetExtension: "Información del renderizador GPU",
      webGLGetSupportedExtensions: "gl.getSupportedExtensions",
      webGLGetParameter: "gl.getParameter",
      audioGetFloatFrequencyData: "analyser.getFloatFrequencyData",
      audioGetByteFrequencyData: "analyser.getByteFrequencyData",
      audioGetFloatTimeDomainData: "analyser.getFloatTimeDomainData",
      audioGetByteTimeDomainData: "analyser.getByteTimeDomainData",
      audioGetChannelData: "analyser.getChannelData",
      navigatorWebdriver: "navigator.webdriver",
      navigatorHardwareConcurrency: "navigator.hardwareConcurrency",
      navigatorDeviceMemory: "navigator.deviceMemory",
      navigatorMaxTouchPoints: "navigator.maxTouchPoints",
      navigatorPlatform: "navigator.platform",
      navigatorUserAgent: "navigator.userAgent",
      navigatorVendor: "navigator.vendor",
      navigatorAppVersion: "navigator.appVersion",
      screenWidth: "screen.width",
      screenHeight: "screen.height",
      screenAvailWidth: "screen.availWidth",
      screenAvailHeight: "screen.availHeight",
      screenColorDepth: "screen.colorDepth",
      screenPixelDepth: "screen.pixelDepth",
      screenDevicePixelRatio: "screen.devicePixelRatio",
      clientHintsBrands: "ua.brands",
      clientHintsMobile: "ua.mobile",
      clientHintsPlatform: "ua.platform",
      clientHintsToJSON: "ua.toJSON",
      clientHintsGetHighEntropyValues: "ua.getHighEntropyValues",
      batteryGetBattery: "navigator.getBattery",
      batteryManagerCharging: "BatteryManager.charging",
      batteryManagerChargingTime: "BatteryManager.chargingTime",
      batteryManagerDischargingTime: "BatteryManager.dischargingTime",
      batteryManagerLevel: "BatteryManager.level",
      webRTCConstructor: "RTCPeerConnection",
      webRTCCreateOffer: "RTCPeerConnection.createOffer",
      webRTCCreateAnswer: "RTCPeerConnection.createAnswer",
      workerConstructor: "Worker()",
      serviceWorkerRegister: "serviceWorker.register",
      sharedWorkerConstructor: "SharedWorker()",
    },
  },

  inspector: {
    toggle: "Inspector",
    toggleHint: "Elige las API falseadas que pausan DevTools cuando la página las usa",
    armedIndicator: "activo",
    intro:
      "Elige las API falseadas que deben pausar DevTools cuando un script de la página las use. Abre antes DevTools en esta pestaña.",
    loading: "Comprobando el estado del Inspector…",
    loadError: (message: string) =>
      `No se pudo leer el estado del Inspector: ${message}`,
    status: {
      idle: "Sin activar",
      armed: (count: number) =>
        `Activo — ${count} ${count === 1 ? "método" : "métodos"}`,
      changed: "Selección modificada",
    },
    hint: {
      empty: "Selecciona al menos un método abajo.",
      ready: (count: number) =>
        `${count} ${count === 1 ? "método seleccionado" : "métodos seleccionados"}.`,
      changed: "Aplica para actualizar lo que está activo o revierte tus cambios.",
      changedToEmpty: "No hay nada seleccionado. Desactiva para dejar de pausar.",
      active: "Activo en esta página.",
      appliedLive: "Activo en esta página, sin recargar.",
      pendingArm: "Se aplicará cuando se recargue la página.",
      pendingDisarm: "Las pausas terminan cuando se recargue la página.",
      partialLive: "Activo en esta página. Algunos marcos lo aplican tras recargar.",
      partialDisarm:
        "Detenido en esta página. Algunos marcos se detienen tras recargar.",
    },
    reloadNote: "Al recargar se pierden los cambios no guardados de la página.",
    actions: {
      arm: "Activar",
      armReload: "Activar y recargar",
      armNextLoad: "Activar en la próxima carga",
      apply: "Aplicar",
      applyReload: "Aplicar y recargar",
      applyNextLoad: "Aplicar en la próxima carga",
      disarm: "Desactivar",
      disarmReload: "Desactivar y recargar",
      disarmNextLoad: "Desactivar en la próxima carga",
      revert: "Revertir",
      reloadNow: "Recargar ahora",
    },
    result: {
      armed: (count: number) =>
        `Activo — ${count} ${count === 1 ? "método" : "métodos"}.`,
      disarmed: "Desactivado.",
      live: "Aplicado sin recargar.",
      reload: "Recargando la página.",
      nextLoad: "Se aplica en la próxima carga de la página.",
    },
    actionError: (message: string) => `No se pudo aplicar: ${message}`,
    everyCall: "Pausar en cada llamada",
    firstCallHint: "Pausa una vez por método en cada carga de la página.",
    everyCallWarning:
      "Las API habituales, como las lecturas de la hora, pueden pausar muy a menudo. Selecciona solo los métodos que necesites.",
    pauseNotice: "La pausa es real, así que la página puede notar el retraso.",
    firefoxNotice: `En DevTools de Firefox, activa Ajustes › Ignorar scripts de terceros conocidos para ocultar los marcos de ${BRAND_DISPLAY_NAME} en la pila de llamadas.`,
    coverage: {
      pending: (count: number, reasons: string) =>
        `${count} ${count === 1 ? "marco lo aplica" : "marcos lo aplican"} en la próxima carga: ${reasons}.`,
      reasons: {
        openedWindow: "esta ventana la abrió un script",
        sameOriginFrame: "marcos del mismo origen",
        noChannel: "marcos sin conexión en vivo",
        lateRuntime: "marcos que cargaron antes de que empezara la protección",
      },
    },
    workerNotice:
      "Los workers que ya están en marcha mantienen la selección anterior hasta que vuelvan a iniciarse.",
    unavailable: {
      title: "El Inspector no está disponible aquí",
      unsupportedUrl: `${BRAND_DISPLAY_NAME} no puede ejecutarse en esta página, así que no hay nada que inspeccionar.`,
      trustedSite:
        "Este dominio es un sitio de confianza. La protección está desactivada por completo y no se falsea nada.",
      protectionPaused:
        "La protección está en pausa para este dominio. Reanúdala para inspeccionar las API falseadas.",
      noRuntime: `No se puede contactar con el entorno de ${BRAND_DISPLAY_NAME} en esta página. Recarga la página y vuelve a intentarlo.`,
    },
    list: {
      label: "Métodos en los que pausar",
      search: "Buscar métodos",
      usedOnly: "Usados en esta página",
      noMatches: "Ningún método coincide.",
      clearFilters: "Borrar filtros",
      selectedOfTotal: (selected: number, total: number) => `${selected}/${total}`,
      selectedSummary: (selected: number, total: number) =>
        `${selected} de ${total} seleccionados`,
      methodsOf: (category: string) => `Métodos de ${category}`,
      used: (count: number) => (count === 1 ? "Usado una vez" : `Usado ${count} veces`),
      notTrappable: "No disponible",
      notTrappableReason:
        "El Inspector no puede pausar en este método aquí: la regla de este dominio no lo falsea o este navegador no permite interceptarlo.",
    },
  },

  why: {
    title: "Por qué se aplica esta configuración",
    sourcesShort: {
      trustedSite: "De confianza",
      domainRule: "Regla de dominio",
      container: "Contenedor",
      fallback: "Predeterminado",
      none: "Ninguna",
    },
    noExplanation: "No hay explicación de la regla disponible.",
  },
} as const;
