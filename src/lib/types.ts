import type { Generated } from "kysely";

export type Role =
  | "MECANICO"
  | "ANALISTA_PROGRAMACAO"
  | "ANALISTA_FATURAMENTO"
  | "GESTOR";

export type Armador = "MAERSK" | "MSC" | "HAPAG" | "ZIM" | "LOGIN";
export type Padrao = "AL" | "CG" | "OU";
export type StatusContainer = "WS" | "AR" | "AE" | "RE" | "OK";
export type SolicitanteTipo = "MATRIZ" | "SJP" | "PG";
export type TipoCarga = "CHEIO" | "VAZIO";
export type ColetaStatus = "PENDENTE" | "CONCLUIDO";
export type Dm = "DM1" | "DM2" | "DM3" | "DM4";
export const DM_OPCOES: Dm[] = ["DM1", "DM2", "DM3", "DM4"];

export const ARMADORES: Armador[] = ["MAERSK", "MSC", "HAPAG", "ZIM", "LOGIN"];
export const PADROES: Padrao[] = ["AL", "CG", "OU"];
export const STATUS_CONTAINER: StatusContainer[] = ["WS", "AR", "AE", "RE", "OK"];
export const SOLICITANTES: SolicitanteTipo[] = ["MATRIZ", "SJP", "PG"];
export const TIPOS_CARGA: TipoCarga[] = ["VAZIO", "CHEIO"];

export const PADRAO_LABELS: Record<Padrao, string> = {
  AL: "Alimento",
  CG: "Carga Geral",
  OU: "Aguardando Vistoria",
};

export const STATUS_LABELS: Record<StatusContainer, string> = {
  WS: "Aguardando Vistoria",
  AR: "Aguardando Autorização Reparo",
  AE: "Aguardando Entrada/Reparo",
  RE: "Em Reparo de Estrutura",
  OK: "Disponível",
};

export const SOLICITANTE_LABELS: Record<SolicitanteTipo, string> = {
  MATRIZ: "Matriz",
  SJP: "SJP",
  PG: "PG",
};

export const META_DIARIA_REPAROS = 35;
export const META_DIARIA_COLETAS = 35;
// Meta semanal de coletas: 35/dia em dias uteis (seg-sex). Sabado/domingo contam como extra/reposicao.
export const META_SEMANAL_COLETAS = 175;

type Timestamp = string;

export interface UsersTable {
  id: Generated<string>;
  nome: string;
  email: string;
  senha_hash: string | null;
  role: Role;
  ativo: Generated<boolean>;
  criado_em: Generated<Timestamp>;
  tabs: string[] | null;
  pode_ver_faturamento: Generated<boolean>;
  setup_token: string | null;
  setup_token_expira: Timestamp | null;
  session_version: Generated<number>;
}

export interface SolicitacoesAcessoTable {
  id: Generated<string>;
  email: string;
  criado_em: Generated<Timestamp>;
}

export interface RateLimitsTable {
  chave: string;
  tentativas: Generated<number>;
  janela_inicio: Generated<Timestamp>;
}

export interface ContainersTable {
  numero: string;
  armador: Armador;
  padrao: Padrao;
  status: Generated<StatusContainer>;
  entrada: Timestamp | null;
  tipo: string | null;
  valor_estimado: string | null;
  criado_em: Generated<Timestamp>;
  atualizado_em: Generated<Timestamp>;
}

export interface ReparosTable {
  id: Generated<string>;
  data: Generated<Timestamp>;
  container_numero: string;
  valor_faturado: string | null;
  faturado_por: string | null;
  faturado_em: Timestamp | null;
  dm: Dm | null;
  por_conta_depot: Generated<boolean>;
  status_anterior: StatusContainer | null;
}

export interface OcorrenciasTable {
  id: Generated<string>;
  data: Timestamp;
  motivo: string;
  criado_por_id: string | null;
}

export interface ProgramacoesTable {
  id: Generated<string>;
  data_retirada: string;
  solicitante: string;
  destino: SolicitanteTipo;
  armador: Armador;
  booking: string | null;
  cm_codigo: string | null;
  quantidade: number;
  tipo_carga: Generated<TipoCarga>;
  cliente: string | null;
  criado_por_id: string | null;
  criado_em: Generated<Timestamp>;
}

export interface ColetasTable {
  id: Generated<string>;
  data: Timestamp | null;
  container_numero: string | null;
  codigo_cm_veiculo: string | null;
  programacao_id: string | null;
  status: Generated<ColetaStatus>;
  tipo_carga: TipoCarga | null;
  cliente: string | null;
  criado_por_id: string | null;
}

export interface Database {
  users: UsersTable;
  containers: ContainersTable;
  reparos: ReparosTable;
  ocorrencias: OcorrenciasTable;
  programacoes: ProgramacoesTable;
  coletas: ColetasTable;
  solicitacoes_acesso: SolicitacoesAcessoTable;
  rate_limits: RateLimitsTable;
}
