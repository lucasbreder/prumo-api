import { Email } from '../../../../shared/domain/email.vo.js';
import { BusinessRuleError } from '../../../../shared/errors/domain.errors.js';
import type { Role } from '../../../../shared/domain/role.js';
import type {
  HeroImageUpload,
  HomeHighlightsRow,
  MethodRow,
} from '../../domain/ports.js';
import type {
  TestimonialsPort,
  HighlightsPort,
  MentorsPort,
  MenusPort,
  MethodPort,
  NewsletterPort,
  ImageStoragePort,
} from '../../domain/ports.js';

const MAX_HERO_STATS = 6;
const MAX_HERO_IMAGES = 8;
const MAX_SECTION_ITEMS = 6;
const MAX_HERO_IMAGE_BYTES = 15 * 1024 * 1024;
const TIPOS_IMAGEM_PERMITIDOS = new Set([
  'image/jpeg',
  'image/png',
  'image/webp',
  'image/avif',
  'image/gif',
]);

async function resolverImagens(
  imagens: string[],
  storage: ImageStoragePort | undefined,
): Promise<string[]> {
  if (!storage) return imagens;
  const resolvidas = await Promise.all(
    imagens.map((v) => storage.resolvePublicUrl(v)),
  );
  return resolvidas.filter((v): v is string => Boolean(v));
}

export class GetHighlightsUseCase {
  constructor(
    private readonly deps: {
      highlights: HighlightsPort;
      images?: ImageStoragePort;
    },
  ) {}
  // `signedImages` converte chaves do bucket em URLs temporárias assinadas
  // para o público. Admin usa raw, para editar a chave e salvar de volta.
  async execute(
    opts: { signedImages?: boolean } = {},
  ): Promise<HomeHighlightsRow | Record<string, never>> {
    const row = await this.deps.highlights.get();
    if (!row) return {};
    if (opts.signedImages) {
      return {
        ...row,
        hero: {
          ...row.hero,
          images: await resolverImagens(row.hero.images, this.deps.images),
        },
      };
    }
    return row;
  }
}

export class PreviewHeroImagesUseCase {
  constructor(private readonly deps: { images: ImageStoragePort }) {}
  // Mantém uma URL por token (mesma ordem do array salvo): chaves viram URLs
  // assinadas; valores absolutos/estáticos passam direto; se não resolver,
  // devolve o próprio token para não desalinhar o editor do admin.
  async execute(chaves: string[]): Promise<string[]> {
    return Promise.all(
      chaves.map(async (v) => (await this.deps.images.resolvePublicUrl(v)) ?? v),
    );
  }
}

export class PresignHeroUploadUseCase {
  constructor(private readonly deps: { storage: ImageStoragePort }) {}
  async execute(input: {
    nomeArquivo: string;
    contentType: string;
    sizeBytes: number;
  }): Promise<HeroImageUpload> {
    if (!Number.isInteger(input.sizeBytes) || input.sizeBytes <= 0) {
      throw new BusinessRuleError('Tamanho de arquivo inválido');
    }
    if (input.sizeBytes > MAX_HERO_IMAGE_BYTES) {
      throw new BusinessRuleError('Imagem muito grande (máx 15 MB)');
    }
    if (!TIPOS_IMAGEM_PERMITIDOS.has(input.contentType)) {
      throw new BusinessRuleError(
        'Use JPG, PNG, WEBP, AVIF ou GIF',
      );
    }
    return this.deps.storage.presignHeroUpload(input);
  }
}

export class SaveHighlightsUseCase {
  constructor(private readonly deps: { highlights: HighlightsPort }) {}
  async execute(input: HomeHighlightsRow) {
    if (input.hero.stats.length > MAX_HERO_STATS) {
      throw new BusinessRuleError(
        `O hero da home aceita no maximo ${MAX_HERO_STATS} estatisticas`,
      );
    }
    const images = (input.hero.images ?? [])
      .map((u) => u.trim())
      .filter(Boolean);
    if (images.length > MAX_HERO_IMAGES) {
      throw new BusinessRuleError(
        `O hero da home aceita no maximo ${MAX_HERO_IMAGES} fotos`,
      );
    }
    if (images.some((u) => u.startsWith('data:'))) {
      throw new BusinessRuleError(
        'Não é permitido cadastrar imagens em base64; envie o arquivo ou informe uma URL.',
      );
    }
    if (input.manifesto && input.manifesto.length > MAX_SECTION_ITEMS) {
      throw new BusinessRuleError(
        `A secao O Prumo aceita no maximo ${MAX_SECTION_ITEMS} paragrafos`,
      );
    }
    if (input.adviceItems && input.adviceItems.length > MAX_SECTION_ITEMS) {
      throw new BusinessRuleError(
        `O conselho mensal aceita no maximo ${MAX_SECTION_ITEMS} etapas`,
      );
    }
    const normalized: HomeHighlightsRow = {
      ...input,
      hero: {
        ...input.hero,
        highlightWord: input.hero.highlightWord?.trim() || null,
        images,
        stats: input.hero.stats.map((s, i) => ({ ...s, order: i + 1 })),
      },
      manifesto: input.manifesto?.map((m, i) => ({ ...m, order: i + 1 })),
      adviceItems: input.adviceItems?.map((a, i) => ({ ...a, order: i + 1 })),
    };
    await this.deps.highlights.save(normalized);
    return normalized;
  }
}

export class SaveMenuItemUseCase {
  constructor(
    private readonly deps: {
      menus: MenusPort;
    },
  ) {}
  async execute(input: {
    id?: string;
    location: 'HEADER' | 'FOOTER';
    order: number;
    label: string;
    url: string;
    type: 'PAGE' | 'CTA' | 'LINK';
    active?: boolean;
  }) {
    if (input.id) {
      await this.deps.menus.save({
        id: input.id,
        location: input.location,
        order: input.order,
        label: input.label,
        url: input.url,
        type: input.type,
        active: input.active ?? true,
      });
      return { id: input.id };
    }
    const created = await this.deps.menus.create({
      location: input.location,
      order: input.order,
      label: input.label,
      url: input.url,
      type: input.type,
      active: input.active ?? true,
    });
    return { id: created.id };
  }
}
export class ListMenusUseCase {
  constructor(
    private readonly deps: {
      menus: MenusPort;
    },
  ) {}
  async execute(input: {
    location?: 'HEADER' | 'FOOTER';
    onlyActive: boolean;
  }) {
    return {
      items: await this.deps.menus.list(input.location, input.onlyActive),
    };
  }
}
export class RemoveMenuItemUseCase {
  constructor(
    private readonly deps: {
      menus: MenusPort;
    },
  ) {}
  async execute(id: string) {
    await this.deps.menus.remove(id);
    return { removed: true };
  }
}
export class SaveMethodUseCase {
  constructor(
    private readonly deps: {
      method: MethodPort;
    },
  ) {}
  async execute(method: MethodRow) {
    method.steps.sort((a, b) => a.order - b.order);
    await this.deps.method.save(method);
    return { steps: method.steps.length };
  }
}
export class GetMethodUseCase {
  constructor(
    private readonly deps: {
      method: MethodPort;
    },
  ) {}
  async execute(): Promise<MethodRow | null> {
    const m = await this.deps.method.get();
    return m?.published ? m : null;
  }
}
export class RegisterTestimonialUseCase {
  constructor(
    private readonly deps: {
      testimonials: TestimonialsPort;
    },
  ) {}
  async execute(input: {
    studentId: string | null;
    authorName: string;
    text: string;
    rating: number;
    roleAuthor: Role;
  }) {
    if (
      input.rating < 1 ||
      input.rating > 5 ||
      !Number.isInteger(input.rating)
    ) {
      throw new BusinessRuleError('A nota deve ser um inteiro entre 1 e 5');
    }
    const created = await this.deps.testimonials.create({
      studentId: input.studentId,
      author: input.authorName,
      text: input.text,
      rating: input.rating,
      status: input.roleAuthor === 'ADMIN' ? 'APPROVED' : 'PENDING',
      visible: true,
    });
    return { id: created.id, status: created.status };
  }
}
export class SaveTestimonialStatusUseCase {
  constructor(
    private readonly deps: {
      testimonials: TestimonialsPort;
    },
  ) {}
  async execute(input: {
    id: string;
    status?: 'PENDING' | 'APPROVED';
    visible?: boolean;
  }) {
    const d = await this.deps.testimonials.byId(input.id);
    if (!d) throw new BusinessRuleError('Depoimento nao encontrado');
    if (input.status) d.status = input.status;
    if (input.visible !== undefined) d.visible = input.visible;
    await this.deps.testimonials.save(d);
    return { id: d.id, status: d.status, visible: d.visible };
  }
}
export class ListTestimonialsUseCase {
  constructor(
    private readonly deps: {
      testimonials: TestimonialsPort;
    },
  ) {}
  async execute(input: { public: boolean; status?: 'PENDING' | 'APPROVED' }) {
    const items = await this.deps.testimonials.list(input.status);
    const visiveis = input.public
      ? items.filter((d) => d.status === 'APPROVED' && d.visible)
      : items;
    return {
      items: visiveis.map((d) => ({
        id: d.id,
        author: d.author,
        text: d.text,
        rating: d.rating,
        status: d.status,
        visible: d.visible,
      })),
    };
  }
}
export class ListPublicTestimonialsUseCase {
  constructor(
    private readonly deps: {
      testimonials: TestimonialsPort;
    },
  ) {}
  async execute() {
    return new ListTestimonialsUseCase(this.deps).execute({ public: true });
  }
}
export class SubscribeNewsletterUseCase {
  constructor(
    private readonly deps: {
      newsletter: NewsletterPort;
    },
  ) {}
  async execute(input: { email: string }) {
    // Email VO validates; duplicate e silencio intencional (reply identica).
    const email = Email.from(input.email);
    await this.deps.newsletter.subscribe(email.value);
    return { subscribed: true };
  }
}
export class ListPublicMentorsUseCase {
  constructor(
    private readonly deps: {
      mentors: MentorsPort;
    },
  ) {}
  async execute() {
    const mentors = await this.deps.mentors.listPublic();
    return {
      mentors: mentors.map((m) => ({
        id: m.id,
        name: m.name,
        areas: m.areas,
        bio: m.bio,
        featured: m.featured,
      })),
    };
  }
}
export class UpdateMentorProfileUseCase {
  constructor(
    private readonly deps: {
      mentors: MentorsPort;
    },
  ) {}
  async execute(input: {
    mentorId: string;
    data: {
      bio?: string;
      areas?: string[];
      featured?: boolean;
      status?: 'PENDING' | 'APPROVED' | 'REJECTED';
    };
  }) {
    await this.deps.mentors.updateProfile(input.mentorId, input.data);
    return { updated: true };
  }
}
