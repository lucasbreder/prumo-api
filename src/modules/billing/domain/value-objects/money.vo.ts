import { BusinessRuleError } from '../../../../shared/errors/domain.errors.js';
export type BillingCycle = 'MONTHLY' | 'YEARLY' | 'TEAM';
export class Cents {
  private constructor(readonly value: number) {}
  static de(cents: number): Cents {
    if (!Number.isInteger(cents)) {
      throw new BusinessRuleError(
        'Preco deve ser um valor inteiro em centavos',
      );
    }
    if (cents < 0) {
      throw new BusinessRuleError('Preco nao pode ser negativo');
    }
    return new Cents(cents);
  }
  static mrr(priceCents: number | null, _ciclo: BillingCycle): Cents {
    if (priceCents === null) return new Cents(0);
    return Cents.de(priceCents);
  }
  static creditoProrrateado(
    precoCentsMonthly: number,
    daysRestantes: number,
    daysDoBillingCycle: number,
  ): number {
    const days = Math.max(0, Math.min(daysRestantes, daysDoBillingCycle));
    return Math.round((precoCentsMonthly * days) / daysDoBillingCycle);
  }
  static valueDoBillingCycle(priceCents: number, cycle: BillingCycle): number {
    switch (cycle) {
      case 'MONTHLY':
      case 'TEAM':
        return priceCents;
      case 'YEARLY':
        // 2 months gratis: cobra 10x o preco monthly by ano.
        return priceCents * 10;
    }
  }
}
