import { describe, expect, it } from 'vitest';
import {
  FakeMethodRepo,
  FakeMenuRepo,
  FakeTestimonialRepo,
  FakeNewsletterRepo,
  FakeMentors,
  FakeHighlightsRepo,
  FakeImageStorage,
} from '../fakes/site.fakes.js';
import {
  SubscribeNewsletterUseCase,
  GetHighlightsUseCase,
  PresignHeroUploadUseCase,
  PreviewHeroImagesUseCase,
  SaveHighlightsUseCase,
  ListPublicTestimonialsUseCase,
  ListMenusUseCase,
  GetMethodUseCase,
  RegisterTestimonialUseCase,
  SaveTestimonialStatusUseCase,
  SaveMethodUseCase,
  SaveMenuItemUseCase,
  UpdateMentorProfileUseCase,
  ListPublicMentorsUseCase,
} from './site.usecases.js';
import { BusinessRuleError } from '../../../../shared/errors/domain.errors.js';
describe('Site/CMS', () => {
  it('home highlights: salva e le de volta com ordem das stats normalizada', async () => {
    const highlights = new FakeHighlightsRepo();
    await new SaveHighlightsUseCase({ highlights }).execute({
      hero: {
        headline: 'Toda grande obra começa com uma gestão bem traçada.',
        highlightWord: 'gestao',
        images: [],
        stats: [
          { value: '6', label: 'cursos de gestao' },
          { value: '+3.000', label: 'profissionais' },
        ],
      },
      mentor: { name: 'Marina Sole', area: 'Precificacao', slots: 6 },
      cta: { title: 'Pronto para tracar?', url: '/planos' },
    });
    const out = await new GetHighlightsUseCase({ highlights }).execute();
    if ('hero' in out) {
      expect(out.hero.stats[1].order).toBe(2);
      expect(out.hero.headline).toContain('obra');
    } else {
      throw new Error('highlights vazio');
    }
  });

  it('home highlights: aceita varias fotos do hero e preserva a ordem', async () => {
    const highlights = new FakeHighlightsRepo();
    await new SaveHighlightsUseCase({ highlights }).execute({
      hero: {
        headline: 'X',
        highlightWord: null,
        images: ['/images/hero.png', '/images/pj-obra.jpg', '/images/pj-skyline.jpg'],
        stats: [],
      },
      mentor: { name: 'a', area: 'b', slots: 1 },
      cta: { title: 'c', url: '/d' },
    });
    const out = await new GetHighlightsUseCase({ highlights }).execute();
    if ('hero' in out) {
      expect(out.hero.images).toHaveLength(3);
      expect(out.hero.images[1]).toBe('/images/pj-obra.jpg');
    } else {
      throw new Error('highlights vazio');
    }
  });

  it('home highlights: remove URLs vazias e normaliza espacos', async () => {
    const highlights = new FakeHighlightsRepo();
    const saved = await new SaveHighlightsUseCase({ highlights }).execute({
      hero: {
        headline: 'X',
        highlightWord: null,
        images: ['  /images/a.jpg ', '', '   ', '/images/b.jpg'],
        stats: [],
      },
      mentor: { name: 'a', area: 'b', slots: 1 },
      cta: { title: 'c', url: '/d' },
    });
    expect(saved.hero.images).toEqual(['/images/a.jpg', '/images/b.jpg']);
  });

  it('home highlights: mais de 8 fotos do hero falha', async () => {
    const highlights = new FakeHighlightsRepo();
    await expect(
      new SaveHighlightsUseCase({ highlights }).execute({
        hero: {
          headline: 'x',
          highlightWord: null,
          images: Array.from({ length: 9 }, (_, i) => `/images/${i}.jpg`),
          stats: [],
        },
        mentor: { name: 'a', area: 'b', slots: 1 },
        cta: { title: 'c', url: '/d' },
      }),
    ).rejects.toBeInstanceOf(BusinessRuleError);
  });

  it('home highlights: sem registro retorna objeto vazio', async () => {
    const highlights = new FakeHighlightsRepo();
    expect(await new GetHighlightsUseCase({ highlights }).execute()).toEqual(
      {},
    );
  });

  it('home highlights: salva textos das seções com itens ordenados e lê de volta', async () => {
    const highlights = new FakeHighlightsRepo();
    await new SaveHighlightsUseCase({ highlights }).execute({
      hero: { headline: 'x', highlightWord: null, images: [], stats: [] },
      mentor: { name: 'a', area: 'b', slots: 1 },
      cta: { title: 'c', url: '/d' },
      sections: {
        prumo: { eyebrow: 'O Prumo', lead: 'Na construção, o prumo...' },
        courses: { eyebrow: 'Cursos', title: 'Domine a gestão', linkLabel: 'Ver todos os cursos' },
        advice: { eyebrow: 'Conselho mensal', title: 'Um mentor...', description: 'A cada mês...', note: 'Incluso nos planos' },
        method: { eyebrow: 'O Método' },
        testimonials: { eyebrow: 'Depoimentos', title: 'Quem já construiu' },
        plans: { eyebrow: 'Planos', title: 'Um só acesso', description: 'Assine...', visible: false },
        newsletter: { eyebrow: 'Newsletter', title: 'Receba insights', description: 'Uma carta...' },
      },
      manifesto: [
        { number: '02', text: 'segundo' },
        { number: '01', text: 'primeiro' },
      ],
      adviceItems: [{ number: '01', title: 'Você aplica', description: 'desc' }],
    });
    const out = await new GetHighlightsUseCase({ highlights }).execute();
    if (!('sections' in out) || !out.sections) throw new Error('sections ausentes');
    expect(out.sections.prumo.lead).toContain('construção');
    expect(out.sections.plans.visible).toBe(false);
    expect(out.manifesto?.map((m) => m.order)).toEqual([1, 2]);
    expect(out.manifesto?.[0].text).toBe('segundo');
    expect(out.adviceItems?.[0].title).toBe('Você aplica');
  });

  it('home highlights: mais de 6 paragrafos do manifesto falha', async () => {
    const highlights = new FakeHighlightsRepo();
    await expect(
      new SaveHighlightsUseCase({ highlights }).execute({
        hero: { headline: 'x', highlightWord: null, images: [], stats: [] },
        mentor: { name: 'a', area: 'b', slots: 1 },
        cta: { title: 'c', url: '/d' },
        manifesto: Array.from({ length: 7 }, (_, i) => ({ number: `0${i}`, text: 't' })),
      }),
    ).rejects.toBeInstanceOf(BusinessRuleError);
  });

  it('home highlights: read do publico assina chaves e mantem URLs pass-through', async () => {
    const highlights = new FakeHighlightsRepo();
    const images = new FakeImageStorage();
    await new SaveHighlightsUseCase({ highlights }).execute({
      hero: {
        headline: 'x',
        highlightWord: null,
        images: ['hero/abc.jpg', '/images/hero.png', 'https://cdn/x.jpg'],
        stats: [],
      },
      mentor: { name: 'a', area: 'b', slots: 1 },
      cta: { title: 'c', url: '/d' },
    });
    const raw = await new GetHighlightsUseCase({ highlights }).execute();
    if ('hero' in raw) {
      // Admin: chaves cruas para editar/salvar.
      expect(raw.hero.images).toEqual([
        'hero/abc.jpg',
        '/images/hero.png',
        'https://cdn/x.jpg',
      ]);
    } else {
      throw new Error('highlights vazio');
    }
    const pub = await new GetHighlightsUseCase({
      highlights,
      images,
    }).execute({ signedImages: true });
    if ('hero' in pub) {
      expect(pub.hero.images[0]).toBe('https://storage.test/hero/abc.jpg?sig=1');
      expect(pub.hero.images[1]).toBe('/images/hero.png');
      expect(pub.hero.images[2]).toBe('https://cdn/x.jpg');
    } else {
      throw new Error('highlights vazio');
    }
  });

  it('home highlights: recusa cadastrar imagem em base64', async () => {
    const highlights = new FakeHighlightsRepo();
    await expect(
      new SaveHighlightsUseCase({ highlights }).execute({
        hero: {
          headline: 'x',
          highlightWord: null,
          images: ['data:image/png;base64,AAAA'],
          stats: [],
        },
        mentor: { name: 'a', area: 'b', slots: 1 },
        cta: { title: 'c', url: '/d' },
      }),
    ).rejects.toBeInstanceOf(BusinessRuleError);
  });

  it('preview hero: mantém 1 URL por token, preservando a ordem', async () => {
    const out = await new PreviewHeroImagesUseCase({
      images: new FakeImageStorage(),
    }).execute([
      'data:image/png;base64,AAAA',
      '/images/hero.png',
      'hero/x.jpg',
    ]);
    expect(out).toEqual([
      'data:image/png;base64,AAAA',
      '/images/hero.png',
      'https://storage.test/hero/x.jpg?sig=1',
    ]);
  });

  it('presign hero upload: aceita imagem e devolve chave sob hero/', async () => {
    const storage = new FakeImageStorage();
    const r = await new PresignHeroUploadUseCase({ storage }).execute({
      nomeArquivo: 'Fachada Obra.jpg',
      contentType: 'image/jpeg',
      sizeBytes: 500_000,
    });
    expect(r.chave).toMatch(/^hero\//);
    expect(r.uploadUrl).toContain('upload=1');
    expect(storage.chamadas[0].tipo).toBe('image/jpeg');
  });

  it('presign hero upload: recusa tipo nao-imagem e arquivo grande', async () => {
    const storage = new FakeImageStorage();
    const usecase = new PresignHeroUploadUseCase({ storage });
    await expect(
      usecase.execute({
        nomeArquivo: 'x.mp4',
        contentType: 'video/mp4',
        sizeBytes: 1000,
      }),
    ).rejects.toBeInstanceOf(BusinessRuleError);
    await expect(
      usecase.execute({
        nomeArquivo: 'big.png',
        contentType: 'image/png',
        sizeBytes: 20 * 1024 * 1024,
      }),
    ).rejects.toBeInstanceOf(BusinessRuleError);
  });

  it('home highlights: mais de 6 stats falha', async () => {
    const highlights = new FakeHighlightsRepo();
    await expect(
      new SaveHighlightsUseCase({ highlights }).execute({
        hero: {
          headline: 'x',
          highlightWord: null,
          images: [],
          stats: Array.from({ length: 7 }, () => ({ value: '1', label: 'a' })),
        },
        mentor: { name: 'a', area: 'b', slots: 1 },
        cta: { title: 'c', url: '/d' },
      }),
    ).rejects.toBeInstanceOf(BusinessRuleError);
  });

  it('menus: criar, ordenar e listar apenas ativos no publico', async () => {
    const menus = new FakeMenuRepo();
    const save = new SaveMenuItemUseCase({ menus });
    await save.execute({
      location: 'HEADER',
      order: 1,
      label: 'Home',
      url: '/',
      type: 'PAGE',
    });
    await save.execute({
      location: 'HEADER',
      order: 2,
      label: 'Cursos',
      url: '/courses',
      type: 'PAGE',
    });
    const desativado = await save.execute({
      location: 'HEADER',
      order: 3,
      label: 'Beta',
      url: '/beta',
      type: 'PAGE',
      active: false,
    });
    const pub = await new ListMenusUseCase({ menus }).execute({
      location: 'HEADER',
      onlyActive: true,
    });
    expect(pub.items.map((i) => i.label)).toEqual(['Home', 'Cursos']);
    const admin = await new ListMenusUseCase({ menus }).execute({
      location: 'HEADER',
      onlyActive: false,
    });
    expect(admin.items.some((i) => i.label === 'Beta')).toBe(true);
    void desativado;
  });
  it('metodo com etapas sorted e republicavel', async () => {
    const method = new FakeMethodRepo();
    await new SaveMethodUseCase({ method }).execute({
      kicker: 'O Método',
      title: 'Três movimentos',
      description: 'Para erguer um negócio sólido.',
      published: true,
      steps: [
        { order: 1, title: 'Você aplica', description: 'prática' },
        { order: 2, title: 'O mentor acompanha', description: 'devolutiva' },
      ],
    });
    const output = await new GetMethodUseCase({ method }).execute();
    expect(output?.steps[1].title).toBe('O mentor acompanha');
  });
  it('metodo nao publicado some do publico', async () => {
    const method = new FakeMethodRepo();
    await new SaveMethodUseCase({ method }).execute({
      kicker: 'x',
      title: 'y',
      description: 'z',
      published: false,
      steps: [],
    });
    expect(await new GetMethodUseCase({ method }).execute()).toBeNull();
  });
  it('depoimento de aluno entra pendente e so aparece aprovado+visivel', async () => {
    const repo = new FakeTestimonialRepo();
    const create = new RegisterTestimonialUseCase({ testimonials: repo });
    const created = await create.execute({
      studentId: 'a1',
      authorName: 'Ana',
      text: 'Mudou meu estúdio.',
      rating: 5,
      roleAuthor: 'STUDENT',
    });
    expect(created.status).toBe('PENDING');
    expect(
      (
        await new ListPublicTestimonialsUseCase({
          testimonials: repo,
        }).execute()
      ).items,
    ).toHaveLength(0);
    await new SaveTestimonialStatusUseCase({ testimonials: repo }).execute({
      id: created.id,
      status: 'APPROVED',
    });
    const list = await new ListPublicTestimonialsUseCase({
      testimonials: repo,
    }).execute();
    expect(list.items[0].rating).toBe(5);
    await new SaveTestimonialStatusUseCase({ testimonials: repo }).execute({
      id: created.id,
      visible: false,
    });
    expect(
      (
        await new ListPublicTestimonialsUseCase({
          testimonials: repo,
        }).execute()
      ).items,
    ).toHaveLength(0);
  });
  it('nota do depoimento fora de 1..5 falha', async () => {
    const repo = new FakeTestimonialRepo();
    await expect(
      new RegisterTestimonialUseCase({ testimonials: repo }).execute({
        studentId: 'a1',
        authorName: 'Ana',
        text: 'x',
        rating: 7,
        roleAuthor: 'STUDENT',
      }),
    ).rejects.toBeInstanceOf(BusinessRuleError);
  });
  it('newsletter: upsert silencioso (anti-enumeração e duplicidade)', async () => {
    const repo = new FakeNewsletterRepo();
    const usecase = new SubscribeNewsletterUseCase({ newsletter: repo });
    expect(await usecase.execute({ email: 'lê@prumo.dev' })).toEqual({
      subscribed: true,
    });
    expect(await usecase.execute({ email: 'lê@prumo.dev' })).toEqual({
      subscribed: true,
    });
    expect(repo.emails.size).toBe(1);
  });
  it('admin ajusta perfil de mentor (bio/areas/destaque/status)', async () => {
    const mentors = new FakeMentors();
    const usecase = new UpdateMentorProfileUseCase({ mentors });
    await usecase.execute({
      mentorId: 'm1',
      data: { bio: 'Arquiteta há 15 anos', areas: ['Gestão'], featured: true },
    });
    const pub = await new ListPublicMentorsUseCase({
      mentors,
    }).execute();
    expect(pub.mentors).toHaveLength(1);
    expect(pub.mentors[0].areas).toEqual(['Gestão']);
  });
});
