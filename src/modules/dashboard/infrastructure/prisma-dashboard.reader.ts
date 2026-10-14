import { Injectable } from '@nestjs/common';
import { PrismaService } from '../../../shared/database/prisma.service.js';
import type {
  BillingSummary,
  CoursePopular,
  AttentionCounts,
  DashboardReader,
  RevenueByPlan,
} from '../domain/ports.js';
const DayMS = 86400000;
type Cycle = 'MONTHLY' | 'YEARLY' | 'TEAM';
// Valor de um ciclo expresso em base anual: planos anuais já são o valor do
// ano; os demais são multiplicados por 12 (mensal recorrente).
function valorAnualCents(priceCents: number, cycle: Cycle): number {
  return cycle === 'YEARLY' ? priceCents : priceCents * 12;
}
// Avanca `months` meses preservando o dia (clamp para o fim do mes).
function addMonths(base: Date, months: number): Date {
  const d = new Date(base);
  const day = d.getUTCDate();
  d.setUTCDate(1);
  d.setUTCMonth(d.getUTCMonth() + months);
  const lastDay = new Date(
    Date.UTC(d.getUTCFullYear(), d.getUTCMonth() + 1, 0),
  ).getUTCDate();
  d.setUTCDate(Math.min(day, lastDay));
  return d;
}
function monthKey(d: Date): string {
  return `${d.getUTCFullYear()}-${String(d.getUTCMonth() + 1).padStart(2, '0')}`;
}
function enumerateMonths(from: Date, to: Date): string[] {
  const out: string[] = [];
  const cur = new Date(Date.UTC(from.getUTCFullYear(), from.getUTCMonth(), 1));
  const end = new Date(Date.UTC(to.getUTCFullYear(), to.getUTCMonth(), 1));
  while (cur <= end) {
    out.push(monthKey(cur));
    cur.setUTCMonth(cur.getUTCMonth() + 1);
  }
  return out;
}
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
  // Assinaturas ativas com o ciclo do plano, para normalizar o valor anual.
  private async assinaturasAtivas() {
    return this.prisma.subscription.findMany({
      where: { status: 'ACTIVE' },
      select: {
        priceCents: true,
        plan: { select: { id: true, name: true, cycle: true } },
      },
    });
  }
  async mrrCents(): Promise<number> {
    const assinaturas = await this.assinaturasAtivas();
    const anual = assinaturas.reduce(
      (acc, a) => acc + valorAnualCents(a.priceCents, a.plan.cycle),
      0,
    );
    // MRR = volume anual / 12 (planos anuais entram pelo equivalente mensal).
    return Math.round(anual / 12);
  }
  // Faturamento do periodo: contratado (opcao 1), recorrente (opcao 2) e a
  // serie mensal de faturamento ja realizado x previsto.
  async billingSummary(
    from: Date,
    to: Date,
    current: Date,
  ): Promise<BillingSummary> {
    const assinaturas = await this.prisma.subscription.findMany({
      where: { plan: { is: { priceCents: { not: null } } } },
      select: {
        priceCents: true,
        status: true,
        startsAt: true,
        currentPeriodEnd: true,
        plan: { select: { cycle: true } },
      },
    });
    const contractedCents = assinaturas
      .filter((s) => s.startsAt >= from && s.startsAt <= to)
      .reduce((acc, s) => acc + s.priceCents, 0);
    const porMes = new Map<string, { actual: number; projected: number }>();
    let recurringCents = 0;
    for (const s of assinaturas) {
      const cycle = s.plan.cycle as Cycle;
      if (cycle !== 'MONTHLY' && cycle !== 'YEARLY') continue;
      // Assinatura cancelada/expirada so projeta ate o fim do periodo pago.
      const limite =
        s.status === 'ACTIVE'
          ? to
          : s.currentPeriodEnd
            ? new Date(Math.min(s.currentPeriodEnd.getTime(), to.getTime()))
            : new Date(0);
      const passo = cycle === 'YEARLY' ? 12 : 1;
      for (let k = 0; ; k++) {
        const d = addMonths(s.startsAt, k * passo);
        if (d > limite) break;
        if (d < from) continue;
        const ponto = porMes.get(monthKey(d)) ?? { actual: 0, projected: 0 };
        ponto.projected += s.priceCents;
        if (d <= current) ponto.actual += s.priceCents;
        porMes.set(monthKey(d), ponto);
        recurringCents += s.priceCents;
      }
    }
    return {
      contractedCents,
      recurringCents,
      series: enumerateMonths(from, to).map((month) => ({
        month,
        actualCents: porMes.get(month)?.actual ?? 0,
        projectedCents: porMes.get(month)?.projected ?? 0,
      })),
    };
  }
  async enrollmentsBetween(from: Date, to: Date): Promise<number> {
    return this.prisma.enrollment.count({
      where: { createdAt: { gte: from, lte: to } },
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
    // Mesma base do MRR: recorrência mensal por plano (anuais /12).
    const assinaturas = await this.assinaturasAtivas();
    const porPlano = new Map<string, number>();
    for (const a of assinaturas) {
      const mensal = Math.round(
        valorAnualCents(a.priceCents, a.plan.cycle) / 12,
      );
      porPlano.set(a.plan.name, (porPlano.get(a.plan.name) ?? 0) + mensal);
    }
    return [...porPlano.entries()]
      .map(([plan, amountCents]) => ({ plan, amountCents }))
      .sort((a, b) => b.amountCents - a.amountCents);
  }
  async popularCourses(limit: number): Promise<CoursePopular[]> {
    const rows = await this.prisma.$queryRaw<CoursePopular[]>`
      SELECT c."title" AS "title",
             count(e."id")::int AS "students",
             COALESCE(floor(avg(e."progressPercent"))::int, 0) AS "completionPercent",
             COALESCE(sum(CASE WHEN a."status" = 'ACTIVE'
                    THEN (CASE WHEN p."cycle" = 'YEARLY' THEN a."priceCents" / 12.0 ELSE a."priceCents" END)
                    ELSE 0 END)::int, 0) AS "revenueCents"
      FROM "Course" c
      LEFT JOIN "Enrollment" e ON e."courseId" = c."id"
      LEFT JOIN "User" u ON u."id" = e."studentId"
      LEFT JOIN "Subscription" a ON a."userId" = u."id"
      LEFT JOIN "Plan" p ON p."id" = a."planId"
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
