import { describe, expect, it, beforeEach } from 'vitest';
import { randomUUID } from 'node:crypto';
import { Plan } from '../../domain/entities/plan.entity.js';
import { Subscription } from '../../domain/entities/subscription.entity.js';
import {
  FakeSubscriptionRepo,
  FakeInvoiceRepo,
  FakePaymentProvider,
  FakePlanRepo,
  planMonthly,
} from '../fakes/billing.fakes.js';
import { PerformCheckoutUseCase } from './perform-checkout.usecase.js';
import { CancelSubscriptionUseCase } from './cancel-subscription.usecase.js';
import { ProcessWebhookUseCase } from './process-webhook.usecase.js';
import { AjustarPlanAdminUseCase } from './ajustes-admin.usecases.js';
import {
  ListPlansUseCase,
  GetMinhaSubscriptionUseCase,
} from './plans.consult.usecases.js';
import {
  AccessDeniedError,
  BusinessRuleError,
  NotFoundError,
} from '../../../../shared/errors/domain.errors.js';
import { Clock } from '../../../../shared/domain/clock.js';
class ClockFixo implements Clock {
  data = new Date('2026-09-04T12:00:00.000Z');
  now(): Date {
    return this.data;
  }
}
const planYearly = () =>
  Plan.create({
    id: 'plano-anual',
    name: 'Anual',
    slug: 'anual',
    priceCents: 7900,
    cycle: 'YEARLY',
    benefits: ['Tudo do mensal', '2 meses gratis'],
    featured: true,
    active: true,
    order: 2,
  });
const planTeam = () =>
  Plan.create({
    id: 'plano-equipes',
    name: 'Equipes',
    slug: 'equipes',
    priceCents: null,
    cycle: 'TEAM',
    benefits: ['Varios assentos'],
    featured: false,
    active: true,
    order: 3,
  });
describe('Checkout e assinatura', () => {
  let plans: FakePlanRepo;
  let subscriptions: FakeSubscriptionRepo;
  let payment: FakePaymentProvider;
  let invoices: FakeInvoiceRepo;
  let clock: ClockFixo;
  let events: {
    name: string;
    payload: unknown;
  }[];
  let checkout: PerformCheckoutUseCase;
  let cancel: CancelSubscriptionUseCase;
  let webhook: ProcessWebhookUseCase;
  beforeEach(() => {
    plans = new FakePlanRepo();
    subscriptions = new FakeSubscriptionRepo();
    payment = new FakePaymentProvider();
    invoices = new FakeInvoiceRepo();
    clock = new ClockFixo();
    events = [];
    plans.plans.set('plano-mensal', planMonthly());
    plans.plans.set('plano-anual', planYearly());
    plans.plans.set('plano-equipes', planTeam());
    const pub = {
      issue: (n: string, p: unknown) => events.push({ name: n, payload: p }),
    };
    checkout = new PerformCheckoutUseCase({
      plans,
      subscriptions,
      payment,
      invoices,
      clock,
      events: pub,
    });
    cancel = new CancelSubscriptionUseCase({
      subscriptions,
      clock,
      events: pub,
    });
    webhook = new ProcessWebhookUseCase({
      subscriptions,
      plans,
      invoices,
      clock,
    });
  });
  it('checkout cria assinatura ativa com snapshot do preco', async () => {
    const output = await checkout.execute({
      userId: 'u1',
      planId: 'plano-anual',
    });
    expect(output.subscription.status).toBe('ACTIVE');
    expect(output.subscription.priceCents).toBe(7900);
    expect(output.subscription.currentPeriodEnd.getTime()).toBe(
      clock.data.getTime() + 365 * 86400000,
    );
    expect(payment.charge).toMatchObject({
      userId: 'u1',
      amountCents: 79000, // ciclo anual = 10x o preco mensal
    });
    expect(events[0].name).toBe('billing.assinatura_ativada');
  });
  it('checkout de plano inativo e recusado', async () => {
    const inactive = planMonthly();
    inactive.update({ active: false });
    plans.plans.set('plano-morto', inactive);
    await expect(
      checkout.execute({ userId: 'u1', planId: 'plano-morto' }),
    ).rejects.toBeInstanceOf(NotFoundError);
  });
  it('checkout de Equipes (sob consulta) e recusado com orientacao de contato', async () => {
    await expect(
      checkout.execute({ userId: 'u1', planId: 'plano-equipes' }),
    ).rejects.toBeInstanceOf(BusinessRuleError);
  });
  it('upgrade troca o plano mantendo uma assinatura por aluno', async () => {
    await checkout.execute({ userId: 'u1', planId: 'plano-mensal' });
    const current = await checkout.execute({
      userId: 'u1',
      planId: 'plano-anual',
    });
    expect(current.subscription.planId).toBe('plano-anual');
    expect(subscriptions.byUserId.size).toBe(1);
  });
  it('cancelamento preserva acesso ate o fim do periodo pago', async () => {
    await checkout.execute({ userId: 'u1', planId: 'plano-mensal' });
    const output = await cancel.execute({ userId: 'u1' });
    expect(output.status).toBe('CANCELED');
    expect(output.accessAte).toBe(clock.data.getTime() + 31 * 86400000);
    const a = subscriptions.byUserId.get('u1') as Subscription;
    expect(a.hasAccessOn(clock.data)).toBe(true);
    expect(a.hasAccessOn(new Date(clock.data.getTime() + 40 * 86400000))).toBe(
      false,
    );
  });
  it('cancelar duas vezes falha', async () => {
    await checkout.execute({ userId: 'u1', planId: 'plano-mensal' });
    await cancel.execute({ userId: 'u1' });
    await expect(cancel.execute({ userId: 'u1' })).rejects.toBeInstanceOf(
      BusinessRuleError,
    );
  });
  it('cancelar sem assinatura -> 404', async () => {
    await expect(cancel.execute({ userId: 'ninguem' })).rejects.toBeInstanceOf(
      NotFoundError,
    );
  });
  it('webhook payment_falhou expira a assinatura', async () => {
    await checkout.execute({ userId: 'u1', planId: 'plano-mensal' });
    await webhook.execute({
      event: 'subscription.payment_failed',
      userId: 'u1',
    });
    const a = subscriptions.byUserId.get('u1') as Subscription;
    expect(a.status).toBe('EXPIRED');
  });
  it('webhook pago renova o ciclo em diante', async () => {
    await checkout.execute({ userId: 'u1', planId: 'plano-anual' });
    const antes = (subscriptions.byUserId.get('u1') as Subscription)
      .currentPeriodEnd;
    await webhook.execute({
      event: 'subscription.paid',
      userId: 'u1',
    });
    const depois = (subscriptions.byUserId.get('u1') as Subscription)
      .currentPeriodEnd;
    expect(depois.getTime()).toBe(antes.getTime() + 365 * 86400000);
  });
  it('webhook para usuario sem assinatura -> 404', async () => {
    await expect(
      webhook.execute({ event: 'subscription.paid', userId: randomUUID() }),
    ).rejects.toBeInstanceOf(AccessDeniedError);
  });
  it('listar planos publicos so mostra ativos ordenados', async () => {
    const view = await new ListPlansUseCase({ plans }).execute();
    expect(view.plans.map((p) => p.slug)).toEqual([
      'mensal',
      'anual',
      'equipes',
    ]);
    expect(view.plans[1].featured).toBe(true);
    expect(view.plans[2].priceCents).toBeNull();
  });
  it('minha-assinatura informa plano e acesso', async () => {
    await checkout.execute({ userId: 'u1', planId: 'plano-mensal' });
    const output = await new GetMinhaSubscriptionUseCase({
      subscriptions,
      plans,
    }).execute({
      userId: 'u1',
    });
    expect(output?.planName).toBe('Mensal');
    expect(output?.hasAccess).toBe(true);
  });
  it('upgrade com prorrateio cobra a diferenca dos dias restantes', async () => {
    await checkout.execute({ userId: 'u1', planId: 'plano-mensal' });
    // avancamos 15 days: restam 16 de 31 -> credito ~ 9700*16/31 = 5013
    clock.data = new Date(clock.data.getTime() + 15 * 86400000);
    const output = await checkout.execute({
      userId: 'u1',
      planId: 'plano-anual',
    });
    expect(output.creditCents).toBe(Math.round((9700 * 16) / 31));
    expect(output.chargedCents).toBe(79000 - output.creditCents);
    expect(payment.charge?.amountCents).toBe(output.chargedCents);
    expect(invoices.invoices).toHaveLength(2);
    expect(invoices.invoices[1].amountCents).toBe(output.chargedCents);
  });
  it('webhook pago gera fatura de renovacao', async () => {
    await checkout.execute({ userId: 'u1', planId: 'plano-anual' });
    await webhook.execute({ event: 'subscription.paid', userId: 'u1' });
    expect(
      invoices.invoices.some((f) => f.description.startsWith('Renovacao')),
    ).toBe(true);
  });
});
describe('Ajuste administrativo de plano', () => {
  it('admin ativa plano sem charge e revoga com planoId null', async () => {
    const plans = new FakePlanRepo();
    const subscriptions = new FakeSubscriptionRepo();
    const invoices = new FakeInvoiceRepo();
    const clock = new ClockFixo();
    plans.plans.set('plano-mensal', planMonthly());
    const usecase = new AjustarPlanAdminUseCase({
      plans,
      subscriptions,
      invoices,
      clock,
    });
    const output = await usecase.execute({
      userId: 'u1',
      planId: 'plano-mensal',
    });
    expect(output).toEqual({ status: 'ACTIVE', planName: 'Mensal' });
    expect(subscriptions.byUserId.get('u1')?.priceCents).toBe(9700);
    const revoked = await usecase.execute({ userId: 'u1', planId: null });
    expect(revoked.status).toBe('EXPIRED');
    expect(invoices.invoices).toHaveLength(1);
  });
});
