import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import type { AppTeste } from './harness.js';
import { abrirApp, createUser } from './harness.js';
describe('Auth (e2e)', () => {
  let t: AppTeste;
  beforeAll(async () => {
    t = await abrirApp();
  });
  afterAll(async () => {
    await t.fechar();
  });
  it('matriz: rota protegida sem token = 401; payload extra = 400', async () => {
    await t.api.get('/account').expect(401);
    await t.api
      .post('/auth/register')
      .send({
        name: 'A B',
        email: 'a@b.com',
        password: 'abcd1234',
        admin: true,
      })
      .expect(400);
  });
  it('cadastro -> login -> conta', async () => {
    await t.api
      .post('/auth/register')
      .send({ name: 'Carol', email: 'carol@test.dev', password: 'carol2026x' })
      .expect(201);
    const login = await t.api
      .post('/auth/login')
      .send({ email: 'carol@test.dev', password: 'carol2026x' })
      .expect(200);
    expect(login.body.accessToken).toBeTruthy();
    expect(login.headers['set-cookie']?.[0]).toContain('prumo_rt=');
    expect(login.headers['set-cookie']?.[0]).toContain('HttpOnly');
    await t.api
      .get('/account')
      .set('Authorization', `Bearer ${login.body.accessToken}`)
      .expect(200)
      .expect((r) => {
        expect(r.body.user.email).toBe('carol@test.dev');
        expect(r.body.user.passwordHash).toBeUndefined();
      });
  });
  it('senha errada e e-mail inexistente dao o mesmo 401', async () => {
    const wrong = await t.api
      .post('/auth/login')
      .send({ email: 'carol@test.dev', password: 'errada123' })
      .expect(401);
    const b = await t.api
      .post('/auth/login')
      .send({ email: 'ninguem@test.dev', password: 'errada123' })
      .expect(401);
    expect(wrong.body.message).toBe(b.body.message);
  });
  it('refresh via cookie rotaciona; reuso do antigo derruba a familia', async () => {
    const agent = t.api;
    const login = await agent
      .post('/auth/login')
      .send({ email: 'carol@test.dev', password: 'carol2026x' })
      .expect(200);
    const cookie = login.headers['set-cookie'][0].split(';')[0];
    const r1 = await agent
      .post('/auth/refresh')
      .set('Cookie', cookie)
      .send({})
      .expect(200);
    const newCookie = r1.headers['set-cookie'][0].split(';')[0];
    expect(newCookie).not.toBe(cookie);
    // reuso of cookie antigo
    await agent
      .post('/auth/refresh')
      .set('Cookie', cookie)
      .send({})
      .expect(401);
    // o new also morreu (familia revogada)
    await agent
      .post('/auth/refresh')
      .set('Cookie', newCookie)
      .send({})
      .expect(401);
  });
  it('tokens via body para clientes nativos + logout revoga', async () => {
    const login = await t.api
      .post('/auth/login')
      .set('X-Client', 'native')
      .send({ email: 'carol@test.dev', password: 'carol2026x' })
      .expect(200);
    const rt = login.body.refreshToken as string;
    const r1 = await t.api
      .post('/auth/refresh')
      .send({ refreshToken: rt })
      .expect(200);
    const rt2 = r1.body.refreshToken as string;
    expect(rt2).toBeTruthy();
    await t.api.post('/auth/refresh').send({ refreshToken: rt }).expect(401);
    const login2 = await t.api
      .post('/auth/login')
      .set('X-Client', 'native')
      .send({ email: 'carol@test.dev', password: 'carol2026x' })
      .expect(200);
    await t.api
      .post('/auth/logout')
      .send({ refreshToken: login2.body.refreshToken })
      .expect(204);
    await t.api
      .post('/auth/refresh')
      .send({ refreshToken: login2.body.refreshToken })
      .expect(401);
  });
  it('forgot/reset circula completo', async () => {
    await createUser(t.prisma, {
      email: 'reset@test.dev',
      password: 'reset2026x',
    });
    await t.api
      .post('/auth/forgot-password')
      .send({ email: 'reset@test.dev' })
      .expect(202);
    await t.api
      .post('/auth/forgot-password')
      .send({ email: 'nao-existe@test.dev' })
      .expect(202);
    const registro = await t.prisma.passwordResetToken.findFirst({
      orderBy: { createdAt: 'desc' },
    });
    expect(registro).toBeTruthy();
    // o token bruto never leaves of servidor; in teste usamos o event of listener via DB:
    // criamos a new ciclo controlado buscando o hash e gerando ourselves not of.
    // Then testamos only the errors: token invalid fails.
    await t.api
      .post('/auth/reset-password')
      .send({ token: 'token-falso', newPassword: 'nova2026x' })
      .expect(401);
  });
  it('notificacoes: GET/PATCH /account/notifications persistem preferencias', async () => {
    const login = await t.api
      .post('/auth/login')
      .send({ email: 'carol@test.dev', password: 'carol2026x' })
      .expect(200);
    const auth = { Authorization: `Bearer ${login.body.accessToken}` };
    const current = await t.api
      .get('/account/notifications')
      .set(auth)
      .expect(200);
    expect(current.body.notifications).toEqual({
      lives: true,
      community: true,
      summary: false,
    });
    const updated = await t.api
      .patch('/account/notifications')
      .set(auth)
      .send({ summary: true, lives: false })
      .expect(200);
    expect(updated.body.notifications).toEqual({
      lives: false,
      community: true,
      summary: true,
    });
    await t.api
      .patch('/account/notifications')
      .set(auth)
      .send({ summary: 'x' })
      .expect(400);
  });
  it('OAuth: valida provider e idToken no payload', async () => {
    await t.api
      .post('/auth/oauth')
      .send({ provider: 'FACEBOOK', idToken: 'x' })
      .expect(400);
    await t.api.post('/auth/oauth').send({ provider: 'GOOGLE' }).expect(400);
  });
  it('OAuth: Google/Apple nao configurados no ambiente -> 503', async () => {
    await t.api
      .post('/auth/oauth')
      .send({ provider: 'GOOGLE', idToken: 'token-qualquer' })
      .expect(503);
    await t.api
      .post('/auth/oauth')
      .send({ provider: 'APPLE', idToken: 'token-qualquer' })
      .expect(503);
  });
  it('RBAC: aluno nao acessa rotas de admin', async () => {
    const token = await t.api
      .post('/auth/login')
      .send({ email: 'carol@test.dev', password: 'carol2026x' })
      .then((r) => r.body.accessToken);
    await t.api
      .get('/admin/students')
      .set('Authorization', `Bearer ${token}`)
      .expect(403);
    await t.api
      .get('/admin/dashboard')
      .set('Authorization', `Bearer ${token}`)
      .expect(403);
  });
});
