import { BusinessRuleError } from '../../../shared/errors/domain.errors.js';

// Block-based rich text (Payload-style): a document is an ordered array of
// typed blocks. We store a *normalized* form (not raw editor JSON) so the
// backend stays the source of truth and rendering never needs HTML injection.

export interface RichTextRun {
  text: string;
  bold?: boolean;
  italic?: boolean;
  code?: boolean;
  link?: string;
}

export type CalloutTone = 'info' | 'success' | 'warning' | 'danger';

export type ContentBlock =
  | { type: 'heading'; level: 1 | 2 | 3; content: RichTextRun[] }
  | { type: 'paragraph'; content: RichTextRun[] }
  | { type: 'bulletList'; items: RichTextRun[][] }
  | { type: 'numberedList'; items: RichTextRun[][] }
  | { type: 'quote'; content: RichTextRun[] }
  | { type: 'callout'; tone: CalloutTone; content: RichTextRun[] }
  | { type: 'code'; language?: string; content: string }
  // `key` is either an S3 object key (private bucket, signed on read) or an
  // absolute/relative URL. base64/data URLs are rejected on save.
  | { type: 'image'; key: string; alt?: string; width?: number }
  | { type: 'divider' };

const MAX_BLOCKS = 500;
const MAX_RUNS = 300;
const MAX_TEXT_LENGTH = 5000;
const MAX_CODE_LENGTH = 20000;
const CALLOUT_TONES: CalloutTone[] = ['info', 'success', 'warning', 'danger'];
const E_URL_ABSOLUTA = /^(https?:)?\/\//i;
const E_MAILTO = /^mailto:/i;

function falhar(msg: string): never {
  throw new BusinessRuleError(msg);
}

function eObjeto(v: unknown): v is Record<string, unknown> {
  return typeof v === 'object' && v !== null && !Array.isArray(v);
}

function exigirLink(link: unknown): string | undefined {
  if (link === undefined || link === null || link === '') return undefined;
  if (typeof link !== 'string') falhar('Link de texto invalido');
  const valor = link.trim();
  // Only http(s)/protocol-relative links and internal paths; never data URIs.
  if (
    E_URL_ABSOLUTA.test(valor) ||
    valor.startsWith('/') ||
    E_MAILTO.test(valor)
  ) {
    return valor;
  }
  return falhar('Link deve ser uma URL http(s), mailto ou caminho interno');
}

function parseRun(raw: unknown): RichTextRun {
  if (!eObjeto(raw)) falhar('Trecho de texto invalido');
  if (typeof raw.text !== 'string') falhar('Trecho de texto sem conteudo');
  if (raw.text.length > MAX_TEXT_LENGTH) {
    falhar(`Texto excede ${MAX_TEXT_LENGTH} caracteres`);
  }
  const run: RichTextRun = { text: raw.text };
  if (raw.bold === true) run.bold = true;
  if (raw.italic === true) run.italic = true;
  if (raw.code === true) run.code = true;
  const link = exigirLink(raw.link);
  if (link) run.link = link;
  return run;
}

function parseRichText(raw: unknown): RichTextRun[] {
  if (!Array.isArray(raw)) falhar('Conteudo de texto invalido');
  if (raw.length > MAX_RUNS) falhar('Texto com trechos demais');
  const runs = raw.map(parseRun);
  if (runs.length === 0) return [];
  return runs;
}

function textIsEmpty(runs: RichTextRun[]): boolean {
  return runs.every((r) => r.text.trim() === '');
}

function parseImage(raw: Record<string, unknown>): ContentBlock {
  if (typeof raw.key !== 'string' || !raw.key.trim()) {
    falhar('Bloco de imagem sem chave/URL');
  }
  const key = raw.key.trim();
  if (key.startsWith('data:') || key.startsWith('base64,')) {
    falhar('Imagem em base64 nao e permitida (use upload assinado)');
  }
  const block: ContentBlock = { type: 'image', key };
  if (typeof raw.alt === 'string' && raw.alt.trim()) {
    (block as { alt?: string }).alt = raw.alt.trim().slice(0, 200);
  }
  if (typeof raw.width === 'number' && Number.isInteger(raw.width)) {
    (block as { width?: number }).width = Math.min(2000, Math.max(1, raw.width));
  }
  return block;
}

function parseBlock(raw: unknown): ContentBlock {
  if (!eObjeto(raw)) falhar('Bloco invalido');
  switch (raw.type) {
    case 'divider':
      return { type: 'divider' };
    case 'heading': {
      const level = raw.level === 1 || raw.level === 3 ? raw.level : 2;
      const content = parseRichText(raw.content);
      if (textIsEmpty(content)) falhar('Titulo sem texto');
      return { type: 'heading', level, content };
    }
    case 'paragraph': {
      const content = parseRichText(raw.content);
      if (textIsEmpty(content)) falhar('Paragrafo sem texto');
      return { type: 'paragraph', content };
    }
    case 'quote': {
      const content = parseRichText(raw.content);
      if (textIsEmpty(content)) falhar('Citacao sem texto');
      return { type: 'quote', content };
    }
    case 'callout': {
      const tone = CALLOUT_TONES.includes(raw.tone as CalloutTone)
        ? (raw.tone as CalloutTone)
        : 'info';
      const content = parseRichText(raw.content);
      if (textIsEmpty(content)) falhar('Caixa de destaque sem texto');
      return { type: 'callout', tone, content };
    }
    case 'bulletList':
    case 'numberedList': {
      if (!Array.isArray(raw.items)) falhar('Lista sem itens');
      if (raw.items.length === 0) falhar('Lista vazia');
      if (raw.items.length > MAX_RUNS) falhar('Lista com itens demais');
      const items = raw.items.map(parseRichText);
      return { type: raw.type, items };
    }
    case 'code': {
      if (typeof raw.content !== 'string') falhar('Bloco de codigo sem conteudo');
      if (raw.content.length > MAX_CODE_LENGTH) {
        falhar('Codigo excede o tamanho maximo');
      }
      const block: ContentBlock = { type: 'code', content: raw.content };
      if (typeof raw.language === 'string' && raw.language.trim()) {
        (block as { language?: string }).language = raw.language
          .trim()
          .slice(0, 30);
      }
      return block;
    }
    case 'image':
      return parseImage(raw);
    default:
      return falhar(`Tipo de bloco desconhecido: ${String(raw.type)}`);
  }
}

export function blocksHaveContent(blocks: ContentBlock[]): boolean {
  return blocks.length > 0;
}

export class RichContent {
  private constructor(readonly value: ContentBlock[]) {}

  static from(raw: unknown): RichContent {
    if (raw === undefined || raw === null) return new RichContent([]);
    if (!Array.isArray(raw)) falhar('Conteudo em blocos deve ser uma lista');
    if (raw.length > MAX_BLOCKS) falhar(`Maximo de ${MAX_BLOCKS} blocos`);
    return new RichContent(raw.map(parseBlock));
  }

  static assert(raw: unknown): ContentBlock[] {
    return RichContent.from(raw).value;
  }

  get isEmpty(): boolean {
    return !blocksHaveContent(this.value);
  }

  toPrisma(): unknown[] {
    return this.value;
  }
}
