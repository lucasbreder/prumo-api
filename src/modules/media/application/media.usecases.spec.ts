import { describe, expect, it } from 'vitest';
import { ListMediaUseCase } from './media.usecases.js';
import {
  FakeMediaCatalog,
  FakeMediaUrl,
} from './fakes/media.fakes.js';

function contexto(refs: FakeMediaCatalog['refs']) {
  const catalog = new FakeMediaCatalog();
  catalog.refs = refs;
  return new ListMediaUseCase({ catalog, urls: new FakeMediaUrl() });
}

const materialRef = (extra = {}) => ({
  fonte: 'material' as const,
  chave: 'uploads/m1/0123456789abcdef01234567-plano.xlsx',
  nome: 'Plano mensal',
  materialTipo: 'SPREADSHEET',
  sizeBytes: 1234,
  criadoEm: new Date('2026-09-01'),
  contexto: 'Material — Gestão de Estúdio',
  contextoId: 'c1',
  gerenciavel: true,
  materialId: 'mat1',
  ...extra,
});

describe('ListMediaUseCase (pool de mídia)', () => {
  it('agrega referências e deduplica por chave juntando os usos', async () => {
    const uc = contexto([
      materialRef(),
      { ...materialRef(), fonte: 'lesson-content', chave: 'uploads/m1/0123456789abcdef01234567-plano.xlsx', contexto: 'Gestão de Estúdio › Plano', contextoId: 'l1', gerenciavel: false, materialId: undefined },
    ]);
    const { media } = await uc.execute();
    expect(media).toHaveLength(1);
    expect(media[0].usadoEm.map((u) => u.tipo)).toEqual(['material', 'lesson']);
    expect(media[0].gerenciavel).toBe(true);
    expect(media[0].materialId).toBe('mat1');
  });
  it('assina a url para exibir (chave -> url temporária)', async () => {
    const uc = contexto([materialRef()]);
    const { media } = await uc.execute();
    expect(media[0].url).toContain('img.test');
  });
  it('URL externa passa direto e continua no pool', async () => {
    const uc = contexto([
      {
        fonte: 'lesson-content',
        chave: 'https://cdn.test/aula.mp4',
        contexto: 'Curso › Aula 1',
        contextoId: 'l2',
        gerenciavel: false,
        sizeBytes: null,
      },
    ]);
    const { media } = await uc.execute();
    expect(media[0].url).toBe('https://cdn.test/aula.mp4');
    expect(media[0].tipo).toBe('video');
  });
  it('filtra por tipo e busca', async () => {
    const uc = contexto([
      materialRef(),
      { fonte: 'hero', chave: 'hero/abc-imagem.webp', contexto: 'Site — capa', gerenciavel: false },
    ]);
    expect((await uc.execute({ tipo: 'image' })).media).toHaveLength(1);
    expect((await uc.execute({ tipo: 'document' })).media).toHaveLength(1);
    expect((await uc.execute({ search: 'plano' })).media[0].tipo).toBe('document');
    expect((await uc.execute({ search: 'zzz' })).media).toHaveLength(0);
  });
  it('conta por tipo (independente do filtro)', async () => {
    const uc = contexto([
      materialRef(),
      { fonte: 'hero', chave: 'hero/x.webp', contexto: 'Site — capa', gerenciavel: false },
    ]);
    const { counts } = await uc.execute({ tipo: 'image' });
    expect(counts.total).toBe(2);
    expect(counts.porTipo.image).toBe(1);
    expect(counts.porTipo.document).toBe(1);
  });
});
