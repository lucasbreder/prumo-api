import { describe, expect, it } from 'vitest';
import { Cents } from './money.vo.js';
import { BusinessRuleError } from '../../../../shared/errors/domain.errors.js';
describe('Centavos (value object)', () => {
  it('guarda o valor inteiro sem conversao de float', () => {
    expect(Cents.de(9700).value).toBe(9700);
  });
  it('rejeita valor negativo', () => {
    expect(() => Cents.de(-1)).toThrow(BusinessRuleError);
  });
  it('rejeita fracao de centavo', () => {
    expect(() => Cents.de(97.5)).toThrow(/inteiro/i);
  });
  it('MRR do plano ja e mensal por definicao de negocio', () => {
    expect(Cents.mrr(7900, 'YEARLY').value).toBe(7900);
    expect(Cents.mrr(9700, 'MONTHLY').value).toBe(9700);
    expect(Cents.mrr(null, 'TEAM').value).toBe(0);
  });
  it('valor cobrado por ciclo: anual da 2 meses gratis (10x)', () => {
    expect(Cents.valueDoBillingCycle(9700, 'MONTHLY')).toBe(9700);
    expect(Cents.valueDoBillingCycle(7900, 'YEARLY')).toBe(79000);
  });
});
