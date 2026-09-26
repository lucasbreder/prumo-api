import { Module } from '@nestjs/common';
import { MEDIA_CATALOG, MEDIA_URL } from './domain/ports.js';
import type { MediaCatalog, MediaUrlResolver } from './domain/ports.js';
import { PrismaMediaCatalog } from './infrastructure/persistence/prisma-media.catalog.js';
import { S3MediaUrl } from './infrastructure/storage/s3-media.url.js';
import { ListMediaUseCase } from './application/media.usecases.js';
import { MediaController, MediaSelectorController } from './presentation/media.controller.js';

@Module({
  controllers: [MediaController, MediaSelectorController],
  providers: [
    PrismaMediaCatalog,
    S3MediaUrl,
    { provide: MEDIA_CATALOG, useExisting: PrismaMediaCatalog },
    { provide: MEDIA_URL, useExisting: S3MediaUrl },
    {
      provide: ListMediaUseCase,
      inject: [MEDIA_CATALOG, MEDIA_URL],
      useFactory: (catalog: MediaCatalog, urls: MediaUrlResolver) =>
        new ListMediaUseCase({ catalog, urls }),
    },
  ],
  exports: [ListMediaUseCase],
})
export class MediaModule {}
