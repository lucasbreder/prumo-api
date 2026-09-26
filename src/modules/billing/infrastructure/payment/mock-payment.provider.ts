import { createHmac, timingSafeEqual } from 'node:crypto';
import { Injectable } from '@nestjs/common';
import { PaymentProvider } from '../../domain/ports.js';
/**
 * Provider de payment da fase 1 (dev): approves imediatamente.
 * O token PAYMENT_PROVIDER allows trocar by Stripe/Pagar.me without tocar
 * nos use cases (OCP). A confirm de webhook uses HMAC-SHA256.
 */
@Injectable()
export class MockPaymentProvider implements PaymentProvider {
  async chargeSubscription(input: {
    userId: string;
    planId: string;
    amountCents: number;
  }): Promise<{
    checkoutUrl: string | null;
  }> {
    return {
      checkoutUrl: `https://pay.prumo.dev/checkout/${input.userId}/${input.planId}`,
    };
  }
}
@Injectable()
export class SubscriptionWebhookVerifier {
  private readonly segredo: string;
  constructor(segredo: string) {
    this.segredo = segredo;
  }
  subscribe(payload: string, timestamp: string): string {
    return createHmac('sha256', this.segredo)
      .update(`${timestamp}.${payload}`)
      .digest('hex');
  }
  conferir(payload: string, timestamp: string, subscription: string): boolean {
    const esperado = this.subscribe(payload, timestamp);
    const a = Buffer.from(esperado, 'hex');
    const b = Buffer.from(subscription || '', 'hex');
    return a.length === b.length && timingSafeEqual(a, b);
  }
}
