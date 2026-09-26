-- FinishRenamedColumns (missed in previous migration)
ALTER TABLE "CourseMentor" RENAME COLUMN "course_id" TO "courseId";
ALTER TABLE "CourseMentor" RENAME COLUMN "mentor_id" TO "mentorId";
ALTER TABLE "Enrollment" RENAME COLUMN "progressoPercent" TO "progressPercent";
ALTER TABLE "Live" RENAME COLUMN "duracaoMin" TO "durationMin";
ALTER TABLE "Plan" RENAME COLUMN "ativo" TO "active";
ALTER TABLE "Report" RENAME COLUMN "decisao" TO "decision";
