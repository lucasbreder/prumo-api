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
  // Arquivos independentes por tipo; o editor guarda os dois.
  videoUrl: string | null;
  materialUrl: string | null;
  text: string | null;
  blocks: ContentBlock[] | null;
  durationSeconds: number | null;
  status: ContentStatus;
  sentForReviewAt: Date | null;
}
// Entrada de mídia aceita os campos por tipo e o `contentUrl` legado (alocado
// no slot correspondente ao `type`).
interface MidiaInput {
  contentUrl?: string | null;
  videoUrl?: string | null;
  materialUrl?: string | null;
}
function mediaInicial(
  type: LessonType,
  input: MidiaInput,
): { videoUrl: string | null; materialUrl: string | null } {
  let videoUrl = input.videoUrl ?? null;
  let materialUrl = input.materialUrl ?? null;
  if (input.contentUrl !== undefined && input.contentUrl !== null) {
    if (type === 'MATERIAL') materialUrl = input.contentUrl;
    else videoUrl = input.contentUrl;
  }
  return { videoUrl, materialUrl };
}
function mediaPatch(
  type: LessonType,
  atual: { videoUrl: string | null; materialUrl: string | null },
  input: MidiaInput,
): { videoUrl: string | null; materialUrl: string | null } {
  let { videoUrl, materialUrl } = atual;
  if (input.videoUrl !== undefined) videoUrl = input.videoUrl;
  if (input.materialUrl !== undefined) materialUrl = input.materialUrl;
  if (input.contentUrl !== undefined) {
    if (type === 'MATERIAL') materialUrl = input.contentUrl;
    else videoUrl = input.contentUrl;
  }
  return { videoUrl, materialUrl };
}
export class Lesson {
  private constructor(private readonly props: LessonProps) {}
  static create(
    data: Omit<
      LessonProps,
      | 'status'
      | 'videoUrl'
      | 'materialUrl'
      | 'text'
      | 'blocks'
      | 'durationSeconds'
      | 'sentForReviewAt'
    > &
      Partial<Pick<LessonProps, 'text' | 'durationSeconds'>> &
      MidiaInput & {
        blocks?: unknown;
      },
  ): Lesson {
    if (!data.title?.trim()) {
      throw new BusinessRuleError('O titulo da aula e obrigatorio');
    }
    const {
      blocks: rawBlocks,
      contentUrl,
      videoUrl,
      materialUrl,
      ...rest
    } = data;
    const media = mediaInicial(data.type, { contentUrl, videoUrl, materialUrl });
    return new Lesson({
      videoUrl: media.videoUrl,
      materialUrl: media.materialUrl,
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
  get videoUrl(): string | null {
    return this.props.videoUrl;
  }
  get materialUrl(): string | null {
    return this.props.materialUrl;
  }
  // Conteudo ativo conforme o tipo (compat com consumidores que usam contentUrl).
  get contentUrl(): string | null {
    if (this.props.type === 'MATERIAL') return this.props.materialUrl;
    return this.props.videoUrl ?? this.props.materialUrl ?? null;
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
      this.contentUrl ||
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
      Pick<LessonProps, 'title' | 'text' | 'durationSeconds' | 'order' | 'type'>
    > &
      MidiaInput & {
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
    if (data.type !== undefined) this.props.type = data.type;
    const media = mediaPatch(
      this.props.type,
      { videoUrl: this.props.videoUrl, materialUrl: this.props.materialUrl },
      data,
    );
    this.props.videoUrl = media.videoUrl;
    this.props.materialUrl = media.materialUrl;
    if (data.text !== undefined) this.props.text = data.text;
    if (data.blocks !== undefined) {
      this.props.blocks = RichContent.assert(data.blocks);
    }
    if (data.durationSeconds !== undefined)
      this.props.durationSeconds = data.durationSeconds;
    if (data.order !== undefined) this.props.order = data.order;
    if (this.props.status === 'PUBLISHED' && !editAsTeam) {
      // Content alterado by mentor exige nova aprovacao da team.
      this.props.status = 'IN_REVIEW';
      this.props.sentForReviewAt = new Date();
    }
  }
}
