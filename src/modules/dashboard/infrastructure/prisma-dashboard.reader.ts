import { Injectable } from '@nestjs/common';
import { PrismaService } from '../../../shared/database/prisma.service.js';
import type {
  CoursePopular,
  AttentionCounts,
  DashboardReader,
  RevenueByPlan,
} from '../domain/ports.js';
const DayMS = 86400000;
@Injectable()
export class PrismaDashboardReader implements DashboardReader {
  constructor(private readonly prisma: PrismaService) {}
  async studentsActiveWithSubscription(): Promise<number> {
    return this.prisma.user.count({
      where: {
        role: 'STUDENT',
        active: true,
        subscription: {
          OR: [
            { status: 'ACTIVE' },
            {
              status: 'CANCELED',
              currentPeriodEnd: { gt: new Date() },
            },
          ],
        },
      },
    });
  }
  async mrrCents(): Promise<number> {
    const agg = await this.prisma.subscription.aggregate({
      where: { status: 'ACTIVE' },
      _sum: { priceCents: true },
    });
    return agg._sum.priceCents ?? 0;
  }
  async enrollmentsSince(startsAt: Date): Promise<number> {
    return this.prisma.enrollment.count({
      where: { createdAt: { gte: startsAt } },
    });
  }
  async endedSubscriptionsSince(startsAt: Date): Promise<number> {
    return this.prisma.subscription.count({
      where: {
        status: { in: ['CANCELED', 'EXPIRED'] },
        updatedAt: { gte: startsAt },
      },
    });
  }
  async enrollmentsByMonth(
    months: number,
    until: Date,
  ): Promise<
    {
      month: string;
      total: number;
    }[]
  > {
    const startsAt = new Date(until.getTime() - months * 31 * DayMS);
    const rows = await this.prisma.$queryRaw<
      {
        month: string;
        total: number;
      }[]
    >`
      SELECT to_char(date_trunc('month', "createdAt"), 'YYYY-MM') AS month,
             count(*)::int AS total
      FROM "Enrollment"
      WHERE "createdAt" >= ${startsAt}
      GROUP BY 1
      ORDER BY 1
    `;
    return rows;
  }
  async revenueByPlan(): Promise<RevenueByPlan[]> {
    const grupos = await this.prisma.subscription.groupBy({
      by: ['planId'],
      where: { status: 'ACTIVE' },
      _sum: { priceCents: true },
    });
    const plans = await this.prisma.plan.findMany({
      where: { id: { in: grupos.map((g) => g.planId) } },
      select: { id: true, name: true },
    });
    const names = new Map(plans.map((p) => [p.id, p.name]));
    return grupos
      .map((g) => ({
        plan: names.get(g.planId) ?? '—',
        amountCents: g._sum.priceCents ?? 0,
      }))
      .sort((a, b) => b.amountCents - a.amountCents);
  }
  async popularCourses(limit: number): Promise<CoursePopular[]> {
    const rows = await this.prisma.$queryRaw<CoursePopular[]>`
      SELECT c."title" AS "title",
             count(e."id")::int AS "students",
             COALESCE(floor(avg(e."progressPercent"))::int, 0) AS "completionPercent",
             COALESCE(sum(CASE WHEN a."status" = 'ACTIVE' THEN a."priceCents" ELSE 0 END)::int, 0) AS "revenueCents"
      FROM "Course" c
      LEFT JOIN "Enrollment" e ON e."courseId" = c."id"
      LEFT JOIN "User" u ON u."id" = e."studentId"
      LEFT JOIN "Subscription" a ON a."userId" = u."id"
      WHERE c."status" = 'PUBLISHED'
      GROUP BY c."id", c."title"
      ORDER BY count(e."id")::int DESC
      LIMIT ${limit}
    `;
    return rows;
  }
  async attentionCounts(): Promise<AttentionCounts> {
    const [contentInReview, openReports, draftCourses, mentorsPending] =
      await this.prisma.$transaction([
        this.prisma.lesson.count({ where: { status: 'IN_REVIEW' } }),
        this.prisma.report.count({ where: { status: 'IN_ANALYSIS' } }),
        this.prisma.course.count({ where: { status: 'DRAFT' } }),
        this.prisma.user.count({ where: { mentorStatus: 'PENDING' } }),
      ]);
    return {
      contentInReview,
      openReports,
      draftCourses,
      mentorsPending,
    };
  }
}
