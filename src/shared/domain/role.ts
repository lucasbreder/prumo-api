export const ROLES = ['STUDENT', 'MENTOR', 'ADMIN'] as const;
export type Role = (typeof ROLES)[number];
