import { BRAND_DISPLAY_NAME } from "@/shared/brand";
import { externalMapConsentCopy } from "@/ui/i18n/pt-sections/osm";

const TURN_OFF_PRODUCT = `Desligar ${BRAND_DISPLAY_NAME}`;

export const advanced = {
  runtimeTitle: "Opções avançadas",
  runtimeDescription: "Gerenciar registro detalhado em tempo de execução.",
  copyLinkRuntimeLabel: "configurações avançadas",
  copyLinkHelpLabel: "ajuda avançada",

  noiseRadius: {
    title: "Raio máximo de coordenadas padrão",
    description:
      "Defina, em metros, o raio máximo padrão das coordenadas de novos perfis regionais.",
    copyLinkLabel: "raio máximo de coordenadas padrão",
  },

  generatedLocationRandomization: {
    enabled: {
      title: "Aleatorizar coordenadas ao criar novos perfis regionais",
      description:
        "Use esta opção como padrão para perfis regionais gerados. Você ainda pode desativá-la individualmente quando precisar de coordenadas exatas.",
      readWhy: "Leia por quê.",
      tooltipPrivacy: `${BRAND_DISPLAY_NAME} é focado em privacidade. Os perfis regionais devem ser fáceis de usar, mas reutilizar coordenadas exatas de catálogos ou buscas pode tornar os usuários do ${BRAND_DISPLAY_NAME} mais fáceis de reconhecer.`,
      tooltipExact:
        "Precisa de um local específico? Desative este interruptor e o perfil regional usará a coordenada exata.",
      copyLinkLabel: "nova randomização de coordenadas do perfil regional",
    },
    radius: {
      title: "Raio de randomização de coordenadas padrão",
      description:
        "Escolha o raio padrão usado quando a randomização de coordenadas estiver ativada. Digite um número inteiro de 1 a 99 km.",
      inputLabel: "Raio de randomização de coordenadas padrão em quilômetros",
      copyLinkLabel: "raio de randomização de coordenadas padrão",
    },
  },

  themeMode: {
    title: "Tema",
    description: `Escolha se ${BRAND_DISPLAY_NAME} seguirá a aparência do sistema ou sempre usará um tema claro ou escuro fixo.`,
    label: "Aparência",
    options: {
      system: "Sistema",
      light: "Claro",
      dark: "Escuro",
    },
    copyLinkLabel: "tema",
  },

  watchPositionDelay: {
    title: "Intervalo de atualização da posição (s)",
    description:
      "Defina o menor e o maior atraso entre atualizações de localização em sites.",
    copyLinkLabel: "intervalo de atraso de posição de observação",
  },

  debugMode: {
    title: "Modo de Depuração",
    description: `Registre a atividade detalhada em tempo de execução para ${BRAND_DISPLAY_NAME} no console de desenvolvedor do navegador.`,
    copyLinkLabel: "modo de depuração",
  },

  experimental: {
    title: "Experimental",
    description:
      "Teste proteções para APIs do navegador que ainda estão sendo lançadas. Esses recursos estão disponíveis em todos os canais de lançamento.",
    copyLinkLabel: "configurações experimentais",
    temporalApi: {
      title: "Temporal API",
      description:
        "Proteja o comportamento de data, hora, localidade e fuso horário padrão do Temporal quando este navegador fornece a API nativa. Nenhum polyfill está instalado.",
      copyLinkLabel: "Temporal API",
    },
    domainFencing: {
      title: "Isolamento por domínio",
      description:
        "Quando a Regra Padrão ou um contêiner do Firefox se aplica, cada site recebe sua própria impressão digital estável. Sua configuração regional permanece a mesma.",
      copyLinkLabel: "isolamento por domínio",
    },
  },

  privacy: {
    title: "Privacidade",
    description: `${BRAND_DISPLAY_NAME} roda no seu dispositivo e não envia seus dados de navegação para lugar nenhum. As únicas solicitações de rede opcionais ocorrem quando você usa a pesquisa de localização ou visualizações de mapas ao configurar perfis regionais.`,
    copyLinkLabel: "privacidade",

    osmConsent: {
      title: externalMapConsentCopy.title,
      description: externalMapConsentCopy.description,
      stateUnknown: `Você ainda não escolheu isso. ${BRAND_DISPLAY_NAME} perguntará antes de se conectar a um serviço de mapas externo.`,
      statePrefix: "O acesso a mapas externos está",
      stateEnabled:
        "ativado — a pesquisa de localização e visualizações de mapas podem carregar",
      stateDisabled: `desativado — ${BRAND_DISPLAY_NAME} permanecerá offline enquanto você configura os locais`,
      copyLinkLabel: "acesso a mapas externos",
    },
  },

  display: {
    title: "Aparência",
    description: "Ajuste a apresentação visual e as configurações de acessibilidade.",
    copyLinkLabel: "aparência",

    language: {
      title: "Idioma",
      description: `${BRAND_DISPLAY_NAME} segue automaticamente o idioma da interface do seu navegador.`,
      optionEnglish: "Inglês",
      optionSpanish: "Espanhol",
      optionPortuguese: "Português",
      soon: "AUTO",
      copyLinkLabel: "idioma",
    },

    reduceMotion: {
      title: "Reduzir movimento",
      description: `Desativar animações da interface em todo o ${BRAND_DISPLAY_NAME}.`,
      systemOverride:
        "Movimento reduzido está ativado pelas configurações de acessibilidade do seu sistema.",
      copyLinkLabel: "reduzir movimento",
    },

    accentColor: {
      title: "Cor de destaque",
      description: `Escolha a principal cor de destaque do ${BRAND_DISPLAY_NAME} em uma paleta inspirada nas cores dos Contêineres do Firefox.`,
      copyLinkLabel: "cor de destaque",
      optionAriaLabel: (label: string) => `Usar ${label} como cor de destaque`,
      options: {
        teal: "Verde-azulado",
        blue: "Azul",
        green: "Verde",
        yellow: "Amarelo",
        orange: "Laranja",
        red: "Vermelho",
        pink: "Rosa",
        purple: "Roxo",
        gray: "Cinza",
      },
    },

    highContrast: {
      title: "Modo de alto contraste",
      description:
        "Aumente o contraste do texto e a visibilidade das bordas para melhorar a legibilidade.",
      copyLinkLabel: "modo de alto contraste",
    },
  },

  danger: {
    title: "Zona de perigo",
    description: `Estas ações podem substituir, excluir ou restaurar as configurações e os dados do ${BRAND_DISPLAY_NAME} salvos localmente.`,
    copyLinkLabel: "zona de perigo",

    spoofing: {
      title: TURN_OFF_PRODUCT,
      description: `Desative todas as proteções do ${BRAND_DISPLAY_NAME} até que você as ative novamente.`,
      copyLinkLabel: TURN_OFF_PRODUCT,
    },

    export: {
      title: "Exportar",
      description:
        "Baixe seus perfis regionais, regras e configurações atuais como um backup JSON.",
      button: "Exportar configurações",
      copyLinkLabel: "exportar configurações",
    },

    import: {
      title: "Importar",
      description:
        "Substitua as configurações locais atuais por um backup JSON exportado anteriormente.",
      button: "Importar configurações",
      copyLinkLabel: "importar configurações",
    },

    reload: {
      title: "Recarregar",
      description:
        "Recarregar as configurações salvas do armazenamento da extensão e descartar alterações não salvas na visualização atual.",
      button: "Recarregar configurações",
      copyLinkLabel: "recarregar configurações",
    },

    reset: {
      title: "Redefinir",
      description:
        "Restaure os padrões iniciais e remova seus perfis regionais e regras personalizados.",
      button: "Redefinir configurações",
      copyLinkLabel: "redefinir configurações",
      confirmTitle: "Redefinir configurações?",
      confirmBody:
        "Isso exclui permanentemente seus perfis regionais, regras e configurações personalizadas salvos. Isso não pode ser desfeito.",
      onboardingToggleLabel: "Executar configuração novamente após redefinir",
      onboardingToggleDescription:
        "Reabra o guia de configuração inicial assim que suas configurações forem limpas.",
    },
  },

  help: {
    title: "Avançado",
    body1: `Use Avançado para ajustar as proteções, desativar temporariamente o ${BRAND_DISPLAY_NAME} ou gerenciar suas configurações e dados salvos localmente.`,
    body2:
      "Importar, exportar, recarregar e redefinir ajudam você a mover configurações entre navegadores, corrigir erros ou restaurar configurações salvas quando algo fica fora de sincronia.",
  },
} as const;
