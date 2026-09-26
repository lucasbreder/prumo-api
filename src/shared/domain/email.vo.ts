import { BusinessRuleError } from '../errors/domain.errors.js';
const EMAIL_REGEX = /^[^\s@]+@[^\s@.]+(\.[^\s@.]+)+$/;
export class Email {
  private constructor(readonly value: string) {}
  static from(raw: string): Email {
    const value = raw?.trim().toLowerCase() ?? '';
    if (!EMAIL_REGEX.test(value)) {
      throw new BusinessRuleError('E-mail invalido');
    }
    return new Email(value);
  }
  equals(outro: Email): boolean {
    return this.value === outro.value;
  }
  toString(): string {
    return this.value;
  }
}
