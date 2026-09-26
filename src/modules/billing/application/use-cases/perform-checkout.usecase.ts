import {
  PlanReader,
  PaymentProvider,
  InvoiceWriter,
} from '../../domain/ports.js';
import { Cents } from '../../domain/value-objects/money.vo.js';
import { DaysDOBillingCycle } from '../../domain/entities/subscription.entity.js';
import {
  NotFoundError,
  BusinessRuleError,
} from '../../../../shared/errors/domain.errors.js';
import { SubscriptionReader, SubscriptionWriter } from '../../domain/ports.js';
import { Subscription } from '../../domain/entities/subscription.entity.js';
import { Clock } from '../../../../shared/domain/clock.js';
import { BillingEvents } from '../../domain/ports.js';
import { randomUUID } from 'node:crypto';
interface Pub {
  issue(name: string, payload: unknown): void;
}
export interface CheckoutDeps {
  plans: PlanReader;
  subscriptions: SubscriptionReader & SubscriptionWriter;
  payment: PaymentProvider;
  invoices: InvoiceWriter;
  clock: Clock;
  events: Pub;
}
const cicloLabels: Record<string, string> = {
  MONTHLY: 'Mensal',
  YEARLY: 'Anual',
  TEAM: 'Equipes',
};
function cicloLabel(cycle: string): string {
  return cicloLabels[cycle] ?? cycle;
}
export class PerformCheckoutUseCase {
  constructor(private readonly deps: CheckoutDeps) {}
  async execute(input: { userId: string; planId: string }): Promise<{
    subscription: Subscription;
    checkoutUrl: string | null;
    creditCents: number;
    chargedCents: number;
  }> {
    const plan = await this.deps.plans.byId(input.planId);
    if (!plan || plan.archived || !plan.active) {
      throw new NotFoundError('Plano nao disponivel');
    }
    if (plan.priceCents === null) {
      throw new BusinessRuleError(
        'O plano Equipes e sob consulta — fale com a equipe comercial',
      );
    }
    const current = this.deps.clock.now();
    const anterior = await this.deps.subscriptions.byUser(input.userId);
    const planAnterior =
      anterior && anterior.planId !== plan.id
        ? await this.deps.plans.byId(anterior.planId)
        : null;
    // Upgrade with prorrateio: days yet not usados do ciclo vigente viram credito.
    let creditCents = 0;
    if (anterior && anterior.hasAccessOn(current) && planAnterior) {
      const daysBillingCycle = DaysDOBillingCycle[planAnterior.cycle];
      creditCents = Cents.creditoProrrateado(
        anterior.priceCents,
        anterior.daysRestantesEm(current),
        daysBillingCycle,
      );
    }
    const valueCheio = Cents.valueDoBillingCycle(plan.priceCents, plan.cycle);
    const chargedCents = Math.max(0, valueCheio - creditCents);
    const payment = await this.deps.payment.chargeSubscription({
      userId: input.userId,
      planId: plan.id,
      amountCents: chargedCents,
    });
    const subscription = Subscription.contratar({
      id: randomUUID(),
      userId: input.userId,
      planId: plan.id,
      priceCents: plan.priceCents,
      cycle: plan.cycle,
      startsAt: current,
    });
    await this.deps.subscriptions.save(subscription);
    await this.deps.invoices.create({
      id: randomUUID(),
      userId: input.userId,
      amountCents: chargedCents,
      description: `Assinatura ${plan.name} (${cicloLabel(plan.cycle)})${creditCents ? ` - credito prorrateado ${creditCents}` : ''}`,
      cycle: plan.cycle,
      status: 'PAID',
    });
    this.deps.events.issue(BillingEvents.SubscriptionATIVADA, {
      userId: input.userId,
      planId: plan.id,
      priceCents: plan.priceCents,
      creditCents,
      chargedCents,
    });
    return {
      subscription,
      checkoutUrl: payment.checkoutUrl,
      creditCents,
      chargedCents,
    };
  }
}
