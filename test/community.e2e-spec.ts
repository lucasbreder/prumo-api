import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import type { AppTeste } from './harness.js';
import { abrirApp, studentWithPlan, createUser, login } from './harness.js';
describe('Comunidade e moderacao (e2e)', () => {
  let t: AppTeste;
  let adminToken: string;
  let student: Awaited<ReturnType<typeof studentWithPlan>>;
  beforeAll(async () => {
    t = await abrirApp();
    const admin = await createUser(t.prisma, {
      email: 'mod@test.dev',
      role: 'ADMIN',
    });
    adminToken = await login(t.api, admin.email);
    student = await studentWithPlan(t);
  });
  afterAll(async () => {
    await t.fechar();
  });
  it('student creates thread pendente e admin aprova', async () => {
    const created = await t.api
      .post('/community')
      .set('Authorization', `Bearer ${student.token}`)
      .send({
        category: 'precificacao',
        content: 'Como cobrar por hora tecnica?',
      })
      .expect(201);
    expect(created.body.status).toBe('PENDING');
    const queue = await t.api
      .get('/admin/community?status=PENDING')
      .set('Authorization', `Bearer ${adminToken}`)
      .expect(200);
    expect(queue.body.items).toHaveLength(1);
    await t.api
      .patch(`/admin/community/${created.body.id}`)
      .set('Authorization', `Bearer ${adminToken}`)
      .send({ action: 'APPROVE' })
      .expect(200);
    const feed = await t.api
      .get('/community')
      .set('Authorization', `Bearer ${student.token}`)
      .expect(200);
    expect(feed.body.items).toHaveLength(1);
  });
  it('reagir alterna like; resposta soma contador', async () => {
    const feed = await t.api
      .get('/community')
      .set('Authorization', `Bearer ${student.token}`);
    const id = feed.body.items[0].id;
    const like = await t.api
      .post(`/community/${id}/react`)
      .set('Authorization', `Bearer ${student.token}`)
      .expect(200);
    expect(like.body).toEqual({ liked: true, likeCount: 1 });
    const unlike = await t.api
      .post(`/community/${id}/react`)
      .set('Authorization', `Bearer ${student.token}`)
      .expect(200);
    expect(unlike.body).toEqual({ liked: false, likeCount: 0 });
    const reply = await t.api
      .post(`/community/${id}/replies`)
      .set('Authorization', `Bearer ${student.token}`)
      .send({ content: 'Descobri que funciona por valor.' })
      .expect(201);
    expect(reply.body.replyCount).toBe(1);
  });
  it('denuncia banida oculta thread, bane autor e registra KPIs', async () => {
    // mentor creates thread publicada direct
    const mentor = await createUser(t.prisma, {
      email: 'spammer@test.dev',
      role: 'MENTOR',
    });
    const mentorToken = await login(t.api, mentor.email);
    const spam = await t.api
      .post('/community')
      .set('Authorization', `Bearer ${mentorToken}`)
      .send({ category: 'geral', content: 'COMPRE MEUS EBOOKS' })
      .expect(201);
    const report = await t.api
      .post(`/community/${spam.body.id}/report`)
      .set('Authorization', `Bearer ${student.token}`)
      .send({ reason: 'spam' })
      .expect(201);
    const abertas = await t.api
      .get('/admin/reports?status=IN_ANALYSIS')
      .set('Authorization', `Bearer ${adminToken}`)
      .expect(200);
    expect(abertas.body.items[0].thread.authorId).toBe(mentor.id);
    await t.api
      .post(`/admin/reports/${report.body.id}/resolve`)
      .set('Authorization', `Bearer ${adminToken}`)
      .send({ decision: 'BAN_AUTHOR' })
      .expect(200);
    await t.api
      .get('/community')
      .set('Authorization', `Bearer ${student.token}`)
      .then((r) => {
        expect(
          r.body.items.find((i: { id: string }) => i.id === spam.body.id),
        ).toBeUndefined();
      });
    await t.api
      .post('/auth/login')
      .send({ email: mentor.email, password: mentor.password })
      .expect(401);
    const kpis = await t.api
      .get('/admin/community/kpis')
      .set('Authorization', `Bearer ${adminToken}`)
      .expect(200);
    expect(kpis.body).toMatchObject({
      openReports: 0,
      resolved: 1,
      authorsInAnalysis: 0,
    });
  });
  it('regras configuraveis', async () => {
    await t.api
      .patch('/admin/community/rules')
      .set('Authorization', `Bearer ${adminToken}`)
      .send({ text: ['Sem spam.'] })
      .expect(200);
    const rules = await t.api
      .get('/community/rules')
      .set('Authorization', `Bearer ${student.token}`)
      .expect(200);
    expect(rules.body.rules.text).toEqual(['Sem spam.']);
  });
  it('student without plan ativo nao acessa comunidade', async () => {
    const withoutPlan = await createUser(t.prisma, { email: 'livre@test.dev' });
    const token = await login(t.api, withoutPlan.email);
    await t.api
      .get('/community')
      .set('Authorization', `Bearer ${token}`)
      .expect(403);
  });
});
