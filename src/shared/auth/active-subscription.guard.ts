import {
  CanActivate,
  ExecutionContext,
  ForbiddenException,
  Inject,
  Injectable,
} from '@nestjs/common';
import { Request } from 'express';
import type { AuthUser } from '../auth/auth-user.types.js';
import { ACCESS_GATE } from '../../modules/courses/domain/access-gate.js';
import type { AccessGate } from '../../modules/courses/domain/access-gate.js';
@Injectable()
export class ActiveSubscriptionGuard implements CanActivate {
  constructor(
    @Inject(ACCESS_GATE)
    private readonly gate: AccessGate,
  ) {}
  async canActivate(context: ExecutionContext): Promise<boolean> {
    const user = context.switchToHttp().getRequest<
      Request & {
        user?: AuthUser;
      }
    >().user;
    if (!user) throw new ForbiddenException();
    if (user.role === 'STUDENT') {
      await this.gate.garantirAccessStudent(user.id);
    }
    return true;
  }
}
