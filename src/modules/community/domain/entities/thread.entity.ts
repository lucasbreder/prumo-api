export type ThreadStatus = 'PUBLISHED' | 'PENDING' | 'HIDDEN';
export interface ThreadProps {
  id: string;
  authorId: string;
  category: string;
  content: string;
  status: ThreadStatus;
  likeCount: number;
  replyCount: number;
  pinned: boolean;
  createdAt: Date;
}
export class Thread {
  private constructor(private readonly props: ThreadProps) {}
  static create(data: {
    id: string;
    authorId: string;
    category: string;
    content: string;
    publicadaDirect: boolean;
  }): Thread {
    if (!data.category?.trim() || !data.content?.trim()) {
      throw new Error('Categoria e conteudo sao obrigatorios');
    }
    return new Thread({
      id: data.id,
      authorId: data.authorId,
      category: data.category.trim(),
      content: data.content.trim(),
      status: data.publicadaDirect ? 'PUBLISHED' : 'PENDING',
      likeCount: 0,
      replyCount: 0,
      pinned: false,
      createdAt: new Date(),
    });
  }
  static reconstituir(props: ThreadProps): Thread {
    return new Thread(props);
  }
  get id(): string {
    return this.props.id;
  }
  get authorId(): string {
    return this.props.authorId;
  }
  get category(): string {
    return this.props.category;
  }
  get content(): string {
    return this.props.content;
  }
  get status(): ThreadStatus {
    return this.props.status;
  }
  get likeCount(): number {
    return this.props.likeCount;
  }
  get replyCount(): number {
    return this.props.replyCount;
  }
  get pinned(): boolean {
    return this.props.pinned;
  }
  get createdAt(): Date {
    return this.props.createdAt;
  }
  get aceitaReply(): boolean {
    return this.props.status === 'PUBLISHED';
  }
  publish(): void {
    this.props.status = 'PUBLISHED';
  }
  hide(): void {
    this.props.status = 'HIDDEN';
  }
  sendForReview(): void {
    this.props.status = 'PENDING';
  }
  registerReaction(adicional: boolean): void {
    this.props.likeCount = Math.max(
      0,
      this.props.likeCount + (adicional ? 1 : -1),
    );
  }
  registerReply(): void {
    this.props.replyCount += 1;
  }
  togglePinned(): void {
    this.props.pinned = !this.props.pinned;
  }
}
