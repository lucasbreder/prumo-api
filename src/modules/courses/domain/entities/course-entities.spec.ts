import { describe, expect, it } from 'vitest';
import { randomUUID } from 'node:crypto';
import { Enrollment } from './enrollment.entity.js';
import { Course } from './course.entity.js';
import { BusinessRuleError } from '../../../../shared/errors/domain.errors.js';
function course(overrides = {}) {
  return Course.create({
    id: randomUUID(),
    title: 'Precificacao de Projetos',
    slug: 'precificacao',
    description: 'Como precificar sem deixar dinheiro na mesa.',
    ...overrides,
  });
}
describe('Curso', () => {
  it('nasce em rascunho', () => {
    expect(course().status).toBe('DRAFT');
  });
  it('so publica com ao menos uma aula publicada', () => {
    const c = course();
    expect(() => c.publish(false)).toThrow(BusinessRuleError);
    c.publish(true);
    expect(c.status).toBe('PUBLISHED');
  });
});
describe('Matricula (progresso)', () => {
  const studentId = randomUUID();
  it('recalcula o percentual sobre aulas publicadas', () => {
    const m = Enrollment.create({
      id: randomUUID(),
      studentId,
      courseId: 'c1',
    });
    m.recalcularProgress({ totalPublicadas: 4, concluidas: 1 });
    expect(m.progressPercent).toBe(25);
    expect(m.completedAt).toBeNull();
  });
  it('conclui ao zerar o saldo e emite data', () => {
    const m = Enrollment.create({
      id: randomUUID(),
      studentId,
      courseId: 'c1',
    });
    m.recalcularProgress({ totalPublicadas: 2, concluidas: 2 });
    expect(m.progressPercent).toBe(100);
    expect(m.completedAt).toBeInstanceOf(Date);
  });
  it('perde a conclusao se nova aula nao publicada entrar no curriculo', () => {
    const m = Enrollment.create({
      id: randomUUID(),
      studentId,
      courseId: 'c1',
    });
    m.recalcularProgress({ totalPublicadas: 2, concluidas: 2 });
    m.recalcularProgress({ totalPublicadas: 3, concluidas: 2 });
    expect(m.progressPercent).toBe(66);
    expect(m.completedAt).toBeNull();
  });
  it('ignora divisao por zero (curso sem aulas publicadas)', () => {
    const m = Enrollment.create({
      id: randomUUID(),
      studentId,
      courseId: 'c1',
    });
    m.recalcularProgress({ totalPublicadas: 0, concluidas: 0 });
    expect(m.progressPercent).toBe(0);
  });
  it('marca aula atual para continuar de onde parou', () => {
    const m = Enrollment.create({
      id: randomUUID(),
      studentId,
      courseId: 'c1',
    });
    m.definirLessonCurrent('a9');
    expect(m.currentLessonId).toBe('a9');
  });
  it('reconstroi dos dados persistidos', () => {
    const m = Enrollment.reconstituir({
      id: 'x',
      studentId,
      courseId: 'c1',
      progressPercent: 50,
      currentLessonId: 'a2',
      completedAt: null,
    });
    expect(m.progressPercent).toBe(50);
  });
});
