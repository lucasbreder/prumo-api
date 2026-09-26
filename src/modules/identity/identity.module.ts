import { Module } from '@nestjs/common';
import { JwtModule } from '@nestjs/jwt';
import { ENV_TOKEN, AppEnv } from '../../shared/config/env.js';
import { AuthenticateUseCase } from './application/use-cases/auth/authenticate.usecase.js';
import { AuthenticateWithOAuthUseCase } from './application/use-cases/auth/authenticate-oauth.usecase.js';
import { RenewSessionUseCase } from './application/use-cases/auth/renew-session.usecase.js';
import { EndSessionUseCase } from './application/use-cases/auth/end-session.usecase.js';
import { CreateAccountUseCase } from './application/use-cases/account/create-account.usecase.js';
import { RequestResetPasswordUseCase } from './application/use-cases/account/request-password-reset.usecase.js';
import { RestorePasswordUseCase } from './application/use-cases/account/restore-password.usecase.js';
import {
  ChangePasswordUseCase,
  PresignAvatarUseCase,
  UpdateAccountUseCase,
  UpdateNotificationsUseCase,
  AccountDeps,
  DefinirRoleUseCase,
  GetAccountUseCase,
  GetNotificationsUseCase,
} from './application/use-cases/account/account.usecases.js';
import {
  CreateMentorAdminUseCase,
  ListMentorsAdminUseCase,
  UpdateMentorAdminUseCase,
} from './application/use-cases/account/admin-mentors.usecases.js';
import {
  ACCESS_TOKEN_ISSUER,
  AVATAR_STORAGE,
  TOKEN_GENERATOR,
  PASSWORD_HASHER,
  OAUTH_VERIFIER,
  Clock,
} from './application/ports/ports.js';
import { Events } from '../../shared/domain/publisher.js';
import {
  STUDENTS_READER,
  MENTOR_READER,
  MENTORS_ADMIN_READER,
  USER_READER,
  USER_WRITER,
} from './domain/repositories/user.repository.js';
import {
  PASSWORD_RESET_REPOSITORY,
  SESSION_REFRESH_REPOSITORY,
} from './domain/repositories/session.repository.js';
import { CryptoTokenGenerator } from './infrastructure/crypto/token-generator.service.js';
import { SystemClock } from '../../shared/infrastructure/system-clock.js';
import { BcryptHasher } from './infrastructure/security/bcrypt-hasher.service.js';
import { JwtAccessTokenIssuer } from './infrastructure/jwt/access-token-issuer.service.js';
import { JwksOAuthVerifier } from './infrastructure/oauth/jwks-oauth.verifier.js';
import { PrismaUserRepository } from './infrastructure/persistence/prisma-user.repository.js';
import { S3AvatarStorage } from './infrastructure/storage/s3-avatar.storage.js';
import {
  PrismaPasswordResetRepository,
  PrismaSessionRefreshRepository,
} from './infrastructure/persistence/prisma-session.repository.js';
import { NestEventPublisher } from '../../shared/infrastructure/event-publisher.js';
import { AuthController } from './presentation/controllers/auth.controller.js';
import { AccountController } from './presentation/controllers/account.controller.js';
import { AdminUsersController } from './presentation/controllers/admin-users.controller.js';
import { AdminMentorsController } from './presentation/controllers/admin-mentors.controller.js';
import { NotificationIdentidadeListener } from './presentation/listeners/identity-notification.listener.js';
const depsDeAccount = (
  users: PrismaUserRepository,
  sessions: PrismaSessionRefreshRepository,
  hasher: BcryptHasher,
  clock: SystemClock,
): AccountDeps => ({ users, sessions, hasher, clock });
const AccountsINJECT = [
  PrismaUserRepository,
  PrismaSessionRefreshRepository,
  BcryptHasher,
  SystemClock,
];
function useCaseDeAccount<T>(cls: new (deps: AccountDeps) => T) {
  return {
    provide: cls,
    inject: AccountsINJECT,
    useFactory: (
      users: PrismaUserRepository,
      sessions: PrismaSessionRefreshRepository,
      hasher: BcryptHasher,
      clock: SystemClock,
    ) => new cls(depsDeAccount(users, sessions, hasher, clock)),
  };
}
@Module({
  imports: [JwtModule.register({})],
  controllers: [
    AuthController,
    AccountController,
    AdminUsersController,
    AdminMentorsController,
  ],
  providers: [
    PrismaUserRepository,
    PrismaSessionRefreshRepository,
    PrismaPasswordResetRepository,
    BcryptHasher,
    CryptoTokenGenerator,
    SystemClock,
    NestEventPublisher,
    JwtAccessTokenIssuer,
    { provide: USER_READER, useExisting: PrismaUserRepository },
    { provide: USER_WRITER, useExisting: PrismaUserRepository },
    { provide: STUDENTS_READER, useExisting: PrismaUserRepository },
    { provide: MENTOR_READER, useExisting: PrismaUserRepository },
    { provide: MENTORS_ADMIN_READER, useExisting: PrismaUserRepository },
    {
      provide: SESSION_REFRESH_REPOSITORY,
      useExisting: PrismaSessionRefreshRepository,
    },
    {
      provide: PASSWORD_RESET_REPOSITORY,
      useExisting: PrismaPasswordResetRepository,
    },
    { provide: PASSWORD_HASHER, useExisting: BcryptHasher },
    { provide: TOKEN_GENERATOR, useExisting: CryptoTokenGenerator },
    { provide: Clock, useExisting: SystemClock },
    { provide: Events, useExisting: NestEventPublisher },
    { provide: ACCESS_TOKEN_ISSUER, useExisting: JwtAccessTokenIssuer },
    {
      provide: AuthenticateUseCase,
      inject: [
        PrismaUserRepository,
        PrismaSessionRefreshRepository,
        BcryptHasher,
        CryptoTokenGenerator,
        SystemClock,
        JwtAccessTokenIssuer,
        NestEventPublisher,
        ENV_TOKEN,
      ],
      useFactory: (
        users: PrismaUserRepository,
        sessions: PrismaSessionRefreshRepository,
        hasher: BcryptHasher,
        gerador: CryptoTokenGenerator,
        clock: SystemClock,
        emissor: JwtAccessTokenIssuer,
        events: NestEventPublisher,
        env: AppEnv,
      ) =>
        new AuthenticateUseCase({
          users,
          sessions,
          hasher,
          gerador,
          clock,
          emissor,
          events,
          refreshTtlDays: env.REFRESH_TTL_DAYS,
        }),
    },
    JwksOAuthVerifier,
    { provide: OAUTH_VERIFIER, useExisting: JwksOAuthVerifier },
    {
      provide: AuthenticateWithOAuthUseCase,
      inject: [
        PrismaUserRepository,
        PrismaSessionRefreshRepository,
        CryptoTokenGenerator,
        SystemClock,
        JwtAccessTokenIssuer,
        NestEventPublisher,
        JwksOAuthVerifier,
        ENV_TOKEN,
      ],
      useFactory: (
        users: PrismaUserRepository,
        sessions: PrismaSessionRefreshRepository,
        gerador: CryptoTokenGenerator,
        clock: SystemClock,
        emissor: JwtAccessTokenIssuer,
        events: NestEventPublisher,
        oauth: JwksOAuthVerifier,
        env: AppEnv,
      ) =>
        new AuthenticateWithOAuthUseCase({
          users,
          sessions,
          gerador,
          clock,
          emissor,
          events,
          oauth,
          refreshTtlDays: env.REFRESH_TTL_DAYS,
        }),
    },
    {
      provide: RenewSessionUseCase,
      inject: [
        PrismaUserRepository,
        PrismaSessionRefreshRepository,
        CryptoTokenGenerator,
        SystemClock,
        JwtAccessTokenIssuer,
        ENV_TOKEN,
      ],
      useFactory: (
        users: PrismaUserRepository,
        sessions: PrismaSessionRefreshRepository,
        gerador: CryptoTokenGenerator,
        clock: SystemClock,
        emissor: JwtAccessTokenIssuer,
        env: AppEnv,
      ) =>
        new RenewSessionUseCase({
          users,
          sessions,
          gerador,
          clock,
          emissor,
          refreshTtlDays: env.REFRESH_TTL_DAYS,
        }),
    },
    {
      provide: EndSessionUseCase,
      inject: [
        PrismaSessionRefreshRepository,
        CryptoTokenGenerator,
        SystemClock,
      ],
      useFactory: (
        sessions: PrismaSessionRefreshRepository,
        gerador: CryptoTokenGenerator,
        clock: SystemClock,
      ) => new EndSessionUseCase({ sessions, gerador, clock }),
    },
    {
      provide: CreateAccountUseCase,
      inject: [PrismaUserRepository, BcryptHasher, NestEventPublisher],
      useFactory: (
        users: PrismaUserRepository,
        hasher: BcryptHasher,
        events: NestEventPublisher,
      ) => new CreateAccountUseCase({ users, hasher, events }),
    },
    {
      provide: ListMentorsAdminUseCase,
      inject: [MENTORS_ADMIN_READER],
      useFactory: (mentors: PrismaUserRepository) =>
        new ListMentorsAdminUseCase({ mentors }),
    },
    {
      provide: CreateMentorAdminUseCase,
      inject: [CreateAccountUseCase, PrismaUserRepository],
      useFactory: (
        createAccount: CreateAccountUseCase,
        users: PrismaUserRepository,
      ) => new CreateMentorAdminUseCase({ createAccount, users }),
    },
    {
      provide: UpdateMentorAdminUseCase,
      inject: [
        PrismaUserRepository,
        MENTORS_ADMIN_READER,
        PrismaSessionRefreshRepository,
        SystemClock,
      ],
      useFactory: (
        users: PrismaUserRepository,
        mentors: PrismaUserRepository,
        sessions: PrismaSessionRefreshRepository,
        clock: SystemClock,
      ) =>
        new UpdateMentorAdminUseCase({ users, mentors, sessions, clock }),
    },
    {
      provide: RequestResetPasswordUseCase,
      inject: [
        PrismaUserRepository,
        PrismaSessionRefreshRepository,
        PrismaPasswordResetRepository,
        CryptoTokenGenerator,
        SystemClock,
        NestEventPublisher,
        ENV_TOKEN,
      ],
      useFactory: (
        users: PrismaUserRepository,
        sessions: PrismaSessionRefreshRepository,
        resets: PrismaPasswordResetRepository,
        gerador: CryptoTokenGenerator,
        clock: SystemClock,
        events: NestEventPublisher,
        env: AppEnv,
      ) =>
        new RequestResetPasswordUseCase({
          users,
          sessions,
          resets,
          gerador,
          clock,
          events,
          resetTtlMinutes: env.RESET_TTL_MINUTES,
        }),
    },
    {
      provide: RestorePasswordUseCase,
      inject: [
        PrismaUserRepository,
        PrismaSessionRefreshRepository,
        PrismaPasswordResetRepository,
        BcryptHasher,
        CryptoTokenGenerator,
        SystemClock,
      ],
      useFactory: (
        users: PrismaUserRepository,
        sessions: PrismaSessionRefreshRepository,
        resets: PrismaPasswordResetRepository,
        hasher: BcryptHasher,
        gerador: CryptoTokenGenerator,
        clock: SystemClock,
      ) =>
        new RestorePasswordUseCase({
          users,
          sessions,
          resets,
          hasher,
          gerador,
          clock,
        }),
    },
    S3AvatarStorage,
    { provide: AVATAR_STORAGE, useExisting: S3AvatarStorage },
    {
      provide: PresignAvatarUseCase,
      inject: [AVATAR_STORAGE],
      useFactory: (storage: S3AvatarStorage) =>
        new PresignAvatarUseCase({ storage }),
    },
    useCaseDeAccount(GetAccountUseCase),
    useCaseDeAccount(UpdateAccountUseCase),
    useCaseDeAccount(ChangePasswordUseCase),
    useCaseDeAccount(DefinirRoleUseCase),
    useCaseDeAccount(GetNotificationsUseCase),
    useCaseDeAccount(UpdateNotificationsUseCase),
    NotificationIdentidadeListener,
  ],
  exports: [
    USER_READER,
    USER_WRITER,
    MENTOR_READER,
    STUDENTS_READER,
    GetAccountUseCase,
  ],
})
export class IdentityModule {}
