import type { SurfacePresentationState } from "@privacy-brand/xray-protocol";

import { BRAND_DIAGNOSTICS_NAME, BRAND_DISPLAY_NAME } from "@/shared/brand";

const formatCount = (count: number, singular: string, plural: string): string =>
  `${count} ${count === 1 ? singular : plural}`;

export const popup = {
  loading: "Carregando…",
  protectionProtected: "Protegido",
  protectionOff: "Desativado",
  protectionDisabled: "Proteções desabilitadas",
  protectionNeedsAttention: "Precisa de atenção",
  protectionUnknown: "Status da proteção indisponível",
  protectionSourceSiteRule: "Regra de Domínio",
  protectionSourceContainer: "Contêiner Firefox",
  protectionSourceDefaultRule: "Regra Padrão",
  protectionSourceTrustedSite: "Site Confiável",
  protectionSourceNone: "Nenhuma regra ativa",
  protectionSourceGlobalSetting: "Configuração global",
  languagePriorityTooltip: (languages: readonly string[]) =>
    [
      "Prioridade de idioma:",
      ...languages.map((language, index) => `${index + 1}. ${language}`),
    ].join("\n"),
  protectionViewDetails: "Ver detalhes",
  protectionViewPageActivity: "Ver atividade da página",
  protectionDetailsTitle: "Detalhes de proteção",
  protectionDetailsLead: `Veja como ${BRAND_DISPLAY_NAME} lida com cada recurso do navegador neste site.`,
  protectionGroupLocationLocale: "Localização, hora e idioma",
  protectionGroupBrowserIdentity: "Identidade do navegador",
  protectionGroupRenderingMedia: "Renderização e mídia",
  protectionGroupWorkers: "Web Workers",
  protectionStateProtected: "Protegido",
  protectionStateDegraded: "Degradado",
  protectionStateNative: "Não modificado",
  protectionStateMixed: "Misto",
  protectionStatePending: "Confirmando…",
  protectionStateRepaired: "Proteção restaurada",
  protectionStateBrowserEnforced: "Protegido pelo navegador",
  protectionStateUnrecoverable: "Falha na proteção",
  protectionStateNotApplicable: "Não aplicável",
  protectionStateCompatibility: "Problema de compatibilidade",
  protectionSurfaceUnknown: (surface: string) =>
    `O status de ${surface} é desconhecido.`,
  protectionPageMayNotWork: "Esta página pode não funcionar corretamente",
  protectionServiceWorkerBlockTitle: "Service Workers estão bloqueados",
  protectionServiceWorkerBlockSummary: `${BRAND_DISPLAY_NAME} está bloqueando o registro de Service Worker neste site.`,
  protectionServiceWorkerBlockDescription:
    "O modo offline, notificações push, sincronização em segundo plano e outros recursos do Service Worker podem não funcionar enquanto o bloqueio estiver ativado.",
  protectionSharedWorkerStrictTitle: "O modo estrito para Shared Workers está ativado",
  protectionSharedWorkerStrictSummary: `${BRAND_DISPLAY_NAME} bloqueia qualquer Shared Worker que não possa simular antes de começar.`,
  protectionSharedWorkerStrictDescription:
    "Sincronização entre abas, conexões compartilhadas e colaboração ao vivo podem não funcionar enquanto o modo estrito estiver ativado.",
  notificationsTitle: "Notificações",
  notificationsThisSite: "Este site",
  notificationsExtension: BRAND_DISPLAY_NAME,
  notificationsPreviousUpdates: "Atualizações anteriores",
  notificationsDismissed: "Descartadas",
  notificationsResolved: "Resolvidas",
  notificationsNew: "Novas",
  notificationsAcknowledged: "Lidas",
  notificationsStillActive: "Precisa de atenção",
  notificationsEmpty: "Nenhuma notificação ativa.",
  notificationsDismiss: "Descartar",
  notificationsKeepStrictMode: "Manter modo estrito",
  notificationsWhatThisAffects: "O que isso afeta",
  notificationsBeforeYouContinue: "Antes de continuar",
  notificationsChooseSharedWorkerMode:
    "Escolha como os Workers Compartilhados são executados neste site",
  notificationsCspTitle: "Este site bloqueou a simulação do worker",
  notificationsCspSummary: `${BRAND_DISPLAY_NAME} não conseguiu proteger um worker neste site.`,
  notificationsSharedWorkerTitle: "Falha na simulação do Worker Compartilhado",
  notificationsSharedWorkerSummary: `${BRAND_DISPLAY_NAME} não conseguiu aplicar valores simulados antes que um Worker Compartilhado fosse iniciado.`,
  notificationsRelaxWorkerPolicy: "Permitir simulação de worker",
  notificationsAllowServiceWorkers: "Permitir Service Workers",
  notificationsSharedWorkerNative: "Nativo",
  notificationsSharedWorkerNativeDescription: `Executa Workers Compartilhados normalmente, sem a proteção do ${BRAND_DISPLAY_NAME}. Isso oferece a melhor compatibilidade, mas um worker pode ler os valores reais do seu navegador.`,
  notificationsSharedWorkerSpoof: "Simular",
  notificationsSharedWorkerSpoofDescription: `Tenta um método alternativo de proteção para Workers Compartilhados. Alguns workers ainda podem falhar ao iniciar.`,
  notificationsUpdateTitle: `${BRAND_DISPLAY_NAME} foi atualizado`,
  notificationsUpdateSummary: "Revise as alterações nesta versão.",
  notificationsVersionLabel: "Versão",
  notificationsOpenLink: "Abrir link",
  notificationsBadgeLabel: (count: number) =>
    formatCount(count, "notificação não lida", "notificações não lidas"),
  protectionCounts: (counts: Record<SurfacePresentationState, number>) => {
    // Roll the 9 presentation states up into the buckets a one-line summary
    // can carry without becoming unreadable. `browser-enforced`/`repaired`
    // are protected-like; `unrecoverable` folds into the degraded bucket.
    const protectedCount =
      counts.protected + counts["browser-enforced"] + counts.repaired;
    const degradedCount = counts.degraded + counts.unrecoverable;
    return [
      ...(protectedCount > 0
        ? [formatCount(protectedCount, "protegido", "protegidos")]
        : []),
      ...(degradedCount > 0
        ? [formatCount(degradedCount, "degradado", "degradados")]
        : []),
      ...(counts.pending > 0 ? [`${counts.pending} confirmando`] : []),
      ...(counts["native-by-policy"] > 0
        ? [formatCount(counts["native-by-policy"], "não modificado", "não modificados")]
        : []),
      ...(counts["not-applicable"] > 0
        ? [formatCount(counts["not-applicable"], "não aplicável", "não aplicáveis")]
        : []),
      ...(counts.unknown > 0
        ? [formatCount(counts.unknown, "desconhecido", "desconhecidos")]
        : []),
    ].join(" · ");
  },
  protectionException: (_surface: string) =>
    "Esta página pode não funcionar corretamente",
  unsupportedTab: "Página restrita",
  noLocationYet: "Nenhum perfil regional ativo",
  noPresetAssigned: "Nenhum perfil regional atribuído",
  regularPageRequired: `${BRAND_DISPLAY_NAME} não pode acessar esta página.`,
  openXRay: `Veja a atividade deste site em ${BRAND_DIAGNOSTICS_NAME}`,
  saveLabelCreate: "Criar",
  saveLabelSave: "Salvar",
  ruleConflictConfirm: (pattern: string) =>
    `Uma Regra de Domínio para “${pattern}” já existe. Substituí-la por estas configurações?`,
  ruleConflictTitle: "Substituir Regra de Domínio?",
  ruleConflictReplace: "Substituir",
  popupDataUnavailable: "Não foi possível carregar o status deste site.",
  retryLabel: "Tentar novamente",
  dismissLabel: "Descartar",
  mutationFailed: `${BRAND_DISPLAY_NAME} não pôde completar essa ação. Tente novamente.`,
  enableExtensionFailed: `Não foi possível ativar o ${BRAND_DISPLAY_NAME}.`,
  trustSiteFailed: "Não foi possível adicionar este site aos Sites Confiáveis.",
  firefoxPermissionFailed:
    "Não foi possível conceder permissão ao userScripts do Firefox.",
  powerControlExtension: BRAND_DISPLAY_NAME,
  powerControlGlobalProtections: "Proteções globais",
  powerTargetLoading: "Verificando as configurações deste site…",
  powerTargetGlobal: `${BRAND_DISPLAY_NAME} está desativado em todos os sites.`,
  powerTargetGlobalProtectionsDisabled:
    "Ative-as nas Configurações para usar suas regras e seus perfis regionais salvos.",
  powerTargetUnsupported: `${BRAND_DISPLAY_NAME} não pode acessar esta página.`,
  powerTargetTrustedSite: `${BRAND_DISPLAY_NAME} está desativado porque este site corresponde aos Sites Confiáveis.`,
  powerTargetSiteRule: "Ativa ou desativa esta Regra de Domínio.",
  powerTargetContainer: "Ativa ou desativa esta atribuição de Contêiner do Firefox.",
  powerTargetContainerSetup: `Configure o ${BRAND_DISPLAY_NAME} para este Contêiner do Firefox.`,
  powerTargetContainerDefaultRule: "Este Contêiner do Firefox usa a Regra Padrão.",
  powerTargetDefaultRule: "Controla sites sem uma Regra de Domínio ou Site Confiável.",
  powerAriaLoading: "Verificando as configurações deste site",
  powerAriaGlobalOff: `${BRAND_DISPLAY_NAME} está desativado em todos os sites`,
  powerAriaGlobalProtectionsDisabled:
    "As proteções globais estão desativadas. Ative-as nas Configurações.",
  powerAriaRestricted: `${BRAND_DISPLAY_NAME} não pode acessar esta página`,
  powerAriaTrustedSite: `Ativar ${BRAND_DISPLAY_NAME} para este site`,
  powerAriaDomainRuleOn: "Ativar esta Regra de Domínio",
  powerAriaDomainRuleOff: "Desativar esta Regra de Domínio",
  powerAriaContainerOn: "Ativar esta atribuição de Contêiner do Firefox",
  powerAriaContainerOff: "Desativar esta atribuição de Contêiner do Firefox",
  powerAriaContainerSetup: `Configurar ${BRAND_DISPLAY_NAME} para este Contêiner do Firefox`,
  powerAriaDefaultRuleOn: "Ativar a Regra Padrão",
  powerAriaDefaultRuleOff: "Desativar a Regra Padrão",

  sheetTitle: "Regra de Domínio",
  currentProfileLabel: "Perfil regional",
  noPresetLabel: "Sem perfil regional",
  inheritedDefaultRuleProfileLabel: "Usar perfil regional da Regra Padrão",
  inheritedContainerProfileLabel: "Usar perfil regional de Contêiner do Firefox",
  inheritedDomainRuleProfileLabel:
    "Usar perfil regional de Regra de Domínio correspondente",
  ruleTypeLabel: "Aplica-se a",
  ruleTypeExact: "Host exato",
  ruleTypeSuffix: "Host + subdomínios",
  workerHandlingLabel: "Workers Dedicados & Compartilhados",
  workerHandlingHint:
    "Escolha um modo para esta regra. Herdar usa a configuração global. Nativo permite que os workers sejam executados com valores reais do navegador. Simular tenta protegê-los. Rigoroso bloqueia um worker quando a proteção não pode ser confirmada antes da inicialização.",
  workerHandlingInherit: "Herdar",
  workerHandlingNative: "Nativo",
  workerHandlingSpoof: "Simular",
  workerHandlingStrict: "Rigoroso",
  viewXRay: BRAND_DIAGNOSTICS_NAME,
  deleteButtonLabel: "Excluir",
  sheetLead:
    "Escolha onde esta Regra de Domínio se aplica e qual perfil regional ela usa. Alterar o perfil regional recarrega a página.",
  cleanupSheetTitle: "Nova identidade",
  cleanupConfirmTitle: "Criar nova identidade?",
  cleanupPlanLoading: "Verificando o que este navegador pode limpar…",
  cleanupPlanDescription: (available: string, unavailable: string) =>
    unavailable
      ? `${BRAND_DISPLAY_NAME} irá limpar ${available}. Este navegador não pode limpar ${unavailable} aqui.`
      : `${BRAND_DISPLAY_NAME} limpará ${available}.`,
  cleanupResultTitle: "Nova identidade criada",
  cleanupResultComplete: `Os dados do navegador disponíveis para ${BRAND_DISPLAY_NAME} foram limpos.`,
  cleanupResultPartial:
    "Alguns dados do navegador foram limpos, mas este navegador não disponibilizou todos os itens.",
  cleanupResultFailed: `A identidade mudou, mas ${BRAND_DISPLAY_NAME} não conseguiu limpar os dados do navegador associados. Você pode tentar novamente sem mudar a identidade.`,
  cleanupSurfaceCookies: "cookies",
  cleanupSurfaceLocalStorage: "armazenamento local",
  cleanupSurfaceIndexedDb: "IndexedDB",
  cleanupSurfaceCacheStorage: "Cache Storage",
  cleanupSurfaceServiceWorkers: "Service Workers",
  cleanupSurfacePageStorage: "armazenamento em páginas abertas",
  cleanupStatusCleaned: "Limpo",
  cleanupStatusSkipped: "Indisponível",
  cleanupStatusFailed: "Falhou",
  cleanupConfirmLabel: "Criar nova identidade",
  deleteConfirmTitle: "Excluir regra de domínio?",
  deleteConfirmDescription: (pattern: string) =>
    `Isso remove a regra de domínio salva para “${pattern}”.`,
  cleanDomainAriaLabel: "Crie uma nova identidade para este site",
  cleanDomainLabel: "Nova identidade",
  cleanDomainDefaultRuleDisabled: "Indisponível para a Regra Padrão",
  cleanDomainProductOffDisabled: `Indisponível enquanto ${BRAND_DISPLAY_NAME} estiver desativado para este site`,
  cleanDomainContainerSetupDisabled: "Configure este Contêiner do Firefox primeiro",
  cleanDomainPageDisabled: "Indisponível nesta página",
  cleanDomainLoadingDisabled: "Disponível após o site terminar de carregar",
  cleanDomainAvailabilityHint:
    "Nova identidade funciona com uma Regra de Domínio ou um Contêiner do Firefox configurado.",
  openSettingsAriaLabel: "Abrir configurações",
  openFullRuleSettings: "Abrir em Regras de Domínio",
  settingsLabel: "Configurações",
  closeSheetAriaLabel: "Fechar Regra de Domínio",
  trustedSiteCta: "Editar Site Confiável",
  disableOnSiteCta: "Adicionar a Sites Confiáveis",
  enableTrustCta: "Adicionar a Sites Confiáveis",
  extensionOffCardAction: `Ativar ${BRAND_DISPLAY_NAME}`,
  surfaceGeolocation: "Geolocalização",
  surfaceTimeLocale: "Hora e Localidade",
  surfaceNavigator: "navigator",
  surfaceScreen: "Tela",
  surfaceClientHints: "Client Hints",
  surfaceBattery: "Bateria",
  surfaceCanvas: "Tela de desenho (Canvas)",
  surfaceWebGL: "WebGL",
  surfaceAudio: "Áudio",
  surfaceWebRTC: "WebRTC",
  surfaceWorker: "Workers Dedicados",
  surfaceServiceWorker: "Service Workers",
  surfaceSharedWorker: "Workers Compartilhados",
  addExactOverrideCta: "Adicionar Regra de Site",
  containerSetupCta: "Configurar Contêiner",
  globalFallbackRuleCta: "Editar Regra Padrão",
  editDomainRuleLabel: "Editar Regra de Domínio",
  editContainerLabel: "Editar Contêiner",
  firefoxFirstInlinePermissionTitle:
    "Melhorar a simulação no primeiro carregamento no Firefox",
  firefoxFirstInlinePermissionDescription: `O Firefox pode expor sua hora real e local para o primeiro script da página. Conceda a permissão opcional userScripts para que ${BRAND_DISPLAY_NAME} possa começar a simular mais cedo.`,
  firefoxFirstInlinePermissionEnableLabel: "Conceder permissão",
  detailsAbout: (label: string) => `Detalhes sobre ${label}`,
  relaxCspHint: `Isso remove os cabeçalhos da Política de Segurança de Conteúdo do site quando eles impedem que ${BRAND_DISPLAY_NAME} proteja os workers. Isso enfraquece a proteção do site contra scripts maliciosos; habilite apenas para um site em que você confia.`,
  advancedSectionTitle: "Avançado",
  suggestionWorkerCspDescription:
    "A Política de Segurança de Conteúdo (CSP) deste site bloqueou a simulação de worker. Permitir a simulação de worker irá relaxar essa política e enfraquecer a proteção do site contra scripts injetados. Continue apenas se você confiar neste site.",
  suggestionSharedWorkerInjectionDescription: `${BRAND_DISPLAY_NAME} não pôde proteger este Worker Compartilhado antes de ele começar. Escolha se a compatibilidade ou a proteção é mais importante neste site.`,
} as const;
