import { BRAND_DISPLAY_NAME } from "@/shared/brand";

export const sharedWorkerModeCopy = {
  native: {
    label: "Nativo",
    description: `Ejecuta los Shared Workers con normalidad, sin la protección de ${BRAND_DISPLAY_NAME}. Ofrece la máxima compatibilidad, pero un worker puede leer los valores reales de tu navegador.`,
  },
  spoof: {
    label: "Simular",
    description: `Intenta un método de protección alternativo para Shared Workers. Algunos workers aún pueden fallar al iniciarse.`,
  },
  strict: {
    label: "Estricto",
    description: `Bloquea un Shared Worker salvo que ${BRAND_DISPLAY_NAME} pueda confirmar la simulación antes de que se inicie. Así se evita que un Shared Worker sin proteger vea los valores reales del navegador, pero es posible que las funciones que dependen de él no funcionen.`,
  },
} as const;

export const workerHandlingModeCopy = {
  native: {
    label: "Nativo",
    description: `Ejecuta los Dedicated y Shared Workers con normalidad, sin la protección de ${BRAND_DISPLAY_NAME}. Ofrece la máxima compatibilidad, pero los workers pueden leer los valores reales de tu navegador.`,
  },
  spoof: {
    label: "Simular",
    description: `Intenta aplicar los valores simulados de ${BRAND_DISPLAY_NAME} antes de que se inicien los workers. Si no puede aplicar la protección, un worker podría usar los valores reales del navegador o no iniciarse.`,
  },
  strict: {
    label: "Estricto",
    description: `Bloquea un worker antes de que se inicie cuando ${BRAND_DISPLAY_NAME} determina que no puede confirmar la simulación. Si el fallo ocurre después del inicio, ${BRAND_DISPLAY_NAME} muestra una notificación. Es posible que las funciones que dependen de estos workers no funcionen.`,
  },
} as const;
