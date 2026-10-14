import { describe, expect, it } from 'vitest';
import { GetDashboardUseCase } from './get-dashboard.usecase.js';
import type { DashboardReader } from '../domain/ports.js';
const reader: DashboardReader = {
  async studentsActiveWithSubscription() {
    return 120;
  },
  async mrrCents() {
    return 1200000;
  },
  async billingSummary() {
    return {
      contractedCents: 900000,
      recurringCents: 1400000,
      series: [
        { month: '2026-08', actualCents: 100000, projectedCents: 120000 },
        { month: '2026-09', actualCents: 140000, projectedCents: 160000 },
      ],
    };
  },
  async enrollmentsBetween() {
    return 34;
  },
  async endedSubscriptionsSince() {
    return 6;
  },
  async enrollmentsByMonth() {
    return [
      { month: '2026-08', total: 20 },
      { month: '2026-09', total: 14 },
    ];
  },
  async revenueByPlan() {
    return [
      { plan: 'Mensal', amountCents: 700000 },
      { plan: 'Anual', amountCents: 300000 },
      { plan: 'Equipes', amountCents: 200000 },
    ];
  },
  async popularCourses() {
    return [
      {
        title: 'Precificação',
        students: 90,
        completionPercent: 40,
        revenueCents: 800000,
      },
    ];
  },
  async attentionCounts() {
    return {
      contentInReview: 3,
      openReports: 2,
      draftCourses: 1,
      mentorsPending: 4,
    };
  },
};
describe('Dashboard', () => {
  it('consolida KPIs, percentuais e lista de atencao', async () => {
    const output = await new GetDashboardUseCase({
      reader,
    }).execute({
      current: new Date('2026-09-04T12:00:00.000Z'),
      from: new Date('2026-01-01T00:00:00.000Z'),
      to: new Date('2026-12-31T23:59:59.999Z'),
    });
    expect(output.kpis).toMatchObject({
      studentsActive: 120,
      mrrCents: 1200000,
      contractedRevenueCents: 900000,
      recurringRevenueCents: 1400000,
      newEnrollments: 34,
      // 6 encerradas / (120 + 6) base do inicio ~ 4%
      churn30dPercent: 5,
    });
    expect(output.billingSeries).toHaveLength(2);
    expect(output.revenueByPlan.map((r) => r.percent)).toEqual([58, 25, 16]);
    expect(output.enrollmentsByMonth).toHaveLength(2);
    expect(output.attention.priority).toBe('PENDING_MENTORS');
  });
  it('churn zero sem encerradas', async () => {
    const output = await new GetDashboardUseCase({
      reader: {
        ...reader,
        async endedSubscriptionsSince() {
          return 0;
        },
      },
    }).execute({
      current: new Date(),
      from: new Date('2026-01-01T00:00:00.000Z'),
      to: new Date('2026-12-31T23:59:59.999Z'),
    });
    expect(output.kpis.churn30dPercent).toBe(0);
  });
});
