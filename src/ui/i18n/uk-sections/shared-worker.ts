import { BRAND_DISPLAY_NAME } from "@/shared/brand";

export const sharedWorkerModeCopy = {
  native: {
    label: "Без підміни",
    description: `Shared Workers працюють звичайним чином, без захисту ${BRAND_DISPLAY_NAME}. Це забезпечує найкращу сумісність, але вони можуть зчитувати справжні дані браузера.`,
  },
  spoof: {
    label: "Підміна",
    description:
      "Застосовує до Shared Workers інший спосіб захисту. Деякі з них усе одно можуть не запуститися.",
  },
  strict: {
    label: "Суворий",
    description: `Блокує Shared Worker, якщо ${BRAND_DISPLAY_NAME} не може підтвердити підміну до його запуску. Так незахищений Shared Worker не отримає справжні дані браузера, але залежні від нього функції сайту можуть перестати працювати.`,
  },
} as const;

export const workerHandlingModeCopy = {
  native: {
    label: "Без підміни",
    description: `Dedicated і Shared Workers працюють звичайним чином, без захисту ${BRAND_DISPLAY_NAME}. Це забезпечує найкращу сумісність, але вони можуть зчитувати справжні дані браузера.`,
  },
  spoof: {
    label: "Підміна",
    description: `Намагається застосувати підмінені ${BRAND_DISPLAY_NAME} значення до запуску воркерів. Якщо захист застосувати не вдасться, воркер може отримати справжні дані браузера або не запуститися.`,
  },
  strict: {
    label: "Суворий",
    description: `Блокує воркер до запуску, якщо ${BRAND_DISPLAY_NAME} не може підтвердити підміну. Якщо збій стається після запуску, ${BRAND_DISPLAY_NAME} покаже сповіщення. Залежні від цих воркерів функції сайту можуть перестати працювати.`,
  },
} as const;
