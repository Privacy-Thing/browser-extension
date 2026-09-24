import { BRAND_DISPLAY_NAME } from "@/shared/brand";

const SPOOFED_PRODUCT = `Simulado — ${BRAND_DISPLAY_NAME}`;

export const demo = {
  loadingSettings: "Carregando configurações…",
  noLocationsTitle: "Ainda não há perfis regionais",
  noLocationsBody:
    "Crie pelo menos um perfil regional em Configurações para usar a Área de testes.",
  openSettingsButton: "Abrir Configurações",

  locationPreview: {
    title: "Pré-visualização do perfil regional",
    activeLocationLabel: "Perfil regional ativo",
    activeLocationDescription:
      "Selecione um perfil regional salvo para visualizar seus valores exibidos no navegador. Mudar o perfil regional reinicia a rota e aplica a nova visualização de geolocalização.",
    activeLocationPlaceholder: "Escolher um perfil regional…",
    playgroundCadenceLabel: "Tempo de atualização da Área de testes",
    realSiteCadenceLabel: "Tempo de atualização do site",
    configuredDelayLabel: "Intervalo do watchPosition",
    callbackDelayLabel: "Atraso de retorno de chamada",
    runtimeModeLabel: "Modo de execução",
    runtimeModeSimple: "Tempo padrão",
    realLocationTitleIdle: "Comparar com a localização atual do seu navegador",
    realLocationTitleLoading: "Solicitando a localização atual do seu navegador",
    realLocationTitleGranted: "Localização atual do navegador está pronta",
    realLocationTitleDenied: "Permissão de localização do navegador negada",
    realLocationTitleUnavailable: "Localização do navegador indisponível",
    realLocationDescription:
      "Solicite a geolocalização real do navegador uma vez para compará-la com a pré-visualização definida abaixo.",
    realLocationGrantedDescription:
      "A localização atual do seu navegador agora está disponível nas linhas de geolocalização abaixo para comparação lado a lado.",
    realLocationDeniedDescription:
      "O navegador negou o acesso à geolocalização real. Você pode tentar novamente se a permissão mudar.",
    realLocationUnavailable:
      "A comparação com a localização real não está disponível porque este navegador não expõe geolocalização aqui.",
    realLocationRefresh: "Atualizar localização real",
  },

  localMachineTitle: "Computador local",
  spoofedTitle: SPOOFED_PRODUCT,
  waitingForPermission: "Aguardando permissão do navegador…",
  permissionDenied: "Permissão negada pelo navegador",
  geolocationUnavailable: "Geolocalização não disponível",
  requestRealLocation: "Solicitar localização real",
  requestRealLocationHintTitle: "Localização real ainda não carregada",
  requestRealLocationTableHint:
    "Solicite a localização real do seu navegador acima para compará-la aqui.",
  waitingForFix: "Aguardando a primeira posição...",
  selectLocationPrompt:
    "Selecione um perfil regional acima para ver os valores de pré-visualização.",

  comparison: {
    language: "navigator.language",
    languages: "navigator.languages",
    timeZone: "Intl…resolvedOptions().timeZone",
    acceptLanguage: "Cabeçalho Accept-Language",
    timeZoneOffset: "new Date().getTimezoneOffset()",
    dateToString: "new Date().toString()",
    dateToDateString: "new Date().toDateString()",
    dateToTimeString: "new Date().toTimeString()",
    dateLocaleString: "new Date().toLocaleString()",
    dateLocaleDateString: "new Date().toLocaleDateString()",
    dateLocaleTimeString: "new Date().toLocaleTimeString()",
    currentPosition: "navigator.geolocation.getCurrentPosition()",
    coords: "geolocation.coords",
    timestamp: "geolocation.timestamp",
    timestampInfoLabel: "Sobre a exibição de timestamp da geolocalização",
    timestampTooltip: `${BRAND_DISPLAY_NAME} retorna o timestamp Unix bruto em milissegundos. A data legível exibida aqui serve apenas para facilitar a consulta e usa o fuso horário da respectiva coluna.`,
    userAgent: "navigator.userAgent",
    appVersion: "navigator.appVersion",
    vendor: "navigator.vendor",
    hardwareConcurrency: "navigator.hardwareConcurrency",
    deviceMemory: "navigator.deviceMemory",
    platform: "navigator.platform",
    pixelDepth: "screen.pixelDepth",
    screenMetrics: "screen.width/height/avail*/colorDepth",
    devicePixelRatio: "window.devicePixelRatio",
    canvas2d: "Resumo da sonda Canvas 2D",
    webglRenderer: "Sonda do renderizador WebGL",
    webglDebugExtension: "WEBGL_debug_renderer_info",
    webglReadPixels: "Sonda readPixels() do WebGL",
    audioFingerprint: "Sonda AnalyserNode + AudioBuffer",
    clientHintBrands: "navigator.userAgentData.brands",
    clientHintPlatform: "navigator.userAgentData.platform",
    clientHintPlatformVersion: "navigator.userAgentData.platformVersion",
    clientHintArchitecture: "navigator.userAgentData.architecture",
    clientHintBitness: "navigator.userAgentData.bitness",
    clientHintModel: "navigator.userAgentData.model",
    clientHintMobile: "navigator.userAgentData.mobile",
    clientHintFullVersionList: "navigator.userAgentData.fullVersionList",
    secChUa: "Cabeçalho Sec-CH-UA",
    secChUaPlatform: "Cabeçalho Sec-CH-UA-Platform",
    secChUaMobile: "Cabeçalho Sec-CH-UA-Mobile",
    secChUaFullVersionList: "Cabeçalho Sec-CH-UA-Full-Version-List",
    webRTCIcePolicy: "Política ICE do RTCPeerConnection",
    probePending: "Coletando…",
    notAvailable: "N/D",
    spoofedMatchesLocal:
      "O valor de visualização corresponde ao seu navegador para esta identidade.",
    browserVersionNote: (versionToken: string) =>
      `${BRAND_DISPLAY_NAME} mantém os tokens de versão do navegador normalizados e não randomiza variantes de espaço reservado como ${versionToken}.`,
  },

  previewSeed: {
    title: "Identidade de pré-visualização",
    description:
      "Escolha a identidade de navegador consistente mostrada nesta pré-visualização da Área de testes.",
    inputAriaLabel: "Código de identidade de pré-visualização",
    placeholder: "Código de identidade",
    hint: "Use 6 letras minúsculas ou dígitos. Altere o código para visualizar uma identidade diferente.",
    randomize: "Gerar nova identidade",
  },

  sections: {
    localeDate: "Localidade e Data",
    networkHeaders: "Cabeçalhos de Rede",
    geolocation: "Geolocalização",
    browserFingerprint: "Identidade do navegador",
    webglCanvas: "Canvas e WebGL",
    screen: "Tela",
    audio: "Áudio",
    webRTC: "WebRTC",
  },

  map: {
    title: "Visualização do mapa",
    noLocationTitle: "Selecione um perfil regional primeiro",
    noLocationDescription:
      "Escolha um perfil regional salvo acima para ativar os controles de mapa e waypoint.",
    osmRequired: "Acesso ao mapa necessário",
    osmRequiredDescription:
      "Permita o acesso externo ao mapa para visualizar a posição simulada em um mapa interativo.",
    demoIntervalLabel: "Intervalo de demonstração (2–5 s)",
    clearButton: "Limpar",
  },

  disclaimer: {
    title: "Modo de visualização, não um site ao vivo",
    body: `Use esta página para inspecionar como ${BRAND_DISPLAY_NAME} apresentaria o perfil regional selecionado antes de aplicá-lo em sites. Idioma, localidade, hora, cabeçalhos e valores similares são exibidos como uma <em>pré-visualização</em> a partir dos mesmos dados do perfil regional. A geolocalização usa o mesmo comportamento de movimento e atualização de sites protegidos. Na Área de testes, as atualizações de localização são mais rápidas do que em sites normais, facilitando ver as mudanças.`,
  },

  howItWorks: {
    title: "Como ler esta pré-visualização",
    body1:
      "<strong>Idioma, localidade e hora</strong> — estas linhas mostram como o perfil regional selecionado se apresentaria aos sites, sem alterar a própria página da Área de testes.",
    body2: `<strong>Geolocalização</strong> — as linhas de mapa e localização usam o mesmo comportamento de movimento e atualização que sites protegidos, para que você possa visualizar a sincronização e a variação de coordenadas antes de atribuir o perfil regional.`,
    body3: `<strong>Valores e cabeçalhos do navegador</strong> — essas comparações colocam os valores atuais do seu navegador ao lado dos valores que ${BRAND_DISPLAY_NAME} exporia para o perfil regional selecionado, seguindo as mesmas configurações de proteção que você usa em Configurações.`,
    body4:
      "A Área de testes atualiza mais rápido que a navegação normal, então mudanças são mais fáceis de perceber durante os testes.",
  },
} as const;
