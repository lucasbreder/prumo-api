import { describe, expect, it } from 'vitest';
import { randomUUID } from 'node:crypto';
import { User } from '../../../domain/entities/user.entity.js';
import { SessionRefresh } from '../../../domain/entities/refresh-session.entity.js';
import { Email } from '../../../../../shared/domain/email.vo.js';
import {
  FakeHasher,
  FakeClock,
  FakeSessionRepo,
  FakeUserRepo,
} from '../../fakes/in-memory.fakes.js';
import {
  ChangePasswordUseCase,
  PresignAvatarUseCase,
  UpdateAccountUseCase,
  DefinirRoleUseCase,
} from './account.usecases.js';
import type {
  AvatarStoragePort,
  AvatarUpload,
} from '../../ports/ports.js';
class FakeAvatarStorage implements AvatarStoragePort {
  async presignUpload(input: {
    userId: string;
    nomeArquivo: string;
    contentType: string;
    sizeBytes: number;
  }): Promise<AvatarUpload> {
    const ext = input.contentType.split('/')[1] ?? 'bin';
    return {
      chave: `avatars/${input.userId}/fake-${Date.now()}.${ext}`,
      uploadUrl: 'https://s3.test/upload',
      previewUrl: 'https://s3.test/preview',
      expiraEm: new Date().toISOString(),
    };
  }
  async resolvePublicUrl(v: string): Promise<string | null> {
    return v ? `https://s3.test/${v}` : null;
  }
}
function deps() {
  const users = new FakeUserRepo();
  const sessions = new FakeSessionRepo();
  const hasher = new FakeHasher();
  const clock = new FakeClock();
  return { users, sessions, d: { users, sessions, hasher, clock } };
}
async function student(users: FakeUserRepo, password = 'senha12345') {
  const u = User.create({
    id: randomUUID(),
    name: 'Carla',
    email: Email.from('carla@x.com'),
    passwordHash: await new FakeHasher().hash(password),
  });
  users.add(u);
  return u;
}
describe('Conta (perfil e seguranca)', () => {
  it('recusa alteracao com senha atual errada', async () => {
    const { users, d } = deps();
    const u = await student(users);
    const usecase = new ChangePasswordUseCase(d);
    await expect(
      usecase.execute({
        userId: u.id,
        passwordCurrent: 'errada123',
        newPassword: 'nova12345',
      }),
    ).rejects.toThrow(/Senha atual/);
  });
  it('altera senha e derruba todas as sessoes', async () => {
    const { users, sessions, d } = deps();
    const u = await student(users);
    sessions.sessions.push(
      SessionRefresh.issue({
        id: 's1',
        userId: u.id,
        tokenHash: 'h1',
        familyId: 'f1',
        expiresAt: new Date(Date.now() + 9999999),
      }),
    );
    await new ChangePasswordUseCase(d).execute({
      userId: u.id,
      passwordCurrent: 'senha12345',
      newPassword: 'nova12345',
    });
    expect(u.passwordHash).toBe('hash:nova12345');
    expect(sessions.sessions[0].jaRevogada).toBe(true);
  });
  it('rejeita senha fraca na alteracao', async () => {
    const { users, d } = deps();
    const u = await student(users);
    await expect(
      new ChangePasswordUseCase(d).execute({
        userId: u.id,
        passwordCurrent: 'senha12345',
        newPassword: 'abc',
      }),
    ).rejects.toThrow(/no minimo 8/);
  });
  it('atualiza nome do perfil', async () => {
    const { users, d } = deps();
    const u = await student(users);
    await new UpdateAccountUseCase(d).execute({
      userId: u.id,
      name: ' Carla C. ',
    });
    expect(u.name).toBe('Carla C.');
  });
  it('atualiza bio do perfil', async () => {
    const { users, d } = deps();
    const u = await student(users);
    await new UpdateAccountUseCase(d).execute({
      userId: u.id,
      name: 'Carla C.',
      bio: '  Arquiteta e urbanista.  ',
    });
    expect(u.bio).toBe('Arquiteta e urbanista.');
  });
  it('guarda avatarKey do proprio usuario', async () => {
    const { users, d } = deps();
    const u = await student(users);
    await new UpdateAccountUseCase(d).execute({
      userId: u.id,
      avatarKey: `avatars/${u.id}/abc.webp`,
    });
    expect(u.avatarKey).toBe(`avatars/${u.id}/abc.webp`);
  });
  it('recusa avatarKey de outro usuario', async () => {
    const { users, d } = deps();
    const u = await student(users);
    await expect(
      new UpdateAccountUseCase(d).execute({
        userId: u.id,
        avatarKey: 'avatars/outro/abc.webp',
      }),
    ).rejects.toThrow(/invalida/);
    expect(u.avatarKey).toBeNull();
  });
  it('limpa avatarKey com null', async () => {
    const { users, d } = deps();
    const u = await student(users);
    const usecase = new UpdateAccountUseCase(d);
    await usecase.execute({ userId: u.id, avatarKey: `avatars/${u.id}/x.webp` });
    await usecase.execute({ userId: u.id, avatarKey: null });
    expect(u.avatarKey).toBeNull();
  });
  it('presign de avatar valida tipo e tamanho', async () => {
    const storage = new FakeAvatarStorage();
    const usecase = new PresignAvatarUseCase({ storage });
    await expect(
      usecase.execute({
        userId: 'u1',
        nomeArquivo: 'foto.gif',
        contentType: 'image/gif',
        sizeBytes: 1000,
      }),
    ).rejects.toThrow(/JPG|WEBP/);
    await expect(
      usecase.execute({
        userId: 'u1',
        nomeArquivo: 'foto.webp',
        contentType: 'image/webp',
        sizeBytes: 6 * 1024 * 1024,
      }),
    ).rejects.toThrow(/muito grande/);
    const r = await usecase.execute({
      userId: 'u1',
      nomeArquivo: 'foto.webp',
      contentType: 'image/webp',
      sizeBytes: 200000,
    });
    expect(r.chave).toMatch(/^avatars\/u1\/.+\.webp$/);
  });
  it('admin pausa aluno e revoga sessoes', async () => {
    const { users, sessions, d } = deps();
    const u = await student(users);
    sessions.sessions.push(
      SessionRefresh.issue({
        id: 's2',
        userId: u.id,
        tokenHash: 'h',
        familyId: 'f',
        expiresAt: new Date(Date.now() + 9999999),
      }),
    );
    await new DefinirRoleUseCase(d).execute({ userId: u.id, active: false });
    expect(u.active).toBe(false);
    expect(sessions.sessions[0].jaRevogada).toBe(true);
  });
  it('admin promove mentor', async () => {
    const { users, d } = deps();
    const u = await student(users);
    await new DefinirRoleUseCase(d).execute({
      userId: u.id,
      role: 'MENTOR',
    });
    expect(u.role).toBe('MENTOR');
  });
});
