import type { CleanupMessages } from "./cleanup-copy-en";

import { BRAND_DISPLAY_NAME } from "@/shared/brand";
export const cleanupEs = {
  title: "¿Desconectar Control D?",
  deleteChoice: `Desconectar y eliminar lo que creó ${BRAND_DISPLAY_NAME}`,
  keepChoice: "Desconectar",
  keepDescription:
    "Olvida la clave API y detiene la sincronización. Los recursos remotos y el DNS del navegador permanecen.",
  review: "Revisar plan de eliminación",
  planTitle: "Revisar qué se eliminará",
  planDescription:
    "Solo se pueden eliminar recursos registrados con nombres coincidentes y contenido sin cambios. Los recursos omitidos permanecerán.",
  dnsWarning:
    "Primero cambia el proveedor de DNS seguro del navegador para dejar de usar este resolvedor de Control D. Eliminar un endpoint interrumpe la resolución de nombres en todos los dispositivos que aún lo usan. Aquí no se cambia el DNS del navegador.",
  dnsConfirmed: "He cambiado el DNS de mi navegador",
  confirm: "Confirmar eliminación y desconectar",
  resultTitle: "Resultados de la limpieza",
  retry: "Revisar y reintentar los fallos",
  retainedKey:
    "La sincronización se ha detenido. La clave API y los registros de propiedad restantes se conservan localmente para reintentar. Desconecta sin eliminar para olvidar la clave ahora.",
  finished: "La sincronización se ha detenido y la clave API se ha olvidado.",
  close: "Cerrar",
  cancel: "Cancelar",
  working: "Procesando…",
  failedRequest: "La solicitud de limpieza falló. Revisa el plan antes de reintentar.",
  deleteLabel: "Se eliminará",
  skipped: "Omitido",
  deleted: "Eliminado",
  failed: "Fallido",
  folder: "Carpeta",
  rule: "Regla",
  service: "Configuración de servicio",
  endpoint: "Endpoint",
  profile: "Perfil",
  nameChanged: "El nombre remoto ya no coincide.",
  contentChanged:
    "El contenido remoto difiere del último estado registrado o no se puede verificar su propiedad.",
  notRecorded: `Este recurso no se registró como creado por ${BRAND_DISPLAY_NAME}.`,
  containsPreserved: "Contiene o depende de recursos que deben conservarse.",
  sharedProfile: "Otro endpoint usa este perfil.",
  alreadyDeleted: "Ya eliminado.",
  dependencyFailed: "Una eliminación necesaria falló; reinténtala primero.",
  empty: "No hay recursos registrados que eliminar.",
  forgetKey: "Desconectar y olvidar la clave",
} satisfies CleanupMessages;
