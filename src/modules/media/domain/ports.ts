import type { TipoMidia } from './media.vo.js';

export const MEDIA_CATALOG = 'MEDIA_CATALOG' as const;
export const MEDIA_URL = 'MEDIA_URL' as const;

// Uma referência bruta de mídia encontrada em algum lugar do site.
export interface MediaRef {
  fonte: 'material' | 'lesson-content' | 'lesson-image' | 'hero';
  chave: string; // valor cru armazenado (chave S3 ou URL externa)
  nome?: string;
  materialTipo?: string; // MaterialType quando vem de um material
  sizeBytes?: number | null;
  criadoEm?: Date | null;
  contexto: string; // descrição legível de onde está em uso
  contextoId?: string;
  gerenciavel: boolean; // possui uma linha Material (editável/removível)
  materialId?: string;
}

export interface MediaCatalog {
  collect(): Promise<MediaRef[]>;
}

export interface MediaUrlResolver {
  resolvePublicUrl(valor: string): Promise<string | null>;
}

export interface MediaFilter {
  search?: string;
  tipo?: TipoMidia;
}

export interface MediaContagem {
  total: number;
  porTipo: Record<TipoMidia, number>;
}
