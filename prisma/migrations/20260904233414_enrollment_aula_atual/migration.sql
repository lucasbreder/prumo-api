-- AddForeignKey
ALTER TABLE "Enrollment" ADD CONSTRAINT "Enrollment_aulaAtualId_fkey" FOREIGN KEY ("aulaAtualId") REFERENCES "Lesson"("id") ON DELETE SET NULL ON UPDATE CASCADE;
