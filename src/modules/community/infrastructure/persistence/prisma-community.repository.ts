import { Injectable } from '@nestjs/common';
import { PrismaService } from '../../../../shared/database/prisma.service.js';
import { Thread } from '../../domain/entities/thread.entity.js';
import { Report } from '../../domain/entities/report.entity.js';
import type {
  ReportReader,
  ReportWriter,
  ReactionReader,
  ReactionWriter,
  CommunityRules,
  CommunityRulesRepository,
  ReplyWriter,
  ThreadListada,
  ThreadReader,
  ThreadWriter,
} from '../../domain/repositories.js';
import { Prisma } from '../../../../generated/prisma/client.js';
import { skipTake } from '../../../../shared/pagination/pagination.js';
import { NotFoundError } from '../../../../shared/errors/domain.errors.js';
const THREAD_FIELDS = {
  id: true,
  authorId: true,
  category: true,
  content: true,
  status: true,
  likeCount: true,
  replyCount: true,
  pinned: true,
  createdAt: true,
} satisfies Prisma.ThreadSelect;
function rowForThread(
  row: Prisma.ThreadGetPayload<{
    select: typeof THREAD_FIELDS;
  }>,
): Thread {
  return Thread.reconstituir({
    id: row.id,
    authorId: row.authorId,
    category: row.category,
    content: row.content,
    status: row.status as 'PUBLISHED' | 'PENDING' | 'HIDDEN',
    likeCount: row.likeCount,
    replyCount: row.replyCount,
    pinned: row.pinned,
    createdAt: row.createdAt,
  });
}
function threadForEscritura(thread: Thread) {
  return {
    category: thread.category,
    content: thread.content,
    status: thread.status,
    likeCount: thread.likeCount,
    replyCount: thread.replyCount,
    pinned: thread.pinned,
  };
}
@Injectable()
export class PrismaThreadRepository implements ThreadReader, ThreadWriter {
  constructor(private readonly prisma: PrismaService) {}
  async list(filter: {
    status?: Thread['status'];
    category?: string;
    page: number;
    perPage: number;
    userId?: string;
    replyStatuses?: Thread['status'][];
  }): Promise<{
    threads: ThreadListada[];
    total: number;
  }> {
    const onde: Prisma.ThreadWhereInput = {
      ...(filter.status ? { status: filter.status } : {}),
      ...(filter.category ? { category: filter.category } : {}),
    };
    const [total, rows] = await this.prisma.$transaction([
      this.prisma.thread.count({ where: onde }),
      this.prisma.thread.findMany({
        where: onde,
        orderBy: [{ pinned: 'desc' }, { createdAt: 'desc' }],
        ...skipTake(filter),
        select: {
          ...THREAD_FIELDS,
          author: { select: { name: true, role: true } },
          reports: { where: { status: 'IN_ANALYSIS' }, select: { id: true } },
          replies: {
            where: {
              status: {
                in: filter.replyStatuses ?? ['PUBLISHED'],
              },
            },
            orderBy: { createdAt: 'asc' },
            select: {
              id: true,
              content: true,
              status: true,
              createdAt: true,
              author: { select: { id: true, name: true, role: true } },
            },
          },
          ...(filter.userId
            ? {
                reactions: {
                  where: { userId: filter.userId },
                  select: { id: true },
                },
              }
            : {}),
        } as Prisma.ThreadSelect,
      }),
    ]);
    return {
      total,
      threads: rows.map((l) => ({
        thread: rowForThread(l),
        authorName: l.author.name,
        authorRole: l.author.role as 'STUDENT' | 'MENTOR' | 'ADMIN',
        hasUserReaction:
          ((
            l as unknown as {
              reactions?: {
                id: string;
              }[];
            }
          ).reactions?.length ?? 0) > 0,
        openReports: l.reports.length,
        replies: (
          (
            l as unknown as {
              replies?: {
                id: string;
                content: string;
                status: string;
                createdAt: Date;
                author: { id: string; name: string; role: string };
              }[];
            }
          ).replies ?? []
        ).map((r) => ({
          id: r.id,
          content: r.content,
          status: r.status as Thread['status'],
          createdAt: r.createdAt,
          author: {
            id: r.author.id,
            name: r.author.name,
            role: r.author.role as 'STUDENT' | 'MENTOR' | 'ADMIN',
          },
        })),
      })),
    };
  }
  async byId(id: string): Promise<Thread | null> {
    const row = await this.prisma.thread.findUnique({
      where: { id },
      select: THREAD_FIELDS,
    });
    return row ? rowForThread(row) : null;
  }
  async create(thread: Thread): Promise<void> {
    await this.prisma.thread.create({
      data: {
        id: thread.id,
        authorId: thread.authorId,
        ...threadForEscritura(thread),
      },
    });
  }
  async save(thread: Thread): Promise<void> {
    await this.prisma.thread.update({
      where: { id: thread.id },
      data: threadForEscritura(thread),
    });
  }
}
@Injectable()
export class PrismaReactionRepository
  implements ReactionReader, ReactionWriter
{
  constructor(private readonly prisma: PrismaService) {}
  async existe(threadId: string, userId: string): Promise<boolean> {
    const r = await this.prisma.reaction.findUnique({
      where: { threadId_userId: { threadId, userId } },
      select: { id: true },
    });
    return r !== null;
  }
  async add(threadId: string, userId: string): Promise<void> {
    await this.prisma.reaction.create({ data: { threadId, userId } });
  }
  async remove(threadId: string, userId: string): Promise<void> {
    await this.prisma.reaction.deleteMany({ where: { threadId, userId } });
  }
}
@Injectable()
export class PrismaReplyRepository implements ReplyWriter {
  constructor(private readonly prisma: PrismaService) {}
  async create(reply: {
    id: string;
    threadId: string;
    authorId: string;
    content: string;
    publicadaDirect: boolean;
  }): Promise<void> {
    await this.prisma.reply.create({
      data: {
        id: reply.id,
        threadId: reply.threadId,
        authorId: reply.authorId,
        content: reply.content,
        status: reply.publicadaDirect ? 'PUBLISHED' : 'PENDING',
      },
    });
  }
}
@Injectable()
export class PrismaReportRepository implements ReportReader, ReportWriter {
  constructor(private readonly prisma: PrismaService) {}
  async byId(id: string): Promise<Report | null> {
    const row = await this.prisma.report.findUnique({
      where: { id },
      select: {
        id: true,
        threadId: true,
        reporterId: true,
        reason: true,
        status: true,
        decision: true,
        resolvedAt: true,
        createdAt: true,
      },
    });
    return row
      ? Report.reconstituir({
          ...row,
          status: row.status as 'IN_ANALYSIS' | 'RESOLVED',
          decision: row.decision as 'REMOVE' | 'IGNORE' | 'BAN_AUTHOR' | null,
        })
      : null;
  }
  async list(filter: {
    status?: 'IN_ANALYSIS' | 'RESOLVED';
    page: number;
    perPage: number;
  }) {
    const onde: Prisma.ReportWhereInput = filter.status
      ? { status: filter.status }
      : {};
    const [total, rows] = await this.prisma.$transaction([
      this.prisma.report.count({ where: onde }),
      this.prisma.report.findMany({
        where: onde,
        orderBy: { createdAt: 'desc' },
        ...skipTake(filter),
        select: {
          id: true,
          threadId: true,
          reporterId: true,
          reason: true,
          status: true,
          decision: true,
          resolvedAt: true,
          createdAt: true,
          thread: { select: { id: true, content: true, authorId: true } },
        },
      }),
    ]);
    return {
      total,
      reports: rows.map((l) => ({
        row: Report.reconstituir({
          id: l.id,
          threadId: l.threadId,
          reporterId: l.reporterId,
          reason: l.reason,
          status: l.status as 'IN_ANALYSIS' | 'RESOLVED',
          decision: l.decision as 'REMOVE' | 'IGNORE' | 'BAN_AUTHOR' | null,
          resolvedAt: l.resolvedAt,
          createdAt: l.createdAt,
        }),
        thread: {
          id: l.thread.id,
          content: l.thread.content,
          authorId: l.thread.authorId,
          reportsCount: 1,
        },
      })),
    };
  }
  async kpis() {
    const [openCount, resolved, authors] = await Promise.all([
      this.prisma.report.count({ where: { status: 'IN_ANALYSIS' } }),
      this.prisma.report.count({ where: { status: 'RESOLVED' } }),
      this.prisma.report.findMany({
        where: { status: 'IN_ANALYSIS' },
        select: { thread: { select: { authorId: true } } },
      }),
    ]);
    return {
      openReports: openCount,
      resolved,
      authorsInAnalysis: new Set(authors.map((a) => a.thread.authorId)).size,
    };
  }
  async create(report: Report): Promise<void> {
    await this.prisma.report.create({
      data: {
        id: report.id,
        threadId: report.threadId,
        reporterId: report.reporterId,
        reason: report.reason,
      },
    });
  }
  async save(report: Report): Promise<void> {
    try {
      await this.prisma.report.update({
        where: { id: report.id },
        data: {
          status: report.status,
          decision: report.decision,
          ...(report.status === 'RESOLVED' ? { resolvedAt: new Date() } : {}),
        },
      });
    } catch (e) {
      if (
        e instanceof Prisma.PrismaClientKnownRequestError &&
        e.code === 'P2025'
      ) {
        throw new NotFoundError('Denuncia nao encontrada');
      }
      throw e;
    }
  }
}
@Injectable()
export class PrismaCommunityRulesRepository implements CommunityRulesRepository {
  constructor(private readonly prisma: PrismaService) {}
  async get(): Promise<CommunityRules> {
    const rows = await this.prisma.communityRule.findMany({
      orderBy: { order: 'asc' },
      select: { text: true },
    });
    return { text: rows.map((l) => l.text) };
  }
  async save(rules: CommunityRules): Promise<void> {
    await this.prisma.$transaction([
      this.prisma.communityRule.deleteMany(),
      this.prisma.communityRule.createMany({
        data: rules.text.map((text, i) => ({ order: i + 1, text })),
      }),
    ]);
  }
}
