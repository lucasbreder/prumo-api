import { randomUUID } from 'node:crypto';
import {
  CourseReader,
  EnrollmentReader,
  EnrollmentWriter,
  ProgressReader,
  ProgressWriter,
  MaterialReader,
  StoragePresigner,
  CoursesEvents,
} from '../../domain/repositories.js';
import { Enrollment } from '../../domain/entities/enrollment.entity.js';
import { AccessGate } from '../../domain/access-gate.js';
import { resolveAssetUrl, resolveBlockImages } from '../resolve-content-images.js';
import {
  AccessDeniedError,
  NotFoundError,
  BusinessRuleError,
} from '../../../../shared/errors/domain.errors.js';
import { Clock } from '../../../../shared/domain/clock.js';
import { LessonReader } from '../../domain/repositories.js';
interface Pub {
  issue(name: string, payload: unknown): void;
}
export interface StudentDeps {
  courses: CourseReader;
  enrollments: EnrollmentReader & EnrollmentWriter;
  progress: ProgressReader & ProgressWriter;
  lessons: LessonReader;
  materials: MaterialReader;
  gate: AccessGate;
  events: Pub;
  clock: Clock;
  presigner: StoragePresigner;
}
function enrollmentSummary(m: {
  enrollment: Enrollment;
  course: {
    id: string;
    title: string;
    slug: string;
    coverUrl: string | null;
  };
  lessonCurrentTitle: string | null;
}) {
  return {
    courseId: m.course.id,
    title: m.course.title,
    slug: m.course.slug,
    coverUrl: m.course.coverUrl,
    progressPercent: m.enrollment.progressPercent,
    currentLessonId: m.enrollment.currentLessonId,
    lessonCurrentTitle: m.lessonCurrentTitle,
    completedAt: m.enrollment.completedAt?.toISOString() ?? null,
  };
}
export class EnrollCourseUseCase {
  constructor(private readonly deps: StudentDeps) {}
  async execute(input: { studentId: string; courseId: string }) {
    await this.deps.gate.garantirAccessStudent(input.studentId);
    const course = await this.deps.courses.byId(input.courseId);
    if (!course || course.status !== 'PUBLISHED') {
      throw new NotFoundError('Curso nao disponivel');
    }
    const existing = await this.deps.enrollments.by(input.studentId, course.id);
    if (existing)
      return { created: false, progressPercent: existing.progressPercent };
    await this.deps.enrollments.create(
      Enrollment.create({
        id: randomUUID(),
        studentId: input.studentId,
        courseId: course.id,
      }),
    );
    return { created: true, progressPercent: 0 };
  }
}
export class ListMeusCoursesUseCase {
  constructor(private readonly deps: StudentDeps) {}
  async execute(input: { studentId: string }) {
    await this.deps.gate.garantirAccessStudent(input.studentId);
    const enrollments = await this.deps.enrollments.byStudent(input.studentId);
    return { courses: enrollments.map(enrollmentSummary) };
  }
}
export class GetMeuCourseUseCase {
  constructor(private readonly deps: StudentDeps) {}
  async execute(input: { studentId: string; courseId: string }) {
    await this.deps.gate.garantirAccessStudent(input.studentId);
    const enrollment = await this.deps.enrollments.by(
      input.studentId,
      input.courseId,
    );
    if (!enrollment)
      throw new AccessDeniedError('Facas a matricula para acessar o curso');
    const course = await this.deps.courses.byId(input.courseId);
    if (!course) throw new NotFoundError('Curso nao encontrado');
    const lessons = await this.deps.courses.curriculum(input.courseId, true);
    const concluidas = await this.deps.progress.lessonIdsConcluidas(
      input.studentId,
      input.courseId,
    );
    const next = lessons.find((a) => !concluidas.has(a.lessonId));
    const publicada = (a: (typeof lessons)[number]) =>
      a.status === 'PUBLISHED';
    return {
      course: {
        id: course.id,
        title: course.title,
        slug: course.slug,
        description: course.description,
        coverUrl: course.coverUrl,
      },
      progressPercent: enrollment.progressPercent,
      lessons: await Promise.all(
        lessons.map(async (a) => ({
          id: a.lessonId,
          moduleTitle: a.moduleTitle,
          title: a.title,
          type: a.type,
          durationSeconds: a.durationSeconds,
          contentUrl: publicada(a)
            ? await resolveAssetUrl(a.contentUrl, (k) =>
                this.deps.presigner.resolvePublicUrl(k),
              )
            : null,
          text: publicada(a) ? a.text : null,
          blocks: publicada(a)
            ? await resolveBlockImages(a.blocks, (k) =>
                this.deps.presigner.resolvePublicUrl(k),
              )
            : null,
          completed: concluidas.has(a.lessonId),
        })),
      ),
      nextLessonId: next?.lessonId ?? enrollment.currentLessonId,
    };
  }
}
export class CompleteLessonUseCase {
  constructor(private readonly deps: StudentDeps) {}
  async execute(input: { studentId: string; lessonId: string }) {
    await this.deps.gate.garantirAccessStudent(input.studentId);
    const referencia = await this.deps.lessons.byId(input.lessonId);
    if (!referencia) {
      throw new NotFoundError('Aula nao encontrada');
    }
    const { lesson, courseId } = referencia;
    if (lesson.status !== 'PUBLISHED') {
      throw new BusinessRuleError('Aula indisponivel no momento');
    }
    const enrollment = await this.deps.enrollments.by(
      input.studentId,
      courseId,
    );
    if (!enrollment)
      throw new AccessDeniedError('Facas a matricula para acessar o curso');
    const current = this.deps.clock.now();
    const antes = enrollment.progressPercent;
    await this.deps.progress.complete(input.studentId, input.lessonId, current);
    const lessonsPublicadas = await this.deps.courses.curriculum(
      courseId,
      true,
    );
    const concluidas = await this.deps.progress.lessonIdsConcluidas(
      input.studentId,
      courseId,
    );
    const next = lessonsPublicadas.find((a) => !concluidas.has(a.lessonId));
    enrollment.definirLessonCurrent(next?.lessonId ?? null);
    enrollment.recalcularProgress(
      {
        totalPublicadas: lessonsPublicadas.length,
        concluidas: concluidas.size,
      },
      current,
    );
    await this.deps.enrollments.save(enrollment);
    const completed = enrollment.progressPercent === 100;
    if (completed && antes < 100) {
      this.deps.events.issue(CoursesEvents.CourseCompleted, {
        studentId: input.studentId,
        courseId,
      });
    }
    return {
      progressPercent: enrollment.progressPercent,
      completed,
      certificate: enrollment.completedAt
        ? {
            code: enrollment.id,
            issuedAt: enrollment.completedAt.toISOString(),
          }
        : null,
      nextLessonId: enrollment.currentLessonId,
    };
  }
}
export class MeuProgressUseCase {
  constructor(private readonly deps: StudentDeps) {}
  async execute(input: { studentId: string }) {
    await this.deps.gate.garantirAccessStudent(input.studentId);
    const enrollments = await this.deps.enrollments.byStudent(input.studentId);
    return {
      courses: enrollments.map(enrollmentSummary),
      continuarDe:
        enrollments
          .map((m) => enrollmentSummary(m))
          .find((c) => c.progressPercent < 100) ?? null,
    };
  }
}
export class ListConcluidosUseCase {
  constructor(private readonly deps: StudentDeps) {}
  async execute(input: { studentId: string }) {
    await this.deps.gate.garantirAccessStudent(input.studentId);
    const enrollments = await this.deps.enrollments.byStudent(input.studentId);
    return {
      certificates: enrollments
        .filter(
          (m) =>
            m.enrollment.progressPercent === 100 && m.enrollment.completedAt,
        )
        .map((m) => ({
          courseTitle: m.course.title,
          code: m.enrollment.id,
          issuedAt: (m.enrollment.completedAt as Date).toISOString(),
        })),
    };
  }
}
export class ListDownloadsUseCase {
  constructor(private readonly deps: StudentDeps) {}
  async execute(input: { studentId: string; type?: string }) {
    await this.deps.gate.garantirAccessStudent(input.studentId);
    const materials = await this.deps.materials.listFor(
      input.studentId,
      input.type,
    );
    return {
      materials: await Promise.all(
        materials.map(async (m) => ({
          id: m.id,
          name: m.name,
          type: m.type,
          url: await resolveAssetUrl(m.url, (k) =>
            this.deps.presigner.resolvePublicUrl(k),
          ),
          sizeBytes: m.sizeBytes,
          courseId: m.courseId,
        })),
      ),
    };
  }
}
