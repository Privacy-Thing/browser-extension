import { BRAND_DISPLAY_NAME } from "@/shared/brand";

const PRODUCT_NOT_LOWER = `o que ${BRAND_DISPLAY_NAME} não é`;

export const rules = {
  title: "Regras de Domínio",
  hint: "Regras de Domínio mapeiam padrões de host para perfis regionais.",
  addButton: "Adicionar regra",
  filterLabel: "Filtrar regras",
  filterPlaceholder: "Pesquisar perfis regionais, padrões de domínio, avisos",
  locationFilterLabel: "Filtrar por perfil regional",
  locationFilterPlaceholder: "Todos os perfis regionais",
  assignLocationLabel: "Atribuir perfil regional",
  tableHeadRule: "Regra",
  tableHeadProfile: "Perfil regional",
  tableHeadActions: "Ações",
  selectAllAriaLabel: "Selecionar todas as regras visíveis",
  selectMenuAriaLabel: "Abrir menu de seleção de regras",
  selectRuleAriaLabel: (pattern: string) => `Selecionar regra ${pattern}`,
  editRuleAriaLabel: (pattern: string) => `Editar regra ${pattern}`,
  editRuleTitle: "Editar regra",
  deleteRuleAriaLabel: (pattern: string) => `Excluir regra ${pattern}`,
  deleteRuleTitle: "Excluir regra",
  inactiveBadge: "inativo",
  selectionMenuAllVisible: "Todos visíveis",
  selectionMenuAll: "Todos",
  selectionMenuNone: "Nenhum",
  selectionMenuActive: "Apenas ativos",
  selectionMenuInactive: "Apenas inativos",
  noRulesFiltered: "Nenhuma regra corresponde ao filtro atual.",
  noRulesEmpty: `Ainda não há Regras de Domínio. Adicione uma para escolher como ${BRAND_DISPLAY_NAME} trata os sites correspondentes.`,
  copyLinkLabel: "regras de domínio",
  copyLinkHelpLabel: "ajuda de regras de domínio",
  copyLinkInspectorLabel: "inspetor de hostname",
  copyLinkRuleAriaLabel: (pattern: string) => `Copiar link da regra ${pattern}`,

  help: {
    title: "Regras de Domínio",
    body1:
      "Use <code>example.com</code> para um host exato. Use <code>*example.com</code> para esse host e qualquer subdomínio, como <code>www.example.com</code>. Use <code>*.example.com</code> apenas para subdomínios.",
    body2: `O padrão de correspondência mais específico tem prioridade. Se duas regras se sobrepuserem e apontarem para perfis regionais diferentes, ${BRAND_DISPLAY_NAME} mostrará um aviso.`,
  },

  globalFallback: {
    title: "Regra Padrão",
    description: `Defina as proteções padrão e o perfil regional opcional que ${BRAND_DISPLAY_NAME} usa quando nada mais específico tem prioridade.`,
    copyLinkLabel: "Regra Padrão",
    overridesBadge: (count: number) =>
      `${count} ${count === 1 ? "configuração personalizada" : "configurações personalizadas"}`,
    openInRules: "Editar em Regras de Domínio",
    editAriaLabel: "Editar Regra Padrão",
    editTitle: "Editar Regra Padrão",
    noPresetLabel: "Nenhum perfil regional atribuído",
    setupHint: "Nenhuma configuração de proteção pré-definida ou personalizada ainda.",
    tableHint: "Configurações padrão quando nada mais específico se aplica.",
    dialog: {
      title: "Regra Padrão",
      description:
        "Defina as proteções e o perfil regional opcional que a Regra Padrão deve usar quando nada mais específico tiver prioridade.",
      identityDescription:
        "A Regra Padrão mantém sua própria identidade de simulação fixa. Não pode ser alterada manualmente.",
      enabledLabel: "Ativado",
      enabledHint:
        "Quando desativada, esta regra não se aplica. Suas configurações permanecem salvas.",
      enabledAriaLabel: "Alternar a Regra Padrão",
      locationProfileLabel: "Perfil regional",
      locationProfileHint:
        "Escolha o perfil regional que a Regra Padrão deve usar. Deixe sem atribuição para usar apenas as configurações de proteção abaixo.",
      locationProfileWarningPrefix: `${BRAND_DISPLAY_NAME} não substitui VPN, proxy ou ferramentas de DNS. `,
      locationProfileWarningLinkLabel: `Veja ${PRODUCT_NOT_LOWER}`,
      locationProfileWarningSuffix: ".",
      locationLabel: "Perfil regional",
      locationPlaceholder: "Escolher perfil regional",
      submit: "Salvar regra",
    },
  },

  inspector: {
    title: "Inspetor de hostname",
    hint: `Verifique como o ${BRAND_DISPLAY_NAME} trata um nome de host antes de salvar as alterações. Ele mostra se o nome de host corresponde a uma Regra de Domínio ou Site Confiável, e qual configuração regional se aplicaria.`,
    hostnameLabel: "Nome do Host",
    hostnameHint:
      "Use o host exato que deseja inspecionar, por exemplo, shop.example.com.",
    hostnamePlaceholder: "ex.: shop.example.com",
    noMatchTitle:
      "Nenhuma Regra de Domínio ou Site Confiável salvo corresponde a este nome de host",
    noMatchDescription:
      "Nenhuma regra salva se aplica, e a Regra Padrão está desligada ou não configurada.",
    trustedSiteWinsTitle: "Este nome de host está desativado pelos Sites Confiáveis",
    trustedSiteWinsDescription: `Ele corresponde à sua lista de Sites Confiáveis, então o ${BRAND_DISPLAY_NAME} permanece desligado aqui até que você remova ou desative essa entrada.`,
    trustedSiteOverridesRuleTitle:
      "Sites Confiáveis estão substituindo uma Regra de Domínio correspondente",
    trustedSiteOverridesRuleDescription: `Este nome de host corresponde tanto a um Site Confiável quanto a uma Regra de Domínio. Sites Confiáveis têm prioridade, portanto ${BRAND_DISPLAY_NAME} permanece desligado e a Regra de Domínio abaixo é ignorada.`,
    fallbackWinsTitle: "Regra Padrão se aplica aqui",
    fallbackWinsDescription: `Nenhuma Regra de Domínio ou Site Confiável correspondeu a este nome de host, então ${BRAND_DISPLAY_NAME} cairia de volta para a Regra Padrão aqui.`,
    ruleMatchTitle: (locationLabel: string) =>
      `${locationLabel} é o perfil regional ativo aqui`,
    ruleMatchDescription: `Este nome de host corresponde à Regra de Domínio abaixo, então ${BRAND_DISPLAY_NAME} usaria este perfil regional no site.`,
    hostnameDetailLabel: "Nome do Host",
    trustedSiteDetailLabel: "Site Confiável",
    ruleDetailLabel: "Regra",
    defaultRuleDetailLabel: "Regra Padrão",
    ignoredRuleDetailLabel: "Regra Ignorada",
    profileDetailLabel: "Perfil regional",
    geolocationDetailLabel: "Geolocalização",
    localeDetailLabel: "Localidade",
    timeZoneDetailLabel: "Fuso horário",
    geolocationOn: "Ligado",
    geolocationOff: "Desligado",
  },

  dialog: {
    titleAdd: "Adicionar regra",
    titleEdit: "Editar regra",
    description:
      "Escolha onde esta regra se aplica, e então decida se deve usar um perfil regional, configurações de proteção personalizadas ou ambos.",
    patternLabel: "Padrão",
    patternInfo:
      "Use <code>example.com</code> para um host exato. Use <code>*example.com</code> para esse host e qualquer subdomínio, como <code>www.example.com</code>. Use <code>*.example.com</code> apenas para subdomínios.",
    patternInfoAriaLabel: "Aprenda como os padrões de regra funcionam",
    patternPlaceholder: "Insira um padrão de domínio",
    locationLabel: "Perfil regional",
    locationProfileLabel: "Perfil regional",
    locationProfileHint: `Escolha o perfil regional que esta regra deve usar. Se nenhum estiver atribuído, ${BRAND_DISPLAY_NAME} usa o próximo perfil regional disponível enquanto mantém as configurações de proteção desta regra.`,
    bulkAssignSearchPlaceholder: "Pesquisar perfis regionais...",
    enabledLabel: "Ativado",
    enabledHint:
      "Quando desativada, esta regra não se aplica. Suas configurações permanecem salvas.",
    enabledAriaLabel: (pattern: string) =>
      `Alternar estado ativado para a regra ${pattern}`,
    advancedModal: {
      trigger: "Avançado",
      title: (pattern: string) => `Configurações avançadas para ${pattern}`,
      description:
        "Essas alterações permanecem no rascunho atual até você salvar a regra.",
      confirm: "Ok",
      patternFallback: "esta regra",
    },
    relaxCspLabel: "Relaxar CSP para simulação de worker",
    relaxCspHint: `Remove os cabeçalhos de Política de Segurança de Conteúdo deste site quando eles impedem que ${BRAND_DISPLAY_NAME} proteja os workers.`,
    relaxCspRiskHint:
      "Aviso de segurança: isso facilita a execução de scripts maliciosos no site. Ative-o apenas para um site em que você confie e apenas quando a proteção do worker falhar.",
    relaxCspAriaLabel: (pattern: string) =>
      `Alternar relaxamento de CSP para a regra ${pattern}`,
    surfaceOverrides: {
      title: "Configurações de proteção",
      description:
        "Escolha diferentes configurações de proteção para esta regra. Deixe uma configuração em Herdar para seguir a configuração global.",
      stateOn: "Ligado",
      stateInherit: "Herdar",
      stateOff: "Desligado",
      stateNative: "Nativo",
      stateSpoof: "Simular",
      stateStrict: "Rigoroso",
      stateBlock: "Bloquear",
      stateAllow: "Permitir",
      helpAriaLabel: (label: string) => `Saiba o que ${label} controla`,
      geolocation: {
        label: "Geolocalização",
        info: "Controla a API de Geolocalização. Desative quando um site deve ler sua localização real no navegador ou ative quando esta regra deve simular consultas de localização.",
      },
      timeLocale: {
        label: "Hora e Localidade",
        info: "Controla Date, Intl, navigator.language, navigator.languages e cabeçalhos de idioma para que os sites vejam a região do seu perfil regional ativo.",
      },
      canvas: {
        label: "Tela de desenho (Canvas)",
        info: "Controla os sites de saída de imagens ocultas usados para impressão digital de canvas.",
      },
      webGL: {
        label: "WebGL",
        info: "Controla detalhes gráficos como renderer, pistas de GPU e dados relacionados de impressão digital WebGL.",
      },
      audio: {
        label: "Áudio",
        info: "Controla a saída do AudioContext que os sites podem medir para impressão digital de áudio.",
      },
      navigator: {
        label: "navigator",
        info: "Controla campos de identidade do navegador, como plataforma, dicas de hardware e outras propriedades do navegador.",
      },
      screen: {
        label: "Tela",
        info: "Controla o tamanho da tela, a proporção de pixels e detalhes relacionados à exibição.",
      },
      clientHints: {
        label: "Client Hints",
        info: "Controla detalhes do navegador e do dispositivo compartilhados através de cabeçalhos e APIs do Client Hints.",
      },
      battery: {
        label: "Bateria",
        info: "Controla se o site recebe um perfil de bateria completo e cheio fixo em vez do estado real da bateria do dispositivo.",
      },
      webRTC: {
        label: "WebRTC",
        info: "Controla a proteção no gerenciamento de IP do WebRTC que pode reduzir vazamentos de IP local e público.",
      },
      serviceWorker: {
        label: "Service Workers",
        info: "Controla se este site pode registrar Service Workers, que podem rodar em segundo plano e manter dados de longa duração. Bloquear pode impedir PWAs, modo offline, notificações push e sincronização em segundo plano; Permitir deixa o navegador lidar com o registro normalmente; Herdar segue a configuração global.",
      },
      sharedWorker: {
        label: "Workers Dedicados & Compartilhados",
        info: "Substitui o gerenciamento de Dedicated e Shared Workers para esta regra. Nativo mantém os workers inalterados, Simular tenta aplicar valores simulados, e Estrito bloqueia um worker quando a simulação não pode ser confirmada antes da inicialização.",
      },
    },
    identity: {
      sectionTitle: "Identidade",
      sectionDescription:
        "Esta regra mantém sua própria identidade de simulação. Gere outra apenas quando quiser uma nova impressão digital e um estado limpo do site para esta regra.",
      actionDescription:
        "Limpa os dados relacionados ao site e inicia esta regra com uma identidade nova.",
      actionLabel: "Nova identidade",
      confirmTitle: (pattern: string) => `Nova identidade para ${pattern}?`,
      confirmDescription:
        "Isso limpa cookies, armazenamento, Service Workers e caches dos sites vinculados a esta regra. Em seguida, cria uma nova identidade de simulação.",
      confirmDomainsLabel: `${BRAND_DISPLAY_NAME} limpará os dados do navegador para estes domínios:`,
      confirmNoDomains: `Ainda não há dados do navegador registrados para esta regra. Mesmo assim, ${BRAND_DISPLAY_NAME} criará uma nova identidade de simulação.`,
      confirmLabel: "Criar nova identidade",
      rotateSuccess: "Nova identidade de regra salva.",
      rotateError: "Falha ao criar uma nova identidade de regra.",
    },
    submitAdd: "Adicionar regra",
    submitEdit: "Salvar",
    duplicateAlertTitle: "Sobrescrever regra existente?",
    duplicateAlertDescription: (pattern: string) =>
      `Uma regra para "${pattern}" já existe. Quer sobrescrevê-la com estas configurações?`,
    duplicateAlertConfirm: "Sobrescrever",
    duplicateAlertClose: "Não",
    trustedSiteOverrideWarning: (pattern: string) =>
      `Este domínio corresponde à entrada Sites Confiáveis "${pattern}". ${BRAND_DISPLAY_NAME} permanecerá desativado aqui independentemente destas configurações.`,
  },
} as const;
