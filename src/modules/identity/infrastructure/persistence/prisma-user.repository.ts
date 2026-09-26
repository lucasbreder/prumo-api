import { Injectable } from '@nestjs/common';
import { PrismaService } from '../../../../shared/database/prisma.service.js';
import { User } from '../../domain/entities/user.entity.js';
import type { SocialProvider } from '../../domain/entities/user.entity.js';
import {
  StudentFilter,
  StudentRow,
  StudentsReader,
  MentorReader,
  MentorAdminRow,
  MentorsAdminReader,
  UserReader,
  UserWriter,
} from '../../domain/repositories/user.repository.js';
import { rowForUser, userForEscritura } from '../mappers/user.mapper.js';
import { Prisma } from '../../../../generated/prisma/client.js';
import {
  ConflictError,
  NotFoundError,
} from '../../../../shared/errors/domain.errors.js';
import { skipTake } from '../../../../shared/pagination/pagination.js';
const SELECAOUser = {
  id: true,
  name: true,
  email: true,
  passwordHash: true,
  role: true,
  active: true,
  googleId: true,
  appleId: true,
  bio: true,
  avatarKey: true,
  areas: true,
  mentorFeatured: true,
  mentorStatus: true,
  lastAccessAt: true,
  notifLives: true,
  notifCommunity: true,
  notifSummary: true,
} satisfies Prisma.UserSelect;
export interface StudentConsulta {
  id: string;
  name: string;
  email: string;
  active: boolean;
  lastAccessAt: Date | null;
  subscription: {
    status: 'ACTIVE' | 'CANCELED' | 'EXPIRED';
    currentPeriodEnd: Date | null;
    plan: {
      id: string;
      name: string;
    } | null;
  } | null;
  enrollments: {
    progressPercent: number;
    course: {
      title: string;
    };
  }[];
}
export function deriveStudentStatus(
  row: Pick<StudentConsulta, 'active' | 'subscription'>,
  current: Date,
): StudentRow['status'] {
  if (!row.active) return 'PAUSED';
  const s = row.subscription;
  if (s?.status === 'ACTIVE') return 'ACTIVE';
  if (
    s?.status === 'CANCELED' &&
    s.currentPeriodEnd &&
    s.currentPeriodEnd.getTime() > current.getTime()
  ) {
    return 'ACTIVE';
  }
  return 'EXPIRED';
}
@Injectable()
export class PrismaUserRepository
  implements UserReader, UserWriter, StudentsReader, MentorReader, MentorsAdminReader
{
  constructor(private readonly prisma: PrismaService) {}
  async byId(id: string): Promise<User | null> {
    const row = await this.prisma.user.findUnique({
      where: { id },
      select: SELECAOUser,
    });
    return row ? rowForUser(row) : null;
  }
  async byEmail(email: string): Promise<User | null> {
    const row = await this.prisma.user.findUnique({
      where: { email: email.toLowerCase() },
      select: SELECAOUser,
    });
    return row ? rowForUser(row) : null;
  }
  async byProvider(
    provider: SocialProvider,
    providerId: string,
  ): Promise<User | null> {
    const row = await this.prisma.user.findUnique({
      where: provider === 'GOOGLE' ? { googleId: providerId } : { appleId: providerId },
      select: SELECAOUser,
    });
    return row ? rowForUser(row) : null;
  }
  async create(user: User): Promise<void> {
    try {
      await this.prisma.user.create({
        data: { id: user.id, ...userForEscritura(user) },
      });
    } catch (e) {
      if (
        e instanceof Prisma.PrismaClientKnownRequestError &&
        e.code === 'P2002'
      ) {
        throw new ConflictError('Ja existe uma conta com este e-mail');
      }
      throw e;
    }
  }
  async save(user: User): Promise<void> {
    try {
      await this.prisma.user.update({
        where: { id: user.id },
        data: userForEscritura(user),
      });
    } catch (e) {
      if (
        e instanceof Prisma.PrismaClientKnownRequestError &&
        e.code === 'P2025'
      ) {
        throw new NotFoundError('Conta nao encontrada');
      }
      throw e;
    }
  }
  async list(filter: StudentFilter): Promise<{
    rows: StudentRow[];
    total: number;
  }> {
    const onde: Prisma.UserWhereInput = {
      role: 'STUDENT',
      ...(filter.search
        ? {
            OR: [
              { name: { contains: filter.search, mode: 'insensitive' } },
              { email: { contains: filter.search, mode: 'insensitive' } },
            ],
          }
        : {}),
    };
    const current = new Date();
    const [total, rows] = await this.prisma.$transaction([
      this.prisma.user.count({ where: onde }),
      this.prisma.user.findMany({
        where: onde,
        orderBy: { name: 'asc' },
        ...skipTake(filter),
        select: {
          id: true,
          name: true,
          email: true,
          active: true,
          lastAccessAt: true,
          subscription: {
            select: {
              status: true,
              currentPeriodEnd: true,
              plan: { select: { id: true, name: true } },
            },
          },
          enrollments: {
            orderBy: { progressPercent: 'desc' },
            take: 1,
            select: {
              progressPercent: true,
              course: { select: { title: true } },
            },
          },
        },
      }),
    ]);
    return {
      total,
      rows: rows.map((l) => ({
        id: l.id,
        name: l.name,
        email: l.email,
        planId: l.subscription?.plan?.id ?? null,
        planName: l.subscription?.plan?.name ?? null,
        coursePrincipal: l.enrollments[0]?.course.title ?? null,
        progressPercent: l.enrollments[0]?.progressPercent ?? 0,
        lastAccessAt: l.lastAccessAt,
        status: deriveStudentStatus(
          { active: l.active, subscription: l.subscription },
          current,
        ),
      })),
    };
  }
  async listMentors(aprovadosOnly: boolean): Promise<User[]> {
    const rows = await this.prisma.user.findMany({
      where: {
        role: 'MENTOR',
        active: true,
        ...(aprovadosOnly ? { mentorStatus: 'APPROVED' } : {}),
      },
      orderBy: [{ mentorFeatured: 'desc' }, { name: 'asc' }],
      select: SELECAOUser,
    });
    return rows.map(rowForUser);
  }
  async countMentorsPending(): Promise<number> {
    return this.prisma.user.count({ where: { mentorStatus: 'PENDING' } });
  }
  async listAll(): Promise<MentorAdminRow[]> {
    const rows = await this.prisma.user.findMany({
      where: { role: 'MENTOR' },
      orderBy: [
        { mentorStatus: 'asc' },
        { mentorFeatured: 'desc' },
        { name: 'asc' },
      ],
      select: {
        id: true,
        name: true,
        email: true,
        areas: true,
        bio: true,
        mentorFeatured: true,
        mentorStatus: true,
        active: true,
        _count: { select: { mentoring: true } },
      },
    });
    return rows.map((r) => ({
      id: r.id,
      name: r.name,
      email: r.email,
      areas: r.areas,
      bio: r.bio,
      featured: r.mentorFeatured,
      status: r.mentorStatus as 'PENDING' | 'APPROVED' | 'REJECTED',
      active: r.active,
      coursesCount: r._count.mentoring,
    }));
  }
}
