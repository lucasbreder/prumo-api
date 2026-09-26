import { Injectable, Logger } from '@nestjs/common';
import { OnEvent } from '@nestjs/event-emitter';
import { IdentityEvents } from '../../domain/events.js';
/**
 * Placeholder do envio de e-mails (fase 1 records; SMTP pluga aqui).
 * Assinantes de events de dominio, never efeitos colaterais inline nos use cases.
 */
@Injectable()
export class NotificationIdentidadeListener {
  private readonly logger = new Logger('IdentityNotification');
  @OnEvent(IdentityEvents.RESET_REQUESTED, { async: true })
  handleResetSolicitado(payload: { email: string; tokenRaw: string }): void {
    this.logger.log(
      `Reset de senha solicitado para ${payload.email} (link: /reset?token=${payload.tokenRaw})`,
    );
  }
  @OnEvent(IdentityEvents.ACCOUNT_CREATED, { async: true })
  handleAccountCreated(payload: { email: string }): void {
    this.logger.log(`Boas-vindas -> ${payload.email}`);
  }
}
