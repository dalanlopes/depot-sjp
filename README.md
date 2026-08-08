# Depot SJP — Gestão de Containers

Sistema de gestão de estoque e reparos de containers (Estoque / Oficina / Ocorrências /
Programação / Coletas / Importação / Dashboard), com controle de acesso por perfil.

## Produção

- URL: https://depot-sjp.vercel.app
- Hospedagem: Vercel (projeto "depot-sjp", time Dalan)
- Banco: Supabase Postgres (projeto "depot-sjp", região sa-east-1)

### Usuários iniciais (troque as senhas assim que possível)

| Usuário       | Senha        | Perfil                          |
|---------------|--------------|----------------------------------|
| gestor        | gestor123    | Gestor (acesso total)            |
| mecanico      | mecanico123  | Mecânico (Oficina, Ocorrências)  |
| programacao   | prog123      | Analista de Programação/Estoque  |
| faturamento   | fatur123     | Analista de Faturamento (Oficina)|

## Stack

- Next.js 16 (App Router) + TypeScript + Tailwind CSS v4
- PostgreSQL via Kysely + `pg` (sem ORM com binário nativo — funciona bem em serverless)
- Autenticação por sessão JWT (cookie httpOnly) com `jose` + `bcryptjs`
- Gráficos com Recharts
- Upload de planilhas com `xlsx` (SheetJS)

> Observação técnica: o schema foi inicialmente desenhado em Prisma, mas o ambiente de
> build usado para gerar este projeto bloqueia o download dos binários do Prisma Engine.
> Por isso a camada de dados usa Kysely (type-safe, sem binários nativos). O SQL completo
> está em `db/schema.sql`. A conexão de produção usa o Supavisor (pooler transaction mode,
> porta 6543) porque a Vercel só aceita saída IPv4, e a conexão direta do Supabase é IPv6.

## Perfis e permissões

| Perfil | Abas | Financeiro |
|---|---|---|
| Mecânico | Oficina, Ocorrências | Não vê nem edita |
| Analista de Programação | Programação, Estoque | Não vê |
| Analista de Faturamento | Oficina | Vê e edita |
| Gestor | Todas | Vê e edita |

## Rodando localmente

```bash
npm install
cp .env.example .env   # preencha DATABASE_URL, SESSION_SECRET, NEXT_PUBLIC_POWERBI_URL
npm run db:migrate     # cria as tabelas (db/schema.sql)
npm run db:seed        # cria um usuário de cada perfil (veja senhas no output)
npm run dev
```

## Segurança — pendências recomendadas

1. **Trocar as senhas padrão** dos 4 usuários de seed assim que possível.
2. **Row Level Security (RLS)**: as tabelas foram criadas sem RLS (o app não usa a API
   REST/anon key do Supabase, só a conexão Postgres direta com uma role própria de
   privilégio limitado — `app_depot_sjp` —, então o risco de exposição via anon key não
   se aplica aqui). Ainda assim, se no futuro alguém conectar via API REST/client do
   Supabase, habilite RLS antes:
   ```sql
   ALTER TABLE public.users ENABLE ROW LEVEL SECURITY;
   ALTER TABLE public.containers ENABLE ROW LEVEL SECURITY;
   ALTER TABLE public.reparos ENABLE ROW LEVEL SECURITY;
   ALTER TABLE public.ocorrencias ENABLE ROW LEVEL SECURITY;
   ALTER TABLE public.programacoes ENABLE ROW LEVEL SECURITY;
   ALTER TABLE public.coletas ENABLE ROW LEVEL SECURITY;
   ```
3. **Variáveis de ambiente**: por limitação da ferramenta de deploy usada, as credenciais
   de produção (`DATABASE_URL`, `SESSION_SECRET`) foram embutidas em um arquivo
   `.env.production` dentro do próprio deploy, em vez de configuradas via painel da
   Vercel (Settings → Environment Variables). Isso funciona, mas o ideal é migrar essas
   variáveis para o painel da Vercel e remover o arquivo do projeto.

## Estrutura de dados

Ver `db/schema.sql` — tabelas `containers` (mestre), `reparos`, `ocorrencias`,
`programacoes`, `coletas`, `users`, todas relacionadas por chave estrangeira ao número
do container. A aba Estoque exclui containers já presentes em `coletas` (saída
processada), sem precisar de um status adicional além dos 5 definidos (WS/AR/AE/RE/OK).
