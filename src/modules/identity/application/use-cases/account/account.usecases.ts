import {
  UserReader,
  UserWriter,
} from '../../../domain/repositories/user.repository.js';
import { SessionRefreshRepository } from '../../../domain/repositories/session.repository.js';
import { PasswordHasher, Clock } from '../../ports/ports.js';
import { Password } from '../../../domain/value-objects/password.vo.js';
import {
  InvalidCredentialsError,
  NotFoundError,
  BusinessRuleError,
} from '../../../../../shared/errors/domain.errors.js';
import { Role } from '../../../../../shared/domain/role.js';
import type { AvatarStoragePort } from '../../ports/ports.js';
const MAX_AVATAR_BYTES = 5 * 1024 * 1024;
const TIPOS_AVATAR_PERMITIDOS = new Set([
  'image/jpeg',
  'image/png',
  'image/webp',
  'image/avif',
]);
export interface AccountDeps {
  users: UserReader & UserWriter;
  sessions: SessionRefreshRepository;
  hasher: PasswordHasher;
  clock: Clock;
}
export class GetAccountUseCase {
  constructor(private readonly deps: AccountDeps) {}
  async execute(input: {
    userId: string;
  }): Promise<import('../../../domain/entities/user.entity.js').User> {
    const user = await this.deps.users.byId(input.userId);
    if (!user) throw new NotFoundError('Conta nao encontrada');
    return user;
  }
}
export class UpdateAccountUseCase {
  constructor(private readonly deps: AccountDeps) {}
  async execute(input: {
    userId: string;
    name?: string;
    bio?: string;
    avatarKey?: string | null;
  }): Promise<import('../../../domain/entities/user.entity.js').User> {
    const user = await this.deps.users.byId(input.userId);
    if (!user) throw new NotFoundError('Conta nao encontrada');
    user.updateProfile(input.name, input.bio);
    if (input.avatarKey !== undefined) {
      if (input.avatarKey !== null && !input.avatarKey.startsWith(`avatars/${input.userId}/`)) {
        throw new BusinessRuleError('Chave de imagem de perfil invalida');
      }
      user.setAvatarKey(input.avatarKey);
    }
    await this.deps.users.save(user);
    return user;
  }
}
export class PresignAvatarUseCase {
  constructor(private readonly deps: { storage: AvatarStoragePort }) {}
  async execute(input: {
    userId: string;
    nomeArquivo: string;
    contentType: string;
    sizeBytes: number;
  }) {
    if (!Number.isInteger(input.sizeBytes) || input.sizeBytes <= 0) {
      throw new BusinessRuleError('Tamanho de arquivo invalido');
    }
    if (input.sizeBytes > MAX_AVATAR_BYTES) {
      throw new BusinessRuleError('Imagem muito grande (max 5 MB)');
    }
    if (!TIPOS_AVATAR_PERMITIDOS.has(input.contentType)) {
      throw new BusinessRuleError('Use JPG, PNG, WEBP ou AVIF');
    }
    return this.deps.storage.presignUpload(input);
  }
}
export class ChangePasswordUseCase {
  constructor(private readonly deps: AccountDeps) {}
  async execute(input: {
    userId: string;
    passwordCurrent: string;
    newPassword: string;
  }): Promise<{
    updated: true;
  }> {
    const user = await this.deps.users.byId(input.userId);
    if (!user) throw new NotFoundError('Conta nao encontrada');
    if (!user.passwordHash) {
      throw new InvalidCredentialsError(
        'Conta criada com login social — use a recuperacao de senha para definir uma senha',
      );
    }
    const currentOk = await this.deps.hasher.comparar(
      input.passwordCurrent,
      user.passwordHash,
    );
    if (!currentOk) {
      throw new InvalidCredentialsError('Senha atual incorreta');
    }
    const nova = Password.fromRaw(input.newPassword);
    user.trocarPassword(await this.deps.hasher.hash(nova.raw));
    await this.deps.users.save(user);
    await this.deps.sessions.revokeTodasDoUser(user.id, this.deps.clock.now());
    return { updated: true };
  }
}
export class GetNotificationsUseCase {
  constructor(private readonly deps: AccountDeps) {}
  async execute(input: { userId: string }) {
    const user = await this.deps.users.byId(input.userId);
    if (!user) throw new NotFoundError('Conta nao encontrada');
    return { notifications: user.notifications };
  }
}
export class UpdateNotificationsUseCase {
  constructor(private readonly deps: AccountDeps) {}
  async execute(input: {
    userId: string;
    notifications: Partial<{
      lives: boolean;
      community: boolean;
      summary: boolean;
    }>;
  }) {
    const user = await this.deps.users.byId(input.userId);
    if (!user) throw new NotFoundError('Conta nao encontrada');
    user.updateNotifications(input.notifications);
    await this.deps.users.save(user);
    return { notifications: user.notifications };
  }
}
export class DefinirRoleUseCase {
  constructor(private readonly deps: AccountDeps) {}
  async execute(input: {
    userId: string;
    role?: Role;
    active?: boolean;
  }): Promise<import('../../../domain/entities/user.entity.js').User> {
    const user = await this.deps.users.byId(input.userId);
    if (!user) throw new NotFoundError('Conta nao encontrada');
    if (input.role) user.definirRole(input.role);
    if (input.active !== undefined) user.definirActive(input.active);
    await this.deps.users.save(user);
    if (input.active === false) {
      await this.deps.sessions.revokeTodasDoUser(
        user.id,
        this.deps.clock.now(),
      );
    }
    return user;
  }
}
