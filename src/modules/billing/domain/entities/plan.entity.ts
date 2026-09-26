import { BusinessRuleError } from '../../../../shared/errors/domain.errors.js';
import { BillingCycle } from '../value-objects/money.vo.js';
export interface PlanProps {
  id: string;
  name: string;
  slug: string;
  priceCents: number | null;
  cycle: BillingCycle;
  benefits: string[];
  featured: boolean;
  active: boolean;
  archived?: boolean;
  order: number;
}
export class Plan {
  private constructor(private readonly props: PlanProps) {}
  static create(props: PlanProps): Plan {
    Plan.validate(props);
    return new Plan({ ...props, archived: props.archived ?? false });
  }
  static reconstituir(props: PlanProps): Plan {
    return new Plan({ ...props, archived: props.archived ?? false });
  }
  private static validate(props: PlanProps): void {
    if (!props.name?.trim())
      throw new BusinessRuleError('Nome do plano e obrigatorio');
    if (props.cycle !== 'TEAM' && props.priceCents === null) {
      throw new BusinessRuleError(
        'Apenas o plano de Equipes pode ficar sem preco',
      );
    }
    if (
      props.priceCents !== null &&
      (!Number.isInteger(props.priceCents) || props.priceCents < 0)
    ) {
      throw new BusinessRuleError(
        'Preco deve ser inteiro em centavos e nao negativo',
      );
    }
  }
  get id(): string {
    return this.props.id;
  }
  get name(): string {
    return this.props.name;
  }
  get slug(): string {
    return this.props.slug;
  }
  get priceCents(): number | null {
    return this.props.priceCents;
  }
  get cycle(): BillingCycle {
    return this.props.cycle;
  }
  get benefits(): string[] {
    return [...this.props.benefits];
  }
  get featured(): boolean {
    return this.props.featured;
  }
  get active(): boolean {
    return this.props.active;
  }
  get archived(): boolean {
    return this.props.archived ?? false;
  }
  get order(): number {
    return this.props.order;
  }
  archive(): void {
    this.props.archived = true;
    this.props.active = false;
  }
  update(data: Partial<Omit<PlanProps, 'id' | 'slug'>>): void {
    const novos: PlanProps = { ...this.props, ...data };
    Plan.validate(novos);
    this.props.priceCents = novos.priceCents;
    this.props.name = novos.name;
    this.props.cycle = novos.cycle;
    this.props.benefits = novos.benefits;
    this.props.featured = novos.featured;
    this.props.active = novos.active;
    this.props.order = novos.order;
  }
}
