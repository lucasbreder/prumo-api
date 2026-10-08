import { Body, Controller, HttpCode, Post } from '@nestjs/common';
import { Roles } from '../../../shared/auth/decorators/roles.decorator.js';
import { CurrentUser } from '../../../shared/auth/decorators/current-user.decorator.js';
import type { AuthUser } from '../../../shared/auth/auth-user.types.js';
import {
  AbortMultipartUploadUseCase,
  CompleteMultipartUploadUseCase,
  InitiateMultipartUploadUseCase,
  PresignUploadUseCase,
} from '../application/use-cases/team.usecases.js';
import {
  CompleteMultipartInput,
  InitiateMultipartInput,
  PresignUploadInput,
} from './dtos.js';
@Controller('uploads')
@Roles('MENTOR', 'ADMIN')
export class UploadsController {
  constructor(
    private readonly presign: PresignUploadUseCase,
    private readonly iniciarMultipart: InitiateMultipartUploadUseCase,
    private readonly concluirMultipart: CompleteMultipartUploadUseCase,
    private readonly abortarMultipart: AbortMultipartUploadUseCase,
  ) {}
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
  // Multipart: necessário para arquivos acima de 5 GB (limite de um PUT no S3).
  @Post('multipart')
  @HttpCode(201)
  async multipart(
    @CurrentUser()
    user: AuthUser,
    @Body()
    input: InitiateMultipartInput,
  ) {
    return this.iniciarMultipart.execute({ userId: user.id, ...input });
  }
  @Post('multipart/complete')
  @HttpCode(200)
  async completeMultipart(
    @Body()
    input: CompleteMultipartInput,
  ) {
    return this.concluirMultipart.execute(input);
  }
  @Post('multipart/abort')
  @HttpCode(200)
  async abortMultipart(
    @Body()
    input: { chave: string; uploadId: string },
  ) {
    return this.abortarMultipart.execute(input);
  }
}
