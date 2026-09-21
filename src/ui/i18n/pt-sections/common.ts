import { BRAND_DISPLAY_NAME } from "@/shared/brand";

export const common = {
  copyLinkTo: (section: string) => `Copiar link para ${section}`,

  actions: {
    cancel: "Cancelar",
    reset: "Redefinir",
    close: "Fechar",
    create: "Criar",
    save: "Salvar",
    back: "Voltar",
    continue: "Continuar",
    edit: "Editar",
    delete: "Excluir",
    duplicate: "Duplicar",
    search: "Pesquisar",
    clear: "Limpar",
    deleteSelected: "Excluir selecionados",
    clearSelection: "Limpar seleção",
    openPrivacyPolicy: "Abrir política de privacidade",
    allowOpenStreetMap: "Permitir acesso ao mapa",
    notNow: "Agora não",
    openPlayground: "Abrir Área de testes",
  },
  selectionCount: (count: number) =>
    `${count} ${count === 1 ? "selecionado" : "selecionados"}`,

  fields: {
    name: "Nome",
    latitude: "Latitude",
    longitude: "Longitude",
    accuracy: "Precisão",
    noiseRadius: "Raio máximo (m)",
    timeZone: "Fuso horário",
  },

  coordinateRandomization: {
    labelBefore: "Aleatorizar coordenadas dentro de",
    labelAfter: "km.",
    radiusInputLabel: "Raio de aleatorização de coordenadas em quilômetros",
    readWhy: "Leia por quê.",
    tooltipPrivacy: `${BRAND_DISPLAY_NAME} é focado em privacidade. Os perfis regionais devem ser fáceis de usar, mas reutilizar coordenadas exatas de catálogos ou buscas pode tornar os usuários do ${BRAND_DISPLAY_NAME} mais fáceis de reconhecer.`,
    tooltipExact: `Precisa de um local específico? Desative este interruptor e o ${BRAND_DISPLAY_NAME} usará a coordenada exata. Você pode alterar os padrões em Opções > Geolocalização > Avançado.`,
  },
} as const;
