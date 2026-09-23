import { BRAND_DISPLAY_NAME } from "@/shared/brand";

const ABOUT_PRODUCT = `Sobre ${BRAND_DISPLAY_NAME}`;
const ABOUT_PRODUCT_LOWER = `sobre ${BRAND_DISPLAY_NAME}`;
const HOW_TO_USE_PRODUCT = `Como usar ${BRAND_DISPLAY_NAME}`;
const HOW_TO_USE_PRODUCT_LOWER = `como usar ${BRAND_DISPLAY_NAME}`;
const WHAT_PRODUCT_IS_NOT = `O que ${BRAND_DISPLAY_NAME} não é`;
const PRODUCT_NOT_LOWER = `o que ${BRAND_DISPLAY_NAME} não é`;
const TERMS_OF_USE = "Termos de Uso";

export const about = {
  title: ABOUT_PRODUCT,
  description: `${BRAND_DISPLAY_NAME} ajuda você a controlar como os sites veem sua localização, idioma, fuso horário e detalhes de identidade do navegador selecionado.`,
  body1:
    "Cada perfil regional salvo reúne coordenadas, preferências de idioma e um fuso horário em uma configuração reutilizável que você pode aplicar aos domínios escolhidos sem precisar recriá-la.",
  body2: `Suas alterações são salvas automaticamente. Perfis regionais e regras atualizadas entram em vigor no próximo carregamento da página, então o ${BRAND_DISPLAY_NAME} pode aplicar a nova configuração desde o início.`,
  body3Prefix: "Você encontra os controles globais de proteção do navegador na",
  body3LinkLabel: "aba Opções",
  body3Suffix: ".",
  website: {
    prefix: "Você pode visitar o ",
    linkLabel: `site ${BRAND_DISPLAY_NAME}`,
    url: "https://privacything.com",
    suffix: " para notícias do projeto, downloads e mais informações.",
  },
  versionLabel: "Versão",
  browserTargetLabel: "Destino do navegador",
  releaseChannelLabel: "Canal de lançamento",
  copyLinkLabel: ABOUT_PRODUCT_LOWER,
  copyLinkTermsLabel: "termos de uso",
  copyLinkPrivacyLabel: "sobre privacidade",
  copyLinkLimitationsLabel: PRODUCT_NOT_LOWER,
  copyLinkLicenseLabel: "licença",
  copyLinkAssetsLabel: "recursos de terceiros",
  copyLinkUsageLabel: HOW_TO_USE_PRODUCT_LOWER,
  releaseChannels: {
    local: "Local",
    beta: "Beta",
    stable: "Estável",
  },

  support: {
    url: "https://webh.pl",
    logoLinkAriaLabel: "Abrir webh.pl",
    bodyPrefix: `${BRAND_DISPLAY_NAME} cresce com o suporte de `,
    linkLabel: "webh.pl",
    bodySuffix: " — infraestrutura rápida e flexível para projetos ambiciosos.",
  },

  terms: {
    title: TERMS_OF_USE,
    body1: `${BRAND_DISPLAY_NAME} é fornecido “como está”, sem garantia de qualquer tipo.`,
    body2: `${BRAND_DISPLAY_NAME} ajuda os usuários a controlar localmente o local, o idioma, o fuso horário e os dados relacionados expostos pelo navegador. Não é uma VPN, proxy, ferramenta de anonimato, produto de segurança ou garantia de indetectabilidade.`,
    body3: `Use o ${BRAND_DISPLAY_NAME} por sua própria conta e risco. Você é responsável por cumprir as leis aplicáveis, os termos dos sites, as políticas do local de trabalho e as regras da plataforma.`,
  },

  privacy: {
    title: "Privacidade",
    body: `O ${BRAND_DISPLAY_NAME} armazena suas configurações e seus perfis regionais localmente no navegador. As solicitações externas de mapas são opcionais: após o seu consentimento, o OpenStreetMap Nominatim é usado para pesquisar locais e o OpenFreeMap para exibir mapas interativos.`,
    openPolicyButton: "Abrir política de privacidade",
  },

  limitations: {
    title: WHAT_PRODUCT_IS_NOT,
    intro: `${BRAND_DISPLAY_NAME} altera dados visíveis no navegador, como geolocalização, localidade, fuso horário e detalhes de impressão digital selecionados. Ele não redireciona seu tráfego por uma rede diferente.`,
    body1: "Ele não oculta nem substitui seu endereço IP.",
    body2:
      "Ele não substitui uma VPN, proxy ou configuração de roteamento baseada em DNS.",
    body3:
      "Ele não faz com que os sites vejam sua conexão como vinda de outro país por conta própria.",
    outro: `Use ${BRAND_DISPLAY_NAME} para simulação no nível do navegador. Use ferramentas de VPN, proxy ou DNS quando precisar de alterações de localização no nível da rede.`,
  },

  license: {
    title: "Licença",
    creatorPrefix: "Este projeto foi criado por ",
    creatorLabel: "Tomasz Janusz",
    creatorUrl: "https://tomaszjanusz.dev",
    creatorSuffix: ".",
    copyright: "Copyright © 2025-presente.",
    body: `${BRAND_DISPLAY_NAME} está disponível sob a Licença Pública Geral Affero GNU v3.0 ou posterior, com termos adicionais.`,
    openLicenseButton: "Abrir licença",
  },

  assets: {
    title: "Recursos de terceiros",
    body: `Revise os componentes de terceiros incluídos e os textos de licença aberta fornecidos com ${BRAND_DISPLAY_NAME}.`,
    openNoticesButton: "Abrir avisos de terceiros",
    fontAwesome: {
      label: "Font Awesome Free 7.2.0",
      url: "https://fontawesome.com",
      body: " por Font Awesome / Fonticons, Inc. é licenciado sob CC BY 4.0, SIL OFL 1.1 e MIT.",
    },
    mapLibre: {
      label: "MapLibre GL JS",
      url: "https://maplibre.org/maplibre-gl-js/docs/",
      body: " é incluído localmente para renderização de mapas vetoriais.",
    },
    openFreeMap: {
      label: "OpenFreeMap",
      url: "https://openfreemap.org/",
    },
    openStreetMap: {
      label: "OpenStreetMap",
      url: "https://www.openstreetmap.org/copyright",
    },
    osmWikiCountryCodes: {
      label: "Wiki OpenStreetMap: Nominatim/Country Codes",
      url: "https://wiki.openstreetmap.org/wiki/Nominatim/Country_Codes",
      body: " fornece as configurações padrão de país para idioma usadas durante a geração de perfis regionais.",
      licenseLabel: "CC BY-SA 2.0",
      licenseUrl: "https://wiki.openstreetmap.org/wiki/Wiki_content_license",
      licenseBody: " aplica-se a esse conteúdo da wiki e é atribuído aqui de acordo.",
    },
    mapPreviewsPrefix: "Visualizações interativas de mapas usam ",
    mapPreviewsMiddle: " serviços com ",
    mapPreviewsSuffix: " atribuição de contribuinte exibida no mapa.",

    localData: {
      title: "Conjuntos de dados locais",
      body: `${BRAND_DISPLAY_NAME} inclui pequenos bancos de dados locais criados a partir de dados públicos processados, para manter os valores simulados estatisticamente realistas. Nada é baixado da internet — são cópias empacotadas localmente e atualizadas com cada versão da extensão.`,
      steam: {
        label: "Pesquisa de Hardware & Software do Steam",
        url: "https://store.steampowered.com/hwsurvey/",
        body: " (Valve) fornece as distribuições de resolução de tela, núcleos de CPU e RAM do Windows, Linux e macOS usadas para perfis de hardware locais.",
      },
      chromiumDash: {
        label: "ChromiumDash",
        url: "https://chromiumdash.appspot.com/",
        body: " fornece as versões reais do Chrome usadas para User-Agent e Client Hints.",
      },
      localeCatalog: {
        prefix: "O ",
        mozilla: {
          label: "Mozilla",
          url: "https://github.com/mozilla-firefox/firefox/blob/main/intl/locale/language.properties",
        },
        middle: " e ",
        chromium: {
          label: "Chromium",
          url: "https://github.com/chromium/chromium/blob/main/ui/base/l10n/l10n_util.cc",
        },
        body: " catálogos de localização fornecem nomes de exibição de idioma alinhados com cada mecanismo de navegador.",
      },
    },
  },

  projectLinks: {
    description: `${BRAND_DISPLAY_NAME} também vive fora da extensão. Visite o site, navegue pelo código ou me avise quando algo não estiver funcionando.`,
    websiteLabel: "Site",
    websiteUrl: "https://privacything.com",
    sourceLabel: "Código fonte",
    sourceUrl: "https://github.com/Privacy-Thing/browser-extension",
    reportBugLabel: "Reportar bug",
    reportBugUrl:
      "https://github.com/Privacy-Thing/browser-extension/issues/new?template=bug_report.yml",
  },

  usage: {
    title: HOW_TO_USE_PRODUCT,
    body1:
      "Comece gerando um perfil regional a partir de um lugar pesquisado quando quiser um ponto de partida rápido e realista.",
    body2: `Mantenha um perfil regional salvo por lugar do mundo real que você deseja que ${BRAND_DISPLAY_NAME} imite, depois atribua sites ao perfil regional correspondente.`,
    body3:
      "Use o popup para atribuição rápida de domínios. Abra Configurações quando quiser o painel completo de perfis regionais e regras.",
    body4: `Explore Opções e Avançado quando quiser mais controle sobre como ${BRAND_DISPLAY_NAME} se comporta.`,
  },
} as const;
