import { BRAND_DISPLAY_NAME } from "@/shared/brand";

const PRODUCT_NOT_LOWER = `qué ${BRAND_DISPLAY_NAME} no es`;

export const rules = {
  title: "Reglas de dominio",
  hint: "Las reglas de dominio asignan patrones de host a perfiles regionales.",
  addButton: "Agregar regla",
  filterLabel: "Filtrar reglas",
  filterPlaceholder: "Buscar perfiles, patrones de dominio o advertencias",
  locationFilterLabel: "Filtrar por perfil",
  locationFilterPlaceholder: "Todos los perfiles",
  assignLocationLabel: "Asignar perfil",
  tableHeadRule: "Regla",
  tableHeadProfile: "Perfil",
  tableHeadActions: "Acciones",
  selectAllAriaLabel: "Seleccionar todas las reglas visibles",
  selectMenuAriaLabel: "Abrir menú de selección de reglas",
  selectRuleAriaLabel: (pattern: string) => `Seleccionar regla ${pattern}`,
  editRuleAriaLabel: (pattern: string) => `Editar regla ${pattern}`,
  editRuleTitle: "Editar regla",
  deleteRuleAriaLabel: (pattern: string) => `Eliminar regla ${pattern}`,
  deleteRuleTitle: "Eliminar regla",
  inactiveBadge: "inactivo",
  selectionMenuAllVisible: "Todas las visibles",
  selectionMenuAll: "Todas",
  selectionMenuNone: "Ninguna",
  selectionMenuActive: "Solo activas",
  selectionMenuInactive: "Solo inactivas",
  noRulesFiltered: "Ninguna regla coincide con el filtro actual.",
  noRulesEmpty: `Aún no hay reglas de dominio. Añade una para elegir cómo gestiona ${BRAND_DISPLAY_NAME} los sitios coincidentes.`,
  copyLinkLabel: "reglas de dominio",
  copyLinkHelpLabel: "ayuda de reglas de dominio",
  copyLinkInspectorLabel: "inspector de nombres de host",
  copyLinkRuleAriaLabel: (pattern: string) => `Copiar enlace de la regla ${pattern}`,

  help: {
    title: "Reglas de dominio",
    body1:
      "Usa <code>example.com</code> para un solo host exacto. Usa <code>*example.com</code> para ese host y cualquier subdominio, como <code>www.example.com</code>. Usa <code>*.example.com</code> solo para subdominios.",
    body2: `El patrón de coincidencia más específico gana. Si dos reglas se superponen y apuntan a diferentes perfiles regionales, ${BRAND_DISPLAY_NAME} advierte al respecto.`,
  },

  globalFallback: {
    title: "Regla predeterminada",
    description: `Define las protecciones predeterminadas y el perfil opcional que ${BRAND_DISPLAY_NAME} usa cuando no tiene prioridad ninguna opción más específica.`,
    copyLinkLabel: "Regla predeterminada",
    overridesBadge: (count: number) =>
      `${count} configuración personalizada${count === 1 ? "" : "s"}`,
    openInRules: "Editar en Reglas de dominio",
    editAriaLabel: "Editar regla predeterminada",
    editTitle: "Editar regla predeterminada",
    noPresetLabel: "No hay perfil asignado",
    setupHint: "Aún no hay ningún perfil ni protección personalizada.",
    tableHint: "Configuración predeterminada cuando no se aplica nada más específico.",
    dialog: {
      title: "Regla predeterminada",
      description:
        "Define las protecciones y el perfil opcional que usará la Regla predeterminada cuando no tenga prioridad ninguna opción más específica.",
      identityDescription:
        "La Regla predeterminada mantiene su propia identidad simulada y fija. No se puede cambiar manualmente.",
      enabledLabel: "Activada",
      enabledHint:
        "Cuando está desactivada, esta regla no se aplica. Sus opciones permanecen guardadas.",
      enabledAriaLabel: "Activar o desactivar la Regla predeterminada",
      locationProfileLabel: "Perfil regional",
      locationProfileHint:
        "Elige el perfil que debe usar la Regla predeterminada. Déjalo sin asignar para usar únicamente las protecciones indicadas a continuación.",
      locationProfileWarningPrefix: `${BRAND_DISPLAY_NAME} no reemplaza VPN, proxy o herramientas DNS. `,
      locationProfileWarningLinkLabel: `Ver ${PRODUCT_NOT_LOWER}`,
      locationProfileWarningSuffix: ".",
      locationLabel: "Perfil",
      locationPlaceholder: "Elegir perfil",
      submit: "Guardar regla",
    },
  },

  inspector: {
    title: "Inspector de nombres de host",
    hint: `Comprueba cómo ${BRAND_DISPLAY_NAME} tratará un nombre de host antes de guardar los cambios. Indica si coincide con una regla de dominio o un sitio de confianza, y qué perfil regional se aplicaría.`,
    hostnameLabel: "Nombre de host",
    hostnameHint:
      "Usa el host exacto que quieras inspeccionar, por ejemplo shop.example.com.",
    hostnamePlaceholder: "p. ej., shop.example.com",
    noMatchTitle:
      "Ninguna regla de dominio ni sitio de confianza coincide con este nombre de host",
    noMatchDescription:
      "No se aplica ninguna regla guardada y la Regla predeterminada está desactivada o sin configurar.",
    trustedSiteWinsTitle:
      "Este nombre de host está desactivado mediante Sitios de confianza",
    trustedSiteWinsDescription: `Coincide con tu lista de Sitios de confianza, por lo que ${BRAND_DISPLAY_NAME} permanecerá desactivado aquí hasta que elimines o desactives esa entrada.`,
    trustedSiteOverridesRuleTitle:
      "Sitios de confianza anula una regla de dominio coincidente",
    trustedSiteOverridesRuleDescription: `Este nombre de host coincide tanto con un sitio de confianza como con una regla de dominio. Sitios de confianza tiene prioridad, por lo que ${BRAND_DISPLAY_NAME} permanece desactivado y se ignora la regla indicada a continuación.`,
    fallbackWinsTitle: "Aquí se aplica la Regla predeterminada",
    fallbackWinsDescription: `Ninguna regla de dominio ni sitio de confianza coincide con este nombre de host, por lo que ${BRAND_DISPLAY_NAME} recurriría aquí a la Regla predeterminada.`,
    ruleMatchTitle: (locationLabel: string) =>
      `${locationLabel} es el perfil activo aquí`,
    ruleMatchDescription: `Este nombre de host coincide con la regla de dominio indicada a continuación, por lo que ${BRAND_DISPLAY_NAME} usaría este perfil en el sitio.`,
    hostnameDetailLabel: "Nombre de host",
    trustedSiteDetailLabel: "Sitio de confianza",
    ruleDetailLabel: "Regla",
    defaultRuleDetailLabel: "Regla predeterminada",
    ignoredRuleDetailLabel: "Regla ignorada",
    profileDetailLabel: "Perfil regional",
    geolocationDetailLabel: "Geolocalización",
    localeDetailLabel: "Configuración regional",
    timeZoneDetailLabel: "Zona horaria",
    geolocationOn: "Activado",
    geolocationOff: "Desactivado",
  },

  dialog: {
    titleAdd: "Agregar regla",
    titleEdit: "Editar regla",
    description:
      "Elige dónde se aplica esta regla y decide si debe usar un perfil, protecciones personalizadas o ambos.",
    patternLabel: "Patrón",
    patternInfo:
      "Usa <code>example.com</code> para un solo host exacto. Usa <code>*example.com</code> para ese host y cualquier subdominio, como <code>www.example.com</code>. Usa <code>*.example.com</code> solo para subdominios.",
    patternInfoAriaLabel: "Aprende cómo funcionan los patrones de regla",
    patternPlaceholder: "Introduce un patrón de dominio",
    locationLabel: "Perfil",
    locationProfileLabel: "Perfil regional",
    locationProfileHint: `Elige el perfil que debe usar esta regla. Si no asignas ninguno, ${BRAND_DISPLAY_NAME} usa el siguiente perfil disponible y conserva las protecciones de la regla.`,
    bulkAssignSearchPlaceholder: "Buscar perfiles…",
    enabledLabel: "Activada",
    enabledHint:
      "Cuando está desactivada, esta regla no se aplica. Sus opciones permanecen guardadas.",
    enabledAriaLabel: (pattern: string) => `Activar o desactivar la regla ${pattern}`,
    advancedModal: {
      trigger: "Avanzado",
      title: (pattern: string) => `Configuración avanzada de ${pattern}`,
      description:
        "Estos cambios permanecen en el borrador actual hasta que guardes la regla.",
      confirm: "Aceptar",
      patternFallback: "esta regla",
    },
    relaxCspLabel: "Relajar la CSP para proteger workers",
    relaxCspHint: `Elimina las cabeceras de la Política de Seguridad de Contenido del sitio cuando impiden que ${BRAND_DISPLAY_NAME} proteja sus workers.`,
    relaxCspRiskHint:
      "Advertencia de seguridad: esto facilita la ejecución de scripts maliciosos en el sitio. Actívalo únicamente en un sitio de confianza y cuando la protección de workers no funcione de otro modo.",
    relaxCspAriaLabel: (pattern: string) =>
      `Alternar relajación de CSP para la regla ${pattern}`,
    surfaceOverrides: {
      title: "Configuración de protección",
      description:
        "Elige protecciones distintas para esta regla. Deja una opción en Heredar para usar la configuración global.",
      stateOn: "Activado",
      stateInherit: "Heredar",
      stateOff: "Desactivado",
      stateNative: "Nativo",
      stateSpoof: "Simular",
      stateStrict: "Estricto",
      stateBlock: "Bloquear",
      stateAllow: "Permitir",
      helpAriaLabel: (label: string) => `Aprende qué ${label} controla`,
      geolocation: {
        label: "Geolocalización",
        info: "Controla la API de geolocalización. Desactívala cuando un sitio deba leer la ubicación real del navegador o actívala cuando esta regla deba simular las consultas de ubicación.",
      },
      timeLocale: {
        label: "Hora y configuración regional",
        info: "Controla Date, Intl, navigator.language, navigator.languages y las cabeceras de idioma para que los sitios vean la región del perfil activo.",
      },
      canvas: {
        label: "Canvas",
        info: "Controla la salida de imágenes ocultas que los sitios usan para la huella digital de canvas.",
      },
      webGL: {
        label: "WebGL",
        info: "Controla detalles gráficos como el renderer, pistas de GPU y datos relacionados con la huella digital de WebGL.",
      },
      audio: {
        label: "Audio",
        info: "Controla la salida de AudioContext que los sitios pueden medir para la huella digital de audio.",
      },
      navigator: {
        label: "Navigator",
        info: "Controla campos de identidad del navegador como plataforma, pistas de hardware y otras propiedades de navigator.",
      },
      screen: {
        label: "Pantalla",
        info: "Controla el tamaño de pantalla, la proporción de píxeles y detalles de visualización relacionados.",
      },
      clientHints: {
        label: "Client Hints",
        info: "Controla los datos del navegador y del dispositivo compartidos mediante cabeceras y API de Client Hints.",
      },
      battery: {
        label: "Batería",
        info: "Controla si el sitio recibe un perfil de batería llena y en carga en lugar del estado real de la batería del dispositivo.",
      },
      webRTC: {
        label: "WebRTC",
        info: "Controla la protección de manejo de IP de WebRTC que puede reducir las filtraciones de IP locales y públicas.",
      },
      serviceWorker: {
        label: "Service Workers",
        info: "Controla si este sitio puede registrar Service Workers, que pueden ejecutarse en segundo plano y mantener datos a largo plazo. Bloquear puede romper las PWAs, el modo offline, las notificaciones push y la sincronización en segundo plano; Permitir deja que el navegador maneje el registro normalmente; Heredar sigue la configuración global.",
      },
      sharedWorker: {
        label: "Dedicated y Shared Workers",
        info: "Sustituye el modo de los Dedicated y Shared Workers para esta regla. Nativo no modifica los workers, Simular intenta aplicar valores simulados y Estricto bloquea un worker cuando no puede confirmar la protección antes de iniciarlo.",
      },
    },
    identity: {
      sectionTitle: "Identidad",
      sectionDescription:
        "Esta regla conserva su propia identidad simulada. Rótala únicamente cuando quieras una huella digital nueva y borrar el estado de los sitios asociados a la regla.",
      actionDescription:
        "Borra los datos relacionados del sitio y comienza esta regla con una identidad nueva.",
      actionLabel: "Nueva identidad",
      confirmTitle: (pattern: string) => `Nueva identidad para ${pattern}?`,
      confirmDescription:
        "Esto borra cookies, almacenamiento, Service Workers y cachés de los sitios vinculados a esta regla. Luego crea una nueva identidad de simulación.",
      confirmDomainsLabel: `${BRAND_DISPLAY_NAME} borrará datos del navegador para estos dominios:`,
      confirmNoDomains: `Aún no se ha registrado ningún dato del navegador para esta regla. ${BRAND_DISPLAY_NAME} todavía creará una nueva identidad de simulación.`,
      confirmLabel: "Crear nueva identidad",
      rotateSuccess: "Se ha guardado una nueva identidad para la regla.",
      rotateError: "Falló la creación de una nueva identidad de regla.",
    },
    submitAdd: "Agregar regla",
    submitEdit: "Guardar",
    duplicateAlertTitle: "¿Sobrescribir la regla existente?",
    duplicateAlertDescription: (pattern: string) =>
      `Ya existe una regla para «${pattern}». ¿Quieres sustituirla por esta configuración?`,
    duplicateAlertConfirm: "Sobrescribir",
    duplicateAlertClose: "No",
    trustedSiteOverrideWarning: (pattern: string) =>
      `Este dominio coincide con la entrada «${pattern}» de Sitios de confianza. ${BRAND_DISPLAY_NAME} permanecerá desactivado aquí independientemente de estas opciones.`,
  },
} as const;
