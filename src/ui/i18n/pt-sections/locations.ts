import { BRAND_DISPLAY_NAME } from "@/shared/brand";

const PRODUCT_NOT_LOWER = `o que ${BRAND_DISPLAY_NAME} não é`;

export const locations = {
  title: "Perfis regionais",
  description:
    "Perfis regionais agrupam coordenadas, configuração regional e fuso horário para simulação.",
  addManualButton: "Adicionar manualmente",
  actionsMenuLabel: "Ações do perfil regional",
  generateButton: "Gerar perfil regional",
  searchPlaceholder: "Pesquisar perfis regionais...",
  unused: "Não utilizado",
  assigned: (count: number) => `${count} ${count === 1 ? "atribuição" : "atribuições"}`,
  viewAssignedRulesAriaLabel: (locationLabel: string, count: number) =>
    `Mostrar ${count} ${count === 1 ? "regra de domínio atribuída" : "regras de domínio atribuídas"} a ${locationLabel}`,
  copyLinkLabel: "perfis regionais",
  copyLinkHelpLabel: "ajuda de perfis regionais",

  playgroundCard: {
    title: "Área de testes",
    body1:
      "Visualize um perfil regional salvo antes de atribuí-lo a sites. A Área de testes mostra a configuração regional, o fuso horário, a formatação de data e as coordenadas simuladas com o mesmo comportamento de geolocalização usado em sites protegidos.",
    body2:
      "Por padrão, a Área de testes atualiza a geolocalização simulada a cada 2-5 segundos, tornando fácil inspecionar o movimento. Sites reais usam o Atraso de Observação de Posição configurado por você.",
  },

  help: {
    title: "Perfis regionais",
    body1:
      "Um perfil regional deve descrever um lugar plausível. Mantenha a configuração regional, os idiomas e o fuso horário coerentes com a região das coordenadas.",
    body2: `As alterações são salvas automaticamente. Quando você edita um campo, ${BRAND_DISPLAY_NAME} grava a atualização após uma breve pausa.`,
    body3:
      "Um perfil regional salvo altera valores no nível do navegador, como geolocalização, localidade e fuso horário. Ele não altera seu endereço IP nem para onde seu tráfego é roteado.",
    privacyTitle: "Privacidade",
    privacyBody: `Pesquisas e pré-visualizações de mapas são opcionais. ${BRAND_DISPLAY_NAME} só entra em contato com o OpenStreetMap Nominatim para pesquisa e com o OpenFreeMap para pré-visualizações de mapas interativos após você permitir.`,
    networkTitle: "Limites de rede",
    networkBodyPrefix:
      "Precisa de alterações de localização em nível de rede? Use uma VPN, proxy ou ferramenta de DNS. Veja ",
    networkBodyLinkLabel: PRODUCT_NOT_LOWER,
    networkBodySuffix: ".",
  },

  editor: {
    title: "Editar perfil regional",
    description:
      "Atualize o perfil regional salvo, incluindo coordenadas, formatos regionais e comportamento de relatórios de localização.",
    deleteBlockedTitle: "Este perfil regional ainda está atribuído",
    deleteBlockedDescription:
      "Altere ou remova todas as atribuições abaixo antes de excluir o perfil regional.",
    deleteBlockedButtonTitle:
      "Remova todas as atribuições antes de excluir este perfil regional.",
    disabledDependencySuffix: "(desligado)",
    mapDisabledTitle: "Mapa desativado",
    mapDisabledBody:
      "A visualização do mapa não foi carregada porque você não permitiu solicitações externas de mapa.",
    geolocationSectionTitle: "Geolocalização",
    geolocationSectionDescription:
      "Coordenadas, precisão e a dispersão máxima permitida para posições simuladas.",
    localeSectionTitle: "Hora e idioma",
    localeSectionDescription:
      "Mantenha os valores regionais coerentes com a região das coordenadas salvas.",
    primaryLocaleLabel: "Configuração regional principal",
    languageDescription:
      "Este é o formato regional principal do perfil regional para datas, números e outros valores localizados.",
    languageBehaviorDescription:
      'Quando "Preferir inglês em sites" está desativado, os sites também veem este valor como navigator.language. Mesmo com o inglês em primeiro lugar, esta configuração regional ainda controla a formatação padrão de datas e números.',
    preferredLanguagesLabel: "Idiomas preferidos",
    languagesDescription:
      "Lista ordenada das preferências de idioma do navegador para este perfil regional.",
    languagesBehaviorDescription: `${BRAND_DISPLAY_NAME} expõe esta ordem como navigator.languages e preferências de idioma relacionadas. Mantenha a configuração regional principal em primeiro lugar e adicione apenas idiomas alternativos plausíveis para este perfil regional.`,
    preferEnglishContentLabel: "Preferir inglês em sites",
    preferEnglishContentDescriptionPrefix: `${BRAND_DISPLAY_NAME} mantém o locale salvo como sua base regional, mas expõe`,
    preferEnglishContentDescriptionSuffix:
      "primeiro nas preferências de idioma do navegador, para que os sites tenham mais probabilidade de permanecer em inglês.",
    preferEnglishContentLockedTagTitle: (locale: string) =>
      `${locale} é inserido pela preferência de idioma do navegador em inglês e não pode ser removido aqui.`,
    accuracyDescription:
      "Controla o valor de precisão que os sites veem nos resultados de geolocalização.",
    noiseRadiusDescription:
      "Distância máxima permitida entre as coordenadas simuladas e o ponto salvo deste perfil regional.",
  },

  generator: {
    title: "Gerar perfil regional",
    searchStepDescription:
      "Pesquise uma cidade, endereço ou nome de lugar para criar um novo perfil regional.",
    resultStepDescription: `Escolha o resultado correspondente antes que ${BRAND_DISPLAY_NAME} crie o perfil regional.`,
    languageStepDescription:
      "Escolha o idioma do navegador que deve ancorar este perfil regional antes de revisar o restante.",
    confirmStepDescription: "Confirme o perfil regional no mapa antes de adicioná-lo.",
    locationLabel: "Localização",
    locationPlaceholder: "Varsóvia, Polônia",
    osmDisclaimer:
      "As consultas de pesquisa usam a API externa Nominatim do OpenStreetMap. Visualizações interativas usam tiles vetoriais e fontes do OpenFreeMap após consentimento.",
    resultSelectLabel: "Resultado da pesquisa",
    resultStepBody:
      "O OpenStreetMap retornou mais de uma correspondência possível. Selecione o local que você quis dizer e depois continue.",
    resultStepHint: "Escolha um resultado para continuar.",
    languageSelectLabel: "Idioma do navegador",
    languageStepBody:
      "Mais de um idioma do navegador está disponível para este local. Escolha o que você quer que este perfil regional use.",
    languageStepHint:
      "Se o idioma que você deseja não estiver listado abaixo, você pode escolher um diferente na próxima etapa.",
    resultPrefix: "Resultado: ",
  },
} as const;
