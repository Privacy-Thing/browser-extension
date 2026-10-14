import type { ControlDMessages } from "./ui-copy-en";

import { BRAND_DISPLAY_NAME } from "@/shared/brand";
export const controlDEs = {
  title: "Control D",
  featureTitle: "Integración con Control D",
  featureDescription:
    "Sincroniza reglas regionales con un perfil de Control D independiente.",
  beta: "Beta",
  privacyPolicy: "Privacidad de Control D",
  ownPrivacyPolicy: `Privacidad de ${BRAND_DISPLAY_NAME}`,
  intro: {
    title: "Antes de conectar",
    purpose:
      "Control D es un servicio de DNS y enrutamiento de tráfico. Esta integración sincroniza tus reglas regionales con un perfil de Control D independiente para que esos sitios usen salidas correspondientes. La sincronización va en un solo sentido, desde esta extensión. Necesitas tu propia cuenta de Control D y una clave API con permiso de escritura.",
    resources:
      "Tras conectar, se crean un perfil, un endpoint del navegador y carpetas de reglas (una por salida). El reconocimiento de servicios puede crear un perfil y un endpoint de consulta opcionales. Estos recursos permanecen en tu cuenta de Control D al desconectar, salvo que elijas eliminarlos durante la desconexión.",
    namesTitle: "Nombres de recursos aleatorios",
    names: `Los nombres usan un código aleatorio, nunca los nombres de tus preajustes: «${BRAND_DISPLAY_NAME} XXXXX-XXXXX», «PT Browser XXXXX-XXXXX» («PT Firefox XXXXX-XXXXX» en Firefox), «PT XXXXX-XXXXX <ROUTE>». Recursos de consulta opcionales: «PT Lookup XXXXX-XXXXX», «PT Probe XXXXX-XXXXX».`,
    data: "Control D recibe los nombres de host de tus reglas de dominio, las salidas elegidas y estos nombres de recursos. Solo con el reconocimiento de servicios, se envía también un host de una regla como consulta DNS sobre HTTPS que solicita no registrarse (no_log=1). No se envían nombres ni coordenadas de preajustes. Tu clave API queda en esta instalación, fuera de las exportaciones y la sincronización del navegador.",
    limits:
      "Esta extensión no cambia automáticamente el DNS del navegador ni cambia tu dirección IP por sí sola. Configuras el DNS seguro en un paso posterior; Control D solo enruta el tráfico tras configurar su resolutor.",
  },
  open: "Abrir Control D",
  back: "Volver a Avanzado",
  lead: "Envía reglas regionales a Control D. Los cambios parten de esta extensión.",
  progressLabel: "Progreso de configuración",
  enableLabel: "Activar integración",
  status: {
    loading: "Cargando",
    disconnected: "Sin conectar",
    authError: "Error de autorización",
    conflict: "Requiere revisión",
    syncError: "Error de sincronización",
    syncing: "Sincronizando",
    chooseSetup: "Elige una configuración",
    review: "Listo para revisar",
    dnsPending: "Reglas sincronizadas · Verifica DNS",
    active: "Activo",
  },
  account: {
    consent:
      "Al conectar se crean un perfil, un endpoint del navegador y carpetas de reglas con nombres aleatorios, o se reutiliza una configuración compatible. Los recursos permanecen después de desconectar, salvo que elijas eliminarlos.",
    title: "Conectar cuenta",
    description:
      "Usa una clave API con permiso de escritura. Se guarda en esta instalación y queda fuera de las exportaciones y la sincronización del navegador.",
    placeholder: "Clave API de Control D",
    connect: "Conectar",
    connectedTitle: "Acceso API verificado",
    connectedDescription:
      "El acceso a la cuenta funciona. El paso Reglas muestra los cambios de sincronización.",
    docs: "Instrucciones de la API",
    permissionDenied: "No se concedió acceso a la API de Control D.",
  },
  setup: {
    adopted: (name: string) => `Se volvió a conectar a ${name}.`,
    foreignReview:
      "Esta configuración contiene reglas no creadas por esta extensión. Revisa el plan antes de aplicarlo.",
    title: "Elegir configuración",
    description: `Crea una configuración independiente o vuelve a conectar una creada por ${BRAND_DISPLAY_NAME}.`,
    none: "No se encontraron configuraciones compatibles.",
    existing: "Configuraciones existentes",
    missingEndpoint: "Se creará un endpoint al aplicar los cambios.",
    blocked: "Resuelve primero los conflictos de esta configuración en Control D.",
    useExisting: "Usar esta configuración",
    createNew: "Crear configuración",
    confirmTitle: "¿Usar esta configuración?",
    confirmDescription:
      "Después de conectar, los cambios sencillos se aplican automáticamente. Las decisiones se muestran para su revisión.",
    folders: (count: number) => `Carpetas: ${count}`,
  },
  rules: {
    consentRequired:
      "Las rutas aproximadas nuevas o modificadas necesitan tu aprobación para continuar la sincronización.",
    applyApproximate: "Aplicar con rutas aproximadas",
    appliedAutomatically:
      "Las reglas se sincronizaron automáticamente. Configura el DNS del navegador a continuación.",
    applied: "Reglas sincronizadas. Configura el DNS del navegador a continuación.",
    title: "Revisar cambios",
    description: "Revisa este plan antes de cambiar los recursos administrados.",
    preview: "Actualizar vista previa",
    apply: "Aplicar cambios",
    repair: "Reparar reglas",
    sync: "Sincronizar ahora",
    routes: "Rutas personalizadas",
    showRoutes: "Revisar rutas",
    hideRoutes: "Ocultar rutas",
    acceptApproximate: "Acepto las rutas aproximadas de esta vista previa.",
    upToDate: "Las reglas están actualizadas.",
    routeDescription: "Cambia una selección automática solo si necesitas otra salida.",
  },
  dns: {
    title: "Configurar DNS del navegador",
    description: `Configura DNS seguro en el navegador. ${BRAND_DISPLAY_NAME} no puede cambiarlo ni verificarlo automáticamente.`,
    copy: "Copiar resolvedor",
    copied: "Copiado",
    settings: "Abrir ajustes de DNS",
    verify: "Verificar en Control D",
    guide: "Instrucciones",
    confirm: "He verificado este resolvedor",
    verified: "DNS verificado",
    verifiedDescription:
      "Confirmaste este endpoint en la página de estado de Control D.",
    verifiedState: "Verificado",
    unverifiedState: "Sin verificar",
  },
  overview: {
    codeTitle: "Código de identificación de recursos",
    codeDescription:
      "Este código aleatorio identifica el perfil, el endpoint y las carpetas para volver a conectar.",
    title: "Resumen de integración",
    account: "Acceso API",
    rules: "Reglas administradas",
    dns: "DNS del navegador",
    review: "Revisar cambios",
    verify: "Verificar DNS de nuevo",
    setupLabel: (code: string) => `Configuración ${code}`,
    syncedAt: (time: string) => `Sincronizado ${time}`,
  },
  summary: {
    created: (p: number, e: number, f: number) =>
      `Creados: perfil ${p}, endpoint ${e}, carpetas ${f}`,
    willCreate: (p: number, e: number, f: number) =>
      `Se crearán: perfil ${p}, endpoint ${e}, carpetas ${f}`,
    ruleChanges: (a: number, u: number, r: number) =>
      `Reglas: añadir ${a}, actualizar ${u}, eliminar ${r}`,
    profiles: "Perfiles",
    endpoints: "Endpoints",
    folders: "Carpetas",
    add: "Añadir",
    update: "Actualizar",
    remove: "Eliminar",
  },
  disconnect: {
    action: "Desconectar",
    title: "¿Desconectar Control D?",
    description:
      "Olvida la clave API y detén la sincronización. Los recursos remotos y los ajustes de DNS permanecen.",
    confirm: "Desconectar",
  },
  common: {
    dismiss: "Cerrar",
    cancel: "Cancelar",
    continue: "Continuar",
    notYet: "Todavía no",
    working: "Procesando…",
    selected: "Seleccionado",
    requestFailed: "La solicitud a Control D falló.",
    copyFailed: "No se pudo copiar el resolvedor.",
    applyFirst: "Aplica los cambios para crear un endpoint y un resolvedor.",
    confirmedAt: (time: string) => `Confirmado ${time}`,
  },
  help: {
    account: {
      title: "Tu clave se queda aquí",
      body: "Conectar permite a la extensión acceder a Control D. La clave permanece en este navegador.",
      note: "Se necesita acceso de escritura para crear y actualizar reglas regionales.",
    },
    setup: {
      title: "Una configuración independiente",
      body: "Usa una configuración nueva o vuelve a conectar una existente. Las demás conservan sus ajustes.",
      note: "Después de conectar, los cambios sencillos se aplican automáticamente. Las decisiones se muestran para su revisión.",
    },
    rules: {
      title: "Revisar y aplicar",
      body: "La vista previa muestra las adiciones, cambios y eliminaciones previstas.",
      note: "Los cambios afectan a los recursos administrados de esta configuración.",
    },
    dns: {
      title: "Configura DNS en el navegador",
      body: "Copia el resolvedor y úsalo como DNS seguro en los ajustes del navegador.",
      note: "Revisa la página de estado de Control D y confirma aquí este resolvedor.",
    },
    overview: {
      title: "Tres comprobaciones",
      body: "El acceso a la cuenta, la sincronización y el DNS se verifican por separado.",
      note: "Desconectar elimina la clave y detiene la sincronización. El DNS y los recursos remotos permanecen.",
    },
  },
  route: {
    notSynchronized: "Sin sincronizar",
    unavailable: "Salida no disponible",
    exact: "Salida más cercana en el mismo país.",
    approximate: "Salida aproximada. Elige otra si es necesario.",
    skipped: "Excluido de la sincronización.",
    change: "Cambiar",
    choose: "Elegir salida",
    skip: "Omitir sincronización",
    ruleCount: (count: number) => `Reglas: ${count}`,
    selectLabel: (location: string) => `Salida para ${location}`,
  },
  steps: ["Cuenta", "Configuración", "Reglas", "DNS"],
} satisfies ControlDMessages;
