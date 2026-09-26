import { Inject, Injectable } from '@nestjs/common';
import {
  USER_READER,
  USER_WRITER,
} from '../../../identity/domain/repositories/user.repository.js';
import type {
  UserReader,
  UserWriter,
} from '../../../identity/domain/repositories/user.repository.js';
import { NotFoundError } from '../../../../shared/errors/domain.errors.js';
import type { BanUser } from '../../application/use-cases/community.usecases.js';
@Injectable()
export class IdentityBanUser implements BanUser {
  constructor(
    @Inject(USER_READER)
    private readonly reader: UserReader,
    @Inject(USER_WRITER)
    private readonly writer: UserWriter,
  ) {}
  async ban(userId: string): Promise<void> {
    const user = await this.reader.byId(userId);
    if (!user) throw new NotFoundError('Usuario da denuncia nao encontrado');
    user.definirActive(false);
    await this.writer.save(user);
  }
}
