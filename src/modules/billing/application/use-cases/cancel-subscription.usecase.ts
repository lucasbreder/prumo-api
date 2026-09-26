import {
  SubscriptionReader,
  SubscriptionWriter,
  BillingEvents,
} from '../../domain/ports.js';
import { NotFoundError } from '../../../../shared/errors/domain.errors.js';
import { Clock } from '../../../../shared/domain/clock.js';
interface Pub {
  issue(name: string, payload: unknown): void;
}
export interface CancelDeps {
  subscriptions: SubscriptionReader & SubscriptionWriter;
  clock: Clock;
  events: Pub;
}
export class CancelSubscriptionUseCase {
  constructor(private readonly deps: CancelDeps) {}
  async execute(input: { userId: string }): Promise<{
    status: string;
    accessAte: number;
  }> {
    const subscription = await this.deps.subscriptions.byUser(input.userId);
    if (!subscription) throw new NotFoundError('Sem assinatura ativa');
    subscription.cancel(this.deps.clock.now());
    await this.deps.subscriptions.save(subscription);
    this.deps.events.issue(BillingEvents.SubscriptionCanceled, {
      userId: input.userId,
    });
    return {
      status: subscription.status,
      accessAte: subscription.currentPeriodEnd.getTime(),
    };
  }
}
