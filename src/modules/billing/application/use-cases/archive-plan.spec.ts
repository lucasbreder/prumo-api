import { describe, expect, it, beforeEach } from 'vitest';
import { FakePlanRepo, planMonthly } from '../fakes/billing.fakes.js';
import { ArchivePlanUseCase } from './archive-plan.usecase.js';
import { ListPlansUseCase } from './plans.consult.usecases.js';
import { PerformCheckoutUseCase } from './perform-checkout.usecase.js';
import {
  FakeSubscriptionRepo,
  FakeInvoiceRepo,
  FakePaymentProvider,
} from '../fakes/billing.fakes.js';
import { NotFoundError } from '../../../../shared/errors/domain.errors.js';
import { Clock } from '../../../../shared/domain/clock.js';
class ClockFixo implements Clock {
  now(): Date {
    return new Date('2026-09-04T12:00:00.000Z');
  }
}
describe('Arquivar (exclusao logica) de plano', () => {
  let plans: FakePlanRepo;
  let archive: ArchivePlanUseCase;
  beforeEach(() => {
    plans = new FakePlanRepo();
    plans.plans.set('plano-mensal', planMonthly());
    archive = new ArchivePlanUseCase(plans);
  });
  it('remove o plano da lista publica e da lista admin', async () => {
    await archive.execute({ id: 'plano-mensal' });
    const publico = await new ListPlansUseCase({ plans }).execute();
    expect(publico.plans.map((p) => p.slug)).not.toContain('mensal');
    const admin = await plans.listAll();
    expect(admin.map((p) => p.slug)).not.toContain('mensal');
  });
  it('nao apaga fisicamente: a entidade continua recuperavel por id', async () => {
    await archive.execute({ id: 'plano-mensal' });
    const achado = await plans.byId('plano-mensal');
    expect(achado?.archived).toBe(true);
  });
  it('checkout de plano arquivado e recusado', async () => {
    await archive.execute({ id: 'plano-mensal' });
    const checkout = new PerformCheckoutUseCase({
      plans,
      subscriptions: new FakeSubscriptionRepo(),
      payment: new FakePaymentProvider(),
      invoices: new FakeInvoiceRepo(),
      clock: new ClockFixo(),
      events: { issue: () => {} } as never,
    });
    await expect(
      checkout.execute({ userId: 'u1', planId: 'plano-mensal' }),
    ).rejects.toBeInstanceOf(NotFoundError);
  });
  it('arquivar plano inexistente -> 404', async () => {
    await expect(archive.execute({ id: 'nope' })).rejects.toBeInstanceOf(
      NotFoundError,
    );
  });
});
