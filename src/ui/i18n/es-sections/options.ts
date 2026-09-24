import { workerHandlingModeCopy } from "./shared-worker";

import { BRAND_DISPLAY_NAME } from "@/shared/brand";

export const options = {
  title: "Configuración",
  tabsAriaLabel: "Secciones de configuración",
  spoofingOffBannerTitle: "La simulación está desactivada",
  spoofingOffBannerBody: `${BRAND_DISPLAY_NAME} no está aplicando valores simulados de ubicación o del navegador en este momento.`,
  spoofingOffBannerAction: "Volver a activar la simulación",
  spoofingTurnedOffToast: `${BRAND_DISPLAY_NAME} desactivado.`,
  spoofingTurnedOnToast: `${BRAND_DISPLAY_NAME} activado.`,

  tabs: {
    locations: "Perfiles regionales",
    rules: "Reglas de dominio",
    trustedSites: "Sitios de confianza",
    playground: "Área de pruebas",
    options: "Opciones",
    advanced: "Avanzado",
    about: "Acerca de",
  },
} as const;

export const optionsPage = {
  browserFingerprintSpoofing: {
    title: "Configuración global de protección",
    description: `Elige qué protecciones del navegador usa ${BRAND_DISPLAY_NAME} de forma predeterminada. Las opciones más específicas pueden sustituir protecciones concretas, mientras que Sitios de confianza puede desactivarlas en los sitios coincidentes.`,
    disabledNote: `Las protecciones del navegador están desactivadas en todas partes. Vuelve a activarlas para elegir qué ${BRAND_DISPLAY_NAME} debería simular por defecto.`,
    copyLinkLabel: "protecciones del navegador",
    items: {
      geolocation: {
        label: "Geolocalización",
        description: `Controla la API de geolocalización. Cuando está activada, ${BRAND_DISPLAY_NAME} responde a las solicitudes de ubicación con el perfil activo. Desactívala y los sitios recibirán el resultado real de geolocalización del navegador.`,
        advancedButton: "Avanzado",
        advancedModal: {
          title: "Configuración avanzada de geolocalización",
          description:
            "Ajusta el radio de coordenadas predeterminado y el tiempo de actualización de la ubicación.",
        },
      },
      timeLocale: {
        label: "Hora y configuración regional",
        description: `Controla Date, Intl, navigator.language, navigator.languages y las cabeceras de idioma. Cuando está activada, ${BRAND_DISPLAY_NAME} mantiene estos valores alineados con el perfil activo. Desactívala y los sitios verán la configuración regional real del navegador.`,
      },
      canvas: {
        label: "Canvas",
        description: `Los sitios pueden dibujar una imagen oculta y usar pequeñas diferencias de renderizado para reconocer tu navegador. Cuando está activado, ${BRAND_DISPLAY_NAME} añade ruido controlado para que el resultado sea más difícil de reutilizar como huella digital. Desactívalo y los sitios recibirán la salida real del canvas.`,
      },
      webGL: {
        label: "WebGL",
        description: `WebGL revela detalles gráficos como el modelo de tu GPU, el renderizador y el comportamiento del controlador. Cuando esto está activado, ${BRAND_DISPLAY_NAME} reemplaza esas pistas con un perfil consistente que se ajusta a tu plataforma actual. Desactívalo y los sitios pueden leer datos gráficos más cercanos a tu máquina real.`,
      },
      audio: {
        label: "Audio",
        description: `Las API de audio producen pequeñas diferencias específicas del hardware que los sitios pueden medir en segundo plano. Cuando esto está activado, ${BRAND_DISPLAY_NAME} cambia ligeramente esos valores para que sean menos útiles para el seguimiento. Desactívalo y la salida de audio permanece sin cambios.`,
      },
      navigator: {
        label: "Navigator",
        description: `Los campos del navegador revelan detalles como tu plataforma, configuración de idioma, pistas del CPU y otros datos de identidad del navegador. Cuando esto está activado, ${BRAND_DISPLAY_NAME} enmascara campos de identidad seleccionados mientras los mantiene internamente consistentes. Apágalo y los sitios verán más de tu identidad real del navegador.`,
      },
      screen: {
        label: "Pantalla",
        description: `El tamaño de la pantalla, la relación de píxeles y la profundidad de color ayudan a reducirte a un pequeño grupo de dispositivos. Cuando esto está activado, ${BRAND_DISPLAY_NAME} enmascara esos detalles exactos de la pantalla. Apágalo y los sitios obtendrán las propiedades reales de tu pantalla.`,
      },
      clientHints: {
        label: "Client Hints",
        description: `Client Hints comparte la versión del navegador, la plataforma y datos del dispositivo mediante cabeceras de solicitud y API de JavaScript. Cuando está activado, ${BRAND_DISPLAY_NAME} mantiene estos valores coherentes con la identidad simulada del navegador. Desactívalo y los sitios recibirán los datos reales del navegador y la plataforma.`,
      },
      battery: {
        label: "Batería",
        description: `El estado de la batería puede revelar información cambiante del dispositivo que los sitios pueden usar para vincular visitas. Cuando esto está activado, ${BRAND_DISPLAY_NAME} informa de una batería llena y cargando en lugar del estado real del dispositivo. Apágalo y los sitios pueden leer la API de Estado de Batería nativa.`,
      },
      clientHintsVersionRotation: {
        label: "Rotar números de compilación y parche",
        description: (count: number) =>
          `Rota los números de compilación y parche del motor Chromium expuestos mediante Client Hints, manteniendo la versión principal del navegador instalado. ${BRAND_DISPLAY_NAME} incluye un catálogo de compilaciones recientes de Chromium; para esta versión puede elegir entre ${count} ${count === 1 ? "entrada compatible" : "entradas compatibles"}. La cadena reducida de User-Agent conserva el formato .0.0.0 que el navegador usa para proteger la privacidad.`,
        hintPrefix: "p. ej.:",
        hint: "139.0.[compilación].[parche]",
      },
      webRTC: {
        label: "WebRTC",
        description: `WebRTC puede revelar direcciones IP locales o públicas, incluso cuando usas una VPN o un proxy. Cuando esto está activado, ${BRAND_DISPLAY_NAME} pide al navegador que use su modo más estricto de manejo de IP. Apágalo y WebRTC se comporta normalmente, lo que puede exponer más detalles de la red.`,
      },
      serviceWorker: {
        label: "Service Workers",
        description: `Los Service Workers se ejecutan en segundo plano y pueden permitir que los sitios conserven datos e identificadores durante mucho tiempo. Activa esta opción para que ${BRAND_DISPLAY_NAME} impida de forma predeterminada que los sitios registren Service Workers.`,
        warning:
          "Bloquear los Service Workers puede romper aplicaciones web instalables (PWAs), el modo sin conexión, las notificaciones push y la sincronización en segundo plano. Algunas aplicaciones también pueden funcionar más lentamente o perder funciones.",
        defaultState:
          "El bloqueo está desactivado de forma predeterminada. Puedes activarlo globalmente y permitir después los Service Workers en dominios concretos mediante una regla de dominio.",
        allow: "Permitir",
        block: "Bloquear",
      },
      sharedWorker: {
        label: "Dedicated y Shared Workers",
        descriptionLead:
          "Elige cómo se ejecutan los Dedicated y Shared Workers de forma predeterminada. Las reglas de dominio y los contenedores de Firefox pueden sustituir esta política en los sitios coincidentes.",
        copyLinkLabel: "Manejo de Dedicated y Shared Workers",
        native: workerHandlingModeCopy.native.label,
        nativeDescription: workerHandlingModeCopy.native.description,
        spoof: workerHandlingModeCopy.spoof.label,
        spoofDescription: workerHandlingModeCopy.spoof.description,
        strict: workerHandlingModeCopy.strict.label,
        strictDescription: workerHandlingModeCopy.strict.description,
      },
    },
  },
  badgeQueryCount: {
    label: "Mostrar recuento de llamadas en el icono de la extensión",
    description: `Muestra en el icono de la extensión cuántas llamadas a API del navegador ha gestionado ${BRAND_DISPLAY_NAME}, en lugar de la etiqueta de texto.`,
    includeDateCalls: {
      label: "Incluir llamadas a Date y a la API Temporal",
      description:
        "Incluir llamadas a Date.* y Temporal.* en el número del icono. Desactiva esto para evitar que verificaciones frecuentes de tiempo inflen el recuento.",
    },
  },
  copyLinkHelpLabel: "ayuda de opciones",
  help: {
    title: "Opciones",
    body1: `Las protecciones del navegador te permiten elegir qué valores simula ${BRAND_DISPLAY_NAME} de forma predeterminada. Afectan a todos los sitios salvo que una regla de dominio o un contenedor de Firefox indique lo contrario.`,
    body2: `Los controles de privacidad abarcan las únicas solicitudes de red opcionales que ${BRAND_DISPLAY_NAME} realiza al configurar ubicaciones. Si los dejas desactivados, ${BRAND_DISPLAY_NAME} seguirá funcionando; simplemente añadirás las ubicaciones de forma manual, sin búsquedas ni vistas previas del mapa.`,
  },
} as const;
