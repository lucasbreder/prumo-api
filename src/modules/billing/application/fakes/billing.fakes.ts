import { Subscription } from '../../domain/entities/subscription.entity.js';
import { Plan } from '../../domain/entities/plan.entity.js';
import {
  SubscriptionReader,
  SubscriptionWriter,
  InvoiceRow,
  InvoiceReader,
  InvoiceWriter,
  PaymentProvider,
  PlanReader,
  PlanWriter,
} from '../../domain/ports.js';
export class FakePlanRepo implements PlanReader, PlanWriter {
  plans = new Map<string, Plan>();
  async listActive(): Promise<Plan[]> {
    return [...this.plans.values()].filter((p) => p.active && !p.archived);
  }
  async listAll(): Promise<Plan[]> {
    return [...this.plans.values()].filter((p) => !p.archived);
  }
  async byId(id: string): Promise<Plan | null> {
    return this.plans.get(id) ?? null;
  }
  async create(plan: Plan): Promise<void> {
    this.plans.set(plan.id, plan);
  }
  async save(plan: Plan): Promise<void> {
    this.plans.set(plan.id, plan);
  }
}
export class FakeSubscriptionRepo
  implements SubscriptionReader, SubscriptionWriter
{
  byUserId = new Map<string, Subscription>();
  async byUser(userId: string): Promise<Subscription | null> {
    return this.byUserId.get(userId) ?? null;
  }
  async save(subscription: Subscription): Promise<void> {
    this.byUserId.set(subscription.userId, subscription);
  }
}
export class FakePaymentProvider implements PaymentProvider {
  charge: {
    userId: string;
    planId: string;
    amountCents: number;
  } | null = null;
  falhar = false;
  async chargeSubscription(input: {
    userId: string;
    planId: string;
    amountCents: number;
  }): Promise<{
    checkoutUrl: string | null;
  }> {
    if (this.falhar) throw new Error('gateway fora do ar');
    this.charge = input;
    return { checkoutUrl: `https://pag.example/${input.userId}` };
  }
}
export class FakeInvoiceRepo implements InvoiceReader, InvoiceWriter {
  invoices: InvoiceRow[] = [];
  async listByUser(userId: string): Promise<InvoiceRow[]> {
    return this.invoices.filter((f) => f.userId === userId);
  }
  async listAll(): Promise<InvoiceRow[]> {
    return this.invoices;
  }
  async create(
    f: Omit<InvoiceRow, 'issuedAt'> & {
      issuedAt?: Date;
    },
  ): Promise<void> {
    this.invoices.push({
      ...f,
      issuedAt: f.issuedAt ?? new Date('2026-09-04T12:00:00.000Z'),
    });
  }
}
export function planMonthly(
  overrides: Partial<Parameters<typeof Plan.create>[0]> = {},
) {
  return Plan.create({
    id: 'plano-mensal',
    name: 'Mensal',
    slug: 'mensal',
    priceCents: 9700,
    cycle: 'MONTHLY',
    benefits: ['Todos os cursos'],
    featured: false,
    active: true,
    order: 1,
    ...overrides,
  });
}
