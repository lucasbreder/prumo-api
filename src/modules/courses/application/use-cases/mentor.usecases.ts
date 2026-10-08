import { randomUUID } from 'node:crypto';
import {
  LessonReader,
  LessonWriter,
  CourseReader,
  CoursesEvents,
  MaterialReader,
  MentorLinkReader,
  ModuleReader,
  ModuleWriter,
  StoragePresigner,
} from '../../domain/repositories.js';
import { Lesson } from '../../domain/entities/lesson.entity.js';
import { resolveAssetUrl, resolveBlockImages } from '../resolve-content-images.js';
import {
  AccessDeniedError,
  NotFoundError,
} from '../../../../shared/errors/domain.errors.js';
import { Clock } from '../../../../shared/domain/clock.js';
interface Pub {
  issue(name: string, payload: unknown): void;
}
export interface MentorDeps {
  links: MentorLinkReader;
  courses: CourseReader;
  lessons: LessonReader;
  lessonsWriter: LessonWriter;
  modules: ModuleReader;
  modulesWriter: ModuleWriter;
  clock: Clock;
  events: Pub;
  presigner: StoragePresigner;
}
async function exigirVinculo(
  deps: MentorDeps,
  mentorId: string,
  courseId: string,
): Promise<void> {
  const tem = await deps.links.linkExiste(mentorId, courseId);
  if (!tem) {
    throw new AccessDeniedError(
      'Voce so edita conteudo dos cursos em que e mentor',
    );
  }
}
export class ListCoursesDoMentorUseCase {
  constructor(private readonly deps: MentorDeps) {}
  async execute(input: { mentorId: string }) {
    const [courses, stats] = await Promise.all([
      this.deps.links.coursesDoMentor(input.mentorId),
      this.deps.links.estatisticasByCourse(input.mentorId),
    ]);
    return {
      courses: courses.map((c) => {
        const s = stats[c.id] ?? { totalLessons: 0, lessonsPublicadas: 0 };
        return {
          id: c.id,
          title: c.title,
          slug: c.slug,
          status: c.status,
          totalLessons: s.totalLessons,
          lessonsPublicadas: s.lessonsPublicadas,
          curriculumPublishedPercent:
            s.totalLessons === 0
              ? 0
              : Math.floor((s.lessonsPublicadas / s.totalLessons) * 100),
        };
      }),
    };
  }
}
export class GetCurriculumDoMentorUseCase {
  constructor(private readonly deps: MentorDeps) {}
  async execute(input: { mentorId: string; courseId: string }) {
    await exigirVinculo(this.deps, input.mentorId, input.courseId);
    const course = await this.deps.courses.byId(input.courseId);
    if (!course) throw new NotFoundError('Curso nao encontrado');
    const [lessons, modules] = await Promise.all([
      this.deps.courses.curriculum(input.courseId, false),
      this.deps.modules.listByCourse(input.courseId),
    ]);
    return {
      course: { id: course.id, title: course.title, status: course.status },
      modules,
      lessons: await Promise.all(
        lessons.map(async (a) => ({
          ...a,
          contentUrlSigned: await resolveAssetUrl(a.contentUrl, (k) =>
            this.deps.presigner.resolvePublicUrl(k),
          ),
          blocks: await resolveBlockImages(a.blocks, (k) =>
            this.deps.presigner.resolvePublicUrl(k),
          ),
        })),
      ),
    };
  }
}
export class AddModuleComoMentorUseCase {
  constructor(private readonly deps: MentorDeps) {}
  async execute(input: { mentorId: string; courseId: string; title: string }) {
    await exigirVinculo(this.deps, input.mentorId, input.courseId);
    const order = await this.deps.modules.nextOrder(input.courseId);
    const module = {
      id: randomUUID(),
      courseId: input.courseId,
      order,
      title: input.title,
    };
    await this.deps.modulesWriter.create(module);
    return module;
  }
}
export class AddLessonComoMentorUseCase {
  constructor(private readonly deps: MentorDeps) {}
  async execute(input: {
    mentorId: string;
    courseId: string;
    moduleId?: string;
    title: string;
    type: 'VIDEO' | 'QUIZ' | 'MATERIAL' | 'TEXT';
    contentUrl?: string;
    text?: string;
    blocks?: unknown;
    durationSeconds?: number;
  }) {
    if (!input.moduleId) {
      throw new NotFoundError('Modulo nao informado');
    }
    const module = await this.deps.modules.byId(input.moduleId);
    if (!module) throw new NotFoundError('Modulo nao encontrado');
    if (module.courseId !== input.courseId) {
      throw new NotFoundError('Modulo nao pertence a este curso');
    }
    await exigirVinculo(this.deps, input.mentorId, module.courseId);
    const lessonsDoModule = await this.deps.courses.curriculum(
      module.courseId,
      false,
    );
    const order =
      lessonsDoModule.filter((a) => a.moduleId === input.moduleId).length + 1;
    const lesson = Lesson.create({
      id: randomUUID(),
      moduleId: module.id,
      order,
      type: input.type,
      title: input.title,
      contentUrl: input.contentUrl,
      text: input.text,
      blocks: input.blocks,
      durationSeconds: input.durationSeconds,
    });
    await this.deps.lessonsWriter.create(lesson, module.courseId);
    return { id: lesson.id, status: lesson.status, order };
  }
}
export class EditLessonAsMentorUseCase {
  constructor(private readonly deps: MentorDeps) {}
  async execute(input: {
    mentorId: string;
    lessonId: string;
    data: Parameters<Lesson['editContent']>[0];
  }) {
    const referencia = await this.deps.lessons.byId(input.lessonId);
    if (!referencia) throw new NotFoundError('Aula nao encontrada');
    await exigirVinculo(this.deps, input.mentorId, referencia.courseId);
    referencia.lesson.editContent(input.data);
    await this.deps.lessonsWriter.save(referencia.lesson);
    return { id: referencia.lesson.id, status: referencia.lesson.status };
  }
}
export class SendLessonForReviewUseCase {
  constructor(private readonly deps: MentorDeps) {}
  async execute(input: { mentorId: string; lessonId: string }) {
    const referencia = await this.deps.lessons.byId(input.lessonId);
    if (!referencia) throw new NotFoundError('Aula nao encontrada');
    await exigirVinculo(this.deps, input.mentorId, referencia.courseId);
    referencia.lesson.sendForReview(this.deps.clock.now());
    await this.deps.lessonsWriter.save(referencia.lesson);
    this.deps.events.issue(CoursesEvents.LessonEMReview, {
      lessonId: referencia.lesson.id,
      courseId: referencia.courseId,
      mentorId: input.mentorId,
    });
    return { id: referencia.lesson.id, status: referencia.lesson.status };
  }
}
export class RemoveLessonComoMentorUseCase {
  constructor(private readonly deps: MentorDeps) {}
  async execute(input: { mentorId: string; lessonId: string }) {
    const referencia = await this.deps.lessons.byId(input.lessonId);
    if (!referencia) throw new NotFoundError('Aula nao encontrada');
    await exigirVinculo(this.deps, input.mentorId, referencia.courseId);
    await this.deps.lessonsWriter.remove(input.lessonId);
    return { id: input.lessonId };
  }
}
export class ListMaterialsDoMentorUseCase {
  constructor(
    private readonly deps: {
      links: MentorLinkReader;
      materials: MaterialReader;
    },
  ) {}
  async execute(input: { mentorId: string }) {
    const courses = await this.deps.links.coursesDoMentor(input.mentorId);
    const ids = new Set(courses.map((c) => c.id));
    const materials = await this.deps.materials.listAll();
    return {
      materials: materials.filter(
        (m) => m.courseId !== null && ids.has(m.courseId),
      ),
    };
  }
}
