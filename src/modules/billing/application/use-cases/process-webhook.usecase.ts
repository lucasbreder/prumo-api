import {
  PlanReader,
  SubscriptionReader,
  SubscriptionWriter,
  InvoiceWriter,
} from '../../domain/ports.js';
import { AccessDeniedError } from '../../../../shared/errors/domain.errors.js';
import { Clock } from '../../../../shared/domain/clock.js';
import { randomUUID } from 'node:crypto';
export interface WebhookDeps {
  subscriptions: SubscriptionReader & SubscriptionWriter;
  plans: PlanReader;
  invoices: InvoiceWriter;
  clock: Clock;
}
export type EventWebhook =
  'subscription.paid' | 'subscription.payment_failed' | 'subscription.canceled';
function cicloLabel(cycle: string): string {
  return (
    { MONTHLY: 'Mensal', YEARLY: 'Anual', TEAM: 'Equipes' } as Record<string, string>
  )[cycle] ?? cycle;
}
export class ProcessWebhookUseCase {
  constructor(private readonly deps: WebhookDeps) {}
  async execute(input: { event: string; userId: string }): Promise<{
    processed: true;
  }> {
    const subscription = await this.deps.subscriptions.byUser(input.userId);
    if (!subscription) {
      throw new AccessDeniedError(
        'Assinatura desconhecida para o evento recebido',
      );
    }
    const current = this.deps.clock.now();
    switch (input.event) {
      case 'subscription.paid': {
        const plan = await this.deps.plans.byId(subscription.planId);
        if (plan) {
          subscription.renewBillingCycle(
            plan.cycle,
            current,
            plan.priceCents ?? subscription.priceCents,
          );
          await this.deps.invoices.create({
            id: randomUUID(),
            userId: subscription.userId,
            amountCents: plan.priceCents ?? subscription.priceCents,
            description: `Renovacao ${plan.name} (${cicloLabel(plan.cycle)})`,
            cycle: plan.cycle,
            status: 'PAID',
          });
        }
        break;
      }
      case 'subscription.payment_failed':
        subscription.expirar(current);
        break;
      case 'subscription.canceled':
        if (subscription.status === 'ACTIVE') subscription.cancel(current);
        break;
      default:
        break;
    }
    await this.deps.subscriptions.save(subscription);
    return { processed: true };
  }
}
