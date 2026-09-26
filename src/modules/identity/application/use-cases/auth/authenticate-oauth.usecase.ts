import { randomUUID } from 'node:crypto';
import { User, SocialProvider } from '../../../domain/entities/user.entity.js';
import { SessionRefreshRepository } from '../../../domain/repositories/session.repository.js';
import {
  UserReader,
  UserWriter,
} from '../../../domain/repositories/user.repository.js';
import {
  Clock,
  EmissorAccessToken,
  GeradorToken,
  OAuthVerifier,
} from '../../ports/ports.js';
import { PublicadorEvents, IdentityEvents } from '../../../domain/events.js';
import {
  InvalidCredentialsError,
  BusinessRuleError,
} from '../../../../../shared/errors/domain.errors.js';
import { Email } from '../../../../../shared/domain/email.vo.js';
import { issueSession, SessionIssued } from './authenticate.usecase.js';

export interface AuthenticateWithOAuthDeps {
  users: UserReader & UserWriter;
  sessions: SessionRefreshRepository;
  gerador: GeradorToken;
  clock: Clock;
  emissor: EmissorAccessToken;
  events: PublicadorEvents;
  oauth: OAuthVerifier;
  refreshTtlDays: number;
}

export class AuthenticateWithOAuthUseCase {
  constructor(private readonly deps: AuthenticateWithOAuthDeps) {}

  async execute(input: {
    provider: SocialProvider;
    idToken: string;
    deviceId?: string;
  }): Promise<SessionIssued> {
    const identidade =
      input.provider === 'GOOGLE'
        ? await this.deps.oauth.verifyGoogle(input.idToken)
        : await this.deps.oauth.verifyApple(input.idToken);

    if (!identidade.emailVerified) {
      throw new InvalidCredentialsError('E-mail nao verificado pelo provedor');
    }

    let email: Email;
    try {
      email = Email.from(identidade.email);
    } catch {
      throw new InvalidCredentialsError('E-mail invalido retornado');
    }

    const current = this.deps.clock.now();
    let user = await this.deps.users.byProvider(
      input.provider,
      identidade.providerId,
    );
    if (!user) {
      user = await this.deps.users.byEmail(email.value);
      if (user && !user.providerIdFor(input.provider)) {
        user.linkProvider(input.provider, identidade.providerId);
      }
    }

    if (user) {
      if (!user.active) {
        throw new InvalidCredentialsError('Conta inativa — fale com a equipe');
      }
      user.registerAccess(current);
      await this.deps.users.save(user);
    } else {
      user = User.createOAuth({
        id: randomUUID(),
        name: identidade.name?.trim() || email.value.split('@')[0],
        email,
        provider: input.provider,
        providerId: identidade.providerId,
      });
      if (!user.name?.trim()) {
        throw new BusinessRuleError('O nome e obrigatorio');
      }
      user.registerAccess(current);
      await this.deps.users.create(user);
      this.deps.events.issue(IdentityEvents.ACCOUNT_CREATED, {
        userId: user.id,
        email: user.email.value,
      });
    }

    const { accessToken, refreshToken } = await issueSession(
      user,
      this.deps.sessions,
      this.deps.gerador,
      this.deps.emissor,
      current,
      this.deps.refreshTtlDays,
      null,
      input.deviceId ?? null,
    );
    return {
      accessToken,
      refreshToken,
      user: {
        id: user.id,
        name: user.name,
        email: user.email.value,
        role: user.role,
      },
    };
  }
}
