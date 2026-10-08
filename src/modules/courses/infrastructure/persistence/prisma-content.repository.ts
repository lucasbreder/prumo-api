import { Injectable } from '@nestjs/common';
import { PrismaService } from '../../../../shared/database/prisma.service.js';
import { Lesson } from '../../domain/entities/lesson.entity.js';
import { Enrollment } from '../../domain/entities/enrollment.entity.js';
import {
  LessonReader,
  LessonWriter,
  MaterialRow,
  MaterialReader,
  MaterialWriter,
  EnrollmentWithCourse,
  EnrollmentReader,
  EnrollmentWriter,
  ModuleInput,
  ModuleReader,
  ModuleWriter,
  ProgressReader,
  ProgressWriter,
  AlunoDisponivelRow,
  MatriculaAdminRow,
  MatriculaFiltro,
  StudentDirectory,
  StudentRef,
} from '../../domain/repositories.js';
import { skipTake } from '../../../../shared/pagination/pagination.js';
import { rowForResumo } from './prisma-course.repository.js';
import { Prisma } from '../../../../generated/prisma/client.js';
import {
  ConflictError,
  NotFoundError,
} from '../../../../shared/errors/domain.errors.js';
import { MaterialType } from '../../../../generated/prisma/enums.js';
import type { ContentBlock } from '../../domain/rich-content.vo.js';
const FieldsLesson = {
  id: true,
  moduleId: true,
  order: true,
  type: true,
  title: true,
  contentUrl: true,
  videoUrl: true,
  materialUrl: true,
  text: true,
  blocks: true,
  durationSeconds: true,
  status: true,
  sentForReviewAt: true,
} satisfies Prisma.LessonSelect;
function rowForLesson(
  row: Prisma.LessonGetPayload<{
    select: typeof FieldsLesson & {
      module: {
        select: {
          courseId: true;
        };
      };
    };
  }>,
): {
  lesson: Lesson;
  courseId: string;
} {
  const type = row.type as 'VIDEO' | 'QUIZ' | 'MATERIAL' | 'TEXT';
  // Compat: aulas antigas só têm `contentUrl`; aloca no slot conforme o tipo.
  const videoUrl =
    row.videoUrl ??
    (type !== 'MATERIAL' ? row.contentUrl : null);
  const materialUrl =
    row.materialUrl ??
    (type === 'MATERIAL' ? row.contentUrl : null);
  return {
    lesson: Lesson.reconstituir({
      id: row.id,
      moduleId: row.moduleId,
      order: row.order,
      type,
      title: row.title,
      videoUrl,
      materialUrl,
      text: row.text,
      blocks: (row.blocks as ContentBlock[] | null) ?? null,
      durationSeconds: row.durationSeconds,
      status: row.status as 'DRAFT' | 'IN_REVIEW' | 'PUBLISHED',
      sentForReviewAt: row.sentForReviewAt,
    }),
    courseId: row.module.courseId,
  };
}
function lessonForEscritura(lesson: Lesson) {
  return {
    moduleId: lesson.moduleId,
    order: lesson.order,
    type: lesson.type,
    title: lesson.title,
    contentUrl: lesson.contentUrl,
    videoUrl: lesson.videoUrl,
    materialUrl: lesson.materialUrl,
    text: lesson.text,
    blocks: (lesson.blocks ?? null) as Prisma.InputJsonValue,
    durationSeconds: lesson.durationSeconds,
    status: lesson.status,
    sentForReviewAt: lesson.sentForReviewAt,
  };
}
@Injectable()
export class PrismaLessonRepository implements LessonReader, LessonWriter {
  constructor(private readonly prisma: PrismaService) {}
  async byId(id: string) {
    const row = await this.prisma.lesson.findUnique({
      where: { id },
      select: { ...FieldsLesson, module: { select: { courseId: true } } },
    });
    return row ? rowForLesson(row) : null;
  }
  async create(lesson: Lesson): Promise<void> {
    await this.prisma.lesson.create({
      data: { id: lesson.id, ...lessonForEscritura(lesson) },
    });
  }
  async save(lesson: Lesson): Promise<void> {
    try {
      await this.prisma.lesson.update({
        where: { id: lesson.id },
        data: lessonForEscritura(lesson),
      });
    } catch (e) {
      if (
        e instanceof Prisma.PrismaClientKnownRequestError &&
        e.code === 'P2025'
      ) {
        throw new NotFoundError('Aula nao encontrada');
      }
      throw e;
    }
  }
  async remove(id: string): Promise<void> {
    await this.prisma.lesson.delete({ where: { id } }).catch((e: unknown) => {
      if (
        e instanceof Prisma.PrismaClientKnownRequestError &&
        e.code === 'P2025'
      ) {
        throw new NotFoundError('Aula nao encontrada');
      }
      throw e;
    });
  }
}
@Injectable()
export class PrismaModuleRepository implements ModuleReader, ModuleWriter {
  constructor(private readonly prisma: PrismaService) {}
  async byId(id: string): Promise<ModuleInput | null> {
    const row = await this.prisma.module.findUnique({
      where: { id },
      select: { id: true, courseId: true, order: true, title: true },
    });
    return row ?? null;
  }
  async nextOrder(courseId: string): Promise<number> {
    const total = await this.prisma.module.count({ where: { courseId } });
    return total + 1;
  }
  async listByCourse(courseId: string): Promise<ModuleInput[]> {
    return this.prisma.module.findMany({
      where: { courseId },
      orderBy: { order: 'asc' },
      select: { id: true, courseId: true, order: true, title: true },
    });
  }
  async create(module: ModuleInput): Promise<void> {
    try {
      await this.prisma.module.create({ data: module });
    } catch (e) {
      if (
        e instanceof Prisma.PrismaClientKnownRequestError &&
        e.code === 'P2002'
      ) {
        throw new ConflictError('Ordem de modulo ja utilizada neste curso');
      }
      throw e;
    }
  }
  async remove(id: string): Promise<void> {
    await this.prisma.module.delete({ where: { id } }).catch((e: unknown) => {
      if (
        e instanceof Prisma.PrismaClientKnownRequestError &&
        e.code === 'P2025'
      ) {
        throw new NotFoundError('Modulo nao encontrado');
      }
      throw e;
    });
  }
}
const FieldsEnrollment = {
  id: true,
  studentId: true,
  courseId: true,
  progressPercent: true,
  currentLessonId: true,
  completedAt: true,
} satisfies Prisma.EnrollmentSelect;
@Injectable()
export class PrismaEnrollmentRepository
  implements EnrollmentReader, EnrollmentWriter
{
  constructor(private readonly prisma: PrismaService) {}
  async byStudent(studentId: string): Promise<EnrollmentWithCourse[]> {
    const rows = await this.prisma.enrollment.findMany({
      where: { studentId },
      orderBy: { updatedAt: 'desc' },
      select: {
        ...FieldsEnrollment,
        course: {
          select: {
            id: true,
            title: true,
            slug: true,
            description: true,
            status: true,
            coverUrl: true,
            featured: true,
            order: true,
            track: true,
          },
        },
        currentLesson: { select: { title: true } },
      },
    });
    return rows.map((l) => {
      const { currentLesson, course, ...props } = l;
      return {
        enrollment: Enrollment.reconstituir(props),
        course: rowForResumo(course),
        lessonCurrentTitle: currentLesson?.title ?? null,
      };
    });
  }
  async by(studentId: string, courseId: string): Promise<Enrollment | null> {
    const row = await this.prisma.enrollment.findUnique({
      where: { studentId_courseId: { studentId, courseId } },
      select: FieldsEnrollment,
    });
    return row ? Enrollment.reconstituir(row) : null;
  }
  async create(enrollment: Enrollment): Promise<void> {
    try {
      await this.prisma.enrollment.create({
        data: {
          id: enrollment.id,
          studentId: enrollment.studentId,
          courseId: enrollment.courseId,
          progressPercent: enrollment.progressPercent,
          currentLessonId: enrollment.currentLessonId,
          completedAt: enrollment.completedAt,
        },
      });
    } catch (e) {
      if (
        e instanceof Prisma.PrismaClientKnownRequestError &&
        e.code === 'P2002'
      ) {
        throw new ConflictError('Matricula ja existente');
      }
      throw e;
    }
  }
  async save(enrollment: Enrollment): Promise<void> {
    await this.prisma.enrollment.update({
      where: { id: enrollment.id },
      data: {
        progressPercent: enrollment.progressPercent,
        currentLessonId: enrollment.currentLessonId,
        completedAt: enrollment.completedAt,
      },
    });
  }
  async listByCourse(
    courseId: string,
    filtro: MatriculaFiltro,
  ): Promise<{ rows: MatriculaAdminRow[]; total: number }> {
    const onde: Prisma.EnrollmentWhereInput = {
      courseId,
      ...(filtro.search
        ? {
            student: {
              OR: [
                { name: { contains: filtro.search, mode: 'insensitive' } },
                { email: { contains: filtro.search, mode: 'insensitive' } },
              ],
            },
          }
        : {}),
    };
    const [total, rows] = await this.prisma.$transaction([
      this.prisma.enrollment.count({ where: onde }),
      this.prisma.enrollment.findMany({
        where: onde,
        orderBy: { createdAt: 'desc' },
        ...skipTake(filtro),
        select: {
          studentId: true,
          progressPercent: true,
          createdAt: true,
          completedAt: true,
          student: { select: { name: true, email: true } },
        },
      }),
    ]);
    return {
      rows: rows.map((l) => ({
        studentId: l.studentId,
        name: l.student.name,
        email: l.student.email,
        progressPercent: l.progressPercent,
        enrolledAt: l.createdAt,
        completedAt: l.completedAt,
      })),
      total,
    };
  }
  async availableStudents(
    courseId: string,
    search?: string,
  ): Promise<AlunoDisponivelRow[]> {
    const rows = await this.prisma.user.findMany({
      where: {
        role: 'STUDENT',
        NOT: { enrollments: { some: { courseId } } },
        ...(search
          ? {
              OR: [
                { name: { contains: search, mode: 'insensitive' } },
                { email: { contains: search, mode: 'insensitive' } },
              ],
            }
          : {}),
      },
      orderBy: { name: 'asc' },
      take: 20,
      select: { id: true, name: true, email: true },
    });
    return rows;
  }
  async removeByStudent(studentId: string, courseId: string): Promise<void> {
    await this.prisma.enrollment.deleteMany({ where: { studentId, courseId } });
  }
}
@Injectable()
export class PrismaStudentDirectory implements StudentDirectory {
  constructor(private readonly prisma: PrismaService) {}
  async byId(id: string): Promise<StudentRef | null> {
    const row = await this.prisma.user.findUnique({
      where: { id },
      select: { id: true, role: true },
    });
    return row ? { id: row.id, role: row.role } : null;
  }
}
@Injectable()
export class PrismaProgressRepository
  implements ProgressReader, ProgressWriter
{
  constructor(private readonly prisma: PrismaService) {}
  async complete(studentId: string, lessonId: string, em: Date): Promise<void> {
    await this.prisma.lessonProgress.upsert({
      where: { studentId_lessonId: { studentId, lessonId } },
      create: { studentId, lessonId, completed: true, completedAt: em },
      update: { completed: true, completedAt: em },
    });
  }
  private async ids(studentId: string, courseId: string): Promise<string[]> {
    const rows = await this.prisma.lessonProgress.findMany({
      where: {
        studentId,
        completed: true,
        lesson: { module: { courseId } },
      },
      select: { lessonId: true },
    });
    return rows.map((l) => l.lessonId);
  }
  async concluidasDaEnrollment(
    studentId: string,
    courseId: string,
  ): Promise<number> {
    return (await this.ids(studentId, courseId)).length;
  }
  async lessonIdsConcluidas(
    studentId: string,
    courseId: string,
  ): Promise<Set<string>> {
    return new Set(await this.ids(studentId, courseId));
  }
}
@Injectable()
export class PrismaMaterialRepository
  implements MaterialReader, MaterialWriter
{
  constructor(private readonly prisma: PrismaService) {}
  private forRow(l: {
    id: string;
    name: string;
    type: string;
    url: string;
    sizeBytes: bigint;
    courseId: string | null;
    moduleId: string | null;
    lessonId: string | null;
    createdAt: Date;
  }): MaterialRow {
    return { ...l, type: l.type, sizeBytes: Number(l.sizeBytes) };
  }
  async listFor(
    studentId: string | null,
    type?: string,
  ): Promise<MaterialRow[]> {
    const enrollments = studentId
      ? await this.prisma.enrollment.findMany({
          where: { studentId },
          select: { courseId: true },
        })
      : [];
    const coursesIds = enrollments.map((m) => m.courseId);
    const rows = await this.prisma.material.findMany({
      where: {
        ...(type ? { type: type as Prisma.MaterialWhereInput['type'] } : {}),
        OR: [
          { courseId: null },
          ...(coursesIds.length ? [{ courseId: { in: coursesIds } }] : []),
        ],
      },
      orderBy: { createdAt: 'desc' },
      select: {
        id: true,
        name: true,
        type: true,
        url: true,
        sizeBytes: true,
        courseId: true,
        moduleId: true,
        lessonId: true,
        createdAt: true,
      },
    });
    return rows.map((l) => this.forRow(l));
  }
  async listAll(type?: string): Promise<MaterialRow[]> {
    const rows = await this.prisma.material.findMany({
      where: type ? { type: type as Prisma.MaterialWhereInput['type'] } : {},
      orderBy: { createdAt: 'desc' },
      select: {
        id: true,
        name: true,
        type: true,
        url: true,
        sizeBytes: true,
        courseId: true,
        moduleId: true,
        lessonId: true,
        createdAt: true,
      },
    });
    return rows.map((l) => this.forRow(l));
  }
  async listByCourse(courseId: string): Promise<MaterialRow[]> {
    const rows = await this.prisma.material.findMany({
      where: { courseId: courseId },
      orderBy: { createdAt: 'desc' },
      select: {
        id: true,
        name: true,
        type: true,
        url: true,
        sizeBytes: true,
        courseId: true,
        moduleId: true,
        lessonId: true,
        createdAt: true,
      },
    });
    return rows.map((l) => this.forRow(l));
  }
  async byId(id: string): Promise<MaterialRow | null> {
    const row = await this.prisma.material.findUnique({
      where: { id },
      select: {
        id: true,
        name: true,
        type: true,
        url: true,
        sizeBytes: true,
        courseId: true,
        moduleId: true,
        lessonId: true,
        createdAt: true,
      },
    });
    return row ? this.forRow(row) : null;
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
  }): Promise<void> {
    await this.prisma.material.create({
      data: {
        id: material.id,
        name: material.name,
        type: material.type as MaterialType,
        url: material.url,
        sizeBytes: BigInt(material.sizeBytes),
        courseId: material.courseId ?? null,
        moduleId: material.moduleId ?? null,
        lessonId: material.lessonId ?? null,
      },
    } as Prisma.MaterialCreateArgs);
  }
  async remove(id: string): Promise<void> {
    await this.prisma.material.delete({ where: { id } }).catch((e: unknown) => {
      if (
        e instanceof Prisma.PrismaClientKnownRequestError &&
        e.code === 'P2025'
      ) {
        throw new NotFoundError('Material nao encontrado');
      }
      throw e;
    });
  }
}
