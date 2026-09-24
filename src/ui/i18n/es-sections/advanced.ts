import { BRAND_DISPLAY_NAME } from "@/shared/brand";
import { externalMapConsentCopy } from "@/ui/i18n/es-sections/osm";

const TURN_OFF_PRODUCT = `Desactivar ${BRAND_DISPLAY_NAME}`;

export const advanced = {
  runtimeTitle: "Opciones avanzadas",
  runtimeDescription: "Gestiona el registro detallado de la actividad interna.",
  copyLinkRuntimeLabel: "configuración avanzada",
  copyLinkHelpLabel: "ayuda avanzada",

  noiseRadius: {
    title: "Radio máximo de coordenadas predeterminado",
    description:
      "Establece el radio máximo predeterminado, en metros, para los perfiles nuevos.",
    copyLinkLabel: "radio máximo de coordenadas predeterminado",
  },

  generatedLocationRandomization: {
    enabled: {
      title: "Aleatorizar coordenadas al crear nuevos perfiles regionales",
      description:
        "Usa esta opción de forma predeterminada en los perfiles generados. Podrás desactivarla en cada operación cuando necesites coordenadas exactas.",
      readWhy: "Leer por qué.",
      tooltipPrivacy: `${BRAND_DISPLAY_NAME} está orientado a la privacidad. Los perfiles deben ser fáciles de usar, pero reutilizar las coordenadas exactas de un catálogo o una búsqueda podría facilitar que se reconozca a sus usuarios.`,
      tooltipExact:
        "¿Necesitas una ubicación concreta? Desactiva esta opción y el perfil usará las coordenadas exactas.",
      copyLinkLabel: "aleatorización de coordenadas de perfiles nuevos",
    },
    radius: {
      title: "Radio de aleatorización de coordenadas por defecto",
      description:
        "Elige el radio predeterminado que se usará al aleatorizar las coordenadas. Introduce un número entero entre 1 y 99 km.",
      inputLabel: "Radio de aleatorización de coordenadas por defecto en kilómetros",
      copyLinkLabel: "radio de aleatorización de coordenadas por defecto",
    },
  },

  themeMode: {
    title: "Tema",
    description: `Elige si ${BRAND_DISPLAY_NAME} sigue la apariencia del sistema o siempre utiliza un tema fijo claro u oscuro.`,
    label: "Apariencia",
    options: {
      system: "Sistema",
      light: "Claro",
      dark: "Oscuro",
    },
    copyLinkLabel: "tema",
  },

  watchPositionDelay: {
    title: "Intervalo de actualización de la posición (s)",
    description:
      "Establece los tiempos mínimo y máximo entre actualizaciones de ubicación en los sitios web.",
    copyLinkLabel: "intervalo de actualización de la posición",
  },

  debugMode: {
    title: "Modo de depuración",
    description: `Registra la actividad interna detallada de ${BRAND_DISPLAY_NAME} en la consola para desarrolladores del navegador.`,
    copyLinkLabel: "modo de depuración",
  },

  experimental: {
    title: "Experimental",
    description:
      "Prueba protecciones para API del navegador que aún se están implementando. Estas opciones están disponibles en todos los canales de publicación.",
    copyLinkLabel: "opciones experimentales",
    temporalApi: {
      title: "Temporal API",
      description:
        "Protege el comportamiento de fecha, hora, configuración regional y zona horaria predeterminada de Temporal cuando el navegador ofrece la API nativa. No instala ningún polyfill.",
      copyLinkLabel: "Temporal API",
    },
    domainFencing: {
      title: "Aislamiento por dominio",
      description:
        "Cuando se aplica la Regla predeterminada o un contenedor de Firefox, cada sitio recibe su propia huella digital estable. El perfil regional no cambia.",
      copyLinkLabel: "aislamiento por dominio",
    },
  },

  privacy: {
    title: "Privacidad",
    description: `${BRAND_DISPLAY_NAME} se ejecuta en tu dispositivo y no envía a ningún sitio tus datos de navegación. Las únicas solicitudes de red opcionales se realizan al buscar ubicaciones o mostrar vistas previas del mapa mientras configuras perfiles regionales.`,
    copyLinkLabel: "privacidad",

    osmConsent: {
      title: externalMapConsentCopy.title,
      description: externalMapConsentCopy.description,
      stateUnknown: `Aún no has elegido esto. ${BRAND_DISPLAY_NAME} preguntará antes de conectarse a un servicio de mapas externo.`,
      statePrefix: "El acceso externo a mapas está",
      stateEnabled:
        "activado: se pueden cargar la búsqueda de ubicaciones y las vistas previas del mapa",
      stateDisabled: `desactivado: ${BRAND_DISPLAY_NAME} no se conectará a Internet mientras configuras ubicaciones`,
      copyLinkLabel: "acceso a mapas externos",
    },
  },

  display: {
    title: "Apariencia",
    description: "Ajustar la presentación visual y la configuración de accesibilidad.",
    copyLinkLabel: "apariencia",

    language: {
      title: "Idioma",
      description: `${BRAND_DISPLAY_NAME} sigue el idioma del navegador en Automático. Elige un idioma para usarlo en su lugar.`,
      optionAutomatic: "Automático",
      optionEnglish: "Inglés",
      optionSpanish: "Español",
      optionPortuguese: "Portugués",
      optionRussian: "Ruso",
      optionUkrainian: "Ucraniano",
      reportLabel: "¿Encontraste un error de traducción? Infórmalo",
      copyLinkLabel: "idioma",
    },

    reduceMotion: {
      title: "Reducir movimiento",
      description: `Desactivar animaciones de la interfaz en ${BRAND_DISPLAY_NAME}.`,
      systemOverride:
        "La reducción de movimiento está habilitada por la configuración de accesibilidad de tu sistema.",
      copyLinkLabel: "reducir movimiento",
    },

    accentColor: {
      title: "Color de acento",
      description: `Elige el color principal de ${BRAND_DISPLAY_NAME} en una paleta inspirada en los contenedores de Firefox.`,
      copyLinkLabel: "color de acento",
      optionAriaLabel: (label: string) => `Usar ${label} como color de acento`,
      options: {
        teal: "Verde azulado",
        blue: "Azul",
        green: "Verde",
        yellow: "Amarillo",
        orange: "Naranja",
        red: "Rojo",
        pink: "Rosa",
        purple: "Morado",
        gray: "Gris",
      },
    },

    highContrast: {
      title: "Modo de alto contraste",
      description:
        "Aumenta el contraste del texto y la visibilidad de los bordes para mejorar la legibilidad.",
      copyLinkLabel: "modo de alto contraste",
    },
  },

  danger: {
    title: "Zona de peligro",
    description: `Estas acciones pueden sustituir, eliminar o restaurar la configuración y los datos de ${BRAND_DISPLAY_NAME} guardados en tu dispositivo.`,
    copyLinkLabel: "zona de peligro",

    spoofing: {
      title: TURN_OFF_PRODUCT,
      description: `Desactiva todas las protecciones de ${BRAND_DISPLAY_NAME} hasta que vuelvas a activarlas.`,
      copyLinkLabel: TURN_OFF_PRODUCT,
    },

    export: {
      title: "Exportar",
      description:
        "Descarga tus perfiles, reglas y opciones actuales como copia de seguridad en formato JSON.",
      button: "Exportar configuración",
      copyLinkLabel: "exportar configuración",
    },

    import: {
      title: "Importar",
      description:
        "Sustituye la configuración local actual por una copia de seguridad JSON exportada anteriormente.",
      button: "Importar configuración",
      copyLinkLabel: "importar configuración",
    },

    reload: {
      title: "Recargar",
      description:
        "Vuelve a cargar la configuración guardada por la extensión y descarta los cambios sin guardar de la vista actual.",
      button: "Recargar configuración",
      copyLinkLabel: "recargar configuración",
    },

    reset: {
      title: "Restablecer",
      description:
        "Restaura los valores predeterminados y elimina tus perfiles y reglas personalizados.",
      button: "Restablecer configuración",
      copyLinkLabel: "restablecer configuración",
      confirmTitle: "¿Restablecer configuración?",
      confirmBody:
        "Esta acción elimina de forma permanente tus perfiles, reglas y opciones personalizadas. No se puede deshacer.",
      onboardingToggleLabel: "Volver a ejecutar el asistente después de restablecer",
      onboardingToggleDescription:
        "Vuelve a abrir la guía inicial una vez borrada la configuración.",
    },
  },

  help: {
    title: "Avanzado",
    body1: `Usa Avanzado para ajustar las protecciones, desactivar temporalmente ${BRAND_DISPLAY_NAME} o gestionar la configuración y los datos guardados en tu dispositivo.`,
    body2:
      "Importar, exportar, recargar y restablecer te permiten trasladar la configuración entre navegadores, corregir errores o recuperar los datos guardados cuando algo deja de estar sincronizado.",
  },
} as const;
