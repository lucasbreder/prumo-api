export interface MenuRow {
  id: string;
  location: 'HEADER' | 'FOOTER';
  order: number;
  label: string;
  url: string;
  type: 'PAGE' | 'CTA' | 'LINK';
  active: boolean;
  column?: string | null;
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
export interface MentorProfileRow {
  id: string;
  name: string;
  areas: string[];
  bio: string | null;
  featured: boolean;
  status: 'PENDING' | 'APPROVED' | 'REJECTED';
}

export interface HomeSectionsRow {
  prumo: { eyebrow: string; lead: string };
  courses: { eyebrow: string; title: string; linkLabel: string };
  advice: { eyebrow: string; title: string; description: string; note: string };
  method: { eyebrow: string };
  testimonials: { eyebrow: string; title: string };
  plans: { eyebrow: string; title: string; description: string; visible: boolean };
  newsletter: { eyebrow: string; title: string; description: string };
}
export interface HomeManifestoItemRow {
  order?: number;
  number: string;
  text: string;
}
export interface HomeAdviceItemRow {
  order?: number;
  number: string;
  title: string;
  description: string;
}
export interface HighlightStatRow {
  order?: number;
  value: string;
  label: string;
}

export interface HomeHighlightsRow {
  hero: {
    headline: string;
    highlightWord: string | null;
    images: string[];
    stats: HighlightStatRow[];
  };
  mentor: { name: string; area: string; slots: number };
  cta: { title: string; url: string };
  // Textos das seções estáticas da home (opcional: o banco tem defaults).
  sections?: HomeSectionsRow;
  manifesto?: HomeManifestoItemRow[];
  adviceItems?: HomeAdviceItemRow[];
}

export interface HighlightsPort {
  get(): Promise<HomeHighlightsRow | null>;
  save(highlights: HomeHighlightsRow): Promise<void>;
}
export interface MenusPort {
  create(item: Omit<MenuRow, 'id'>): Promise<MenuRow>;
  save(item: MenuRow): Promise<void>;
  list(
    location?: 'HEADER' | 'FOOTER',
    onlyActive?: boolean,
  ): Promise<MenuRow[]>;
  remove(id: string): Promise<void>;
}
export interface MethodPort {
  save(method: MethodRow): Promise<void>;
  get(): Promise<MethodRow | null>;
}
export interface TestimonialsPort {
  create(testimonial: Omit<TestimonialRow, 'id'>): Promise<TestimonialRow>;
  byId(id: string): Promise<TestimonialRow | null>;
  save(testimonial: TestimonialRow): Promise<void>;
  list(status?: 'PENDING' | 'APPROVED'): Promise<TestimonialRow[]>;
}
export interface NewsletterPort {
  subscribe(email: string): Promise<void>;
}
export interface MentorsPort {
  listPublic(): Promise<MentorProfileRow[]>;
  updateProfile(
    id: string,
    data: {
      bio?: string;
      areas?: string[];
      featured?: boolean;
      status?: 'PENDING' | 'APPROVED' | 'REJECTED';
    },
  ): Promise<MentorProfileRow>;
}
export const MENUS_PORT = 'MENUS_PORT' as const;
export const HIGHLIGHTS_PORT = 'HIGHLIGHTS_PORT' as const;
export const METHOD_PORT = 'METHOD_PORT' as const;
export const TESTIMONIALS_PORT = 'TESTIMONIALS_PORT' as const;
export const NEWSLETTER_PORT = 'NEWSLETTER_PORT' as const;
export const MENTORS_PORT = 'MENTORS_PORT' as const;
export const IMAGE_STORAGE_PORT = 'IMAGE_STORAGE_PORT' as const;

// Storage de imagens: bucket privado + URLs temporárias assinadas (Opção A).
// `resolvePublicUrl` devolve URL assinada para keys S3, e mantém
// passthrough para valores absolutos (`http(s)://`) ou caminhos estáticos
// do front (`/images/...`). Retorna null quando o valor é inválido/expirado.
export interface HeroImageUpload {
  chave: string;
  uploadUrl: string;
  previewUrl: string;
  expiraEm: string;
}
export interface ImageStoragePort {
  presignHeroUpload(input: {
    nomeArquivo: string;
    contentType: string;
    sizeBytes: number;
  }): Promise<HeroImageUpload>;
  resolvePublicUrl(valor: string): Promise<string | null>;
}
