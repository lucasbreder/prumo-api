import { describe, expect, it } from 'vitest';
import { RichContent } from './rich-content.vo.js';
import { BusinessRuleError } from '../../../shared/errors/domain.errors.js';

describe('RichContent (blocos tipo Payload)', () => {
  it('aceita documento valido e normaliza marks', () => {
    const doc = RichContent.from([
      { type: 'heading', level: 2, content: [{ text: 'Titulo', bold: true }] },
      {
        type: 'paragraph',
        content: [
          { text: 'Veja ', },
          { text: 'o manual', italic: true, link: 'https://x.dev/a' },
        ],
      },
      { type: 'bulletList', items: [[{ text: 'um' }], [{ text: 'dois' }]] },
      { type: 'quote', content: [{ text: 'asum' }] },
      { type: 'callout', tone: 'warning', content: [{ text: 'atencao' }] },
      { type: 'code', language: 'ts', content: 'const a = 1' },
      { type: 'image', key: 'content/2026/x.webp', alt: 'planta' },
      { type: 'divider' },
    ]);
    expect(doc.isEmpty).toBe(false);
    const value = doc.value;
    expect(value[0]).toMatchObject({ type: 'heading', level: 2 });
    expect(value[1]).toMatchObject({
      type: 'paragraph',
      content: [
        { text: 'Veja ' },
        { text: 'o manual', italic: true, link: 'https://x.dev/a' },
      ],
    });
    expect(value[6]).toMatchObject({ type: 'image', key: 'content/2026/x.webp' });
  });

  it('trata undefined/null como documento vazio', () => {
    expect(RichContent.from(null).isEmpty).toBe(true);
    expect(RichContent.from(undefined).isEmpty).toBe(true);
    expect(RichContent.from([]).isEmpty).toBe(true);
  });

  it('rejeita tipo de bloco desconhecido (nada de JSON livre)', () => {
    expect(() => RichContent.from([{ type: 'iframe', url: 'x' }])).toThrow(
      BusinessRuleError,
    );
  });

  it('rejeita imagem em base64/data URI', () => {
    expect(() =>
      RichContent.from([
        { type: 'image', key: 'data:image/png;base64,AAAA' },
      ]),
    ).toThrow(/base64/i);
  });

  it('rejeita link nao http/mailto/caminho', () => {
    expect(() =>
      RichContent.from([
        { type: 'paragraph', content: [{ text: 'a', link: 'javascript:alert(1)' }] },
      ]),
    ).toThrow(/Link/);
  });

  it('rejeita paragrafo sem texto', () => {
    expect(() =>
      RichContent.from([{ type: 'paragraph', content: [{ text: '   ' }] }]),
    ).toThrow(/Paragrafo/);
  });

  it('ignorance de props desconhecidas dentro do bloco (nao passa adiante)', () => {
    const doc = RichContent.from([
      { type: 'divider', EvilProp: 'x' },
    ]);
    expect(doc.value[0]).toEqual({ type: 'divider' });
  });

  it('mantem heading level invalido como 2 (default seguro)', () => {
    const doc = RichContent.from([
      { type: 'heading', level: 9, content: [{ text: 'x' }] },
    ]);
    expect(doc.value[0]).toMatchObject({ level: 2 });
  });
});
