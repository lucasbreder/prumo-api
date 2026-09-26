import { Module } from '@nestjs/common';
import { ENV_TOKEN } from '../../shared/config/env.js';
import type { AppEnv } from '../../shared/config/env.js';
import { Clock } from '../../shared/domain/clock.js';
import { SystemClock } from '../../shared/infrastructure/system-clock.js';
import { NestEventPublisher } from '../../shared/infrastructure/event-publisher.js';
import { PerformCheckoutUseCase } from './application/use-cases/perform-checkout.usecase.js';
import { CancelSubscriptionUseCase } from './application/use-cases/cancel-subscription.usecase.js';
import { ProcessWebhookUseCase } from './application/use-cases/process-webhook.usecase.js';
import {
  ListPlansUseCase,
  GetMinhaSubscriptionUseCase,
} from './application/use-cases/plans.consult.usecases.js';
import { SavePlanUseCase } from './application/use-cases/save-plan.usecase.js';
import { ArchivePlanUseCase } from './application/use-cases/archive-plan.usecase.js';
import {
  AjustarPlanAdminUseCase,
  ListInvoicesAdminUseCase,
  ListInvoicesUseCase,
} from './application/use-cases/ajustes-admin.usecases.js';
import {
  SUBSCRIPTION_READER,
  INVOICE_READER,
  INVOICE_WRITER,
  PAYMENT_PROVIDER,
  PLAN_READER,
  PLAN_WRITER,
} from './domain/ports.js';
import {
  PrismaSubscriptionRepository,
  PrismaInvoiceRepository,
  PrismaPlanRepository,
} from './infrastructure/persistence/prisma-billing.repository.js';
import {
  SubscriptionWebhookVerifier,
  MockPaymentProvider,
} from './infrastructure/payment/mock-payment.provider.js';
import { SubscriptionAccessGate } from './infrastructure/gate/subscription-access-gate.js';
import { ACCESS_GATE } from '../courses/domain/access-gate.js';
import { WEBHOOK_VERIFIER } from './presentation/tokens.js';
import {
  AdminPlansController,
  BillingWebhookController,
  CheckoutController,
  InvoicesController,
  PlansController,
} from './presentation/controllers/billing.controller.js';
@Module({
  controllers: [
    PlansController,
    CheckoutController,
    BillingWebhookController,
    AdminPlansController,
    InvoicesController,
  ],
  providers: [
    PrismaPlanRepository,
    PrismaSubscriptionRepository,
    PrismaInvoiceRepository,
    MockPaymentProvider,
    SystemClock,
    NestEventPublisher,
    SubscriptionAccessGate,
    { provide: PLAN_READER, useExisting: PrismaPlanRepository },
    { provide: PLAN_WRITER, useExisting: PrismaPlanRepository },
    { provide: SUBSCRIPTION_READER, useExisting: PrismaSubscriptionRepository },
    { provide: INVOICE_READER, useExisting: PrismaInvoiceRepository },
    { provide: INVOICE_WRITER, useExisting: PrismaInvoiceRepository },
    { provide: PAYMENT_PROVIDER, useExisting: MockPaymentProvider },
    { provide: Clock, useExisting: SystemClock },
    { provide: ACCESS_GATE, useExisting: SubscriptionAccessGate },
    {
      provide: WEBHOOK_VERIFIER,
      inject: [ENV_TOKEN],
      useFactory: (env: AppEnv) =>
        new SubscriptionWebhookVerifier(env.WEBHOOK_SECRET),
    },
    {
      provide: PerformCheckoutUseCase,
      inject: [
        PrismaPlanRepository,
        PrismaSubscriptionRepository,
        MockPaymentProvider,
        PrismaInvoiceRepository,
        SystemClock,
        NestEventPublisher,
      ],
      useFactory: (
        plans: PrismaPlanRepository,
        subscriptions: PrismaSubscriptionRepository,
        payment: MockPaymentProvider,
        invoices: PrismaInvoiceRepository,
        clock: SystemClock,
        events: NestEventPublisher,
      ) =>
        new PerformCheckoutUseCase({
          plans,
          subscriptions,
          payment,
          invoices,
          clock,
          events,
        }),
    },
    {
      provide: CancelSubscriptionUseCase,
      inject: [PrismaSubscriptionRepository, SystemClock, NestEventPublisher],
      useFactory: (
        subscriptions: PrismaSubscriptionRepository,
        clock: SystemClock,
        events: NestEventPublisher,
      ) => new CancelSubscriptionUseCase({ subscriptions, clock, events }),
    },
    {
      provide: ProcessWebhookUseCase,
      inject: [
        PrismaSubscriptionRepository,
        PrismaPlanRepository,
        PrismaInvoiceRepository,
        SystemClock,
      ],
      useFactory: (
        subscriptions: PrismaSubscriptionRepository,
        plans: PrismaPlanRepository,
        invoices: PrismaInvoiceRepository,
        clock: SystemClock,
      ) => new ProcessWebhookUseCase({ subscriptions, plans, invoices, clock }),
    },
    {
      provide: AjustarPlanAdminUseCase,
      inject: [
        PrismaPlanRepository,
        PrismaSubscriptionRepository,
        PrismaInvoiceRepository,
        SystemClock,
      ],
      useFactory: (
        plans: PrismaPlanRepository,
        subscriptions: PrismaSubscriptionRepository,
        invoices: PrismaInvoiceRepository,
        clock: SystemClock,
      ) =>
        new AjustarPlanAdminUseCase({ plans, subscriptions, invoices, clock }),
    },
    {
      provide: ListInvoicesUseCase,
      inject: [PrismaInvoiceRepository],
      useFactory: (invoices: PrismaInvoiceRepository) =>
        new ListInvoicesUseCase({ invoices }),
    },
    {
      provide: ListInvoicesAdminUseCase,
      inject: [PrismaInvoiceRepository],
      useFactory: (invoices: PrismaInvoiceRepository) =>
        new ListInvoicesAdminUseCase({ invoices }),
    },
    {
      provide: ListPlansUseCase,
      inject: [PrismaPlanRepository],
      useFactory: (plans: PrismaPlanRepository) =>
        new ListPlansUseCase({ plans }),
    },
    {
      provide: GetMinhaSubscriptionUseCase,
      inject: [PrismaSubscriptionRepository, PrismaPlanRepository],
      useFactory: (
        subscriptions: PrismaSubscriptionRepository,
        plans: PrismaPlanRepository,
      ) => new GetMinhaSubscriptionUseCase({ subscriptions, plans }),
    },
    {
      provide: SavePlanUseCase,
      inject: [PrismaPlanRepository],
      useFactory: (plans: PrismaPlanRepository) => new SavePlanUseCase(plans),
    },
    {
      provide: ArchivePlanUseCase,
      inject: [PrismaPlanRepository],
      useFactory: (plans: PrismaPlanRepository) =>
        new ArchivePlanUseCase(plans),
    },
  ],
  exports: [ACCESS_GATE, SUBSCRIPTION_READER, PLAN_READER],
})
export class BillingModule {}
