import { Module } from '@nestjs/common';
import { APP_GUARD } from '@nestjs/core';
import { ThrottlerGuard, ThrottlerModule } from '@nestjs/throttler';
import { EventEmitterModule } from '@nestjs/event-emitter';
import { JwtModule } from '@nestjs/jwt';
import { EnvModule } from './shared/config/env.module.js';
import { PrismaModule } from './shared/database/prisma.module.js';
import { JwtAuthGuard } from './shared/auth/jwt-auth.guard.js';
import { RolesGuard } from './shared/auth/roles.guard.js';
import { IdentityModule } from './modules/identity/identity.module.js';
import { BillingModule } from './modules/billing/billing.module.js';
import { CoursesModule } from './modules/courses/courses.module.js';
import { MediaModule } from './modules/media/media.module.js';
import { CommunityModule } from './modules/community/community.module.js';
import { SiteModule } from './modules/site/site.module.js';
import { DashboardModule } from './modules/dashboard/dashboard.module.js';
import { LivesModule } from './modules/lives/lives.module.js';
@Module({
  imports: [
    EnvModule,
    PrismaModule,
    EventEmitterModule.forRoot({ wildcard: true, delimiter: '.' }),
    ThrottlerModule.forRoot([{ ttl: 60000, limit: 60 }]),
    JwtModule.register({}),
    IdentityModule,
    BillingModule,
    CoursesModule,
    MediaModule,
    CommunityModule,
    SiteModule,
    DashboardModule,
    LivesModule,
  ],
  providers: [
    { provide: APP_GUARD, useClass: ThrottlerGuard },
    { provide: APP_GUARD, useClass: JwtAuthGuard },
    { provide: APP_GUARD, useClass: RolesGuard },
  ],
})
export class AppModule {}
