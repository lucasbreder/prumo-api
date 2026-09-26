import { randomUUID } from 'node:crypto';
import { SessionRefreshRepository } from '../../../domain/repositories/session.repository.js';
import { PasswordResetRepository } from '../../../domain/repositories/session.repository.js';
import { UserReader } from '../../../domain/repositories/user.repository.js';
import { GeradorToken, Clock } from '../../ports/ports.js';
import { PublicadorEvents, IdentityEvents } from '../../../domain/events.js';
export interface RequestResetDeps {
  users: UserReader;
  sessions: SessionRefreshRepository;
  resets: PasswordResetRepository;
  gerador: GeradorToken;
  clock: Clock;
  events: PublicadorEvents;
  resetTtlMinutes: number;
}
export class RequestResetPasswordUseCase {
  constructor(private readonly deps: RequestResetDeps) {}
  async execute(input: { email: string }): Promise<{
    sent: true;
  }> {
    const user = await this.deps.users.byEmail(
      input.email.trim().toLowerCase(),
    );
    // Reply identica for e-mail inexistente (anti-enumeração).
    if (!user) return { sent: true };
    const current = this.deps.clock.now();
    const token = this.deps.gerador.generate();
    await this.deps.resets.create({
      id: randomUUID(),
      userId: user.id,
      tokenHash: token.hash,
      expiresAt: new Date(
        current.getTime() + this.deps.resetTtlMinutes * 60000,
      ),
      usedAt: null,
    });
    await this.deps.sessions.revokeTodasDoUser(user.id, current);
    this.deps.events.issue(IdentityEvents.RESET_REQUESTED, {
      userId: user.id,
      email: user.email.value,
      tokenRaw: token.raw,
    });
    return { sent: true };
  }
}
