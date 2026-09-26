import { BusinessRuleError } from '../../../../shared/errors/domain.errors.js';
export interface MenuRow {
  id: string;
  location: 'HEADER' | 'FOOTER';
  order: number;
  label: string;
  url: string;
  type: 'PAGE' | 'CTA' | 'LINK';
  active: boolean;
}
export interface MethodRow {
  kicker: string;
  title: string;
  description: string;
  published: boolean;
  steps: {
    order: number;
    title: string;
    description: string;
  }[];
}
export interface TestimonialRow {
  id: string;
  studentId: string | null;
  author: string;
  text: string;
  rating: number;
  status: 'PENDING' | 'APPROVED';
  visible: boolean;
}
export interface MentorProfile {
  id: string;
  name: string;
  areas: string[];
  bio: string | null;
  featured: boolean;
  status: 'PENDING' | 'APPROVED' | 'REJECTED';
}
export class FakeMenuRepo {
  items: MenuRow[] = [];
  private seq = 0;
  async create(i: Omit<MenuRow, 'id'>): Promise<MenuRow> {
    const item = { ...i, id: `menu-${++this.seq}` };
    this.items.push(item);
    return item;
  }
  async save(i: MenuRow): Promise<void> {
    const idx = this.items.findIndex((x) => x.id === i.id);
    if (idx < 0) throw new BusinessRuleError('Item de menu nao encontrado');
    this.items[idx] = i;
  }
  async list(
    location?: 'HEADER' | 'FOOTER',
    onlyActive = true,
  ): Promise<MenuRow[]> {
    return this.items
      .filter(
        (x) =>
          (!location || x.location === location) && (!onlyActive || x.active),
      )
      .sort((a, b) =>
        a.location === b.location
          ? a.order - b.order
          : a.location < b.location
            ? -1
            : 1,
      );
  }
  async remove(id: string): Promise<void> {
    this.items = this.items.filter((x) => x.id !== id);
  }
}
export class FakeMethodRepo {
  current: MethodRow | null = null;
  async save(m: MethodRow): Promise<void> {
    this.current = m;
  }
  async get(): Promise<MethodRow | null> {
    return this.current;
  }
}
export class FakeTestimonialRepo {
  items = new Map<string, TestimonialRow>();
  private seq = 0;
  async create(d: Omit<TestimonialRow, 'id'>): Promise<TestimonialRow> {
    const item = { ...d, id: `dep-${++this.seq}` };
    this.items.set(item.id, item);
    return item;
  }
  async byId(id: string) {
    return this.items.get(id) ?? null;
  }
  async save(d: TestimonialRow) {
    this.items.set(d.id, d);
  }
  async list(status?: 'PENDING' | 'APPROVED') {
    return [...this.items.values()].filter(
      (d) => !status || d.status === status,
    );
  }
}
export class FakeNewsletterRepo {
  emails = new Set<string>();
  async subscribe(email: string): Promise<void> {
    this.emails.add(email.toLowerCase());
  }
}
export class FakeMentors {
  mentors: MentorProfile[] = [
    {
      id: 'm1',
      name: 'Marina Sole',
      areas: [],
      bio: null,
      featured: false,
      status: 'APPROVED',
    },
  ];
  async listPublic(): Promise<MentorProfile[]> {
    return this.mentors.filter((m) => m.status === 'APPROVED');
  }
  async updateProfile(
    id: string,
    data: Partial<Pick<MentorProfile, 'areas' | 'bio' | 'featured' | 'status'>>,
  ): Promise<MentorProfile> {
    const m = this.mentors.find((x) => x.id === id);
    if (!m) throw new BusinessRuleError('Mentor nao encontrado');
    Object.assign(m, data);
    return m;
  }
}

export interface HomeHighlights {
  hero: {
    headline: string;
    highlightWord: string | null;
    images: string[];
    stats: { order?: number; value: string; label: string }[];
  };
  mentor: { name: string; area: string; slots: number };
  cta: { title: string; url: string };
  sections?: {
    prumo: { eyebrow: string; lead: string };
    courses: { eyebrow: string; title: string; linkLabel: string };
    advice: { eyebrow: string; title: string; description: string; note: string };
    method: { eyebrow: string };
    testimonials: { eyebrow: string; title: string };
    plans: { eyebrow: string; title: string; description: string; visible: boolean };
    newsletter: { eyebrow: string; title: string; description: string };
  };
  manifesto?: { order?: number; number: string; text: string }[];
  adviceItems?: { order?: number; number: string; title: string; description: string }[];
}

export class FakeHighlightsRepo {
  atual: HomeHighlights | null = null;
  async get(): Promise<HomeHighlights | null> {
    return this.atual;
  }
  async save(highlights: HomeHighlights): Promise<void> {
    this.atual = highlights;
  }
}

// Storage de imagens para testes: chaves viram URLs assinadas fake; valores
// absolutos ou caminhos estáticos passam direto (mesma regra do adapter S3).
export class FakeImageStorage {
  chamadas: { nome: string; tipo: string; bytes: number }[] = [];
  ultimoChave = '';
  async presignHeroUpload(input: {
    nomeArquivo: string;
    contentType: string;
    sizeBytes: number;
  }) {
    this.chamadas.push({
      nome: input.nomeArquivo,
      tipo: input.contentType,
      bytes: input.sizeBytes,
    });
    const chave = `hero/test-${this.chamadas.length}.jpg`;
    this.ultimoChave = chave;
    return {
      chave,
      uploadUrl: `https://storage.test/${chave}?upload=1`,
      previewUrl: `https://storage.test/${chave}?get=1`,
      expiraEm: '2026-09-04T13:00:00.000Z',
    };
  }
  async resolvePublicUrl(valor: string): Promise<string | null> {
    const v = valor.trim();
    if (!v || v.startsWith('data:')) return null;
    if (/^(https?:)?\/\//i.test(v) || v.startsWith('/')) return v;
    return `https://storage.test/${v}?sig=1`;
  }
}
