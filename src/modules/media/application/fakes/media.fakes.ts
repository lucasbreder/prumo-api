import type { MediaCatalog, MediaRef, MediaUrlResolver } from '../../domain/ports.js';

export class FakeMediaCatalog implements MediaCatalog {
  refs: MediaRef[] = [];
  async collect(): Promise<MediaRef[]> {
    return this.refs;
  }
}

export class FakeMediaUrl implements MediaUrlResolver {
  async resolvePublicUrl(valor: string): Promise<string | null> {
    const v = valor.trim();
    if (!v) return null;
    if (/^(https?:)?\/\//i.test(v) || v.startsWith('/')) return v;
    return `https://img.test/${v}?sig=1`;
  }
}
