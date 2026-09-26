// Pool de mídia: view unificada de todas as mídias do site (materiais, arquivos
// de aulas, imagens dos blocos de conteúdo e capas da home). É um read-model
// derivado das referências existentes — inspirado na "Biblioteca de mídia" do WP.

export type TipoMidia = 'image' | 'video' | 'audio' | 'document' | 'other';

export const TIPOS_MIDIA: TipoMidia[] = [
  'image',
  'video',
  'audio',
  'document',
  'other',
];

const EXT_IMAGEM = ['jpg', 'jpeg', 'png', 'webp', 'gif', 'avif', 'svg'];
const EXT_VIDEO = ['mp4', 'webm', 'mov', 'm4v'];
const EXT_AUDIO = ['mp3', 'wav', 'ogg', 'm4a'];
const EXT_DOC = [
  'pdf',
  'doc',
  'docx',
  'xls',
  'xlsx',
  'ppt',
  'pptx',
  'csv',
  'txt',
  'key',
  'pages',
  'epub',
];

// MaterialType (backend) -> tipo de mídia do pool.
const TIPO_POR_MATERIAL: Record<string, TipoMidia> = {
  PDF: 'document',
  EBOOK: 'document',
  CHECKLIST: 'document',
  TEMPLATE: 'document',
  SPREADSHEET: 'document',
  PRESENTATION: 'document',
};

function extensaoDe(chave: string): string {
  const semQuery = chave.split('?')[0];
  const ultimo = semQuery.slice(semQuery.lastIndexOf('/') + 1);
  const ponto = ultimo.lastIndexOf('.');
  return ponto >= 0 ? ultimo.slice(ponto + 1).toLowerCase() : '';
}

export function classificarTipo(chave: string, materialTipo?: string): TipoMidia {
  if (materialTipo && TIPO_POR_MATERIAL[materialTipo]) {
    return TIPO_POR_MATERIAL[materialTipo];
  }
  const ext = extensaoDe(chave);
  if (EXT_IMAGEM.includes(ext)) return 'image';
  if (EXT_VIDEO.includes(ext)) return 'video';
  if (EXT_AUDIO.includes(ext)) return 'audio';
  if (EXT_DOC.includes(ext)) return 'document';
  return 'other';
}

// Nome legível a partir da chave/URL: último segmento, sem query, removendo o
// prefixo de id (`<uuid>-nome.pdf` -> `nome.pdf`).
export function nomeDeChave(chave: string): string {
  const semQuery = chave.split('?')[0];
  let ultimo = semQuery.slice(semQuery.lastIndexOf('/') + 1);
  const idx = ultimo.indexOf('-');
  // prefixos de upload/heroes: um token longo (id/uuid) seguido de '-'.
  if (idx >= 16) ultimo = ultimo.slice(idx + 1);
  return ultimo.replace(/[-_]+/g, ' ').trim() || ultimo;
}

export interface UsoMidia {
  tipo: 'material' | 'lesson' | 'lesson-image' | 'hero';
  descricao: string;
  id?: string;
}

export interface MediaItem {
  id: string;
  chave: string;
  nome: string;
  tipo: TipoMidia;
  extensao: string;
  sizeBytes: number | null;
  url: string | null;
  usadoEm: UsoMidia[];
  criadoEm: string | null;
  gerenciavel: boolean;
  materialId?: string;
}

export function extensionOf(chave: string): string {
  return extensaoDe(chave);
}
