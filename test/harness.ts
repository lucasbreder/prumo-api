import 'reflect-metadata';
import { createHmac } from 'node:crypto';
import { INestApplication } from '@nestjs/common';
import { Test } from '@nestjs/testing';
import request from 'supertest';
import { hashSync } from 'bcryptjs';
import { AppModule } from '../src/app.module.js';
import { loadEnv, type AppEnv } from '../src/shared/config/env.js';
import { configurarApp } from '../src/shared/bootstrap.js';
import { PrismaService } from '../src/shared/database/prisma.service.js';
import type { Role } from '../src/shared/domain/role.js';
export const env: AppEnv = loadEnv();
process.env.DATABASE_URL = env.DATABASE_URL_TEST ?? env.DATABASE_URL;
export interface AppTeste {
  app: INestApplication;
  prisma: PrismaService;
  api: ReturnType<typeof request>;
  fechar(): Promise<void>;
}
const TABELAS = [
  'User',
  'RefreshToken',
  'PasswordResetToken',
  'Plan',
  'Subscription',
  'Course',
  'CourseMentor',
  'Module',
  'Lesson',
  'Material',
  'Enrollment',
  'LessonProgress',
  'Thread',
  'Reaction',
  'Reply',
  'Report',
  'Testimonial',
  'HomeHighlight',
  'HomeHighlightStat',
  'CommunityRule',
  'Live',
  'SiteMenu',
  'Method',
  'MethodStep',
  'Invoice',
  'Newsletter',
];
export async function abrirApp(): Promise<AppTeste> {
  const moduleRef = await Test.createTestingModule({
    imports: [AppModule],
  }).compile();
  const app = moduleRef.createNestApplication();
  configurarApp(app, env);
  await app.init();
  const prisma = app.get(PrismaService);
  await reset(prisma);
  await semearPlans(prisma);
  return {
    app,
    prisma,
    api: request(app.getHttpServer()),
    async fechar() {
      await app.close();
    },
  };
}
export async function semearPlans(prisma: PrismaService): Promise<void> {
  const plans = [
    {
      slug: 'mensal',
      name: 'Mensal',
      priceCents: 9700,
      cycle: 'MONTHLY' as const,
      order: 1,
    },
    {
      slug: 'anual',
      name: 'Anual',
      priceCents: 7900,
      cycle: 'YEARLY' as const,
      order: 2,
      featured: true,
    },
    {
      slug: 'equipes',
      name: 'Equipes',
      priceCents: null,
      cycle: 'TEAM' as const,
      order: 3,
    },
  ];
  for (const p of plans) {
    await prisma.plan.upsert({
      where: { slug: p.slug },
      create: { ...p, benefits: [] },
      update: {},
    });
  }
}
export async function reset(prisma: PrismaService): Promise<void> {
  await prisma.$executeRawUnsafe(
    `TRUNCATE ${TABELAS.map((t) => `"${t}"`).join(', ')} RESTART IDENTITY CASCADE`,
  );
}
export async function createUser(
  prisma: PrismaService,
  data: {
    email: string;
    password?: string;
    role?: Role;
    name?: string;
  },
): Promise<{
  id: string;
  email: string;
  password: string;
}> {
  const password = data.password ?? 'prumo2026x';
  const user = await prisma.user.create({
    data: {
      name: data.name ?? 'Usuario Teste',
      email: data.email,
      passwordHash: hashSync(password, 10),
      role: data.role ?? 'STUDENT',
    },
    select: { id: true, email: true },
  });
  return { id: user.id, email: user.email, password };
}
export async function createPlan(
  prisma: PrismaService,
  data?: {
    priceCents?: number;
    cycle?: 'MONTHLY' | 'YEARLY' | 'TEAM';
    slug?: string;
  },
) {
  return prisma.plan.create({
    data: {
      slug: data?.slug ?? `plano-${Date.now()}`,
      name: 'Mensal',
      priceCents: data?.priceCents ?? 9700,
      cycle: data?.cycle ?? 'MONTHLY',
    },
  });
}
export async function login(
  api: AppTeste['api'],
  email: string,
  password = 'prumo2026x',
): Promise<string> {
  const res = await api
    .post('/auth/login')
    .send({ email, password })
    .expect(200);
  return res.body.accessToken as string;
}
export async function withAccess(
  api: AppTeste['api'],
  email: string,
  password = 'prumo2026x',
): Promise<string> {
  return login(api, email, password);
}
export function subscribeWebhook<T extends object>(
  payload: T,
  timestamp = String(Date.now()),
): {
  body: T;
  headers: Record<string, string>;
} {
  const text = JSON.stringify(payload);
  const subscription = createHmac('sha256', env.WEBHOOK_SECRET)
    .update(`${timestamp}.${text}`)
    .digest('hex');
  return {
    body: payload,
    headers: {
      'x-prumo-timestamp': timestamp,
      'x-prumo-signature': subscription,
    },
  };
}
export async function courseWithLessonPublic(
  prisma: PrismaService,
  opts: {
    slug?: string;
    published?: boolean;
  } = {},
) {
  const course = await prisma.course.create({
    data: {
      slug: opts.slug ?? `curso-${Math.random().toString(36).slice(2, 8)}`,
      title: 'Curso de Teste',
      description: 'description',
      status: opts.published === false ? 'DRAFT' : 'PUBLISHED',
    },
  });
  const module = await prisma.module.create({
    data: { courseId: course.id, order: 1, title: 'Modulo 1' },
  });
  const lesson = await prisma.lesson.create({
    data: {
      moduleId: module.id,
      order: 1,
      type: 'VIDEO',
      title: 'Aula 1',
      contentUrl: 'https://cdn.test/a.mp4',
      status: 'PUBLISHED',
    },
  });
  const lessonDRAFT = await prisma.lesson.create({
    data: {
      moduleId: module.id,
      order: 2,
      type: 'MATERIAL',
      title: 'Aula rascunho',
      status: 'DRAFT',
    },
  });
  return { course, module, lesson, lessonDRAFT };
}
export async function studentWithPlan(t: AppTeste) {
  const user = await createUser(t.prisma, {
    email: `aluno-${Math.random().toString(36).slice(2, 9)}@test.dev`,
  });
  const plan =
    (await t.prisma.plan.findUnique({ where: { slug: 'mensal' } })) ??
    (await createPlan(t.prisma));
  await t.prisma.subscription.create({
    data: {
      userId: user.id,
      planId: plan.id,
      priceCents: 9700,
      status: 'ACTIVE',
      currentPeriodEnd: new Date(Date.now() + 30 * 86400000),
    },
  });
  const token = await login(t.api, user.email, user.password);
  return {
    id: user.id,
    email: user.email,
    password: user.password,
    token,
    planId: plan.id,
  };
}
