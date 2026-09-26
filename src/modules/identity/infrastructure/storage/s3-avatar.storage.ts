import { Inject, Injectable } from '@nestjs/common';
import { randomUUID } from 'node:crypto';
import { S3Client, GetObjectCommand, PutObjectCommand } from '@aws-sdk/client-s3';
import { getSignedUrl } from '@aws-sdk/s3-request-presigner';
import { ENV_TOKEN } from '../../../../shared/config/env.js';
import type { AppEnv } from '../../../../shared/config/env.js';
import type {
  AvatarStoragePort,
  AvatarUpload,
} from '../../application/ports/ports.js';

const PUT_TTL_SECONDS = 900;
const GET_TTL_SECONDS = 3600;
const EXT_POR_TIPO: Record<string, string> = {
  'image/jpeg': 'jpg',
  'image/png': 'png',
  'image/webp': 'webp',
  'image/avif': 'avif',
};
const E_URL_ABSOLUTA = /^(https?:)?\/\//i;

// Opção A: bucket privado. O banco guarda apenas a chave do objeto (avatars/...);
// a leitura devolve uma URL GET temporária assinada.
@Injectable()
export class S3AvatarStorage implements AvatarStoragePort {
  private readonly client: S3Client;
  constructor(
    @Inject(ENV_TOKEN)
    private readonly env: AppEnv,
  ) {
    this.client = new S3Client({
      endpoint: env.S3_ENDPOINT,
      region: env.S3_REGION,
      forcePathStyle: true,
      credentials: {
        accessKeyId: env.S3_ACCESS_KEY_ID,
        secretAccessKey: env.S3_SECRET_ACCESS_KEY,
      },
    });
  }

  async presignUpload(input: {
    userId: string;
    nomeArquivo: string;
    contentType: string;
    sizeBytes: number;
  }): Promise<AvatarUpload> {
    const ext = EXT_POR_TIPO[input.contentType] ?? 'bin';
    const chave = `avatars/${input.userId}/${randomUUID()}.${ext}`;
    const expiraEm = new Date(
      Date.now() + PUT_TTL_SECONDS * 1000,
    ).toISOString();
    const uploadUrl = await getSignedUrl(
      this.client,
      new PutObjectCommand({
        Bucket: this.env.S3_BUCKET,
        Key: chave,
        ContentType: input.contentType,
      }),
      { expiresIn: PUT_TTL_SECONDS },
    );
    const previewUrl = await this.assinarGet(chave);
    return { chave, uploadUrl, previewUrl, expiraEm };
  }

  async resolvePublicUrl(valor: string): Promise<string | null> {
    const v = valor.trim();
    if (!v || v.startsWith('data:')) return null;
    if (E_URL_ABSOLUTA.test(v) || v.startsWith('/')) return v;
    return this.assinarGet(v);
  }

  private async assinarGet(chave: string): Promise<string> {
    return getSignedUrl(
      this.client,
      new GetObjectCommand({ Bucket: this.env.S3_BUCKET, Key: chave }),
      { expiresIn: GET_TTL_SECONDS },
    );
  }
}
