export const PASSWORD_HASHER = 'PASSWORD_HASHER' as const;
export interface PasswordHasher {
  hash(password: string): Promise<string>;
  comparar(password: string, hash: string): Promise<boolean>;
}
export const TOKEN_GENERATOR = 'TOKEN_GENERATOR' as const;
export interface TokenGerado {
  raw: string;
  hash: string;
}
export interface GeradorToken {
  generate(): TokenGerado;
  hash(raw: string): string;
}
export { Clock } from '../../../../shared/domain/clock.js';
export const ACCESS_TOKEN_ISSUER = 'ACCESS_TOKEN_ISSUER' as const;
export interface EmissorAccessToken {
  issue(user: { id: string; role: string }): string;
}
export const OAUTH_VERIFIER = 'OAUTH_VERIFIER' as const;
export interface OAuthIdentity {
  provider: 'GOOGLE' | 'APPLE';
  providerId: string;
  email: string;
  emailVerified: boolean;
  name: string | null;
}
export interface OAuthVerifier {
  verifyGoogle(idToken: string): Promise<OAuthIdentity>;
  verifyApple(idToken: string): Promise<OAuthIdentity>;
}
export const AVATAR_STORAGE = 'AVATAR_STORAGE' as const;
export interface AvatarUpload {
  chave: string;
  uploadUrl: string;
  previewUrl: string;
  expiraEm: string;
}
export interface AvatarStoragePort {
  presignUpload(input: {
    userId: string;
    nomeArquivo: string;
    contentType: string;
    sizeBytes: number;
  }): Promise<AvatarUpload>;
  resolvePublicUrl(valor: string): Promise<string | null>;
}
