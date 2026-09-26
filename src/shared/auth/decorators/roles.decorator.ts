import { SetMetadata } from '@nestjs/common';
import type { Role } from '../../domain/role.js';
export const ROLES_KEY = 'prumo:roles';
export const Roles = (...roles: Role[]) => SetMetadata(ROLES_KEY, roles);
