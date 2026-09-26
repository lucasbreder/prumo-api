import { Report } from '../../domain/entities/report.entity.js';
import { Thread } from '../../domain/entities/thread.entity.js';
import type {
  ReportReader,
  ReportWriter,
  ReactionReader,
  ReactionWriter,
  CommunityRules,
  CommunityRulesRepository,
  ReplyListada,
  ReplyWriter,
  ThreadListada,
  ThreadReader,
  ThreadWriter,
} from '../../domain/repositories.js';
export class FakeThreadRepo implements ThreadReader, ThreadWriter {
  threads = new Map<string, Thread>();
  repliesPorThread = new Map<string, ReplyListada[]>();
  async list(filter: {
    status?: Thread['status'];
    category?: string;
    page: number;
    perPage: number;
    replyStatuses?: Thread['status'][];
  }): Promise<{
    threads: ThreadListada[];
    total: number;
  }> {
    let items = [...this.threads.values()];
    if (filter.status) items = items.filter((t) => t.status === filter.status);
    if (filter.category)
      items = items.filter((t) => t.category === filter.category);
    const visiveis = filter.replyStatuses ?? ['PUBLISHED'];
    const startsAt = (filter.page - 1) * filter.perPage;
    return {
      threads: items.slice(startsAt, startsAt + filter.perPage).map((t) => ({
        thread: t,
        authorName: 'Autor Teste',
        authorRole: 'STUDENT' as const,
        hasUserReaction: false,
        openReports: 0,
        replies: (this.repliesPorThread.get(t.id) ?? []).filter((r) =>
          visiveis.includes(r.status),
        ),
      })),
      total: items.length,
    };
  }
  async byId(id: string) {
    return this.threads.get(id) ?? null;
  }
  async create(thread: Thread) {
    this.threads.set(thread.id, thread);
  }
  async save(thread: Thread) {
    this.threads.set(thread.id, thread);
  }
}
export class FakeReactionRepo implements ReactionReader, ReactionWriter {
  pares = new Set<string>();
  chave(threadId: string, userId: string) {
    return `${threadId}:${userId}`;
  }
  async existe(threadId: string, userId: string) {
    return this.pares.has(this.chave(threadId, userId));
  }
  async add(threadId: string, userId: string) {
    this.pares.add(this.chave(threadId, userId));
  }
  async remove(threadId: string, userId: string) {
    this.pares.delete(this.chave(threadId, userId));
  }
}
export class FakeReplyRepo implements ReplyWriter {
  replies: unknown[] = [];
  async create(reply: unknown): Promise<void> {
    this.replies.push(reply);
  }
}
export class FakeReportRepo implements ReportReader, ReportWriter {
  reports = new Map<string, Report>();
  async byId(id: string) {
    return this.reports.get(id) ?? null;
  }
  async list(filter: {
    status?: 'IN_ANALYSIS' | 'RESOLVED';
    page: number;
    perPage: number;
  }) {
    let items = [...this.reports.values()];
    if (filter.status) items = items.filter((d) => d.status === filter.status);
    const thread = (id: string) => ({
      id,
      content: 'x',
      authorId: 'autor-1',
      reportsCount: 1,
    });
    return {
      reports: items.map((d) => ({ row: d, thread: thread(d.threadId) })),
      total: items.length,
    };
  }
  async kpis() {
    const openReports = [...this.reports.values()].filter(
      (d) => d.status === 'IN_ANALYSIS',
    );
    return {
      openReports: openReports.length,
      resolved: this.reports.size - openReports.length,
      authorsInAnalysis: new Set(openReports.map(() => 'author-1')).size,
    };
  }
  async create(report: Report) {
    this.reports.set(report.id, report);
  }
  async save(report: Report) {
    this.reports.set(report.id, report);
  }
}
export class FakeRulesRepo implements CommunityRulesRepository {
  rules: CommunityRules = { text: ['Respeito em primeiro lugar.'] };
  async get() {
    return this.rules;
  }
  async save(rules: CommunityRules) {
    this.rules = rules;
  }
}
export function banidorFake() {
  const banidos = new Set<string>();
  return {
    banidos,
    async ban(userId: string) {
      banidos.add(userId);
    },
  };
}
