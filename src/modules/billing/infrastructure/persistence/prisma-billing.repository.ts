import { Injectable } from '@nestjs/common';
import { PrismaService } from '../../../../shared/database/prisma.service.js';
import { Plan } from '../../domain/entities/plan.entity.js';
import {
  SubscriptionReader,
  SubscriptionWriter,
  InvoiceRow,
  InvoiceReader,
  InvoiceWriter,
  PlanReader,
  PlanWriter,
} from '../../domain/ports.js';
import { Subscription } from '../../domain/entities/subscription.entity.js';
import { Prisma } from '../../../../generated/prisma/client.js';
import {
  ConflictError,
  NotFoundError,
} from '../../../../shared/errors/domain.errors.js';
const SELECAOPlan = {
  id: true,
  name: true,
  slug: true,
  priceCents: true,
  cycle: true,
  benefits: true,
  featured: true,
  active: true,
  archived: true,
  order: true,
} satisfies Prisma.PlanSelect;
type PlanRow = Prisma.PlanGetPayload<{
  select: typeof SELECAOPlan;
}>;
function rowForPlan(row: PlanRow): Plan {
  return Plan.reconstituir({
    id: row.id,
    name: row.name,
    slug: row.slug,
    priceCents: row.priceCents,
    cycle: row.cycle,
    benefits: row.benefits,
    featured: row.featured,
    active: row.active,
    archived: row.archived,
    order: row.order,
  });
}
function planForEscritura(plan: Plan) {
  return {
    name: plan.name,
    slug: plan.slug,
    priceCents: plan.priceCents,
    cycle: plan.cycle,
    benefits: plan.benefits,
    featured: plan.featured,
    active: plan.active,
    archived: plan.archived,
    order: plan.order,
  };
}
const SELECAOSubscription = {
  id: true,
  userId: true,
  planId: true,
  status: true,
  priceCents: true,
  startsAt: true,
  currentPeriodEnd: true,
  canceledAt: true,
} satisfies Prisma.SubscriptionSelect;
type SubscriptionRow = Prisma.SubscriptionGetPayload<{
  select: typeof SELECAOSubscription;
}>;
function rowForSubscription(row: SubscriptionRow): Subscription {
  return Subscription.reconstituir({
    id: row.id,
    userId: row.userId,
    planId: row.planId,
    status: row.status as 'ACTIVE' | 'CANCELED' | 'EXPIRED',
    priceCents: row.priceCents,
    startsAt: row.startsAt,
    // fimPeriodoAtual e opcional no schema, but always definido no checkout.
    currentPeriodEnd: row.currentPeriodEnd ?? row.startsAt,
    canceledAt: row.canceledAt,
  });
}
@Injectable()
export class PrismaPlanRepository implements PlanReader, PlanWriter {
  constructor(private readonly prisma: PrismaService) {}
  async listActive(): Promise<Plan[]> {
    const rows = await this.prisma.plan.findMany({
      where: { active: true, archived: false },
      orderBy: { order: 'asc' },
      select: SELECAOPlan,
    });
    return rows.map(rowForPlan);
  }
  async listAll(): Promise<Plan[]> {
    const rows = await this.prisma.plan.findMany({
      where: { archived: false },
      orderBy: { order: 'asc' },
      select: SELECAOPlan,
    });
    return rows.map(rowForPlan);
  }
  async byId(id: string): Promise<Plan | null> {
    const row = await this.prisma.plan.findUnique({
      where: { id },
      select: SELECAOPlan,
    });
    return row ? rowForPlan(row) : null;
  }
  async create(plan: Plan): Promise<void> {
    try {
      await this.prisma.plan.create({
        data: { id: plan.id, ...planForEscritura(plan) },
      });
    } catch (e) {
      if (
        e instanceof Prisma.PrismaClientKnownRequestError &&
        e.code === 'P2002'
      ) {
        throw new ConflictError('Ja existe um plano com este slug');
      }
      throw e;
    }
  }
  async save(plan: Plan): Promise<void> {
    try {
      await this.prisma.plan.update({
        where: { id: plan.id },
        data: planForEscritura(plan),
      });
    } catch (e) {
      if (
        e instanceof Prisma.PrismaClientKnownRequestError &&
        e.code === 'P2025'
      ) {
        throw new NotFoundError('Plano nao encontrado');
      }
      throw e;
    }
  }
}
@Injectable()
export class PrismaSubscriptionRepository
  implements SubscriptionReader, SubscriptionWriter
{
  constructor(private readonly prisma: PrismaService) {}
  async byUser(userId: string): Promise<Subscription | null> {
    const row = await this.prisma.subscription.findUnique({
      where: { userId },
      select: SELECAOSubscription,
    });
    return row ? rowForSubscription(row) : null;
  }
  async save(subscription: Subscription): Promise<void> {
    const data = {
      planId: subscription.planId,
      status: subscription.status,
      priceCents: subscription.priceCents,
      startsAt: subscription.startsAt,
      currentPeriodEnd: subscription.currentPeriodEnd,
      canceledAt: subscription.canceledAt,
    };
    await this.prisma.subscription.upsert({
      where: { userId: subscription.userId },
      create: { id: subscription.id, userId: subscription.userId, ...data },
      update: data,
    });
  }
}
@Injectable()
export class PrismaInvoiceRepository implements InvoiceReader, InvoiceWriter {
  constructor(private readonly prisma: PrismaService) {}
  private forRow(f: {
    id: string;
    userId: string;
    amountCents: number;
    description: string;
    cycle: string;
    status: string;
    issuedAt: Date;
  }): InvoiceRow {
    return {
      id: f.id,
      userId: f.userId,
      amountCents: f.amountCents,
      description: f.description,
      cycle: f.cycle as 'MONTHLY' | 'YEARLY' | 'TEAM',
      status: f.status as 'PAID' | 'OPEN',
      issuedAt: f.issuedAt,
    };
  }
  async listByUser(userId: string): Promise<InvoiceRow[]> {
    const rows = await this.prisma.invoice.findMany({
      where: { userId },
      orderBy: { issuedAt: 'desc' },
      select: {
        id: true,
        userId: true,
        amountCents: true,
        description: true,
        cycle: true,
        status: true,
        issuedAt: true,
      },
    });
    return rows.map((l) => this.forRow(l));
  }
  async listAll(limit = 100): Promise<InvoiceRow[]> {
    const rows = await this.prisma.invoice.findMany({
      orderBy: { issuedAt: 'desc' },
      take: limit,
      select: {
        id: true,
        userId: true,
        amountCents: true,
        description: true,
        cycle: true,
        status: true,
        issuedAt: true,
      },
    });
    return rows.map((l) => this.forRow(l));
  }
  async create(
    invoice: Omit<InvoiceRow, 'issuedAt'> & {
      issuedAt?: Date;
    },
  ): Promise<void> {
    await this.prisma.invoice.create({
      data: {
        id: invoice.id,
        userId: invoice.userId,
        amountCents: invoice.amountCents,
        description: invoice.description,
        cycle: invoice.cycle,
        status: invoice.status,
        ...(invoice.issuedAt ? { issuedAt: invoice.issuedAt } : {}),
      },
    });
  }
}
