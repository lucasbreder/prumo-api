-- CreateTable: structured home highlights (replaces PageContent JSON)
CREATE TABLE "HomeHighlight" (
    "id" TEXT NOT NULL,
    "heroHeadline" TEXT NOT NULL,
    "heroHighlightWord" TEXT,
    "mentorName" TEXT NOT NULL,
    "mentorArea" TEXT NOT NULL,
    "mentorSlots" INTEGER NOT NULL DEFAULT 0,
    "ctaTitle" TEXT NOT NULL,
    "ctaUrl" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "HomeHighlight_pkey" PRIMARY KEY ("id")
);
CREATE TABLE "HomeHighlightStat" (
    "id" TEXT NOT NULL,
    "highlightId" TEXT NOT NULL,
    "order" INTEGER NOT NULL,
    "value" TEXT NOT NULL,
    "label" TEXT NOT NULL,

    CONSTRAINT "HomeHighlightStat_pkey" PRIMARY KEY ("id")
);
CREATE TABLE "CommunityRule" (
    "id" TEXT NOT NULL,
    "order" INTEGER NOT NULL,
    "text" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "CommunityRule_pkey" PRIMARY KEY ("id")
);
CREATE UNIQUE INDEX "HomeHighlightStat_highlightId_order_key" ON "HomeHighlightStat"("highlightId", "order");
CREATE UNIQUE INDEX "CommunityRule_order_key" ON "CommunityRule"("order");
ALTER TABLE "HomeHighlightStat" ADD CONSTRAINT "HomeHighlightStat_highlightId_fkey" FOREIGN KEY ("highlightId") REFERENCES "HomeHighlight"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "SiteMenu" ADD COLUMN "column" TEXT;
-- CopyHomeHighlightsFromJson
INSERT INTO "HomeHighlight" ("id","heroHeadline","heroHighlightWord","mentorName","mentorArea","mentorSlots","ctaTitle","ctaUrl","createdAt","updatedAt")
SELECT 'highlight-home-1',
  COALESCE(pc."secoesJson"#>>'{hero,headline}', 'Toda grande obra começa com uma gestão bem traçada.'),
  NULLIF(pc."secoesJson"#>>'{hero,destaquePalavra}', ''),
  COALESCE(pc."secoesJson"#>>'{mentor,nome}', ''),
  COALESCE(pc."secoesJson"#>>'{mentor,area}', ''),
  COALESCE((pc."secoesJson"#>>'{mentor,vagas}')::INT, 0),
  COALESCE(pc."secoesJson"#>>'{cta,titulo}', 'Pronto para traçar sua obra?'),
  COALESCE(pc."secoesJson"#>>'{cta,url}', '/plans'),
  now(), now()
FROM "PageContent" pc WHERE pc."slug" = 'home' LIMIT 1;
INSERT INTO "HomeHighlightStat" ("id","highlightId","order","value","label")
SELECT 'highlight-stat-' || t.ord, 'highlight-home-1', t.ord, t.value->>'valor', t.value->>'rotulo'
FROM "PageContent" pc,
  jsonb_array_elements(COALESCE(pc."secoesJson"#>'{hero,stats}', '[]'::jsonb)) WITH ORDINALITY AS t(value, ord)
WHERE pc."slug" = 'home';
-- CopyCommunityRulesFromJson
INSERT INTO "CommunityRule" ("id","order","text","createdAt","updatedAt")
SELECT 'community-rule-' || t.ord, t.ord, t.value, now(), now()
FROM "PageContent" pc,
  jsonb_array_elements_text(COALESCE(pc."secoesJson"->'texto', '[]'::jsonb)) WITH ORDINALITY AS t(value, ord)
WHERE pc."slug" = 'comunidade-regras';
DROP TABLE "PageContent";
DROP TYPE "StatusPagina";
-- RenameEnums
ALTER TYPE "Papel" RENAME TO "Role";
ALTER TYPE "Role" RENAME VALUE 'ALUNO' TO 'STUDENT';
ALTER TYPE "Ciclo" RENAME TO "BillingCycle";
ALTER TYPE "BillingCycle" RENAME VALUE 'MENSAL' TO 'MONTHLY';
ALTER TYPE "BillingCycle" RENAME VALUE 'ANUAL' TO 'YEARLY';
ALTER TYPE "BillingCycle" RENAME VALUE 'EQUIPES' TO 'TEAM';
ALTER TYPE "StatusAssinatura" RENAME TO "SubscriptionStatus";
ALTER TYPE "SubscriptionStatus" RENAME VALUE 'ATIVA' TO 'ACTIVE';
ALTER TYPE "SubscriptionStatus" RENAME VALUE 'CANCELADA' TO 'CANCELED';
ALTER TYPE "SubscriptionStatus" RENAME VALUE 'EXPIRADA' TO 'EXPIRED';
ALTER TYPE "StatusCurso" RENAME TO "CourseStatus";
ALTER TYPE "CourseStatus" RENAME VALUE 'PUBLICADO' TO 'PUBLISHED';
ALTER TYPE "CourseStatus" RENAME VALUE 'RASCUNHO' TO 'DRAFT';
ALTER TYPE "PapelCourseMentor" RENAME TO "CourseMentorRole";
ALTER TYPE "CourseMentorRole" RENAME VALUE 'AUTOR' TO 'AUTHOR';
ALTER TYPE "CourseMentorRole" RENAME VALUE 'COAUTOR' TO 'COAUTHOR';
ALTER TYPE "TipoAula" RENAME TO "LessonType";
ALTER TYPE "StatusConteudo" RENAME TO "ContentStatus";
ALTER TYPE "ContentStatus" RENAME VALUE 'RASCUNHO' TO 'DRAFT';
ALTER TYPE "ContentStatus" RENAME VALUE 'EM_REVISAO' TO 'IN_REVIEW';
ALTER TYPE "ContentStatus" RENAME VALUE 'PUBLICADO' TO 'PUBLISHED';
ALTER TYPE "TipoMaterial" RENAME TO "MaterialType";
ALTER TYPE "MaterialType" RENAME VALUE 'PLANILHA' TO 'SPREADSHEET';
ALTER TYPE "MaterialType" RENAME VALUE 'MODELO' TO 'TEMPLATE';
ALTER TYPE "MaterialType" RENAME VALUE 'APRESENTACAO' TO 'PRESENTATION';
ALTER TYPE "StatusThread" RENAME TO "ThreadStatus";
ALTER TYPE "ThreadStatus" RENAME VALUE 'PUBLICADO' TO 'PUBLISHED';
ALTER TYPE "ThreadStatus" RENAME VALUE 'PENDENTE' TO 'PENDING';
ALTER TYPE "ThreadStatus" RENAME VALUE 'OCULTO' TO 'HIDDEN';
ALTER TYPE "StatusDenuncia" RENAME TO "ReportStatus";
ALTER TYPE "ReportStatus" RENAME VALUE 'EM_ANALISE' TO 'IN_ANALYSIS';
ALTER TYPE "ReportStatus" RENAME VALUE 'RESOLVIDO' TO 'RESOLVED';
ALTER TYPE "DecisaoDenuncia" RENAME TO "ReportDecision";
ALTER TYPE "ReportDecision" RENAME VALUE 'REMOVER' TO 'REMOVE';
ALTER TYPE "ReportDecision" RENAME VALUE 'IGNORAR' TO 'IGNORE';
ALTER TYPE "ReportDecision" RENAME VALUE 'BANIR_AUTOR' TO 'BAN_AUTHOR';
ALTER TYPE "StatusDepoimento" RENAME TO "TestimonialStatus";
ALTER TYPE "TestimonialStatus" RENAME VALUE 'PENDENTE' TO 'PENDING';
ALTER TYPE "TestimonialStatus" RENAME VALUE 'APROVADO' TO 'APPROVED';
ALTER TYPE "LocalMenu" RENAME TO "MenuLocation";
ALTER TYPE "TipoMenuItem" RENAME TO "MenuItemType";
ALTER TYPE "MenuItemType" RENAME VALUE 'PAGINA' TO 'PAGE';
ALTER TYPE "StatusPerfilMentor" RENAME TO "MentorProfileStatus";
ALTER TYPE "MentorProfileStatus" RENAME VALUE 'PENDENTE' TO 'PENDING';
ALTER TYPE "MentorProfileStatus" RENAME VALUE 'APROVADO' TO 'APPROVED';
ALTER TYPE "MentorProfileStatus" RENAME VALUE 'REPROVADO' TO 'REJECTED';
ALTER TYPE "StatusLive" RENAME TO "LiveStatus";
ALTER TYPE "LiveStatus" RENAME VALUE 'AGENDADA' TO 'SCHEDULED';
ALTER TYPE "LiveStatus" RENAME VALUE 'AO_VIVO' TO 'LIVE';
ALTER TYPE "LiveStatus" RENAME VALUE 'ENCERRADA' TO 'ENDED';
ALTER TYPE "TipoLive" RENAME TO "LiveType";
ALTER TYPE "LiveType" RENAME VALUE 'MENTORIA' TO 'MENTORING';
ALTER TYPE "StatusFatura" RENAME TO "InvoiceStatus";
ALTER TYPE "InvoiceStatus" RENAME VALUE 'PAGA' TO 'PAID';
ALTER TYPE "InvoiceStatus" RENAME VALUE 'ABERTA' TO 'OPEN';
-- RenameTables/RenameColumns/RenameConstraints
ALTER TABLE "Assinatura" RENAME TO "Subscription";
ALTER TABLE "Subscription" RENAME COLUMN "planoId" TO "planId";
ALTER TABLE "Subscription" RENAME COLUMN "precoCentavos" TO "priceCents";
ALTER TABLE "Subscription" RENAME COLUMN "inicio" TO "startsAt";
ALTER TABLE "Subscription" RENAME COLUMN "fimPeriodoAtual" TO "currentPeriodEnd";
ALTER TABLE "Subscription" RENAME COLUMN "canceladaEm" TO "canceledAt";
ALTER TABLE "Subscription" RENAME COLUMN "criadaEm" TO "createdAt";
ALTER TABLE "Subscription" RENAME COLUMN "atualizadaEm" TO "updatedAt";
ALTER TABLE "Subscription" RENAME CONSTRAINT "Assinatura_pkey" TO "Subscription_pkey";
ALTER INDEX IF EXISTS "Assinatura_userId_key" RENAME TO "Subscription_userId_key";
ALTER INDEX IF EXISTS "Assinatura_planoId_idx" RENAME TO "Subscription_planId_idx";
ALTER INDEX IF EXISTS "Assinatura_status_idx" RENAME TO "Subscription_status_idx";
ALTER TABLE "Subscription" RENAME CONSTRAINT "Assinatura_planoId_fkey" TO "Subscription_planId_fkey";
ALTER TABLE "Subscription" RENAME CONSTRAINT "Assinatura_userId_fkey" TO "Subscription_userId_fkey";
ALTER TABLE "Course" RENAME COLUMN "titulo" TO "title";
ALTER TABLE "Course" RENAME COLUMN "trilha" TO "track";
ALTER TABLE "Course" RENAME COLUMN "descricao" TO "description";
ALTER TABLE "Course" RENAME COLUMN "capaUrl" TO "coverUrl";
ALTER TABLE "Course" RENAME COLUMN "destaque" TO "featured";
ALTER TABLE "Course" RENAME COLUMN "ordem" TO "order";
ALTER TABLE "Course" RENAME COLUMN "criadaEm" TO "createdAt";
ALTER TABLE "Course" RENAME COLUMN "atualizadaEm" TO "updatedAt";
ALTER TABLE "CourseMentor" RENAME COLUMN "papel" TO "role";
ALTER TABLE "CourseMentor" RENAME COLUMN "criadoEm" TO "createdAt";
ALTER TABLE "Depoimento" RENAME TO "Testimonial";
ALTER TABLE "Testimonial" RENAME COLUMN "alunoId" TO "studentId";
ALTER TABLE "Testimonial" RENAME COLUMN "autor" TO "author";
ALTER TABLE "Testimonial" RENAME COLUMN "texto" TO "text";
ALTER TABLE "Testimonial" RENAME COLUMN "nota" TO "rating";
ALTER TABLE "Testimonial" RENAME COLUMN "visivel" TO "visible";
ALTER TABLE "Testimonial" RENAME COLUMN "criadaEm" TO "createdAt";
ALTER TABLE "Testimonial" RENAME COLUMN "atualizadaEm" TO "updatedAt";
ALTER TABLE "Testimonial" RENAME CONSTRAINT "Depoimento_pkey" TO "Testimonial_pkey";
ALTER INDEX IF EXISTS "Depoimento_status_visivel_idx" RENAME TO "Testimonial_status_visible_idx";
ALTER TABLE "Testimonial" RENAME CONSTRAINT "Depoimento_alunoId_fkey" TO "Testimonial_studentId_fkey";
ALTER TABLE "Enrollment" RENAME COLUMN "alunoId" TO "studentId";
ALTER TABLE "Enrollment" RENAME COLUMN "aulaAtualId" TO "currentLessonId";
ALTER TABLE "Enrollment" RENAME COLUMN "concluidoEm" TO "completedAt";
ALTER TABLE "Enrollment" RENAME COLUMN "criadaEm" TO "createdAt";
ALTER TABLE "Enrollment" RENAME COLUMN "atualizadaEm" TO "updatedAt";
ALTER INDEX IF EXISTS "Enrollment_alunoId_courseId_key" RENAME TO "Enrollment_studentId_courseId_key";
ALTER TABLE "Enrollment" RENAME CONSTRAINT "Enrollment_alunoId_fkey" TO "Enrollment_studentId_fkey";
ALTER TABLE "Enrollment" RENAME CONSTRAINT "Enrollment_aulaAtualId_fkey" TO "Enrollment_currentLessonId_fkey";
ALTER TABLE "Fatura" RENAME TO "Invoice";
ALTER TABLE "Invoice" RENAME COLUMN "valorCentavos" TO "amountCents";
ALTER TABLE "Invoice" RENAME COLUMN "descricao" TO "description";
ALTER TABLE "Invoice" RENAME COLUMN "ciclo" TO "cycle";
ALTER TABLE "Invoice" RENAME COLUMN "emitidaEm" TO "issuedAt";
ALTER TABLE "Invoice" RENAME CONSTRAINT "Fatura_pkey" TO "Invoice_pkey";
ALTER INDEX IF EXISTS "Fatura_userId_emitidaEm_idx" RENAME TO "Invoice_userId_issuedAt_idx";
ALTER TABLE "Invoice" RENAME CONSTRAINT "Fatura_userId_fkey" TO "Invoice_userId_fkey";
ALTER TABLE "Lesson" RENAME COLUMN "ordem" TO "order";
ALTER TABLE "Lesson" RENAME COLUMN "tipo" TO "type";
ALTER TABLE "Lesson" RENAME COLUMN "titulo" TO "title";
ALTER TABLE "Lesson" RENAME COLUMN "conteudoUrl" TO "contentUrl";
ALTER TABLE "Lesson" RENAME COLUMN "texto" TO "text";
ALTER TABLE "Lesson" RENAME COLUMN "duracaoSegundos" TO "durationSeconds";
ALTER TABLE "Lesson" RENAME COLUMN "enviadaRevisaoEm" TO "sentForReviewAt";
ALTER TABLE "Lesson" RENAME COLUMN "criadaEm" TO "createdAt";
ALTER TABLE "Lesson" RENAME COLUMN "atualizadaEm" TO "updatedAt";
ALTER TABLE "LessonProgress" RENAME COLUMN "alunoId" TO "studentId";
ALTER TABLE "LessonProgress" RENAME COLUMN "concluido" TO "completed";
ALTER TABLE "LessonProgress" RENAME COLUMN "concluidoEm" TO "completedAt";
ALTER INDEX IF EXISTS "LessonProgress_alunoId_lessonId_key" RENAME TO "LessonProgress_studentId_lessonId_key";
ALTER TABLE "LessonProgress" RENAME CONSTRAINT "LessonProgress_alunoId_fkey" TO "LessonProgress_studentId_fkey";
ALTER TABLE "Live" RENAME COLUMN "titulo" TO "title";
ALTER TABLE "Live" RENAME COLUMN "descricao" TO "description";
ALTER TABLE "Live" RENAME COLUMN "tipo" TO "type";
ALTER TABLE "Live" RENAME COLUMN "dataInicio" TO "startsAt";
ALTER TABLE "Live" RENAME COLUMN "urlSala" TO "roomUrl";
ALTER TABLE "Live" RENAME COLUMN "urlGravacao" TO "recordingUrl";
ALTER TABLE "Live" RENAME COLUMN "mentorNome" TO "mentorName";
ALTER TABLE "Live" RENAME COLUMN "criadaEm" TO "createdAt";
ALTER TABLE "Live" RENAME COLUMN "atualizadaEm" TO "updatedAt";
ALTER TABLE "Material" RENAME COLUMN "nome" TO "name";
ALTER TABLE "Material" RENAME COLUMN "tipo" TO "type";
ALTER TABLE "Material" RENAME COLUMN "tamanhoBytes" TO "sizeBytes";
ALTER TABLE "Material" RENAME COLUMN "cursoId" TO "courseId";
ALTER TABLE "Material" RENAME COLUMN "moduloId" TO "moduleId";
ALTER TABLE "Material" RENAME COLUMN "aulaId" TO "lessonId";
ALTER TABLE "Material" RENAME COLUMN "criadaEm" TO "createdAt";
ALTER INDEX IF EXISTS "Material_cursoId_idx" RENAME TO "Material_courseId_idx";
ALTER INDEX IF EXISTS "Material_tipo_idx" RENAME TO "Material_type_idx";
ALTER TABLE "Material" RENAME CONSTRAINT "Material_aulaId_fkey" TO "Material_lessonId_fkey";
ALTER TABLE "Material" RENAME CONSTRAINT "Material_cursoId_fkey" TO "Material_courseId_fkey";
ALTER TABLE "Material" RENAME CONSTRAINT "Material_moduloId_fkey" TO "Material_moduleId_fkey";
ALTER TABLE "Metodo" RENAME TO "Method";
ALTER TABLE "Method" RENAME COLUMN "titulo" TO "title";
ALTER TABLE "Method" RENAME COLUMN "descricao" TO "description";
ALTER TABLE "Method" RENAME COLUMN "publicado" TO "published";
ALTER TABLE "Method" RENAME CONSTRAINT "Metodo_pkey" TO "Method_pkey";
ALTER TABLE "MetodoPasso" RENAME TO "MethodStep";
ALTER TABLE "MethodStep" RENAME COLUMN "metodoId" TO "methodId";
ALTER TABLE "MethodStep" RENAME COLUMN "ordem" TO "order";
ALTER TABLE "MethodStep" RENAME COLUMN "titulo" TO "title";
ALTER TABLE "MethodStep" RENAME COLUMN "descricao" TO "description";
ALTER TABLE "MethodStep" RENAME CONSTRAINT "MetodoPasso_pkey" TO "MethodStep_pkey";
ALTER INDEX IF EXISTS "MetodoPasso_metodoId_ordem_key" RENAME TO "MethodStep_methodId_order_key";
ALTER TABLE "MethodStep" RENAME CONSTRAINT "MetodoPasso_metodoId_fkey" TO "MethodStep_methodId_fkey";
ALTER TABLE "Module" RENAME COLUMN "ordem" TO "order";
ALTER TABLE "Module" RENAME COLUMN "titulo" TO "title";
ALTER INDEX IF EXISTS "Module_courseId_ordem_key" RENAME TO "Module_courseId_order_key";
ALTER TABLE "Newsletter" RENAME COLUMN "criadaEm" TO "createdAt";
ALTER TABLE "PasswordResetToken" RENAME COLUMN "usadoEm" TO "usedAt";
ALTER TABLE "PasswordResetToken" RENAME COLUMN "criadaEm" TO "createdAt";
ALTER TABLE "Plano" RENAME TO "Plan";
ALTER TABLE "Plan" RENAME COLUMN "nome" TO "name";
ALTER TABLE "Plan" RENAME COLUMN "precoCentavos" TO "priceCents";
ALTER TABLE "Plan" RENAME COLUMN "ciclo" TO "cycle";
ALTER TABLE "Plan" RENAME COLUMN "beneficios" TO "benefits";
ALTER TABLE "Plan" RENAME COLUMN "destaque" TO "featured";
ALTER TABLE "Plan" RENAME COLUMN "ordem" TO "order";
ALTER TABLE "Plan" RENAME COLUMN "criadaEm" TO "createdAt";
ALTER TABLE "Plan" RENAME COLUMN "atualizadaEm" TO "updatedAt";
ALTER TABLE "Plan" RENAME CONSTRAINT "Plano_pkey" TO "Plan_pkey";
ALTER INDEX IF EXISTS "Plano_slug_key" RENAME TO "Plan_slug_key";
ALTER TABLE "Reacao" RENAME TO "Reaction";
ALTER TABLE "Reaction" RENAME COLUMN "usuarioId" TO "userId";
ALTER TABLE "Reaction" RENAME COLUMN "criadaEm" TO "createdAt";
ALTER TABLE "Reaction" RENAME CONSTRAINT "Reacao_pkey" TO "Reaction_pkey";
ALTER INDEX IF EXISTS "Reacao_threadId_usuarioId_key" RENAME TO "Reaction_threadId_userId_key";
ALTER TABLE "Reaction" RENAME CONSTRAINT "Reacao_threadId_fkey" TO "Reaction_threadId_fkey";
ALTER TABLE "Reaction" RENAME CONSTRAINT "Reacao_usuarioId_fkey" TO "Reaction_userId_fkey";
ALTER TABLE "RefreshToken" RENAME COLUMN "familiaId" TO "familyId";
ALTER TABLE "RefreshToken" RENAME COLUMN "criadaEm" TO "createdAt";
ALTER INDEX IF EXISTS "RefreshToken_familiaId_idx" RENAME TO "RefreshToken_familyId_idx";
ALTER TABLE "Report" RENAME COLUMN "reportanteId" TO "reporterId";
ALTER TABLE "Report" RENAME COLUMN "motivo" TO "reason";
ALTER TABLE "Report" RENAME COLUMN "resolvidaEm" TO "resolvedAt";
ALTER TABLE "Report" RENAME COLUMN "criadaEm" TO "createdAt";
ALTER TABLE "Report" RENAME CONSTRAINT "Report_reportanteId_fkey" TO "Report_reporterId_fkey";
ALTER TABLE "Resposta" RENAME TO "Reply";
ALTER TABLE "Reply" RENAME COLUMN "autorId" TO "authorId";
ALTER TABLE "Reply" RENAME COLUMN "conteudo" TO "content";
ALTER TABLE "Reply" RENAME COLUMN "criadaEm" TO "createdAt";
ALTER TABLE "Reply" RENAME CONSTRAINT "Resposta_pkey" TO "Reply_pkey";
ALTER INDEX IF EXISTS "Resposta_threadId_idx" RENAME TO "Reply_threadId_idx";
ALTER TABLE "Reply" RENAME CONSTRAINT "Resposta_autorId_fkey" TO "Reply_authorId_fkey";
ALTER TABLE "Reply" RENAME CONSTRAINT "Resposta_threadId_fkey" TO "Reply_threadId_fkey";
ALTER TABLE "SiteMenu" RENAME COLUMN "local" TO "location";
ALTER TABLE "SiteMenu" RENAME COLUMN "ordem" TO "order";
ALTER TABLE "SiteMenu" RENAME COLUMN "rotulo" TO "label";
ALTER TABLE "SiteMenu" RENAME COLUMN "tipo" TO "type";
ALTER TABLE "SiteMenu" RENAME COLUMN "ativo" TO "active";
ALTER INDEX IF EXISTS "SiteMenu_local_ordem_key" RENAME TO "SiteMenu_location_order_key";
ALTER INDEX IF EXISTS "SiteMenu_local_ativo_idx" RENAME TO "SiteMenu_location_active_idx";
ALTER TABLE "Thread" RENAME COLUMN "autorId" TO "authorId";
ALTER TABLE "Thread" RENAME COLUMN "categoria" TO "category";
ALTER TABLE "Thread" RENAME COLUMN "conteudo" TO "content";
ALTER TABLE "Thread" RENAME COLUMN "respostaCount" TO "replyCount";
ALTER TABLE "Thread" RENAME COLUMN "fixada" TO "pinned";
ALTER TABLE "Thread" RENAME COLUMN "criadaEm" TO "createdAt";
ALTER TABLE "Thread" RENAME COLUMN "atualizadaEm" TO "updatedAt";
ALTER INDEX IF EXISTS "Thread_categoria_idx" RENAME TO "Thread_category_idx";
ALTER INDEX IF EXISTS "Thread_status_criadaEm_idx" RENAME TO "Thread_status_createdAt_idx";
ALTER TABLE "Thread" RENAME CONSTRAINT "Thread_autorId_fkey" TO "Thread_authorId_fkey";
ALTER TABLE "User" RENAME COLUMN "nome" TO "name";
ALTER TABLE "User" RENAME COLUMN "senhaHash" TO "passwordHash";
ALTER TABLE "User" RENAME COLUMN "papel" TO "role";
ALTER TABLE "User" RENAME COLUMN "ativo" TO "active";
ALTER TABLE "User" RENAME COLUMN "mentorDestaque" TO "mentorFeatured";
ALTER TABLE "User" RENAME COLUMN "ultimoAcessoEm" TO "lastAccessAt";
ALTER TABLE "User" RENAME COLUMN "criadaEm" TO "createdAt";
ALTER TABLE "User" RENAME COLUMN "atualizadaEm" TO "updatedAt";
ALTER TABLE "User" RENAME COLUMN "notifComunidade" TO "notifCommunity";
ALTER TABLE "User" RENAME COLUMN "notifResumo" TO "notifSummary";
