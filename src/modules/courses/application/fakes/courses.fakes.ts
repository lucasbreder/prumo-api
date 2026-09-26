import { Lesson } from '../../domain/entities/lesson.entity.js';
import { Course } from '../../domain/entities/course.entity.js';
import { Enrollment } from '../../domain/entities/enrollment.entity.js';
import { AccessDeniedError } from '../../../../shared/errors/domain.errors.js';
import type {
  LessonEmCurriculum,
  LessonReader,
  LessonWriter,
  CourseFilter,
  CourseReader,
  CourseResumo,
  CourseWriter,
  MaterialRow,
  MaterialReader,
  MaterialWriter,
  EnrollmentWithCourse,
  EnrollmentReader,
  EnrollmentWriter,
  AlunoDisponivelRow,
  MatriculaAdminRow,
  MatriculaFiltro,
  ModuleInput,
  ModuleReader,
  ModuleWriter,
  PresignInput,
  ProgressReader,
  ProgressWriter,
  StoragePresigner,
} from '../../domain/repositories.js';
export function comoResumo(course: Course): CourseResumo {
  return {
    id: course.id,
    title: course.title,
    slug: course.slug,
    track: course.track,
    description: course.description,
    status: course.status,
    coverUrl: course.coverUrl,
    featured: course.featured,
    order: course.order,
    totalModules: 0,
    totalLessons: 0,
    totalStudents: 0,
  };
}
export class FakeCourseRepo implements CourseReader, CourseWriter {
  courses = new Map<string, Course>();
  modules: ModuleInput[] = [];
  lessons: LessonEmCurriculum[] = [];
  async list(filter: CourseFilter): Promise<{
    courses: CourseResumo[];
    total: number;
  }> {
    let items = [...this.courses.values()].map(comoResumo);
    if (filter.status) items = items.filter((c) => c.status === filter.status);
    if (filter.track) items = items.filter((c) => c.track === filter.track);
    if (filter.search) {
      const b = filter.search.toLowerCase();
      items = items.filter((c) => c.title.toLowerCase().includes(b));
    }
    const startsAt = (filter.page - 1) * filter.perPage;
    return {
      courses: items.slice(startsAt, startsAt + filter.perPage),
      total: items.length,
    };
  }
  async byId(id: string) {
    return this.courses.get(id) ?? null;
  }
  async bySlug(slug: string) {
    return [...this.courses.values()].find((c) => c.slug === slug) ?? null;
  }
  async curriculum(
    courseId: string,
    onlyPublicadas: boolean,
  ): Promise<LessonEmCurriculum[]> {
    const modulesDoCourse = this.modules.filter((m) => m.courseId === courseId);
    return this.lessons
      .filter(
        (a) =>
          modulesDoCourse.some((m) => m.id === a.moduleId) &&
          (!onlyPublicadas || a.status === 'PUBLISHED'),
      )
      .sort(
        (a, b) =>
          a.moduleOrder - b.moduleOrder || a.lessonOrder - b.lessonOrder,
      );
  }
  async temLessonPublicada(courseId: string) {
    return (await this.curriculum(courseId, true)).length > 0;
  }
  async tracks() {
    return [
      ...new Set(
        [...this.courses.values()].map((c) => c.track).filter(Boolean),
      ),
    ] as string[];
  }
  async create(course: Course) {
    this.courses.set(course.id, course);
  }
  async save(course: Course) {
    this.courses.set(course.id, course);
  }
}
export class FakeLessonRepo implements LessonReader, LessonWriter {
  lessons = new Map<
    string,
    {
      lesson: Lesson;
      courseId: string;
    }
  >();
  async byId(id: string) {
    return this.lessons.get(id) ?? null;
  }
  async create(lesson: Lesson, courseId: string) {
    this.lessons.set(lesson.id, { lesson, courseId });
  }
  async save(lesson: Lesson) {
    const existing = this.lessons.get(lesson.id);
    if (existing) existing.lesson = lesson;
  }
}
export class FakeModuleRepo implements ModuleReader, ModuleWriter {
  modules = new Map<string, ModuleInput>();
  async byId(id: string) {
    return this.modules.get(id) ?? null;
  }
  async nextOrder(courseId: string) {
    return (
      [...this.modules.values()].filter((m) => m.courseId === courseId).length +
      1
    );
  }
  async listByCourse(courseId: string): Promise<ModuleInput[]> {
    return [...this.modules.values()]
      .filter((m) => m.courseId === courseId)
      .sort((a, b) => a.order - b.order);
  }
  async create(module: ModuleInput) {
    this.modules.set(module.id, module);
  }
  async remove(id: string) {
    this.modules.delete(id);
  }
}
export class FakeEnrollmentRepo implements EnrollmentReader, EnrollmentWriter {
  enrollments = new Map<string, Enrollment>();
  coursesById = new Map<string, Course>();
  students = new Map<
    string,
    { name: string; email: string; role: string }
  >();
  dataMatriculas = new Map<string, Date>();
  chave(studentId: string, courseId: string) {
    return `${studentId}:${courseId}`;
  }
  async byStudent(studentId: string): Promise<EnrollmentWithCourse[]> {
    return [...this.enrollments.values()]
      .filter((m) => m.studentId === studentId)
      .map((m) => ({
        enrollment: m,
        course: comoResumo(this.coursesById.get(m.courseId) as Course),
        lessonCurrentTitle: null,
      }));
  }
  async by(studentId: string, courseId: string) {
    return this.enrollments.get(this.chave(studentId, courseId)) ?? null;
  }
  async create(enrollment: Enrollment) {
    const k = this.chave(enrollment.studentId, enrollment.courseId);
    this.enrollments.set(k, enrollment);
    this.dataMatriculas.set(k, new Date());
  }
  async save(enrollment: Enrollment) {
    this.enrollments.set(
      this.chave(enrollment.studentId, enrollment.courseId),
      enrollment,
    );
  }
  async listByCourse(
    courseId: string,
    filtro: MatriculaFiltro,
  ): Promise<{ rows: MatriculaAdminRow[]; total: number }> {
    let rows: MatriculaAdminRow[] = [...this.enrollments.values()]
      .filter((m) => m.courseId === courseId)
      .map((m) => {
        const aluno = this.students.get(m.studentId);
        return {
          studentId: m.studentId,
          name: aluno?.name ?? '',
          email: aluno?.email ?? '',
          progressPercent: m.progressPercent,
          enrolledAt:
            this.dataMatriculas.get(this.chave(m.studentId, m.courseId)) ??
            new Date(),
          completedAt: m.completedAt,
        };
      });
    if (filtro.search) {
      const b = filtro.search.toLowerCase();
      rows = rows.filter(
        (r) =>
          r.name.toLowerCase().includes(b) || r.email.toLowerCase().includes(b),
      );
    }
    rows.sort((a, b) => a.name.localeCompare(b.name));
    const startsAt = (filtro.page - 1) * filtro.perPage;
    return {
      rows: rows.slice(startsAt, startsAt + filtro.perPage),
      total: rows.length,
    };
  }
  async availableStudents(
    courseId: string,
    search?: string,
  ): Promise<AlunoDisponivelRow[]> {
    let alunos = [...this.students.entries()]
      .filter(
        ([id, a]) =>
          a.role === 'STUDENT' && !this.enrollments.has(this.chave(id, courseId)),
      )
      .map(([id, a]) => ({ id, name: a.name, email: a.email }));
    if (search) {
      const b = search.toLowerCase();
      alunos = alunos.filter(
        (a) =>
          a.name.toLowerCase().includes(b) ||
          a.email.toLowerCase().includes(b),
      );
    }
    return alunos.sort((a, b) => a.name.localeCompare(b.name));
  }
  async removeByStudent(studentId: string, courseId: string) {
    this.enrollments.delete(this.chave(studentId, courseId));
    this.dataMatriculas.delete(this.chave(studentId, courseId));
  }
}
export class FakeProgressRepo implements ProgressReader, ProgressWriter {
  concluidas = new Map<string, Set<string>>();
  courseByLesson = new Map<string, string>();
  chave(studentId: string, courseId: string) {
    return `${studentId}:${courseId}`;
  }
  async complete(studentId: string, lessonId: string, _em: Date) {
    const courseId = this.courseByLesson.get(lessonId) ?? 'c1';
    const k = this.chave(studentId, courseId);
    if (!this.concluidas.has(k)) this.concluidas.set(k, new Set());
    this.concluidas.get(k)?.add(lessonId);
  }
  async concluidasDaEnrollment(studentId: string, courseId: string) {
    return this.concluidas.get(this.chave(studentId, courseId))?.size ?? 0;
  }
  async lessonIdsConcluidas(studentId: string, courseId: string) {
    return (
      this.concluidas.get(this.chave(studentId, courseId)) ?? new Set<string>()
    );
  }
}
export class FakeMaterialRepo implements MaterialReader, MaterialWriter {
  materials: MaterialRow[] = [];
  enrollmentsStudent = new Map<string, string[]>();
  async listFor(
    studentId: string | null,
    type?: string,
  ): Promise<MaterialRow[]> {
    const enrollments =
      (studentId && this.enrollmentsStudent.get(studentId)) || [];
    return this.materials.filter((m) => {
      if (type && m.type !== type) return false;
      if (m.courseId === null) return true;
      if (!studentId) return false;
      return enrollments.includes(m.courseId);
    });
  }
  async listAll(type?: string) {
    return this.materials.filter((m) => !type || m.type === type);
  }
  async listByCourse(courseId: string) {
    return this.materials.filter((m) => m.courseId === courseId);
  }
  async byId(id: string) {
    return this.materials.find((m) => m.id === id) ?? null;
  }
  async create(material: {
    id: string;
    name: string;
    type: string;
    url: string;
    sizeBytes: number;
    courseId?: string | null;
    moduleId?: string | null;
    lessonId?: string | null;
  }) {
    this.materials.push({
      createdAt: new Date(),
      courseId: material.courseId ?? null,
      moduleId: material.moduleId ?? null,
      lessonId: material.lessonId ?? null,
      id: material.id,
      name: material.name,
      type: material.type,
      url: material.url,
      sizeBytes: material.sizeBytes,
    });
  }
  async remove(id: string) {
    this.materials = this.materials.filter((m) => m.id !== id);
  }
}
export class FakePresigner implements StoragePresigner {
  last: PresignInput[] = [];
  async presignUpload(input: PresignInput) {
    this.last.push(input);
    return {
      url: `https://storage.test/${input.chave}?sig=1`,
      expiraEm: '2026-09-04T13:00:00.000Z',
    };
  }
  async resolvePublicUrl(valor: string): Promise<string | null> {
    const v = valor.trim();
    if (!v || v.startsWith('data:')) return null;
    if (/^(https?:)?\/\//i.test(v) || v.startsWith('/')) return v;
    return `https://img.test/${v}?sig=1`;
  }
}
export function gateFalso(negados: string[] = ['sem-acesso']) {
  return {
    async garantirAccessStudent(userId: string): Promise<void> {
      if (negados.includes(userId))
        throw new AccessDeniedError('Sem plano ativo');
    },
  };
}
export function pubFalsa(
  list: {
    name: string;
    payload: unknown;
  }[],
) {
  return {
    issue(name: string, payload: unknown) {
      list.push({ name, payload });
    },
  };
}
