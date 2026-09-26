import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import type { AppTeste } from './harness.js';
import { abrirApp, studentWithPlan, createUser, login } from './harness.js';
describe('Lives (e2e)', () => {
  let t: AppTeste;
  let adminToken: string;
  beforeAll(async () => {
    t = await abrirApp();
    const admin = await createUser(t.prisma, {
      email: 'lives-admin@test.dev',
      role: 'ADMIN',
    });
    adminToken = await login(t.api, admin.email);
  });
  afterAll(async () => {
    await t.fechar();
  });
  it('fluxo completo: criar, agenda do aluno, ao vivo com sala, encerrar com gravacao', async () => {
    const auth = { Authorization: `Bearer ${adminToken}` };
    const created = await t.api
      .post('/admin/lives')
      .set(auth)
      .send({
        title: 'Live de precificação',
        description: 'Casos reais ao vivo.',
        type: 'LIVE',
        startsAt: new Date(Date.now() + 86400000).toISOString(),
        durationMin: 90,
      })
      .expect(201);
    const id = created.body.live.id;
    expect(created.body.live.status).toBe('SCHEDULED');
    const student = await studentWithPlan(t);
    const agenda = await t.api
      .get('/lives')
      .set('Authorization', `Bearer ${student.token}`)
      .expect(200);
    expect(agenda.body.lives).toHaveLength(1);
    expect(agenda.body.lives[0].roomUrl).toBeNull();
    // without room, start fails 422
    await t.api.post(`/admin/lives/${id}/start`).set(auth).expect(422);
    const listAdmin = await t.api.get('/admin/lives').set(auth).expect(200);
    expect(listAdmin.body.lives[0].roomUrl).toBeNull();
    await t.api
      .patch(`/admin/lives/${id}`)
      .set(auth)
      .send({
        title: 'Live de precificação',
        description: 'Casos reais ao vivo.',
        type: 'LIVE',
        startsAt: new Date().toISOString(),
        durationMin: 90,
        roomUrl: 'https://meet.prumo.dev/abc',
      })
      .expect(200);
    await t.api.post(`/admin/lives/${id}/start`).set(auth).expect(200);
    const live = await t.api
      .get('/lives')
      .set('Authorization', `Bearer ${student.token}`);
    expect(live.body.lives[0].roomUrl).toBe('https://meet.prumo.dev/abc');
    await t.api
      .post(`/admin/lives/${id}/end`)
      .set(auth)
      .send({ recordingUrl: 'https://play.prumo.dev/grab-1' })
      .expect(200);
    const ended = await t.api
      .get('/lives')
      .set('Authorization', `Bearer ${student.token}`);
    expect(ended.body.lives[0].recordingUrl).toBe(
      'https://play.prumo.dev/grab-1',
    );
    expect(ended.body.lives[0].roomUrl).toBeNull();
    const adminVeRoom = await t.api.get('/admin/lives').set(auth);
    expect(adminVeRoom.body.lives[0].roomUrl).toBe(
      'https://meet.prumo.dev/abc',
    );
  });
  it('student without plan nao ve agenda; anonimo 401; mentor nao gerencia', async () => {
    await t.api.get('/lives').expect(401);
    const _withoutPlan = await createUser(t.prisma, {
      email: 'livre-lives@test.dev',
    });
    await t.api
      .get('/lives')
      .set(
        'Authorization',
        `Bearer ${await login(t.api, 'livre-lives@test.dev')}`,
      )
      .expect(403);
    await createUser(t.prisma, {
      email: 'mentor-lives@test.dev',
      role: 'MENTOR',
    });
    await t.api
      .get('/admin/lives')
      .set(
        'Authorization',
        `Bearer ${await login(t.api, 'mentor-lives@test.dev')}`,
      )
      .expect(403);
  });
  it('mentoria sem mentor falha validacao de dominio', async () => {
    await t.api
      .post('/admin/lives')
      .set('Authorization', `Bearer ${adminToken}`)
      .send({
        title: 'Mentoria',
        description: 'x',
        type: 'MENTORING',
        startsAt: new Date().toISOString(),
        durationMin: 60,
      })
      .expect(422);
  });
});
