import { User } from '../../domain/entities/user.entity.js';
export interface UserView {
  id: string;
  name: string;
  email: string;
  role: string;
  bio: string | null;
  avatarUrl: string | null;
  active: boolean;
  lastAccessAt: string | null;
}
export function userForView(
  user: User,
  avatarUrl: string | null = null,
): UserView {
  return {
    id: user.id,
    name: user.name,
    email: user.email.value,
    role: user.role,
    bio: user.bio,
    avatarUrl,
    active: user.active,
    lastAccessAt: user.lastAccessAt?.toISOString() ?? null,
  };
}
