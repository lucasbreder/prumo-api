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
export interface DashboardReader {
  studentsActiveWithSubscription(): Promise<number>;
  mrrCents(): Promise<number>;
  enrollmentsSince(startsAt: Date): Promise<number>;
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
