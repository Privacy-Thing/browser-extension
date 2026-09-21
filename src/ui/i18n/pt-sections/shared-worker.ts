import { BRAND_DISPLAY_NAME } from "@/shared/brand";

export const sharedWorkerModeCopy = {
  native: {
    label: "Nativo",
    description: `Executa Workers Compartilhados normalmente, sem a proteção do ${BRAND_DISPLAY_NAME}. Isso oferece a melhor compatibilidade, mas um worker pode ler os valores reais do seu navegador.`,
  },
  spoof: {
    label: "Simular",
    description: `Tenta um método alternativo de proteção para Workers Compartilhados. Alguns workers ainda podem falhar ao iniciar.`,
  },
  strict: {
    label: "Rigoroso",
    description: `Bloqueia um Worker Compartilhado a menos que ${BRAND_DISPLAY_NAME} possa confirmar a simulação antes de ele começar. Isso impede que um Worker Compartilhado não simulado veja os valores nativos do navegador, mas recursos que dependem desse worker podem não funcionar.`,
  },
} as const;

export const workerHandlingModeCopy = {
  native: {
    label: "Nativo",
    description: `Executa Workers Dedicados e Compartilhados normalmente, sem a proteção de ${BRAND_DISPLAY_NAME}. Isso oferece a melhor compatibilidade, mas os workers podem ler seus valores reais do navegador.`,
  },
  spoof: {
    label: "Simular",
    description: `Tenta aplicar os valores simulados de ${BRAND_DISPLAY_NAME} antes que os workers comecem. Se a proteção não puder ser aplicada, um worker pode usar valores reais do navegador ou falhar ao iniciar.`,
  },
  strict: {
    label: "Rigoroso",
    description: `Bloqueia um worker antes da inicialização quando ${BRAND_DISPLAY_NAME} pode determinar que a simulação não pode ser confirmada. Se ocorrer uma falha após a inicialização, ${BRAND_DISPLAY_NAME} mostra uma notificação em vez disso. Recursos que dependem desses workers podem não funcionar.`,
  },
} as const;
