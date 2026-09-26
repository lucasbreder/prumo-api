import { Inject, Injectable } from '@nestjs/common';
import { S3Client, GetObjectCommand } from '@aws-sdk/client-s3';
import { getSignedUrl } from '@aws-sdk/s3-request-presigner';
import { ENV_TOKEN } from '../../../../shared/config/env.js';
import type { AppEnv } from '../../../../shared/config/env.js';
import type { MediaUrlResolver } from '../../domain/ports.js';

const GET_TTL_SECONDS = 3600;
const E_URL_ABSOLUTA = /^(https?:)?\/\//i;

@Injectable()
export class S3MediaUrl implements MediaUrlResolver {
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
  async resolvePublicUrl(valor: string): Promise<string | null> {
    const v = valor.trim();
    if (!v || v.startsWith('data:')) return null;
    if (E_URL_ABSOLUTA.test(v) || v.startsWith('/')) return v;
    return getSignedUrl(
      this.client,
      new GetObjectCommand({ Bucket: this.env.S3_BUCKET, Key: v }),
      { expiresIn: GET_TTL_SECONDS },
    );
  }
}
