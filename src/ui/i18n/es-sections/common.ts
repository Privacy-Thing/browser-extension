import { BRAND_DISPLAY_NAME } from "@/shared/brand";

export const common = {
  copyLinkTo: (section: string) => `Copiar enlace a ${section}`,

  actions: {
    cancel: "Cancelar",
    reset: "Restablecer",
    close: "Cerrar",
    create: "Crear",
    save: "Guardar",
    back: "Atrás",
    continue: "Continuar",
    edit: "Editar",
    delete: "Eliminar",
    duplicate: "Duplicar",
    search: "Buscar",
    clear: "Borrar",
    deleteSelected: "Eliminar seleccionado",
    clearSelection: "Borrar selección",
    openPrivacyPolicy: "Abrir política de privacidad",
    allowOpenStreetMap: "Permitir acceso al mapa",
    notNow: "Ahora no",
    openPlayground: "Abrir Área de pruebas",
  },
  selectionCount: (count: number) =>
    `${count} ${count === 1 ? "seleccionado" : "seleccionados"}`,

  fields: {
    name: "Nombre",
    latitude: "Latitud",
    longitude: "Longitud",
    accuracy: "Precisión",
    noiseRadius: "Radio máximo (m)",
    timeZone: "Zona horaria",
  },

  coordinateRandomization: {
    labelBefore: "Aleatorizar coordenadas dentro de",
    labelAfter: "km.",
    radiusInputLabel: "Radio de aleatorización de coordenadas en kilómetros",
    readWhy: "Leer por qué.",
    tooltipPrivacy: `${BRAND_DISPLAY_NAME} está orientado a la privacidad. Los perfiles deben ser fáciles de usar, pero reutilizar las coordenadas exactas de un catálogo o una búsqueda podría facilitar que se reconozca a sus usuarios.`,
    tooltipExact: `¿Necesitas una ubicación concreta? Desactiva este interruptor y ${BRAND_DISPLAY_NAME} usará las coordenadas exactas. Puedes cambiar los valores predeterminados en Opciones > Geolocalización > Avanzado.`,
  },
} as const;
