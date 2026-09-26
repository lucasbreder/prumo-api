import { CourseReader } from '../../domain/repositories.js';
import { NotFoundError } from '../../../../shared/errors/domain.errors.js';
import { pageOf, Page } from '../../../../shared/pagination/pagination.js';
export interface CoursesDeps {
  courses: CourseReader;
}
export class ListPublicCoursesUseCase {
  constructor(private readonly deps: CoursesDeps) {}
  async execute(filter: {
    track?: string;
    search?: string;
    page: number;
    perPage: number;
  }): Promise<
    Page<{
      id: string;
      title: string;
      slug: string;
      track: string | null;
      description: string;
      coverUrl: string | null;
      featured: boolean;
    }>
  > {
    const { courses, total } = await this.deps.courses.list({
      ...filter,
      status: 'PUBLISHED',
    });
    return pageOf(
      courses.map((c) => ({
        id: c.id,
        title: c.title,
        slug: c.slug,
        track: c.track,
        description: c.description,
        coverUrl: c.coverUrl,
        featured: c.featured,
      })),
      total,
      filter,
    );
  }
}
export class ListTracksUseCase {
  constructor(private readonly deps: CoursesDeps) {}
  async execute(): Promise<{
    tracks: string[];
  }> {
    return { tracks: await this.deps.courses.tracks() };
  }
}
export interface LessonPublicView {
  id: string;
  moduleTitle: string;
  title: string;
  type: string;
  durationSeconds: number | null;
}
export class GetCoursePublicUseCase {
  constructor(private readonly deps: CoursesDeps) {}
  async execute(input: { idOrSlug: string }) {
    const course =
      (await this.deps.courses.byId(input.idOrSlug)) ??
      (await this.deps.courses.bySlug(input.idOrSlug));
    if (!course || course.status !== 'PUBLISHED') {
      throw new NotFoundError('Curso nao encontrado');
    }
    const curriculum = await this.deps.courses.curriculum(course.id, true);
    // Vitrine publishes: never exposes content (URL/text) das lessons.
    const lessons: LessonPublicView[] = curriculum.map((a) => ({
      id: a.lessonId,
      moduleTitle: a.moduleTitle,
      title: a.title,
      type: a.type,
      durationSeconds: a.durationSeconds,
    }));
    return {
      course: {
        id: course.id,
        title: course.title,
        slug: course.slug,
        track: course.track,
        description: course.description,
        coverUrl: course.coverUrl,
      },
      lessons,
    };
  }
}
