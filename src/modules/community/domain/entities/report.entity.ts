import { BusinessRuleError } from '../../../../shared/errors/domain.errors.js';
export type ReportStatus = 'IN_ANALYSIS' | 'RESOLVED';
export type ReportDecision = 'REMOVE' | 'IGNORE' | 'BAN_AUTHOR';
export interface ReportProps {
  id: string;
  threadId: string;
  reporterId: string;
  reason: string;
  status: ReportStatus;
  decision: ReportDecision | null;
  resolvedAt: Date | null;
  createdAt: Date;
}
export class Report {
  private constructor(private readonly props: ReportProps) {}
  static create(data: {
    id: string;
    threadId: string;
    reporterId: string;
    reason: string;
  }): Report {
    if (!data.reason?.trim()) {
      throw new BusinessRuleError('O motivo da denuncia e obrigatorio');
    }
    return new Report({
      ...data,
      reason: data.reason.trim(),
      status: 'IN_ANALYSIS',
      decision: null,
      resolvedAt: null,
      createdAt: new Date(),
    });
  }
  static reconstituir(props: ReportProps): Report {
    return new Report(props);
  }
  get id(): string {
    return this.props.id;
  }
  get threadId(): string {
    return this.props.threadId;
  }
  get reporterId(): string {
    return this.props.reporterId;
  }
  get reason(): string {
    return this.props.reason;
  }
  get status(): ReportStatus {
    return this.props.status;
  }
  get decision(): ReportDecision | null {
    return this.props.decision;
  }
  get createdAt(): Date {
    return this.props.createdAt;
  }
  resolve(decision: ReportDecision, current: Date): void {
    if (this.props.status === 'RESOLVED') {
      throw new BusinessRuleError('Denuncia ja resolvida');
    }
    this.props.status = 'RESOLVED';
    this.props.decision = decision;
    this.props.resolvedAt = current;
  }
}
