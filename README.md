# Prumo — Backend (NestJS + Prisma)

API do Prumo (educação e gestão para arquitetos), seguindo `../agents.md`.
DDD por bounded context (domain/application/infrastructure/presentation), TDD,
Prisma como camada de dados, RBAC com guards em camadas e refresh token rotativo.

## Contextos (`src/modules/`)

| Contexto | Responsabilidade |
| --- | --- |
| `identity` | conta, login, refresh rotativo (cookie HttpOnly + detecção de reuso por família), reset de senha, RBAC de usuários |
| `billing` | planos, checkout (`POST /checkout`), minha-assinatura, webhook HMAC, gate de plano ativo (`ACCESS_GATE`) |
| `cursos` | catálogo público, matrícula, progresso por aula, certificados, downloads, materiais, currículo, escopo do mentor (`MENTOR_LINK`), ciclo Rascunho→Em revisão→Publicado, presign S3 |
| `community` | threads/respostas/reações, moderação por estado, denúncias com decisões (Remover/Ignorar/Banir autor), regras configuráveis |
| `site` | CMS: páginas/seções, destaques da home, menus, método+etapas, depoimentos (aprovação), perfis de mentor, newsletter |
| `dashboard` | KPIs (alunos ativos, MRR em centavos, matrículas 30d, churn 30d), gráficos, ranking de cursos, "precisa de atenção" |
| `lives` | Agenda de lives/mentorias: CRUD admin, transições AGENDADA→AO_VIVO→ENCERRADA; ao aluno a sala só aparece AO_VIVO e a gravação só após encerrar |

## Rodando

```bash
cp .env.example .env   # ajuste DATABASE_URL (Postgres) e segredos
npm install            # postinstall roda prisma generate
npx prisma migrate deploy
npx prisma db seed     # idempotente (planos, contas demo, cursos, CMS)
npm run start:dev      # http://localhost:3001
```

Contas do seed: `admin@prumo.dev`, `marina@prumo.dev` (mentor), `ana@exemplo.dev` (aluna c/ plano anual) — senha `prumo2026adm`.

## Testes

```bash
npm test               # unit/integração (vitest) — 105 testes
npm run test:e2e       # supertest contra o banco prumo_test — 30 testes
                       # (requer DATABASE_URL_TEST no .env; migrations são aplicadas no globalSetup)
npm run test:cov       # coverage
npx tsc --noEmit && npm run lint
```

Matriz coberta nos e2e: público sem login, 401 sem token, 403 sem papel, 403 sem plano ativo,
payload extra = 400, escopo de mentor, revisão pela equipe, webhook assinado, KPIs em centavos.

## Segurança (resumo)

- `JwtAuthGuard` global via `APP_GUARD` + `@Public()` explícito; `RolesGuard` (`@Roles('ADMIN'|'MENTOR'|'ALUNO')`); `PlanoAtivoGuard` para painéis pagos.
- Access JWT HS256 curto (15 min, `iss`/`aud` validados) + refresh de 30 dias com hash SHA-256 no banco, rotação com família e revogação total em reuso.
- Webhook de billing com HMAC-SHA256 (`x-prumo-timestamp`/`x-prumo-signature`) e comparação constant-time.
- `ValidationPipe` global `whitelist+forbidNonWhitelisted`, helmet, CORS com allowlist, throttler 60 req/min, erros padronizados (`422 REGRA_DE_NEGOCIO`, `404`, `409`, `401`) sem vazar stack.

## Convenções

- **Prisma 7** (arquitetura sem query engine Rust): conexão do client via driver adapter
  (`@prisma/adapter-pg` em `PrismaService`), URL do migrate definida em `prisma.config.ts`.
- Valores monetários **em centavos** (`precoCentavos`); datas ISO; UI pt-BR.
- Upgrade com **prorrateio**: dias restantes do ciclo vigente viram crédito na cobrança; toda cobrança/renovação gera `Fatura` (invoicing base — provedor fiscal plugável via `PAGAMENTO_PROVIDER`).
- Domain sem framework; use cases puros recebendo deps por objeto (fábricas no `*.module.ts` = composition root).
- Uploads via presigned URL S3-compatível (`POST /uploads/presign`, formatos: MP4/PDF/PPTX/XLSX/DOCX/CSV).

## API (principais rotas)

```
POST /auth/register|login|refresh|logout|forgot-password|reset-password
GET  /conta · PATCH /conta · POST /conta/senha
GET  /planos · POST /checkout · GET /minha-assinatura · POST /minha-assinatura/cancelar
POST /billing/webhook (HMAC) · GET /minhas-faturas · GET /admin/faturas · POST /admin/alunos/:id/plano
GET/PATCH /conta/notificacoes
GET  /cursos · GET /cursos/:idOuSlug · GET /cursos/trilhas
POST /matriculas · GET /meus-cursos · GET /meus-cursos/:id
POST /aulas/:id/concluir · GET /progresso · GET /concluidos · GET /downloads
GET  /mentor/cursos · GET /mentor/cursos/:id · POST /mentor/cursos/:id/modulos|aulas
PATCH /mentor/cursos/aulas/:id · POST /aulas/:id/revisao
CRUD /admin/cursos (+modulos/aulas/mentores) · /admin/cursos/aulas/:id/aprovar|reprovar
CRUD /admin/materiais · GET /admin/alunos · POST/PATCH /admin/alunos
GET/PATCH /admin/comunidade · /admin/comunidade/regras · /admin/denuncias[/:id/resolver] · /admin/comunidade/kpis
GET /site/paginas/:slug · /site/menus · /site/metodo · /site/mentores · /site/destaques · /depoimentos · POST /newsletter
CRUD /admin/site/* (paginas, destaques, menus, metodo, mentores) · /admin/depoimentos
GET /admin/dashboard · POST /uploads/presign
GET /lives (painel do aluno) · CRUD /admin/lives + POST /admin/lives/:id/iniciar|encerrar
```
# prumo-api
