export const DASHBOARDReader = 'DASHBOARD_LEITOR' as const;
export interface RevenueByPlan {
  plan: string;
  amountCents: number;
}
export interface CoursePopular {
  title: string;
  students: number;
  completionPercent: number;
  revenueCents: number;
}
export interface AttentionCounts {
  contentInReview: number;
  openReports: number;
  draftCourses: number;
  mentorsPending: number;
}
export interface BillingSeriesPoint {
  // 'YYYY-MM'
  month: string;
  // Ja faturado ate hoje (cobrancas com data <= hoje).
  actualCents: number;
  // Faturamento previsto no periodo (inclui meses futuros).
  projectedCents: number;
}
export interface BillingSummary {
  // Opcao 1: valor das assinaturas contratadas (iniciadas) no periodo.
  contractedCents: number;
  // Opcao 2: faturamento recorrente dentro do periodo (por ciclo).
  recurringCents: number;
  series: BillingSeriesPoint[];
}
export interface DashboardReader {
  studentsActiveWithSubscription(): Promise<number>;
  // Recorrencia mensal (MRR) das assinaturas ativas, com planos anuais
  // normalizados para o equivalente mensal (valor do ano / 12).
  mrrCents(): Promise<number>;
  billingSummary(from: Date, to: Date, current: Date): Promise<BillingSummary>;
  enrollmentsBetween(from: Date, to: Date): Promise<number>;
  endedSubscriptionsSince(startsAt: Date): Promise<number>;
  enrollmentsByMonth(
    months: number,
    until: Date,
  ): Promise<
    {
      month: string;
      total: number;
    }[]
  >;
  revenueByPlan(): Promise<RevenueByPlan[]>;
  popularCourses(limit: number): Promise<CoursePopular[]>;
  attentionCounts(): Promise<AttentionCounts>;
}
