import { Body, Controller, HttpCode, Post } from '@nestjs/common';
import { Roles } from '../../../shared/auth/decorators/roles.decorator.js';
import { CurrentUser } from '../../../shared/auth/decorators/current-user.decorator.js';
import type { AuthUser } from '../../../shared/auth/auth-user.types.js';
import { PresignUploadUseCase } from '../application/use-cases/team.usecases.js';
import { PresignUploadInput } from './dtos.js';
@Controller('uploads')
@Roles('MENTOR', 'ADMIN')
export class UploadsController {
  constructor(private readonly presign: PresignUploadUseCase) {}
  @Post('presign')
  @HttpCode(201)
  async presignUpload(
    @CurrentUser()
    user: AuthUser,
    @Body()
    input: PresignUploadInput,
  ) {
    return this.presign.execute({ userId: user.id, ...input });
  }
}
