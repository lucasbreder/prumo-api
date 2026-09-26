import { Subscription } from './entities/subscription.entity.js';
import { Plan } from './entities/plan.entity.js';
export const PLAN_READER = 'PLAN_READER' as const;
export const PLAN_WRITER = 'PLAN_WRITER' as const;
export const SUBSCRIPTION_READER = 'SUBSCRIPTION_READER' as const;
export const SUBSCRIPTION_WRITER = 'SUBSCRIPTION_WRITER' as const;
export const PAYMENT_PROVIDER = 'PAYMENT_PROVIDER' as const;
export const INVOICE_READER = 'INVOICE_READER' as const;
export const INVOICE_WRITER = 'INVOICE_WRITER' as const;
export interface PlanReader {
  listActive(): Promise<Plan[]>;
  byId(id: string): Promise<Plan | null>;
  listAll(): Promise<Plan[]>;
}
export interface PlanWriter {
  create(plan: Plan): Promise<void>;
  save(plan: Plan): Promise<void>;
}
export interface SubscriptionReader {
  byUser(userId: string): Promise<Subscription | null>;
}
export interface SubscriptionWriter {
  save(subscription: Subscription): Promise<void>;
}
export interface PaymentProvider {
  chargeSubscription(input: {
    userId: string;
    planId: string;
    amountCents: number;
  }): Promise<{
    checkoutUrl: string | null;
  }>;
}
export interface InvoiceRow {
  id: string;
  userId: string;
  amountCents: number;
  description: string;
  cycle: 'MONTHLY' | 'YEARLY' | 'TEAM';
  status: 'PAID' | 'OPEN';
  issuedAt: Date;
}
export interface InvoiceReader {
  listByUser(userId: string): Promise<InvoiceRow[]>;
  listAll(limit?: number): Promise<InvoiceRow[]>;
}
export interface InvoiceWriter {
  create(
    invoice: Omit<InvoiceRow, 'issuedAt'> & {
      issuedAt?: Date;
    },
  ): Promise<void>;
}
export const BillingEvents = {
  SubscriptionATIVADA: 'billing.assinatura_ativada',
  SubscriptionCanceled: 'billing.assinatura_cancelada',
} as const;
