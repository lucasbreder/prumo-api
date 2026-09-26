import { Injectable } from '@nestjs/common';
import { PrismaService } from '../../../../shared/database/prisma.service.js';
import type {
  HomeHighlightsRow,
  HighlightsPort,
  TestimonialRow,
  TestimonialsPort,
  MentorsPort,
  MenusPort,
  MethodRow,
  MethodPort,
  NewsletterPort,
} from '../../domain/ports.js';
import { Prisma } from '../../../../generated/prisma/client.js';
import {
  AccessDeniedError,
  NotFoundError,
} from '../../../../shared/errors/domain.errors.js';
@Injectable()
export class PrismaHighlightsRepository implements HighlightsPort {
  constructor(private readonly prisma: PrismaService) {}

  async get(): Promise<HomeHighlightsRow | null> {
    const row = await this.prisma.homeHighlight.findFirst({
      orderBy: { id: 'asc' },
      select: {
        heroHeadline: true,
        heroHighlightWord: true,
        heroImages: true,
        mentorName: true,
        mentorArea: true,
        mentorSlots: true,
        ctaTitle: true,
        ctaUrl: true,
        prumoEyebrow: true,
        prumoLead: true,
        coursesEyebrow: true,
        coursesTitle: true,
        coursesLinkLabel: true,
        adviceEyebrow: true,
        adviceTitle: true,
        adviceDescription: true,
        adviceNote: true,
        methodEyebrow: true,
        testimonialsEyebrow: true,
        testimonialsTitle: true,
        plansEyebrow: true,
        plansTitle: true,
        plansDescription: true,
        plansVisible: true,
        newsletterEyebrow: true,
        newsletterTitle: true,
        newsletterDescription: true,
        stats: {
          orderBy: { order: 'asc' },
          select: { order: true, value: true, label: true },
        },
        manifesto: {
          orderBy: { order: 'asc' },
          select: { order: true, number: true, text: true },
        },
        adviceItems: {
          orderBy: { order: 'asc' },
          select: { order: true, number: true, title: true, description: true },
        },
      },
    });
    if (!row) return null;
    return {
      hero: {
        headline: row.heroHeadline,
        highlightWord: row.heroHighlightWord,
        images: row.heroImages ?? [],
        stats: row.stats,
      },
      mentor: {
        name: row.mentorName,
        area: row.mentorArea,
        slots: row.mentorSlots,
      },
      cta: { title: row.ctaTitle, url: row.ctaUrl },
      sections: {
        prumo: { eyebrow: row.prumoEyebrow, lead: row.prumoLead },
        courses: {
          eyebrow: row.coursesEyebrow,
          title: row.coursesTitle,
          linkLabel: row.coursesLinkLabel,
        },
        advice: {
          eyebrow: row.adviceEyebrow,
          title: row.adviceTitle,
          description: row.adviceDescription,
          note: row.adviceNote,
        },
        method: { eyebrow: row.methodEyebrow },
        testimonials: {
          eyebrow: row.testimonialsEyebrow,
          title: row.testimonialsTitle,
        },
        plans: {
          eyebrow: row.plansEyebrow,
          title: row.plansTitle,
          description: row.plansDescription,
          visible: row.plansVisible,
        },
        newsletter: {
          eyebrow: row.newsletterEyebrow,
          title: row.newsletterTitle,
          description: row.newsletterDescription,
        },
      },
      manifesto: row.manifesto,
      adviceItems: row.adviceItems,
    };
  }

  async save(highlights: HomeHighlightsRow): Promise<void> {
    const data = {
      heroHeadline: highlights.hero.headline,
      heroHighlightWord: highlights.hero.highlightWord,
      heroImages: highlights.hero.images ?? [],
      mentorName: highlights.mentor.name,
      mentorArea: highlights.mentor.area,
      mentorSlots: highlights.mentor.slots,
      ctaTitle: highlights.cta.title,
      ctaUrl: highlights.cta.url,
      ...sectionColumns(highlights.sections),
    };
    const stats = highlights.hero.stats.map((s, i) => ({
      order: s.order ?? i + 1,
      value: s.value,
      label: s.label,
    }));
    const manifesto = (highlights.manifesto ?? []).map((m, i) => ({
      order: m.order ?? i + 1,
      number: m.number,
      text: m.text,
    }));
    const adviceItems = (highlights.adviceItems ?? []).map((a, i) => ({
      order: a.order ?? i + 1,
      number: a.number,
      title: a.title,
      description: a.description,
    }));
    const existing = await this.prisma.homeHighlight.findFirst({
      select: { id: true },
    });
    if (existing) {
      const ops: Prisma.PrismaPromise<unknown>[] = [
        this.prisma.homeHighlight.update({
          where: { id: existing.id },
          data,
        }),
        this.prisma.homeHighlightStat.deleteMany({
          where: { highlightId: existing.id },
        }),
        this.prisma.homeHighlightStat.createMany({
          data: stats.map((s) => ({ ...s, highlightId: existing.id })),
        }),
      ];
      if (highlights.manifesto) {
        ops.push(
          this.prisma.homeManifestoItem.deleteMany({
            where: { highlightId: existing.id },
          }),
          this.prisma.homeManifestoItem.createMany({
            data: manifesto.map((m) => ({ ...m, highlightId: existing.id })),
          }),
        );
      }
      if (highlights.adviceItems) {
        ops.push(
          this.prisma.homeAdviceItem.deleteMany({
            where: { highlightId: existing.id },
          }),
          this.prisma.homeAdviceItem.createMany({
            data: adviceItems.map((a) => ({ ...a, highlightId: existing.id })),
          }),
        );
      }
      await this.prisma.$transaction(ops);
      return;
    }
    await this.prisma.homeHighlight.create({
      data: {
        ...data,
        stats: { create: stats },
        manifesto: { create: manifesto },
        adviceItems: { create: adviceItems },
      },
    });
  }
}

function sectionColumns(sections: HomeHighlightsRow['sections']) {
  if (!sections) return {};
  return {
    prumoEyebrow: sections.prumo.eyebrow,
    prumoLead: sections.prumo.lead,
    coursesEyebrow: sections.courses.eyebrow,
    coursesTitle: sections.courses.title,
    coursesLinkLabel: sections.courses.linkLabel,
    adviceEyebrow: sections.advice.eyebrow,
    adviceTitle: sections.advice.title,
    adviceDescription: sections.advice.description,
    adviceNote: sections.advice.note,
    methodEyebrow: sections.method.eyebrow,
    testimonialsEyebrow: sections.testimonials.eyebrow,
    testimonialsTitle: sections.testimonials.title,
    plansEyebrow: sections.plans.eyebrow,
    plansTitle: sections.plans.title,
    plansDescription: sections.plans.description,
    plansVisible: sections.plans.visible,
    newsletterEyebrow: sections.newsletter.eyebrow,
    newsletterTitle: sections.newsletter.title,
    newsletterDescription: sections.newsletter.description,
  };
}

@Injectable()
export class PrismaMenusRepository implements MenusPort {
  constructor(private readonly prisma: PrismaService) {}
  async create(item: Omit<import('../../domain/ports.js').MenuRow, 'id'>) {
    try {
      return await this.prisma.siteMenu.create({ data: item });
    } catch (e) {
      if (
        e instanceof Prisma.PrismaClientKnownRequestError &&
        e.code === 'P2002'
      ) {
        throw new NotFoundError('Ordem ja utilizada neste local');
      }
      throw e;
    }
  }
  async save(item: import('../../domain/ports.js').MenuRow): Promise<void> {
    await this.prisma.siteMenu
      .update({
        where: { id: item.id },
        data: {
          location: item.location,
          order: item.order,
          label: item.label,
          url: item.url,
          type: item.type,
          active: item.active,
        },
      })
      .catch((e: unknown) => {
        if (
          e instanceof Prisma.PrismaClientKnownRequestError &&
          e.code === 'P2025'
        ) {
          throw new NotFoundError('Item de menu nao encontrado');
        }
        throw e;
      });
  }
  async list(location?: 'HEADER' | 'FOOTER', onlyActive = true) {
    return this.prisma.siteMenu.findMany({
      where: {
        ...(location ? { location } : {}),
        ...(onlyActive ? { active: true } : {}),
      },
      orderBy: [{ location: 'asc' }, { order: 'asc' }],
    });
  }
  async remove(id: string): Promise<void> {
    await this.prisma.siteMenu.delete({ where: { id } });
  }
}
@Injectable()
export class PrismaMethodRepository implements MethodPort {
  constructor(private readonly prisma: PrismaService) {}
  async get(): Promise<MethodRow | null> {
    const method = await this.prisma.method.findFirst({
      orderBy: { id: 'asc' },
      select: {
        kicker: true,
        title: true,
        description: true,
        published: true,
        steps: {
          orderBy: { order: 'asc' },
          select: { order: true, title: true, description: true },
        },
      },
    });
    return method ?? null;
  }
  async save(method: MethodRow): Promise<void> {
    const existing = await this.prisma.method.findFirst({
      select: { id: true },
    });
    if (existing) {
      await this.prisma.method.update({
        where: { id: existing.id },
        data: {
          kicker: method.kicker,
          title: method.title,
          description: method.description,
          published: method.published,
        },
      });
      await this.prisma.methodStep.deleteMany({
        where: { methodId: existing.id },
      });
      await this.prisma.methodStep.createMany({
        data: method.steps.map((p) => ({ ...p, methodId: existing.id })),
      });
      return;
    }
    await this.prisma.method.create({
      data: {
        kicker: method.kicker,
        title: method.title,
        description: method.description,
        published: method.published,
        steps: { create: method.steps },
      },
    });
  }
}
@Injectable()
export class PrismaTestimonialsRepository implements TestimonialsPort {
  constructor(private readonly prisma: PrismaService) {}
  async create(d: Omit<TestimonialRow, 'id'>) {
    const row = await this.prisma.testimonial.create({ data: d });
    return this.forRow(row);
  }
  private forRow(row: {
    id: string;
    studentId: string | null;
    author: string;
    text: string;
    rating: number;
    status: string;
    visible: boolean;
  }): TestimonialRow {
    return {
      id: row.id,
      studentId: row.studentId,
      author: row.author,
      text: row.text,
      rating: row.rating,
      status: row.status as 'PENDING' | 'APPROVED',
      visible: row.visible,
    };
  }
  async byId(id: string): Promise<TestimonialRow | null> {
    const row = await this.prisma.testimonial.findUnique({ where: { id } });
    return row ? this.forRow(row) : null;
  }
  async save(d: TestimonialRow): Promise<void> {
    await this.prisma.testimonial.update({
      where: { id: d.id },
      data: { status: d.status, visible: d.visible },
    });
  }
  async list(status?: 'PENDING' | 'APPROVED'): Promise<TestimonialRow[]> {
    const rows = await this.prisma.testimonial.findMany({
      where: status ? { status } : {},
      orderBy: { createdAt: 'desc' },
    });
    return rows.map((l) => this.forRow(l));
  }
}
@Injectable()
export class PrismaNewsletterRepository implements NewsletterPort {
  constructor(private readonly prisma: PrismaService) {}
  async subscribe(email: string): Promise<void> {
    await this.prisma.newsletter.upsert({
      where: { email },
      create: { email },
      update: {},
    });
  }
}
@Injectable()
export class PrismaMentorsPort implements MentorsPort {
  constructor(private readonly prisma: PrismaService) {}
  async listPublic() {
    const rows = await this.prisma.user.findMany({
      where: { role: 'MENTOR', active: true, mentorStatus: 'APPROVED' },
      orderBy: [{ mentorFeatured: 'desc' }, { name: 'asc' }],
      select: {
        id: true,
        name: true,
        areas: true,
        bio: true,
        mentorFeatured: true,
        mentorStatus: true,
      },
    });
    return rows.map((l) => ({
      id: l.id,
      name: l.name,
      areas: l.areas,
      bio: l.bio,
      featured: l.mentorFeatured,
      status: l.mentorStatus as 'PENDING' | 'APPROVED' | 'REJECTED',
    }));
  }
  async updateProfile(
    id: string,
    data: {
      bio?: string;
      areas?: string[];
      featured?: boolean;
      status?: 'PENDING' | 'APPROVED' | 'REJECTED';
    },
  ) {
    const user = await this.prisma.user.findUnique({
      where: { id },
      select: { id: true, role: true },
    });
    if (!user) throw new NotFoundError('Mentor nao encontrado');
    if (user.role !== 'MENTOR') {
      throw new AccessDeniedError(
        'Somente contas de mentor possuem perfil publico',
      );
    }
    await this.prisma.user.update({
      where: { id },
      data: {
        ...(data.bio !== undefined ? { bio: data.bio } : {}),
        ...(data.areas !== undefined ? { areas: data.areas } : {}),
        ...(data.featured !== undefined
          ? { mentorFeatured: data.featured }
          : {}),
        ...(data.status !== undefined ? { mentorStatus: data.status } : {}),
      },
    });
    const row = await this.prisma.user.findUniqueOrThrow({
      where: { id },
      select: {
        id: true,
        name: true,
        areas: true,
        bio: true,
        mentorFeatured: true,
        mentorStatus: true,
      },
    });
    return {
      id: row.id,
      name: row.name,
      areas: row.areas,
      bio: row.bio,
      featured: row.mentorFeatured,
      status: row.mentorStatus as 'PENDING' | 'APPROVED' | 'REJECTED',
    };
  }
}
