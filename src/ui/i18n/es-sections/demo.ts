import { BRAND_DISPLAY_NAME } from "@/shared/brand";

const SPOOFED_PRODUCT = `Simulado — ${BRAND_DISPLAY_NAME}`;

export const demo = {
  loadingSettings: "Cargando configuración…",
  noLocationsTitle: "Aún no hay perfiles regionales",
  noLocationsBody:
    "Crea al menos un perfil regional en Configuración para usar el Área de pruebas.",
  openSettingsButton: "Abrir Configuración",

  locationPreview: {
    title: "Vista previa del perfil",
    activeLocationLabel: "Perfil activo",
    activeLocationDescription:
      "Selecciona un perfil regional guardado para previsualizar los valores que verá el navegador. Al cambiar de perfil se reinicia la ruta y se aplica la nueva vista previa de geolocalización.",
    activeLocationPlaceholder: "Elige un perfil…",
    playgroundCadenceLabel: "Intervalo del Área de pruebas",
    realSiteCadenceLabel: "Tiempo de actualización del sitio web",
    configuredDelayLabel: "Intervalo de actualización de la posición",
    callbackDelayLabel: "Retardo de la respuesta",
    runtimeModeLabel: "Modo de ejecución",
    runtimeModeSimple: "Tiempo por defecto",
    realLocationTitleIdle: "Comparar con la ubicación actual del navegador",
    realLocationTitleLoading: "Solicitando la ubicación actual del navegador",
    realLocationTitleGranted: "La ubicación actual del navegador está lista",
    realLocationTitleDenied: "Permiso de ubicación del navegador denegado",
    realLocationTitleUnavailable: "Ubicación del navegador no disponible",
    realLocationDescription:
      "Solicita una vez la geolocalización real del navegador para compararla con la vista previa del perfil.",
    realLocationGrantedDescription:
      "La ubicación actual del navegador ya está disponible en las filas de geolocalización para compararla en paralelo.",
    realLocationDeniedDescription:
      "El navegador ha denegado el acceso a la geolocalización real. Puedes volver a intentarlo si cambia el permiso.",
    realLocationUnavailable:
      "La comparación de ubicación real no está disponible porque este navegador no expone la geolocalización aquí.",
    realLocationRefresh: "Actualizar ubicación real",
  },

  localMachineTitle: "Dispositivo local",
  spoofedTitle: SPOOFED_PRODUCT,
  waitingForPermission: "Esperando permiso del navegador…",
  permissionDenied: "Permiso denegado por el navegador",
  geolocationUnavailable: "Geolocalización no disponible",
  requestRealLocation: "Solicitar ubicación real",
  requestRealLocationHintTitle: "Ubicación real aún no cargada",
  requestRealLocationTableHint:
    "Solicita arriba la ubicación real del navegador para compararla aquí.",
  waitingForFix: "Esperando la primera corrección…",
  selectLocationPrompt: "Selecciona arriba un perfil regional para ver sus valores.",

  comparison: {
    language: "navigator.language",
    languages: "navigator.languages",
    timeZone: "Intl…resolvedOptions().timeZone",
    acceptLanguage: "Encabezado Accept-Language",
    timeZoneOffset: "new Date().getTimezoneOffset()",
    dateToString: "new Date().toString()",
    dateToDateString: "new Date().toDateString()",
    dateToTimeString: "new Date().toTimeString()",
    dateLocaleString: "new Date().toLocaleString()",
    dateLocaleDateString: "new Date().toLocaleDateString()",
    dateLocaleTimeString: "new Date().toLocaleTimeString()",
    currentPosition: "navigator.geolocation.getCurrentPosition()",
    coords: "geolocation.coords",
    timestamp: "geolocation.timestamp",
    timestampInfoLabel:
      "Acerca de la visualización de la marca de tiempo de geolocalización",
    timestampTooltip: `${BRAND_DISPLAY_NAME} devuelve la marca de tiempo Unix sin procesar en milisegundos. La fecha legible para humanos que se muestra aquí es solo por conveniencia y está formateada en la zona horaria de la columna mostrada.`,
    userAgent: "navigator.userAgent",
    appVersion: "navigator.appVersion",
    vendor: "navigator.vendor",
    hardwareConcurrency: "navigator.hardwareConcurrency",
    deviceMemory: "navigator.deviceMemory",
    platform: "navigator.platform",
    pixelDepth: "screen.pixelDepth",
    screenMetrics: "screen.width/height/avail*/colorDepth",
    devicePixelRatio: "window.devicePixelRatio",
    canvas2d: "Resumen de la prueba Canvas 2D",
    webglRenderer: "Prueba del renderizador WebGL",
    webglDebugExtension: "WEBGL_debug_renderer_info",
    webglReadPixels: "Sonda readPixels() de WebGL",
    audioFingerprint: "Sonda AnalyserNode + AudioBuffer",
    clientHintBrands: "navigator.userAgentData.brands",
    clientHintPlatform: "navigator.userAgentData.platform",
    clientHintPlatformVersion: "navigator.userAgentData.platformVersion",
    clientHintArchitecture: "navigator.userAgentData.architecture",
    clientHintBitness: "navigator.userAgentData.bitness",
    clientHintModel: "navigator.userAgentData.model",
    clientHintMobile: "navigator.userAgentData.mobile",
    clientHintFullVersionList: "navigator.userAgentData.fullVersionList",
    secChUa: "Encabezado Sec-CH-UA",
    secChUaPlatform: "Encabezado Sec-CH-UA-Platform",
    secChUaMobile: "Encabezado Sec-CH-UA-Mobile",
    secChUaFullVersionList: "Encabezado Sec-CH-UA-Full-Version-List",
    webRTCIcePolicy: "RTCPeerConnection ICE policy",
    probePending: "Recopilando…",
    notAvailable: "No disponible",
    spoofedMatchesLocal:
      "El valor de vista previa coincide con tu navegador para esta identidad.",
    browserVersionNote: (versionToken: string) =>
      `${BRAND_DISPLAY_NAME} mantiene tokens de versión del navegador normalizados y no aleatoriza variantes de marcador de posición como ${versionToken}.`,
  },

  previewSeed: {
    title: "Identidad de vista previa",
    description:
      "Elige la identidad de navegador consistente que se muestra en esta vista previa del Área de pruebas.",
    inputAriaLabel: "Código de identidad de vista previa",
    placeholder: "Código de identidad",
    hint: "Usa 6 letras minúsculas o dígitos. Cambia el código para previsualizar una identidad diferente.",
    randomize: "Generar nueva identidad",
  },

  sections: {
    localeDate: "Configuración regional y fecha",
    networkHeaders: "Encabezados de red",
    geolocation: "Geolocalización",
    browserFingerprint: "Identidad del navegador",
    webglCanvas: "Canvas y WebGL",
    screen: "Pantalla",
    audio: "Audio",
    webRTC: "WebRTC",
  },

  map: {
    title: "Vista previa del mapa",
    noLocationTitle: "Selecciona primero un perfil",
    noLocationDescription:
      "Elige arriba un perfil regional guardado para activar el mapa y los controles de puntos de referencia.",
    osmRequired: "Se requiere acceso al mapa",
    osmRequiredDescription:
      "Permite el acceso externo al mapa para previsualizar la posición simulada en un mapa interactivo.",
    demoIntervalLabel: "Intervalo de demostración (2–5 s)",
    clearButton: "Borrar",
  },

  disclaimer: {
    title: "Modo de vista previa, no un sitio web en vivo",
    body: `Usa esta página para comprobar cómo ${BRAND_DISPLAY_NAME} presentaría el perfil regional seleccionado antes de aplicarlo en sitios web. El idioma, la configuración regional, la hora, las cabeceras y otros valores se muestran como una <em>vista previa</em> de los mismos datos del perfil. La geolocalización utiliza el mismo comportamiento de movimiento y actualización que los sitios protegidos. En el Área de pruebas, la ubicación se actualiza más rápido que en sitios normales para que los cambios resulten más visibles.`,
  },

  howItWorks: {
    title: "Cómo leer esta vista previa",
    body1:
      "<strong>Idioma, configuración regional y hora</strong> — estas filas muestran cómo se presentaría el perfil seleccionado a los sitios web, sin modificar la propia página del Área de pruebas.",
    body2: `<strong>Geolocalización</strong> — las filas de mapa y ubicación usan el mismo comportamiento de movimiento y actualización que los sitios web protegidos, por lo que puedes previsualizar el tiempo y la variación de coordenadas antes de asignar el perfil.`,
    body3: `<strong>Valores y cabeceras del navegador</strong> — estas comparaciones colocan los valores actuales del navegador junto a los que ${BRAND_DISPLAY_NAME} mostraría para el perfil seleccionado, con las mismas protecciones definidas en Configuración.`,
    body4:
      "El Área de pruebas se actualiza más rápido que la navegación normal, por lo que los cambios son más fáciles de detectar.",
  },
} as const;
