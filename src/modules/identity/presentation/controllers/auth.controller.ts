import {
  Body,
  Controller,
  HttpCode,
  Inject,
  Post,
  Req,
  Res,
  UnauthorizedException,
} from '@nestjs/common';
import type { Request, Response } from 'express';
import { Public } from '../../../../shared/auth/decorators/public.decorator.js';
import { ENV_TOKEN } from '../../../../shared/config/env.js';
import type { AppEnv } from '../../../../shared/config/env.js';
import { AuthenticateUseCase } from '../../application/use-cases/auth/authenticate.usecase.js';
import { AuthenticateWithOAuthUseCase } from '../../application/use-cases/auth/authenticate-oauth.usecase.js';
import { RenewSessionUseCase } from '../../application/use-cases/auth/renew-session.usecase.js';
import { EndSessionUseCase } from '../../application/use-cases/auth/end-session.usecase.js';
import { RequestResetPasswordUseCase } from '../../application/use-cases/account/request-password-reset.usecase.js';
import { RestorePasswordUseCase } from '../../application/use-cases/account/restore-password.usecase.js';
import { CreateAccountUseCase } from '../../application/use-cases/account/create-account.usecase.js';
import { userForView } from '../views/user.view.js';
import {
  ForgotPasswordInput,
  LoginInput,
  OAuthLoginInput,
  RefreshInput,
  RegisterInput,
  ResetPasswordInput,
} from '../dtos/auth.inputs.js';
export const REFRESH_COOKIE = 'prumo_rt';
@Controller('auth')
@Public()
export class AuthController {
  constructor(
    @Inject(ENV_TOKEN)
    private readonly env: AppEnv,
    private readonly authenticate: AuthenticateUseCase,
    private readonly authenticateOAuth: AuthenticateWithOAuthUseCase,
    private readonly renew: RenewSessionUseCase,
    private readonly end: EndSessionUseCase,
    private readonly requestReset: RequestResetPasswordUseCase,
    private readonly restore: RestorePasswordUseCase,
    private readonly createAccount: CreateAccountUseCase,
  ) {}
  @Post('login')
  @HttpCode(200)
  async login(
    @Body()
    input: LoginInput,
    @Req()
    req: Request,
    @Res({ passthrough: true })
    res: Response,
  ) {
    const output = await this.authenticate.execute(input);
    this.definirCookie(res, output.refreshToken);
    // Clientes nativos (app) declaram X-Client: native e recebem o refresh no body;
    // web receives only via cookie HttpOnly.
    const nativo = req.headers['x-client'] === 'native';
    return {
      accessToken: output.accessToken,
      user: output.user,
      ...(nativo ? { refreshToken: output.refreshToken } : {}),
    };
  }
  @Post('oauth')
  @HttpCode(200)
  async oauth(
    @Body()
    input: OAuthLoginInput,
    @Req()
    req: Request,
    @Res({ passthrough: true })
    res: Response,
  ) {
    const output = await this.authenticateOAuth.execute({
      provider: input.provider,
      idToken: input.idToken,
      deviceId: input.deviceId,
    });
    this.definirCookie(res, output.refreshToken);
    const nativo = req.headers['x-client'] === 'native';
    return {
      accessToken: output.accessToken,
      user: output.user,
      ...(nativo ? { refreshToken: output.refreshToken } : {}),
    };
  }
  @Post('refresh')
  @HttpCode(200)
  async refresh(
    @Req()
    req: Request,
    @Body()
    input: RefreshInput,
    @Res({ passthrough: true })
    res: Response,
  ) {
    const viaBody = Boolean(input.refreshToken);
    const refreshToken =
      input.refreshToken ??
      (req.cookies?.[REFRESH_COOKIE] as string | undefined);
    if (!refreshToken) {
      throw new UnauthorizedException('Refresh token ausente');
    }
    const output = await this.renew.execute({ refreshToken });
    this.definirCookie(res, output.refreshToken);
    return {
      accessToken: output.accessToken,
      user: output.user,
      ...(viaBody ? { refreshToken: output.refreshToken } : {}),
    };
  }
  @Post('logout')
  @HttpCode(204)
  async logout(
    @Req()
    req: Request,
    @Body()
    input: RefreshInput,
    @Res({ passthrough: true })
    res: Response,
  ): Promise<void> {
    const refreshToken =
      input.refreshToken ??
      (req.cookies?.[REFRESH_COOKIE] as string | undefined);
    if (refreshToken) {
      await this.end.execute({ refreshToken });
    }
    res.clearCookie(REFRESH_COOKIE, { path: '/' });
  }
  @Post('register')
  async register(
    @Body()
    input: RegisterInput,
  ) {
    const user = await this.createAccount.execute({
      name: input.name,
      email: input.email,
      password: input.password,
    });
    return { user: userForView(user) };
  }
  @Post('forgot-password')
  @HttpCode(202)
  async forgot(
    @Body()
    input: ForgotPasswordInput,
  ) {
    return this.requestReset.execute(input);
  }
  @Post('reset-password')
  @HttpCode(200)
  async reset(
    @Body()
    input: ResetPasswordInput,
  ) {
    return this.restore.execute(input);
  }
  private definirCookie(res: Response, refreshToken: string): void {
    res.cookie(REFRESH_COOKIE, refreshToken, {
      httpOnly: true,
      sameSite: 'lax',
      secure: this.env.NODE_ENV === 'production',
      path: '/',
      maxAge: this.env.REFRESH_TTL_DAYS * 86400000,
    });
  }
}
