import { BusinessRuleError } from '../../../../shared/errors/domain.errors.js';
export type LiveStatus = 'SCHEDULED' | 'LIVE' | 'ENDED';
export type LiveType = 'LIVE' | 'MENTORING';
export interface LiveProps {
  id: string;
  title: string;
  description: string;
  type: LiveType;
  startsAt: Date;
  durationMin: number;
  roomUrl: string | null;
  recordingUrl: string | null;
  status: LiveStatus;
  mentorName: string | null;
}
export class Live {
  private constructor(private readonly props: LiveProps) {}
  static create(
    data: Omit<
      LiveProps,
      'status' | 'roomUrl' | 'recordingUrl' | 'durationMin'
    > &
      Partial<Pick<LiveProps, 'roomUrl' | 'recordingUrl' | 'durationMin'>>,
  ): Live {
    if (!data.title?.trim())
      throw new BusinessRuleError('O titulo da live e obrigatorio');
    if (data.type === 'MENTORING' && !data.mentorName?.trim()) {
      throw new BusinessRuleError('Mentoria exige um mentor nomeado');
    }
    return new Live({
      ...data,
      title: data.title.trim(),
      roomUrl: data.roomUrl ?? null,
      recordingUrl: data.recordingUrl ?? null,
      durationMin: data.durationMin ?? 60,
      status: 'SCHEDULED',
    });
  }
  static reconstituir(props: LiveProps): Live {
    return new Live(props);
  }
  get id(): string {
    return this.props.id;
  }
  get title(): string {
    return this.props.title;
  }
  get description(): string {
    return this.props.description;
  }
  get type(): LiveType {
    return this.props.type;
  }
  get startsAt(): Date {
    return this.props.startsAt;
  }
  get durationMin(): number {
    return this.props.durationMin;
  }
  get roomUrl(): string | null {
    return this.props.roomUrl;
  }
  get recordingUrl(): string | null {
    return this.props.recordingUrl;
  }
  get status(): LiveStatus {
    return this.props.status;
  }
  get mentorName(): string | null {
    return this.props.mentorName;
  }
  start(): void {
    if (this.props.status === 'LIVE') {
      throw new BusinessRuleError('Esta live já está ao vivo');
    }
    if (this.props.status === 'ENDED') {
      throw new BusinessRuleError('Live encerrada não volta ao ar');
    }
    if (!this.props.roomUrl) {
      throw new BusinessRuleError(
        'Defina a URL da sala antes de iniciar ao vivo',
      );
    }
    this.props.status = 'LIVE';
  }
  end(recordingUrl: string | null): void {
    if (this.props.status !== 'LIVE') {
      throw new BusinessRuleError(
        'Somente uma live ao vivo pode ser encerrada',
      );
    }
    this.props.status = 'ENDED';
    if (recordingUrl) this.props.recordingUrl = recordingUrl;
  }
  editar(
    data: Partial<
      Pick<
        LiveProps,
        | 'title'
        | 'description'
        | 'startsAt'
        | 'durationMin'
        | 'roomUrl'
        | 'recordingUrl'
        | 'mentorName'
      >
    >,
  ): void {
    if (data.title !== undefined) {
      if (!data.title.trim())
        throw new BusinessRuleError('O titulo da live e obrigatorio');
      this.props.title = data.title.trim();
    }
    if (data.description !== undefined)
      this.props.description = data.description;
    if (data.startsAt !== undefined) this.props.startsAt = data.startsAt;
    if (data.durationMin !== undefined)
      this.props.durationMin = data.durationMin;
    if (data.roomUrl !== undefined) this.props.roomUrl = data.roomUrl;
    if (data.recordingUrl !== undefined)
      this.props.recordingUrl = data.recordingUrl;
    if (data.mentorName !== undefined) {
      if (this.props.type === 'MENTORING' && !data.mentorName?.trim()) {
        throw new BusinessRuleError('Mentoria exige um mentor nomeado');
      }
      this.props.mentorName = data.mentorName;
    }
  }
  /**
   * Rule de exposição: a room só appears ao student enquanto estiver AO_VIVO;
   * a recording appears after end.
   */
  urlRoomVisibleAoStudent(): string | null {
    return this.props.status === 'LIVE' ? this.props.roomUrl : null;
  }
}
