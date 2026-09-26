import { BusinessRuleError } from '../../../../shared/errors/domain.errors.js';
import { BillingCycle } from '../value-objects/money.vo.js';
export type SubscriptionStatus = 'ACTIVE' | 'CANCELED' | 'EXPIRED';
export interface SubscriptionProps {
  id: string;
  userId: string;
  planId: string;
  status: SubscriptionStatus;
  priceCents: number;
  startsAt: Date;
  currentPeriodEnd: Date;
  canceledAt: Date | null;
}
export const DaysDOBillingCycle: Record<BillingCycle, number> = {
  MONTHLY: 31,
  YEARLY: 365,
  TEAM: 31,
};
export class Subscription {
  private constructor(private readonly props: SubscriptionProps) {}
  static contratar(props: {
    id: string;
    userId: string;
    planId: string;
    priceCents: number;
    cycle: BillingCycle;
    startsAt: Date;
  }): Subscription {
    if (props.priceCents < 0 || !Number.isInteger(props.priceCents)) {
      throw new BusinessRuleError('Snapshot de preco invalido');
    }
    return new Subscription({
      id: props.id,
      userId: props.userId,
      planId: props.planId,
      status: 'ACTIVE',
      priceCents: props.priceCents,
      startsAt: props.startsAt,
      currentPeriodEnd: new Date(
        props.startsAt.getTime() + DaysDOBillingCycle[props.cycle] * 86400000,
      ),
      canceledAt: null,
    });
  }
  static reconstituir(props: SubscriptionProps): Subscription {
    return new Subscription(props);
  }
  get id(): string {
    return this.props.id;
  }
  get userId(): string {
    return this.props.userId;
  }
  get planId(): string {
    return this.props.planId;
  }
  get status(): SubscriptionStatus {
    return this.props.status;
  }
  get priceCents(): number {
    return this.props.priceCents;
  }
  get currentPeriodEnd(): Date {
    return this.props.currentPeriodEnd;
  }
  get canceledAt(): Date | null {
    return this.props.canceledAt;
  }
  get startsAt(): Date {
    return this.props.startsAt;
  }
  /**
   * Access vale ate o fim do periodo already paid; cancel not apaga history.
   */
  hasAccessOn(current: Date): boolean {
    if (this.props.status === 'ACTIVE') return true;
    return (
      this.props.status === 'CANCELED' &&
      this.props.currentPeriodEnd.getTime() > current.getTime()
    );
  }
  cancel(current: Date): void {
    if (this.props.status !== 'ACTIVE') {
      throw new BusinessRuleError(
        'Somente assinaturas ativas podem ser canceladas',
      );
    }
    this.props.status = 'CANCELED';
    this.props.canceledAt = current;
  }
  expirar(current: Date): void {
    this.props.status = 'EXPIRED';
    if (!this.props.canceledAt) this.props.canceledAt = current;
  }
  daysRestantesEm(current: Date): number {
    return Math.max(
      0,
      Math.ceil(
        (this.props.currentPeriodEnd.getTime() - current.getTime()) / 86400000,
      ),
    );
  }
  renewBillingCycle(
    cycle: BillingCycle,
    current: Date,
    priceCents: number,
  ): void {
    this.props.currentPeriodEnd = new Date(
      this.props.currentPeriodEnd.getTime() +
        DaysDOBillingCycle[cycle] * 86400000,
    );
    this.props.status = 'ACTIVE';
    this.props.priceCents = priceCents;
  }
}
