import { Body, Controller, Get, HttpCode, Inject, Patch, Post } from '@nestjs/common';
import { CurrentUser } from '../../../../shared/auth/decorators/current-user.decorator.js';
import type { AuthUser } from '../../../../shared/auth/auth-user.types.js';
import { IsBoolean, IsOptional } from 'class-validator';
import { AVATAR_STORAGE } from '../../application/ports/ports.js';
import type { AvatarStoragePort } from '../../application/ports/ports.js';
class NotificationsInput {
  @IsOptional()
  @IsBoolean()
  lives?: boolean;
  @IsOptional()
  @IsBoolean()
  community?: boolean;
  @IsOptional()
  @IsBoolean()
  summary?: boolean;
}
import {
  AvatarPresignInput,
  ChangePasswordInput,
  UpdateAccountInput,
} from '../dtos/auth.inputs.js';
import { userForView } from '../views/user.view.js';
import {
  ChangePasswordUseCase,
  PresignAvatarUseCase,
  UpdateAccountUseCase,
  UpdateNotificationsUseCase,
  GetAccountUseCase,
  GetNotificationsUseCase,
} from '../../application/use-cases/account/account.usecases.js';
@Controller('account')
export class AccountController {
  constructor(
    private readonly get: GetAccountUseCase,
    private readonly update: UpdateAccountUseCase,
    private readonly changePassword: ChangePasswordUseCase,
    private readonly getNotif: GetNotificationsUseCase,
    private readonly updateNotif: UpdateNotificationsUseCase,
    private readonly presignAvatar: PresignAvatarUseCase,
    @Inject(AVATAR_STORAGE)
    private readonly storage: AvatarStoragePort,
  ) {}
  private async view(user: Awaited<ReturnType<GetAccountUseCase['execute']>>) {
    const avatarUrl = user.avatarKey
      ? await this.storage.resolvePublicUrl(user.avatarKey)
      : null;
    return { user: userForView(user, avatarUrl) };
  }
  @Get()
  async me(
    @CurrentUser()
    user: AuthUser,
  ) {
    const account = await this.get.execute({ userId: user.id });
    return this.view(account);
  }
  @Patch()
  async patch(
    @CurrentUser()
    user: AuthUser,
    @Body()
    input: UpdateAccountInput,
  ) {
    const updated = await this.update.execute({
      userId: user.id,
      ...input,
    });
    return this.view(updated);
  }
  @Post('avatar')
  @HttpCode(201)
  async avatar(
    @CurrentUser()
    user: AuthUser,
    @Body()
    input: AvatarPresignInput,
  ) {
    return this.presignAvatar.execute({
      userId: user.id,
      nomeArquivo: input.nameArquivo,
      contentType: input.contentType,
      sizeBytes: input.sizeBytes,
    });
  }
  @Post('password')
  @HttpCode(200)
  async password(
    @CurrentUser()
    user: AuthUser,
    @Body()
    input: ChangePasswordInput,
  ) {
    return this.changePassword.execute({ userId: user.id, ...input });
  }
  @Get('notifications')
  async notifGet(
    @CurrentUser()
    user: AuthUser,
  ) {
    return this.getNotif.execute({ userId: user.id });
  }
  @Patch('notifications')
  async notifPatch(
    @CurrentUser()
    user: AuthUser,
    @Body()
    input: NotificationsInput,
  ) {
    return this.updateNotif.execute({ userId: user.id, notifications: input });
  }
}
