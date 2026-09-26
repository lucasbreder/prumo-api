import { Injectable } from '@nestjs/common';
import { PrismaService } from '../../../../shared/database/prisma.service.js';
import { SessionRefresh } from '../../domain/entities/refresh-session.entity.js';
import {
  PasswordResetRepository,
  PasswordResetToken,
  SessionRefreshRepository,
} from '../../domain/repositories/session.repository.js';
@Injectable()
export class PrismaSessionRefreshRepository implements SessionRefreshRepository {
  constructor(private readonly prisma: PrismaService) {}
  async create(session: SessionRefresh): Promise<void> {
    await this.prisma.refreshToken.create({
      data: {
        id: session.id,
        userId: session.userId,
        tokenHash: session.tokenHash,
        familyId: session.familyId,
        expiresAt: session.expiresAt,
      },
    });
  }
  async byTokenHash(tokenHash: string): Promise<SessionRefresh | null> {
    const row = await this.prisma.refreshToken.findUnique({
      where: { tokenHash },
      select: {
        id: true,
        userId: true,
        tokenHash: true,
        familyId: true,
        deviceId: true,
        expiresAt: true,
        revokedAt: true,
      },
    });
    return row ? SessionRefresh.reconstituir(row) : null;
  }
  async revoke(id: string, em: Date): Promise<void> {
    await this.prisma.refreshToken.updateMany({
      where: { id, revokedAt: null },
      data: { revokedAt: em },
    });
  }
  async revokeFamily(familyId: string, em: Date): Promise<void> {
    await this.prisma.refreshToken.updateMany({
      where: { familyId, revokedAt: null },
      data: { revokedAt: em },
    });
  }
  async revokeTodasDoUser(userId: string, em: Date): Promise<void> {
    await this.prisma.refreshToken.updateMany({
      where: { userId, revokedAt: null },
      data: { revokedAt: em },
    });
  }
}
@Injectable()
export class PrismaPasswordResetRepository implements PasswordResetRepository {
  constructor(private readonly prisma: PrismaService) {}
  async create(token: PasswordResetToken): Promise<void> {
    await this.prisma.passwordResetToken.create({ data: token });
  }
  async byTokenHash(tokenHash: string): Promise<PasswordResetToken | null> {
    return this.prisma.passwordResetToken.findUnique({
      where: { tokenHash },
      select: {
        id: true,
        userId: true,
        tokenHash: true,
        expiresAt: true,
        usedAt: true,
      },
    });
  }
  async markUsado(id: string, em: Date): Promise<void> {
    await this.prisma.passwordResetToken.updateMany({
      where: { id, usedAt: null },
      data: { usedAt: em },
    });
  }
}
