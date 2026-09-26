import type { ContentBlock } from '../domain/rich-content.vo.js';

export type ResolvedBlock =
  | Exclude<ContentBlock, { type: 'image' }>
  | (Extract<ContentBlock, { type: 'image' }> & { url: string });

// Maps image blocks' stored keys to displayable URLs using an injected
// resolver (S3 signing lives in infrastructure). Non-image blocks pass through.
export async function resolveBlockImages(
  blocks: ContentBlock[] | null,
  resolve: (key: string) => Promise<string | null>,
): Promise<ResolvedBlock[] | null> {
  if (!blocks || blocks.length === 0) return null;
  const out: ResolvedBlock[] = [];
  for (const block of blocks) {
    if (block.type === 'image') {
      const url = (await resolve(block.key)) ?? '';
      out.push({ ...block, url });
    } else {
      out.push(block);
    }
  }
  return out;
}

// Signs a stored asset URL (S3 key -> short-lived GET URL; external/relative
// URLs pass through). Used for lesson content files (video/material).
export async function resolveAssetUrl(
  valor: string | null,
  resolve: (key: string) => Promise<string | null>,
): Promise<string | null> {
  if (!valor) return null;
  return (await resolve(valor)) ?? valor;
}
