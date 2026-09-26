import { BusinessRuleError } from '../../../../shared/errors/domain.errors.js';
import {
  RichContent,
  blocksHaveContent,
  type ContentBlock,
} from '../rich-content.vo.js';
export type ContentStatus = 'DRAFT' | 'IN_REVIEW' | 'PUBLISHED';
export type LessonType = 'VIDEO' | 'QUIZ' | 'MATERIAL' | 'TEXT';
export interface LessonProps {
  id: string;
  moduleId: string;
  order: number;
  type: LessonType;
  title: string;
  contentUrl: string | null;
  text: string | null;
  blocks: ContentBlock[] | null;
  durationSeconds: number | null;
  status: ContentStatus;
  sentForReviewAt: Date | null;
}
export class Lesson {
  private constructor(private readonly props: LessonProps) {}
  static create(
    data: Omit<
      LessonProps,
      | 'status'
      | 'contentUrl'
      | 'text'
      | 'blocks'
      | 'durationSeconds'
      | 'sentForReviewAt'
    > &
      Partial<
        Pick<LessonProps, 'contentUrl' | 'text' | 'durationSeconds'>
      > & {
        blocks?: unknown;
      },
  ): Lesson {
    if (!data.title?.trim()) {
      throw new BusinessRuleError('O titulo da aula e obrigatorio');
    }
    const { blocks: rawBlocks, ...rest } = data;
    return new Lesson({
      contentUrl: data.contentUrl ?? null,
      text: data.text ?? null,
      durationSeconds: data.durationSeconds ?? null,
      sentForReviewAt: null,
      ...rest,
      blocks:
        rawBlocks === undefined || rawBlocks === null
          ? null
          : RichContent.assert(rawBlocks),
      title: data.title.trim(),
      status: 'DRAFT',
    });
  }
  static reconstituir(props: LessonProps): Lesson {
    return new Lesson(props);
  }
  get id(): string {
    return this.props.id;
  }
  get moduleId(): string {
    return this.props.moduleId;
  }
  get order(): number {
    return this.props.order;
  }
  get type(): LessonType {
    return this.props.type;
  }
  get title(): string {
    return this.props.title;
  }
  get contentUrl(): string | null {
    return this.props.contentUrl;
  }
  get text(): string | null {
    return this.props.text;
  }
  get blocks(): ContentBlock[] | null {
    return this.props.blocks;
  }
  get durationSeconds(): number | null {
    return this.props.durationSeconds;
  }
  get status(): ContentStatus {
    return this.props.status;
  }
  get sentForReviewAt(): Date | null {
    return this.props.sentForReviewAt;
  }
  get temContent(): boolean {
    return Boolean(
      this.props.contentUrl ||
        this.props.text ||
        (this.props.blocks && blocksHaveContent(this.props.blocks)),
    );
  }
  sendForReview(current: Date): void {
    if (this.props.status !== 'DRAFT') {
      throw new BusinessRuleError(
        'Somente rascunhos podem ser enviados para revisao',
      );
    }
    if (!this.temContent) {
      throw new BusinessRuleError(
        'A aula precisa de conteudo (video, texto ou blocos) antes da revisao',
      );
    }
    this.props.status = 'IN_REVIEW';
    this.props.sentForReviewAt = current;
  }
  publish(): void {
    if (this.props.status !== 'IN_REVIEW') {
      throw new BusinessRuleError(
        'Somente aulas em revisao podem ser publicadas',
      );
    }
    this.props.status = 'PUBLISHED';
  }
  rejeitar(): void {
    if (this.props.status !== 'IN_REVIEW') {
      throw new BusinessRuleError(
        'Somente aulas em revisao podem ser rejeitadas',
      );
    }
    this.props.status = 'DRAFT';
    this.props.sentForReviewAt = null;
  }
  // Equipe/admin: define o status diretamente (rascunho <-> publicado <-> revisao),
  // sem passar pelo fluxo de aprovacao do mentor.
  definirStatus(novo: ContentStatus, atual: Date): void {
    if (novo === 'PUBLISHED' && !this.temContent) {
      throw new BusinessRuleError(
        'Aula sem conteudo nao pode ser publicada',
      );
    }
    if (novo === 'IN_REVIEW' && !this.temContent) {
      throw new BusinessRuleError(
        'A aula precisa de conteudo (video, texto ou blocos) antes da revisao',
      );
    }
    this.props.status = novo;
    this.props.sentForReviewAt = novo === 'IN_REVIEW' ? atual : null;
  }
  editContent(
    data: Partial<
      Pick<
        LessonProps,
        'title' | 'contentUrl' | 'text' | 'durationSeconds' | 'order' | 'type'
      >
    > & {
      blocks?: unknown;
    },
    editAsTeam = false,
  ): void {
    if (this.props.status === 'IN_REVIEW' && !editAsTeam) {
      throw new BusinessRuleError(
        'Aula em revisao nao pode ser editada — aguarde o parecer',
      );
    }
    if (data.title !== undefined) {
      if (!data.title.trim())
        throw new BusinessRuleError('O titulo da aula e obrigatorio');
      this.props.title = data.title.trim();
    }
    if (data.contentUrl !== undefined) this.props.contentUrl = data.contentUrl;
    if (data.text !== undefined) this.props.text = data.text;
    if (data.blocks !== undefined) {
      this.props.blocks = RichContent.assert(data.blocks);
    }
    if (data.durationSeconds !== undefined)
      this.props.durationSeconds = data.durationSeconds;
    if (data.order !== undefined) this.props.order = data.order;
    if (data.type !== undefined) this.props.type = data.type;
    if (this.props.status === 'PUBLISHED' && !editAsTeam) {
      // Content alterado by mentor exige nova aprovacao da team.
      this.props.status = 'IN_REVIEW';
      this.props.sentForReviewAt = new Date();
    }
  }
}
