import { describe, expect, it, beforeEach } from 'vitest';
import { randomUUID } from 'node:crypto';
import { Course } from '../../domain/entities/course.entity.js';
import { Lesson } from '../../domain/entities/lesson.entity.js';
import {
  FakeLessonRepo,
  FakeCourseRepo,
  FakeMaterialRepo,
  FakeEnrollmentRepo,
  FakeModuleRepo,
  FakePresigner,
  FakeProgressRepo,
  gateFalso,
  pubFalsa,
} from '../fakes/courses.fakes.js';
import {
  ListPublicCoursesUseCase,
  GetCoursePublicUseCase,
} from './public.usecases.js';
import {
  CompleteLessonUseCase,
  ListConcluidosUseCase,
  ListDownloadsUseCase,
  ListMeusCoursesUseCase,
  EnrollCourseUseCase,
  MeuProgressUseCase,
  GetMeuCourseUseCase,
} from './student.usecases.js';
import {
  AddLessonComoMentorUseCase,
  SendLessonForReviewUseCase,
  ListCoursesDoMentorUseCase,
  GetCurriculumDoMentorUseCase,
} from './mentor.usecases.js';
import {
  AddModuleUseCase,
  AddLessonUseCase,
  CompleteMultipartUploadUseCase,
  InitiateMultipartUploadUseCase,
  PresignUploadUseCase,
  RemoveLessonUseCase,
  ReviewLessonUseCase,
  SaveCourseUseCase,
} from './team.usecases.js';
import {
  AccessDeniedError,
  NotFoundError,
  BusinessRuleError,
} from '../../../../shared/errors/domain.errors.js';
import { Clock } from '../../../../shared/domain/clock.js';
class ClockFixo implements Clock {
  data = new Date('2026-09-04T12:00:00.000Z');
  now(): Date {
    return this.data;
  }
}
type FakeMentorLinks = {
  links: Map<string, Set<string>>;
  coursesDoMentor(
    mentorId: string,
  ): Promise<import('../../domain/repositories.js').CourseResumo[]>;
  linkExiste(mentorId: string, courseId: string): Promise<boolean>;
  estatisticasByCourse(mentorId: string): Promise<
    Record<
      string,
      {
        totalLessons: number;
        lessonsPublicadas: number;
      }
    >
  >;
};
function mentorLinksFake(courses: FakeCourseRepo): FakeMentorLinks {
  const links = new Map<string, Set<string>>();
  return {
    links,
    async coursesDoMentor(mentorId) {
      const ids = links.get(mentorId) ?? new Set();
      return [...ids].map((id) => {
        const c = courses.courses.get(id);
        if (!c) throw new Error('curso sumido');
        return {
          id: c.id,
          title: c.title,
          slug: c.slug,
          track: c.track,
          description: c.description,
          status: c.status,
          coverUrl: c.coverUrl,
          featured: c.featured,
          order: c.order,
          totalModules: 0,
          totalLessons: 0,
          totalStudents: 0,
        };
      });
    },
    async linkExiste(mentorId, courseId) {
      return (links.get(mentorId) ?? new Set()).has(courseId);
    },
    async estatisticasByCourse(mentorId) {
      const ids = links.get(mentorId) ?? new Set();
      const stats: Record<
        string,
        {
          totalLessons: number;
          lessonsPublicadas: number;
        }
      > = {};
      for (const id of ids) {
        const todas = await courses.curriculum(id, false);
        stats[id] = {
          totalLessons: todas.length,
          lessonsPublicadas: todas.filter((a) => a.status === 'PUBLISHED')
            .length,
        };
      }
      return stats;
    },
  };
}
function contexto() {
  const courses = new FakeCourseRepo();
  const lessons = new FakeLessonRepo();
  const modules = new FakeModuleRepo();
  const enrollments = new FakeEnrollmentRepo();
  const progress = new FakeProgressRepo();
  const materials = new FakeMaterialRepo();
  const presigner = new FakePresigner();
  const events: {
    name: string;
    payload: unknown;
  }[] = [];
  const clock = new ClockFixo();
  const gate = gateFalso();
  const links = mentorLinksFake(courses);
  const depsStudent = {
    courses,
    enrollments,
    progress,
    lessons,
    materials,
    gate,
    events: pubFalsa(events),
    clock,
    presigner,
  };
  const depsEquipe = {
    courses,
    lessons,
    lessonsWriter: lessons,
    modules,
    materials,
    presigner,
  };
  const depsMentor = {
    links,
    courses,
    lessons,
    lessonsWriter: lessons,
    modules,
    modulesWriter: modules,
    clock,
    events: pubFalsa(events),
    presigner,
  };
  const course = Course.create({
    id: randomUUID(),
    title: 'Gestao de Estudio',
    description: 'Tudo sobre precificar, vender e escalar.',
    track: 'gestao',
  });
  course.publish(true);
  courses.create(course);
  enrollments.coursesById.set(course.id, course);
  const module = {
    id: 'mod1',
    courseId: course.id,
    order: 1,
    title: 'Fundamentos',
  };
  modules.modules.set(module.id, module);
  courses.modules.push(module);
  function lessonPublicada(name: string, order: number): Lesson {
    const lesson = Lesson.create({
      id: `aula-${name}`,
      moduleId: module.id,
      order,
      type: 'VIDEO',
      title: name,
      contentUrl: 'https://cdn/x.mp4',
    });
    lesson.sendForReview(new Date());
    lesson.publish();
    lessons.lessons.set(lesson.id, { lesson, courseId: course.id });
    progress.courseByLesson.set(lesson.id, course.id);
    courses.lessons.push({
      moduleId: module.id,
      moduleOrder: 1,
      moduleTitle: module.title,
      lessonId: lesson.id,
      lessonOrder: order,
      type: 'VIDEO',
      title: name,
      status: 'PUBLISHED',
      contentUrl: 'https://cdn/x.mp4',
      text: null,
      blocks: null,
      durationSeconds: 600,
      sentForReviewAt: null,
    });
    return lesson;
  }
  return {
    course,
    courses,
    lessons,
    modules,
    enrollments,
    progress,
    materials,
    presigner,
    events,
    gate,
    links,
    depsStudent,
    depsEquipe,
    depsMentor,
    lessonPublicada,
  };
}
describe('Catalogo publico', () => {
  it('lista somente cursos publicados e nao expoe conteudo', async () => {
    const ctx = contexto();
    ctx.lessonPublicada('Aula 1', 1);
    const listCourses = new ListPublicCoursesUseCase({ courses: ctx.courses });
    const list = await listCourses.execute({ page: 1, perPage: 12 });
    expect(list.items).toHaveLength(1);
    const hidden = Course.create({
      id: 'c2',
      title: 'Oculto',
      description: 'x',
    });
    ctx.courses.create(hidden);
    const listAgain = await listCourses.execute({ page: 1, perPage: 12 });
    expect(listAgain.items.map((c) => c.title)).toEqual(['Gestao de Estudio']);
    const detail = new GetCoursePublicUseCase({ courses: ctx.courses });
    const view = await detail.execute({ idOrSlug: ctx.course.slug });
    expect(view.lessons[0]).not.toHaveProperty('contentUrl');
    await expect(detail.execute({ idOrSlug: 'c2' })).rejects.toBeInstanceOf(
      NotFoundError,
    );
  });
});
describe('Area do aluno', () => {
  let ctx: ReturnType<typeof contexto>;
  const student = 'aluno-1';
  beforeEach(() => {
    ctx = contexto();
    ctx.lessonPublicada('A1', 1);
    ctx.lessonPublicada('A2', 2);
  });
  it('sem plano ativo nao acessa nada do painel', async () => {
    await expect(
      new ListMeusCoursesUseCase({
        ...ctx.depsStudent,
        gate: gateFalso(['sem-plano']),
      }).execute({ studentId: 'sem-plano' }),
    ).rejects.toBeInstanceOf(AccessDeniedError);
  });
  it('enroll e idempotente', async () => {
    const usecase = new EnrollCourseUseCase(ctx.depsStudent);
    expect(
      (await usecase.execute({ studentId: student, courseId: ctx.course.id }))
        .created,
    ).toBe(true);
    expect(
      (await usecase.execute({ studentId: student, courseId: ctx.course.id }))
        .created,
    ).toBe(false);
  });
  it('nao enxerga curso em curriculo se nao estiver matriculado', async () => {
    await expect(
      new GetMeuCourseUseCase(ctx.depsStudent).execute({
        studentId: student,
        courseId: ctx.course.id,
      }),
    ).rejects.toBeInstanceOf(AccessDeniedError);
  });
  it('progresso persiste aula a aula e calcula certificado', async () => {
    await new EnrollCourseUseCase(ctx.depsStudent).execute({
      studentId: student,
      courseId: ctx.course.id,
    });
    const complete = new CompleteLessonUseCase(ctx.depsStudent);
    const primeiro = await complete.execute({
      studentId: student,
      lessonId: 'aula-A1',
    });
    expect(primeiro).toMatchObject({
      progressPercent: 50,
      completed: false,
      nextLessonId: 'aula-A2',
    });
    const detail = await new GetMeuCourseUseCase(ctx.depsStudent).execute({
      studentId: student,
      courseId: ctx.course.id,
    });
    expect(detail.lessons.find((a) => a.id === 'aula-A1')?.completed).toBe(
      true,
    );
    expect(detail.progressPercent).toBe(50);
    const second = await complete.execute({
      studentId: student,
      lessonId: 'aula-A2',
    });
    expect(second.completed).toBe(true);
    expect(second.certificate?.issuedAt).toBe('2026-09-04T12:00:00.000Z');
    expect(ctx.events.some((e) => e.name === 'cursos.curso_concluido')).toBe(
      true,
    );
    const concluidos = await new ListConcluidosUseCase(ctx.depsStudent).execute(
      { studentId: student },
    );
    expect(concluidos.certificates).toHaveLength(1);
    const progress = await new MeuProgressUseCase(ctx.depsStudent).execute({
      studentId: student,
    });
    expect(progress.continuarDe).toBeNull();
  });
  it('nao conclui aula nao publicada', async () => {
    const lessonDRAFT = Lesson.create({
      id: 'aula-rascunho',
      moduleId: 'mod1',
      order: 3,
      type: 'VIDEO',
      title: 'Rascunho',
    });
    ctx.lessons.lessons.set('aula-rascunho', {
      lesson: lessonDRAFT,
      courseId: ctx.course.id,
    });
    await new EnrollCourseUseCase(ctx.depsStudent).execute({
      studentId: student,
      courseId: ctx.course.id,
    });
    await expect(
      new CompleteLessonUseCase(ctx.depsStudent).execute({
        studentId: student,
        lessonId: 'aula-rascunho',
      }),
    ).rejects.toThrow(/indisponivel/i);
  });
  it('downloads so de cursos matriculados + avulsos', async () => {
    ctx.materials.materials.push(
      {
        id: 'm-avulso',
        name: 'Checklist.pdf',
        type: 'CHECKLIST',
        url: 'https://cdn/checklist.pdf',
        sizeBytes: 1,
        courseId: null,
        moduleId: null,
        lessonId: null,
        createdAt: new Date(),
      },
      {
        id: 'm-curso',
        name: 'Planilha.xlsx',
        type: 'SPREADSHEET',
        url: 'https://cdn/planilha.xlsx',
        sizeBytes: 2,
        courseId: ctx.course.id,
        moduleId: null,
        lessonId: null,
        createdAt: new Date(),
      },
      {
        id: 'm-outro',
        name: 'Outro.pdf',
        type: 'PDF',
        url: 'https://cdn/outro.pdf',
        sizeBytes: 3,
        courseId: 'outro-curso',
        moduleId: null,
        lessonId: null,
        createdAt: new Date(),
      },
    );
    const usecase = new ListDownloadsUseCase(ctx.depsStudent);
    const antes = await usecase.execute({ studentId: student });
    expect(antes.materials.map((m) => m.id)).toEqual(['m-avulso']);
    await new EnrollCourseUseCase(ctx.depsStudent).execute({
      studentId: student,
      courseId: ctx.course.id,
    });
    ctx.materials.enrollmentsStudent.set(student, [ctx.course.id]);
    const depois = await usecase.execute({
      studentId: student,
      type: 'SPREADSHEET',
    });
    expect(depois.materials.map((m) => m.id)).toEqual(['m-curso']);
  });
});
describe('Escopo do mentor', () => {
  let ctx: ReturnType<typeof contexto>;
  const mentor = 'mentor-1';
  const intruso = 'mentor-2';
  beforeEach(() => {
    ctx = contexto();
    ctx.links.links.set(mentor, new Set([ctx.course.id]));
  });
  it('ve somente os cursos vinculados', async () => {
    const output = await new ListCoursesDoMentorUseCase(ctx.depsMentor).execute(
      { mentorId: mentor },
    );
    expect(output.courses).toHaveLength(1);
    const empty = await new ListCoursesDoMentorUseCase(ctx.depsMentor).execute({
      mentorId: intruso,
    });
    expect(empty.courses).toHaveLength(0);
  });
  it('nao edita aula de curso sem vinculo', async () => {
    ctx.lessonPublicada('A1', 1);
    await expect(
      new GetCurriculumDoMentorUseCase(ctx.depsMentor).execute({
        mentorId: intruso,
        courseId: ctx.course.id,
      }),
    ).rejects.toBeInstanceOf(AccessDeniedError);
  });
  it('cria aula como rascunho e envia para revisao', async () => {
    const create = new AddLessonComoMentorUseCase(ctx.depsMentor);
    const created = await create.execute({
      mentorId: mentor,
      courseId: ctx.course.id,
      moduleId: 'mod1',
      title: 'Caixa do estudio',
      type: 'VIDEO',
      contentUrl: 'https://cdn/nova.mp4',
    });
    expect(created.status).toBe('DRAFT');
    const review = new SendLessonForReviewUseCase(ctx.depsMentor);
    const output = await review.execute({
      mentorId: mentor,
      lessonId: created.id,
    });
    expect(output.status).toBe('IN_REVIEW');
    expect(ctx.events.some((e) => e.name === 'cursos.aula_em_revisao')).toBe(
      true,
    );
  });
  it('materiais: mentor ve apenas os dos seus cursos', async () => {
    const { ListMaterialsDoMentorUseCase } =
      await import('./mentor.usecases.js');
    ctx.materials.materials.push(
      {
        id: 'ma',
        name: 'a.pdf',
        type: 'PDF',
        url: 'u',
        sizeBytes: 1,
        courseId: ctx.course.id,
        moduleId: null,
        lessonId: null,
        createdAt: new Date(),
      },
      {
        id: 'mb',
        name: 'b.pdf',
        type: 'PDF',
        url: 'u',
        sizeBytes: 1,
        courseId: 'de-outro',
        moduleId: null,
        lessonId: null,
        createdAt: new Date(),
      },
      {
        id: 'mc',
        name: 'c.pdf',
        type: 'PDF',
        url: 'u',
        sizeBytes: 1,
        courseId: null,
        moduleId: null,
        lessonId: null,
        createdAt: new Date(),
      },
    );
    const output = await new ListMaterialsDoMentorUseCase({
      links: ctx.links as never,
      materials: ctx.materials,
    }).execute({ mentorId: mentor });
    expect(output.materials.map((m: { id: string }) => m.id)).toEqual(['ma']);
  });
  it('editar aula publicada volta para em revisao', async () => {
    ctx.lessonPublicada('A1', 1);
    const usecase = new AddLessonComoMentorUseCase(ctx.depsMentor);
    void usecase;
    const { EditLessonAsMentorUseCase } = await import('./mentor.usecases.js');
    const editada = await new EditLessonAsMentorUseCase(ctx.depsMentor).execute(
      {
        mentorId: mentor,
        lessonId: 'aula-A1',
        data: { title: 'A1 v2' },
      },
    );
    expect(editada.status).toBe('IN_REVIEW');
  });
  it('remove aula do proprio curso', async () => {
    const { RemoveLessonComoMentorUseCase } = await import(
      './mentor.usecases.js'
    );
    ctx.lessonPublicada('A1', 1);
    await new RemoveLessonComoMentorUseCase(ctx.depsMentor).execute({
      mentorId: mentor,
      lessonId: 'aula-A1',
    });
    expect(ctx.lessons.lessons.has('aula-A1')).toBe(false);
  });
  it('nao remove aula de curso sem vinculo', async () => {
    const { RemoveLessonComoMentorUseCase } = await import(
      './mentor.usecases.js'
    );
    ctx.lessonPublicada('A1', 1);
    await expect(
      new RemoveLessonComoMentorUseCase(ctx.depsMentor).execute({
        mentorId: intruso,
        lessonId: 'aula-A1',
      }),
    ).rejects.toBeInstanceOf(AccessDeniedError);
    expect(ctx.lessons.lessons.has('aula-A1')).toBe(true);
  });
  it('currículo inclui módulo recém-criado mesmo sem aulas', async () => {
    const { AddModuleComoMentorUseCase } = await import('./mentor.usecases.js');
    await new AddModuleComoMentorUseCase(ctx.depsMentor).execute({
      mentorId: mentor,
      courseId: ctx.course.id,
      title: 'Módulo novo',
    });
    const out = await new GetCurriculumDoMentorUseCase(ctx.depsMentor).execute({
      mentorId: mentor,
      courseId: ctx.course.id,
    });
    expect(out.modules.map((m) => m.title)).toContain('Fundamentos');
    expect(out.modules.map((m) => m.title)).toContain('Módulo novo');
  });
});
describe('Equipe (admin): curriculo, revisao e uploads', () => {
  let ctx: ReturnType<typeof contexto>;
  beforeEach(() => {
    ctx = contexto();
  });
  it('publica curso apenas com conteudo publicado', async () => {
    ctx.course.despublicar();
    const save = new SaveCourseUseCase(ctx.depsEquipe);
    await expect(
      save.execute({
        id: ctx.course.id,
        title: 'Gestao de Estudio',
        description: 'desc',
        publish: true,
      }),
    ).rejects.toBeInstanceOf(BusinessRuleError);
    expect(ctx.course.status).toBe('DRAFT');
    ctx.lessonPublicada('A1', 1);
    await save.execute({
      id: ctx.course.id,
      title: 'Gestao de Estudio',
      description: 'desc',
      publish: true,
    });
    expect(ctx.course.status).toBe('PUBLISHED');
  });
  it('aprova e reprova revisao', async () => {
    const lesson = Lesson.create({
      id: 'aula-x',
      moduleId: 'mod1',
      order: 1,
      type: 'VIDEO',
      title: 'X',
      contentUrl: 'https://cdn/x.mp4',
    });
    lesson.sendForReview(new Date());
    ctx.lessons.lessons.set('aula-x', { lesson, courseId: ctx.course.id });
    const review = new ReviewLessonUseCase(ctx.depsEquipe);
    const approved = await review.approve('aula-x');
    expect(approved.status).toBe('PUBLISHED');
    const aula2 = Lesson.create({
      id: 'aula-y',
      moduleId: 'mod1',
      order: 2,
      type: 'VIDEO',
      title: 'Y',
    });
    ctx.lessons.lessons.set('aula-y', {
      lesson: aula2,
      courseId: ctx.course.id,
    });
    await expect(review.approve('aula-y')).rejects.toThrow(/revisao/i);
    const aula3 = Lesson.create({
      id: 'aula-z',
      moduleId: 'mod1',
      order: 3,
      type: 'VIDEO',
      title: 'Z',
      contentUrl: 'https://cdn/z.mp4',
    });
    aula3.sendForReview(new Date());
    ctx.lessons.lessons.set('aula-z', {
      lesson: aula3,
      courseId: ctx.course.id,
    });
    expect((await review.reject('aula-z')).status).toBe('DRAFT');
  });
  it('adiciona modulo e aula com ordem sequencial', async () => {
    const module = await new AddModuleUseCase(ctx.depsEquipe).execute({
      courseId: ctx.course.id,
      title: 'Vendas',
    });
    expect(module.order).toBe(2);
    const lesson = await new AddLessonUseCase(ctx.depsEquipe).execute({
      moduleId: module.id,
      title: 'Proposta vencedora',
      type: 'MATERIAL',
      text: 'roteiro',
    });
    expect(lesson.order).toBe(1);
  });
  it('equipe remove aula do curriculo', async () => {
    ctx.lessonPublicada('A1', 1);
    await new RemoveLessonUseCase(ctx.depsEquipe).execute({
      lessonId: 'aula-A1',
    });
    expect(ctx.lessons.lessons.has('aula-A1')).toBe(false);
    await expect(
      new RemoveLessonUseCase(ctx.depsEquipe).execute({
        lessonId: 'aula-inexistente',
      }),
    ).rejects.toBeInstanceOf(NotFoundError);
  });
  it('equipe alterna status rascunho <-> publicado diretamente', async () => {
    const lesson = Lesson.create({
      id: 'aula-st',
      moduleId: 'mod1',
      order: 1,
      type: 'MATERIAL',
      title: 'S',
      text: 'conteudo',
    });
    ctx.lessons.lessons.set('aula-st', { lesson, courseId: ctx.course.id });
    const review = new ReviewLessonUseCase(ctx.depsEquipe);
    expect((await review.setStatus('aula-st', 'PUBLISHED')).status).toBe(
      'PUBLISHED',
    );
    expect((await review.setStatus('aula-st', 'DRAFT')).status).toBe('DRAFT');
    const vazio = Lesson.create({
      id: 'aula-vazio',
      moduleId: 'mod1',
      order: 2,
      type: 'MATERIAL',
      title: 'V',
    });
    ctx.lessons.lessons.set('aula-vazio', {
      lesson: vazio,
      courseId: ctx.course.id,
    });
    await expect(
      review.setStatus('aula-vazio', 'PUBLISHED'),
    ).rejects.toThrow(/conteudo/i);
  });
  it('presign aceita so formatos permitidos', async () => {
    const presign = new PresignUploadUseCase(ctx.depsEquipe);
    const ok = await presign.execute({
      userId: 'mentor-1',
      nameArquivo: 'aula 01 (final).mp4',
      sizeBytes: 12345,
    });
    expect(ok.url).toContain('uploads/mentor-1');
    const img = await presign.execute({
      userId: 'admin-1',
      nameArquivo: 'hero.jpg',
      sizeBytes: 999,
    });
    expect(img.url).toContain('uploads/admin-1');
    await expect(
      presign.execute({
        userId: 'x',
        nameArquivo: 'malware.exe',
        sizeBytes: 1,
      }),
    ).rejects.toThrow(/Formato/);
  });
  it('multipart de aula: divide em partes e conclui ordenado', async () => {
    const iniciar = new InitiateMultipartUploadUseCase(ctx.depsEquipe);
    const inicio = await iniciar.execute({
      userId: 'mentor-1',
      nameArquivo: 'aula longa.mp4',
      sizeBytes: 250 * 1024 * 1024,
    });
    expect(inicio.chave).toContain('uploads/mentor-1');
    expect(inicio.partSize).toBe(100 * 1024 * 1024);
    expect(inicio.partes.map((p) => p.parte)).toEqual([1, 2, 3]);
    expect(inicio.partes[0].url).toContain('part=1');
    expect(ctx.presigner.multipartCriados).toHaveLength(1);

    const concluir = new CompleteMultipartUploadUseCase(ctx.depsEquipe);
    await concluir.execute({
      chave: inicio.chave,
      uploadId: inicio.uploadId,
      partes: [
        { parte: 2, etag: 'b' },
        { parte: 1, etag: 'a' },
      ],
    });
    expect(ctx.presigner.partesConcluidas[0].partes).toEqual([
      { parte: 1, etag: 'a' },
      { parte: 2, etag: 'b' },
    ]);
  });
  it('multipart rejeita arquivo acima de 20 GB', async () => {
    const iniciar = new InitiateMultipartUploadUseCase(ctx.depsEquipe);
    await expect(
      iniciar.execute({
        userId: 'mentor-1',
        nameArquivo: 'gigante.mp4',
        sizeBytes: 20 * 1024 * 1024 * 1024 + 1,
      }),
    ).rejects.toBeInstanceOf(BusinessRuleError);
  });
});
describe('Conteudo textual em blocos (TEXT)', () => {
  const blocks = [
    { type: 'heading', level: 2, content: [{ text: 'Como precificar' }] },
    {
      type: 'paragraph',
      content: [{ text: 'Abra a planilha ao lado.' }],
    },
    { type: 'image', key: 'content/planta-baixa.webp', alt: 'Planta' },
  ];
  it('mentor cria aula TEXT e envia para revisao', async () => {
    const ctx = contexto();
    ctx.links.links.set('mentor-1', new Set([ctx.course.id]));
    const created = await new AddLessonComoMentorUseCase(ctx.depsMentor).execute(
      {
        mentorId: 'mentor-1',
        courseId: ctx.course.id,
        moduleId: 'mod1',
        title: 'Leitura: precificacao',
        type: 'TEXT',
        blocks,
      },
    );
    expect(created.status).toBe('DRAFT');
    const revisada = await new SendLessonForReviewUseCase(
      ctx.depsMentor,
    ).execute({ mentorId: 'mentor-1', lessonId: created.id });
    expect(revisada.status).toBe('IN_REVIEW');
    const guardado = ctx.lessons.lessons.get(created.id)?.lesson;
    expect(guardado?.blocks).toHaveLength(3);
  });
  it('bloco invalido na criacao lanca erro de dominio', async () => {
    const ctx = contexto();
    ctx.links.links.set('mentor-1', new Set([ctx.course.id]));
    await expect(
      new AddLessonComoMentorUseCase(ctx.depsMentor).execute({
        mentorId: 'mentor-1',
        courseId: ctx.course.id,
        moduleId: 'mod1',
        title: 'Ruim',
        type: 'TEXT',
        blocks: [{ type: 'iframe', src: 'x' }],
      }),
    ).rejects.toBeInstanceOf(BusinessRuleError);
  });
  it('aluno matriculado recebe blocos com imagem assinada', async () => {
    const ctx = contexto();
    const student = 'aluno-blocos';
    const lesson = Lesson.create({
      id: 'aula-texto',
      moduleId: 'mod1',
      order: 1,
      type: 'TEXT',
      title: 'Leitura',
      blocks,
    });
    lesson.sendForReview(new Date());
    lesson.publish();
    ctx.lessons.lessons.set('aula-texto', { lesson, courseId: ctx.course.id });
    ctx.progress.courseByLesson.set('aula-texto', ctx.course.id);
    ctx.courses.lessons.push({
      moduleId: 'mod1',
      moduleOrder: 1,
      moduleTitle: 'Fundamentos',
      lessonId: 'aula-texto',
      lessonOrder: 1,
      type: 'TEXT',
      title: 'Leitura',
      status: 'PUBLISHED',
      contentUrl: null,
      text: null,
      blocks: lesson.blocks,
      durationSeconds: null,
      sentForReviewAt: null,
    });
    await new EnrollCourseUseCase(ctx.depsStudent).execute({
      studentId: student,
      courseId: ctx.course.id,
    });
    const detail = await new GetMeuCourseUseCase(ctx.depsStudent).execute({
      studentId: student,
      courseId: ctx.course.id,
    });
    const aula = detail.lessons.find((a) => a.id === 'aula-texto');
    expect(aula?.blocks).toMatchObject([
      { type: 'heading' },
      { type: 'paragraph' },
      { type: 'image', key: 'content/planta-baixa.webp', url: expect.stringContaining('img.test') },
    ]);
  });
  it('aluno nao recebe blocos de aula nao publicada', async () => {
    const ctx = contexto();
    const student = 'aluno-rascunho';
    const lesson = Lesson.create({
      id: 'aula-texto-draft',
      moduleId: 'mod1',
      order: 1,
      type: 'TEXT',
      title: 'Rascunho',
      blocks,
    });
    ctx.lessons.lessons.set('aula-texto-draft', {
      lesson,
      courseId: ctx.course.id,
    });
    ctx.courses.lessons.push({
      moduleId: 'mod1',
      moduleOrder: 1,
      moduleTitle: 'Fundamentos',
      lessonId: 'aula-texto-draft',
      lessonOrder: 1,
      type: 'TEXT',
      title: 'Rascunho',
      status: 'DRAFT',
      contentUrl: null,
      text: null,
      blocks: lesson.blocks,
      durationSeconds: null,
      sentForReviewAt: null,
    });
    await new EnrollCourseUseCase(ctx.depsStudent).execute({
      studentId: student,
      courseId: ctx.course.id,
    });
    const detail = await new GetMeuCourseUseCase(ctx.depsStudent).execute({
      studentId: student,
      courseId: ctx.course.id,
    });
    expect(
      detail.lessons.find((a) => a.id === 'aula-texto-draft'),
    ).toBeUndefined();
  });
  it('equipe edita blocos de aula publicada sem forcar nova revisao', async () => {
    const ctx = contexto();
    const lesson = Lesson.create({
      id: 'aula-edit-team',
      moduleId: 'mod1',
      order: 1,
      type: 'TEXT',
      title: 'Ja publicada',
      blocks: [{ type: 'paragraph', content: [{ text: 'antigo' }] }],
    });
    lesson.sendForReview(new Date());
    lesson.publish();
    ctx.lessons.lessons.set('aula-edit-team', {
      lesson,
      courseId: ctx.course.id,
    });
    const review = new ReviewLessonUseCase(ctx.depsEquipe);
    const out = await review.editAsTeam('aula-edit-team', {
      blocks: [{ type: 'paragraph', content: [{ text: 'novo' }] }],
    });
    expect(out.status).toBe('PUBLISHED');
    expect(ctx.lessons.lessons.get('aula-edit-team')?.lesson.blocks).toEqual([
      { type: 'paragraph', content: [{ text: 'novo' }] },
    ]);
    await expect(
      review.editAsTeam('aula-edit-team', {
        blocks: [{ type: 'nope' }],
      }),
    ).rejects.toBeInstanceOf(BusinessRuleError);
  });
});
describe('Upload de conteúdo (chaves assinadas na leitura)', () => {
  const chave = 'uploads/mentor-1/aula-nota.mp4';
  function aulaVideoComChave(
    ctx: ReturnType<typeof contexto>,
    status: 'PUBLISHED' | 'DRAFT',
  ): void {
    const lesson = Lesson.create({
      id: 'aula-upload',
      moduleId: 'mod1',
      order: 1,
      type: 'VIDEO',
      title: 'Aula em vídeo',
      contentUrl: chave,
    });
    if (status === 'PUBLISHED') {
      lesson.sendForReview(new Date());
      lesson.publish();
    }
    ctx.lessons.lessons.set('aula-upload', {
      lesson,
      courseId: ctx.course.id,
    });
    ctx.courses.lessons.push({
      moduleId: 'mod1',
      moduleOrder: 1,
      moduleTitle: 'Fundamentos',
      lessonId: 'aula-upload',
      lessonOrder: 1,
      type: 'VIDEO',
      title: 'Aula em vídeo',
      status,
      contentUrl: chave,
      text: null,
      blocks: null,
      durationSeconds: 600,
      sentForReviewAt: null,
    });
  }
  it('aluno recebe URL assinada para a chave gravada', async () => {
    const ctx = contexto();
    aulaVideoComChave(ctx, 'PUBLISHED');
    await new EnrollCourseUseCase(ctx.depsStudent).execute({
      studentId: 'aluno-up',
      courseId: ctx.course.id,
    });
    const detail = await new GetMeuCourseUseCase(ctx.depsStudent).execute({
      studentId: 'aluno-up',
      courseId: ctx.course.id,
    });
    const aula = detail.lessons.find((a) => a.id === 'aula-upload');
    expect(aula?.contentUrl).toContain('img.test');
    expect(aula?.contentUrl).not.toBe(chave);
  });
  it('currículo do mentor mantém a chave crua e expõe URL assinada', async () => {
    const ctx = contexto();
    ctx.links.links.set('mentor-1', new Set([ctx.course.id]));
    aulaVideoComChave(ctx, 'DRAFT');
    const out = await new GetCurriculumDoMentorUseCase(ctx.depsMentor).execute({
      mentorId: 'mentor-1',
      courseId: ctx.course.id,
    });
    const aula = out.lessons.find((a) => a.lessonId === 'aula-upload');
    expect(aula?.contentUrl).toBe(chave);
    expect(aula?.contentUrlSigned).toContain('img.test');
  });
});
