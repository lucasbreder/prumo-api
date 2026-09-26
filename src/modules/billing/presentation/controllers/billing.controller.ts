import {
  Body,
  Controller,
  Delete,
  Get,
  HttpCode,
  Inject,
  Param,
  Patch,
  Post,
  Query,
  Req,
} from '@nestjs/common';
import type { Request } from 'express';
import { Public } from '../../../../shared/auth/decorators/public.decorator.js';
import { Roles } from '../../../../shared/auth/decorators/roles.decorator.js';
import { CurrentUser } from '../../../../shared/auth/decorators/current-user.decorator.js';
import type { AuthUser } from '../../../../shared/auth/auth-user.types.js';
import {
  ListPlansUseCase,
  GetMinhaSubscriptionUseCase,
} from '../../application/use-cases/plans.consult.usecases.js';
import { PerformCheckoutUseCase } from '../../application/use-cases/perform-checkout.usecase.js';
import { CancelSubscriptionUseCase } from '../../application/use-cases/cancel-subscription.usecase.js';
import { ProcessWebhookUseCase } from '../../application/use-cases/process-webhook.usecase.js';
import { SavePlanUseCase } from '../../application/use-cases/save-plan.usecase.js';
import { ArchivePlanUseCase } from '../../application/use-cases/archive-plan.usecase.js';
import {
  AjustarPlanAdminUseCase,
  ListInvoicesAdminUseCase,
  ListInvoicesUseCase,
} from '../../application/use-cases/ajustes-admin.usecases.js';
import type { SavePlanInput } from '../../application/use-cases/save-plan.usecase.js';
import { SubscriptionWebhookVerifier } from '../../infrastructure/payment/mock-payment.provider.js';
import { WEBHOOK_VERIFIER } from '../tokens.js';
import { PLAN_READER } from '../../domain/ports.js';
import type { PlanReader } from '../../domain/ports.js';
import type { Plan } from '../../domain/entities/plan.entity.js';
import { UnauthorizedException } from '@nestjs/common';
import {
  IsArray,
  IsBoolean,
  IsEnum,
  IsInt,
  IsNotEmpty,
  IsOptional,
  IsString,
  Matches,
  MaxLength,
  Min,
} from 'class-validator';
import { Type } from 'class-transformer';
class CheckoutInputDto {
  @IsString()
  @IsNotEmpty()
  planId!: string;
}
class PlanInputDto {
  @IsString()
  @IsNotEmpty()
  @MaxLength(80)
  name!: string;
  @IsString()
  @Matches(/^[a-z0-9-]+$/)
  @MaxLength(80)
  slug!: string;
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(0)
  priceCents?: number | null;
  @IsEnum({ MONTHLY: 'MONTHLY', YEARLY: 'YEARLY', TEAM: 'TEAM' })
  cycle!: SavePlanInput['cycle'];
  @IsArray()
  @IsString({ each: true })
  benefits!: string[];
  @IsOptional()
  @Type(() => Boolean)
  @IsBoolean()
  featured = false;
  @IsOptional()
  @Type(() => Boolean)
  @IsBoolean()
  active = true;
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(0)
  order = 0;
}
@Controller('plans')
@Public()
export class PlansController {
  constructor(private readonly list: ListPlansUseCase) {}
  @Get()
  async listPlans() {
    return this.list.execute();
  }
}
@Controller()
export class CheckoutController {
  constructor(
    private readonly checkout: PerformCheckoutUseCase,
    private readonly minha: GetMinhaSubscriptionUseCase,
    private readonly cancel: CancelSubscriptionUseCase,
  ) {}
  @Post('checkout')
  async comprar(
    @CurrentUser()
    user: AuthUser,
    @Body()
    input: CheckoutInputDto,
  ) {
    const { subscription, checkoutUrl, creditCents, chargedCents } =
      await this.checkout.execute({ userId: user.id, planId: input.planId });
    return {
      subscription: {
        id: subscription.id,
        status: subscription.status,
        planId: subscription.planId,
        priceCents: subscription.priceCents,
        currentPeriodEnd: subscription.currentPeriodEnd.toISOString(),
      },
      checkoutUrl,
      creditCents,
      chargedCents,
    };
  }
  @Get('my-subscription')
  async get(
    @CurrentUser()
    user: AuthUser,
  ) {
    return { subscription: await this.minha.execute({ userId: user.id }) };
  }
  @Post('my-subscription/cancel')
  @HttpCode(200)
  async cancelSubscription(
    @CurrentUser()
    user: AuthUser,
  ) {
    return this.cancel.execute({ userId: user.id });
  }
}
@Controller('billing')
@Public()
export class BillingWebhookController {
  constructor(
    private readonly process: ProcessWebhookUseCase,
    @Inject(WEBHOOK_VERIFIER)
    private readonly verifier: SubscriptionWebhookVerifier,
  ) {}
  @Post('webhook')
  @HttpCode(200)
  async webhook(
    @Req()
    req: Request,
    @Body()
    body: {
      event: string;
      userId: string;
    },
  ) {
    const timestamp = req.headers['x-prumo-timestamp'] as string | undefined;
    const signature = req.headers['x-prumo-signature'] as string | undefined;
    if (!timestamp || !signature) {
      throw new UnauthorizedException('Assinatura do webhook ausente');
    }
    if (!this.verifier.conferir(JSON.stringify(body), timestamp, signature)) {
      throw new UnauthorizedException('Assinatura do webhook invalida');
    }
    return this.process.execute(body);
  }
}
class AjustarPlanInput {
  @IsOptional()
  @IsString()
  planId?: string | null;
}
@Controller()
export class InvoicesController {
  constructor(
    private readonly minhas: ListInvoicesUseCase,
    private readonly ajustar: AjustarPlanAdminUseCase,
    private readonly adminList: ListInvoicesAdminUseCase,
  ) {}
  @Get('my-invoices')
  async invoices(
    @CurrentUser()
    user: AuthUser,
  ) {
    return this.minhas.execute({ userId: user.id });
  }
  @Get('admin/invoices')
  @Roles('ADMIN')
  async invoicesAdmin(
    @Query('userId')
    userId?: string,
  ) {
    return this.adminList.execute({ userId });
  }
  @Post('admin/students/:id/plan')
  @Roles('ADMIN')
  async ajustarPlan(
    @Param('id')
    id: string,
    @Body()
    input: AjustarPlanInput,
  ) {
    return this.ajustar.execute({ userId: id, planId: input.planId ?? null });
  }
}
@Controller('admin/plans')
@Roles('ADMIN')
export class AdminPlansController {
  constructor(
    private readonly savePlan: SavePlanUseCase,
    private readonly archivePlan: ArchivePlanUseCase,
    @Inject(PLAN_READER)
    private readonly reader: PlanReader,
  ) {}
  @Get()
  async list() {
    return { plans: (await this.reader.listAll()).map(forPlanAdmin) };
  }
  @Post()
  async create(
    @Body()
    input: PlanInputDto,
  ) {
    const plan = await this.savePlan.execute(toData(input));
    return { plan: forPlanAdmin(plan) };
  }
  @Patch(':id')
  async update(
    @Param('id')
    id: string,
    @Body()
    input: PlanInputDto,
  ) {
    const plan = await this.savePlan.execute({ ...toData(input), id });
    return { plan: forPlanAdmin(plan) };
  }
  @Delete(':id')
  @HttpCode(204)
  async remove(
    @Param('id')
    id: string,
  ): Promise<void> {
    await this.archivePlan.execute({ id });
  }
}
function toData(input: PlanInputDto): Omit<SavePlanInput, 'id'> {
  return {
    name: input.name,
    slug: input.slug,
    priceCents: input.priceCents ?? null,
    cycle: input.cycle,
    benefits: input.benefits,
    featured: input.featured,
    active: input.active,
    order: input.order,
  };
}
function forPlanAdmin(p: Plan) {
  return {
    id: p.id,
    name: p.name,
    slug: p.slug,
    priceCents: p.priceCents,
    cycle: p.cycle,
    benefits: p.benefits,
    featured: p.featured,
    active: p.active,
    order: p.order,
  };
}
