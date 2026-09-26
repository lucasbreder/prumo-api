import { Module } from '@nestjs/common';
import { IdentityModule } from '../identity/identity.module.js';
import {
  TESTIMONIALS_PORT,
  MENUS_PORT,
  MENTORS_PORT,
  METHOD_PORT,
  NEWSLETTER_PORT,
  HIGHLIGHTS_PORT,
  IMAGE_STORAGE_PORT,
} from './domain/ports.js';
import type { HighlightsPort, ImageStoragePort } from './domain/ports.js';
import {
  PrismaTestimonialsRepository,
  PrismaMentorsPort,
  PrismaMenusRepository,
  PrismaMethodRepository,
  PrismaNewsletterRepository,
  PrismaHighlightsRepository,
} from './infrastructure/persistence/prisma-site.repository.js';
import { S3ImagesStorage } from './infrastructure/storage/s3-images.storage.js';
import {
  SubscribeNewsletterUseCase,
  PreviewHeroImagesUseCase,
  PresignHeroUploadUseCase,
  ListPublicTestimonialsUseCase,
  ListTestimonialsUseCase,
  ListMenusUseCase,
  ListPublicMentorsUseCase,
  GetHighlightsUseCase,
  GetMethodUseCase,
  RegisterTestimonialUseCase,
  RemoveMenuItemUseCase,
  SaveHighlightsUseCase,
  SaveTestimonialStatusUseCase,
  SaveMenuItemUseCase,
  SaveMethodUseCase,
} from './application/use-cases/site.usecases.js';
import {
  AdminTestimonialsController,
  AdminSiteController,
  TestimonialsController,
  NewsletterController,
  SitePublicController,
} from './presentation/site.controller.js';
const useCasesWithPort = (
  cls: new (deps: never) => unknown,
  token: string,
  field: string,
) => ({
  provide: cls,
  inject: [token],
  useFactory: (port: unknown) => new cls({ [field]: port } as never),
});
@Module({
  imports: [IdentityModule],
  controllers: [
    SitePublicController,
    TestimonialsController,
    NewsletterController,
    AdminSiteController,
    AdminTestimonialsController,
  ],
  providers: [
    PrismaMenusRepository,
    PrismaMethodRepository,
    PrismaTestimonialsRepository,
    PrismaNewsletterRepository,
    PrismaMentorsPort,
    PrismaHighlightsRepository,
    S3ImagesStorage,
    { provide: MENUS_PORT, useExisting: PrismaMenusRepository },
    { provide: METHOD_PORT, useExisting: PrismaMethodRepository },
    { provide: TESTIMONIALS_PORT, useExisting: PrismaTestimonialsRepository },
    { provide: NEWSLETTER_PORT, useExisting: PrismaNewsletterRepository },
    { provide: MENTORS_PORT, useExisting: PrismaMentorsPort },
    { provide: HIGHLIGHTS_PORT, useExisting: PrismaHighlightsRepository },
    { provide: IMAGE_STORAGE_PORT, useExisting: S3ImagesStorage },
    {
      provide: GetHighlightsUseCase,
      inject: [HIGHLIGHTS_PORT, IMAGE_STORAGE_PORT],
      useFactory: (highlights: HighlightsPort, images: ImageStoragePort) =>
        new GetHighlightsUseCase({ highlights, images }),
    },
    {
      provide: PreviewHeroImagesUseCase,
      inject: [IMAGE_STORAGE_PORT],
      useFactory: (images: ImageStoragePort) =>
        new PreviewHeroImagesUseCase({ images }),
    },
    {
      provide: PresignHeroUploadUseCase,
      inject: [IMAGE_STORAGE_PORT],
      useFactory: (images: ImageStoragePort) =>
        new PresignHeroUploadUseCase({ storage: images }),
    },
    useCasesWithPort(SaveHighlightsUseCase, HIGHLIGHTS_PORT, 'highlights'),
    useCasesWithPort(SaveMenuItemUseCase, MENUS_PORT, 'menus'),
    useCasesWithPort(ListMenusUseCase, MENUS_PORT, 'menus'),
    useCasesWithPort(RemoveMenuItemUseCase, MENUS_PORT, 'menus'),
    useCasesWithPort(SaveMethodUseCase, METHOD_PORT, 'method'),
    useCasesWithPort(GetMethodUseCase, METHOD_PORT, 'method'),
    useCasesWithPort(
      RegisterTestimonialUseCase,
      TESTIMONIALS_PORT,
      'testimonials',
    ),
    useCasesWithPort(
      SaveTestimonialStatusUseCase,
      TESTIMONIALS_PORT,
      'testimonials',
    ),
    useCasesWithPort(
      ListTestimonialsUseCase,
      TESTIMONIALS_PORT,
      'testimonials',
    ),
    useCasesWithPort(
      ListPublicTestimonialsUseCase,
      TESTIMONIALS_PORT,
      'testimonials',
    ),
    useCasesWithPort(SubscribeNewsletterUseCase, NEWSLETTER_PORT, 'newsletter'),
    useCasesWithPort(ListPublicMentorsUseCase, MENTORS_PORT, 'mentors'),
  ],
})
export class SiteModule {}
