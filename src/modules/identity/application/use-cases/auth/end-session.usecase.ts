import { SessionRefreshRepository } from '../../../domain/repositories/session.repository.js';
import { GeradorToken, Clock } from '../../ports/ports.js';
export interface EndSessionDeps {
  sessions: SessionRefreshRepository;
  gerador: GeradorToken;
  clock: Clock;
}
export class EndSessionUseCase {
  constructor(private readonly deps: EndSessionDeps) {}
  async execute(input: { refreshToken: string }): Promise<{
    ended: true;
  }> {
    const session = await this.deps.sessions.byTokenHash(
      this.deps.gerador.hash(input.refreshToken),
    );
    if (session && !session.jaRevogada) {
      await this.deps.sessions.revoke(session.id, this.deps.clock.now());
    }
    return { ended: true };
  }
}
