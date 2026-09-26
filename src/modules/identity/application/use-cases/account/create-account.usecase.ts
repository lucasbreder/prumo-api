import { randomUUID } from 'node:crypto';
import { User } from '../../../domain/entities/user.entity.js';
import { Email } from '../../../../../shared/domain/email.vo.js';
import { Password } from '../../../domain/value-objects/password.vo.js';
import {
  UserReader,
  UserWriter,
} from '../../../domain/repositories/user.repository.js';
import { PasswordHasher } from '../../ports/ports.js';
import { PublicadorEvents, IdentityEvents } from '../../../domain/events.js';
import { ConflictError } from '../../../../../shared/errors/domain.errors.js';
import { Role } from '../../../../../shared/domain/role.js';
export interface CreateAccountDeps {
  users: UserReader & UserWriter;
  hasher: PasswordHasher;
  events: PublicadorEvents;
}
export class CreateAccountUseCase {
  constructor(
    private readonly deps: CreateAccountDeps,
    private readonly roleDefault: Role = 'STUDENT',
  ) {}
  async execute(input: {
    name: string;
    email: string;
    password: string;
    role?: Role;
  }): Promise<User> {
    const email = Email.from(input.email);
    const password = Password.fromRaw(input.password);
    const existing = await this.deps.users.byEmail(email.value);
    if (existing) {
      throw new ConflictError('Ja existe uma conta com este e-mail');
    }
    const user = User.create({
      id: randomUUID(),
      name: input.name,
      email,
      passwordHash: await this.deps.hasher.hash(password.raw),
      role: input.role ?? this.roleDefault,
    });
    await this.deps.users.create(user);
    this.deps.events.issue(IdentityEvents.ACCOUNT_CREATED, {
      userId: user.id,
      email: user.email.value,
    });
    return user;
  }
}
