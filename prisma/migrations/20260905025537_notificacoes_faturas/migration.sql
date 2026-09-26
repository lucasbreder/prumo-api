-- CreateEnum
CREATE TYPE "StatusFatura" AS ENUM ('PAGA', 'ABERTA');

-- AlterTable
ALTER TABLE "User" ADD COLUMN     "notifComunidade" BOOLEAN NOT NULL DEFAULT true,
ADD COLUMN     "notifLives" BOOLEAN NOT NULL DEFAULT true,
ADD COLUMN     "notifResumo" BOOLEAN NOT NULL DEFAULT false;

-- CreateTable
CREATE TABLE "Fatura" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "valorCentavos" INTEGER NOT NULL,
    "descricao" TEXT NOT NULL,
    "ciclo" "Ciclo" NOT NULL,
    "status" "StatusFatura" NOT NULL DEFAULT 'PAGA',
    "emitidaEm" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "Fatura_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "Fatura_userId_emitidaEm_idx" ON "Fatura"("userId", "emitidaEm");

-- AddForeignKey
ALTER TABLE "Fatura" ADD CONSTRAINT "Fatura_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;
