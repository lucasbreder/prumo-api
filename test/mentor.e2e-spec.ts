import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import type { AppTeste } from './harness.js';
import {
  abrirApp,
  createUser,
  courseWithLessonPublic,
  login,
} from './harness.js';
describe('Area do mentor (e2e)', () => {
  let t: AppTeste;
  let mentor: {
    id: string;
    token: string;
  };
  let outroMentor: {
    id: string;
    token: string;
  };
  let adminToken: string;
  beforeAll(async () => {
    t = await abrirApp();
    const admin = await createUser(t.prisma, {
      email: 'root@test.dev',
      role: 'ADMIN',
    });
    adminToken = await login(t.api, admin.email);
    const m1 = await createUser(t.prisma, {
      email: 'mentor1@test.dev',
      role: 'MENTOR',
    });
    const m2 = await createUser(t.prisma, {
      email: 'mentor2@test.dev',
      role: 'MENTOR',
    });
    mentor = { id: m1.id, token: await login(t.api, m1.email) };
    outroMentor = { id: m2.id, token: await login(t.api, m2.email) };
  });
  afterAll(async () => {
    await t.fechar();
  });
  it('mentor so enxerga cursos vinculados', async () => {
    const meu = await t.api
      .get('/mentor/courses')
      .set('Authorization', `Bearer ${mentor.token}`)
      .expect(200);
    expect(meu.body.courses).toHaveLength(0);
    const course = await courseWithLessonPublic(t.prisma, {
      slug: 'curso-do-mentor',
    });
    await t.api
      .post(`/admin/courses/${course.course.id}/mentors`)
      .set('Authorization', `Bearer ${adminToken}`)
      .send({ mentorId: mentor.id, role: 'AUTHOR' })
      .expect(201);
    const depois = await t.api
      .get('/mentor/courses')
      .set('Authorization', `Bearer ${mentor.token}`)
      .expect(200);
    expect(depois.body.courses).toHaveLength(1);
    expect(depois.body.courses[0].curriculumPublishedPercent).toBe(50);
    // other mentor not sees nem edita
    await t.api
      .get(`/mentor/courses/${course.course.id}`)
      .set('Authorization', `Bearer ${outroMentor.token}`)
      .expect(403);
  });
  it('fluxo rascunho -> revisao -> publicacao pela equipe', async () => {
    const course = (
      await t.api
        .get('/mentor/courses')
        .set('Authorization', `Bearer ${mentor.token}`)
    ).body.courses[0];
    const module = await t.api
      .post(`/mentor/courses/${course.id}/modules`)
      .set('Authorization', `Bearer ${mentor.token}`)
      .send({ title: 'Novo modulo' })
      .expect(201);
    const lesson = await t.api
      .post(`/mentor/courses/${course.id}/lessons`)
      .set('Authorization', `Bearer ${mentor.token}`)
      .send({
        moduleId: module.body.id,
        title: 'Aula nova',
        type: 'VIDEO',
        contentUrl: 'https://cdn/nova.mp4',
      })
      .expect(201);
    expect(lesson.body.status).toBe('DRAFT');
    await t.api
      .post(`/lessons/${lesson.body.id}/review`)
      .set('Authorization', `Bearer ${mentor.token}`)
      .expect(202);
    // admin approves
    await t.api
      .post(`/admin/courses/lessons/${lesson.body.id}/approve`)
      .set('Authorization', `Bearer ${adminToken}`)
      .expect(200);
    const curriculum = await t.api
      .get(`/mentor/courses/${course.id}`)
      .set('Authorization', `Bearer ${mentor.token}`)
      .expect(200);
    const publicada = curriculum.body.lessons.find(
      (l: { lessonId: string }) => l.lessonId === lesson.body.id,
    );
    expect(publicada.status).toBe('PUBLISHED');
  });
  it('aula sem conteudo nao vai para revisao', async () => {
    const course = (
      await t.api
        .get('/mentor/courses')
        .set('Authorization', `Bearer ${mentor.token}`)
    ).body.courses[0];
    const module = await t.api
      .post(`/mentor/courses/${course.id}/modules`)
      .set('Authorization', `Bearer ${mentor.token}`)
      .send({ title: 'Mod vazio' });
    const lesson = await t.api
      .post(`/mentor/courses/${course.id}/lessons`)
      .set('Authorization', `Bearer ${mentor.token}`)
      .send({ moduleId: module.body.id, title: 'Sem conteudo', type: 'VIDEO' })
      .expect(201);
    await t.api
      .post(`/lessons/${lesson.body.id}/review`)
      .set('Authorization', `Bearer ${mentor.token}`)
      .expect(422);
  });
  it('editar aula enviando type nao e rejeitado (upload de video)', async () => {
    const course = (
      await t.api
        .get('/mentor/courses')
        .set('Authorization', `Bearer ${mentor.token}`)
    ).body.courses[0];
    const module = await t.api
      .post(`/mentor/courses/${course.id}/modules`)
      .set('Authorization', `Bearer ${mentor.token}`)
      .send({ title: 'Mod video' });
    const lesson = await t.api
      .post(`/mentor/courses/${course.id}/lessons`)
      .set('Authorization', `Bearer ${mentor.token}`)
      .send({
        moduleId: module.body.id,
        title: 'Video aula',
        type: 'VIDEO',
        contentUrl: 'uploads/mentor/video.mp4',
      })
      .expect(201);
    // reabrir o editor e salvar de novo envia `type` no PATCH
    await t.api
      .patch(`/mentor/courses/lessons/${lesson.body.id}`)
      .set('Authorization', `Bearer ${mentor.token}`)
      .send({
        title: 'Video aula',
        type: 'VIDEO',
        contentUrl: 'uploads/mentor/video-novo.mp4',
      })
      .expect(200);
  });
  it('admin alterna status rascunho <-> publicado direto na aula', async () => {
    const course = (
      await t.api
        .get('/mentor/courses')
        .set('Authorization', `Bearer ${mentor.token}`)
    ).body.courses[0];
    const module = await t.api
      .post(`/mentor/courses/${course.id}/modules`)
      .set('Authorization', `Bearer ${mentor.token}`)
      .send({ title: 'Mod status' });
    const created = await t.api
      .post(`/mentor/courses/${course.id}/lessons`)
      .set('Authorization', `Bearer ${mentor.token}`)
      .send({
        moduleId: module.body.id,
        title: 'Com conteudo',
        type: 'MATERIAL',
        text: 'leitura',
      })
      .expect(201);
    expect(created.body.status).toBe('DRAFT');
    const pub = await t.api
      .patch(`/admin/courses/lessons/${created.body.id}/status`)
      .set('Authorization', `Bearer ${adminToken}`)
      .send({ status: 'PUBLISHED' })
      .expect(200);
    expect(pub.body.status).toBe('PUBLISHED');
    const volta = await t.api
      .patch(`/admin/courses/lessons/${created.body.id}/status`)
      .set('Authorization', `Bearer ${adminToken}`)
      .send({ status: 'DRAFT' })
      .expect(200);
    expect(volta.body.status).toBe('DRAFT');
    // status invalido -> 400
    await t.api
      .patch(`/admin/courses/lessons/${created.body.id}/status`)
      .set('Authorization', `Bearer ${adminToken}`)
      .send({ status: 'ARQUIVADO' })
      .expect(400);
    // mentor nao pode mudar status direto -> 403
    await t.api
      .patch(`/admin/courses/lessons/${created.body.id}/status`)
      .set('Authorization', `Bearer ${mentor.token}`)
      .send({ status: 'PUBLISHED' })
      .expect(403);
  });
  it('mentor remove aula do proprio curso; intruso nao', async () => {
    const course = (
      await t.api
        .get('/mentor/courses')
        .set('Authorization', `Bearer ${mentor.token}`)
    ).body.courses[0];
    const module = await t.api
      .post(`/mentor/courses/${course.id}/modules`)
      .set('Authorization', `Bearer ${mentor.token}`)
      .send({ title: 'Mod remover' });
    const lesson = await t.api
      .post(`/mentor/courses/${course.id}/lessons`)
      .set('Authorization', `Bearer ${mentor.token}`)
      .send({
        moduleId: module.body.id,
        title: 'A remover',
        type: 'MATERIAL',
        text: 'leitura',
      })
      .expect(201);
    // outro mentor nao pode remover
    await t.api
      .delete(`/mentor/courses/lessons/${lesson.body.id}`)
      .set('Authorization', `Bearer ${outroMentor.token}`)
      .expect(403);
    // mentor dono remove
    await t.api
      .delete(`/mentor/courses/lessons/${lesson.body.id}`)
      .set('Authorization', `Bearer ${mentor.token}`)
      .expect(204);
    const curriculum = await t.api
      .get(`/mentor/courses/${course.id}`)
      .set('Authorization', `Bearer ${mentor.token}`)
      .expect(200);
    expect(
      curriculum.body.lessons.find(
        (l: { lessonId: string }) => l.lessonId === lesson.body.id,
      ),
    ).toBeUndefined();
  });
  it('admin remove aula do curriculo', async () => {
    const course = (
      await t.api
        .get('/mentor/courses')
        .set('Authorization', `Bearer ${mentor.token}`)
    ).body.courses[0];
    const module = await t.api
      .post(`/mentor/courses/${course.id}/modules`)
      .set('Authorization', `Bearer ${mentor.token}`)
      .send({ title: 'Mod remover admin' });
    const lesson = await t.api
      .post(`/mentor/courses/${course.id}/lessons`)
      .set('Authorization', `Bearer ${mentor.token}`)
      .send({
        moduleId: module.body.id,
        title: 'A remover admin',
        type: 'MATERIAL',
        text: 'leitura',
      })
      .expect(201);
    await t.api
      .delete(`/admin/courses/lessons/${lesson.body.id}`)
      .set('Authorization', `Bearer ${adminToken}`)
      .expect(204);
    await t.api
      .delete(`/admin/courses/lessons/${lesson.body.id}`)
      .set('Authorization', `Bearer ${adminToken}`)
      .expect(404);
  });
  it('GET /mentor/materiais so mostra materiais dos cursos do mentor', async () => {
    const course = (
      await t.api
        .get('/mentor/courses')
        .set('Authorization', `Bearer ${mentor.token}`)
    ).body.courses[0];
    await t.prisma.material.create({
      data: {
        id: 'mat-meu',
        name: 'plan.pdf',
        type: 'PDF',
        url: 'https://cdn/a.pdf',
        sizeBytes: 10n,
        courseId: course.id,
      },
    });
    await t.prisma.material.create({
      data: {
        id: 'mat-outro',
        name: 'x.pdf',
        type: 'PDF',
        url: 'https://cdn/x.pdf',
        sizeBytes: 10n,
      },
    });
    const output = await t.api
      .get('/mentor/materials')
      .set('Authorization', `Bearer ${mentor.token}`)
      .expect(200);
    expect(output.body.materials.map((m: { id: string }) => m.id)).toEqual([
      'mat-meu',
    ]);
    const _student = await createUser(t.prisma, {
      email: 'aluno-mat@test.dev',
    });
    await t.api
      .get('/mentor/materials')
      .set(
        'Authorization',
        `Bearer ${await login(t.api, 'aluno-mat@test.dev')}`,
      )
      .expect(403);
  });
  it('upload multipart de aula: valida limite, formato e papel', async () => {
    const aluno = await createUser(t.prisma, { email: 'aluno-mp@test.dev' });
    const alunoToken = await login(t.api, aluno.email);
    // aluno não pode iniciar upload
    await t.api
      .post('/uploads/multipart')
      .set('Authorization', `Bearer ${alunoToken}`)
      .send({ nameArquivo: 'a.mp4', sizeBytes: 100 })
      .expect(403);
    // acima de 20 GB é rejeitado no DTO
    await t.api
      .post('/uploads/multipart')
      .set('Authorization', `Bearer ${mentor.token}`)
      .send({ nameArquivo: 'gigante.mp4', sizeBytes: 21 * 1024 * 1024 * 1024 })
      .expect(400);
    // formato não suportado
    await t.api
      .post('/uploads/multipart')
      .set('Authorization', `Bearer ${mentor.token}`)
      .send({ nameArquivo: 'virus.exe', sizeBytes: 100 })
      .expect(422);
    // complete sem partes
    await t.api
      .post('/uploads/multipart/complete')
      .set('Authorization', `Bearer ${mentor.token}`)
      .send({ chave: 'k', uploadId: 'u', partes: [] })
      .expect(422);
  });
  it('upload assinado aceita somente formatos permitidos', async () => {
    await t.api
      .post('/uploads/presign')
      .set('Authorization', `Bearer ${mentor.token}`)
      .send({ nameArquivo: 'aula.mp4', sizeBytes: 1000 })
      .expect(201)
      .expect((r) => expect(r.body.url).toContain('X-Amz-Signature'));
    await t.api
      .post('/uploads/presign')
      .set('Authorization', `Bearer ${mentor.token}`)
      .send({ nameArquivo: 'virus.exe', sizeBytes: 10 })
      .expect(422);
    await t.api
      .post('/uploads/presign')
      .set('Authorization', `Bearer ${await login(t.api, 'root@test.dev')}`)
      .send({ nameArquivo: 'capa.pdf', sizeBytes: 10 })
      .expect(201);
    // student not can presign
    const student = await createUser(t.prisma, {
      email: 'aluno-upload@test.dev',
    });
    await t.api
      .post('/uploads/presign')
      .set('Authorization', `Bearer ${await login(t.api, student.email)}`)
      .send({ nameArquivo: 'x.pdf', sizeBytes: 1 })
      .expect(403);
  });
});
