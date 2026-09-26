import { Plan } from '../../domain/entities/plan.entity.js';
import { PlanReader, PlanWriter } from '../../domain/ports.js';
import { NotFoundError } from '../../../../shared/errors/domain.errors.js';
export class ArchivePlanUseCase {
  constructor(private readonly deps: PlanReader & PlanWriter) {}
  async execute(input: { id: string }): Promise<Plan> {
    const existing = await this.deps.byId(input.id);
    if (!existing || existing.archived)
      throw new NotFoundError('Plano nao encontrado');
    existing.archive();
    await this.deps.save(existing);
    return existing;
  }
}
