import { randomUUID } from 'node:crypto';
import { Plan } from '../../domain/entities/plan.entity.js';
import { PlanReader, PlanWriter } from '../../domain/ports.js';
import { NotFoundError } from '../../../../shared/errors/domain.errors.js';
export interface SavePlanInput {
  id?: string;
  name: string;
  slug: string;
  priceCents: number | null;
  cycle: 'MONTHLY' | 'YEARLY' | 'TEAM';
  benefits: string[];
  featured: boolean;
  active: boolean;
  order: number;
}
export class SavePlanUseCase {
  constructor(private readonly deps: PlanReader & PlanWriter) {}
  async execute(input: SavePlanInput): Promise<Plan> {
    if (input.id) {
      const existing = await this.deps.byId(input.id);
      if (!existing) throw new NotFoundError('Plano nao encontrado');
      existing.update({
        name: input.name,
        priceCents: input.priceCents,
        cycle: input.cycle,
        benefits: input.benefits,
        featured: input.featured,
        active: input.active,
        order: input.order,
      });
      await this.deps.save(existing);
      return existing;
    }
    const plan = Plan.create({
      id: randomUUID(),
      name: input.name,
      slug: input.slug,
      priceCents: input.priceCents,
      cycle: input.cycle,
      benefits: input.benefits,
      featured: input.featured,
      active: input.active,
      order: input.order,
    });
    await this.deps.create(plan);
    return plan;
  }
}
