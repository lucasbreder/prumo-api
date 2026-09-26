import {
  classificarTipo,
  extensionOf,
  nomeDeChave,
  TIPOS_MIDIA,
  type MediaItem,
  type TipoMidia,
  type UsoMidia,
} from '../domain/media.vo.js';
import type {
  MediaCatalog,
  MediaContagem,
  MediaFilter,
  MediaRef,
  MediaUrlResolver,
} from '../domain/ports.js';

interface MediaDeps {
  catalog: MediaCatalog;
  urls: MediaUrlResolver;
}

function ordenar(a: MediaRef, b: MediaRef): number {
  // material vem primeiro para herdarmos nome/tamanho/contexto mais rico.
  const pa = a.fonte === 'material' ? 0 : 1;
  const pb = b.fonte === 'material' ? 0 : 1;
  if (pa !== pb) return pa - pb;
  return (a.criadoEm?.getTime() ?? 0) - (b.criadoEm?.getTime() ?? 0);
}

function tipoDeUso(fonte: MediaRef['fonte']): UsoMidia['tipo'] {
  return fonte === 'lesson-content' ? 'lesson' : fonte;
}

function juntarUsos(refs: MediaRef[]): UsoMidia[] {
  const vistos = new Set<string>();
  const out: UsoMidia[] = [];
  for (const r of refs) {
    const chave = `${r.fonte}:${r.contextoId ?? r.contexto}`;
    if (vistos.has(chave)) continue;
    vistos.add(chave);
    out.push({
      tipo: tipoDeUso(r.fonte),
      descricao: r.contexto,
      ...(r.contextoId ? { id: r.contextoId } : {}),
    });
  }
  return out;
}

function porChave(refs: MediaRef[]): Map<string, MediaRef[]> {
  const mapa = new Map<string, MediaRef[]>();
  for (const r of refs) {
    const grupo = mapa.get(r.chave) ?? [];
    grupo.push(r);
    mapa.set(r.chave, grupo);
  }
  return mapa;
}

export class ListMediaUseCase {
  constructor(private readonly deps: MediaDeps) {}

  async execute(filter: MediaFilter = {}): Promise<{
    media: MediaItem[];
    counts: MediaContagem;
  }> {
    const refs = await this.deps.catalog.collect();
    const grupos = [...porChave(refs).values()].map((g) =>
      g.sort(ordenar),
    );

    const items: MediaItem[] = [];
    for (const grupo of grupos) {
      const principal = grupo[0];
      const chave = principal.chave;
      const material = grupo.find((r) => r.fonte === 'material');
      const tipo = classificarTipo(chave, material?.materialTipo);
      const criadoEm = grupo
        .map((r) => r.criadoEm)
        .filter((d): d is Date => Boolean(d))
        .sort((a, b) => b.getTime() - a.getTime())[0];
      const size = grupo
        .map((r) => r.sizeBytes)
        .find((s): s is number => typeof s === 'number' && s > 0);
      items.push({
        id: chave,
        chave,
        nome: material?.nome || principal.nome || nomeDeChave(chave),
        tipo,
        extensao: extensionOf(chave),
        sizeBytes: size ?? null,
        url: await this.deps.urls.resolvePublicUrl(chave),
        usadoEm: juntarUsos(grupo),
        criadoEm: criadoEm ? criadoEm.toISOString() : null,
        gerenciavel: Boolean(material),
        ...(material?.materialId ? { materialId: material.materialId } : {}),
      });
    }

    items.sort((a, b) => (b.criadoEm ?? '').localeCompare(a.criadoEm ?? ''));

    const counts: MediaContagem = {
      total: items.length,
      porTipo: TIPOS_MIDIA.reduce(
        (acc, t) => {
          acc[t] = items.filter((i) => i.tipo === t).length;
          return acc;
        },
        {} as Record<TipoMidia, number>,
      ),
    };

    let filtrados = items;
    if (filter.tipo) filtrados = filtrados.filter((i) => i.tipo === filter.tipo);
    if (filter.search?.trim()) {
      const termo = filter.search.trim().toLowerCase();
      filtrados = filtrados.filter(
        (i) =>
          i.nome.toLowerCase().includes(termo) ||
          i.chave.toLowerCase().includes(termo),
      );
    }
    return { media: filtrados, counts };
  }
}

export type { MediaRef };
