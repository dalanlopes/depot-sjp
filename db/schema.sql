-- Depot SJP - Schema relacional (PostgreSQL)
-- Fonte única de verdade para containers, reparos, ocorrências, programação e coletas.

CREATE TYPE role AS ENUM ('MECANICO', 'ANALISTA_PROGRAMACAO', 'ANALISTA_FATURAMENTO', 'GESTOR');
CREATE TYPE armador AS ENUM ('MAERSK', 'MSC', 'HAPAG', 'ZIM', 'LOGIN');
CREATE TYPE padrao AS ENUM ('AL', 'CG', 'OU'); -- OU = Aguardando Vistoria (ainda não classificado)
CREATE TYPE status_container AS ENUM ('WS', 'AR', 'AE', 'RE', 'OK');

CREATE TABLE users (
  id            TEXT PRIMARY KEY DEFAULT gen_random_uuid()::text,
  nome          TEXT NOT NULL,
  email         TEXT NOT NULL UNIQUE,
  senha_hash    TEXT NOT NULL,
  role          role NOT NULL,
  ativo         BOOLEAN NOT NULL DEFAULT true,
  criado_em     TIMESTAMPTZ NOT NULL DEFAULT now()
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
  faturado_em      TIMESTAMPTZ
);

CREATE INDEX idx_reparos_data ON reparos(data);
CREATE INDEX idx_reparos_container ON reparos(container_numero);

CREATE TABLE ocorrencias (
  id             TEXT PRIMARY KEY DEFAULT gen_random_uuid()::text,
  data           TIMESTAMPTZ NOT NULL DEFAULT now(),
  motivo         TEXT NOT NULL,
  criado_por_id  TEXT REFERENCES users(id)
);

CREATE INDEX idx_ocorrencias_data ON ocorrencias(data);

CREATE TABLE programacoes (
  id               TEXT PRIMARY KEY DEFAULT gen_random_uuid()::text,
  data_retirada    DATE NOT NULL,
  solicitante      TEXT NOT NULL,
  armador          armador NOT NULL,
  quantidade       INTEGER NOT NULL CHECK (quantidade > 0),
  criado_por_id    TEXT REFERENCES users(id),
  criado_em        TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX idx_programacoes_data ON programacoes(data_retirada);

CREATE TABLE coletas (
  id                TEXT PRIMARY KEY DEFAULT gen_random_uuid()::text,
  data              TIMESTAMPTZ NOT NULL DEFAULT now(),
  container_numero  TEXT NOT NULL UNIQUE REFERENCES containers(numero),
  codigo_cm_veiculo TEXT NOT NULL,
  criado_por_id     TEXT REFERENCES users(id)
);

CREATE INDEX idx_coletas_data ON coletas(data);
