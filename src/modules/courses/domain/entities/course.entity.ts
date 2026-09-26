import { BusinessRuleError } from '../../../../shared/errors/domain.errors.js';
export type CourseStatus = 'PUBLISHED' | 'DRAFT';
export interface CourseProps {
  id: string;
  title: string;
  slug: string;
  track: string | null;
  description: string;
  status: CourseStatus;
  coverUrl: string | null;
  featured: boolean;
  order: number;
}
export function slugify(text: string): string {
  return text
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '');
}
export class Course {
  private constructor(private readonly props: CourseProps) {}
  static create(
    data: Pick<CourseProps, 'id' | 'title' | 'description'> &
      Partial<Omit<CourseProps, 'id' | 'title' | 'description' | 'status'>>,
  ): Course {
    if (!data.title?.trim()) {
      throw new BusinessRuleError('O titulo do curso e obrigatorio');
    }
    return new Course({
      track: data.track ?? null,
      coverUrl: data.coverUrl ?? null,
      featured: data.featured ?? false,
      order: data.order ?? 0,
      ...data,
      slug: data.slug ?? slugify(data.title),
      title: data.title.trim(),
      status: 'DRAFT',
    });
  }
  static reconstituir(props: CourseProps): Course {
    return new Course(props);
  }
  get id(): string {
    return this.props.id;
  }
  get title(): string {
    return this.props.title;
  }
  get slug(): string {
    return this.props.slug;
  }
  get track(): string | null {
    return this.props.track;
  }
  get description(): string {
    return this.props.description;
  }
  get status(): CourseStatus {
    return this.props.status;
  }
  get coverUrl(): string | null {
    return this.props.coverUrl;
  }
  get featured(): boolean {
    return this.props.featured;
  }
  get order(): number {
    return this.props.order;
  }
  publish(temLessonPublicada: boolean): void {
    if (!temLessonPublicada) {
      throw new BusinessRuleError(
        'Um curso so pode ser publicado com ao menos uma aula publicada',
      );
    }
    this.props.status = 'PUBLISHED';
  }
  despublicar(): void {
    this.props.status = 'DRAFT';
  }
  editar(
    data: Partial<
      Pick<
        CourseProps,
        | 'title'
        | 'track'
        | 'description'
        | 'coverUrl'
        | 'featured'
        | 'order'
        | 'slug'
      >
    >,
  ): void {
    if (data.title !== undefined) {
      if (!data.title.trim())
        throw new BusinessRuleError('O titulo do curso e obrigatorio');
      this.props.title = data.title.trim();
    }
    if (data.description !== undefined)
      this.props.description = data.description;
    if (data.track !== undefined) this.props.track = data.track;
    if (data.coverUrl !== undefined) this.props.coverUrl = data.coverUrl;
    if (data.featured !== undefined) this.props.featured = data.featured;
    if (data.order !== undefined) this.props.order = data.order;
    if (data.slug !== undefined) this.props.slug = data.slug;
  }
}
