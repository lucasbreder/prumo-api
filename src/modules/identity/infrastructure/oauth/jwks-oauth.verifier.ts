import {
  Injectable,
  Inject,
  Logger,
  ServiceUnavailableException,
} from '@nestjs/common';
import { createRemoteJWKSet, jwtVerify, type JWTPayload } from 'jose';
import { ENV_TOKEN } from '../../../../shared/config/env.js';
import type { AppEnv } from '../../../../shared/config/env.js';
import {
  OAuthIdentity,
  OAuthVerifier,
} from '../../application/ports/ports.js';
import { InvalidCredentialsError } from '../../../../shared/errors/domain.errors.js';

const GOOGLE_JWKS = createRemoteJWKSet(
  new URL('https://www.googleapis.com/oauth2/v3/certs'),
);
const APPLE_JWKS = createRemoteJWKSet(
  new URL('https://appleid.apple.com/auth/keys'),
);

function emailVerificado(payload: JWTPayload): boolean {
  const v = (payload as { email_verified?: boolean | string }).email_verified;
  return v === true || v === 'true';
}

@Injectable()
export class JwksOAuthVerifier implements OAuthVerifier {
  private readonly logger = new Logger(JwksOAuthVerifier.name);
  constructor(
    @Inject(ENV_TOKEN)
    private readonly env: AppEnv,
  ) {}

  async verifyGoogle(idToken: string): Promise<OAuthIdentity> {
    const audience = this.env.GOOGLE_CLIENT_ID;
    if (!audience) throw this.naoConfigurado('Google');
    const payload = await this.verificar(
      idToken,
      GOOGLE_JWKS,
      ['https://accounts.google.com', 'accounts.google.com'],
      audience,
    );
    return {
      provider: 'GOOGLE',
      providerId: this.exigir(payload, 'sub'),
      email: this.exigir(payload, 'email'),
      emailVerified: emailVerificado(payload),
      name:
        typeof payload.name === 'string' ? payload.name : null,
    };
  }

  async verifyApple(idToken: string): Promise<OAuthIdentity> {
    const audience = this.env.APPLE_CLIENT_ID;
    if (!audience) throw this.naoConfigurado('Apple');
    const payload = await this.verificar(
      idToken,
      APPLE_JWKS,
      'https://appleid.apple.com',
      audience,
    );
    return {
      provider: 'APPLE',
      providerId: this.exigir(payload, 'sub'),
      email: this.exigir(payload, 'email'),
      emailVerified: emailVerificado(payload),
      name: null, // Apple só entrega o nome no primeiro consentimento (via client).
    };
  }

  private async verificar(
    idToken: string,
    keys: ReturnType<typeof createRemoteJWKSet>,
    issuer: string | string[],
    audience: string,
  ): Promise<JWTPayload> {
    try {
      const { payload } = await jwtVerify(idToken, keys, {
        issuer,
        audience,
        algorithms: ['RS256'],
      });
      return payload;
    } catch (e) {
      this.logger.warn(
        `ID token OAuth rejeitado: ${(e as Error).message}`,
      );
      throw new InvalidCredentialsError('Token de provedor invalido');
    }
  }

  private exigir(payload: JWTPayload, campo: string): string {
    const valor = payload[campo];
    if (typeof valor !== 'string' || !valor) {
      throw new InvalidCredentialsError('Token sem claim obrigatoria');
    }
    return valor;
  }

  private naoConfigurado(provedor: string): ServiceUnavailableException {
    return new ServiceUnavailableException(
      `Login com ${provedor} nao esta configurado`,
    );
  }
}
