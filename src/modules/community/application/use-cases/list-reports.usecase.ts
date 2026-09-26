import type { ReportReader } from '../../domain/repositories.js';
export class ListReportsUseCase {
  constructor(
    private readonly deps: {
      reports: ReportReader;
    },
  ) {}
  async execute(filter: {
    status?: 'IN_ANALYSIS' | 'RESOLVED';
    page: number;
    perPage: number;
  }) {
    const { reports, total } = await this.deps.reports.list(filter);
    return {
      items: reports.map(({ row: d, thread }) => ({
        id: d.id,
        reason: d.reason,
        status: d.status,
        decision: d.decision,
        createdAt: d.createdAt.toISOString(),
        thread: {
          id: thread.id,
          content: thread.content,
          authorId: thread.authorId,
        },
        reportsCount: thread.reportsCount,
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
