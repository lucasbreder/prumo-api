import { SessionRefresh } from '../entities/refresh-session.entity.js';
export const SESSION_REFRESH_REPOSITORY = 'SESSION_REFRESH_REPOSITORY' as const;
export interface SessionRefreshRepository {
  create(session: SessionRefresh): Promise<void>;
  byTokenHash(tokenHash: string): Promise<SessionRefresh | null>;
  revoke(id: string, em: Date): Promise<void>;
  revokeFamily(familyId: string, em: Date): Promise<void>;
  revokeTodasDoUser(userId: string, em: Date): Promise<void>;
}
export const PASSWORD_RESET_REPOSITORY = 'PASSWORD_RESET_REPOSITORY' as const;
export interface PasswordResetToken {
  id: string;
  userId: string;
  tokenHash: string;
  expiresAt: Date;
  usedAt: Date | null;
}
export interface PasswordResetRepository {
  create(token: PasswordResetToken): Promise<void>;
  byTokenHash(tokenHash: string): Promise<PasswordResetToken | null>;
  markUsado(id: string, em: Date): Promise<void>;
}
