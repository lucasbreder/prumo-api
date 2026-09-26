import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { createHmac } from 'node:crypto';
import type { AppTeste } from './harness.js';
import {
  abrirApp,
  createUser,
  courseWithLessonPublic,
  env,
  login,
  studentWithPlan,
} from './harness.js';
describe('Dashboard admin (e2e)', () => {
  let t: AppTeste;
  let adminToken: string;
  beforeAll(async () => {
    t = await abrirApp();
    const admin = await createUser(t.prisma, {
      email: 'dash@test.dev',
      role: 'ADMIN',
    });
    adminToken = await login(t.api, admin.email);
  });
  afterAll(async () => {
    await t.fechar();
  });
  it('kpi mrr/churn/matriculas batem com o snapshot em centavos', async () => {
    // 2 students with plan monthly (9700) active + 1 subscription expired hoje
    const a1 = await studentWithPlan(t);
    const a2 = await studentWithPlan(t);
    void a1;
    void a2;
    const churnavel = await createUser(t.prisma, { email: 'churn@test.dev' });
    const plan = await t.prisma.plan.findFirstOrThrow({
      where: { slug: 'mensal' },
    });
    await t.prisma.subscription.create({
      data: {
        userId: churnavel.id,
        planId: plan.id,
        priceCents: 9700,
        status: 'CANCELED',
        updatedAt: new Date(),
        currentPeriodEnd: new Date(Date.now() - 1000),
      },
    });
    const course = await courseWithLessonPublic(t.prisma);
    await t.prisma.enrollment.create({
      data: {
        studentId: a1.id,
        courseId: course.course.id,
        progressPercent: 100,
        completedAt: new Date(),
      },
    });
    await t.prisma.enrollment.create({
      data: {
        studentId: a2.id,
        courseId: course.course.id,
        progressPercent: 50,
      },
    });
    const output = await t.api
      .get('/admin/dashboard')
      .set('Authorization', `Bearer ${adminToken}`)
      .expect(200);
    expect(output.body.kpis.mrrCents).toBe(9700 * 2);
    expect(output.body.kpis.studentsActive).toBe(2);
    expect(output.body.kpis.newEnrollments30d).toBe(2);
    expect(output.body.kpis.churn30dPercent).toBeGreaterThanOrEqual(20);
    expect(output.body.revenueByPlan[0]).toMatchObject({
      plan: 'Mensal',
      amountCents: 19400,
      percent: 100,
    });
    expect(output.body.popularCourses[0]).toMatchObject({
      title: 'Curso de Teste',
      students: 2,
    });
    expect(output.body.attention.draftCourses).toBe(0);
    expect(output.body.attention.openReports).toBe(0);
  });
  it('aluno nao ve dashboard', async () => {
    const student = await createUser(t.prisma, { email: 'espiao@test.dev' });
    await t.api
      .get('/admin/dashboard')
      .set('Authorization', `Bearer ${await login(t.api, student.email)}`)
      .expect(403);
  });
  it('checkout e2e com signed webhook renews cycle', async () => {
    const student = await studentWithPlan(t);
    const antes = await t.prisma.subscription.findUniqueOrThrow({
      where: { userId: student.id },
    });
    const body = { event: 'subscription.paid', userId: student.id };
    const text = JSON.stringify(body);
    const ts = String(Date.now());
    const sig = createHmac('sha256', env.WEBHOOK_SECRET)
      .update(`${ts}.${text}`)
      .digest('hex');
    await t.api
      .post('/billing/webhook')
      .set('x-prumo-timestamp', ts)
      .set('x-prumo-signature', sig)
      .send(body)
      .expect(200);
    const depois = await t.prisma.subscription.findUniqueOrThrow({
      where: { userId: student.id },
    });
    expect(depois.currentPeriodEnd?.getTime()).toBe(
      (antes.currentPeriodEnd?.getTime() ?? 0) + 31 * 86400000,
    );
  });
});
