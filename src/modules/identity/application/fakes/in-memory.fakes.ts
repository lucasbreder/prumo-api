import { SessionRefresh } from '../../domain/entities/refresh-session.entity.js';
import {
  PasswordResetRepository,
  PasswordResetToken,
  SessionRefreshRepository,
} from '../../domain/repositories/session.repository.js';
import {
  StudentFilter,
  StudentRow,
  StudentsReader,
  UserReader,
  UserWriter,
} from '../../domain/repositories/user.repository.js';
import { User } from '../../domain/entities/user.entity.js';
import type { SocialProvider } from '../../domain/entities/user.entity.js';
import {
  EmissorAccessToken,
  GeradorToken,
  PasswordHasher,
  Clock,
  TokenGerado,
} from '../ports/ports.js';
import { PublicadorEvents } from '../../domain/events.js';
import type { OAuthIdentity, OAuthVerifier } from '../ports/ports.js';
export class FakeUserRepo implements UserReader, UserWriter {
  users = new Map<string, User>();
  add(user: User): void {
    this.users.set(user.id, user);
  }
  async byId(id: string): Promise<User | null> {
    return this.users.get(id) ?? null;
  }
  async byEmail(email: string): Promise<User | null> {
    const alvo = email.toLowerCase();
    for (const u of this.users.values()) {
      if (u.email.value === alvo) return u;
    }
    return null;
  }
  async byProvider(
    provider: SocialProvider,
    providerId: string,
  ): Promise<User | null> {
    for (const u of this.users.values()) {
      if (u.providerIdFor(provider) === providerId) return u;
    }
    return null;
  }
  async create(user: User): Promise<void> {
    this.users.set(user.id, user);
  }
  async save(user: User): Promise<void> {
    this.users.set(user.id, user);
  }
}
export class FakeSessionRepo implements SessionRefreshRepository {
  sessions: SessionRefresh[] = [];
  async create(session: SessionRefresh): Promise<void> {
    this.sessions.push(session);
  }
  async byTokenHash(tokenHash: string): Promise<SessionRefresh | null> {
    return this.sessions.find((s) => s.tokenHash === tokenHash) ?? null;
  }
  async revoke(id: string, em: Date): Promise<void> {
    const s = this.sessions.find((x) => x.id === id);
    s?.revoke(em);
  }
  async revokeFamily(familyId: string, em: Date): Promise<void> {
    for (const s of this.sessions) {
      if (s.familyId === familyId && !s.jaRevogada) s.revoke(em);
    }
  }
  async revokeTodasDoUser(userId: string, em: Date): Promise<void> {
    for (const s of this.sessions) {
      if (s.userId === userId && !s.jaRevogada) s.revoke(em);
    }
  }
}
export class FakeResetRepo implements PasswordResetRepository {
  tokens: PasswordResetToken[] = [];
  async create(token: PasswordResetToken): Promise<void> {
    this.tokens.push(token);
  }
  async byTokenHash(tokenHash: string): Promise<PasswordResetToken | null> {
    return this.tokens.find((t) => t.tokenHash === tokenHash) ?? null;
  }
  async markUsado(id: string, em: Date): Promise<void> {
    const t = this.tokens.find((x) => x.id === id);
    if (t) t.usedAt = em;
  }
}
export class FakeHasher implements PasswordHasher {
  async hash(password: string): Promise<string> {
    return `hash:${password}`;
  }
  async comparar(password: string, hash: string): Promise<boolean> {
    return hash === `hash:${password}`;
  }
}
export class FakeTokenGenerator implements GeradorToken {
  private contador = 0;
  generate(): TokenGerado {
    this.contador += 1;
    return {
      raw: `raw-${this.contador}`,
      hash: `hash-de-raw-${this.contador}`,
    };
  }
  hash(raw: string): string {
    return `hash-de-${raw}`;
  }
}
export class FakeClock implements Clock {
  data = new Date('2026-09-04T12:00:00.000Z');
  now(): Date {
    return this.data;
  }
  avanhar(ms: number): void {
    this.data = new Date(this.data.getTime() + ms);
  }
}
export class FakeIssuer implements EmissorAccessToken {
  issue(user: { id: string; role: string }): string {
    return `jwt.${user.id}.${user.role}`;
  }
}
export class FakeOAuthVerifier implements OAuthVerifier {
  identidadeGoogle: OAuthIdentity | null = null;
  identidadeApple: OAuthIdentity | null = null;
  erro: Error | null = null;
  chamadas: { provider: string; token: string }[] = [];
  async verifyGoogle(idToken: string): Promise<OAuthIdentity> {
    this.chamadas.push({ provider: 'GOOGLE', token: idToken });
    if (this.erro) throw this.erro;
    if (!this.identidadeGoogle)
      throw new Error('FakeOAuthVerifier: sem identidade Google configurada');
    return this.identidadeGoogle;
  }
  async verifyApple(idToken: string): Promise<OAuthIdentity> {
    this.chamadas.push({ provider: 'APPLE', token: idToken });
    if (this.erro) throw this.erro;
    if (!this.identidadeApple)
      throw new Error('FakeOAuthVerifier: sem identidade Apple configurada');
    return this.identidadeApple;
  }
}
export class FakePublisher implements PublicadorEvents {  emitidos: {
    name: string;
    payload: unknown;
  }[] = [];
  issue(name: string, payload: unknown): void {
    this.emitidos.push({ name, payload });
  }
}
export class FakeStudentsRepo implements StudentsReader {
  rows: StudentRow[] = [];
  async list(filter: StudentFilter): Promise<{
    rows: StudentRow[];
    total: number;
  }> {
    const startsAt = (filter.page - 1) * filter.perPage;
    return {
      rows: this.rows.slice(startsAt, startsAt + filter.perPage),
      total: this.rows.length,
    };
  }
}
