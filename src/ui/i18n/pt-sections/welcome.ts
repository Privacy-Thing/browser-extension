import { BRAND_DISPLAY_NAME } from "@/shared/brand";
import { externalMapConsentCopy } from "@/ui/i18n/pt-sections/osm";

const WELCOME_PRODUCT = `Bem-vindo ao ${BRAND_DISPLAY_NAME}`;

export const welcome = {
  title: WELCOME_PRODUCT,
  loading: "Carregando configuração...",
  progressLabel: "Progresso da configuração",
  previous: "Anterior",
  next: "Próximo",
  privacyPolicy: "Política de privacidade",
  privacyDialog: {
    title: "Política de Privacidade",
    description: `Como ${BRAND_DISPLAY_NAME} lida com configurações, diagnósticos e solicitações de rede.`,
    close: "Fechar política de privacidade",
  },
  saving: "Salvando...",
  unexpectedError: "Algo deu errado",
  importSuccess: "Configurações importadas",
  importError: "Não foi possível importar as configurações",
  importParseError: "Não foi possível ler o arquivo de configurações",
  steps: {
    welcome: {
      title: "Obrigado por instalar esta extensão",
      description:
        "Escolha o que os sites veem em vez de expor sua localização real e a identidade do navegador. Este breve guia opcional orienta você pelas primeiras escolhas de configuração — todas reversíveis — e as salva nas mesmas Configurações que você pode revisar a qualquer momento. Já tem uma configuração para reutilizar?",
      importInline: "Importar configurações em vez disso",
      advancedTitle: "Eu sei o que quero",
      advancedDescription:
        "Pule o guia e abra as Configurações com os padrões iniciais. Nenhum perfil regional nem Regra de Domínio será adicionado, a Regra Padrão permanecerá desativada e as proteções do navegador continuarão disponíveis para as regras que você criar depois.",
      guidedTitle: "Ir para a configuração",
      guidedDescription:
        "Percorra as primeiras decisões em ordem. O guia limita as escolhas, explica as implicações e salva tudo nas mesmas telas de Configurações que você poderá editar depois.",
      advancedCta: "Pular configuração",
      guidedCta: "Iniciar configuração",
    },
    privacy: {
      title: "Sua navegação permanece local",
      description: `${BRAND_DISPLAY_NAME} armazena regras e perfis regionais localmente. Esta etapa é apenas sobre serviços de mapa externos opcionais: ative-os se quiser pesquisa e pré-visualizações durante a configuração, ou deixe desativado e insira as coordenadas manualmente.`,
      descriptionBeforePolicy: `${BRAND_DISPLAY_NAME} armazena regras e perfis regionais localmente. A pesquisa e pré-visualizações de mapas opcionais usam serviços externos somente depois que você os permitir. Leia a`,
      policyLink: "política de privacidade",
      descriptionAfterPolicy:
        " antes de decidir se essas solicitações se encaixam na sua configuração.",
      consentTitle: externalMapConsentCopy.title,
      consentDescription: externalMapConsentCopy.description,
    },
    presets: {
      title: "Adicionar perfis regionais",
      description:
        "Perfis regionais fornecem locais prontos com configurações de idioma e fuso horário correspondentes, para que os sites vejam um perfil regional coerente. Selecione apenas os lugares que deseja na biblioteca inicial. A configuração importará os perfis selecionados no final, e você poderá editar ou excluir cada um deles depois.",
      selectAll: "Selecionar tudo",
      selectNone: "Limpar tudo",
      selectedCount: (count: number) =>
        `${count} ${count === 1 ? "selecionado" : "selecionados"}`,
    },
    scope: {
      title: "Escolher onde a proteção começa",
      description:
        "A Regra Padrão se aplica quando nenhuma configuração mais específica tem prioridade. Mantenha-a desativada para um início mais silencioso ou ative para proteger sites não correspondentes.",
      defaultRuleDescription:
        "Se você atribuir um perfil regional à Regra Padrão, mantenha esse perfil selecionado para que a configuração possa importá-lo antes de salvar.",
      enableEverywhereTitle: `Usar ${BRAND_DISPLAY_NAME} em todos os sites`,
      enableEverywhereDescription: `Ative a Regra Padrão agora se você quiser que o ${BRAND_DISPLAY_NAME} esteja ativo em sites sem suas próprias regras. Você ainda pode restringir o comportamento posteriormente com Regras de Domínio, atribuir diferentes perfis regionais a hosts específicos ou excluir sites sensíveis com Sites Confiáveis.`,
      editDefaultRuleTitle: "Configurações da Regra Padrão",
      editDefaultRule: "Editar Regra Padrão",
      editDefaultRuleDescription:
        "Escolha o perfil regional da Regra Padrão e as configurações de proteção personalizada antes de concluir a configuração.",
      defaultRuleDialogDescription:
        "Durante a configuração, esta janela pode usar os perfis regionais selecionados, mesmo que ainda não tenham sido importados. Se você atribuir um deles aqui, mantenha-o selecionado para que a configuração possa criá-lo.",
      presetMismatch: (label: string) =>
        `A Regra Padrão usa ${label}, mas esse perfil regional não está selecionado para importação. Selecione-o novamente ou escolha outro perfil para a Regra Padrão.`,
    },
    chromium: {
      title: "Detalhes da compilação do Chromium para rotação",
      description: (count: number) =>
        `${BRAND_DISPLAY_NAME} pode alternar os números de build e patch do Chromium expostos pelos Client Hints, mantendo a versão principal alinhada ao navegador instalado. O catálogo incluído contém builds recentes do Chromium; para esta versão do navegador, ${BRAND_DISPLAY_NAME} pode escolher entre ${count} ${count === 1 ? "opção compatível" : "opções compatíveis"}.`,
      switchTitle: "Rotacionar números de build e patch",
      switchDescription:
        "Use valores recentes de build e patch do Chromium do catálogo incluído quando os Client Hints forem simulados. Desative esta opção se você quiser que esses detalhes de versão menor permaneçam fixos.",
    },
    firefox: {
      title: "Permissão do userScripts do Firefox (opcional)",
      description: `Você pode usar ${BRAND_DISPLAY_NAME} no Firefox sem esta permissão. Se você conceder userScripts, ${BRAND_DISPLAY_NAME} pode aplicar valores simulados mais cedo nos sites suportados, melhorando a proteção durante o primeiro carregamento da página. Você pode pular isso agora e alterar depois nas Configurações.`,
      action: "Conceder permissão ao userScripts",
      granted: "Permissão concedida",
      skipped: `Você pode continuar usando ${BRAND_DISPLAY_NAME} sem esta permissão.`,
    },
    appearance: {
      title: "Ajuste a aparência",
      description: `Escolha como a interface da extensão deve aparecer antes de começar a usá-la. Essas configurações afetam apenas as telas do ${BRAND_DISPLAY_NAME}; elas não alteram o comportamento de simulação em sites, perfis regionais ou regras. Você pode ajustar as mesmas opções de exibição depois nas Configurações.`,
      themeTitle: "Tema",
      themeDescription: `Siga a configuração do seu sistema ou escolha uma interface clara ou escura fixa para todas as telas do ${BRAND_DISPLAY_NAME}.`,
      reduceMotionTitle: "Reduzir movimento",
      reduceMotionDescription: `Desativar animações da interface em todo o ${BRAND_DISPLAY_NAME}.`,
      reduceMotionSystemOverride:
        "Movimento reduzido está ativado pelas configurações de acessibilidade do seu sistema.",
      accentTitle: "Cor de destaque",
      accentDescription:
        "Escolha a cor de destaque usada para controles, estados ativos, acentos de foco e itens selecionados.",
      contrastTitle: "Modo de alto contraste",
      contrastDescription:
        "Aumente o contraste para texto, bordas e controles em toda a interface da extensão quando a aparência padrão parecer muito sutil.",
    },
    done: {
      title: "Configuração pronta",
      description: `${BRAND_DISPLAY_NAME} salvará essas escolhas e abrirá as Configurações. Você pode revisar os perfis regionais importados, ajustar a Regra Padrão e alterar configurações de aparência ou privacidade lá.`,
      cta: "Abrir Configurações",
    },
  },
  presetNames: {
    spfWarsaw: "Varsóvia",
    spfParis: "Paris",
    spfLondon: "Londres",
    spfOttawa: "Ottawa",
    spfNewYork: "Nova York",
    spfLasVegas: "Las Vegas",
    spfSanFrancisco: "San Francisco",
    spfSydney: "Sydney",
    spfBeijing: "Pequim",
    spfHongKong: "Hong Kong",
    spfNewDelhi: "Nova Délhi",
    spfCairo: "Cairo",
    spfLagos: "Lagos",
    spfKyiv: "Kyiv",
    spfKinshasa: "Kinshasa",
    spfSaoPaulo: "São Paulo",
    spfBuenosAires: "Buenos Aires",
    spfLima: "Lima",
    spfRioDeJaneiro: "Rio de Janeiro",
    spfCaracas: "Caracas",
    spfBerlin: "Berlim",
    spfMadrid: "Madri",
  },
  themeOptions: {
    system: "Sistema",
    light: "Claro",
    dark: "Escuro",
  },
} as const;
