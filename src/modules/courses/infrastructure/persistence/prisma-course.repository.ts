import { Injectable } from '@nestjs/common';
import { PrismaService } from '../../../../shared/database/prisma.service.js';
import { Course } from '../../domain/entities/course.entity.js';
import type { ContentBlock } from '../../domain/rich-content.vo.js';
import {
  LessonEmCurriculum,
  CourseFilter,
  CourseReader,
  CourseResumo,
  CourseWriter,
} from '../../domain/repositories.js';
import { Prisma } from '../../../../generated/prisma/client.js';
import { skipTake } from '../../../../shared/pagination/pagination.js';
import {
  ConflictError,
  NotFoundError,
} from '../../../../shared/errors/domain.errors.js';
const FieldsCourse = {
  id: true,
  title: true,
  slug: true,
  track: true,
  description: true,
  status: true,
  coverUrl: true,
  featured: true,
  order: true,
} satisfies Prisma.CourseSelect;
type CourseRow = Prisma.CourseGetPayload<{
  select: typeof FieldsCourse;
}>;
function rowForCourse(row: CourseRow): Course {
  return Course.reconstituir({
    id: row.id,
    title: row.title,
    slug: row.slug,
    track: row.track,
    description: row.description,
    status: row.status as 'PUBLISHED' | 'DRAFT',
    coverUrl: row.coverUrl,
    featured: row.featured,
    order: row.order,
  });
}
type RowWithCounts = CourseRow & {
  _count?: {
    modules?: number;
    enrollments?: number;
  };
  modules?: {
    lessons: unknown[];
  }[];
};
export function rowForResumo(row: RowWithCounts): CourseResumo {
  return {
    id: row.id,
    title: row.title,
    slug: row.slug,
    track: row.track,
    description: row.description,
    status: row.status,
    coverUrl: row.coverUrl,
    featured: row.featured,
    order: row.order,
    totalModules: row._count?.modules ?? row.modules?.length ?? 0,
    totalLessons:
      row.modules?.reduce((acc, m) => acc + m.lessons.length, 0) ?? 0,
    totalStudents: row._count?.enrollments ?? 0,
  };
}
@Injectable()
export class PrismaCourseRepository implements CourseReader, CourseWriter {
  constructor(private readonly prisma: PrismaService) {}
  async list(filter: CourseFilter): Promise<{
    courses: CourseResumo[];
    total: number;
  }> {
    const onde: Prisma.CourseWhereInput = {
      ...(filter.status
        ? { status: filter.status as Prisma.EnumCourseStatusFilter }
        : {}),
      ...(filter.track ? { track: filter.track } : {}),
      ...(filter.search
        ? {
            OR: [
              { title: { contains: filter.search, mode: 'insensitive' } },
              { description: { contains: filter.search, mode: 'insensitive' } },
            ],
          }
        : {}),
    };
    const [total, rows] = await this.prisma.$transaction([
      this.prisma.course.count({ where: onde }),
      this.prisma.course.findMany({
        where: onde,
        orderBy: [{ featured: 'desc' }, { order: 'asc' }],
        ...skipTake(filter),
        select: {
          ...FieldsCourse,
          _count: { select: { modules: true, enrollments: true } },
          modules: { select: { lessons: { select: { id: true } } } },
        },
      }),
    ]);
    return { courses: rows.map(rowForResumo), total };
  }
  async byId(id: string): Promise<Course | null> {
    const row = await this.prisma.course.findUnique({
      where: { id },
      select: FieldsCourse,
    });
    return row ? rowForCourse(row) : null;
  }
  async bySlug(slug: string): Promise<Course | null> {
    const row = await this.prisma.course.findUnique({
      where: { slug },
      select: FieldsCourse,
    });
    return row ? rowForCourse(row) : null;
  }
  async curriculum(
    courseId: string,
    onlyPublicadas: boolean,
  ): Promise<LessonEmCurriculum[]> {
    const lessons = await this.prisma.lesson.findMany({
      where: {
        module: { courseId },
        ...(onlyPublicadas ? { status: 'PUBLISHED' } : {}),
      },
      orderBy: [{ module: { order: 'asc' } }, { order: 'asc' }],
      select: {
        id: true,
        order: true,
        type: true,
        title: true,
        status: true,
        contentUrl: true,
        text: true,
        blocks: true,
        durationSeconds: true,
        sentForReviewAt: true,
        moduleId: true,
        module: { select: { order: true, title: true } },
      },
    });
    return lessons.map((a) => ({
      moduleId: a.moduleId,
      moduleOrder: a.module.order,
      moduleTitle: a.module.title,
      lessonId: a.id,
      lessonOrder: a.order,
      type: a.type,
      title: a.title,
      status: a.status,
      contentUrl: a.contentUrl,
      text: a.text,
      blocks: (a.blocks as ContentBlock[] | null) ?? null,
      durationSeconds: a.durationSeconds,
      sentForReviewAt: a.sentForReviewAt,
    }));
  }
  async temLessonPublicada(courseId: string): Promise<boolean> {
    const count = await this.prisma.lesson.count({
      where: { module: { courseId }, status: 'PUBLISHED' },
    });
    return count > 0;
  }
  async tracks(): Promise<string[]> {
    const rows = await this.prisma.course.findMany({
      where: { status: 'PUBLISHED', track: { not: null } },
      select: { track: true },
      distinct: ['track'],
    });
    return rows.map((l) => l.track).filter((t): t is string => Boolean(t));
  }
  async create(course: Course): Promise<void> {
    try {
      await this.prisma.course.create({
        data: {
          id: course.id,
          title: course.title,
          slug: course.slug,
          track: course.track,
          description: course.description,
          status: course.status,
          coverUrl: course.coverUrl,
          featured: course.featured,
          order: course.order,
        },
      });
    } catch (e) {
      if (
        e instanceof Prisma.PrismaClientKnownRequestError &&
        e.code === 'P2002'
      ) {
        throw new ConflictError('Ja existe um curso com este slug');
      }
      throw e;
    }
  }
  async save(course: Course): Promise<void> {
    try {
      await this.prisma.course.update({
        where: { id: course.id },
        data: {
          title: course.title,
          slug: course.slug,
          track: course.track,
          description: course.description,
          status: course.status,
          coverUrl: course.coverUrl,
          featured: course.featured,
          order: course.order,
        },
      });
    } catch (e) {
      if (
        e instanceof Prisma.PrismaClientKnownRequestError &&
        e.code === 'P2025'
      ) {
        throw new NotFoundError('Curso nao encontrado');
      }
      throw e;
    }
  }
}
