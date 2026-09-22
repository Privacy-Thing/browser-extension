import { workerHandlingModeCopy } from "./shared-worker";

import { BRAND_DISPLAY_NAME } from "@/shared/brand";

export const options = {
  title: "Configurações",
  tabsAriaLabel: "Seções de configurações",
  spoofingOffBannerTitle: "Simulação está desativada",
  spoofingOffBannerBody: `${BRAND_DISPLAY_NAME} não está aplicando valores de localização ou de navegador simulados neste momento.`,
  spoofingOffBannerAction: "Ativar simulação novamente",
  spoofingTurnedOffToast: `${BRAND_DISPLAY_NAME} desativado.`,
  spoofingTurnedOnToast: `${BRAND_DISPLAY_NAME} ativado.`,

  tabs: {
    locations: "Perfis regionais",
    rules: "Regras de Domínio",
    trustedSites: "Sites Confiáveis",
    playground: "Área de testes",
    options: "Opções",
    advanced: "Avançado",
    about: "Sobre",
  },
} as const;

export const optionsPage = {
  browserFingerprintSpoofing: {
    title: "Configurações de proteção global",
    description: `Escolha quais proteções do navegador o ${BRAND_DISPLAY_NAME} usa por padrão. Configurações mais específicas podem substituir proteções individuais, enquanto Sites Confiáveis podem desativá-las para sites correspondentes.`,
    disabledNote: `As proteções do navegador estão desativadas em todos os lugares. Ative-as novamente para escolher o que o ${BRAND_DISPLAY_NAME} deve simular por padrão.`,
    copyLinkLabel: "proteções do navegador",
    items: {
      geolocation: {
        label: "Geolocalização",
        description: `Controla a API de Geolocalização. Quando isto está ligado, ${BRAND_DISPLAY_NAME} responde a solicitações de localização com seu perfil regional ativo. Desative e os sites obtêm o resultado real de geolocalização do navegador.`,
        advancedButton: "Avançado",
        advancedModal: {
          title: "Configurações avançadas de geolocalização",
          description:
            "Ajuste o raio de coordenadas padrão e o tempo de atualização da localização.",
        },
      },
      timeLocale: {
        label: "Hora e Localidade",
        description: `Controla Date, Intl, navigator.language, navigator.languages e cabeçalhos de idioma. Quando isto está ligado, ${BRAND_DISPLAY_NAME} mantém esses valores alinhados com seu perfil regional ativo. Desative e os sites veem as configurações regionais reais do seu navegador.`,
      },
      canvas: {
        label: "Tela de desenho (Canvas)",
        description: `Sites podem desenhar uma imagem oculta e usar pequenas diferenças de renderização para reconhecer seu navegador. Quando isso está ativado, ${BRAND_DISPLAY_NAME} adiciona ruído controlado para que o resultado seja mais difícil de reutilizar como uma impressão digital. Desative e os sites receberão a saída real do seu canvas.`,
      },
      webGL: {
        label: "WebGL",
        description: `WebGL revela detalhes gráficos, como o modelo da sua GPU, o renderizador e o comportamento do driver. Quando isso está ativado, ${BRAND_DISPLAY_NAME} substitui essas pistas por um perfil consistente que se adapta à sua plataforma atual. Desative e os sites poderão ler dados gráficos mais próximos da sua máquina real.`,
      },
      audio: {
        label: "Áudio",
        description: `APIs de áudio produzem pequenas diferenças específicas do hardware que os sites podem medir em segundo plano. Quando isso está ativado, ${BRAND_DISPLAY_NAME} altera levemente esses valores para que sejam menos úteis para rastreamento. Desative e a saída de áudio permanece inalterada.`,
      },
      navigator: {
        label: "navigator",
        description: `Os campos do navegador revelam detalhes como sua plataforma, configuração de idioma, dicas de CPU e outros dados de identidade do navegador. Quando isto está ativado, ${BRAND_DISPLAY_NAME} oculta campos de identidade selecionados enquanto mantém a consistência interna. Desative-o e os sites verão mais da sua identidade real do navegador.`,
      },
      screen: {
        label: "Tela",
        description: `Tamanho da tela, proporção de pixels e profundidade de cor ajudam a restringir você a um pequeno grupo de dispositivos. Quando isto está ativado, ${BRAND_DISPLAY_NAME} oculta esses detalhes exatos de exibição. Desative-o e os sites obterão suas propriedades reais da tela.`,
      },
      clientHints: {
        label: "Client Hints",
        description: `Os Client Hints compartilham a versão do navegador, a plataforma e dados do dispositivo por meio de cabeçalhos de requisição e APIs JavaScript. Quando esta proteção está ativada, ${BRAND_DISPLAY_NAME} mantém esses valores coerentes com sua identidade de navegador simulada. Desative-a e os sites receberão os dados reais do navegador e da plataforma.`,
      },
      battery: {
        label: "Bateria",
        description: `O status da bateria pode revelar informações do dispositivo em mudança que os sites podem usar para vincular visitas. Quando isto está ativado, ${BRAND_DISPLAY_NAME} relata uma bateria cheia, carregando, em vez do estado real do dispositivo. Desative-o e os sites podem ler a API nativa de Status da Bateria.`,
      },
      clientHintsVersionRotation: {
        label: "Rotacionar números de build e patch",
        description: (count: number) =>
          `Alterna os números de compilação e patch do Chromium expostos pelos Client Hints, mantendo a versão principal do navegador instalado. ${BRAND_DISPLAY_NAME} inclui um catálogo de compilações recentes do Chromium; para esta versão do navegador, pode escolher entre ${count} ${count === 1 ? "opção compatível" : "opções compatíveis"}. A string reduzida do User-Agent permanece no formato nativo do navegador, .0.0.0.`,
        hintPrefix: "ex.:",
        hint: "139.0.[build].[patch]",
      },
      webRTC: {
        label: "WebRTC",
        description: `O WebRTC pode revelar endereços IP locais ou públicos, mesmo quando você usa uma VPN ou proxy. Quando isso está ativo, ${BRAND_DISPLAY_NAME} solicita ao navegador que use seu modo mais restrito de gerenciamento de IP. Desative-o e o WebRTC se comporta normalmente, o que pode expor mais detalhes da rede.`,
      },
      serviceWorker: {
        label: "Service Workers",
        description: `Os Service Workers são executados em segundo plano e podem permitir que sites mantenham dados e identificadores de longa duração. Ative isto quando ${BRAND_DISPLAY_NAME} deve bloquear sites de registrar Service Workers em todos os lugares por padrão.`,
        warning:
          "Bloquear Service Workers pode impedir que aplicativos web instaláveis (PWAs), modo offline, notificações push e sincronização em segundo plano funcionem. Alguns aplicativos também podem funcionar mais lentamente ou perder recursos.",
        defaultState:
          "O bloqueio está desativado por padrão — você pode ativá-lo globalmente e depois permitir para domínios específicos com uma Regra de Domínio.",
        allow: "Permitir",
        block: "Bloquear",
      },
      sharedWorker: {
        label: "Workers Dedicados & Compartilhados",
        descriptionLead:
          "Escolha como os Workers Dedicados e Compartilhados são executados por padrão. Regras de Domínio e Contêineres do Firefox podem substituir esta política para sites correspondentes.",
        copyLinkLabel: "Manipulação de Workers Dedicados e Compartilhados",
        native: workerHandlingModeCopy.native.label,
        nativeDescription: workerHandlingModeCopy.native.description,
        spoof: workerHandlingModeCopy.spoof.label,
        spoofDescription: workerHandlingModeCopy.spoof.description,
        strict: workerHandlingModeCopy.strict.label,
        strictDescription: workerHandlingModeCopy.strict.description,
      },
    },
  },
  badgeQueryCount: {
    label: "Mostrar contagem de chamadas no badge da extensão",
    description: `Mostrar quantas chamadas da API do navegador ${BRAND_DISPLAY_NAME} lidou no badge da extensão em vez do rótulo de texto.`,
    includeDateCalls: {
      label: "Incluir chamadas de API Date e Temporal",
      description:
        "Incluir chamadas Date.* e Temporal.* no número do badge. Desative isto para evitar que verificações de tempo frequentes aumentem a contagem.",
    },
  },
  copyLinkHelpLabel: "ajuda de opções",
  help: {
    title: "Opções",
    body1: `As proteções do navegador permitem escolher quais valores ${BRAND_DISPLAY_NAME} simula por padrão. Essas configurações afetam todos os sites, a menos que uma Regra de Domínio ou um Contêiner do Firefox determine o contrário.`,
    body2: `Os controles de privacidade cobrem apenas as solicitações de rede opcionais que ${BRAND_DISPLAY_NAME} faz enquanto você configura locais. Deixe-os desativados e ${BRAND_DISPLAY_NAME} ainda funcionará — você apenas adicionará locais manualmente em vez de usar a pesquisa ou pré-visualizações de mapas.`,
  },
} as const;
