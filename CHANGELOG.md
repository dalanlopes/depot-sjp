# Changelog — Depot SJP

Registro das principais entregas do sistema, por versão. A versão exibida na
tela de login vem do campo `version` do `package.json` (veja `src/lib/version.ts`).
Ao lançar uma mudança relevante, atualize o `version` no `package.json` e
adicione uma entrada aqui.

## 1.5.0 — 2026-08-12/14

- Oficina: bloqueio de reparo duplicado (container com status OK não pode
  ser registrado de novo até uma nova entrada), garantindo que o indicador
  de reparos não seja inflado por engano.
- Oficina: faturamento mensal e contagem de reparos no mês (card visível
  também para o Mecânico), além do faturamento do dia ao clicar numa barra
  do gráfico (troca de nome/valor no mesmo card, sem indicador zerado
  durante o carregamento).
- Oficina: nível de reparo por DM com detalhamento por unidade — valor de
  cada reparo, unidades por conta do Depot, por armador e por upgrade,
  sempre ordenadas por armador e depois por container.
- Coletas: correção de fuso horário — coletas feitas após 23h ficam no dia
  correto (não mais empurradas para o dia seguinte); meta semanal passou a
  ser calculada de domingo a sábado, reiniciando toda semana.
- Relatórios: campo Container pesquisável em todos os tipos de relatório.
- Ajustes visuais: colunas fixas para Depot, Upgrade e Ações (Excluir) no
  histórico da Oficina, e diversos textos de apoio removidos das telas de
  Estoque, Importação, Coletas, Relatórios e Usuários para deixá-las mais
  limpas.

## 1.4.0 — 2026-08-11/12

- Oficina: campo "Upgrade" ao registrar reparo; registro passou a ser direto
  (sem lista de pendências para salvar em lote).
- Relatórios: popout "containers liberados" ao clicar numa linha de
  Programação, com exportação em Excel.
- Segurança: Row Level Security (RLS) habilitado em todas as tabelas do
  banco de produção e teste (fecha o acesso público via API automática do
  Supabase, sem afetar o funcionamento do sistema).
- Banco de dados de teste isolado (espelho de produção) + scripts
  `iniciar-preview.bat` / `iniciar-preview-teste.bat` para rodar o sistema
  localmente apontando para produção ou teste, sem precisar mexer em nada
  manualmente.
- Versionamento: número da versão passou a vir do `package.json` (exibido
  dinamicamente na tela de login) em vez de um texto fixo escrito à mão, com
  este `CHANGELOG.md` para registrar o que muda a cada versão.
- Logout automático de todo mundo a cada atualização: toda vez que um novo
  deploy sobe ao ar (novo commit publicado), qualquer sessão já aberta é
  invalidada automaticamente — o usuário só volta a usar o sistema depois de
  logar de novo, garantindo que todo mundo veja a versão atualizada.

## 1.3.0 — 2026-08-11

- Relatórios de Entradas e de Saídas (CM + Externa) no Relatórios central.
- Correção de um bug sistêmico de fuso horário (datas de planilha estavam
  sendo ancoradas em UTC e podiam aparecer com o dia trocado nos relatórios).
- Importação reestruturada em duas abas (Entrada / Saída), cada uma com
  upload de planilha e inserção manual, e aviso quando uma planilha já
  importada é enviada de novo.
- Coletas: relatórios "Relatório de Saídas" e "Saídas Externas" passaram a
  carregar só ao clicar em Pesquisar, com período padrão do mesmo dia.

## 1.2.0 — 2026-08-10

- Saídas Externas: importação da planilha do terminal, relatório dedicado e
  aba própria em Coletas.
- Relatórios central: processo "Saídas Externas".
- Atualização do cálculo de estoque disponível considerando as saídas
  externas.

## 1.1.0 — 2026-08-09/10

- Relatórios central (Estoque, Oficina, Ocorrências, Programação, Coletas)
  com filtros e exportação em Excel.
- Ajustes de padrão/status do Estoque, permissões refinadas por perfil
  (inclui perfil Visualizador), alinhamento da tela de Usuários.
- Informativo de primeiro acesso (HTML/PDF) para os quatro perfis.
- Layout responsivo para celular em todas as telas.

## 1.0.0 — 2026-08-08/09

- Base do sistema: Login por e-mail, Estoque, Oficina (reparos + meta
  diária), Ocorrências, Programação, Coletas, Usuários e permissões por
  perfil.
- Auditoria de segurança completa: autenticação/sessão, autorização em
  todas as rotas de API, validação de entrada, rate limiting, revogação de
  sessão, cabeçalhos de segurança.
