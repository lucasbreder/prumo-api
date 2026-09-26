import { describe, expect, it, beforeEach } from 'vitest';
import { randomUUID } from 'node:crypto';
import { User } from '../../../domain/entities/user.entity.js';
import { Email } from '../../../../../shared/domain/email.vo.js';
import type { OAuthIdentity } from '../../ports/ports.js';
import {
  FakeIssuer,
  FakeTokenGenerator,
  FakePublisher,
  FakeClock,
  FakeSessionRepo,
  FakeUserRepo,
  FakeOAuthVerifier,
} from '../../fakes/in-memory.fakes.js';
import { AuthenticateWithOAuthUseCase } from './authenticate-oauth.usecase.js';
import { InvalidCredentialsError } from '../../../../../shared/errors/domain.errors.js';

const Day = 86400000;

function identidade(
  override: Partial<OAuthIdentity> = {},
): OAuthIdentity {
  return {
    provider: 'GOOGLE',
    providerId: 'google-sub-123',
    email: 'ana@prumo.com.br',
    emailVerified: true,
    name: 'Ana Arquiteta',
    ...override,
  };
}

function monta() {
  const users = new FakeUserRepo();
  const sessions = new FakeSessionRepo();
  const gerador = new FakeTokenGenerator();
  const clock = new FakeClock();
  const emissor = new FakeIssuer();
  const events = new FakePublisher();
  const oauth = new FakeOAuthVerifier();
  const usecase = new AuthenticateWithOAuthUseCase({
    users,
    sessions,
    gerador,
    clock,
    emissor,
    events,
    oauth,
    refreshTtlDays: 30,
  });
  return { users, sessions, events, oauth, clock, usecase };
}

describe('AuthenticateWithOAuthUseCase', () => {
  let ctx: ReturnType<typeof monta>;
  beforeEach(() => {
    ctx = monta();
  });

  it('cria conta de aluno ao primeiro login com Google e emite par de tokens', async () => {
    ctx.oauth.identidadeGoogle = identidade();
    const output = await ctx.usecase.execute({
      provider: 'GOOGLE',
      idToken: 'jwt-google',
    });
    expect(output.user.email).toBe('ana@prumo.com.br');
    expect(output.user.role).toBe('STUDENT');
    expect(output.accessToken).toMatch(/^jwt\./);
    expect(output.refreshToken).toMatch(/^raw-/);
    const criado = await ctx.users.byEmail('ana@prumo.com.br');
    expect(criado).not.toBeNull();
    expect(criado!.googleId).toBe('google-sub-123');
    expect(criado!.hasPassword).toBe(false);
    expect(ctx.sessions.sessions).toHaveLength(1);
    expect(ctx.events.emitidos[0].name).toBe('identity.account_created');
  });

  it('nao exige senha e reaproveita a mesma conta no segundo login', async () => {
    ctx.oauth.identidadeGoogle = identidade();
    const primeiro = await ctx.usecase.execute({
      provider: 'GOOGLE',
      idToken: 'jwt-google',
    });
    await ctx.usecase.execute({ provider: 'GOOGLE', idToken: 'jwt-google' });
    const contas = [...ctx.users.users.values()];
    expect(contas.filter((c) => c.email.value === 'ana@prumo.com.br')).toHaveLength(1);
    expect(ctx.sessions.sessions).toHaveLength(2);
    expect(primeiro.user.id).toBe((await ctx.users.byEmail('ana@prumo.com.br'))!.id);
  });

  it('vincula o provider a uma conta local existente com o mesmo e-mail', async () => {
    const local = User.create({
      id: randomUUID(),
      name: 'Ana Local',
      email: Email.from('ana@prumo.com.br'),
      passwordHash: 'hash-de-senha',
    });
    ctx.users.add(local);
    ctx.oauth.identidadeGoogle = identidade();
    const output = await ctx.usecase.execute({
      provider: 'GOOGLE',
      idToken: 'jwt-google',
    });
    expect(output.user.id).toBe(local.id);
    expect(local.googleId).toBe('google-sub-123');
    expect(ctx.events.emitidos).toHaveLength(0);
  });

  it('cria conta via Apple e registra appleId', async () => {
    ctx.oauth.identidadeApple = identidade({
      provider: 'APPLE',
      providerId: 'apple-sub-999',
      email: 'bruno@prumo.com.br',
      name: 'Bruno',
    });
    const output = await ctx.usecase.execute({
      provider: 'APPLE',
      idToken: 'jwt-apple',
    });
    expect(output.user.email).toBe('bruno@prumo.com.br');
    const criado = await ctx.users.byEmail('bruno@prumo.com.br');
    expect(criado!.appleId).toBe('apple-sub-999');
    expect(criado!.googleId).toBeNull();
  });

  it('usa prefixo do e-mail como nome quando o provedor nao envia nome', async () => {
    ctx.oauth.identidadeGoogle = identidade({ name: null });
    await ctx.usecase.execute({ provider: 'GOOGLE', idToken: 'jwt-google' });
    const criado = await ctx.users.byEmail('ana@prumo.com.br');
    expect(criado!.name).toBe('ana');
  });

  it('recusa e-mail nao verificado pelo provedor', async () => {
    ctx.oauth.identidadeGoogle = identidade({ emailVerified: false });
    await expect(
      ctx.usecase.execute({ provider: 'GOOGLE', idToken: 'jwt-google' }),
    ).rejects.toBeInstanceOf(InvalidCredentialsError);
  });

  it('recusa conta inativa mesmo via OAuth', async () => {
    ctx.oauth.identidadeGoogle = identidade();
    await ctx.usecase.execute({ provider: 'GOOGLE', idToken: 'jwt-google' });
    const criado = await ctx.users.byEmail('ana@prumo.com.br');
    criado!.definirActive(false);
    await expect(
      ctx.usecase.execute({ provider: 'GOOGLE', idToken: 'jwt-google' }),
    ).rejects.toBeInstanceOf(InvalidCredentialsError);
  });

  it('propaga falha de verificacao do token', async () => {
    ctx.oauth.erro = new InvalidCredentialsError('token invalido');
    await expect(
      ctx.usecase.execute({ provider: 'GOOGLE', idToken: 'lixo' }),
    ).rejects.toBeInstanceOf(InvalidCredentialsError);
  });

  it('expira a sessao conforme TTL configurado', async () => {
    ctx.oauth.identidadeGoogle = identidade();
    await ctx.usecase.execute({ provider: 'GOOGLE', idToken: 'jwt-google' });
    expect(ctx.sessions.sessions[0].expiresAt.getTime()).toBe(
      ctx.clock.data.getTime() + 30 * Day,
    );
  });
});
