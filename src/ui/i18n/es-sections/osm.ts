import { BRAND_DISPLAY_NAME } from "@/shared/brand";

export const externalMapConsentCopy = {
  title: "Permitir búsqueda de ubicación y solicitudes de mapa",
  description: `Permite que ${BRAND_DISPLAY_NAME} envíe consultas a OpenStreetMap Nominatim cuando busques ubicaciones y solicite teselas vectoriales y fuentes a OpenFreeMap cuando se muestren vistas previas del mapa. Estos servicios reciben el texto de búsqueda, las solicitudes de mapas y fuentes, y tu dirección IP, pero no tus reglas, perfiles ni historial de navegación guardados. Mantén esta opción desactivada si prefieres introducir las coordenadas manualmente sin recurrir a servicios de mapas durante la configuración.`,
} as const;

export const osm = {
  modalTitle: "¿Permitir solicitudes externas de mapas y búsquedas?",
  body1: `El acceso externo a mapas es opcional. ${BRAND_DISPLAY_NAME} no envía por sí solo tus perfiles, reglas ni datos de navegación a estos servicios.`,
  body2: `Si permites esto, ${BRAND_DISPLAY_NAME} puede contactar a OpenStreetMap Nominatim para la búsqueda de ubicaciones y a OpenFreeMap para vistas previas interactivas del mapa.`,
} as const;
