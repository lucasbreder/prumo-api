import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import type { AppTeste } from './harness.js';
import {
  abrirApp,
  studentWithPlan,
  subscribeWebhook,
  createUser,
  courseWithLessonPublic,
  login,
} from './harness.js';
describe('Area do aluno (e2e)', () => {
  let t: AppTeste;
  let course: Awaited<ReturnType<typeof courseWithLessonPublic>>;
  beforeAll(async () => {
    t = await abrirApp();
    course = await courseWithLessonPublic(t.prisma);
  });
  afterAll(async () => {
    await t.fechar();
  });
  it('catalogo publico nao expoe rascunho nem conteudo das aulas', async () => {
    const hidden = await courseWithLessonPublic(t.prisma, { published: false });
    const list = await t.api.get('/courses').expect(200);
    expect(list.body.items.map((c: { slug: string }) => c.slug)).toContain(
      course.course.slug,
    );
    expect(list.body.items.map((c: { slug: string }) => c.slug)).not.toContain(
      hidden.course.slug,
    );
    const detail = await t.api
      .get(`/courses/${course.course.slug}`)
      .expect(200);
    expect(detail.body.lessons).toHaveLength(1);
    expect(JSON.stringify(detail.body)).not.toContain('cdn.test');
  });
  it('student without plan ativo: painel devolve 403', async () => {
    await createUser(t.prisma, { email: 'sempreplan@test.dev' });
    const token = await login(t.api, 'sempreplan@test.dev');
    await t.api
      .get('/my-courses')
      .set('Authorization', `Bearer ${token}`)
      .expect(403);
  });
  it('checkout libera painel: enroll, concluir aulas e certificado', async () => {
    await createUser(t.prisma, { email: 'comprando@test.dev' });
    const token = await login(t.api, 'comprando@test.dev');
    const auth = { Authorization: `Bearer ${token}` };
    const plans = await t.api.get('/plans').expect(200);
    const planId = plans.body.plans[0].id;
    await t.api.post('/checkout').set(auth).send({ planId }).expect(201);
    await t.api
      .post('/enrollments')
      .set(auth)
      .send({ courseId: course.course.id })
      .expect(201);
    await t.api
      .post('/enrollments')
      .set(auth)
      .send({ courseId: course.course.id })
      .expect(201);
    const detail = await t.api
      .get(`/my-courses/${course.course.id}`)
      .set(auth)
      .expect(200);
    expect(detail.body.lessons).toHaveLength(1);
    const lesson = detail.body.lessons[0] as {
      id: string;
    };
    const completed = await t.api
      .post(`/lessons/${lesson.id}/complete`)
      .set(auth)
      .expect(200);
    expect(completed.body).toMatchObject({
      progressPercent: 100,
      completed: true,
    });
    expect(completed.body.certificate.issuedAt).toBeTruthy();
    const certificates = await t.api.get('/completed').set(auth).expect(200);
    expect(certificates.body.certificates).toHaveLength(1);
    // lesson in draft not can ser completed
    await t.api
      .post(`/lessons/${course.lessonDRAFT.id}/complete`)
      .set(auth)
      .expect(422);
  });
  it('downloads: material publico sempre, do curso so apos matricula', async () => {
    await createUser(t.prisma, { email: 'dl@test.dev' });
    const token = await login(t.api, 'dl@test.dev');
    const auth = { Authorization: `Bearer ${token}` };
    const plan = await t.api.get('/plans').then((r) => r.body.plans[0]);
    await t.api
      .post('/checkout')
      .set(auth)
      .send({ planId: plan.id })
      .expect(201);
    await t.prisma.material.create({
      data: {
        id: 'mat-e2e-avulso',
        name: 'Ebook.pdf',
        type: 'EBOOK',
        url: 'https://cdn/e.pdf',
        sizeBytes: 10n,
      },
    });
    await t.prisma.material.create({
      data: {
        id: 'mat-e2e-curso',
        name: 'Planilha.xlsx',
        type: 'SPREADSHEET',
        url: 'https://cdn/p.xlsx',
        sizeBytes: 20n,
        courseId: course.course.id,
      },
    });
    const antes = await t.api.get('/downloads').set(auth).expect(200);
    expect(antes.body.materials.map((m: { id: string }) => m.id)).toEqual([
      'mat-e2e-avulso',
    ]);
    await t.api
      .post('/enrollments')
      .set(auth)
      .send({ courseId: course.course.id })
      .expect(201);
    const depois = await t.api
      .get('/downloads?type=SPREADSHEET')
      .set(auth)
      .expect(200);
    expect(depois.body.materials.map((m: { id: string }) => m.id)).toEqual([
      'mat-e2e-curso',
    ]);
  });
  it('checkout gera fatura e admin ajusta plano do aluno', async () => {
    const student = await studentWithPlan(t);
    const auth = { Authorization: `Bearer ${student.token}` };
    const plans = await t.api.get('/plans').expect(200);
    await t.api
      .post('/checkout')
      .set(auth)
      .send({ planId: plans.body.plans[0].id })
      .expect(201);
    const invoices = await t.api.get('/my-invoices').set(auth).expect(200);
    expect(invoices.body.invoices[0].description).toContain('Assinatura');
    expect(invoices.body.invoices[0].amountCents).toBeGreaterThan(0);
    const _admin = await createUser(t.prisma, {
      email: 'faturas-adm@test.dev',
      role: 'ADMIN',
    });
    const adminAuth = {
      Authorization: `Bearer ${await login(t.api, 'faturas-adm@test.dev')}`,
    };
    const ajuste = await t.api
      .post(`/admin/students/${student.id}/plan`)
      .set(adminAuth)
      .send({ planId: plans.body.plans[1].id })
      .expect(201);
    expect(ajuste.body).toMatchObject({ status: 'ACTIVE', planName: 'Anual' });
    const listAdmin = await t.api
      .get('/admin/invoices')
      .set(adminAuth)
      .expect(200);
    expect(listAdmin.body.invoices.length).toBeGreaterThanOrEqual(2);
    const revoked = await t.api
      .post(`/admin/students/${student.id}/plan`)
      .set(adminAuth)
      .send({ planId: null })
      .expect(201);
    expect(revoked.body.status).toBe('EXPIRED');
    await t.api.get('/my-courses').set(auth).expect(403);
  });
  it('signed webhook expira subscription e bloqueia o painel', async () => {
    const student = await studentWithPlan(t);
    await t.api
      .get('/my-courses')
      .set('Authorization', `Bearer ${student.token}`)
      .expect(200);
    await t.api
      .post('/billing/webhook')
      .send({ event: 'subscription.paid', userId: student.id })
      .expect(401);
    const { body, headers } = subscribeWebhook({
      event: 'subscription.payment_failed',
      userId: student.id,
    });
    await t.api.post('/billing/webhook').set(headers).send(body).expect(200);
    await t.api
      .get('/my-courses')
      .set('Authorization', `Bearer ${student.token}`)
      .expect(403);
  });
});
describe('Conteudo textual em blocos (e2e)', () => {
  let t: AppTeste;
  let course: Awaited<ReturnType<typeof courseWithLessonPublic>>;
  const blocks = [
    { type: 'heading', level: 2, content: [{ text: 'Como precificar' }] },
    { type: 'paragraph', content: [{ text: 'Use o custo-hora.' }] },
    { type: 'image', key: 'content/planta.webp', alt: 'Planta' },
  ];
  beforeAll(async () => {
    t = await abrirApp();
    course = await courseWithLessonPublic(t.prisma, {
      slug: 'curso-blocos',
    });
    await t.prisma.lesson.create({
      data: {
        moduleId: course.module.id,
        order: 3,
        type: 'TEXT',
        title: 'Leitura com blocos',
        status: 'PUBLISHED',
        blocks: blocks as object[],
      },
    });
  });
  afterAll(async () => {
    await t.fechar();
  });
  it('vitrine publica nao expoe os blocos nem a chave S3', async () => {
    const detail = await t.api
      .get(`/courses/${course.course.slug}`)
      .expect(200);
    const corpo = JSON.stringify(detail.body);
    expect(corpo).not.toContain('custo-hora');
    expect(corpo).not.toContain('content/planta.webp');
  });
  it('aluno matriculado recebe blocos com imagem assinada', async () => {
    const student = await studentWithPlan(t);
    const auth = { Authorization: `Bearer ${student.token}` };
    await t.api
      .post('/enrollments')
      .set(auth)
      .send({ courseId: course.course.id })
      .expect(201);
    const leitura = await t.api
      .get(`/my-courses/${course.course.id}`)
      .set(auth)
      .expect(200);
    const aula = leitura.body.lessons.find(
      (l: { type: string }) => l.type === 'TEXT',
    );
    expect(aula.blocks).toMatchObject([
      { type: 'heading' },
      { type: 'paragraph' },
      {
        type: 'image',
        key: 'content/planta.webp',
        url: expect.stringContaining('X-Amz-Signature'),
      },
    ]);
  });
  it('bloco de tipo desconhecido e rejeitado (422)', async () => {
    const student = await studentWithPlan(t);
    const mentor = await createUser(t.prisma, {
      email: 'mentor-blocos@test.dev',
      role: 'MENTOR',
    });
    const admin = await createUser(t.prisma, {
      email: 'adm-blocos@test.dev',
      role: 'ADMIN',
    });
    const adminToken = await login(t.api, admin.email);
    await t.api
      .post(`/admin/courses/${course.course.id}/mentors`)
      .set('Authorization', `Bearer ${adminToken}`)
      .send({ mentorId: mentor.id })
      .expect(201);
    void student;
    await t.api
      .post(`/mentor/courses/${course.course.id}/lessons`)
      .set('Authorization', `Bearer ${await login(t.api, mentor.email)}`)
      .send({
        moduleId: course.module.id,
        title: 'Aula ruim',
        type: 'TEXT',
        blocks: [{ type: 'iframe', src: 'x' }],
      })
      .expect(422);
  });
});
