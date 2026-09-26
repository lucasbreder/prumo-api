import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import type { AppTeste } from './harness.js';
import { abrirApp, courseWithLessonPublic, createUser, login } from './harness.js';

describe('Pool de mídia (admin) (e2e)', () => {
  let t: AppTeste;
  let adminToken: string;
  beforeAll(async () => {
    t = await abrirApp();
    const admin = await createUser(t.prisma, {
      email: 'media-adm@test.dev',
      role: 'ADMIN',
    });
    adminToken = await login(t.api, admin.email);
    const curso = await courseWithLessonPublic(t.prisma, { slug: 'midia-curso' });
    await t.prisma.lesson.update({
      where: { id: curso.lesson.id },
      data: { blocks: [{ type: 'image', key: 'midia/planta.webp', alt: 'Planta' }] },
    });
    await t.prisma.material.create({
      data: {
        id: 'midia-mat',
        name: 'Ebook guia.pdf',
        type: 'EBOOK',
        url: 'midia/ebook-guia.pdf',
        sizeBytes: 10n,
      },
    });
    await t.prisma.homeHighlight.create({
      data: {
        heroHeadline: 'x',
        heroImages: ['hero/capa.jpg'],
        mentorName: 'a',
        mentorArea: 'b',
        ctaTitle: 'c',
        ctaUrl: '/c',
      },
    });
  });
  afterAll(async () => {
    await t.fechar();
  });
  it('lista aulas (video e imagem de bloco), material e hero num só pool', async () => {
    const res = await t.api
      .get('/admin/media')
      .set('Authorization', `Bearer ${adminToken}`)
      .expect(200);
    const chaves = res.body.media.map((m: { chave: string }) => m.chave);
    expect(chaves).toEqual(
      expect.arrayContaining([
        'https://cdn.test/a.mp4', // lesson contentUrl
        'midia/planta.webp', // lesson block image
        'midia/ebook-guia.pdf', // material
        'hero/capa.jpg', // home hero
      ]),
    );
    const video = res.body.media.find(
      (m: { chave: string }) => m.chave === 'https://cdn.test/a.mp4',
    );
    expect(video.tipo).toBe('video');
    expect(video.usadoEm.length).toBeGreaterThan(0);
    const material = res.body.media.find(
      (m: { chave: string }) => m.chave === 'midia/ebook-guia.pdf',
    );
    expect(material.gerenciavel).toBe(true);
    // chave S3 vira URL assinada
    expect(material.url).toContain('X-Amz-Signature');
  });
  it('filtra por tipo', async () => {
    const img = await t.api
      .get('/admin/media?tipo=image')
      .set('Authorization', `Bearer ${adminToken}`)
      .expect(200);
    expect(img.body.media.every((m: { tipo: string }) => m.tipo === 'image')).toBe(
      true,
    );
    expect(img.body.counts.total).toBeGreaterThanOrEqual(2);
  });
  it('exige admin', async () => {
    await t.api.get('/admin/media').expect(401);
  });
  it('seletor: mentor acessa lista leve (sem usadoEm); aluno bloqueado', async () => {
    const mentor = await createUser(t.prisma, {
      email: 'media-mentor@test.dev',
      role: 'MENTOR',
    });
    const mentorToken = await login(t.api, mentor.email);
    const res = await t.api
      .get('/media/selector')
      .set('Authorization', `Bearer ${mentorToken}`)
      .expect(200);
    const chaves = res.body.media.map((m: { chave: string }) => m.chave);
    expect(chaves).toContain('midia/ebook-guia.pdf');
    // resposta leve: não expõe onde está em uso
    expect(res.body.media[0]).not.toHaveProperty('usadoEm');
    expect(res.body.media[0]).not.toHaveProperty('gerenciavel');
    await t.api
      .get('/media/selector')
      .set('Authorization', `Bearer ${await login(t.api, (await createUser(t.prisma, { email: 'media-aluno@test.dev' })).email)}`)
      .expect(403);
  });
});
