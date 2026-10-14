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
  static mrr(priceCents: number | null, ciclo: BillingCycle): Cents {
    if (priceCents === null) return new Cents(0);
    // Planos anuais guardam o valor do ano -> equivalente mensal.
    return Cents.de(
      ciclo === 'YEARLY' ? Math.round(priceCents / 12) : priceCents,
    );
  }
  static creditoProrrateado(
    precoCentsMonthly: number,
    daysRestantes: number,
    daysDoBillingCycle: number,
  ): number {
    const days = Math.max(0, Math.min(daysRestantes, daysDoBillingCycle));
    return Math.round((precoCentsMonthly * days) / daysDoBillingCycle);
  }
  static valueDoBillingCycle(priceCents: number, _cycle: BillingCycle): number {
    // `priceCents` e o valor cobrado no ciclo do plano (mensal = mes, anual =
    // ano). Nao ha multiplicacao: o valor cobrado e o proprio preco do plano.
    return priceCents;
  }
}
