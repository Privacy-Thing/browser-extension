export const settingsImport = {
  title: "Revisar importación de configuración",
  description:
    "Revisa los cambios antes de guardar. Cancelar conserva tu configuración actual.",
  replace: "Reemplazar configuración",
  merge: "Combinar perfiles y reglas seleccionados",
  mergeHelp:
    "La combinación conserva los demás ajustes, sitios de confianza y la regla predeterminada. Selecciona cada perfil y regla.",
  confirm: "Confirmar importación",
  review: "Actualizar vista previa",
  undo: "Deshacer última importación",
  retention:
    "Se guarda una copia local durante 7 días. Cualquier edición posterior impide deshacer. Deshacer restaura ajustes, no cookies, inicios de sesión ni sesiones web.",
  undoSuccess: "Configuración anterior restaurada.",
  success: "Configuración importada.",
  failed: "Error de importación.",
  choose: "Elige una resolución",
  importChoice: "Importar / reemplazar",
  keep: "Conservar local",
  copy: "Importar como perfil nuevo",
  skip: "Omitir",
  added: "Añadido",
  changed: "Modificado",
  removed: "Eliminado",
  before: "Antes",
  after: "Después",
  noChanges: "Sin cambios de configuración.",
  containerHelp:
    "Los ID de contenedor pertenecen a otra instalación de Firefox. Asigna cada elemento a un contenedor local u omítelo explícitamente. La asignación reemplaza la del contenedor local.",
  containers: "Contenedores de Firefox",
  locations: "Perfiles",
  rules: "Reglas",
  trustedSites: "Sitios de confianza",
  settings: "Ajustes",
  containerAssignments: "Asignaciones de contenedores",
  conflict: "Conflicto",
  resolve: "Resuelve los conflictos indicados antes de confirmar.",
  selectAll: "Seleccionar todo",
  skipAll: "Omitir todo",
  technicalDetails: "Detalles técnicos",
  timeZoneHint:
    "Edite el archivo para usar una zona horaria compatible y vuelva a importarlo.",
  timeZoneTitle: "Elige zonas horarias compatibles",
  timeZoneHelp:
    "Este navegador no admite la zona horaria de los siguientes perfiles. Elige una zona horaria para cada uno. La importación se vuelve a comprobar cuando todos tengan una.",
  timeZoneRejected: (timeZone: string) =>
    `Zona horaria no compatible en el archivo: ${timeZone}`,
  timeZoneChoose: "Elige una zona horaria",
} as const;
