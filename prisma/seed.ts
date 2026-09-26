import 'dotenv/config';
import { PrismaClient } from '../src/generated/prisma/client.js';
import { PrismaPg } from '@prisma/adapter-pg';
import { hash } from 'bcryptjs';
const prisma = new PrismaClient({
  adapter: new PrismaPg({ connectionString: process.env.DATABASE_URL }),
});
async function main() {
  // Plans (§4.2)
  const plans = [
    {
      slug: 'mensal',
      name: 'Mensal',
      priceCents: 9700,
      cycle: 'MONTHLY' as const,
      benefits: ['Todos os cursos', 'Comunidade', 'Lives mensais'],
      featured: false,
      order: 1,
    },
    {
      slug: 'anual',
      name: 'Anual',
      priceCents: 7900,
      cycle: 'YEARLY' as const,
      benefits: [
        'Tudo do Mensal',
        'Conselho Mensal (mentoria)',
        '2 meses grátis',
      ],
      featured: true,
      order: 2,
    },
    {
      slug: 'equipes',
      name: 'Equipes',
      priceCents: null,
      cycle: 'TEAM' as const,
      benefits: [
        'Vários assentos',
        'Relatórios de progresso',
        'Mentoria sob medida',
      ],
      featured: false,
      order: 3,
    },
  ];
  const planBySlug = new Map<string, string>();
  for (const p of plans) {
    const salfo = await prisma.plan.upsert({
      where: { slug: p.slug },
      create: { ...p, active: true },
      update: { ...p, active: true },
    });
    planBySlug.set(p.slug, salfo.id);
  }
  // Accounts base
  const passwordAdminHash = await hash('prumo2026adm', 12);
  const admin = await prisma.user.upsert({
    where: { email: 'admin@prumo.dev' },
    create: {
      id: 'seed-admin',
      name: 'Equipe Prumo',
      email: 'admin@prumo.dev',
      passwordHash: passwordAdminHash,
      role: 'ADMIN',
    },
    update: {},
  });
  void admin;
  const mentor = await prisma.user.upsert({
    where: { email: 'marina@prumo.dev' },
    create: {
      id: 'seed-mentor-1',
      name: 'Marina Sole',
      email: 'marina@prumo.dev',
      passwordHash: passwordAdminHash,
      role: 'MENTOR',
      bio: 'Arquiteta e especialista em gestão de estúdios há 15 anos.',
      areas: ['Precificação', 'Gestão financeira'],
      mentorFeatured: true,
      mentorStatus: 'APPROVED',
    },
    update: {},
  });
  const aluna = await prisma.user.upsert({
    where: { email: 'ana@exemplo.dev' },
    create: {
      id: 'seed-aluno-1',
      name: 'Ana Arquiteta',
      email: 'ana@exemplo.dev',
      passwordHash: passwordAdminHash,
      role: 'STUDENT',
    },
    update: {},
  });
  await prisma.subscription.upsert({
    where: { userId: aluna.id },
    create: {
      userId: aluna.id,
      planId: planBySlug.get('anual') as string,
      status: 'ACTIVE',
      priceCents: 7900,
      currentPeriodEnd: new Date(Date.now() + 300 * 86400000),
    },
    update: {},
  });
  // Courses demo
  const courses = [
    {
      slug: 'precificacao-de-projetos',
      title: 'Precificação de Projetos',
      track: 'Gestão',
      description: 'Cobre pelo valor do seu projeto, não pelas horas.',
      status: 'PUBLISHED' as const,
      featured: true,
      order: 1,
    },
    {
      slug: 'fluxo-de-caixa-do-estudio',
      title: 'Fluxo de Caixa do Estúdio',
      track: 'Gestão',
      description: 'Separe PJ de PF e nunca mais tome susto.',
      status: 'PUBLISHED' as const,
      featured: false,
      order: 2,
    },
    {
      slug: 'vendas-sem-desconto',
      title: 'Vendas sem Desconto',
      track: 'Vendas',
      description: 'Propostas que fecham pelo valor, não pelo preço.',
      status: 'DRAFT' as const,
      featured: false,
      order: 3,
    },
  ];
  for (const c of courses) {
    const course = await prisma.course.upsert({
      where: { slug: c.slug },
      create: { ...c },
      update: { ...c },
    });
    await prisma.courseMentor.upsert({
      where: {
        courseId_mentorId: { courseId: course.id, mentorId: mentor.id },
      },
      create: { courseId: course.id, mentorId: mentor.id, role: 'AUTHOR' },
      update: {},
    });
    const module = await prisma.module.upsert({
      where: { courseId_order: { courseId: course.id, order: 1 } },
      create: { courseId: course.id, order: 1, title: 'Fundamentos' },
      update: { title: 'Fundamentos' },
    });
    await prisma.lesson.upsert({
      where: { id: `aula-${c.slug}-1` },
      create: {
        id: `aula-${c.slug}-1`,
        moduleId: module.id,
        order: 1,
        type: 'VIDEO',
        title: 'O erro clássico',
        contentUrl: 'https://cdn.prumo.dev/video/placeholder.mp4',
        durationSeconds: 720,
        status: 'PUBLISHED',
      },
      update: {},
    });
    await prisma.lesson.upsert({
      where: { id: `aula-${c.slug}-2` },
      create: {
        id: `aula-${c.slug}-2`,
        moduleId: module.id,
        order: 2,
        type: 'MATERIAL',
        title: 'Planilha de precificação',
        text: 'Baixe a planilha na seção de materiais.',
        status: 'PUBLISHED',
      },
      update: {},
    });
    await prisma.lesson.upsert({
      where: { id: `aula-${c.slug}-3` },
      create: {
        id: `aula-${c.slug}-3`,
        moduleId: module.id,
        order: 3,
        type: 'TEXT',
        title: 'Guia de leitura: como precificar',
        blocks: [
          { type: 'heading', level: 2, content: [{ text: 'O custo-hora do estúdio' }] },
          {
            type: 'paragraph',
            content: [
              { text: 'Comece somando todos os custos fixos e ' },
              { text: 'variáveis', italic: true },
              { text: ' do mês.' },
            ],
          },
          {
            type: 'callout',
            tone: 'info',
            content: [{ text: 'Dica: inclua seu próprio Pró-labore no cálculo.' }],
          },
          { type: 'divider' },
          {
            type: 'bulletList',
            items: [
              [{ text: 'Defina a margem desejada' }],
              [{ text: 'Ajuste para a praça' }],
            ],
          },
        ],
        status: 'PUBLISHED',
      },
      update: {},
    });
  }
  // Materials (§6 Downloads)
  await prisma.material.upsert({
    where: { id: 'mat-checklist-proposta' },
    create: {
      id: 'mat-checklist-proposta',
      name: 'Checklist de Proposta.pdf',
      type: 'CHECKLIST',
      url: 'https://cdn.prumo.dev/checklist-proposta.pdf',
      sizeBytes: 182000n,
      courseId: null,
    },
    update: {},
  });
  // CMS — highlights da home estruturados (before: PageContent.secoesJson)
  const highlightExisting = await prisma.homeHighlight.findFirst({
    select: { id: true, heroImages: true },
  });
  const highlightId = highlightExisting?.id ?? 'highlight-home-1';
  const heroImagens = [
    '/images/hero.png',
    '/images/pj-obra.jpg',
    '/images/pj-skyline.jpg',
  ];
  await prisma.homeHighlight.upsert({
    where: { id: highlightId },
    create: {
      id: highlightId,
      heroHeadline: 'Toda grande obra começa com uma gestão bem traçada.',
      heroHighlightWord: 'gestão',
      heroImages: heroImagens,
      mentorName: 'Marina Sole',
      mentorArea: 'Precificação',
      mentorSlots: 6,
      ctaTitle: 'Pronto para traçar sua obra?',
      ctaUrl: '/planos',
    },
    // Semeia as fotos do hero apenas quando ainda não há nenhuma cadastrada.
    update: highlightExisting?.heroImages?.length ? {} : { heroImages: heroImagens },
  });
  await prisma.homeHighlightStat.deleteMany({ where: { highlightId } });
  await prisma.homeHighlightStat.createMany({
    data: [
      { highlightId, order: 1, value: '6', label: 'cursos de gestão' },
      { highlightId, order: 2, value: '+3.000', label: 'profissionais' },
      { highlightId, order: 3, value: '4.9', label: 'avaliação média' },
    ],
  });
  // Secao "O Prumo" (manifesto) e itens do conselho mensal — textos da home.
  // Semeia apenas quando ainda não há itens cadastrados (não sobrescreve o CMS).
  if ((await prisma.homeManifestoItem.count({ where: { highlightId } })) === 0) {
    await prisma.homeManifestoItem.createMany({
    data: [
      {
        highlightId,
        order: 1,
        number: '01',
        text: 'A maioria dos profissionais de arquitetura e decoração domina o projeto, mas naufraga no negócio. Falta método para precificar, gerir o caixa e formar times.',
      },
      {
        highlightId,
        order: 2,
        number: '02',
        text: 'O Prumo nasceu para preencher essa lacuna: cursos objetivos, sofisticados e profundos, ensinados por quem vive a arquitetura e a gestão no dia a dia.',
      },
      {
        highlightId,
        order: 3,
        number: '03',
        text: 'Sem fórmula mágica. Com rigor de obra e elegância de ateliê, para transformar seu estúdio em uma operação previsível e próspera.',
      },
    ],
    });
  }
  if ((await prisma.homeAdviceItem.count({ where: { highlightId } })) === 0) {
    await prisma.homeAdviceItem.createMany({
    data: [
      {
        highlightId,
        order: 1,
        number: '01',
        title: 'Você aplica no dia a dia',
        description:
          'Coloca em prática as ações e ferramentas dos cursos no seu próprio estúdio.',
      },
      {
        highlightId,
        order: 2,
        number: '02',
        title: 'O mentor acompanha',
        description:
          'Observa os resultados e o contexto real do seu negócio ao longo do mês.',
      },
      {
        highlightId,
        order: 3,
        number: '03',
        title: 'Feedback com devolutiva',
        description:
          'Revisão mensal com ajustes, prioridades e próximos passos bem definidos.',
      },
    ],
    });
  }
  await prisma.communityRule.deleteMany();
  await prisma.communityRule.createMany({
    data: [
      { order: 1, text: 'Respeito acima de tudo: estamos todos aprendendo.' },
      { order: 2, text: 'Sem autopromoção ou venda direta.' },
      {
        order: 3,
        text: 'Compartilhe números reais do seu estúdio, sem expor clientes.',
      },
    ],
  });
  const menusHeader = [
    { order: 1, label: 'Home', url: '/' },
    { order: 2, label: 'Cursos', url: '/#cursos' },
    { order: 3, label: 'Método', url: '/metodo' },
    { order: 4, label: 'Depoimentos', url: '/#depoimentos' },
    { order: 5, label: 'Planos', url: '/#planos' },
    { order: 6, label: 'Mentores', url: '/mentores' },
  ];
  for (const m of menusHeader) {
    await prisma.siteMenu.upsert({
      where: { location_order: { location: 'HEADER', order: m.order } },
      create: { location: 'HEADER', type: 'PAGE', active: true, ...m },
      update: { label: m.label, url: m.url, active: true },
    });
  }
  const menusFooter = [
    { order: 1, label: 'Gestão Financeira', url: '/cursos', column: 'Cursos' },
    { order: 2, label: 'Precificação', url: '/cursos', column: 'Cursos' },
    { order: 3, label: 'Liderança', url: '/cursos', column: 'Cursos' },
    { order: 4, label: 'Marketing', url: '/cursos', column: 'Cursos' },
    { order: 5, label: 'O método', url: '/metodo', column: 'Empresa' },
    { order: 6, label: 'Mentores', url: '/mentores', column: 'Empresa' },
    { order: 7, label: 'Para equipes', url: '/planos', column: 'Empresa' },
    { order: 8, label: 'Depoimentos', url: '/depoimentos', column: 'Suporte' },
    { order: 9, label: 'Planos', url: '/planos', column: 'Suporte' },
  ];
  for (const m of menusFooter) {
    await prisma.siteMenu.upsert({
      where: { location_order: { location: 'FOOTER', order: m.order } },
      create: { location: 'FOOTER', type: 'LINK', active: true, ...m },
      update: { label: m.label, url: m.url, column: m.column, active: true },
    });
  }
  const methodExisting = await prisma.method.findFirst({
    select: { id: true },
  });
  if (!methodExisting) {
    await prisma.method.create({
      data: {
        kicker: 'O Método Prumo',
        title: 'Três movimentos para erguer um negócio sólido.',
        description:
          'Você aplica, o mentor acompanha e o feedback vira devolutiva.',
        published: true,
        steps: {
          create: [
            {
              order: 1,
              title: 'Você aplica',
              description: 'Planilhas e protocolos direto no seu estúdio.',
            },
            {
              order: 2,
              title: 'O mentor acompanha',
              description: 'Conselho mensal com quem vive gestão de estúdio.',
            },
            {
              order: 3,
              title: 'Feedback com devolutiva',
              description: 'Cada entrega volta com parecer gravado.',
            },
          ],
        },
      },
    });
  }
  await prisma.testimonial.upsert({
    where: { id: 'dep-seed-1' },
    create: {
      id: 'dep-seed-1',
      studentId: aluna.id,
      author: 'Ana Arquiteta',
      text: 'Em três meses parei de trabalhar de graça. O Prumo mudou meu fluxo de caixa.',
      rating: 5,
      status: 'APPROVED',
      visible: true,
    },
    update: {},
  });
  // Lives/mentorias
  const lives = [
    {
      id: 'live-seed-proxima',
      title: 'Live: proposta que fecha pelo valor',
      description:
        'Ao vivo com Marina Sole montando uma proposta de projeto residencial.',
      type: 'LIVE' as const,
      startsAt: new Date(Date.now() + 6 * 86400000),
      durationMin: 90,
      status: 'SCHEDULED' as const,
      mentorName: 'Marina Sole',
    },
    {
      id: 'live-seed-mentoria',
      title: 'Conselho mensal: caixa do estúdio',
      description:
        'Mentoria coletiva do plano Anual — revisão de números reais.',
      type: 'MENTORING' as const,
      startsAt: new Date(Date.now() + 12 * 86400000),
      durationMin: 60,
      status: 'SCHEDULED' as const,
      mentorName: 'Marina Sole',
    },
    {
      id: 'live-seed-encerrada',
      title: 'Live: precificação na prática',
      description: 'Casos reais de precificação ao vivo.',
      type: 'LIVE' as const,
      startsAt: new Date(Date.now() - 10 * 86400000),
      durationMin: 60,
      status: 'ENDED' as const,
      recordingUrl: 'https://play.prumo.dev/precificacao-pratica',
      mentorName: 'Marina Sole',
    },
  ];
  for (const l of lives) {
    await prisma.live.upsert({ where: { id: l.id }, create: l, update: {} });
  }
  console.log(
    'Seed concluido: planos, contas (admin@prumo.dev / marina@prumo.dev / ana@exemplo.dev, senha prumo2026adm), cursos e CMS.',
  );
}
main()
  .catch((e) => {
    console.error(e);
    process.exitCode = 1;
  })
  .finally(() => prisma.$disconnect());
