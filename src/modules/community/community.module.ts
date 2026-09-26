import { Module } from '@nestjs/common';
import { IdentityModule } from '../identity/identity.module.js';
import { BillingModule } from '../billing/billing.module.js';
import { SystemClock } from '../../shared/infrastructure/system-clock.js';
import {
  REPORT_READER,
  REPORT_WRITER,
  REACTION_READER,
  REACTION_WRITER,
  RULES_READER,
  REPLY_WRITER,
  THREAD_READER,
  THREAD_WRITER,
} from './domain/repositories.js';
import {
  PrismaReportRepository,
  PrismaReactionRepository,
  PrismaCommunityRulesRepository,
  PrismaReplyRepository,
  PrismaThreadRepository,
} from './infrastructure/persistence/prisma-community.repository.js';
import { IdentityBanUser } from './infrastructure/identity/ban-user.js';
import {
  CreateThreadUseCase,
  ReportThreadUseCase,
  ListThreadsUseCase,
  ModerateThreadUseCase,
  GetReportsKpisUseCase,
  GetRulesUseCase,
  ReactThreadUseCase,
  ResolveReportUseCase,
  ResponderThreadUseCase,
  SaveRulesUseCase,
} from './application/use-cases/community.usecases.js';
import { ListReportsUseCase } from './application/use-cases/list-reports.usecase.js';
import {
  AdminCommunityController,
  CommunityController,
} from './presentation/community.controller.js';
@Module({
  imports: [IdentityModule, BillingModule],
  controllers: [CommunityController, AdminCommunityController],
  providers: [
    PrismaThreadRepository,
    PrismaReactionRepository,
    PrismaReplyRepository,
    PrismaReportRepository,
    PrismaCommunityRulesRepository,
    IdentityBanUser,
    SystemClock,
    { provide: THREAD_READER, useExisting: PrismaThreadRepository },
    { provide: THREAD_WRITER, useExisting: PrismaThreadRepository },
    { provide: REACTION_READER, useExisting: PrismaReactionRepository },
    { provide: REACTION_WRITER, useExisting: PrismaReactionRepository },
    { provide: REPLY_WRITER, useExisting: PrismaReplyRepository },
    { provide: REPORT_READER, useExisting: PrismaReportRepository },
    { provide: REPORT_WRITER, useExisting: PrismaReportRepository },
    { provide: RULES_READER, useExisting: PrismaCommunityRulesRepository },
    {
      provide: 'COMUNIDADE_DEPS',
      inject: [
        PrismaThreadRepository,
        PrismaReactionRepository,
        PrismaReplyRepository,
        PrismaReportRepository,
        PrismaCommunityRulesRepository,
        IdentityBanUser,
        SystemClock,
      ],
      useFactory: (
        threads: PrismaThreadRepository,
        reactions: PrismaReactionRepository,
        replies: PrismaReplyRepository,
        reports: PrismaReportRepository,
        rules: PrismaCommunityRulesRepository,
        banUser: IdentityBanUser,
        clock: SystemClock,
      ) => ({
        threads,
        reactions,
        replies,
        reports,
        rules,
        banUser,
        clock,
      }),
    },
    ...[
      CreateThreadUseCase,
      ListThreadsUseCase,
      ReactThreadUseCase,
      ResponderThreadUseCase,
      ReportThreadUseCase,
      ModerateThreadUseCase,
      ResolveReportUseCase,
      GetReportsKpisUseCase,
      GetRulesUseCase,
      SaveRulesUseCase,
    ].map((cls) => ({
      provide: cls,
      inject: ['COMUNIDADE_DEPS'],
      useFactory: (
        deps: import('./application/use-cases/community.usecases.js').CommunityDeps,
      ) => new cls(deps),
    })),
    {
      provide: ListReportsUseCase,
      inject: [PrismaReportRepository],
      useFactory: (reports: PrismaReportRepository) =>
        new ListReportsUseCase({ reports }),
    },
  ],
})
export class CommunityModule {}
