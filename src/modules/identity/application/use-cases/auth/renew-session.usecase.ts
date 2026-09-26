import { SessionRefreshRepository } from '../../../domain/repositories/session.repository.js';
import { UserReader } from '../../../domain/repositories/user.repository.js';
import { EmissorAccessToken, GeradorToken, Clock } from '../../ports/ports.js';
import { InvalidCredentialsError } from '../../../../../shared/errors/domain.errors.js';
import { issueSession, SessionIssued } from './authenticate.usecase.js';
export interface RenewSessionDeps {
  users: UserReader;
  sessions: SessionRefreshRepository;
  gerador: GeradorToken;
  clock: Clock;
  emissor: EmissorAccessToken;
  refreshTtlDays: number;
}
export class RenewSessionUseCase {
  constructor(private readonly deps: RenewSessionDeps) {}
  async execute(input: { refreshToken: string }): Promise<SessionIssued> {
    const session = await this.deps.sessions.byTokenHash(
      this.deps.gerador.hash(input.refreshToken),
    );
    if (!session) throw new InvalidCredentialsError();
    const current = this.deps.clock.now();
    if (session.jaRevogada) {
      // Detecção de reuso: token rotacionado reapareceu → provável roubo.
      await this.deps.sessions.revokeFamily(session.familyId, current);
      throw new InvalidCredentialsError(
        'Sessao encerrada por seguranca. Faca login novamente.',
      );
    }
    if (session.estaExpired(current)) {
      throw new InvalidCredentialsError('Sessao expirada');
    }
    const user = await this.deps.users.byId(session.userId);
    if (!user || !user.active) {
      await this.deps.sessions.revokeFamily(session.familyId, current);
      throw new InvalidCredentialsError();
    }
    await this.deps.sessions.revoke(session.id, current);
    const { accessToken, refreshToken } = await issueSession(
      user,
      this.deps.sessions,
      this.deps.gerador,
      this.deps.emissor,
      current,
      this.deps.refreshTtlDays,
      session.familyId,
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
