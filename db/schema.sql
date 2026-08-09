-- Depot SJP - Schema relacional (PostgreSQL)
-- Fonte única de verdade para containers, reparos, ocorrências, programação e coletas.

CREATE TYPE role AS ENUM ('MECANICO', 'ANALISTA_PROGRAMACAO', 'ANALISTA_FATURAMENTO', 'GESTOR');
CREATE TYPE armador AS ENUM ('MAERSK', 'MSC', 'HAPAG', 'ZIM', 'LOGIN');
CREATE TYPE padrao AS ENUM ('AL', 'CG', 'OU'); -- OU = Aguardando Vistoria (ainda não classificado)
CREATE TYPE status_container AS ENUM ('WS', 'AR', 'AE', 'RE', 'OK');
CREATE TYPE solicitante_tipo AS ENUM ('MATRIZ', 'SJP', 'PG');
CREATE TYPE tipo_carga_enum AS ENUM ('CHEIO', 'VAZIO');
CREATE TYPE coleta_status AS ENUM ('PENDENTE', 'CONCLUIDO');
CREATE TYPE dm_opcao AS ENUM ('DM1', 'DM2', 'DM3', 'DM4');

CREATE TABLE users (
  id                   TEXT PRIMARY KEY DEFAULT gen_random_uuid()::text,
  nome                 TEXT NOT NULL,
  email                TEXT NOT NULL UNIQUE,
  senha_hash           TEXT, -- nulo até o usuário criar a senha no primeiro acesso
  role                 role NOT NULL,
  ativo                BOOLEAN NOT NULL DEFAULT true,
  criado_em            TIMESTAMPTZ NOT NULL DEFAULT now(),
  tabs                 TEXT[], -- abas liberadas para esse usuário; nulo = usa o padrão do perfil
  pode_ver_faturamento BOOLEAN NOT NULL DEFAULT false, -- permissão extra para ver faturamento da Oficina
  setup_token          TEXT, -- código de uso único p/ 1º acesso ou pós-reset; nulo depois de usado
  setup_token_expira   TIMESTAMPTZ, -- validade do setup_token (7 dias)
  session_version      INTEGER NOT NULL DEFAULT 1 -- incrementado ao desativar/resetar; derruba sessões (JWT) já emitidas
);

-- E-mails que tentaram logar sem estar cadastrados: ficam aqui até o admin autorizar ou recusar.
CREATE TABLE solicitacoes_acesso (
  id        TEXT PRIMARY KEY DEFAULT gen_random_uuid()::text,
  email     TEXT NOT NULL UNIQUE,
  criado_em TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Tabela mestre: fonte única de verdade para o status de cada container
CREATE TABLE containers (
  numero        TEXT PRIMARY KEY,
  armador       armador NOT NULL,
  padrao        padrao NOT NULL,
  status        status_container NOT NULL DEFAULT 'WS',
  entrada       TIMESTAMPTZ,
  criado_em     TIMESTAMPTZ NOT NULL DEFAULT now(),
  atualizado_em TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX idx_containers_status ON containers(status);
CREATE INDEX idx_containers_armador ON containers(armador);
CREATE INDEX idx_containers_padrao ON containers(padrao);

CREATE TABLE reparos (
  id               TEXT PRIMARY KEY DEFAULT gen_random_uuid()::text,
  data             TIMESTAMPTZ NOT NULL DEFAULT now(),
  container_numero TEXT NOT NULL REFERENCES containers(numero) ON DELETE CASCADE,
  valor_faturado   NUMERIC(10,2),
  faturado_por     TEXT REFERENCES users(id),
  faturado_em      TIMESTAMPTZ,
  dm               dm_opcao, -- DM1..DM4: time/posto que fez o reparo
  por_conta_depot  BOOLEAN NOT NULL DEFAULT false, -- reparo feito mas nao cobrado do armador
  status_anterior  status_container -- status do container antes do reparo; usado para restaurar ao excluir
);

CREATE INDEX idx_reparos_data ON reparos(data);
CREATE INDEX idx_reparos_container ON reparos(container_numero);
CREATE INDEX idx_reparos_dm ON reparos(dm);

CREATE TABLE ocorrencias (
  id             TEXT PRIMARY KEY DEFAULT gen_random_uuid()::text,
  data           TIMESTAMPTZ NOT NULL DEFAULT now(),
  motivo         TEXT NOT NULL,
  criado_por_id  TEXT REFERENCES users(id)
);

CREATE INDEX idx_ocorrencias_data ON ocorrencias(data);

-- Contador simples de tentativas (login, check-email, set-password) por
-- chave (ip/e-mail) para limitar força bruta e varredura de e-mails.
CREATE TABLE rate_limits (
  chave         TEXT PRIMARY KEY,
  tentativas    INTEGER NOT NULL DEFAULT 1,
  janela_inicio TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Pedido de retirada: só a demanda (data, quem pediu, destino, armador,
-- quantidade). O container e o CM de cada unidade são preenchidos depois,
-- na aba Coletas, quando o veículo efetivamente retira. booking/cm_codigo/
-- tipo_carga ficam como colunas legadas (não usadas pela tela atual).
CREATE TABLE programacoes (
  id               TEXT PRIMARY KEY DEFAULT gen_random_uuid()::text,
  data_retirada    DATE NOT NULL,
  solicitante      TEXT NOT NULL DEFAULT '',
  destino          solicitante_tipo NOT NULL DEFAULT 'SJP',
  armador          armador NOT NULL,
  booking          TEXT,
  cm_codigo        TEXT,
  quantidade       INTEGER NOT NULL CHECK (quantidade > 0),
  tipo_carga       tipo_carga_enum NOT NULL DEFAULT 'VAZIO',
  cliente          TEXT,
  criado_por_id    TEXT REFERENCES users(id),
  criado_em        TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX idx_programacoes_data ON programacoes(data_retirada);

-- Uma coleta pode nascer "pendente" a partir de uma Programação (sem container
-- nem CM ainda) e ser concluída depois, quando o analista informa o container
-- retirado do estoque e o código do CM do veículo. Também pode ser registrada
-- avulsa (sem programacao_id), já concluída.
CREATE TABLE coletas (
  id                TEXT PRIMARY KEY DEFAULT gen_random_uuid()::text,
  data              TIMESTAMPTZ DEFAULT now(),
  container_numero  TEXT UNIQUE REFERENCES containers(numero),
  codigo_cm_veiculo TEXT, -- nulo até a coleta ser confirmada
  programacao_id    TEXT REFERENCES programacoes(id),
  status            coleta_status NOT NULL DEFAULT 'CONCLUIDO',
  tipo_carga        tipo_carga_enum,
  cliente           TEXT,
  criado_por_id     TEXT REFERENCES users(id)
);

CREATE INDEX idx_coletas_data ON coletas(data);
CREATE INDEX idx_coletas_programacao ON coletas(programacao_id);
