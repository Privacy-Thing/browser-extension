import { BRAND_DISPLAY_NAME } from "@/shared/brand";

const PRODUCT_NOT_LOWER = `qué ${BRAND_DISPLAY_NAME} no es`;

export const locations = {
  title: "Perfiles regionales",
  description:
    "Los perfiles regionales agrupan coordenadas, configuración regional y zona horaria para simularlas.",
  addManualButton: "Agregar manualmente",
  actionsMenuLabel: "Acciones del perfil",
  generateButton: "Generar perfil",
  searchPlaceholder: "Buscar perfiles…",
  unused: "Sin usar",
  assigned: (count: number) =>
    `${count} ${count === 1 ? "asignación" : "asignaciones"}`,
  viewAssignedRulesAriaLabel: (locationLabel: string, count: number) =>
    `Mostrar ${count} ${count === 1 ? "regla de dominio asignada" : "reglas de dominio asignadas"} a ${locationLabel}`,
  copyLinkLabel: "perfiles regionales",
  copyLinkHelpLabel: "ayuda de perfiles regionales",

  playgroundCard: {
    title: "Área de pruebas",
    body1:
      "Previsualiza un perfil guardado antes de asignarlo a sitios. El Área de pruebas muestra su configuración regional, zona horaria, formato de fecha y coordenadas simuladas con el mismo comportamiento de geolocalización que los sitios protegidos.",
    body2:
      "De forma predeterminada, el Área de pruebas actualiza la geolocalización simulada cada 2-5 segundos para facilitar la inspección del movimiento. Los sitios reales usan el intervalo de actualización configurado.",
  },

  help: {
    title: "Perfiles regionales",
    body1:
      "Un perfil regional debe representar un lugar creíble. Mantén su configuración regional, sus idiomas y su zona horaria alineados con la región de las coordenadas.",
    body2: `Los cambios se guardan automáticamente. Cuando editas un campo, ${BRAND_DISPLAY_NAME} escribe la actualización después de una breve pausa.`,
    body3:
      "Un perfil regional guardado cambia valores del navegador como la geolocalización, la configuración regional y la zona horaria. No cambia tu dirección IP ni la ruta de tu tráfico.",
    privacyTitle: "Privacidad",
    privacyBody: `La búsqueda y las vistas previas del mapa son opcionales. ${BRAND_DISPLAY_NAME} solo contacta a OpenStreetMap Nominatim para búsqueda y a OpenFreeMap para vistas previas interactivas del mapa después de que lo permitas.`,
    networkTitle: "Límites de red",
    networkBodyPrefix:
      "¿Necesitas cambiar la ubicación a nivel de red? Usa una VPN, un proxy o una herramienta DNS. Consulta ",
    networkBodyLinkLabel: PRODUCT_NOT_LOWER,
    networkBodySuffix: ".",
  },

  editor: {
    title: "Editar perfil",
    description:
      "Actualiza el perfil regional guardado, incluidas sus coordenadas, formatos regionales y forma de informar de la ubicación.",
    deleteBlockedTitle: "Este perfil aún está asignado",
    deleteBlockedDescription:
      "Cambia o elimina todas las asignaciones indicadas a continuación antes de eliminar el perfil.",
    deleteBlockedButtonTitle:
      "Elimina todas las asignaciones antes de borrar este perfil.",
    disabledDependencySuffix: "(desactivado)",
    mapDisabledTitle: "Mapa desactivado",
    mapDisabledBody:
      "La vista previa del mapa no se ha cargado porque no permitiste solicitudes externas de mapas.",
    geolocationSectionTitle: "Geolocalización",
    geolocationSectionDescription:
      "Coordenadas, precisión y el máximo rango permitido para posiciones simuladas.",
    localeSectionTitle: "Hora y idioma",
    localeSectionDescription:
      "Mantén los valores regionales alineados con la región de las coordenadas guardadas.",
    primaryLocaleLabel: "Configuración regional principal",
    languageDescription:
      "Es el formato regional principal del perfil para fechas, números y otros valores localizados.",
    languageBehaviorDescription:
      "Cuando «Preferir inglés en los sitios web» está desactivado, los sitios también ven este valor como navigator.language. Aunque el inglés aparezca primero, esta configuración regional sigue controlando el formato predeterminado de fechas y números.",
    preferredLanguagesLabel: "Idiomas preferidos",
    languagesDescription:
      "Lista ordenada de preferencias de idioma del navegador para este perfil.",
    languagesBehaviorDescription: `${BRAND_DISPLAY_NAME} expone este orden como navigator.languages y en las preferencias de idioma relacionadas. Mantén primero la configuración regional principal y añade después idiomas alternativos verosímiles para este perfil.`,
    preferEnglishContentLabel: "Preferir inglés en sitios web",
    preferEnglishContentDescriptionPrefix: `${BRAND_DISPLAY_NAME} mantiene la configuración regional guardada como tu referencia regional, pero expone`,
    preferEnglishContentDescriptionSuffix:
      "como primera opción en las preferencias de idioma del navegador para aumentar la probabilidad de que los sitios permanezcan en inglés.",
    preferEnglishContentLockedTagTitle: (locale: string) =>
      `${locale} se añade debido a la preferencia de usar el navegador en inglés y no se puede eliminar aquí.`,
    accuracyDescription:
      "Controla el valor de precisión que los sitios web ven en los resultados de geolocalización.",
    noiseRadiusDescription:
      "Distancia máxima permitida entre las coordenadas simuladas y el punto guardado de este perfil.",
  },

  generator: {
    title: "Generar perfil",
    searchStepDescription:
      "Busca una ciudad, una dirección o un lugar para crear un perfil.",
    resultStepDescription: `Elige el resultado correcto antes de que ${BRAND_DISPLAY_NAME} cree el perfil.`,
    languageStepDescription:
      "Elige el idioma del navegador que servirá de base para este perfil antes de revisar el resto.",
    confirmStepDescription: "Confirma el perfil en el mapa antes de añadirlo.",
    locationLabel: "Ubicación",
    locationPlaceholder: "Varsovia, Polonia",
    osmDisclaimer:
      "Las consultas de búsqueda utilizan la API externa Nominatim de OpenStreetMap. Las vistas previas interactivas usan las teselas vectoriales y fuentes de OpenFreeMap después del consentimiento.",
    resultSelectLabel: "Resultado de búsqueda",
    resultStepBody:
      "OpenStreetMap devolvió más de una coincidencia posible. Selecciona el lugar que querías, luego continúa.",
    resultStepHint: "Elige un resultado para continuar.",
    languageSelectLabel: "Idioma del navegador",
    languageStepBody:
      "Hay más de un idioma del navegador disponible para este lugar. Elige el que quieras usar en el perfil.",
    languageStepHint:
      "Si el idioma que deseas no aparece a continuación, puedes elegir otro en el siguiente paso.",
    resultPrefix: "Resultado: ",
  },
} as const;
