import { Inject, Injectable } from '@nestjs/common';
import { JwtService, type JwtSignOptions } from '@nestjs/jwt';
import { ENV_TOKEN, type AppEnv } from '../../../../shared/config/env.js';
import { EmissorAccessToken } from '../../application/ports/ports.js';
import { randomUUID } from 'node:crypto';
@Injectable()
export class JwtAccessTokenIssuer implements EmissorAccessToken {
  constructor(
    private readonly jwt: JwtService,
    @Inject(ENV_TOKEN)
    private readonly env: AppEnv,
  ) {}
  issue(user: { id: string; role: string }): string {
    return this.jwt.sign(
      { sub: user.id, role: user.role, jti: randomUUID() },
      {
        algorithm: 'HS256',
        secret: this.env.JWT_ACCESS_SECRET,
        expiresIn: this.env.JWT_ACCESS_TTL as JwtSignOptions['expiresIn'],
        issuer: 'prumo',
        audience: 'prumo-api',
      },
    );
  }
}
