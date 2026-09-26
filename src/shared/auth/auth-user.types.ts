import { Role } from '../domain/role.js';
export interface AuthUser {
  id: string;
  role: Role;
}
