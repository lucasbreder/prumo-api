import { describe, expect, it } from 'vitest';
import {
  classificarTipo,
  nomeDeChave,
  extensionOf,
} from './media.vo.js';

describe('media.vo', () => {
  it('classifica tipo por extensão', () => {
    expect(classificarTipo('content/planta.webp')).toBe('image');
    expect(classificarTipo('uploads/a/b.mp4')).toBe('video');
    expect(classificarTipo('a/b.PDF')).toBe('document');
    expect(classificarTipo('a/b.mp3')).toBe('audio');
    expect(classificarTipo('a/b.zip')).toBe('other');
  });
  it('classifica tipo por MaterialType (documento)', () => {
    expect(classificarTipo('qualquer', 'EBOOK')).toBe('document');
    expect(classificarTipo('qualquer', 'SPREADSHEET')).toBe('document');
  });
  it('extrai extensão e ignora query', () => {
    expect(extensionOf('https://x/a.png?sig=1')).toBe('png');
    expect(extensionOf('a/b')).toBe('');
  });
  it('nome legível remove query e prefixo de uuid', () => {
    expect(nomeDeChave('uploads/m1/0123456789abcdef01234567-proposta.pdf')).toBe(
      'proposta.pdf',
    );
    expect(nomeDeChave('https://cdn/x.mp4?token=abc')).toBe('x.mp4');
    expect(nomeDeChave('content/planta-baixa.webp')).toBe('planta baixa.webp');
  });
});
