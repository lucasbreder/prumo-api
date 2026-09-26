export interface SessionRefreshProps {
  id: string;
  userId: string;
  tokenHash: string;
  familyId: string;
  deviceId?: string | null;
  expiresAt: Date;
  revokedAt: Date | null;
}
export class SessionRefresh {
  private constructor(private readonly props: SessionRefreshProps) {}
  static issue(props: {
    id: string;
    userId: string;
    tokenHash: string;
    familyId: string;
    deviceId?: string | null;
    expiresAt: Date;
  }): SessionRefresh {
    return new SessionRefresh({
      ...props,
      deviceId: props.deviceId ?? null,
      revokedAt: null,
    });
  }
  static reconstituir(props: SessionRefreshProps): SessionRefresh {
    return new SessionRefresh(props);
  }
  get id(): string {
    return this.props.id;
  }
  get userId(): string {
    return this.props.userId;
  }
  get tokenHash(): string {
    return this.props.tokenHash;
  }
  get familyId(): string {
    return this.props.familyId;
  }
  get expiresAt(): Date {
    return this.props.expiresAt;
  }
  get revokedAt(): Date | null {
    return this.props.revokedAt;
  }
  estaExpired(current: Date): boolean {
    return this.props.expiresAt.getTime() <= current.getTime();
  }
  get jaRevogada(): boolean {
    return this.props.revokedAt !== null;
  }
  revoke(em: Date): void {
    this.props.revokedAt = em;
  }
}
