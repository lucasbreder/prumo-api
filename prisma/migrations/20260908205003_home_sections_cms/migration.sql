-- AlterTable
ALTER TABLE "HomeHighlight" ADD COLUMN     "adviceDescription" TEXT NOT NULL DEFAULT 'A cada mês, um mentor do Prumo acompanha os alunos de perto: revisa as ações aplicadas nos cursos, aponta o que ajustar e define as prioridades do próximo ciclo.',
ADD COLUMN     "adviceEyebrow" TEXT NOT NULL DEFAULT 'Conselho mensal',
ADD COLUMN     "adviceNote" TEXT NOT NULL DEFAULT 'Conselho inclusa nos planos Anual e Equipes.',
ADD COLUMN     "adviceTitle" TEXT NOT NULL DEFAULT 'Um mentor para acompanhar o seu estúdio todo mês',
ADD COLUMN     "coursesEyebrow" TEXT NOT NULL DEFAULT 'Cursos',
ADD COLUMN     "coursesLinkLabel" TEXT NOT NULL DEFAULT 'Ver todos os cursos',
ADD COLUMN     "coursesTitle" TEXT NOT NULL DEFAULT 'Domine a gestão, do projeto ao resultado.',
ADD COLUMN     "methodEyebrow" TEXT NOT NULL DEFAULT 'O Método',
ADD COLUMN     "newsletterDescription" TEXT NOT NULL DEFAULT 'Uma carta quinzenal com números, casos e ferramentas para tornar o seu estúdio mais rentável. Sem spam.',
ADD COLUMN     "newsletterEyebrow" TEXT NOT NULL DEFAULT 'Newsletter',
ADD COLUMN     "newsletterTitle" TEXT NOT NULL DEFAULT 'Receba insights de gestão para arquitetos e decoradores.',
ADD COLUMN     "plansDescription" TEXT NOT NULL DEFAULT 'Assine e desbloqueie o catálogo completo. Cancele quando quiser, sem multas e sem burocracia.',
ADD COLUMN     "plansEyebrow" TEXT NOT NULL DEFAULT 'Planos',
ADD COLUMN     "plansTitle" TEXT NOT NULL DEFAULT 'Um só acesso para todos os cursos.',
ADD COLUMN     "prumoEyebrow" TEXT NOT NULL DEFAULT 'O Prumo',
ADD COLUMN     "prumoLead" TEXT NOT NULL DEFAULT 'Na construção, o prumo é a ferramenta que garante que tudo esteja alinhado. Na profissão, é a gestão que sustenta cada projeto.',
ADD COLUMN     "testimonialsEyebrow" TEXT NOT NULL DEFAULT 'Depoimentos',
ADD COLUMN     "testimonialsTitle" TEXT NOT NULL DEFAULT 'Quem já construiu com o Prumo.';

-- CreateTable
CREATE TABLE "HomeManifestoItem" (
    "id" TEXT NOT NULL,
    "highlightId" TEXT NOT NULL,
    "order" INTEGER NOT NULL,
    "number" TEXT NOT NULL,
    "text" TEXT NOT NULL,

    CONSTRAINT "HomeManifestoItem_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "HomeAdviceItem" (
    "id" TEXT NOT NULL,
    "highlightId" TEXT NOT NULL,
    "order" INTEGER NOT NULL,
    "number" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "description" TEXT NOT NULL,

    CONSTRAINT "HomeAdviceItem_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "HomeManifestoItem_highlightId_order_key" ON "HomeManifestoItem"("highlightId", "order");

-- CreateIndex
CREATE UNIQUE INDEX "HomeAdviceItem_highlightId_order_key" ON "HomeAdviceItem"("highlightId", "order");

-- AddForeignKey
ALTER TABLE "HomeManifestoItem" ADD CONSTRAINT "HomeManifestoItem_highlightId_fkey" FOREIGN KEY ("highlightId") REFERENCES "HomeHighlight"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "HomeAdviceItem" ADD CONSTRAINT "HomeAdviceItem_highlightId_fkey" FOREIGN KEY ("highlightId") REFERENCES "HomeHighlight"("id") ON DELETE CASCADE ON UPDATE CASCADE;
