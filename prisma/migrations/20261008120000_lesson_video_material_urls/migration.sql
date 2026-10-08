-- AlterTable
ALTER TABLE "Lesson" ADD COLUMN     "videoUrl" TEXT,
ADD COLUMN     "materialUrl" TEXT;

-- Backfill a partir do conteudo ativo, conforme o tipo da aula.
UPDATE "Lesson" SET "videoUrl" = "contentUrl" WHERE "type" = 'VIDEO' AND "contentUrl" IS NOT NULL;
UPDATE "Lesson" SET "materialUrl" = "contentUrl" WHERE "type" = 'MATERIAL' AND "contentUrl" IS NOT NULL;
