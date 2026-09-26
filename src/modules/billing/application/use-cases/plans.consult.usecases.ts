import { PlanReader } from '../../domain/ports.js';
import { Plan } from '../../domain/entities/plan.entity.js';
export interface PlanView {
  id: string;
  name: string;
  slug: string;
  priceCents: number | null;
  cycle: string;
  benefits: string[];
  featured: boolean;
}
function forView(p: Plan): PlanView {
  return {
    id: p.id,
    name: p.name,
    slug: p.slug,
    priceCents: p.priceCents,
    cycle: p.cycle,
    benefits: p.benefits,
    featured: p.featured,
  };
}
export class ListPlansUseCase {
  constructor(
    private readonly deps: {
      plans: PlanReader;
    },
  ) {}
  async execute(): Promise<{
    plans: PlanView[];
  }> {
    const active = await this.deps.plans.listActive();
    return {
      plans: active.sort((a, b) => a.order - b.order).map(forView),
    };
  }
}
export class GetMinhaSubscriptionUseCase {
  constructor(
    private readonly deps: {
      subscriptions: import('../../domain/ports.js').SubscriptionReader;
      plans: PlanReader;
    },
  ) {}
  async execute(input: { userId: string }): Promise<{
    status: string;
    planId: string;
    planName: string;
    priceCents: number;
    currentPeriodEnd: string;
    hasAccess: boolean;
  } | null> {
    const subscription = await this.deps.subscriptions.byUser(input.userId);
    if (!subscription) return null;
    const plan = await this.deps.plans.byId(subscription.planId);
    return {
      status: subscription.status,
      planId: subscription.planId,
      planName: plan?.name ?? '—',
      priceCents: subscription.priceCents,
      currentPeriodEnd: subscription.currentPeriodEnd.toISOString(),
      hasAccess: subscription.hasAccessOn(new Date()),
    };
  }
}
