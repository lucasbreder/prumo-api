import { describe, expect, it, beforeEach } from 'vitest';
import { randomUUID } from 'node:crypto';
import { Thread } from '../../domain/entities/thread.entity.js';
import {
  FakeReportRepo,
  FakeReactionRepo,
  FakeRulesRepo,
  FakeReplyRepo,
  FakeThreadRepo,
  banidorFake,
} from '../fakes/community.fakes.js';
import {
  CreateThreadUseCase,
  ReportThreadUseCase,
  ListThreadsUseCase,
  ModerateThreadUseCase,
  GetReportsKpisUseCase,
  ReactThreadUseCase,
  ResolveReportUseCase,
  ResponderThreadUseCase,
  GetRulesUseCase,
  SaveRulesUseCase,
} from './community.usecases.js';
import { AccessDeniedError } from '../../../../shared/errors/domain.errors.js';
class ClockFixo {
  now(): Date {
    return new Date('2026-09-04T12:00:00.000Z');
  }
}
describe('Comunidade', () => {
  let threads: FakeThreadRepo;
  let deps: unknown;
  let reports: FakeReportRepo;
  let banidor: ReturnType<typeof banidorFake>;
  beforeEach(() => {
    threads = new FakeThreadRepo();
    reports = new FakeReportRepo();
    banidor = banidorFake();
    deps = {
      threads,
      reactions: new FakeReactionRepo(),
      replies: new FakeReplyRepo(),
      reports,
      rules: new FakeRulesRepo(),
      banUser: banidor,
      clock: new ClockFixo(),
    } as never;
  });
  function threadPublicada(authorId = 'autor-1'): Thread {
    const t = Thread.create({
      id: randomUUID(),
      authorId,
      category: 'caixa',
      content: 'Como separar o PJ do PF?',
      publicadaDirect: true,
    });
    threads.threads.set(t.id, t);
    return t;
  }
  it('aluno cria thread pendente; admin cria publicada', async () => {
    const create = new CreateThreadUseCase(deps as never);
    const peloStudent = await create.execute({
      authorId: 'a1',
      authorRole: 'STUDENT',
      category: 'vendas',
      content: 'oi',
    });
    expect(peloStudent.status).toBe('PENDING');
    const peloAdmin = await create.execute({
      authorId: 'ad1',
      authorRole: 'ADMIN',
      category: 'rules',
      content: 'bem-vindos',
    });
    expect(peloAdmin.status).toBe('PUBLISHED');
  });
  it('reagir e desacurtar sao toggle idempotente', async () => {
    const t = threadPublicada();
    const react = new ReactThreadUseCase(deps as never);
    expect((await react.execute({ userId: 'u2', threadId: t.id })).liked).toBe(
      true,
    );
    expect((await react.execute({ userId: 'u2', threadId: t.id })).liked).toBe(
      false,
    );
    expect(t.likeCount).toBe(0);
  });
  it('nao reage a thread oculta', async () => {
    const t = threadPublicada();
    t.hide();
    await expect(
      new ReactThreadUseCase(deps as never).execute({
        userId: 'u2',
        threadId: t.id,
      }),
    ).rejects.toBeInstanceOf(AccessDeniedError);
  });
  it('responder soma contador e so em thread publicada', async () => {
    const t = threadPublicada();
    const responder = new ResponderThreadUseCase(deps as never);
    expect(
      (
        await responder.execute({
          authorId: 'u2',
          authorRole: 'STUDENT',
          threadId: t.id,
          content: 'olha o fluxo de caixa',
        })
      ).replyCount,
    ).toBe(1);
    t.hide();
    await expect(
      responder.execute({
        authorId: 'u2',
        authorRole: 'STUDENT',
        threadId: t.id,
        content: 'x',
      }),
    ).rejects.toBeInstanceOf(AccessDeniedError);
  });
  it('moderacao aprova e oculta', async () => {
    const t = Thread.create({
      id: 'pend-1',
      authorId: 'a1',
      category: 'c',
      content: 'content',
      publicadaDirect: false,
    });
    threads.threads.set(t.id, t);
    const moderate = new ModerateThreadUseCase(deps as never);
    expect(
      (await moderate.execute({ threadId: t.id, action: 'APPROVE' })).status,
    ).toBe('PUBLISHED');
    expect(
      (await moderate.execute({ threadId: t.id, action: 'HIDE' })).status,
    ).toBe('HIDDEN');
  });
  it('listagem publica mostra fila filtrada', async () => {
    threadPublicada();
    const list = await new ListThreadsUseCase(deps as never).execute({
      status: 'PUBLISHED',
      page: 1,
      perPage: 12,
    });
    expect(list.items).toHaveLength(1);
    expect(list.meta.total).toBe(1);
  });
  it('listagem inclui respostas: aluno ve publicadas, admin ve tambem pendentes', async () => {
    const t = threadPublicada();
    const r = (id: string, status: 'PUBLISHED' | 'PENDING'): {
      id: string;
      content: string;
      status: 'PUBLISHED' | 'PENDING';
      createdAt: Date;
      author: { id: string; name: string; role: 'STUDENT' };
    } => ({
      id,
      content: `resposta ${id}`,
      status,
      createdAt: new Date('2026-09-04T12:00:00.000Z'),
      author: { id: 'u2', name: 'Ana', role: 'STUDENT' },
    });
    threads.repliesPorThread.set(t.id, [r('r1', 'PUBLISHED'), r('r2', 'PENDING')]);
    const comoAluna = await new ListThreadsUseCase(deps as never).execute({
      status: 'PUBLISHED',
      page: 1,
      perPage: 12,
      replyStatuses: ['PUBLISHED'],
    });
    expect(comoAluna.items[0].replies.map((x) => x.id)).toEqual(['r1']);
    const comoAdmin = await new ListThreadsUseCase(deps as never).execute({
      page: 1,
      perPage: 12,
      replyStatuses: ['PUBLISHED', 'PENDING', 'HIDDEN'],
    });
    expect(comoAdmin.items[0].replies.map((x) => x.id)).toEqual(['r1', 'r2']);
  });
  it('denuncia resolvida com BANIR oculta thread e bane autor', async () => {
    const t = threadPublicada('culpado');
    const report = new ReportThreadUseCase(deps as never);
    const d = await report.execute({
      userId: 'u9',
      threadId: t.id,
      reason: 'assédio',
    });
    const resolve = new ResolveReportUseCase(deps as never);
    const output = await resolve.execute({
      reportId: d.id,
      decision: 'BAN_AUTHOR',
    });
    expect(output.decision).toBe('BAN_AUTHOR');
    expect(t.status).toBe('HIDDEN');
    expect(banidor.banidos.has('culpado')).toBe(true);
    const kpis = await new GetReportsKpisUseCase(deps as never).execute();
    expect(kpis).toMatchObject({ openReports: 0, resolved: 1 });
    await expect(
      resolve.execute({ reportId: d.id, decision: 'IGNORE' }),
    ).rejects.toThrow(/resolvida/);
  });
  it('IGNORAR mantem a thread no ar', async () => {
    const t = threadPublicada();
    const d = await new ReportThreadUseCase(deps as never).execute({
      userId: 'u9',
      threadId: t.id,
      reason: 'discordo',
    });
    await new ResolveReportUseCase(deps as never).execute({
      reportId: d.id,
      decision: 'IGNORE',
    });
    expect(t.status).toBe('PUBLISHED');
  });
  it('regras sao configuraveis', async () => {
    const { rules } = await new GetRulesUseCase(deps as never).execute();
    expect(rules.text).toHaveLength(1);
    await new SaveRulesUseCase(deps as never).execute({
      text: ['Sem spam', 'Sem concorrencia'],
    });
    const { rules: novas } = await new GetRulesUseCase(deps as never).execute();
    expect(novas.text).toEqual(['Sem spam', 'Sem concorrencia']);
  });
});
