-- CreateEnum
CREATE TYPE "StatusLive" AS ENUM ('AGENDADA', 'AO_VIVO', 'ENCERRADA');

-- CreateEnum
CREATE TYPE "TipoLive" AS ENUM ('LIVE', 'MENTORIA');

-- CreateTable
CREATE TABLE "Live" (
    "id" TEXT NOT NULL,
    "titulo" TEXT NOT NULL,
    "descricao" TEXT NOT NULL,
    "tipo" "TipoLive" NOT NULL DEFAULT 'LIVE',
    "dataInicio" TIMESTAMP(3) NOT NULL,
    "duracaoMin" INTEGER NOT NULL DEFAULT 60,
    "urlSala" TEXT,
    "urlGravacao" TEXT,
    "status" "StatusLive" NOT NULL DEFAULT 'AGENDADA',
    "mentorNome" TEXT,
    "criadaEm" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "atualizadaEm" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Live_pkey" PRIMARY KEY ("id")
);
