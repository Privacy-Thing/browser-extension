import type { CleanupMessages } from "./cleanup-copy-en";

import { BRAND_DISPLAY_NAME } from "@/shared/brand";
export const cleanupPt = {
  title: "Desconectar o Control D?",
  deleteChoice: `Desconectar e excluir o que o ${BRAND_DISPLAY_NAME} criou`,
  keepChoice: "Desconectar",
  keepDescription:
    "Esquece a chave de API e interrompe a sincronização. Os recursos remotos e o DNS do navegador permanecem.",
  review: "Revisar plano de exclusão",
  planTitle: "Revisar o que será excluído",
  planDescription:
    "Só podem ser excluídos recursos registrados com nomes correspondentes e conteúdo inalterado. Os recursos ignorados permanecerão.",
  dnsWarning:
    "Primeiro altere o provedor de DNS seguro do navegador para deixar de usar este resolvedor do Control D. Excluir um endpoint interrompe a resolução de nomes em todos os dispositivos que ainda o usam. O DNS do navegador não é alterado aqui.",
  dnsConfirmed: "Eu alterei o DNS do meu navegador",
  confirm: "Confirmar exclusão e desconectar",
  resultTitle: "Resultados da limpeza",
  retry: "Revisar e tentar novamente as falhas",
  retainedKey:
    "A sincronização foi interrompida. A chave de API e os registros de propriedade restantes são mantidos localmente para tentar novamente. Desconecte sem excluir para esquecer a chave agora.",
  finished: "A sincronização foi interrompida e a chave de API foi esquecida.",
  close: "Fechar",
  cancel: "Cancelar",
  working: "Processando…",
  failedRequest:
    "A solicitação de limpeza falhou. Revise o plano antes de tentar novamente.",
  deleteLabel: "Será excluído",
  skipped: "Ignorado",
  deleted: "Excluído",
  failed: "Falhou",
  folder: "Pasta",
  rule: "Regra",
  service: "Configuração de serviço",
  endpoint: "Endpoint",
  profile: "Perfil",
  nameChanged: "O nome remoto não corresponde mais.",
  contentChanged:
    "O conteúdo remoto difere do último estado registrado ou sua propriedade não pode ser verificada.",
  notRecorded: `Este recurso não foi registrado como criado pelo ${BRAND_DISPLAY_NAME}.`,
  containsPreserved: "Contém ou depende de recursos que devem ser preservados.",
  sharedProfile: "Outro endpoint usa este perfil.",
  alreadyDeleted: "Já excluído.",
  dependencyFailed: "Uma exclusão necessária falhou; tente novamente primeiro.",
  empty: "Não há recursos registrados para excluir.",
  forgetKey: "Desconectar e esquecer a chave",
} satisfies CleanupMessages;
