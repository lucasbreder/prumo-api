import { randomUUID } from 'node:crypto';
import {
  PlanReader,
  SubscriptionReader,
  SubscriptionWriter,
  InvoiceReader,
  InvoiceWriter,
} from '../../domain/ports.js';
import { Subscription } from '../../domain/entities/subscription.entity.js';
import { NotFoundError } from '../../../../shared/errors/domain.errors.js';
import { Clock } from '../../../../shared/domain/clock.js';
export interface AjustarPlanDeps {
  plans: PlanReader;
  subscriptions: SubscriptionReader & SubscriptionWriter;
  invoices: InvoiceWriter;
  clock: Clock;
}
/**
 * Admin adjusts o plan de um student (§7.4) without passar pelo checkout:
 * planoId definido active o novo plan; null revoga o access.
 */
export class AjustarPlanAdminUseCase {
  constructor(private readonly deps: AjustarPlanDeps) {}
  async execute(input: { userId: string; planId: string | null }): Promise<{
    status: string;
    planName: string | null;
  }> {
    if (input.planId === null) {
      const current = await this.deps.subscriptions.byUser(input.userId);
      if (current && current.status === 'ACTIVE') {
        current.expirar(this.deps.clock.now());
        await this.deps.subscriptions.save(current);
      }
      return { status: 'EXPIRED', planName: null };
    }
    const plan = await this.deps.plans.byId(input.planId);
    if (!plan) throw new NotFoundError('Plano nao encontrado');
    const subscription = Subscription.contratar({
      id: randomUUID(),
      userId: input.userId,
      planId: plan.id,
      priceCents: plan.priceCents ?? 0,
      cycle: plan.cycle,
      startsAt: this.deps.clock.now(),
    });
    await this.deps.subscriptions.save(subscription);
    await this.deps.invoices.create({
      id: randomUUID(),
      userId: input.userId,
      amountCents: 0,
      description: `Ajuste administrativo — plano ${plan.name}`,
      cycle: plan.cycle,
      status: 'PAID',
    });
    return { status: subscription.status, planName: plan.name };
  }
}
export class ListInvoicesUseCase {
  constructor(
    private readonly deps: {
      invoices: InvoiceReader;
    },
  ) {}
  async execute(input: { userId: string }) {
    const invoices = await this.deps.invoices.listByUser(input.userId);
    return {
      invoices: invoices.map((f) => ({
        id: f.id,
        amountCents: f.amountCents,
        description: f.description,
        status: f.status,
        issuedAt: f.issuedAt.toISOString(),
      })),
    };
  }
}
export class ListInvoicesAdminUseCase {
  constructor(
    private readonly deps: {
      invoices: InvoiceReader;
    },
  ) {}
  async execute(input?: { userId?: string }) {
    const todas = input?.userId
      ? await this.deps.invoices.listByUser(input.userId)
      : await this.deps.invoices.listAll(100);
    return {
      invoices: todas.map((f) => ({
        id: f.id,
        userId: f.userId,
        amountCents: f.amountCents,
        description: f.description,
        status: f.status,
        issuedAt: f.issuedAt.toISOString(),
      })),
    };
  }
}
