import {
  PasswordResetRepository,
  SessionRefreshRepository,
} from '../../../domain/repositories/session.repository.js';
import {
  UserReader,
  UserWriter,
} from '../../../domain/repositories/user.repository.js';
import { GeradorToken, PasswordHasher, Clock } from '../../ports/ports.js';
import { Password } from '../../../domain/value-objects/password.vo.js';
import { InvalidCredentialsError } from '../../../../../shared/errors/domain.errors.js';
export interface RestorePasswordDeps {
  users: UserReader & UserWriter;
  sessions: SessionRefreshRepository;
  resets: PasswordResetRepository;
  hasher: PasswordHasher;
  gerador: GeradorToken;
  clock: Clock;
}
export class RestorePasswordUseCase {
  constructor(private readonly deps: RestorePasswordDeps) {}
  async execute(input: { token: string; newPassword: string }): Promise<{
    restored: true;
  }> {
    const registro = await this.deps.resets.byTokenHash(
      this.deps.gerador.hash(input.token),
    );
    const current = this.deps.clock.now();
    if (
      !registro ||
      registro.usedAt ||
      registro.expiresAt.getTime() <= current.getTime()
    ) {
      throw new InvalidCredentialsError(
        'Token de recuperacao invalido ou expirado',
      );
    }
    const user = await this.deps.users.byId(registro.userId);
    if (!user) throw new InvalidCredentialsError();
    const newPassword = Password.fromRaw(input.newPassword);
    user.trocarPassword(await this.deps.hasher.hash(newPassword.raw));
    await this.deps.users.save(user);
    await this.deps.resets.markUsado(registro.id, current);
    await this.deps.sessions.revokeTodasDoUser(user.id, current);
    return { restored: true };
  }
}
