import { User } from '../../../domain/entities/user.entity.js';
import { SessionRefresh } from '../../../domain/entities/refresh-session.entity.js';
import { SessionRefreshRepository } from '../../../domain/repositories/session.repository.js';
import {
  UserReader,
  UserWriter,
} from '../../../domain/repositories/user.repository.js';
import {
  EmissorAccessToken,
  GeradorToken,
  PasswordHasher,
  Clock,
} from '../../ports/ports.js';
import { PublicadorEvents } from '../../../domain/events.js';
import { InvalidCredentialsError } from '../../../../../shared/errors/domain.errors.js';
import { Email } from '../../../../../shared/domain/email.vo.js';
import { randomUUID } from 'node:crypto';
export interface AuthenticateDeps {
  users: UserReader & UserWriter;
  sessions: SessionRefreshRepository;
  hasher: PasswordHasher;
  gerador: GeradorToken;
  clock: Clock;
  emissor: EmissorAccessToken;
  events: PublicadorEvents;
  refreshTtlDays: number;
}
export interface SessionIssued {
  accessToken: string;
  refreshToken: string;
  user: {
    id: string;
    name: string;
    email: string;
    role: string;
  };
}
export class AuthenticateUseCase {
  constructor(private readonly deps: AuthenticateDeps) {}
  async execute(input: {
    email: string;
    password: string;
    deviceId?: string;
  }): Promise<SessionIssued> {
    const email = Email.from(input.email);
    const user = await this.deps.users.byEmail(email.value);
    if (!user) throw new InvalidCredentialsError();
    if (!user.active) {
      throw new InvalidCredentialsError('Conta inativa — fale com a equipe');
    }
    if (!user.passwordHash) {
      throw new InvalidCredentialsError(
        'Entre com o provedor usado no cadastro',
      );
    }
    const passwordOk = await this.deps.hasher.comparar(
      input.password,
      user.passwordHash,
    );
    if (!passwordOk) throw new InvalidCredentialsError();
    const current = this.deps.clock.now();
    user.registerAccess(current);
    await this.deps.users.save(user);
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
export async function issueSession(
  user: User,
  sessions: SessionRefreshRepository,
  gerador: GeradorToken,
  emissor: EmissorAccessToken,
  current: Date,
  ttlDays: number,
  familyId?: string | null,
  deviceId?: string | null,
): Promise<{
  accessToken: string;
  refreshToken: string;
}> {
  const token = gerador.generate();
  await sessions.create(
    SessionRefresh.issue({
      id: randomUUID(),
      userId: user.id,
      tokenHash: token.hash,
      familyId: familyId ?? randomUUID(),
      deviceId: deviceId ?? null,
      expiresAt: new Date(current.getTime() + ttlDays * 86400000),
    }),
  );
  return {
    accessToken: emissor.issue({ id: user.id, role: user.role }),
    refreshToken: token.raw,
  };
}
