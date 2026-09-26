import { Injectable } from '@nestjs/common';
import { AccessGate } from '../../../courses/domain/access-gate.js';
import { AccessDeniedError } from '../../../../shared/errors/domain.errors.js';
import { PrismaService } from '../../../../shared/database/prisma.service.js';
@Injectable()
export class SubscriptionAccessGate implements AccessGate {
  constructor(private readonly prisma: PrismaService) {}
  async garantirAccessStudent(userId: string): Promise<void> {
    const user = await this.prisma.user.findUnique({
      where: { id: userId },
      select: {
        active: true,
        subscription: { select: { status: true, currentPeriodEnd: true } },
      },
    });
    if (!user || !user.active) {
      throw new AccessDeniedError('Conta sem acesso ao painel');
    }
    const s = user.subscription;
    const tem =
      s?.status === 'ACTIVE' ||
      (s?.status === 'CANCELED' &&
        s.currentPeriodEnd !== null &&
        s.currentPeriodEnd.getTime() > Date.now());
    if (!tem) {
      throw new AccessDeniedError(
        'Assinatura ativa necessaria — escolha um plano para continuar',
      );
    }
  }
}
