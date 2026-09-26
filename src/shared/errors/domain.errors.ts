export abstract class DomainError extends Error {
  abstract readonly status: number;
  abstract readonly code: string;
}
export class BusinessRuleError extends DomainError {
  readonly status = 422;
  readonly code = 'BUSINESS_RULE';
  constructor(message: string) {
    super(message);
    this.name = new.target.name;
  }
}
export class NotFoundError extends DomainError {
  readonly status = 404;
  readonly code = 'NOT_FOUND';
  constructor(message = 'Recurso nao encontrado') {
    super(message);
    this.name = new.target.name;
  }
}
export class ConflictError extends DomainError {
  readonly status = 409;
  readonly code = 'CONFLICT';
  constructor(message = 'Conflito de dados') {
    super(message);
    this.name = new.target.name;
  }
}
export class AccessDeniedError extends DomainError {
  readonly status = 403;
  readonly code = 'ACCESS_DENIED';
  constructor(message = 'Voce nao tem acesso a este recurso') {
    super(message);
    this.name = new.target.name;
  }
}
export class InvalidCredentialsError extends DomainError {
  readonly status = 401;
  readonly code = 'INVALID_CREDENTIALS';
  constructor(message = 'Credenciais invalidas') {
    super(message);
    this.name = new.target.name;
  }
}
