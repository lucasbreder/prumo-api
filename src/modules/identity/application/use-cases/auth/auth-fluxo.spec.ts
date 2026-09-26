import { describe, expect, it, beforeEach } from 'vitest';
import { randomUUID } from 'node:crypto';
import { User } from '../../../domain/entities/user.entity.js';
import { Email } from '../../../../../shared/domain/email.vo.js';
import {
  FakeIssuer,
  FakeTokenGenerator,
  FakeHasher,
  FakePublisher,
  FakeClock,
  FakeResetRepo,
  FakeSessionRepo,
  FakeUserRepo,
} from '../../fakes/in-memory.fakes.js';
import { AuthenticateUseCase } from './authenticate.usecase.js';
import { RenewSessionUseCase } from './renew-session.usecase.js';
import { EndSessionUseCase } from './end-session.usecase.js';
import { CreateAccountUseCase } from '../account/create-account.usecase.js';
import { RequestResetPasswordUseCase } from '../account/request-password-reset.usecase.js';
import { RestorePasswordUseCase } from '../account/restore-password.usecase.js';
import {
  InvalidCredentialsError,
  ConflictError,
} from '../../../../../shared/errors/domain.errors.js';
const Day = 86400000;
function monta() {
  const users = new FakeUserRepo();
  const sessions = new FakeSessionRepo();
  const resets = new FakeResetRepo();
  const hasher = new FakeHasher();
  const gerador = new FakeTokenGenerator();
  const clock = new FakeClock();
  const emissor = new FakeIssuer();
  const events = new FakePublisher();
  const authenticate = new AuthenticateUseCase({
    users,
    sessions,
    hasher,
    gerador,
    clock,
    emissor,
    events,
    refreshTtlDays: 30,
  });
  const renew = new RenewSessionUseCase({
    users,
    sessions,
    gerador,
    clock,
    emissor,
    refreshTtlDays: 30,
  });
  const end = new EndSessionUseCase({
    sessions,
    gerador,
    clock,
  });
  const createAccount = new CreateAccountUseCase({
    users,
    hasher,
    events,
  });
  const requestReset = new RequestResetPasswordUseCase({
    users,
    sessions,
    resets,
    gerador,
    clock,
    events,
    resetTtlMinutes: 30,
  });
  const restore = new RestorePasswordUseCase({
    users,
    sessions,
    resets,
    hasher,
    gerador,
    clock,
  });
  return {
    users,
    sessions,
    resets,
    hasher,
    gerador,
    clock,
    events,
    authenticate,
    renew,
    end,
    createAccount,
    requestReset,
    restore,
  };
}
async function accountStudent(
  users: FakeUserRepo,
  passwordBruta = 'prumo2026',
): Promise<User> {
  const u = User.create({
    id: randomUUID(),
    name: 'Ana Arquiteta',
    email: Email.from('ana@prumo.com.br'),
    passwordHash: await new FakeHasher().hash(passwordBruta),
    role: 'STUDENT',
  });
  users.add(u);
  return u;
}
describe('Authentication flow', () => {
  let ctx: ReturnType<typeof monta>;
  beforeEach(() => {
    ctx = monta();
  });
  it('login valida credenciais e emite par de tokens', async () => {
    const u = await accountStudent(ctx.users);
    const output = await ctx.authenticate.execute({
      email: 'ana@prumo.com.br',
      password: 'prumo2026',
    });
    expect(output.accessToken).toBe(`jwt.${u.id}.STUDENT`);
    expect(output.refreshToken).toMatch(/^raw-/);
    expect(output.user.role).toBe('STUDENT');
    expect(u.lastAccessAt).toEqual(ctx.clock.data);
    expect(ctx.sessions.sessions).toHaveLength(1);
    expect(ctx.sessions.sessions[0].expiresAt.getTime()).toBe(
      ctx.clock.data.getTime() + 30 * Day,
    );
  });
  it('login rejeita senha errada', async () => {
    await accountStudent(ctx.users, 'prumo2026');
    await expect(
      ctx.authenticate.execute({
        email: 'ana@prumo.com.br',
        password: 'outra123',
      }),
    ).rejects.toBeInstanceOf(InvalidCredentialsError);
  });
  it('login rejeita e-mail inexistente sem revelar isso', async () => {
    await expect(
      ctx.authenticate.execute({
        email: 'ninguem@x.com',
        password: 'prumo2026',
      }),
    ).rejects.toBeInstanceOf(InvalidCredentialsError);
  });
  it('login rejeita conta inativa', async () => {
    const u = await accountStudent(ctx.users);
    u.definirActive(false);
    await expect(
      ctx.authenticate.execute({
        email: 'ana@prumo.com.br',
        password: 'prumo2026',
      }),
    ).rejects.toBeInstanceOf(InvalidCredentialsError);
  });
  it('refresh rotaciona: novo token e antigo revogado na mesma familia', async () => {
    await accountStudent(ctx.users);
    const primeiro = await ctx.authenticate.execute({
      email: 'ana@prumo.com.br',
      password: 'prumo2026',
    });
    const rotacionado = await ctx.renew.execute({
      refreshToken: primeiro.refreshToken,
    });
    expect(rotacionado.refreshToken).not.toBe(primeiro.refreshToken);
    expect(rotacionado.accessToken).toBe(primeiro.accessToken);
    expect(ctx.sessions.sessions).toHaveLength(2);
    const antiga = ctx.sessions.sessions[0];
    expect(antiga.jaRevogada).toBe(true);
    expect(ctx.sessions.sessions[1].familyId).toBe(antiga.familyId);
  });
  it('reuso de refresh revogado derruba a familia inteira (possivel roubo)', async () => {
    await accountStudent(ctx.users);
    const primeiro = await ctx.authenticate.execute({
      email: 'ana@prumo.com.br',
      password: 'prumo2026',
    });
    await ctx.renew.execute({ refreshToken: primeiro.refreshToken });
    await expect(
      ctx.renew.execute({ refreshToken: primeiro.refreshToken }),
    ).rejects.toBeInstanceOf(InvalidCredentialsError);
    expect(ctx.sessions.sessions.every((s) => s.jaRevogada)).toBe(true);
  });
  it('refresh de token desconhecido falha', async () => {
    await expect(
      ctx.renew.execute({ refreshToken: 'nao-existe' }),
    ).rejects.toBeInstanceOf(InvalidCredentialsError);
  });
  it('logout revoga apenas a sessao informada', async () => {
    await accountStudent(ctx.users);
    const a = await ctx.authenticate.execute({
      email: 'ana@prumo.com.br',
      password: 'prumo2026',
    });
    const b = await ctx.authenticate.execute({
      email: 'ana@prumo.com.br',
      password: 'prumo2026',
    });
    await ctx.end.execute({ refreshToken: a.refreshToken });
    expect(ctx.sessions.sessions[0].jaRevogada).toBe(true);
    expect(ctx.sessions.sessions[1].jaRevogada).toBe(false);
    await expect(
      ctx.renew.execute({ refreshToken: b.refreshToken }),
    ).resolves.toBeDefined();
  });
  it('cadastro cria conta de aluno e publica evento', async () => {
    const u = await ctx.createAccount.execute({
      name: ' Beto ',
      email: 'beto@estudio.com',
      password: 'beto2026x',
    });
    expect(u.name).toBe('Beto');
    expect(u.role).toBe('STUDENT');
    expect(ctx.events.emitidos[0].name).toBe('identity.account_created');
  });
  it('cadastro rejeita e-mail duplicado', async () => {
    await accountStudent(ctx.users);
    await expect(
      ctx.createAccount.execute({
        name: 'Clone',
        email: 'ANA@prumo.com.br',
        password: 'clone2026x',
      }),
    ).rejects.toBeInstanceOf(ConflictError);
  });
  it('forgot-password emite token com expiracao e evento', async () => {
    const u = await accountStudent(ctx.users);
    const output = await ctx.requestReset.execute({
      email: 'ana@prumo.com.br',
    });
    expect(output).toEqual({ sent: true });
    expect(ctx.resets.tokens[0].expiresAt.getTime()).toBe(
      ctx.clock.data.getTime() + 30 * 60000,
    );
    expect(ctx.events.emitidos[0]).toMatchObject({
      name: 'identity.reset_requested',
      payload: { userId: u.id },
    });
  });
  it('forgot-password para e-mail inexistente responde igual (anti-enumeração)', async () => {
    const output = await ctx.requestReset.execute({ email: 'some@x.com' });
    expect(output).toEqual({ sent: true });
    expect(ctx.resets.tokens).toHaveLength(0);
    expect(ctx.events.emitidos).toHaveLength(0);
  });
  it('reset aplica nova senha, marca token como usado e derruba sessoes', async () => {
    await accountStudent(ctx.users);
    const antes = await ctx.requestReset.execute({
      email: 'ana@prumo.com.br',
    });
    expect(antes.sent).toBe(true);
    const tokenRaw = ctx.events.emitidos[0].payload as {
      tokenRaw: string;
    };
    const loginAntes = await ctx.authenticate.execute({
      email: 'ana@prumo.com.br',
      password: 'prumo2026',
    });
    await ctx.restore.execute({
      token: tokenRaw.tokenRaw,
      newPassword: 'newPassword123',
    });
    await expect(
      ctx.renew.execute({ refreshToken: loginAntes.refreshToken }),
    ).rejects.toBeInstanceOf(InvalidCredentialsError);
    await ctx.authenticate.execute({
      email: 'ana@prumo.com.br',
      password: 'newPassword123',
    });
  });
  it('reset com token expirado falha', async () => {
    await accountStudent(ctx.users);
    await ctx.requestReset.execute({ email: 'ana@prumo.com.br' });
    const payload = ctx.events.emitidos[0].payload as {
      tokenRaw: string;
    };
    ctx.clock.avanhar(31 * 60000);
    await expect(
      ctx.restore.execute({
        token: payload.tokenRaw,
        newPassword: 'newPassword123',
      }),
    ).rejects.toBeInstanceOf(InvalidCredentialsError);
  });
  it('reset nao aceita token ja usado', async () => {
    await accountStudent(ctx.users);
    await ctx.requestReset.execute({ email: 'ana@prumo.com.br' });
    const payload = ctx.events.emitidos[0].payload as {
      tokenRaw: string;
    };
    await ctx.restore.execute({
      token: payload.tokenRaw,
      newPassword: 'newPassword123',
    });
    await expect(
      ctx.restore.execute({
        token: payload.tokenRaw,
        newPassword: 'otherPassword123',
      }),
    ).rejects.toBeInstanceOf(InvalidCredentialsError);
  });
});
