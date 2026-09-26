import {
  CanActivate,
  ExecutionContext,
  Inject,
  Injectable,
  UnauthorizedException,
} from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { JwtService } from '@nestjs/jwt';
import { Request } from 'express';
import { IS_PUBLIC_KEY } from './decorators/public.decorator.js';
import type { AuthUser } from './auth-user.types.js';
import { ROLES } from '../domain/role.js';
import type { Role } from '../domain/role.js';
import { ENV_TOKEN } from '../config/env.js';
import type { AppEnv } from '../config/env.js';
interface AccessPayload {
  sub: string;
  role: string;
  jti: string;
}
@Injectable()
export class JwtAuthGuard implements CanActivate {
  constructor(
    private readonly reflector: Reflector,
    private readonly jwt: JwtService,
    @Inject(ENV_TOKEN)
    private readonly env: AppEnv,
  ) {}
  async canActivate(context: ExecutionContext): Promise<boolean> {
    const isPublic = this.reflector.getAllAndOverride<boolean>(IS_PUBLIC_KEY, [
      context.getHandler(),
      context.getClass(),
    ]);
    if (isPublic) return true;
    const request = context.switchToHttp().getRequest<
      Request & {
        user?: AuthUser;
      }
    >();
    const token = this.extractBearer(request);
    if (!token) {
      throw new UnauthorizedException('Token de acesso ausente');
    }
    let payload: AccessPayload;
    try {
      payload = await this.jwt.verifyAsync<AccessPayload>(token, {
        secret: this.env.JWT_ACCESS_SECRET,
        algorithms: ['HS256'],
        issuer: 'prumo',
        audience: 'prumo-api',
      });
    } catch {
      throw new UnauthorizedException('Token de acesso invalido ou expirado');
    }
    if (!ROLES.includes(payload.role as Role)) {
      throw new UnauthorizedException('Token com papel invalido');
    }
    request.user = { id: payload.sub, role: payload.role as Role };
    return true;
  }
  private extractBearer(request: Request): string | null {
    const header = request.headers.authorization;
    if (!header?.startsWith('Bearer ')) return null;
    return header.slice('Bearer '.length).trim() || null;
  }
}
