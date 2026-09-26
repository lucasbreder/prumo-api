import { randomUUID } from 'node:crypto';
import {
  CourseReader,
  EnrollmentReader,
  EnrollmentWriter,
  MatriculaFiltro,
  StudentDirectory,
} from '../../domain/repositories.js';
import { Enrollment } from '../../domain/entities/enrollment.entity.js';
import { NotFoundError } from '../../../../shared/errors/domain.errors.js';
interface AdminEnrollmentsDeps {
  courses: CourseReader;
  enrollments: EnrollmentReader & EnrollmentWriter;
}
export class ListCourseEnrollmentsAdminUseCase {
  constructor(private readonly deps: AdminEnrollmentsDeps) {}
  async execute(
    input: { courseId: string } & MatriculaFiltro,
  ): Promise<{
    course: { id: string; title: string };
    items: {
      studentId: string;
      name: string;
      email: string;
      progressPercent: number;
      enrolledAt: string;
      completedAt: string | null;
    }[];
    meta: { page: number; perPage: number; total: number; totalPages: number };
  }> {
    const course = await this.deps.courses.byId(input.courseId);
    if (!course) throw new NotFoundError('Curso nao encontrado');
    const { rows, total } = await this.deps.enrollments.listByCourse(
      input.courseId,
      input,
    );
    return {
      course: { id: course.id, title: course.title },
      items: rows.map((r) => ({
        studentId: r.studentId,
        name: r.name,
        email: r.email,
        progressPercent: r.progressPercent,
        enrolledAt: r.enrolledAt.toISOString(),
        completedAt: r.completedAt?.toISOString() ?? null,
      })),
      meta: {
        page: input.page,
        perPage: input.perPage,
        total,
        totalPages: Math.max(1, Math.ceil(total / input.perPage)),
      },
    };
  }
}
export class ListAvailableStudentsAdminUseCase {
  constructor(private readonly deps: AdminEnrollmentsDeps) {}
  async execute(input: { courseId: string; search?: string }): Promise<{
    items: { id: string; name: string; email: string }[];
  }> {
    const course = await this.deps.courses.byId(input.courseId);
    if (!course) throw new NotFoundError('Curso nao encontrado');
    const items = await this.deps.enrollments.availableStudents(
      input.courseId,
      input.search,
    );
    return { items };
  }
}
export class EnrollStudentAdminUseCase {
  constructor(
    private readonly deps: AdminEnrollmentsDeps & { students: StudentDirectory },
  ) {}
  async execute(input: {
    courseId: string;
    studentId: string;
  }): Promise<{ created: boolean }> {
    const course = await this.deps.courses.byId(input.courseId);
    if (!course) throw new NotFoundError('Curso nao encontrado');
    const student = await this.deps.students.byId(input.studentId);
    if (!student || student.role !== 'STUDENT') {
      throw new NotFoundError('Aluno nao encontrado');
    }
    const existente = await this.deps.enrollments.by(
      input.studentId,
      input.courseId,
    );
    if (existente) return { created: false };
    await this.deps.enrollments.create(
      Enrollment.create({
        id: randomUUID(),
        studentId: input.studentId,
        courseId: input.courseId,
      }),
    );
    return { created: true };
  }
}
export class UnenrollStudentAdminUseCase {
  constructor(private readonly deps: AdminEnrollmentsDeps) {}
  async execute(input: { courseId: string; studentId: string }): Promise<void> {
    const existente = await this.deps.enrollments.by(
      input.studentId,
      input.courseId,
    );
    if (!existente) throw new NotFoundError('Matricula nao encontrada');
    await this.deps.enrollments.removeByStudent(
      input.studentId,
      input.courseId,
    );
  }
}
