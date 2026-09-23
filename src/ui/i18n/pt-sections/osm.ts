import { BRAND_DISPLAY_NAME } from "@/shared/brand";

export const externalMapConsentCopy = {
  title: "Permitir busca de localização e solicitações de mapa",
  description: `Permitir que ${BRAND_DISPLAY_NAME} envie consultas de pesquisa para o OpenStreetMap Nominatim quando você pesquisar locais e solicite tiles vetoriais e fontes do OpenFreeMap quando pré-visualizações de mapas forem exibidas. Esses serviços recebem seu texto de pesquisa, solicitações de mapa e fontes, e seu endereço IP, mas não suas regras salvas, perfis regionais ou histórico de navegação. Mantenha isso desativado se preferir inserir coordenadas manualmente sem fazer solicitações de serviços de mapas durante a configuração.`,
} as const;

export const osm = {
  modalTitle: "Permitir solicitações externas de mapa e pesquisa?",
  body1: `O acesso externo a mapas é opcional. O próprio ${BRAND_DISPLAY_NAME} não envia seus perfis regionais, regras nem dados de navegação a esses serviços.`,
  body2: `Se você permitir isso, ${BRAND_DISPLAY_NAME} poderá contatar o OpenStreetMap Nominatim para pesquisa de localização e o OpenFreeMap para pré-visualizações de mapa interativas.`,
} as const;
