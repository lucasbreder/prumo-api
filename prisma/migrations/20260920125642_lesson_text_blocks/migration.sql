-- AlterEnum
ALTER TYPE "LessonType" ADD VALUE 'TEXT';

-- AlterTable
ALTER TABLE "Lesson" ADD COLUMN     "blocks" JSONB;
