import type { DashboardReader } from '../domain/ports.js';
const Day = 86400000;
export class GetDashboardUseCase {
  constructor(
    private readonly deps: {
      reader: DashboardReader;
    },
  ) {}
  async execute(input: { current: Date }) {
    const start30d = new Date(input.current.getTime() - 30 * Day);
    const reader = this.deps.reader;
    const [
      studentsActive,
      mrrCents,
      newEnrollments30d,
      ended30d,
      enrollmentsByMonth,
      revenue,
      popularCourses,
      attention,
    ] = await Promise.all([
      reader.studentsActiveWithSubscription(),
      reader.mrrCents(),
      reader.enrollmentsSince(start30d),
      reader.endedSubscriptionsSince(start30d),
      reader.enrollmentsByMonth(6, input.current),
      reader.revenueByPlan(),
      reader.popularCourses(5),
      reader.attentionCounts(),
    ]);
    const baseStartsAt = studentsActive + ended30d;
    const churn30dPercent =
      baseStartsAt === 0 ? 0 : Math.round((ended30d / baseStartsAt) * 100);
    const totalRevenue = revenue.reduce((acc, r) => acc + r.amountCents, 0);
    const revenueByPlan = revenue.map((r) => ({
      plan: r.plan,
      amountCents: r.amountCents,
      percent:
        totalRevenue === 0
          ? 0
          : Math.floor((r.amountCents / totalRevenue) * 100),
    }));
    return {
      kpis: {
        studentsActive,
        mrrCents,
        newEnrollments30d,
        churn30dPercent,
      },
      enrollmentsByMonth,
      revenueByPlan,
      popularCourses,
      attention: {
        ...attention,
        priority: attentionPriority(attention),
      },
    };
  }
}
function attentionPriority(attention: {
  contentInReview: number;
  openReports: number;
  draftCourses: number;
  mentorsPending: number;
}): string | null {
  const names: Record<keyof typeof attention, string> = {
    contentInReview: 'CONTENT_IN_REVIEW',
    openReports: 'OPEN_REPORTS',
    draftCourses: 'DRAFT_COURSES',
    mentorsPending: 'PENDING_MENTORS',
  };
  const maxKey = (Object.keys(attention) as (keyof typeof attention)[]).reduce(
    (a, b) => (attention[b] > attention[a] ? b : a),
  );
  return attention[maxKey] > 0 ? names[maxKey] : null;
}
