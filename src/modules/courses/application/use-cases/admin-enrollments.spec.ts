import { describe, expect, it, beforeEach } from 'vitest';
import { Course } from '../../domain/entities/course.entity.js';
import { Enrollment } from '../../domain/entities/enrollment.entity.js';
import {
  FakeCourseRepo,
  FakeEnrollmentRepo,
} from '../fakes/courses.fakes.js';
import type { StudentDirectory } from '../../domain/repositories.js';
import {
  ListCourseEnrollmentsAdminUseCase,
  ListAvailableStudentsAdminUseCase,
  EnrollStudentAdminUseCase,
  UnenrollStudentAdminUseCase,
} from './admin-enrollments.usecases.js';
import { NotFoundError } from '../../../../shared/errors/domain.errors.js';

class FakeStudentDirectory implements StudentDirectory {
  users = new Map<string, { id: string; role: string }>();
  async byId(id: string) {
    return this.users.get(id) ?? null;
  }
}

function montar() {
  const courses = new FakeCourseRepo();
  const enrollments = new FakeEnrollmentRepo();
  const directory = new FakeStudentDirectory();
  const curso = Course.create({ id: 'c1', title: 'Gestão de Projetos', description: 'd' });
  courses.courses.set('c1', curso);
  enrollments.students.set('s1', { name: 'Clara Mendes', email: 'clara@dev.io', role: 'STUDENT' });
  enrollments.students.set('s2', { name: 'Pedro Almeida', email: 'pedro@dev.io', role: 'STUDENT' });
  directory.users.set('s1', { id: 's1', role: 'STUDENT' });
  directory.users.set('s2', { id: 's2', role: 'STUDENT' });
  directory.users.set('m1', { id: 'm1', role: 'MENTOR' });
  return { courses, enrollments, students: directory };
}

describe('Matrículas pelo admin', () => {
  let ctx: ReturnType<typeof montar>;
  let listar: ListCourseEnrollmentsAdminUseCase;
  let disponiveis: ListAvailableStudentsAdminUseCase;
  let matricular: EnrollStudentAdminUseCase;
  let desmatricular: UnenrollStudentAdminUseCase;

  beforeEach(() => {
    ctx = montar();
    listar = new ListCourseEnrollmentsAdminUseCase(ctx);
    disponiveis = new ListAvailableStudentsAdminUseCase(ctx);
    matricular = new EnrollStudentAdminUseCase(ctx);
    desmatricular = new UnenrollStudentAdminUseCase(ctx);
  });

  it('lista matriculas do curso com paginacao e busca por nome', async () => {
    await ctx.enrollments.create(
      Enrollment.create({ id: 'e1', studentId: 's1', courseId: 'c1' }),
    );
    await ctx.enrollments.create(
      Enrollment.create({ id: 'e2', studentId: 's2', courseId: 'c1' }),
    );
    const tudo = await listar.execute({ courseId: 'c1', page: 1, perPage: 20 });
    expect(tudo.course).toEqual({ id: 'c1', title: 'Gestão de Projetos' });
    expect(tudo.items.map((i) => i.studentId).sort()).toEqual(['s1', 's2']);
    expect(tudo.meta.total).toBe(2);
    const soClara = await listar.execute({
      courseId: 'c1',
      search: 'clara',
      page: 1,
      perPage: 20,
    });
    expect(soClara.items).toHaveLength(1);
    expect(soClara.items[0]?.name).toBe('Clara Mendes');
  });

  it('lanca NotFound ao listar matriculas de curso inexistente', async () => {
    await expect(
      listar.execute({ courseId: 'nao-existe', page: 1, perPage: 20 }),
    ).rejects.toThrow(NotFoundError);
  });

  it('lista alunos disponiveis excluindo os ja matriculados', async () => {
    await ctx.enrollments.create(
      Enrollment.create({ id: 'e1', studentId: 's1', courseId: 'c1' }),
    );
    const lista = await disponiveis.execute({ courseId: 'c1' });
    expect(lista.items).toEqual([
      { id: 's2', name: 'Pedro Almeida', email: 'pedro@dev.io' },
    ]);
  });

  it('admin matricula aluno em curso rascunho sem exigir assinatura', async () => {
    const out = await matricular.execute({ courseId: 'c1', studentId: 's1' });
    expect(out).toEqual({ created: true });
    const existente = await ctx.enrollments.by('s1', 'c1');
    expect(existente?.courseId).toBe('c1');
  });

  it('matricula repetida e idempotente', async () => {
    await matricular.execute({ courseId: 'c1', studentId: 's1' });
    const out = await matricular.execute({ courseId: 'c1', studentId: 's1' });
    expect(out).toEqual({ created: false });
    expect(ctx.enrollments.enrollments.size).toBe(1);
  });

  it('rejeita matricula de aluno inexistente', async () => {
    await expect(
      matricular.execute({ courseId: 'c1', studentId: 'ninguem' }),
    ).rejects.toThrow(NotFoundError);
  });

  it('rejeita matricula de usuario que nao e aluno', async () => {
    await expect(
      matricular.execute({ courseId: 'c1', studentId: 'm1' }),
    ).rejects.toThrow(NotFoundError);
  });

  it('rejeita matricula em curso inexistente', async () => {
    await expect(
      matricular.execute({ courseId: 'nao-existe', studentId: 's1' }),
    ).rejects.toThrow(NotFoundError);
  });

  it('desmatricula remove a matricula do curso', async () => {
    await matricular.execute({ courseId: 'c1', studentId: 's1' });
    await desmatricular.execute({ courseId: 'c1', studentId: 's1' });
    expect(await ctx.enrollments.by('s1', 'c1')).toBeNull();
  });

  it('desmatricula sem matricula lanca NotFound', async () => {
    await expect(
      desmatricular.execute({ courseId: 'c1', studentId: 's1' }),
    ).rejects.toThrow(NotFoundError);
  });
});
