import { Injectable } from '@nestjs/common';
import { PrismaService } from '../../../../shared/database/prisma.service.js';
import {
  CourseResumo,
  PublicStats,
  MentorLinkReader,
  MentorLinkWriter,
} from '../../domain/repositories.js';
import { rowForResumo } from './prisma-course.repository.js';
import { Prisma } from '../../../../generated/prisma/client.js';
import {
  ConflictError,
  NotFoundError,
} from '../../../../shared/errors/domain.errors.js';
@Injectable()
export class PrismaMentorLinkRepository
  implements MentorLinkReader, MentorLinkWriter
{
  constructor(private readonly prisma: PrismaService) {}
  async coursesDoMentor(mentorId: string): Promise<CourseResumo[]> {
    const rows = await this.prisma.course.findMany({
      where: { mentors: { some: { mentorId } } },
      orderBy: { updatedAt: 'desc' },
      select: {
        id: true,
        title: true,
        slug: true,
        track: true,
        description: true,
        status: true,
        coverUrl: true,
        featured: true,
        order: true,
        _count: { select: { modules: true, enrollments: true } },
      },
    });
    return rows.map(rowForResumo);
  }
  async linkExiste(mentorId: string, courseId: string): Promise<boolean> {
    const link = await this.prisma.courseMentor.findFirst({
      where: { mentorId, courseId },
      select: { courseId: true },
    });
    return link !== null;
  }
  async estatisticasByCourse(
    mentorId: string,
  ): Promise<Record<string, PublicStats>> {
    const courses = await this.coursesDoMentor(mentorId);
    const stats: Record<string, PublicStats> = {};
    for (const c of courses) {
      stats[c.id] = { totalLessons: 0, lessonsPublicadas: 0 };
    }
    if (courses.length === 0) return stats;
    const ids = courses.map((c) => c.id);
    const byCourse = await this.prisma.module.findMany({
      where: { courseId: { in: ids } },
      select: {
        id: true,
        courseId: true,
        lessons: { select: { id: true, status: true } },
      },
    });
    for (const m of byCourse) {
      const alvo = stats[m.courseId];
      if (!alvo) continue;
      alvo.totalLessons += m.lessons.length;
      alvo.lessonsPublicadas += m.lessons.filter(
        (l) => l.status === 'PUBLISHED',
      ).length;
    }
    return stats;
  }
  async link(
    courseId: string,
    mentorId: string,
    role: 'AUTHOR' | 'COAUTHOR',
  ): Promise<void> {
    try {
      await this.prisma.courseMentor.create({
        data: { courseId, mentorId, role },
      });
    } catch (e) {
      if (
        e instanceof Prisma.PrismaClientKnownRequestError &&
        e.code === 'P2002'
      ) {
        throw new ConflictError('Mentor ja vinculado a este curso');
      }
      if (
        e instanceof Prisma.PrismaClientKnownRequestError &&
        e.code === 'P2003'
      ) {
        throw new NotFoundError('Curso ou mentor inexistente');
      }
      throw e;
    }
  }
  async unlink(courseId: string, mentorId: string): Promise<void> {
    await this.prisma.courseMentor
      .delete({ where: { courseId_mentorId: { courseId, mentorId } } })
      .catch((e: unknown) => {
        if (
          e instanceof Prisma.PrismaClientKnownRequestError &&
          e.code === 'P2025'
        ) {
          throw new NotFoundError('Vinculo nao encontrado');
        }
        throw e;
      });
  }
}
