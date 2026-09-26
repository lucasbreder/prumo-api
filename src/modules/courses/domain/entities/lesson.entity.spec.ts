import { describe, expect, it } from 'vitest';
import { randomUUID } from 'node:crypto';
import { Lesson } from './lesson.entity.js';
import { BusinessRuleError } from '../../../../shared/errors/domain.errors.js';
function novaLesson(overrides = {}) {
  return Lesson.create({
    id: randomUUID(),
    moduleId: 'm1',
    order: 1,
    type: 'VIDEO',
    title: 'Precificando projetos',
    ...overrides,
  });
}
describe('Aula (ciclo Rascunho -> Em revisao -> Publicado)', () => {
  it('nasce como rascunho', () => {
    expect(novaLesson().status).toBe('DRAFT');
  });
  it('envia para revisao a partir do rascunho', () => {
    const lesson = novaLesson({
      contentUrl: 'https://cdn.prumo.dev/v/aula.mp4',
    });
    lesson.sendForReview(new Date());
    expect(lesson.status).toBe('IN_REVIEW');
    expect(lesson.sentForReviewAt).toBeInstanceOf(Date);
  });
  it('nao envia para revisao sem conteudo de video', () => {
    const lesson = novaLesson();
    expect(() => lesson.sendForReview(new Date())).toThrow(BusinessRuleError);
  });
  it('somente publica o que estava em revisao', () => {
    const lesson = novaLesson({ contentUrl: 'https://cdn/x.mp4' });
    expect(() => lesson.publish()).toThrow(/revisao/i);
  });
  it('publica aula revisada com conteudo', () => {
    const lesson = novaLesson({ text: 'Roteiro da aula' });
    lesson.sendForReview(new Date());
    lesson.publish();
    expect(lesson.status).toBe('PUBLISHED');
  });
  it('rejeicao volta para rascunho', () => {
    const lesson = novaLesson({ contentUrl: 'https://cdn/x.mp4' });
    lesson.sendForReview(new Date());
    lesson.rejeitar();
    expect(lesson.status).toBe('DRAFT');
  });
  it('editar aula publicada a devolve para em revisao (reprecificacao pela equipe)', () => {
    const lesson = novaLesson({ contentUrl: 'https://cdn/x.mp4' });
    lesson.sendForReview(new Date());
    lesson.publish();
    lesson.editContent({ title: 'Novo titulo' });
    expect(lesson.status).toBe('IN_REVIEW');
    expect(lesson.title).toBe('Novo titulo');
  });
  it('aula de leitura publica com texto sem url', () => {
    const lesson = novaLesson({
      type: 'MATERIAL',
      text: 'Apostila em markdown',
    });
    lesson.sendForReview(new Date());
    lesson.publish();
    expect(lesson.status).toBe('PUBLISHED');
  });
  it('aula TEXT com blocos valida conteudo e vai para revisao', () => {
    const lesson = novaLesson({
      type: 'TEXT',
      blocks: [
        { type: 'heading', level: 2, content: [{ text: 'Introducao' }] },
        { type: 'paragraph', content: [{ text: 'Corpo da aula.' }] },
      ],
    });
    expect(lesson.temContent).toBe(true);
    lesson.sendForReview(new Date());
    expect(lesson.status).toBe('IN_REVIEW');
    expect(lesson.blocks).toHaveLength(2);
  });
  it('aula TEXT sem blocos nao vai para revisao', () => {
    const lesson = novaLesson({ type: 'TEXT' });
    expect(() => lesson.sendForReview(new Date())).toThrow(BusinessRuleError);
  });
  it('blocos invalidos sao rejeitados na criacao', () => {
    expect(() =>
      novaLesson({ type: 'TEXT', blocks: [{ type: 'video-embed' }] }),
    ).toThrow(BusinessRuleError);
  });
  it('editContent com blocos invalidos lanca erro de dominio', () => {
    const lesson = novaLesson({ type: 'TEXT', text: 'ok' });
    expect(() =>
      lesson.editContent({ blocks: [{ type: 'paragraph', content: [] }] }),
    ).toThrow(BusinessRuleError);
  });
  it('editar blocos de aula publicada devolve para revisao', () => {
    const lesson = novaLesson({
      type: 'TEXT',
      blocks: [{ type: 'divider' }],
    });
    lesson.sendForReview(new Date());
    lesson.publish();
    lesson.editContent({
      blocks: [{ type: 'paragraph', content: [{ text: 'novo' }] }],
    });
    expect(lesson.status).toBe('IN_REVIEW');
  });
  it('contentUrl null remove o arquivo; undefined mantem', () => {
    const lesson = novaLesson({
      type: 'VIDEO',
      contentUrl: 'uploads/m1/aula.mp4',
    });
    lesson.editContent({});
    expect(lesson.contentUrl).toBe('uploads/m1/aula.mp4');
    lesson.editContent({ contentUrl: null });
    expect(lesson.contentUrl).toBeNull();
  });
  it('equipe alterna status de rascunho para publicado diretamente', () => {
    const lesson = novaLesson({ type: 'MATERIAL', text: 'roteiro' });
    expect(lesson.status).toBe('DRAFT');
    lesson.definirStatus('PUBLISHED', new Date());
    expect(lesson.status).toBe('PUBLISHED');
    lesson.definirStatus('DRAFT', new Date());
    expect(lesson.status).toBe('DRAFT');
    expect(lesson.sentForReviewAt).toBeNull();
  });
  it('nao publica aula sem conteudo mesmo pela equipe', () => {
    const lesson = novaLesson();
    expect(() => lesson.definirStatus('PUBLISHED', new Date())).toThrow(
      BusinessRuleError,
    );
  });
});
