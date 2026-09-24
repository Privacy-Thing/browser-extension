import { BRAND_DISPLAY_NAME } from "@/shared/brand";

export const sharedWorkerModeCopy = {
  native: {
    label: "Без подмены",
    description: `Shared Workers работают обычным образом, без защиты ${BRAND_DISPLAY_NAME}. Это обеспечивает наилучшую совместимость, но они могут считывать реальные данные браузера.`,
  },
  spoof: {
    label: "Подмена",
    description:
      "Применяет к Shared Workers другой способ защиты. Некоторые из них всё же могут не запуститься.",
  },
  strict: {
    label: "Строгий",
    description: `Блокирует Shared Worker, если ${BRAND_DISPLAY_NAME} не может подтвердить подмену до его запуска. Так незащищённый Shared Worker не получит реальные данные браузера, но зависящие от него функции сайта могут перестать работать.`,
  },
} as const;

export const workerHandlingModeCopy = {
  native: {
    label: "Без подмены",
    description: `Dedicated и Shared Workers работают обычным образом, без защиты ${BRAND_DISPLAY_NAME}. Это обеспечивает наилучшую совместимость, но они могут считывать реальные данные браузера.`,
  },
  spoof: {
    label: "Подмена",
    description: `Пытается применить подменённые ${BRAND_DISPLAY_NAME} значения до запуска воркеров. Если защиту применить не удастся, воркер может получить реальные данные браузера или не запуститься.`,
  },
  strict: {
    label: "Строгий",
    description: `Блокирует воркер до запуска, если ${BRAND_DISPLAY_NAME} не может подтвердить подмену. Если сбой происходит после запуска, ${BRAND_DISPLAY_NAME} покажет уведомление. Зависящие от этих воркеров функции сайта могут перестать работать.`,
  },
} as const;
