import { Lesson } from './entities/lesson.entity.js';
import { Course } from './entities/course.entity.js';
import { Enrollment } from './entities/enrollment.entity.js';
import type { ContentBlock } from './rich-content.vo.js';
export const COURSE_READER = 'COURSE_READER' as const;
export const COURSE_WRITER = 'COURSE_WRITER' as const;
export const LESSON_READER = 'LESSON_READER' as const;
export const LESSON_WRITER = 'LESSON_WRITER' as const;
export const MODULE_READER = 'MODULE_READER' as const;
export const MODULE_WRITER = 'MODULE_WRITER' as const;
export const ENROLLMENT_READER = 'ENROLLMENT_READER' as const;
export const ENROLLMENT_WRITER = 'ENROLLMENT_WRITER' as const;
export const PROGRESS_READER = 'PROGRESS_READER' as const;
export const PROGRESS_WRITER = 'PROGRESS_WRITER' as const;
export const MATERIAL_READER = 'MATERIAL_READER' as const;
export const MATERIAL_WRITER = 'MATERIAL_WRITER' as const;
export const STORAGE_PRESIGNER = 'STORAGE_PRESIGNER' as const;
export const MENTOR_LINK_READER = 'MENTOR_LINK_READER' as const;
export const MENTOR_LINK_WRITER = 'MENTOR_LINK_WRITER' as const;
export const STUDENT_DIRECTORY = 'STUDENT_DIRECTORY' as const;
export interface CourseResumo {
  id: string;
  title: string;
  slug: string;
  track: string | null;
  description: string;
  status: string;
  coverUrl: string | null;
  featured: boolean;
  order: number;
  totalModules: number;
  totalLessons: number;
  totalStudents: number;
}
export interface CourseFilter {
  track?: string;
  search?: string;
  status?: string;
  page: number;
  perPage: number;
}
export interface CourseReader {
  list(filter: CourseFilter): Promise<{
    courses: CourseResumo[];
    total: number;
  }>;
  byId(id: string): Promise<Course | null>;
  bySlug(slug: string): Promise<Course | null>;
  curriculum(
    courseId: string,
    onlyPublicadas: boolean,
  ): Promise<LessonEmCurriculum[]>;
  temLessonPublicada(courseId: string): Promise<boolean>;
  tracks(): Promise<string[]>;
}
export interface CourseWriter {
  create(course: Course): Promise<void>;
  save(course: Course): Promise<void>;
  remove(id: string): Promise<void>;
}
export interface LessonEmCurriculum {
  moduleId: string;
  moduleOrder: number;
  moduleTitle: string;
  lessonId: string;
  lessonOrder: number;
  type: string;
  title: string;
  status: string;
  contentUrl: string | null;
  videoUrl: string | null;
  materialUrl: string | null;
  text: string | null;
  blocks: ContentBlock[] | null;
  durationSeconds: number | null;
  sentForReviewAt: Date | null;
}
export interface LessonReader {
  byId(id: string): Promise<{
    lesson: Lesson;
    courseId: string;
  } | null>;
}
export interface LessonWriter {
  create(lesson: Lesson, courseId: string): Promise<void>;
  save(lesson: Lesson): Promise<void>;
  remove(id: string): Promise<void>;
}
export interface ModuleInput {
  id: string;
  courseId: string;
  order: number;
  title: string;
}
export interface ModuleReader {
  byId(id: string): Promise<ModuleInput | null>;
  nextOrder(courseId: string): Promise<number>;
  listByCourse(courseId: string): Promise<ModuleInput[]>;
}
export interface ModuleWriter {
  create(module: ModuleInput): Promise<void>;
  remove(id: string): Promise<void>;
}
export interface EnrollmentWithCourse {
  enrollment: Enrollment;
  course: CourseResumo;
  lessonCurrentTitle: string | null;
}
export interface MatriculaAdminRow {
  studentId: string;
  name: string;
  email: string;
  progressPercent: number;
  enrolledAt: Date;
  completedAt: Date | null;
}
export interface AlunoDisponivelRow {
  id: string;
  name: string;
  email: string;
}
export interface MatriculaFiltro {
  search?: string;
  page: number;
  perPage: number;
}
export interface StudentRef {
  id: string;
  role: string;
}
export interface StudentDirectory {
  byId(id: string): Promise<StudentRef | null>;
}
export interface EnrollmentReader {
  byStudent(studentId: string): Promise<EnrollmentWithCourse[]>;
  by(studentId: string, courseId: string): Promise<Enrollment | null>;
  listByCourse(
    courseId: string,
    filtro: MatriculaFiltro,
  ): Promise<{
    rows: MatriculaAdminRow[];
    total: number;
  }>;
  availableStudents(
    courseId: string,
    search?: string,
  ): Promise<AlunoDisponivelRow[]>;
}
export interface EnrollmentWriter {
  create(enrollment: Enrollment): Promise<void>;
  save(enrollment: Enrollment): Promise<void>;
  removeByStudent(studentId: string, courseId: string): Promise<void>;
}
export interface ProgressReader {
  concluidasDaEnrollment(studentId: string, courseId: string): Promise<number>;
  lessonIdsConcluidas(
    studentId: string,
    courseId: string,
  ): Promise<Set<string>>;
}
export interface ProgressWriter {
  complete(studentId: string, lessonId: string, em: Date): Promise<void>;
}
export interface MaterialRow {
  id: string;
  name: string;
  type: string;
  url: string;
  sizeBytes: number;
  courseId: string | null;
  moduleId: string | null;
  lessonId: string | null;
  createdAt: Date;
}
export interface MaterialReader {
  listFor(studentId: string | null, type?: string): Promise<MaterialRow[]>;
  listByCourse(courseId: string): Promise<MaterialRow[]>;
  listAll(type?: string): Promise<MaterialRow[]>;
  byId(id: string): Promise<MaterialRow | null>;
}
export interface MaterialWriter {
  create(material: {
    id: string;
    name: string;
    type: string;
    url: string;
    sizeBytes: number;
    courseId?: string | null;
    moduleId?: string | null;
    lessonId?: string | null;
  }): Promise<void>;
  remove(id: string): Promise<void>;
}
export interface PublicStats {
  totalLessons: number;
  lessonsPublicadas: number;
}
export interface MentorLinkReader {
  coursesDoMentor(mentorId: string): Promise<CourseResumo[]>;
  linkExiste(mentorId: string, courseId: string): Promise<boolean>;
  estatisticasByCourse(mentorId: string): Promise<Record<string, PublicStats>>;
}
export interface MentorLinkWriter {
  link(
    courseId: string,
    mentorId: string,
    role: 'AUTHOR' | 'COAUTHOR',
  ): Promise<void>;
  unlink(courseId: string, mentorId: string): Promise<void>;
}
export interface PresignInput {
  chave: string;
  typeContent: string;
  expiraEmSeconds?: number;
}
export interface PresignPartInput {
  chave: string;
  uploadId: string;
  parte: number;
  expiraEmSeconds?: number;
}
export interface CompletedPart {
  parte: number;
  etag: string;
}
export interface StoragePresigner {
  presignUpload(input: PresignInput): Promise<{
    url: string;
    expiraEm: string;
  }>;
  // Multipart upload: needed for files above S3's 5 GB single-PUT limit.
  createMultipartUpload(input: {
    chave: string;
    typeContent: string;
  }): Promise<{ uploadId: string }>;
  presignUploadPart(input: PresignPartInput): Promise<{
    url: string;
    expiraEm: string;
  }>;
  completeMultipartUpload(input: {
    chave: string;
    uploadId: string;
    partes: CompletedPart[];
  }): Promise<void>;
  abortMultipartUpload(input: { chave: string; uploadId: string }): Promise<void>;
  // Resolves a stored image value (S3 key, absolute/relative URL) to a
  // displayable URL: keys become short-lived signed GET URLs; the rest pass
  // through. Returns null for empty/data: values.
  resolvePublicUrl(valor: string): Promise<string | null>;
}
export const CoursesEvents = {
  CourseCompleted: 'cursos.curso_concluido',
  LessonEMReview: 'cursos.aula_em_revisao',
} as const;
