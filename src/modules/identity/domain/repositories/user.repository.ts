import { Role } from '../../../../shared/domain/role.js';
import { SocialProvider, User } from '../entities/user.entity.js';
export const USER_READER = 'USER_READER' as const;
export const USER_WRITER = 'USER_WRITER' as const;
export interface UserReader {
  byId(id: string): Promise<User | null>;
  byEmail(email: string): Promise<User | null>;
  byProvider(
    provider: SocialProvider,
    providerId: string,
  ): Promise<User | null>;
}
export interface UserWriter {
  create(user: User): Promise<void>;
  save(user: User): Promise<void>;
}
export interface StudentRow {
  id: string;
  name: string;
  email: string;
  planId: string | null;
  planName: string | null;
  coursePrincipal: string | null;
  progressPercent: number;
  lastAccessAt: Date | null;
  status: 'ACTIVE' | 'PAUSED' | 'EXPIRED';
}
export interface StudentFilter {
  search?: string;
  page: number;
  perPage: number;
}
export const STUDENTS_READER = 'STUDENTS_READER' as const;
export interface StudentsReader {
  list(filter: StudentFilter): Promise<{
    rows: StudentRow[];
    total: number;
  }>;
}
export interface MentorFilter {
  search?: string;
  role?: Role;
}
export const MENTOR_READER = 'MENTOR_READER' as const;
export interface MentorReader {
  listMentors(aprovadosOnly: boolean): Promise<User[]>;
  countMentorsPending(): Promise<number>;
}
export interface MentorAdminRow {
  id: string;
  name: string;
  email: string;
  areas: string[];
  bio: string | null;
  featured: boolean;
  status: 'PENDING' | 'APPROVED' | 'REJECTED';
  active: boolean;
  coursesCount: number;
}
export const MENTORS_ADMIN_READER = 'MENTORS_ADMIN_READER' as const;
export interface MentorsAdminReader {
  listAll(): Promise<MentorAdminRow[]>;
}
