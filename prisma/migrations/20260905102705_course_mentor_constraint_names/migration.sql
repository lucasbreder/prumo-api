-- RenameConstraintNames
ALTER TABLE "CourseMentor" RENAME CONSTRAINT "CourseMentor_course_id_fkey" TO "CourseMentor_courseId_fkey";
ALTER TABLE "CourseMentor" RENAME CONSTRAINT "CourseMentor_mentor_id_fkey" TO "CourseMentor_mentorId_fkey";
ALTER INDEX "CourseMentor_mentor_id_idx" RENAME TO "CourseMentor_mentorId_idx";
