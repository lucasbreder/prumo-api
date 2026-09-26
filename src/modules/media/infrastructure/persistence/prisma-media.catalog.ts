import { Injectable } from '@nestjs/common';
import { PrismaService } from '../../../../shared/database/prisma.service.js';
import type { MediaCatalog, MediaRef } from '../../domain/ports.js';
import type { ContentBlock } from '../../../courses/domain/rich-content.vo.js';

@Injectable()
export class PrismaMediaCatalog implements MediaCatalog {
  constructor(private readonly prisma: PrismaService) {}

  async collect(): Promise<MediaRef[]> {
    const [materiais, aulas, destaque] = await Promise.all([
      this.prisma.material.findMany({
        orderBy: { createdAt: 'desc' },
        select: {
          id: true,
          name: true,
          type: true,
          url: true,
          sizeBytes: true,
          createdAt: true,
          course: { select: { title: true } },
          module: { select: { title: true } },
          lesson: { select: { title: true } },
        },
      }),
      this.prisma.lesson.findMany({
        select: {
          id: true,
          title: true,
          contentUrl: true,
          blocks: true,
          updatedAt: true,
          module: { select: { title: true, course: { select: { title: true } } } },
        },
      }),
      this.prisma.homeHighlight.findFirst({ select: { heroImages: true } }),
    ]);

    const refs: MediaRef[] = [];

    for (const m of materiais) {
      const local = m.course
        ? `Material — ${m.course.title}`
        : m.lesson
          ? `Material — ${m.lesson.title}`
          : 'Download avulso';
      refs.push({
        fonte: 'material',
        chave: m.url,
        nome: m.name,
        materialTipo: String(m.type),
        sizeBytes: Number(m.sizeBytes),
        criadoEm: m.createdAt,
        contexto: local,
        ...(m.course ? { contextoId: m.course.title } : {}),
        gerenciavel: true,
        materialId: m.id,
      });
    }

    for (const a of aulas) {
      const curso = a.module.course.title;
      const local = `${curso} › ${a.title}`;
      if (a.contentUrl) {
        refs.push({
          fonte: 'lesson-content',
          chave: a.contentUrl,
          criadoEm: a.updatedAt,
          contexto: local,
          contextoId: a.id,
          gerenciavel: false,
          sizeBytes: null,
        });
      }
      const blocks = (a.blocks as ContentBlock[] | null) ?? [];
      for (const b of blocks) {
        if (b.type === 'image') {
          refs.push({
            fonte: 'lesson-image',
            chave: b.key,
            nome: b.alt,
            criadoEm: a.updatedAt,
            contexto: local,
            contextoId: a.id,
            gerenciavel: false,
            sizeBytes: null,
          });
        }
      }
    }

    for (const img of destaque?.heroImages ?? []) {
      refs.push({
        fonte: 'hero',
        chave: img,
        criadoEm: null,
        contexto: 'Site — capa da home',
        gerenciavel: false,
        sizeBytes: null,
      });
    }

    return refs;
  }
}
