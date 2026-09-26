import { Email } from '../../../../shared/domain/email.vo.js';
import { User } from '../../domain/entities/user.entity.js';
import {
  Role as RolePrisma,
  MentorProfileStatus,
} from '../../../../generated/prisma/enums.js';
import { Role } from '../../../../shared/domain/role.js';
export interface UserRow {
  id: string;
  name: string;
  email: string;
  passwordHash: string | null;
  role: RolePrisma;
  active: boolean;
  googleId: string | null;
  appleId: string | null;
  bio: string | null;
  avatarKey: string | null;
  areas: string[];
  mentorFeatured: boolean;
  mentorStatus: MentorProfileStatus;
  lastAccessAt: Date | null;
  notifLives: boolean;
  notifCommunity: boolean;
  notifSummary: boolean;
}
export function rowForUser(row: UserRow): User {
  return User.reconstituir({
    id: row.id,
    name: row.name,
    email: Email.from(row.email),
    passwordHash: row.passwordHash,
    role: row.role as Role,
    active: row.active,
    googleId: row.googleId,
    appleId: row.appleId,
    bio: row.bio,
    avatarKey: row.avatarKey,
    areas: row.areas,
    mentorFeatured: row.mentorFeatured,
    mentorStatus: row.mentorStatus as 'PENDING' | 'APPROVED' | 'REJECTED',
    lastAccessAt: row.lastAccessAt,
    notifLives: row.notifLives,
    notifCommunity: row.notifCommunity,
    notifSummary: row.notifSummary,
  });
}
export function userForEscritura(user: User) {
  return {
    name: user.name,
    email: user.email.value,
    passwordHash: user.passwordHash,
    role: user.role as RolePrisma,
    active: user.active,
    googleId: user.googleId,
    appleId: user.appleId,
    bio: user.bio,
    avatarKey: user.avatarKey,
    areas: user.areas,
    mentorFeatured: user.mentorFeatured,
    mentorStatus: user.mentorStatus as MentorProfileStatus,
    lastAccessAt: user.lastAccessAt,
    notifLives: user.notifications.lives,
    notifCommunity: user.notifications.community,
    notifSummary: user.notifications.summary,
  };
}
