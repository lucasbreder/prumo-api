import { Email } from '../../../../shared/domain/email.vo.js';
import { Role } from '../../../../shared/domain/role.js';
import { BusinessRuleError } from '../../../../shared/errors/domain.errors.js';
export type SocialProvider = 'GOOGLE' | 'APPLE';
export interface UserProps {
  id: string;
  name: string;
  email: Email;
  // Null for social-only accounts (Google/Apple) created without a password.
  passwordHash: string | null;
  role: Role;
  active: boolean;
  googleId?: string | null;
  appleId?: string | null;
  bio?: string | null;
  avatarKey?: string | null;
  areas: string[];
  mentorFeatured: boolean;
  mentorStatus: 'PENDING' | 'APPROVED' | 'REJECTED';
  lastAccessAt?: Date | null;
  notifLives: boolean;
  notifCommunity: boolean;
  notifSummary: boolean;
}
export class User {
  private constructor(private readonly props: UserProps) {}
  static create(
    data: Pick<UserProps, 'id' | 'name' | 'email' | 'passwordHash'> &
      Partial<Pick<UserProps, 'role' | 'active'>>,
  ): User {
    if (!data.name?.trim()) {
      throw new BusinessRuleError('O nome e obrigatorio');
    }
    return new User({
      ...data,
      name: data.name.trim(),
      role: data.role ?? 'STUDENT',
      active: data.active ?? true,
      googleId: null,
      appleId: null,
      avatarKey: null,
      areas: [],
      mentorFeatured: false,
      mentorStatus: 'PENDING',
      notifLives: true,
      notifCommunity: true,
      notifSummary: false,
    });
  }
  static createOAuth(data: {
    id: string;
    name: string;
    email: Email;
    provider: SocialProvider;
    providerId: string;
    role?: Role;
  }): User {
    if (!data.name?.trim()) {
      throw new BusinessRuleError('O nome e obrigatorio');
    }
    return new User({
      id: data.id,
      name: data.name.trim(),
      email: data.email,
      passwordHash: null,
      role: data.role ?? 'STUDENT',
      active: true,
      googleId: data.provider === 'GOOGLE' ? data.providerId : null,
      appleId: data.provider === 'APPLE' ? data.providerId : null,
      areas: [],
      mentorFeatured: false,
      mentorStatus: 'PENDING',
      notifLives: true,
      notifCommunity: true,
      notifSummary: false,
    });
  }
  static reconstituir(props: UserProps): User {
    return new User(props);
  }
  get id(): string {
    return this.props.id;
  }
  get name(): string {
    return this.props.name;
  }
  get email(): Email {
    return this.props.email;
  }
  get passwordHash(): string | null {
    return this.props.passwordHash;
  }
  get hasPassword(): boolean {
    return this.props.passwordHash !== null;
  }
  get googleId(): string | null {
    return this.props.googleId ?? null;
  }
  get appleId(): string | null {
    return this.props.appleId ?? null;
  }
  providerIdFor(provider: SocialProvider): string | null {
    return provider === 'GOOGLE' ? this.googleId : this.appleId;
  }
  linkProvider(provider: SocialProvider, providerId: string): void {
    if (provider === 'GOOGLE') this.props.googleId = providerId;
    else this.props.appleId = providerId;
  }
  get role(): Role {
    return this.props.role;
  }
  get active(): boolean {
    return this.props.active;
  }
  get bio(): string | null {
    return this.props.bio ?? null;
  }
  get avatarKey(): string | null {
    return this.props.avatarKey ?? null;
  }
  get areas(): string[] {
    return [...this.props.areas];
  }
  get mentorFeatured(): boolean {
    return this.props.mentorFeatured;
  }
  get mentorStatus(): UserProps['mentorStatus'] {
    return this.props.mentorStatus;
  }
  get lastAccessAt(): Date | null {
    return this.props.lastAccessAt ?? null;
  }
  get notifications(): {
    lives: boolean;
    community: boolean;
    summary: boolean;
  } {
    return {
      lives: this.props.notifLives,
      community: this.props.notifCommunity,
      summary: this.props.notifSummary,
    };
  }
  updateNotifications(
    data: Partial<{
      lives: boolean;
      community: boolean;
      summary: boolean;
    }>,
  ): void {
    if (data.lives !== undefined) this.props.notifLives = data.lives;
    if (data.community !== undefined)
      this.props.notifCommunity = data.community;
    if (data.summary !== undefined) this.props.notifSummary = data.summary;
  }
  registerAccess(em: Date): void {
    this.props.lastAccessAt = em;
  }
  trocarPassword(novoHash: string): void {
    this.props.passwordHash = novoHash;
  }
  updateProfile(name?: string, bio?: string): void {
    if (name !== undefined) {
      if (!name.trim()) {
        throw new BusinessRuleError('O nome e obrigatorio');
      }
      this.props.name = name.trim();
    }
    if (bio !== undefined) {
      this.props.bio = bio.trim();
    }
  }
  setAvatarKey(key: string | null): void {
    this.props.avatarKey = key;
  }
  definirRole(role: Role): void {
    this.props.role = role;
  }
  definirActive(active: boolean): void {
    this.props.active = active;
  }
  updateProfileMentor(data: {
    bio?: string;
    areas?: string[];
    featured?: boolean;
    status?: UserProps['mentorStatus'];
  }): void {
    if (this.props.role !== 'MENTOR') {
      throw new BusinessRuleError(
        'Somente contas com papel de mentor possuem perfil',
      );
    }
    if (data.bio !== undefined) this.props.bio = data.bio;
    if (data.areas !== undefined) this.props.areas = data.areas;
    if (data.featured !== undefined) this.props.mentorFeatured = data.featured;
    if (data.status !== undefined) this.props.mentorStatus = data.status;
  }
}
