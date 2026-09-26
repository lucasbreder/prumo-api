import { Module } from '@nestjs/common';
import { BillingModule } from '../billing/billing.module.js';
import { ACCESS_GATE } from './domain/access-gate.js';
import type { AccessGate } from './domain/access-gate.js';
import { SystemClock } from '../../shared/infrastructure/system-clock.js';
import { NestEventPublisher } from '../../shared/infrastructure/event-publisher.js';
import {
  LESSON_READER,
  LESSON_WRITER,
  COURSE_READER,
  COURSE_WRITER,
  MATERIAL_READER,
  MATERIAL_WRITER,
  ENROLLMENT_READER,
  ENROLLMENT_WRITER,
  STUDENT_DIRECTORY,
  MENTOR_LINK_READER,
  MENTOR_LINK_WRITER,
  MODULE_READER,
  MODULE_WRITER,
  PROGRESS_READER,
  PROGRESS_WRITER,
  STORAGE_PRESIGNER,
} from './domain/repositories.js';
import type {
  LessonReader,
  LessonWriter,
  CourseReader,
  CourseWriter,
  MaterialReader,
  MaterialWriter,
  EnrollmentReader,
  EnrollmentWriter,
  StudentDirectory,
  MentorLinkReader,
  ModuleReader,
  ModuleWriter,
  ProgressReader,
  ProgressWriter,
  StoragePresigner,
} from './domain/repositories.js';
import { PrismaCourseRepository } from './infrastructure/persistence/prisma-course.repository.js';
import {
  PrismaLessonRepository,
  PrismaMaterialRepository,
  PrismaEnrollmentRepository,
  PrismaModuleRepository,
  PrismaProgressRepository,
  PrismaStudentDirectory,
} from './infrastructure/persistence/prisma-content.repository.js';
import { PrismaMentorLinkRepository } from './infrastructure/persistence/prisma-mentor-link.repository.js';
import { S3StoragePresigner } from './infrastructure/storage/s3-presigner.js';
import {
  ListPublicCoursesUseCase,
  ListTracksUseCase,
  GetCoursePublicUseCase,
} from './application/use-cases/public.usecases.js';
import {
  CompleteLessonUseCase,
  ListConcluidosUseCase,
  ListDownloadsUseCase,
  ListMeusCoursesUseCase,
  EnrollCourseUseCase,
  MeuProgressUseCase,
  GetMeuCourseUseCase,
} from './application/use-cases/student.usecases.js';
import {
  AddLessonComoMentorUseCase,
  AddModuleComoMentorUseCase,
  EditLessonAsMentorUseCase,
  SendLessonForReviewUseCase,
  ListCoursesDoMentorUseCase,
  ListMaterialsDoMentorUseCase,
  GetCurriculumDoMentorUseCase,
} from './application/use-cases/mentor.usecases.js';
import {
  ListCourseEnrollmentsAdminUseCase,
  ListAvailableStudentsAdminUseCase,
  EnrollStudentAdminUseCase,
  UnenrollStudentAdminUseCase,
} from './application/use-cases/admin-enrollments.usecases.js';
import {
  AddLessonUseCase,
  AddModuleUseCase,
  PresignUploadUseCase,
  ReviewLessonUseCase,
  SaveCourseUseCase,
  SaveMaterialUseCase,
} from './application/use-cases/team.usecases.js';
import {
  AreaStudentController,
  CoursesPublicController,
} from './presentation/courses.controller.js';
import {
  LessonReviewController,
  MentorController,
  MentorMaterialsController,
} from './presentation/mentor.controller.js';
import {
  AdminCoursesController,
  AdminMaterialsController,
} from './presentation/admin-courses.controller.js';
import { UploadsController } from './presentation/uploads.controller.js';
@Module({
  imports: [BillingModule],
  controllers: [
    CoursesPublicController,
    AreaStudentController,
    MentorController,
    MentorMaterialsController,
    LessonReviewController,
    AdminCoursesController,
    AdminMaterialsController,
    UploadsController,
  ],
  providers: [
    PrismaCourseRepository,
    PrismaLessonRepository,
    PrismaModuleRepository,
    PrismaEnrollmentRepository,
    PrismaProgressRepository,
    PrismaMaterialRepository,
    PrismaMentorLinkRepository,
    PrismaStudentDirectory,
    S3StoragePresigner,
    SystemClock,
    NestEventPublisher,
    { provide: COURSE_READER, useExisting: PrismaCourseRepository },
    { provide: COURSE_WRITER, useExisting: PrismaCourseRepository },
    { provide: LESSON_READER, useExisting: PrismaLessonRepository },
    { provide: LESSON_WRITER, useExisting: PrismaLessonRepository },
    { provide: MODULE_READER, useExisting: PrismaModuleRepository },
    { provide: MODULE_WRITER, useExisting: PrismaModuleRepository },
    { provide: ENROLLMENT_READER, useExisting: PrismaEnrollmentRepository },
    { provide: ENROLLMENT_WRITER, useExisting: PrismaEnrollmentRepository },
    { provide: PROGRESS_READER, useExisting: PrismaProgressRepository },
    { provide: PROGRESS_WRITER, useExisting: PrismaProgressRepository },
    { provide: MATERIAL_READER, useExisting: PrismaMaterialRepository },
    { provide: MATERIAL_WRITER, useExisting: PrismaMaterialRepository },
    { provide: MENTOR_LINK_READER, useExisting: PrismaMentorLinkRepository },
    { provide: MENTOR_LINK_WRITER, useExisting: PrismaMentorLinkRepository },
    { provide: STORAGE_PRESIGNER, useExisting: S3StoragePresigner },
    { provide: STUDENT_DIRECTORY, useExisting: PrismaStudentDirectory },
    ...[
      ListCourseEnrollmentsAdminUseCase,
      ListAvailableStudentsAdminUseCase,
      EnrollStudentAdminUseCase,
      UnenrollStudentAdminUseCase,
    ].map((cls) => ({
      provide: cls,
      inject: [COURSE_READER, ENROLLMENT_READER, ENROLLMENT_WRITER, STUDENT_DIRECTORY],
      useFactory: (
        courses: CourseReader,
        er: EnrollmentReader,
        _ew: EnrollmentWriter,
        students: StudentDirectory,
      ) =>
        new cls({
          courses,
          enrollments: er as EnrollmentReader & EnrollmentWriter,
          students,
        }),
    })),
    {
      provide: ListPublicCoursesUseCase,
      inject: [COURSE_READER],
      useFactory: (courses: CourseReader) =>
        new ListPublicCoursesUseCase({ courses }),
    },
    {
      provide: ListTracksUseCase,
      inject: [COURSE_READER],
      useFactory: (courses: CourseReader) => new ListTracksUseCase({ courses }),
    },
    {
      provide: GetCoursePublicUseCase,
      inject: [COURSE_READER],
      useFactory: (courses: CourseReader) =>
        new GetCoursePublicUseCase({ courses }),
    },
    ...[
      EnrollCourseUseCase,
      ListMeusCoursesUseCase,
      GetMeuCourseUseCase,
      CompleteLessonUseCase,
      MeuProgressUseCase,
      ListConcluidosUseCase,
      ListDownloadsUseCase,
    ].map((cls) => ({
      provide: cls,
      inject: [
        COURSE_READER,
        ENROLLMENT_READER,
        ENROLLMENT_WRITER,
        PROGRESS_READER,
        PROGRESS_WRITER,
        LESSON_READER,
        MATERIAL_READER,
        ACCESS_GATE,
        NestEventPublisher,
        SystemClock,
        STORAGE_PRESIGNER,
      ],
      useFactory: (
        courses: CourseReader,
        mr: EnrollmentReader,
        mw: EnrollmentWriter,
        pr: ProgressReader,
        pw: ProgressWriter,
        lessons: LessonReader,
        materials: MaterialReader,
        gate: AccessGate,
        events: NestEventPublisher,
        clock: SystemClock,
        presigner: StoragePresigner,
      ) =>
        new cls({
          courses,
          enrollments: mr as EnrollmentReader & EnrollmentWriter,
          progress: pr as ProgressReader & ProgressWriter,
          lessons,
          materials,
          gate,
          events,
          clock,
          presigner,
        }),
    })),
    ...[
      ListCoursesDoMentorUseCase,
      GetCurriculumDoMentorUseCase,
      AddModuleComoMentorUseCase,
      AddLessonComoMentorUseCase,
      EditLessonAsMentorUseCase,
      SendLessonForReviewUseCase,
    ].map((cls) => ({
      provide: cls,
      inject: [
        MENTOR_LINK_READER,
        COURSE_READER,
        LESSON_READER,
        LESSON_WRITER,
        MODULE_READER,
        MODULE_WRITER,
        SystemClock,
        NestEventPublisher,
        STORAGE_PRESIGNER,
      ],
      useFactory: (
        links: MentorLinkReader,
        courses: CourseReader,
        ar: LessonReader,
        aw: LessonWriter,
        modules: ModuleReader,
        modulesWriter: ModuleWriter,
        clock: SystemClock,
        events: NestEventPublisher,
        presigner: StoragePresigner,
      ) =>
        new cls({
          links,
          courses,
          lessons: ar,
          lessonsWriter: aw,
          modules,
          modulesWriter,
          clock,
          events,
          presigner,
        }),
    })),
    ...[
      SaveCourseUseCase,
      AddModuleUseCase,
      AddLessonUseCase,
      ReviewLessonUseCase,
      SaveMaterialUseCase,
    ].map((cls) => ({
      provide: cls,
      inject: [
        COURSE_READER,
        COURSE_WRITER,
        LESSON_READER,
        LESSON_WRITER,
        MODULE_READER,
        MODULE_WRITER,
        MATERIAL_WRITER,
        STORAGE_PRESIGNER,
      ],
      useFactory: (
        cr: CourseReader,
        cw: CourseWriter,
        ar: LessonReader,
        aw: LessonWriter,
        mr: ModuleReader,
        mw: ModuleWriter,
        materials: MaterialWriter,
        presigner: StoragePresigner,
      ) =>
        new cls({
          courses: cr as CourseReader & CourseWriter,
          lessons: ar,
          lessonsWriter: aw,
          modules: mr as ModuleReader & ModuleWriter,
          materials,
          presigner,
        }),
    })),
    {
      provide: ListMaterialsDoMentorUseCase,
      inject: [MENTOR_LINK_READER, MATERIAL_READER],
      useFactory: (links: MentorLinkReader, materials: MaterialReader) =>
        new ListMaterialsDoMentorUseCase({ links, materials }),
    },
    {
      provide: PresignUploadUseCase,
      inject: [STORAGE_PRESIGNER],
      useFactory: (presigner: StoragePresigner) =>
        new PresignUploadUseCase({ presigner }),
    },
  ],
  exports: [COURSE_READER, MENTOR_LINK_READER],
})
export class CoursesModule {}
