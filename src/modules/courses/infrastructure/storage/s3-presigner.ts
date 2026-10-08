import { Inject, Injectable } from '@nestjs/common';
import {
  S3Client,
  GetObjectCommand,
  PutObjectCommand,
  CreateMultipartUploadCommand,
  UploadPartCommand,
  CompleteMultipartUploadCommand,
  AbortMultipartUploadCommand,
} from '@aws-sdk/client-s3';
import { getSignedUrl } from '@aws-sdk/s3-request-presigner';
import { ENV_TOKEN } from '../../../../shared/config/env.js';
import type { AppEnv } from '../../../../shared/config/env.js';
import {
  CompletedPart,
  PresignInput,
  PresignPartInput,
  StoragePresigner,
} from '../../domain/repositories.js';
const EXPIRACAODefault = 900;
const GET_TTL_SECONDS = 3600;
const E_URL_ABSOLUTA = /^(https?:)?\/\//i;
@Injectable()
export class S3StoragePresigner implements StoragePresigner {
  private readonly client: S3Client;
  constructor(
    @Inject(ENV_TOKEN)
    private readonly envConfig: AppEnv,
  ) {
    this.client = new S3Client({
      endpoint: envConfig.S3_ENDPOINT,
      region: envConfig.S3_REGION,
      forcePathStyle: true,
      credentials: {
        accessKeyId: envConfig.S3_ACCESS_KEY_ID,
        secretAccessKey: envConfig.S3_SECRET_ACCESS_KEY,
      },
    });
  }
  async presignUpload(input: PresignInput): Promise<{
    url: string;
    expiraEm: string;
  }> {
    const seconds = input.expiraEmSeconds ?? EXPIRACAODefault;
    const url = await getSignedUrl(
      this.client,
      new PutObjectCommand({
        Bucket: this.envConfig.S3_BUCKET,
        Key: input.chave,
        ContentType: input.typeContent,
      }),
      { expiresIn: seconds },
    );
    return {
      url,
      expiraEm: new Date(Date.now() + seconds * 1000).toISOString(),
    };
  }
  async createMultipartUpload(input: {
    chave: string;
    typeContent: string;
  }): Promise<{ uploadId: string }> {
    const out = await this.client.send(
      new CreateMultipartUploadCommand({
        Bucket: this.envConfig.S3_BUCKET,
        Key: input.chave,
        ContentType: input.typeContent,
      }),
    );
    if (!out.UploadId) {
      throw new Error('S3 nao retornou UploadId para o multipart');
    }
    return { uploadId: out.UploadId };
  }
  async presignUploadPart(input: PresignPartInput): Promise<{
    url: string;
    expiraEm: string;
  }> {
    const seconds = input.expiraEmSeconds ?? EXPIRACAODefault;
    const url = await getSignedUrl(
      this.client,
      new UploadPartCommand({
        Bucket: this.envConfig.S3_BUCKET,
        Key: input.chave,
        UploadId: input.uploadId,
        PartNumber: input.parte,
      }),
      { expiresIn: seconds },
    );
    return {
      url,
      expiraEm: new Date(Date.now() + seconds * 1000).toISOString(),
    };
  }
  async completeMultipartUpload(input: {
    chave: string;
    uploadId: string;
    partes: CompletedPart[];
  }): Promise<void> {
    await this.client.send(
      new CompleteMultipartUploadCommand({
        Bucket: this.envConfig.S3_BUCKET,
        Key: input.chave,
        UploadId: input.uploadId,
        MultipartUpload: {
          Parts: input.partes.map((p) => ({
            PartNumber: p.parte,
            ETag: p.etag,
          })),
        },
      }),
    );
  }
  async abortMultipartUpload(input: {
    chave: string;
    uploadId: string;
  }): Promise<void> {
    await this.client.send(
      new AbortMultipartUploadCommand({
        Bucket: this.envConfig.S3_BUCKET,
        Key: input.chave,
        UploadId: input.uploadId,
      }),
    );
  }
  async resolvePublicUrl(valor: string): Promise<string | null> {
    const v = valor.trim();
    if (!v || v.startsWith('data:')) return null;
    if (E_URL_ABSOLUTA.test(v) || v.startsWith('/')) return v;
    return getSignedUrl(
      this.client,
      new GetObjectCommand({ Bucket: this.envConfig.S3_BUCKET, Key: v }),
      { expiresIn: GET_TTL_SECONDS },
    );
  }
}
