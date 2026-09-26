import { Module } from '@nestjs/common';
import { DASHBOARDReader } from './domain/ports.js';
import type { DashboardReader } from './domain/ports.js';
import { PrismaDashboardReader } from './infrastructure/prisma-dashboard.reader.js';
import { GetDashboardUseCase } from './application/get-dashboard.usecase.js';
import { DashboardController } from './presentation/dashboard.controller.js';
@Module({
  controllers: [DashboardController],
  providers: [
    { provide: DASHBOARDReader, useClass: PrismaDashboardReader },
    {
      provide: GetDashboardUseCase,
      inject: [DASHBOARDReader],
      useFactory: (reader: DashboardReader) =>
        new GetDashboardUseCase({ reader }),
    },
  ],
})
export class DashboardModule {}
