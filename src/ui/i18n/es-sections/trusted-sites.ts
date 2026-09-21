import { BRAND_DISPLAY_NAME } from "@/shared/brand";

export const trustedSites = {
  title: "Sitios de confianza",
  hint: `Sitios en los que ${BRAND_DISPLAY_NAME} permanece desactivado aunque se aplicara una regla, una asignación de contenedor o la Regla predeterminada.`,
  patternLabel: "Patrón de dominio",
  patternPlaceholder: "Introduce un patrón de dominio",
  filterLabel: "Filtrar sitios de confianza",
  filterPlaceholder: "Buscar dominio",
  addButton: "Agregar sitio web",
  copyLinkLabel: "sitios de confianza",
  copyLinkHelpLabel: "ayuda de sitios de confianza",
  copyLinkInspectorLabel: "inspector de nombres de host",
  tableHeadPattern: "Dominio",
  tableHeadStatus: "Estado",
  tableHeadActions: "Acciones",
  empty: "Aún no hay sitios de confianza.",
  filteredEmpty: "Ningún sitio de confianza coincide con el filtro actual.",
  inactiveBadge: "inactivo",
  toggleSiteAriaLabel: (pattern: string, enabled: boolean) =>
    `${enabled ? "Desactivar" : "Activar"} el sitio de confianza ${pattern}`,
  deleteSiteAriaLabel: (pattern: string) => `Eliminar el sitio de confianza ${pattern}`,
  deleteSiteTitle: "Eliminar sitio de confianza",
  duplicateWarning: "Ese sitio de confianza ya existe.",
  patternRequired: "Introduce un patrón de dominio.",
  saved: "Sitio de confianza guardado.",
  updated: "Sitio de confianza actualizado.",
  deleted: "Sitio de confianza eliminado.",
  help: {
    title: "Cuándo usar Sitios de confianza",
    body1:
      "Usa Sitios de confianza en dominios donde la simulación cause problemas, como procesos bancarios, pagos o recuperación de cuentas que puedan considerar sospechosos los cambios del navegador.",
    body2: `Sitios de confianza tiene prioridad sobre las reglas de dominio, las asignaciones de contenedores de Firefox y la Regla predeterminada. Usa <code>example.com</code> para un host exacto, <code>*example.com</code> para ese host y sus subdominios, o <code>*.example.com</code> solo para los subdominios.`,
  },
  rulesCta: {
    title: "Protección en otros sitios",
    activeRulesOnly: (count: number) =>
      `${count} ${count === 1 ? "regla de dominio activada se aplica" : "reglas de dominio activadas se aplican"} fuera de Sitios de confianza. Abre Reglas de dominio para revisar dónde están activas.`,
    activeRulesWithDefault: (count: number) =>
      `${count} ${count === 1 ? "regla de dominio activada se aplica" : "reglas de dominio activadas se aplican"} fuera de Sitios de confianza. La Regla predeterminada también cubre otros sitios que no coinciden.`,
    defaultRuleOnly: `La Regla predeterminada sigue aplicándose a los sitios que no coinciden. Sitios de confianza solo desactiva ${BRAND_DISPLAY_NAME} en los hosts coincidentes.`,
    openRules: "Abrir Reglas de dominio",
    openDefaultRule: "Abrir regla predeterminada",
  },
  dialog: {
    title: "Agregar sitio web",
    description: `Mantén ${BRAND_DISPLAY_NAME} desactivado en las páginas coincidentes cuando un sitio funcione mejor con el estado normal del navegador.`,
    patternInfo:
      "Usa <code>example.com</code> para un solo host exacto. Usa <code>*example.com</code> para ese host y cualquier subdominio, como <code>www.example.com</code>. Usa <code>*.example.com</code> solo para subdominios.",
    patternInfoAriaLabel: "Cómo funcionan los patrones de Sitios de confianza",
    submit: "Agregar sitio web",
  },
} as const;
