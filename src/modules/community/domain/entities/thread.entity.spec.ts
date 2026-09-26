import { describe, expect, it } from 'vitest';
import { randomUUID } from 'node:crypto';
import { Thread } from '../../domain/entities/thread.entity.js';
import { Report } from '../../domain/entities/report.entity.js';
import { BusinessRuleError } from '../../../../shared/errors/domain.errors.js';
function novaThread(roleAuthor: 'STUDENT' | 'MENTOR' | 'ADMIN') {
  const staff = roleAuthor !== 'STUDENT';
  const t = Thread.create({
    id: randomUUID(),
    authorId: 'u1',
    category: 'precificacao',
    content: 'Como cobrar por metragem?',
    publicadaDirect: staff,
  });
  return t;
}
describe('Thread', () => {
  it('conteudo de aluno entra pendente de moderacao', () => {
    expect(novaThread('STUDENT').status).toBe('PENDING');
  });
  it('conteudo de mentor/admin entra publicado', () => {
    expect(novaThread('ADMIN').status).toBe('PUBLISHED');
  });
  it('curtir e desacurtar ajustam o contador', () => {
    const t = novaThread('MENTOR');
    t.registerReaction(true);
    t.registerReaction(true);
    expect(t.likeCount).toBe(2);
    t.registerReaction(false);
    expect(t.likeCount).toBe(1);
    t.registerReaction(false);
    t.registerReaction(false);
    expect(t.likeCount).toBe(0);
  });
  it('thread oculta nao aceita resposta', () => {
    const t = novaThread('ADMIN');
    t.hide();
    expect(t.aceitaReply).toBe(false);
  });
  it('respostas somam contador', () => {
    const t = novaThread('ADMIN');
    t.registerReply();
    t.registerReply();
    expect(t.replyCount).toBe(2);
  });
});
describe('Denuncia', () => {
  it('resolve com decisao uma unica vez', () => {
    const d = Report.create({
      id: randomUUID(),
      threadId: 't1',
      reporterId: 'u2',
      reason: 'spam comercial',
    });
    expect(d.status).toBe('IN_ANALYSIS');
    d.resolve('BAN_AUTHOR', new Date());
    expect(d.status).toBe('RESOLVED');
    expect(() => d.resolve('IGNORE', new Date())).toThrow(BusinessRuleError);
  });
});
