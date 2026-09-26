import { Module } from '@nestjs/common';
import { BillingModule } from '../billing/billing.module.js';
import { SystemClock } from '../../shared/infrastructure/system-clock.js';
import { NestEventPublisher } from '../../shared/infrastructure/event-publisher.js';
import { LIVE_READER, LIVE_WRITER } from './domain/repositories.js';
import { PrismaLiveRepository } from './infrastructure/persistence/prisma-live.repository.js';
import {
  ListAgendaLivesUseCase,
  RemoveLiveUseCase,
  SaveLiveUseCase,
  TransitionLiveUseCase,
} from './application/use-cases/lives.usecases.js';
import {
  AdminLivesController,
  LivesController,
} from './presentation/lives.controller.js';
@Module({
  imports: [BillingModule],
  controllers: [LivesController, AdminLivesController],
  providers: [
    PrismaLiveRepository,
    SystemClock,
    NestEventPublisher,
    { provide: LIVE_READER, useExisting: PrismaLiveRepository },
    { provide: LIVE_WRITER, useExisting: PrismaLiveRepository },
    ...[
      ListAgendaLivesUseCase,
      SaveLiveUseCase,
      TransitionLiveUseCase,
      RemoveLiveUseCase,
    ].map((cls) => ({
      provide: cls,
      inject: [PrismaLiveRepository, SystemClock, NestEventPublisher],
      useFactory: (
        lives: PrismaLiveRepository,
        clock: SystemClock,
        events: NestEventPublisher,
      ) => new cls({ lives, clock, events }),
    })),
  ],
})
export class LivesModule {}
