import { BRAND_DISPLAY_NAME } from "@/shared/brand";
import { externalMapConsentCopy } from "@/ui/i18n/es-sections/osm";

const WELCOME_PRODUCT = `Bienvenido a ${BRAND_DISPLAY_NAME}`;

export const welcome = {
  title: WELCOME_PRODUCT,
  loading: "Cargando configuración…",
  progressLabel: "Progreso de configuración",
  previous: "Anterior",
  next: "Siguiente",
  privacyPolicy: "Política de privacidad",
  privacyDialog: {
    title: "Política de privacidad",
    description: `Cómo gestiona ${BRAND_DISPLAY_NAME} la configuración, los diagnósticos y las solicitudes de red.`,
    close: "Cerrar política de privacidad",
  },
  saving: "Guardando…",
  unexpectedError: "Algo salió mal",
  importSuccess: "Configuración importada",
  importError: "No se pudo importar la configuración",
  importParseError: "No se pudo leer el archivo de configuración",
  steps: {
    welcome: {
      title: "Gracias por instalar esta extensión",
      description:
        "Elige qué verán los sitios en lugar de exponer tu ubicación real y la identidad de tu navegador. Esta breve guía opcional explica las primeras decisiones —todas reversibles— y las guarda en la misma Configuración que podrás revisar en cualquier momento. ¿Ya tienes una configuración que quieras reutilizar?",
      importInline: "Importar una configuración",
      advancedTitle: "Sé lo que quiero",
      advancedDescription:
        "Omite la guía y abre Configuración con los valores predeterminados. No se añadirán perfiles regionales ni reglas de dominio; la Regla predeterminada permanecerá desactivada y las protecciones del navegador estarán disponibles para las reglas que crees más adelante.",
      guidedTitle: "Ir a la configuración",
      guidedDescription:
        "Toma las primeras decisiones paso a paso. La guía limita las opciones, explica sus implicaciones y guarda todo en las mismas pantallas de Configuración que podrás editar después.",
      advancedCta: "Omitir configuración",
      guidedCta: "Iniciar configuración",
    },
    privacy: {
      title: "Tu navegación se mantiene local",
      description: `${BRAND_DISPLAY_NAME} guarda las reglas y los perfiles en tu dispositivo. Este paso solo se refiere a los servicios externos de mapas: actívalos si quieres usar la búsqueda y las vistas previas durante la configuración, o déjalos desactivados e introduce las coordenadas manualmente.`,
      descriptionBeforePolicy: `${BRAND_DISPLAY_NAME} guarda las reglas y los perfiles en tu dispositivo. La búsqueda y las vistas previas del mapa solo usan servicios externos después de que los autorices. Lee la`,
      policyLink: "política de privacidad",
      descriptionAfterPolicy:
        " antes de decidir si esas solicitudes se ajustan a tu configuración.",
      consentTitle: externalMapConsentCopy.title,
      consentDescription: externalMapConsentCopy.description,
    },
    presets: {
      title: "Agregar perfiles regionales",
      description:
        "Los perfiles regionales reúnen ubicaciones con sus idiomas y zonas horarias correspondientes, de modo que los sitios vean un conjunto de datos regionales coherente. Selecciona únicamente los lugares que quieras incluir al principio. El asistente importará los perfiles elegidos al finalizar y podrás editarlos o eliminarlos más adelante.",
      selectAll: "Seleccionar todo",
      selectNone: "Borrar todo",
      selectedCount: (count: number) =>
        `${count} ${count === 1 ? "seleccionado" : "seleccionados"}`,
    },
    scope: {
      title: "Elegir dónde comienza la protección",
      description:
        "La Regla predeterminada se aplica cuando no tiene prioridad ninguna opción más específica. Déjala desactivada para comenzar de forma más discreta o actívala para proteger los sitios que no coincidan con otras reglas.",
      defaultRuleDescription:
        "Si asignas un perfil regional a la Regla predeterminada, mantenlo seleccionado para que el asistente pueda importarlo antes de guardar.",
      enableEverywhereTitle: `Usar ${BRAND_DISPLAY_NAME} en todos los sitios`,
      enableEverywhereDescription: `Activa ahora la Regla predeterminada si quieres que ${BRAND_DISPLAY_NAME} proteja los sitios que no tengan una regla propia. Más adelante podrás limitar su comportamiento con reglas de dominio, asignar perfiles distintos a hosts concretos o excluir sitios sensibles mediante Sitios de confianza.`,
      editDefaultRuleTitle: "Configuración de la Regla predeterminada",
      editDefaultRule: "Editar regla predeterminada",
      editDefaultRuleDescription:
        "Elige el perfil y las protecciones personalizadas de la Regla predeterminada antes de finalizar la configuración.",
      defaultRuleDialogDescription:
        "Durante la configuración, este cuadro puede usar los perfiles regionales seleccionados aunque aún no se hayan importado. Si asignas uno aquí, mantenlo seleccionado para que el asistente pueda crearlo.",
      presetMismatch: (label: string) =>
        `La Regla predeterminada tiene asignado el perfil ${label}, pero no está seleccionado para importarlo. Vuelve a seleccionar ese perfil o elige otro para la Regla predeterminada.`,
    },
    chromium: {
      title: "Rotar detalles de la compilación de Chromium",
      description: (count: number) =>
        `${BRAND_DISPLAY_NAME} puede rotar los números de compilación y parche del motor Chromium expuestos mediante Client Hints, manteniendo la versión principal igual a la del navegador instalado. El catálogo incluido contiene compilaciones recientes de Chromium; para esta versión del navegador, ${BRAND_DISPLAY_NAME} puede elegir entre ${count} ${count === 1 ? "entrada compatible" : "entradas compatibles"}.`,
      switchTitle: "Rotar números de compilación y parche",
      switchDescription:
        "Usa números recientes de compilación y parche de Chromium del catálogo incluido al simular Client Hints. Desactiva esta opción si prefieres mantener fijos esos detalles de la versión.",
    },
    firefox: {
      title: "Permiso de userScripts de Firefox (opcional)",
      description: `Puedes usar ${BRAND_DISPLAY_NAME} en Firefox sin este permiso. Si concedes userScripts, ${BRAND_DISPLAY_NAME} puede aplicar valores simulados antes en sitios compatibles, mejorando la protección durante la primera carga de la página. Puedes omitirlo ahora y cambiarlo más tarde en Configuración.`,
      action: "Conceder permiso a userScripts",
      granted: "Permiso concedido",
      skipped: `Puedes seguir usando ${BRAND_DISPLAY_NAME} sin este permiso.`,
    },
    appearance: {
      title: "Hazlo cómodo",
      description: `Elige el aspecto de la interfaz antes de comenzar. Estos ajustes solo afectan a las pantallas de ${BRAND_DISPLAY_NAME}; no cambian la simulación en los sitios web, los perfiles regionales ni las reglas. Podrás modificar las mismas opciones más adelante desde Configuración.`,
      themeTitle: "Tema",
      themeDescription: `Usa el ajuste del sistema o elige una interfaz clara u oscura fija para todas las pantallas de ${BRAND_DISPLAY_NAME}.`,
      reduceMotionTitle: "Reducir movimiento",
      reduceMotionDescription: `Desactivar animaciones de la interfaz en ${BRAND_DISPLAY_NAME}.`,
      reduceMotionSystemOverride:
        "La reducción de movimiento está habilitada por la configuración de accesibilidad de tu sistema.",
      accentTitle: "Color de acento",
      accentDescription:
        "Elige el color de resaltado que se usará para los controles, estados activos, acentos de enfoque y elementos seleccionados.",
      contrastTitle: "Modo de alto contraste",
      contrastDescription:
        "Aumenta el contraste para texto, bordes y controles en toda la interfaz de la extensión cuando el aspecto predeterminado sea demasiado sutil.",
    },
    done: {
      title: "La configuración está lista",
      description: `${BRAND_DISPLAY_NAME} guardará estas opciones y abrirá Configuración. Allí podrás revisar los perfiles importados, ajustar la Regla predeterminada y cambiar la apariencia o las opciones de privacidad.`,
      cta: "Abrir Configuración",
    },
  },
  presetNames: {
    spfWarsaw: "Varsovia",
    spfParis: "París",
    spfLondon: "Londres",
    spfOttawa: "Ottawa",
    spfNewYork: "Nueva York",
    spfLasVegas: "Las Vegas",
    spfSanFrancisco: "San Francisco",
    spfSydney: "Sydney",
    spfBeijing: "Pekín",
    spfHongKong: "Hong Kong",
    spfNewDelhi: "Nueva Delhi",
    spfCairo: "El Cairo",
    spfLagos: "Lagos",
    spfKyiv: "Kiev",
    spfKinshasa: "Kinsasa",
    spfSaoPaulo: "São Paulo",
    spfBuenosAires: "Buenos Aires",
    spfLima: "Lima",
    spfRioDeJaneiro: "Rio de Janeiro",
    spfCaracas: "Caracas",
    spfBerlin: "Berlín",
    spfMadrid: "Madrid",
  },
  themeOptions: {
    system: "Sistema",
    light: "Claro",
    dark: "Oscuro",
  },
} as const;
