import { randomUUID } from 'node:crypto';
import { Thread } from '../../domain/entities/thread.entity.js';
import { Report, ReportDecision } from '../../domain/entities/report.entity.js';
import {
  ReportReader,
  ReportWriter,
  ReactionReader,
  ReactionWriter,
  CommunityRulesRepository,
  ReplyWriter,
  ThreadReader,
  ThreadWriter,
} from '../../domain/repositories.js';
import {
  AccessDeniedError,
  NotFoundError,
} from '../../../../shared/errors/domain.errors.js';
import { Clock } from '../../../../shared/domain/clock.js';
import type { Role } from '../../../../shared/domain/role.js';
export interface BanUser {
  ban(userId: string): Promise<void>;
}
export interface CommunityDeps {
  threads: ThreadReader & ThreadWriter;
  reactions: ReactionReader & ReactionWriter;
  replies: ReplyWriter;
  reports: ReportReader & ReportWriter;
  rules: CommunityRulesRepository;
  banUser?: BanUser;
  clock: Clock;
}
export class CreateThreadUseCase {
  constructor(private readonly deps: CommunityDeps) {}
  async execute(input: {
    authorId: string;
    authorRole: Role;
    category: string;
    content: string;
  }) {
    const publicadaDirect = input.authorRole !== 'STUDENT';
    const thread = Thread.create({
      id: randomUUID(),
      authorId: input.authorId,
      category: input.category,
      content: input.content,
      publicadaDirect,
    });
    await this.deps.threads.create(thread);
    return { id: thread.id, status: thread.status };
  }
}
export class ListThreadsUseCase {
  constructor(private readonly deps: CommunityDeps) {}
  async execute(filter: {
    status?: Thread['status'];
    category?: string;
    page: number;
    perPage: number;
    userId?: string;
    replyStatuses?: Thread['status'][];
  }) {
    const { threads, total } = await this.deps.threads.list(filter);
    return {
      items: threads.map((t) => ({
        id: t.thread.id,
        category: t.thread.category,
        content: t.thread.content,
        status: t.thread.status,
        likeCount: t.thread.likeCount,
        replyCount: t.thread.replyCount,
        pinned: t.thread.pinned,
        createdAt: t.thread.createdAt.toISOString(),
        author: {
          id: t.thread.authorId,
          name: t.authorName,
          role: t.authorRole,
        },
        liked: t.hasUserReaction,
        openReports: t.openReports,
        replies: t.replies.map((r) => ({
          id: r.id,
          content: r.content,
          status: r.status,
          createdAt: r.createdAt.toISOString(),
          author: {
            id: r.author.id,
            name: r.author.name,
            role: r.author.role,
          },
        })),
      })),
      meta: {
        page: filter.page,
        perPage: filter.perPage,
        total,
        totalPages: Math.max(1, Math.ceil(total / filter.perPage)),
      },
    };
  }
}
export class ReactThreadUseCase {
  constructor(private readonly deps: CommunityDeps) {}
  async execute(input: { userId: string; threadId: string }) {
    const thread = await this.deps.threads.byId(input.threadId);
    if (!thread) throw new NotFoundError('Publicacao nao encontrada');
    if (thread.status !== 'PUBLISHED') {
      throw new AccessDeniedError('NaoCurta conteudo indisponivel');
    }
    const alreadyLiked = await this.deps.reactions.existe(
      input.threadId,
      input.userId,
    );
    if (alreadyLiked) {
      await this.deps.reactions.remove(input.threadId, input.userId);
      thread.registerReaction(false);
    } else {
      await this.deps.reactions.add(input.threadId, input.userId);
      thread.registerReaction(true);
    }
    await this.deps.threads.save(thread);
    return { liked: !alreadyLiked, likeCount: thread.likeCount };
  }
}
export class ResponderThreadUseCase {
  constructor(private readonly deps: CommunityDeps) {}
  async execute(input: {
    authorId: string;
    authorRole: Role;
    threadId: string;
    content: string;
  }) {
    const thread = await this.deps.threads.byId(input.threadId);
    if (!thread) throw new NotFoundError('Publicacao nao encontrada');
    if (!thread.aceitaReply) {
      throw new AccessDeniedError('Esta discussao esta fechada para respostas');
    }
    await this.deps.replies.create({
      id: randomUUID(),
      threadId: thread.id,
      authorId: input.authorId,
      content: input.content,
      publicadaDirect: input.authorRole !== 'STUDENT',
    });
    thread.registerReply();
    await this.deps.threads.save(thread);
    return { replyCount: thread.replyCount };
  }
}
export class ReportThreadUseCase {
  constructor(private readonly deps: CommunityDeps) {}
  async execute(input: { userId: string; threadId: string; reason: string }) {
    const thread = await this.deps.threads.byId(input.threadId);
    if (!thread) throw new NotFoundError('Publicacao nao encontrada');
    const report = Report.create({
      id: randomUUID(),
      threadId: thread.id,
      reporterId: input.userId,
      reason: input.reason,
    });
    await this.deps.reports.create(report);
    return { id: report.id, status: report.status };
  }
}
export class ModerateThreadUseCase {
  constructor(private readonly deps: CommunityDeps) {}
  async execute(input: {
    threadId: string;
    action: 'APPROVE' | 'PUBLISH' | 'HIDE' | 'PIN';
  }) {
    const thread = await this.deps.threads.byId(input.threadId);
    if (!thread) throw new NotFoundError('Publicacao nao encontrada');
    switch (input.action) {
      case 'APPROVE':
      case 'PUBLISH':
        thread.publish();
        break;
      case 'HIDE':
        thread.hide();
        break;
      case 'PIN':
        thread.togglePinned();
        break;
    }
    await this.deps.threads.save(thread);
    return { id: thread.id, status: thread.status, pinned: thread.pinned };
  }
}
export class ResolveReportUseCase {
  constructor(private readonly deps: CommunityDeps) {}
  async execute(input: { reportId: string; decision: ReportDecision }) {
    const report = await this.deps.reports.byId(input.reportId);
    if (!report) throw new NotFoundError('Denuncia nao encontrada');
    const thread = await this.deps.threads.byId(report.threadId);
    if (!thread) throw new NotFoundError('Publicacao original nao encontrada');
    report.resolve(input.decision, this.deps.clock.now());
    if (input.decision === 'REMOVE' || input.decision === 'BAN_AUTHOR') {
      thread.hide();
      await this.deps.threads.save(thread);
    }
    if (input.decision === 'BAN_AUTHOR') {
      if (!this.deps.banUser) {
        throw new AccessDeniedError('Action de banimento indisponivel');
      }
      await this.deps.banUser.ban(thread.authorId);
    }
    await this.deps.reports.save(report);
    return {
      id: report.id,
      status: report.status,
      decision: report.decision,
      threadOcultada: input.decision !== 'IGNORE',
    };
  }
}
export class GetReportsKpisUseCase {
  constructor(private readonly deps: CommunityDeps) {}
  async execute() {
    return this.deps.reports.kpis();
  }
}
export class GetRulesUseCase {
  constructor(private readonly deps: CommunityDeps) {}
  async execute() {
    return { rules: await this.deps.rules.get() };
  }
}
export class SaveRulesUseCase {
  constructor(private readonly deps: CommunityDeps) {}
  async execute(rules: { text: string[] }) {
    await this.deps.rules.save(rules);
    return { rules };
  }
}
