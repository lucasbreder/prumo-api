import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import type { AppTeste } from './harness.js';
import { abrirApp, createUser, login, studentWithPlan } from './harness.js';
describe('Site CMS + newsletter (e2e)', () => {
  let t: AppTeste;
  let adminToken: string;
  beforeAll(async () => {
    t = await abrirApp();
    const admin = await createUser(t.prisma, {
      email: 'cms@test.dev',
      role: 'ADMIN',
    });
    adminToken = await login(t.api, admin.email);
  });
  afterAll(async () => {
    await t.fechar();
  });
  it('newsletter aceita e-mail unico e recusa lixo', async () => {
    await t.api
      .post('/newsletter')
      .send({ email: 'arq@estudio.com' })
      .expect(201);
    await t.api
      .post('/newsletter')
      .send({ email: 'arq@estudio.com' })
      .expect(201);
    await t.api.post('/newsletter').send({ email: 'nao-e-email' }).expect(400);
    expect(await t.prisma.newsletter.count()).toBe(1);
  });
  it('menus do header saem ordenados e o admin ve os inativos', async () => {
    const auth = { Authorization: `Bearer ${adminToken}` };
    await t.api
      .post('/admin/site/menus')
      .set(auth)
      .send({
        location: 'HEADER',
        order: 1,
        label: 'Home',
        url: '/',
        type: 'PAGE',
      })
      .expect(201);
    await t.api
      .post('/admin/site/menus')
      .set(auth)
      .send({
        location: 'HEADER',
        order: 2,
        label: 'Beta',
        url: '/beta',
        type: 'PAGE',
        active: false,
      })
      .expect(201);
    const pub = await t.api.get('/site/menus?location=HEADER').expect(200);
    expect(pub.body.items.map((i: { label: string }) => i.label)).toEqual([
      'Home',
    ]);
    const admin = await t.api
      .get('/admin/site/menus?location=HEADER')
      .set(auth)
      .expect(200);
    expect(admin.body.items).toHaveLength(2);
  });
  it('metodo editavel e depoimentos com aprovacao', async () => {
    const auth = { Authorization: `Bearer ${adminToken}` };
    await t.api
      .put('/admin/site/method')
      .set(auth)
      .send({
        kicker: 'O Método',
        title: 'Três movimentos',
        description: 'para um negocio solido',
        published: true,
        steps: [
          { order: 1, title: 'Você aplica', description: 'a' },
          { order: 2, title: 'O mentor acompanha', description: 'b' },
        ],
      })
      .expect(200);
    const method = await t.api.get('/site/method').expect(200);
    expect(method.body.method.steps).toHaveLength(2);
    const student = await studentWithPlan(t);
    const created = await t.api
      .post('/testimonials')
      .set('Authorization', `Bearer ${student.token}`)
      .send({ text: 'Mudou meu caixa!', rating: 5 })
      .expect(201);
    expect(created.body.status).toBe('PENDING');
    await t.api
      .get('/testimonials')
      .expect(200)
      .then((r) => expect(r.body.items).toHaveLength(0));
    await t.api
      .patch(`/admin/testimonials/${created.body.id}`)
      .set(auth)
      .send({ status: 'APPROVED' })
      .expect(200);
    await t.api
      .get('/testimonials')
      .then((r) => expect(r.body.items).toHaveLength(1));
  });
  it('perfis de mentor: aprovacao pelo CMS', async () => {
    const mentor = await createUser(t.prisma, {
      email: 'mentor-cms@test.dev',
      role: 'MENTOR',
    });
    const auth = { Authorization: `Bearer ${adminToken}` };
    const antes = await t.api.get('/site/mentors').expect(200);
    expect(
      antes.body.mentors.find((m: { id: string }) => m.id === mentor.id),
    ).toBeUndefined();
    await t.api
      .patch(`/admin/mentors/${mentor.id}`)
      .set(auth)
      .send({
        bio: 'Paisagista',
        areas: ['Decoração'],
        featured: true,
        status: 'APPROVED',
      })
      .expect(200);
    const depois = await t.api.get('/site/mentors').expect(200);
    expect(depois.body.mentors[0].areas).toEqual(['Decoração']);
  });

  it('home highlights estruturadas: PUT valido salva e GET publica', async () => {
    const auth = { Authorization: `Bearer ${adminToken}` };
    await t.api
      .put('/admin/site/highlights')
      .set(auth)
      .send({
        hero: {
          headline: 'Toda grande obra começa com uma gestão bem traçada.',
          highlightWord: 'gestão',
          stats: [
            { value: '6', label: 'cursos de gestão' },
            { value: '+3.000', label: 'profissionais' },
          ],
        },
        mentor: { name: 'Marina Sole', area: 'Precificação', slots: 6 },
        cta: { title: 'Pronto para traçar sua obra?', url: '/planos' },
        sections: {
          prumo: { eyebrow: 'O Prumo', lead: 'Na construção, o prumo...' },
          courses: { eyebrow: 'Cursos', title: 'Domine a gestão', linkLabel: 'Ver todos os cursos' },
          advice: { eyebrow: 'Conselho mensal', title: 'Um mentor', description: 'A cada mes', note: 'Incluso nos planos' },
          method: { eyebrow: 'O Método' },
          testimonials: { eyebrow: 'Depoimentos', title: 'Quem já construiu' },
          plans: { eyebrow: 'Planos', title: 'Um só acesso', description: 'Assine' },
          newsletter: { eyebrow: 'Newsletter', title: 'Receba insights', description: 'Uma carta' },
        },
        manifesto: [
          { number: '01', text: 'Primeiro parágrafo' },
          { number: '02', text: 'Segundo parágrafo' },
        ],
        adviceItems: [
          { number: '01', title: 'Você aplica', description: 'desc 1' },
          { number: '02', title: 'O mentor acompanha', description: 'desc 2' },
        ],
      })
      .expect(200);
    const saida = await t.api.get('/site/highlights').expect(200);
    expect(saida.body.highlights.hero.headline).toContain('Toda grande obra');
    expect(saida.body.highlights.hero.stats).toHaveLength(2);
    expect(saida.body.highlights.hero.stats[1].order).toBe(2);
    expect(saida.body.highlights.mentor.slots).toBe(6);
    expect(saida.body.highlights.sections.prumo.lead).toContain('construção');
    expect(saida.body.highlights.sections.advice.note).toBe('Incluso nos planos');
    expect(saida.body.highlights.manifesto).toHaveLength(2);
    expect(saida.body.highlights.manifesto[0].order).toBe(1);
    expect(saida.body.highlights.manifesto[0].text).toBe('Primeiro parágrafo');
    expect(saida.body.highlights.adviceItems[1].title).toBe('O mentor acompanha');
  });

  it('home highlights: payload fora do formato e JSON cru sao recusados', async () => {
    const auth = { Authorization: `Bearer ${adminToken}` };
    await t.api
      .put('/admin/site/highlights')
      .set(auth)
      .send({ destaques: { hero: { headline: 'legado' } } })
      .expect(400);
    await t.api
      .put('/admin/site/highlights')
      .set(auth)
      .send({
        hero: { headline: 'x', stats: [{ value: '1' }] },
        mentor: { name: 'a', area: 'b', slots: 1 },
        cta: { title: 'c', url: '/d' },
      })
      .expect(400);
  });

  it('metodo: etapa sem titulo e rejeitada', async () => {
    const auth = { Authorization: `Bearer ${adminToken}` };
    await t.api
      .put('/admin/site/method')
      .set(auth)
      .send({
        kicker: 'O Método',
        title: 'Três movimentos',
        description: 'para um negocio solido',
        published: true,
        steps: [{ order: 1, description: 'sem titulo' }],
      })
      .expect(400);
  });
});
